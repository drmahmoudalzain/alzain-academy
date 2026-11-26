-- ============================================================
-- 0122_activate_points_rules_rollback.sql
-- إعادة سياسات النقاط إلى ما قبل 0122، ودوال القرّاء والتسليم إلى نسخ 0108،
-- وstudent_lecture_attendance إلى نسخة 0121 التي تحفظ مسار المحاضرة الأصل.
-- لا يحذف هذا الملف أي نقاط أو تسجيل أو إجابة قائمة.
-- ============================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) السياسات: المفاتيح الثلاثة الأصلية من 0115 كما كانت، وإزالة المفاتيح
--    التي أضافها 0122 فقط. عتبتا 300/150 لا تُمسّان.
-- ---------------------------------------------------------------------------
insert into public.academic_policies (key, value, description) values
  ('point_sources', '["attendance","interaction","assignment"]'::jsonb,
   'مصادر النقاط التي تُحصى للمقرر')
on conflict (key) do update
   set value = excluded.value,
       description = excluded.description,
       updated_at = now();

delete from public.academic_policies
 where key in (
   'lecture_count_cap',
   'lecture_attendance_points',
   'lecture_interaction_points',
   'lecture_exam_points',
   'recorded_exam_points',
   'attendance_minutes_per_point',
   'attendance_points_cap',
   'attendance_required_minutes'
 );

do $$
declare v_constraint text;
begin
  for v_constraint in
    select conname
    from pg_catalog.pg_constraint
    where conrelid = 'public.points_ledger'::regclass
      and conname = 'points_ledger_source_type_check'
  loop
    execute format('alter table public.points_ledger drop constraint %I', v_constraint);
  end loop;
end $$;

-- إبقاء 'exam' في القيد مقصود: العودة للقيد الثلاثي تتطلب حذف صفوف exam،
-- والتراجع لا يحذف بيانات؛ يبقى القيد الرباعي حتى يؤرشف المالك تلك الصفوف ويُنظّفها صراحةً.
alter table public.points_ledger
  add constraint points_ledger_source_type_check
  check (source_type in ('attendance','interaction','assignment','exam'));

-- ---------------------------------------------------------------------------
-- 2) نسخة 0121 من student_lecture_attendance، حرفياً، بلا حذف صفوف
-- ---------------------------------------------------------------------------
create or replace function public.student_lecture_attendance(
  p_lecture_id bigint,
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid bigint := public.current_user_id();
  v_row record;
  v_effective_course_id bigint;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not authenticated');
  end if;

  select l.*, coalesce(public.course_for_student_lecture(l.id, v_uid), l.course_id) as effective_course_id
  into v_row
  from lectures l
  where l.id = p_lecture_id
    and exists (
      select 1 from enrollments e
      where e.course_id = coalesce(public.course_for_student_lecture(l.id, v_uid), l.course_id)
        and e.student_id = v_uid and e.status = 'active'
    )
  limit 1;

  if v_row.id is null then
    return jsonb_build_object('ok', false, 'error', 'lecture_not_found');
  end if;
  v_effective_course_id := v_row.effective_course_id;
  if not v_row.attendance_open then
    return jsonb_build_object('ok', false, 'error', 'attendance_not_open');
  end if;
  if v_row.attendance_code is null or btrim(coalesce(p_code, '')) = '' then
    return jsonb_build_object('ok', false, 'error', 'code_required');
  end if;
  if btrim(p_code) <> btrim(v_row.attendance_code) then
    return jsonb_build_object('ok', false, 'error', 'wrong_code');
  end if;

  insert into attendance (lecture_id, student_id, method, code_used, created_at)
  values (p_lecture_id, v_uid, 'code', btrim(p_code), now())
  on conflict (lecture_id, student_id) do nothing;

  insert into points_ledger (user_id, course_id, source_type, source_id, source_detail, points, created_at)
  select v_uid, v_effective_course_id, 'attendance', p_lecture_id, 'حضور محاضرة', 10, now()
  where not exists (
    select 1 from points_ledger pl
    where pl.user_id = v_uid and pl.course_id = v_effective_course_id
      and pl.source_type = 'attendance' and pl.source_id = p_lecture_id
  )
  on conflict on constraint points_ledger_user_course_source_uniq do nothing;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('attended', true));
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) نسخة 0108 من student_exam_submit، حرفياً، بلا سجل exam جديد
-- ---------------------------------------------------------------------------
create or replace function public.student_exam_submit(p_attempt_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid bigint := public.current_user_id();
  v_exam_id bigint;
  v_has_essay boolean;
  v_score numeric(6,2);
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not authenticated');
  end if;

  select exam_id into v_exam_id from exam_attempts
  where id = p_attempt_id and student_id = v_uid and submitted_at is null;
  if v_exam_id is null then
    return jsonb_build_object('ok', false, 'error', 'attempt_closed');
  end if;

  select exists(select 1 from exam_questions where exam_id = v_exam_id and type = 'essay') into v_has_essay;

  update exam_answers aa
     set points = case
       when q.type = 'essay' then null
       when q.type = 'truefalse' and aa.choice_index = q.correct_index then q.points
       when q.type = 'mcq' and aa.choice_index = q.correct_index then q.points
       when q.type = 'multi' and aa.choice_indices = q.correct_indices then q.points
       else 0
     end
  from exam_questions q
  where aa.attempt_id = p_attempt_id and aa.question_id = q.id;

  -- أسئلة لم تُجب تُحتسب صفراً.
  insert into exam_answers (attempt_id, question_id, points)
  select p_attempt_id, q.id, 0
  from exam_questions q
  where q.exam_id = v_exam_id
    and not exists (select 1 from exam_answers aa where aa.attempt_id = p_attempt_id and aa.question_id = q.id)
    and q.type <> 'essay'
  on conflict (attempt_id, question_id) do nothing;

  select coalesce(sum(points), 0) into v_score from exam_answers where attempt_id = p_attempt_id;

  update exam_attempts
     set submitted_at = now(),
         score = v_score,
         status = case when v_has_essay then 'submitted' else 'graded' end,
         graded_at = case when v_has_essay then null else now() end
   where id = p_attempt_id;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('attempt_id', p_attempt_id, 'score', v_score));
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) نسخ 0108 من قارئي الدرجات والنقاط، حرفياً، من دون حقول العرض الجديدة
-- ---------------------------------------------------------------------------
create or replace function public.student_grades()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid bigint := public.current_user_id();
  v_result jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not authenticated');
  end if;

  with courses_rows as (
    select c.id, c.title, c.code, c.color,
           c.attendance_weight, c.exams_weight, c.assignments_weight,
           coalesce((
             select round(avg(case when q.points > 0 then coalesce(aa.points,0) * 100 / q.points end))
             from exam_attempts a
             join exam_answers aa on aa.attempt_id = a.id
             join exam_questions q on q.id = aa.question_id
             where a.exam_id in (select id from exams where course_id = c.id and is_published = true)
               and a.student_id = v_uid and a.submitted_at is not null
           ), 0) as exam_pct,
           coalesce((
             select round(avg(s.points * 100 / asg.max_points))
             from submissions s
             join assignments asg on asg.id = s.assignment_id
             where asg.course_id = c.id and s.student_id = v_uid and s.points is not null
               and asg.max_points > 0
           ), 0) as assignment_pct,
           coalesce((
             select round(count(*)::numeric * 100 / nullif((select count(*) from lectures where course_id = c.id), 0))
             from attendance a
             join lectures l on l.id = a.lecture_id
             where l.course_id = c.id and a.student_id = v_uid
           ), 0) as attendance_pct,
           (select count(*) from lectures where course_id = c.id) as lectures_count,
           (select count(*) from exams where course_id = c.id and is_published = true) as exams_count,
           (select count(*) from assignments where course_id = c.id) as assignments_count
    from courses c
    join enrollments e on e.course_id = c.id and e.student_id = v_uid and e.status = 'active'
    where coalesce(c.archived, false) = false
  ),
  final as (
    select r.*,
      round(
        (r.attendance_pct * r.attendance_weight
         + r.exam_pct * r.exams_weight
         + r.assignment_pct * r.assignments_weight)
        / nullif(r.attendance_weight + r.exams_weight + r.assignments_weight, 0), 2
      ) as final_pct
    from courses_rows r
  )
  select jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'gpa', coalesce((
        select round(avg(case
          when final_pct >= 90 then 4.0 when final_pct >= 85 then 3.7
          when final_pct >= 80 then 3.3 when final_pct >= 75 then 3.0
          when final_pct >= 70 then 2.7 when final_pct >= 65 then 2.3
          when final_pct >= 60 then 2.0 else 1.0 end), 2)
        from final where final_pct > 0
      ), 0),
      'average', coalesce((select round(avg(final_pct)) from final where final_pct > 0), 0),
      'courses_count', (select count(*) from final),
      'completed_count', (select count(*) from final where final_pct > 0),
      'courses', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', f.id, 'title', f.title, 'code', f.code, 'color', f.color,
          'exam_pct', f.exam_pct, 'assignment_pct', f.assignment_pct,
          'attendance_pct', f.attendance_pct, 'final_pct', f.final_pct,
          'letter', case
            when f.final_pct >= 90 then 'A' when f.final_pct >= 85 then 'A-'
            when f.final_pct >= 80 then 'B+' when f.final_pct >= 75 then 'B'
            when f.final_pct >= 70 then 'B-' when f.final_pct >= 65 then 'C+'
            when f.final_pct >= 60 then 'C' else 'D' end,
          'lectures_count', f.lectures_count,
          'exams_count', f.exams_count,
          'assignments_count', f.assignments_count
        ) order by f.code)
        from final f
      ), '[]'::jsonb),
      'distribution', jsonb_build_object(
        'excellent', (select count(*) from final where final_pct >= 90),
        'very_good', (select count(*) from final where final_pct >= 80 and final_pct < 90),
        'good',      (select count(*) from final where final_pct >= 70 and final_pct < 80),
        'pass',      (select count(*) from final where final_pct >= 60 and final_pct < 70),
        'low',       (select count(*) from final where final_pct > 0 and final_pct < 60)
      )
    )
  )
  into v_result;

  return v_result;
end;
$$;

create or replace function public.student_points()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid bigint := public.current_user_id();
  v_result jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not authenticated');
  end if;

  select jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'total', coalesce((select sum(points) from points_ledger where user_id = v_uid), 0),
      'week', coalesce((
        select sum(points) from points_ledger
        where user_id = v_uid and created_at >= now() - interval '7 days'
      ), 0),
      'breakdown', jsonb_build_object(
        'attendance',   coalesce((select sum(points) from points_ledger where user_id = v_uid and source_type = 'attendance'), 0),
        'interaction',  coalesce((select sum(points) from points_ledger where user_id = v_uid and source_type = 'interaction'), 0),
        'assignment',   coalesce((select sum(points) from points_ledger where user_id = v_uid and source_type = 'assignment'), 0)
      ),
      'rank', coalesce((
        select r.rnk from (
          select user_id, rank() over (order by sum(points) desc) as rnk
          from points_ledger group by user_id
        ) r where r.user_id = v_uid
      ), 0),
      'students_count', (select count(*) from users where role = 'student' and is_active = true),
      'by_course', coalesce((
        select jsonb_agg(jsonb_build_object(
          'course_id', pl.course_id,
          'course_title', c.title,
          'course_code', c.code,
          'color', c.color,
          'points', pl.total
        ) order by pl.total desc)
        from (
          select course_id, sum(points) as total from points_ledger
          where user_id = v_uid group by course_id
        ) pl
        join courses c on c.id = pl.course_id
      ), '[]'::jsonb),
      'leaderboard', coalesce((
        select jsonb_agg(jsonb_build_object(
          'user_id', lb.user_id,
          'name', u.name,
          'points', lb.total,
          'is_me', lb.user_id = v_uid
        ) order by lb.total desc, u.name)
        from (
          select user_id, sum(points) as total
          from points_ledger group by user_id order by sum(points) desc limit 10
        ) lb
        join users u on u.id = lb.user_id
      ), '[]'::jsonb),
      'ledger', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', pl.id,
          'source_type', pl.source_type,
          'source_detail', pl.source_detail,
          'points', pl.points,
          'created_at', pl.created_at,
          'course_title', c.title
        ) order by pl.created_at desc, pl.id desc)
        from (
          select * from points_ledger where user_id = v_uid order by created_at desc limit 60
        ) pl
        left join courses c on c.id = pl.course_id
      ), '[]'::jsonb)
    )
  )
  into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) إسقاط الدوال الجديدة وإعادة منح نسخ ما قبل 0122 إلى authenticated وحدها
-- ---------------------------------------------------------------------------
drop function if exists public.student_lecture_presence_heartbeat(bigint,integer);
drop function if exists public.lecture_points_award(bigint,bigint,bigint);
drop function if exists public.student_lecture_interaction_answer(bigint,integer,jsonb,text);

do $$
declare f text;
begin
  foreach f in array array[
    'student_lecture_attendance(bigint,text)',
    'student_exam_submit(bigint)',
    'student_grades()',
    'student_points()'
  ] loop
    execute format('revoke all on function public.%s from public, anon, service_role', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

notify pgrst, 'reload schema';

commit;

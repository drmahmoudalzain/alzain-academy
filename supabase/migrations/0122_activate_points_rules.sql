-- ============================================================
-- 0122_activate_points_rules.sql
-- تفعيل قواعد اكتساب النقاط الموثقة في PROJECT_STATUS §2.3:
-- أول 10 محاضرات، 10 حضور + 10 تفاعل + 10 اختبار للمباشر/الأونلاين،
-- 30 اختباراً للمسجّلة، نقطة عن كل 10 دقائق بحد 10 بعد 100 من 120 دقيقة،
-- ونقطة عن كل إجابة صحيحة بحد 10 للمحاضرة. التفعيل من الآن فقط،
-- بلا إعادة حساب للبيانات القديمة وبلا تغيير في مضمون أي قاعدة.
-- لا يُطبَّق هذا الترحيل إلا بعد تأكيد منفصل من المالك.
-- ============================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) المفاتيح الجديدة في academic_policies. الثوابت 'course_target_points', '300'
--    و'course_pass_points', '150' تبقى كما هي، ومصدر exam يُضاف إلى المصادر.
-- ---------------------------------------------------------------------------
insert into public.academic_policies (key, value, description) values
  ('lecture_count_cap', '10'::jsonb, 'أول محاضرات تُحتسب للطالب في المقرر'),
  ('lecture_attendance_points', '10'::jsonb, 'سقف نقاط حضور المحاضرة الواحدة'),
  ('lecture_interaction_points', '10'::jsonb, 'سقف نقاط تفاعل المحاضرة الواحدة'),
  ('lecture_exam_points', '10'::jsonb, 'سقف اختبار المحاضرة المباشرة أو الإلكترونية'),
  ('recorded_exam_points', '30'::jsonb, 'سقف اختبار المحاضرة المسجّلة'),
  ('attendance_minutes_per_point', '10'::jsonb, 'الدقائق المطلوبة لنقطة الحضور'),
  ('attendance_points_cap', '10'::jsonb, 'أقصى نقاط حضور للمحاضرة'),
  ('attendance_required_minutes', '100'::jsonb, 'أقل مدة قبل احتساب نقاط الحضور')
on conflict (key) do update
   set value = excluded.value,
       description = excluded.description,
       updated_at = now();

insert into public.academic_policies (key, value, description) values
  ('point_sources', '["attendance","interaction","assignment","exam"]'::jsonb,
   'مصادر النقاط التي تُحصى للمقرر')
on conflict (key) do update
   set value = excluded.value,
       description = excluded.description,
       updated_at = now();

-- points_ledger يقبل الآن exam. التفرد القائم من 0004 يبقى بلا لمس:
-- unique nulls not distinct (user_id, course_id, source_type, source_id)
do $$
declare v_constraint text;
begin
  for v_constraint in
    select conname
    from pg_catalog.pg_constraint
    where conrelid = 'public.points_ledger'::regclass
      and contype = 'c'
      and pg_catalog.pg_get_constraintdef(oid) like '%source_type%'
  loop
    execute format('alter table public.points_ledger drop constraint %I', v_constraint);
  end loop;
end $$;

alter table public.points_ledger
  add constraint points_ledger_source_type_check
  check (source_type in ('attendance','interaction','assignment','exam'));

-- ---------------------------------------------------------------------------
-- 2) سقف أول 10 محاضرات: يعدّ محاضرات مميّزة واحدة عبر المصادر الثلاثة.
--    الدالة مساعدة داخلية: تستدعيها الدوال المأذونة بصلاحية definer فقط،
--    وصلاحيتها محصورة بـ service_role حتى لا تُستدعى من PostgREST.
-- ---------------------------------------------------------------------------
create or replace function public.lecture_points_award(
  p_lecture_id bigint,
  p_student_id bigint,
  p_course_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cap      integer;
  v_count    integer;
  v_already  boolean;
begin
  select (p.value #>> '{}')::integer into v_cap
  from public.academic_policies p
  where p.key = 'lecture_count_cap';
  if v_cap is null then
    return jsonb_build_object('ok', false, 'error', 'سياسات النقاط غير مكتملة');
  end if;

  with awarded_lectures as (
    select pl.source_id as lecture_id
    from public.points_ledger pl
    where pl.user_id = p_student_id
      and pl.course_id = p_course_id
      and pl.source_type = 'attendance'
      and pl.source_id is not null
    union
    select q.lecture_id as lecture_id
    from public.points_ledger pl
    join public.questions q on q.id = pl.source_id
    where pl.user_id = p_student_id
      and pl.course_id = p_course_id
      and pl.source_type = 'interaction'
      and q.lecture_id is not null
    union
    select e.lecture_id as lecture_id
    from public.points_ledger pl
    join public.exams e on e.id = pl.source_id
    where pl.user_id = p_student_id
      and pl.course_id = p_course_id
      and pl.source_type = 'exam'
      and e.lecture_id is not null
  )
  select count(*), bool_or(lecture_id = p_lecture_id)
    into v_count, v_already
  from awarded_lectures;

  return jsonb_build_object(
    'ok', v_already or v_count < v_cap,
    'count', v_count,
    'cap', v_cap,
    'lecture_id', p_lecture_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) كاتب زمن التواجد: لا توجد طريقة أخرى لملء lecture_presence.total_seconds،
--    فالحساب بالدقائق يحتاج heartbeat للطالب المسجّل فقط، مع سقف 120 دقيقة.
-- ---------------------------------------------------------------------------
create or replace function public.student_lecture_presence_heartbeat(
  p_lecture_id bigint,
  p_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          bigint := public.current_user_id();
  v_effective_course_id bigint;
  v_total_seconds integer;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not authenticated');
  end if;

  select coalesce(public.course_for_student_lecture(l.id, v_uid), l.course_id)
    into v_effective_course_id
  from public.lectures l
  where l.id = p_lecture_id;

  if v_effective_course_id is null
     or not exists (
       select 1 from public.enrollments e
       where e.course_id = v_effective_course_id
         and e.student_id = v_uid
         and e.status = 'active'
     ) then
    return jsonb_build_object('ok', false, 'error', 'lecture_not_found');
  end if;

  insert into public.lecture_presence (lecture_id, student_id, total_seconds, last_heartbeat_at)
  values (
    p_lecture_id, v_uid,
    least(7200, least(greatest(0, coalesce(p_seconds, 0)), 60)),
    now()
  )
  on conflict (lecture_id, student_id) do update
     set total_seconds = least(7200,
           public.lecture_presence.total_seconds
           + least(
               greatest(0, coalesce(p_seconds, 0)),
               greatest(0, extract(epoch from now() - public.lecture_presence.last_heartbeat_at)::int),
               60
             )),
         last_heartbeat_at = now()
  returning total_seconds into v_total_seconds;

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object('lecture_id', p_lecture_id, 'total_seconds', v_total_seconds)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) إجابة أسئلة المحاضرة: لا توجد سياسة إدراج على question_answers،
--    فالكتابة تمر-function security definer. الإجابة تُحفظ مرة واحدة،
--    والحكم على الصحة يُؤخذ من الإجابة المخزّنة لا من الطلب اللاحق.
-- ---------------------------------------------------------------------------
create or replace function public.student_lecture_interaction_answer(
  p_question_id bigint,
  p_choice_index integer default null,
  p_choice_indices jsonb default null,
  p_text text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          bigint := public.current_user_id();
  v_question     record;
  v_cap          integer;
  v_earned       integer;
  v_correct      boolean := false;
  v_award        jsonb;
  v_stored       public.question_answers%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not authenticated');
  end if;

  select q.*,
         l.lecture_type,
         coalesce(public.course_for_student_lecture(q.lecture_id, v_uid), l.course_id) as effective_course_id
    into v_question
  from public.questions q
  join public.lectures l on l.id = q.lecture_id
  where q.id = p_question_id
    and q.is_open = true
  limit 1;

  if v_question.id is null
     or not exists (
       select 1 from public.enrollments e
       where e.course_id = v_question.effective_course_id
         and e.student_id = v_uid
         and e.status = 'active'
     ) then
    return jsonb_build_object('ok', false, 'error', 'question_not_found');
  end if;

  insert into public.question_answers (question_id, student_id, choice_index, choice_indices, text)
  values (p_question_id, v_uid, p_choice_index, p_choice_indices, p_text)
  on conflict (question_id, student_id) do nothing;

  select * into v_stored
  from public.question_answers
  where question_id = p_question_id and student_id = v_uid;

  if v_question.type in ('mcq', 'truefalse') then
    v_correct := v_stored.choice_index is not null and v_stored.choice_index = v_question.correct_index;
  elsif v_question.type = 'multi' then
    v_correct := v_stored.choice_indices is not null and v_stored.choice_indices = v_question.correct_indices;
  end if;

  select (p.value #>> '{}')::integer into v_cap
  from public.academic_policies p
  where p.key = 'lecture_interaction_points';
  if v_cap is null then
    return jsonb_build_object('ok', false, 'error', 'سياسات النقاط غير مكتملة');
  end if;

  if v_correct and v_question.lecture_type <> 'recorded' then
    select coalesce(sum(pl.points), 0) into v_earned
    from public.points_ledger pl
    join public.questions q on q.id = pl.source_id
    where pl.user_id = v_uid
      and pl.course_id = v_question.effective_course_id
      and pl.source_type = 'interaction'
      and q.lecture_id = v_question.lecture_id;

    if not (v_earned >= v_cap) then
      select public.lecture_points_award(
        v_question.lecture_id, v_uid, v_question.effective_course_id
      ) into v_award;

      if (v_award ->> 'ok')::boolean is true then
        insert into public.points_ledger (user_id, course_id, source_type, source_id, source_detail, points, created_at)
        values (v_uid, v_question.effective_course_id, 'interaction', p_question_id, 'إجابة صحيحة', 1, now())
        on conflict on constraint points_ledger_user_course_source_uniq do nothing;
        if found then
          return jsonb_build_object(
            'ok', true,
            'data', jsonb_build_object('saved', true, 'correct', v_correct, 'points', 1)
          );
        end if;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object('saved', true, 'correct', v_correct, 'points', 0)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) تسجيل الحضور: نفس تحققات 0121 وتوقيعها وردّها، مع حساب النقاط من زمن
--    التواجد الفعلي لا من رقم ثابت. مصدر النقاط يبقى صفاً واحداً لكل محاضرة.
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
  v_total_seconds integer;
  v_minutes_per_point integer;
  v_cap integer;
  v_required_minutes integer;
  v_points integer;
  v_award jsonb;
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

  insert into public.attendance (lecture_id, student_id, method, code_used, created_at)
  values (p_lecture_id, v_uid, 'code', btrim(p_code), now())
  on conflict (lecture_id, student_id) do nothing;

  select (p.value #>> '{}')::integer into v_minutes_per_point
  from public.academic_policies p where p.key = 'attendance_minutes_per_point';
  select (p.value #>> '{}')::integer into v_cap
  from public.academic_policies p where p.key = 'attendance_points_cap';
  select (p.value #>> '{}')::integer into v_required_minutes
  from public.academic_policies p where p.key = 'attendance_required_minutes';
  if v_minutes_per_point is null or v_cap is null or v_required_minutes is null
     or v_minutes_per_point <= 0 then
    return jsonb_build_object('ok', false, 'error', 'سياسات النقاط غير مكتملة');
  end if;

  select coalesce(lp.total_seconds, 0) into v_total_seconds
  from public.lecture_presence lp
  where lp.lecture_id = p_lecture_id and lp.student_id = v_uid;

  -- المسجّلة لها اختبارها فقط (30)، فلا تُحتسب لها نقاط حضور.
  if v_row.lecture_type <> 'recorded'
     and v_total_seconds >= v_required_minutes * 60 then
    v_points := least(v_cap, floor(v_total_seconds::numeric / 60 / v_minutes_per_point)::integer);
    if v_points > 0 then
      select public.lecture_points_award(p_lecture_id, v_uid, v_effective_course_id) into v_award;

      if (v_award ->> 'ok')::boolean is true then
        insert into points_ledger (user_id, course_id, source_type, source_id, source_detail, points, created_at)
        select v_uid, v_effective_course_id, 'attendance', p_lecture_id, 'حضور محاضرة', v_points, now()
        where not exists (
          select 1 from points_ledger pl
          where pl.user_id = v_uid and pl.course_id = v_effective_course_id
            and pl.source_type = 'attendance' and pl.source_id = p_lecture_id
        )
        on conflict on constraint points_ledger_user_course_source_uniq do nothing;
      end if;
    end if;
  end if;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('attended', true));
end;
$$;

-- ---------------------------------------------------------------------------
-- 6) تسليم الاختبار: تصحيح 0108 كما هو، مع صف points_ledger واحد للمصدر exam
--    حين يكون الاختبار مرتبطاً بمحاضرة، وبسقف نوع تلك المحاضرة.
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
  v_lecture_id bigint;
  v_course_id bigint;
  v_effective_course_id bigint;
  v_lecture_type text;
  v_cap integer;
  v_points integer;
  v_award jsonb;
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

  select e.lecture_id, e.course_id into v_lecture_id, v_course_id
  from public.exams e where e.id = v_exam_id;

  v_effective_course_id := v_course_id;

  if v_lecture_id is not null then
    select coalesce(public.course_for_student_lecture(v_lecture_id, v_uid), exams.course_id)
      into v_effective_course_id
    from public.exams exams
    where exams.id = v_exam_id;

    select l.lecture_type into v_lecture_type
    from public.lectures l where l.id = v_lecture_id;

    select (p.value #>> '{}')::integer into v_cap
    from public.academic_policies p
    where p.key = case when v_lecture_type = 'recorded' then 'recorded_exam_points' else 'lecture_exam_points' end;

    if v_cap is not null then
      v_points := least(v_score, v_cap)::integer;

      select public.lecture_points_award(v_lecture_id, v_uid, v_effective_course_id) into v_award;

      if (v_award ->> 'ok')::boolean is true then
        insert into points_ledger (user_id, course_id, source_type, source_id, source_detail, points, created_at)
        values (v_uid, v_effective_course_id, 'exam', v_exam_id,
                jsonb_build_object('lecture_id', v_lecture_id)::text, v_points, now())
        on conflict on constraint points_ledger_user_course_source_uniq do nothing;
      end if;
    end if;
  end if;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('attempt_id', p_attempt_id, 'score', v_score));
end;
$$;

-- ---------------------------------------------------------------------------
-- 7) قارئا الطالب: نسخة 0108 مع حقل عرض واحد لكل من التفاعل والاختبارات.
--    لا يتغيّر أي وزن أو معادلة نهائية؛ هذه تفعيل للعرض فقط.
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
            coalesce((
              select round(
                coalesce((select sum(pl.points) from points_ledger pl where pl.source_type = 'interaction' and pl.course_id = c.id and pl.user_id = v_uid), 0) * 100
                / nullif(
                  (select count(*) from lectures where course_id = c.id)
                  * (select (p.value #>> '{}')::numeric from academic_policies p where p.key = 'lecture_interaction_points'),
                  0)
              )
            ), 0) as interaction_pct,
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
          'attendance_pct', f.attendance_pct, 'interaction_pct', f.interaction_pct, 'final_pct', f.final_pct,
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
        'assignment',   coalesce((select sum(points) from points_ledger where user_id = v_uid and source_type = 'assignment'), 0),
         'exam', coalesce((select sum(points) from points_ledger where user_id = v_uid and source_type = 'exam'), 0)
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
-- 8) الصلاحيات: الدوال المأذونة لـ authenticated و service_role، والمساعد
--    helper محصور بـ service_role لأن الدوال المأذونة تنفّذ بصلاحية definer.
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'student_lecture_presence_heartbeat(bigint,integer)',
    'student_lecture_interaction_answer(bigint,integer,jsonb,text)',
    'student_lecture_attendance(bigint,text)',
    'student_exam_submit(bigint)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;

  execute 'revoke all on function public.lecture_points_award(bigint,bigint,bigint) from public, anon, authenticated';
  execute 'grant execute on function public.lecture_points_award(bigint,bigint,bigint) to service_role';
end $$;

notify pgrst, 'reload schema';

commit;

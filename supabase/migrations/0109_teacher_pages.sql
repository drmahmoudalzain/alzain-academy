-- ===========================================================================
-- 0109 — صفحات بوابة الأستاذ
--   لوحة التحكم، مقرراتي، تفاصيل المقرر
--
--   القراءة والكتابة كلها عبر RPCs SECURITY DEFINER. لا يعتمد العميل على
--   SELECT مباشر على users / lectures / exam_questions ولا على أي كتابة مباشرة.
--   المالك (AD*) يوجّه إلى بوابة الإدارة، لذلك كل دوال هذه الطبقة تتحقق من
--   أن المستخدم أستاذ وأن المقرر مملوك له فعلياً عند الكتابة.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) لوحة التحكم
-- ---------------------------------------------------------------------------
create or replace function public.teacher_dashboard()
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
  if v_uid is null or public.current_user_role() <> 'teacher' then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;

  select jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'active_courses', (
        select count(*) from courses
        where teacher_id = v_uid and coalesce(archived, false) = false
      ),
      'students', (
        select count(distinct e.student_id) from enrollments e
        join courses c on c.id = e.course_id
        where c.teacher_id = v_uid and e.status = 'active'
      ),
      'lectures', (
        select count(*) from lectures l
        join courses c on c.id = l.course_id where c.teacher_id = v_uid
      ),
      'exams', (
        select count(*) from exams x
        join courses c on c.id = x.course_id where c.teacher_id = v_uid
      ),
      'pending_grading', (
        select count(*) from submissions s
        join assignments a on a.id = s.assignment_id
        join courses c on c.id = a.course_id
        where c.teacher_id = v_uid and s.points is null
      ),
      'today_lectures', (
        select count(*) from lectures l
        join courses c on c.id = l.course_id
        where c.teacher_id = v_uid and l.scheduled_at is not null
          and l.scheduled_at >= current_date
          and l.scheduled_at < current_date + interval '1 day'
      ),
      'upcoming_exams', (
        select count(*) from exams x
        join courses c on c.id = x.course_id
        where c.teacher_id = v_uid and x.is_published = true
          and x.starts_at >= now() and x.starts_at < now() + interval '1 day'
      ),
      'courses', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', c.id, 'code', c.code, 'title', c.title, 'color', c.color,
          'archived', c.archived,
          'students', (select count(*) from enrollments e where e.course_id = c.id and e.status = 'active'),
          'lectures', (select count(*) from lectures l where l.course_id = c.id),
          'exams', (select count(*) from exams x where x.course_id = c.id),
          'pending', (
            select count(*) from submissions s join assignments a on a.id = s.assignment_id
            where a.course_id = c.id and s.points is null
          )
        ) order by c.archived, c.code)
        from (
          select * from courses where teacher_id = v_uid
          order by archived, code limit 6
        ) c
      ), '[]'::jsonb),
      'submissions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', s.id, 'points', s.points, 'submitted_at', s.submitted_at,
          'assignment_title', a.title, 'max_points', a.max_points,
          'course_code', c.code, 'course_title', c.title,
          'student_name', u.name, 'student_id', u.id,
          'student_platform_id', u.platform_id
        ) order by s.submitted_at desc, s.id desc)
        from (
          select s.* from submissions s
          join assignments a on a.id = s.assignment_id
          join courses c on c.id = a.course_id
          where c.teacher_id = v_uid and s.points is null
          order by s.submitted_at desc limit 6
        ) s
        join assignments a on a.id = s.assignment_id
        join courses c on c.id = a.course_id
        join users u on u.id = s.student_id
      ), '[]'::jsonb),
      'schedule', coalesce((
        select jsonb_agg(jsonb_build_object(
          'kind', k.kind, 'id', k.id, 'title', k.title,
          'at', k.at, 'course_code', k.course_code, 'course_title', k.course_title,
          'status', k.status
        ) order by k.at)
        from (
          select 'lecture'::text as kind, l.id, l.title, l.scheduled_at as at,
                 c.code as course_code, c.title as course_title, l.status
          from lectures l join courses c on c.id = l.course_id
          where c.teacher_id = v_uid and l.scheduled_at is not null
            and l.scheduled_at >= now() and l.scheduled_at < now() + interval '7 days'
          union all
          select 'exam'::text, x.id, x.title, x.starts_at,
                 c.code, c.title, case when x.is_published then 'published' else 'draft' end
          from exams x join courses c on c.id = x.course_id
          where c.teacher_id = v_uid and x.starts_at is not null
            and x.starts_at >= now() and x.starts_at < now() + interval '7 days'
        ) k
      ), '[]'::jsonb)
    )
  )
  into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) مقرراتي
-- ---------------------------------------------------------------------------
create or replace function public.teacher_courses()
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
  if v_uid is null or public.current_user_role() <> 'teacher' then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;

  select jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'total', (select count(*) from courses where teacher_id = v_uid),
      'active', (select count(*) from courses where teacher_id = v_uid and coalesce(archived,false)=false),
      'archived', (select count(*) from courses where teacher_id = v_uid and coalesce(archived,false)=true),
      'students', (
        select count(distinct e.student_id) from enrollments e
        join courses c on c.id = e.course_id
        where c.teacher_id = v_uid and e.status = 'active'
      ),
      'courses', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', c.id, 'code', c.code, 'title', c.title,
          'description', c.description, 'color', c.color,
          'track', c.track, 'level', c.level, 'archived', c.archived,
          'created_at', c.created_at,
          'students', (select count(*) from enrollments e where e.course_id = c.id and e.status = 'active'),
          'lectures', (select count(*) from lectures l where l.course_id = c.id),
          'exams', (select count(*) from exams x where x.course_id = c.id),
          'assignments', (select count(*) from assignments a where a.course_id = c.id),
          'pending', (
            select count(*) from submissions s join assignments a on a.id = s.assignment_id
            where a.course_id = c.id and s.points is null
          )
        ) order by c.archived, c.code)
        from courses c where c.teacher_id = v_uid
      ), '[]'::jsonb)
    )
  )
  into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) تفاصيل مقرر (طلاب، درجات، محاضرات، اختبارات، واجبات، تسليمات، نشاط)
-- ---------------------------------------------------------------------------
create or replace function public.teacher_course_detail(p_course_id bigint)
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
  if v_uid is null or public.current_user_role() <> 'teacher'
     or not public.teaches_course(p_course_id) then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;

  with roster as (
    select u.id, u.name, u.platform_id, u.university_id, u.email,
           e.status as enrollment_status, e.created_at as enrolled_at,
           coalesce((
             select round(avg(case when q.points > 0 then coalesce(aa.points,0) * 100 / q.points end))
             from exam_attempts at
             join exam_answers aa on aa.attempt_id = at.id
             join exam_questions q on q.id = aa.question_id
             where at.exam_id in (select id from exams where course_id = p_course_id and is_published = true)
               and at.student_id = u.id and at.submitted_at is not null
           ), 0) as exam_pct,
           coalesce((
             select round(avg(s.points * 100 / a.max_points))
             from submissions s join assignments a on a.id = s.assignment_id
             where a.course_id = p_course_id and s.student_id = u.id
               and s.points is not null and a.max_points > 0
           ), 0) as assignment_pct,
           coalesce((
             select round(count(*)::numeric * 100 / nullif((select count(*) from lectures where course_id = p_course_id), 0))
             from attendance at join lectures l on l.id = at.lecture_id
             where l.course_id = p_course_id and at.student_id = u.id
           ), 0) as attendance_pct,
           coalesce((
             select sum(pl.points) from points_ledger pl
             where pl.user_id = u.id and pl.course_id = p_course_id
           ), 0) as points
    from enrollments e join users u on u.id = e.student_id
    where e.course_id = p_course_id
  ),
  graded as (
    select r.*,
      round((r.attendance_pct * c.attendance_weight
           + r.exam_pct * c.exams_weight
           + r.assignment_pct * c.assignments_weight)
           / nullif(c.attendance_weight + c.exams_weight + c.assignments_weight, 0), 2) as final_pct,
      case
        when (r.attendance_pct * c.attendance_weight + r.exam_pct * c.exams_weight
              + r.assignment_pct * c.assignments_weight)
             / nullif(c.attendance_weight + c.exams_weight + c.assignments_weight, 0) >= 90 then 'A'
        when (r.attendance_pct * c.attendance_weight + r.exam_pct * c.exams_weight
              + r.assignment_pct * c.assignments_weight)
             / nullif(c.attendance_weight + c.exams_weight + c.assignments_weight, 0) >= 85 then 'A-'
        when (r.attendance_pct * c.attendance_weight + r.exam_pct * c.exams_weight
              + r.assignment_pct * c.assignments_weight)
             / nullif(c.attendance_weight + c.exams_weight + c.assignments_weight, 0) >= 80 then 'B+'
        when (r.attendance_pct * c.attendance_weight + r.exam_pct * c.exams_weight
              + r.assignment_pct * c.assignments_weight)
             / nullif(c.attendance_weight + c.exams_weight + c.assignments_weight, 0) >= 75 then 'B'
        when (r.attendance_pct * c.attendance_weight + r.exam_pct * c.exams_weight
              + r.assignment_pct * c.assignments_weight)
             / nullif(c.attendance_weight + c.exams_weight + c.assignments_weight, 0) >= 70 then 'B-'
        when (r.attendance_pct * c.attendance_weight + r.exam_pct * c.exams_weight
              + r.assignment_pct * c.assignments_weight)
             / nullif(c.attendance_weight + c.exams_weight + c.assignments_weight, 0) >= 65 then 'C+'
        when (r.attendance_pct * c.attendance_weight + r.exam_pct * c.exams_weight
              + r.assignment_pct * c.assignments_weight)
             / nullif(c.attendance_weight + c.exams_weight + c.assignments_weight, 0) >= 60 then 'C'
        else 'D' end as letter
    from roster r cross join courses c where c.id = p_course_id
  )
  select jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'course', (
        select jsonb_build_object(
          'id', c.id, 'code', c.code, 'title', c.title, 'description', c.description,
          'color', c.color, 'track', c.track, 'level', c.level, 'archived', c.archived,
          'created_at', c.created_at,
          'attendance_weight', c.attendance_weight,
          'exams_weight', c.exams_weight,
          'assignments_weight', c.assignments_weight
        ) from courses c where c.id = p_course_id
      ),
      'stats', jsonb_build_object(
        'students', (select count(*) from roster),
        'lectures', (select count(*) from lectures where course_id = p_course_id),
        'exams', (select count(*) from exams where course_id = p_course_id),
        'assignments', (select count(*) from assignments where course_id = p_course_id),
        'pending', (
          select count(*) from submissions s join assignments a on a.id = s.assignment_id
          where a.course_id = p_course_id and s.points is null
        ),
        'average', coalesce((select round(avg(final_pct), 2) from graded where final_pct > 0), 0)
      ),
      'students', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', g.id, 'name', g.name, 'platform_id', g.platform_id,
          'university_id', g.university_id, 'email', g.email,
          'status', g.enrollment_status, 'enrolled_at', g.enrolled_at,
          'exam_pct', g.exam_pct, 'assignment_pct', g.assignment_pct,
          'attendance_pct', g.attendance_pct, 'final_pct', g.final_pct,
          'letter', g.letter, 'points', g.points
        ) order by g.name) from graded g
      ), '[]'::jsonb),
      'gradebook', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', g.id, 'name', g.name, 'platform_id', g.platform_id,
          'exam_pct', g.exam_pct, 'attendance_pct', g.attendance_pct,
          'assignment_pct', g.assignment_pct, 'final_pct', g.final_pct,
          'letter', g.letter, 'points', g.points
        ) order by g.final_pct desc, g.name) from graded g
      ), '[]'::jsonb),
      'lectures', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', l.id, 'title', l.title, 'description', l.description,
          'lecture_type', l.lecture_type, 'status', l.status,
          'scheduled_at', l.scheduled_at, 'duration_min', l.duration_min,
          'attendance_open', l.attendance_open,
          'attendance_count', (select count(*) from attendance at where at.lecture_id = l.id),
          'questions_count', (select count(*) from questions q where q.lecture_id = l.id)
        ) order by l.scheduled_at nulls last, l.id)
        from lectures l where l.course_id = p_course_id
      ), '[]'::jsonb),
      'exams', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', x.id, 'title', x.title, 'description', x.description,
          'exam_kind', x.exam_kind, 'is_published', x.is_published,
          'starts_at', x.starts_at, 'ends_at', x.ends_at, 'duration_min', x.duration_min,
          'questions_count', (select count(*) from exam_questions q where q.exam_id = x.id),
          'attempts_count', (select count(*) from exam_attempts at where at.exam_id = x.id and at.submitted_at is not null),
          'avg_score', coalesce((select round(avg(score),2) from exam_attempts at where at.exam_id = x.id and at.submitted_at is not null), 0)
        ) order by x.starts_at nulls last, x.id)
        from exams x where x.course_id = p_course_id
      ), '[]'::jsonb),
      'assignments', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', a.id, 'title', a.title, 'description', a.description,
          'due_at', a.due_at, 'max_points', a.max_points,
          'submissions_count', (select count(*) from submissions s where s.assignment_id = a.id),
          'graded_count', (select count(*) from submissions s where s.assignment_id = a.id and s.points is not null),
          'avg_points', coalesce((select round(avg(points),2) from submissions s where s.assignment_id = a.id and s.points is not null), 0)
        ) order by a.due_at nulls last, a.id)
        from assignments a where a.course_id = p_course_id
      ), '[]'::jsonb),
      'submissions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', s.id, 'points', s.points, 'feedback', s.feedback,
          'submitted_at', s.submitted_at, 'graded_at', s.graded_at,
          'text', s.text, 'assignment_title', a.title, 'max_points', a.max_points,
          'student_id', u.id, 'student_name', u.name, 'student_platform_id', u.platform_id
        ) order by s.submitted_at desc, s.id desc)
        from (
          select s.* from submissions s join assignments a on a.id = s.assignment_id
          where a.course_id = p_course_id order by s.submitted_at desc limit 30
        ) s
        join assignments a on a.id = s.assignment_id
        join users u on u.id = s.student_id
      ), '[]'::jsonb),
      'activity', coalesce((
        select jsonb_agg(jsonb_build_object(
          'kind', k.kind, 'title', k.title, 'detail', k.detail, 'at', k.at
        ) order by k.at desc)
        from (
          select 'submission'::text as kind, a.title as title,
                 u.name || ' — تسليم جديد' as detail, s.submitted_at as at
          from submissions s join assignments a on a.id = s.assignment_id
          join users u on u.id = s.student_id
          where a.course_id = p_course_id
          union all
          select 'enrollment', c.title, u.name || ' — طالب جديد', e.created_at
          from enrollments e join users u on u.id = e.student_id
          join courses c on c.id = e.course_id
          where e.course_id = p_course_id
          union all
          select 'lecture', l.title, 'محاضرة جديدة', l.created_at
          from lectures l where l.course_id = p_course_id
          union all
          select 'exam', x.title, 'اختبار جديد', x.created_at
          from exams x where x.course_id = p_course_id
        ) k
      ), '[]'::jsonb)
    )
  )
  into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) الكتابة — كلها تتحقق من ملكية الأستاذ للمقرر
-- ---------------------------------------------------------------------------
create or replace function public.teacher_create_course(
  p_title text, p_code text, p_description text default null,
  p_track text default 'bachelor_m', p_level smallint default null,
  p_color text default '#123A63',
  p_attendance_weight numeric default 10, p_exams_weight numeric default 60,
  p_assignments_weight numeric default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid bigint := public.current_user_id();
  v_id bigint;
  v_code text := btrim(coalesce(p_code, ''));
begin
  if v_uid is null or public.current_user_role() <> 'teacher' then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  if nullif(btrim(coalesce(p_title, '')), '') is null or v_code = '' then
    return jsonb_build_object('ok', false, 'error', 'العنوان والرمز مطلوبان');
  end if;
  if exists (select 1 from courses where lower(code) = lower(v_code)) then
    return jsonb_build_object('ok', false, 'error', 'رمز المقرر مستخدم بالفعل');
  end if;
  if p_track not in ('bachelor','bachelor_m','bachelor_f','equiv','external','grad') then
    return jsonb_build_object('ok', false, 'error', 'المسار غير صالح');
  end if;
  if p_level is not null and p_level not between 1 and 4 then
    return jsonb_build_object('ok', false, 'error', 'المستوى غير صالح');
  end if;
  if coalesce(p_attendance_weight,0) + coalesce(p_exams_weight,0) + coalesce(p_assignments_weight,0) <> 100 then
    return jsonb_build_object('ok', false, 'error', 'مجموع الأوزان يجب أن يساوي 100');
  end if;

  insert into courses (teacher_id, title, code, description, color, track, level,
                       attendance_weight, exams_weight, assignments_weight)
  values (v_uid, btrim(p_title), v_code, nullif(btrim(coalesce(p_description,'')), ''),
          coalesce(nullif(btrim(coalesce(p_color,'')), ''), '#123A63'), p_track, p_level,
          p_attendance_weight, p_exams_weight, p_assignments_weight)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', v_id, 'code', v_code));
end;
$$;

-- استبدال التوقيع القديم (بدون المسار والمستوى) لتفادي تراكم الدوال المحمّلة.
drop function if exists public.teacher_update_course(bigint, text, text, text, boolean, numeric, numeric, numeric);

create or replace function public.teacher_update_course(
  p_course_id bigint, p_title text, p_description text default null,
  p_color text default null, p_archived boolean default null,
  p_track text default null, p_level smallint default null,
  p_attendance_weight numeric default null, p_exams_weight numeric default null,
  p_assignments_weight numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_id() is null or public.current_user_role() <> 'teacher'
     or not exists (select 1 from courses where id = p_course_id and teacher_id = public.current_user_id()) then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  if nullif(btrim(coalesce(p_title, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'العنوان مطلوب');
  end if;
  if p_track is not null and p_track not in ('bachelor','bachelor_m','bachelor_f','equiv','external','grad') then
    return jsonb_build_object('ok', false, 'error', 'المسار غير صالح');
  end if;
  if p_level is not null and p_level not between 1 and 4 then
    return jsonb_build_object('ok', false, 'error', 'المستوى غير صالح');
  end if;
  if p_attendance_weight is not null or p_exams_weight is not null or p_assignments_weight is not null then
    if coalesce(p_attendance_weight,0) + coalesce(p_exams_weight,0) + coalesce(p_assignments_weight,0) <> 100 then
      return jsonb_build_object('ok', false, 'error', 'مجموع الأوزان يجب أن يساوي 100');
    end if;
  end if;

  update courses set
    title = btrim(p_title),
    description = nullif(btrim(coalesce(p_description,'')), ''),
    color = coalesce(nullif(btrim(coalesce(p_color,'')), ''), color),
    archived = coalesce(p_archived, archived),
    track = coalesce(p_track, track),
    level = coalesce(p_level, level),
    attendance_weight = coalesce(p_attendance_weight, attendance_weight),
    exams_weight = coalesce(p_exams_weight, exams_weight),
    assignments_weight = coalesce(p_assignments_weight, assignments_weight)
  where id = p_course_id;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', p_course_id));
end;
$$;

create or replace function public.teacher_add_lecture(
  p_course_id bigint, p_title text, p_description text default null,
  p_lecture_type text default 'direct', p_scheduled_at timestamptz default null,
  p_duration_min integer default 120, p_youtube_url text default null,
  p_live_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  if public.current_user_id() is null or public.current_user_role() <> 'teacher'
     or not exists (select 1 from courses where id = p_course_id and teacher_id = public.current_user_id()) then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  if nullif(btrim(coalesce(p_title, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'عنوان المحاضرة مطلوب');
  end if;
  if p_lecture_type not in ('direct','online','recorded') then
    return jsonb_build_object('ok', false, 'error', 'نوع المحاضرة غير صالح');
  end if;

  insert into lectures (course_id, title, description, lecture_type, scheduled_at,
                        duration_min, youtube_url, live_url, status)
  values (p_course_id, btrim(p_title), nullif(btrim(coalesce(p_description,'')), ''),
          p_lecture_type, p_scheduled_at, coalesce(p_duration_min,120),
          nullif(btrim(coalesce(p_youtube_url,'')), ''),
          nullif(btrim(coalesce(p_live_url,'')), ''), 'scheduled')
  returning id into v_id;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', v_id));
end;
$$;

create or replace function public.teacher_create_exam(
  p_course_id bigint, p_title text, p_description text default null,
  p_exam_kind text default 'exam', p_starts_at timestamptz default null,
  p_ends_at timestamptz default null, p_duration_min integer default null,
  p_is_published boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  if public.current_user_id() is null or public.current_user_role() <> 'teacher'
     or not exists (select 1 from courses where id = p_course_id and teacher_id = public.current_user_id()) then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  if nullif(btrim(coalesce(p_title, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'عنوان الاختبار مطلوب');
  end if;
  if p_exam_kind not in ('exam','assignment') then
    return jsonb_build_object('ok', false, 'error', 'نوع الاختبار غير صالح');
  end if;

  insert into exams (course_id, title, description, exam_kind, starts_at, ends_at,
                     duration_min, is_published)
  values (p_course_id, btrim(p_title), nullif(btrim(coalesce(p_description,'')), ''),
          p_exam_kind, p_starts_at, p_ends_at, p_duration_min, coalesce(p_is_published,false))
  returning id into v_id;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', v_id));
end;
$$;

create or replace function public.teacher_create_assignment(
  p_course_id bigint, p_title text, p_description text default null,
  p_due_at timestamptz default null, p_max_points numeric default 10
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  if public.current_user_id() is null or public.current_user_role() <> 'teacher'
     or not exists (select 1 from courses where id = p_course_id and teacher_id = public.current_user_id()) then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  if nullif(btrim(coalesce(p_title, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'عنوان الواجب مطلوب');
  end if;
  if coalesce(p_max_points, 0) <= 0 then
    return jsonb_build_object('ok', false, 'error', 'الدرجة القصوى يجب أن تكون أكبر من صفر');
  end if;

  insert into assignments (course_id, title, description, due_at, max_points)
  values (p_course_id, btrim(p_title), nullif(btrim(coalesce(p_description,'')), ''),
          p_due_at, p_max_points)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', v_id));
end;
$$;

create or replace function public.teacher_grade_submission(
  p_submission_id bigint, p_points numeric, p_feedback text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid bigint := public.current_user_id();
  v_student bigint;
  v_course bigint;
  v_title text;
  v_max numeric(6,2);
begin
  if v_uid is null or public.current_user_role() <> 'teacher' then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;

  select s.student_id, c.id, a.title, a.max_points
    into v_student, v_course, v_title, v_max
  from submissions s
  join assignments a on a.id = s.assignment_id
  join courses c on c.id = a.course_id
  where s.id = p_submission_id and c.teacher_id = v_uid;

  if v_student is null then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  if p_points is null or p_points < 0 or p_points > v_max then
    return jsonb_build_object('ok', false, 'error', 'الدرجة خارج النطاق المسموح');
  end if;

  update submissions
  set points = p_points,
      feedback = nullif(btrim(coalesce(p_feedback,'')), ''),
      graded_at = now()
  where id = p_submission_id;

  insert into points_ledger (user_id, course_id, source_type, source_id, source_detail, points)
  values (v_student, v_course, 'assignment', p_submission_id, v_title, round(p_points)::integer)
  on conflict (user_id, course_id, source_type, source_id)
  do update set points = excluded.points, source_detail = excluded.source_detail;

  insert into notifications (audience, course_id, user_id, title, body, link, created_by, type)
  values ('user', v_course, v_student, 'تم تصحيح تسليمك',
          coalesce(v_title, 'واجب') || ' — الدرجة: ' || p_points::text, null, v_uid, 'grade');

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', p_submission_id, 'points', p_points));
end;
$$;

create or replace function public.teacher_enroll_student(
  p_course_id bigint, p_identifier text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid bigint := public.current_user_id();
  v_student bigint;
  v_name text;
begin
  if v_uid is null or public.current_user_role() <> 'teacher'
     or not exists (select 1 from courses where id = p_course_id and teacher_id = v_uid) then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;

  select id, name into v_student, v_name
  from users
  where role = 'student' and is_active = true
    and (lower(coalesce(email,'')) = lower(btrim(coalesce(p_identifier,'')))
      or lower(coalesce(university_id,'')) = lower(btrim(coalesce(p_identifier,'')))
      or lower(coalesce(platform_id,'')) = lower(btrim(coalesce(p_identifier,''))))
  limit 1;

  if v_student is null then
    return jsonb_build_object('ok', false, 'error', 'لم يُعثر على طالب بهذا المعرّف');
  end if;

  insert into enrollments (course_id, student_id, status)
  values (p_course_id, v_student, 'active')
  on conflict (course_id, student_id) do update set status = 'active';

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', v_student, 'name', v_name));
end;
$$;

create or replace function public.teacher_set_attendance(
  p_lecture_id bigint, p_open boolean, p_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_id() is null or public.current_user_role() <> 'teacher'
     or not exists (
       select 1 from lectures l join courses c on c.id = l.course_id
       where l.id = p_lecture_id and c.teacher_id = public.current_user_id()
     ) then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;

  update lectures
  set attendance_open = coalesce(p_open, false),
      attendance_code = case when p_open then nullif(btrim(coalesce(p_code,'')), '') else attendance_code end
  where id = p_lecture_id;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', p_lecture_id));
end;
$$;

create or replace function public.teacher_post_announcement(
  p_course_id bigint, p_title text, p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  if public.current_user_id() is null or public.current_user_role() <> 'teacher'
     or not exists (select 1 from courses where id = p_course_id and teacher_id = public.current_user_id()) then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  if nullif(btrim(coalesce(p_title,'')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'عنوان الإعلان مطلوب');
  end if;

  insert into notifications (audience, course_id, title, body, link, created_by, type)
  values ('course', p_course_id, btrim(p_title),
          nullif(btrim(coalesce(p_body,'')), ''), null, public.current_user_id(), 'announcement')
  returning id into v_id;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', v_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- الصلاحيات
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'teacher_dashboard()',
    'teacher_courses()',
    'teacher_course_detail(bigint)',
    'teacher_create_course(text,text,text,text,smallint,text,numeric,numeric,numeric)',
    'teacher_update_course(bigint,text,text,text,boolean,text,smallint,numeric,numeric,numeric)',
    'teacher_add_lecture(bigint,text,text,text,timestamptz,integer,text,text)',
    'teacher_create_exam(bigint,text,text,text,timestamptz,timestamptz,integer,boolean)',
    'teacher_create_assignment(bigint,text,text,timestamptz,numeric)',
    'teacher_grade_submission(bigint,numeric,text)',
    'teacher_enroll_student(bigint,text)',
    'teacher_set_attendance(bigint,boolean,text)',
    'teacher_post_announcement(bigint,text,text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ============================================================================
-- 0108_student_pages.sql
-- طبقة قراءة/كتابة مضبوطة لصفحات الطالب الثمانية:
-- المحاضرات، تفاصيل المحاضرة، الاختبارات، أداء الاختبار، النتيجة،
-- الواجبات، الدرجات، النقاط.
-- كل الدوال SECURITY DEFINER لتفادي recursion في سياسات enrollments،
-- ولا تُعيد أي حقل حساس ( attendance_code / الإجابة الصحيحة قبل التسليم ).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) المحاضرات
-- ---------------------------------------------------------------------------
create or replace function public.student_lectures()
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

  with mine as (
    select l.id, l.course_id, l.title, l.description, l.scheduled_at,
           l.duration_min, l.lecture_type, l.attendance_open, l.status,
           c.title as course_title, c.code as course_code, c.color as course_color,
           u.name as teacher
    from lectures l
    join courses c on c.id = l.course_id
    join enrollments e on e.course_id = c.id and e.student_id = v_uid and e.status = 'active'
    left join users u on u.id = c.teacher_id
    where coalesce(l.status, '') <> 'cancelled'
  ),
  rows as (
    select m.*,
      exists(select 1 from attendance a where a.lecture_id = m.id and a.student_id = v_uid) as attended,
      case
        when m.attendance_open
             and now() between m.scheduled_at
                           and m.scheduled_at + (m.duration_min || ' minutes')::interval then 'live'
        when exists(select 1 from attendance a where a.lecture_id = m.id and a.student_id = v_uid) then 'attended'
        when m.scheduled_at > now() then 'upcoming'
        else 'missed'
      end as computed_status
    from mine m
  )
  select jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'stats', jsonb_build_object(
        'total',     (select count(*) from rows),
        'attended',  (select count(*) from rows where attended),
        'upcoming',  (select count(*) from rows where computed_status = 'upcoming' or computed_status = 'live'),
        'missed',    (select count(*) from rows where computed_status = 'missed')
      ),
      'courses', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', c.id, 'title', c.title, 'code', c.code, 'color', c.color
        ) order by c.code)
        from courses c
        join enrollments e on e.course_id = c.id and e.student_id = v_uid and e.status = 'active'
      ), '[]'::jsonb),
      'lectures', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', r.id,
          'course_id', r.course_id,
          'course_title', r.course_title,
          'course_code', r.course_code,
          'course_color', r.course_color,
          'teacher', r.teacher,
          'title', r.title,
          'description', r.description,
          'scheduled_at', r.scheduled_at,
          'duration_min', r.duration_min,
          'lecture_type', r.lecture_type,
          'attendance_open', r.attendance_open,
          'attended', r.attended,
          'status', r.computed_status
        ) order by r.scheduled_at desc nulls last, r.id desc)
        from rows r
      ), '[]'::jsonb)
    )
  )
  into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) تفاصيل المحاضرة (بدون رمز الحضور)
-- ---------------------------------------------------------------------------
create or replace function public.student_lecture_detail(p_lecture_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid bigint := public.current_user_id();
  v_result jsonb;
  v_lecture_id bigint;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not authenticated');
  end if;

  select l.id into v_lecture_id
  from lectures l
  join enrollments e on e.course_id = l.course_id and e.student_id = v_uid and e.status = 'active'
  where l.id = p_lecture_id
  limit 1;

  if v_lecture_id is null then
    return jsonb_build_object('ok', false, 'error', 'lecture_not_found');
  end if;

  select jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'lecture', (
        select jsonb_build_object(
          'id', l.id,
          'title', l.title,
          'description', l.description,
          'course_id', l.course_id,
          'course_title', c.title,
          'course_code', c.code,
          'course_color', c.color,
          'teacher', u.name,
          'scheduled_at', l.scheduled_at,
          'duration_min', l.duration_min,
          'lecture_type', l.lecture_type,
          'broadcast_mode', l.broadcast_mode,
          'broadcast_media', l.broadcast_media,
          'live_url', case when l.attendance_open then l.live_url else null end,
          'youtube_url', l.youtube_url,
          'recording_note', l.recording_note,
          'attendance_open', l.attendance_open,
          'attended', exists(select 1 from attendance a where a.lecture_id = l.id and a.student_id = v_uid),
          'presence_seconds', coalesce((
            select lp.total_seconds from lecture_presence lp
            where lp.lecture_id = l.id and lp.student_id = v_uid
          ), 0)
        )
        from lectures l
        join courses c on c.id = l.course_id
        left join users u on u.id = c.teacher_id
        where l.id = v_lecture_id
      ),
      'files', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', f.id, 'name', f.original_name, 'filename', f.filename,
          'mime', f.mime, 'size', f.size, 'kind', f.kind, 'created_at', f.created_at
        ) order by f.created_at)
        from files f where f.lecture_id = v_lecture_id
      ), '[]'::jsonb),
      'questions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', q.id,
          'type', q.type,
          'text', q.text,
          'options', q.options,
          'is_open', q.is_open,
          'my_answer', (
            select jsonb_build_object(
              'choice_index', qa.choice_index,
              'choice_indices', qa.choice_indices,
              'text', qa.text
            )
            from question_answers qa
            where qa.question_id = q.id and qa.student_id = v_uid
            limit 1
          )
        ) order by q.created_at, q.id)
        from questions q where q.lecture_id = v_lecture_id and q.is_open = true
      ), '[]'::jsonb),
      'related', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', l2.id, 'title', l2.title, 'scheduled_at', l2.scheduled_at,
          'lecture_type', l2.lecture_type, 'course_title', c2.title
        ) order by l2.scheduled_at desc nulls last)
        from lectures l2
        join courses c2 on c2.id = l2.course_id
        join enrollments e2 on e2.course_id = c2.id and e2.student_id = v_uid and e2.status = 'active'
        where l2.course_id = (select course_id from lectures where id = v_lecture_id)
          and l2.id <> v_lecture_id
          and coalesce(l2.status, '') <> 'cancelled'
        limit 5
      ), '[]'::jsonb)
    )
  )
  into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) تسجيل الحضور برمز المحاضرة
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
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not authenticated');
  end if;

  select l.* into v_row
  from lectures l
  join enrollments e on e.course_id = l.course_id and e.student_id = v_uid and e.status = 'active'
  where l.id = p_lecture_id
  limit 1;

  if v_row.id is null then
    return jsonb_build_object('ok', false, 'error', 'lecture_not_found');
  end if;
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
  select v_uid, v_row.course_id, 'attendance', p_lecture_id, 'حضور محاضرة', 10, now()
  where not exists (
    select 1 from points_ledger pl
    where pl.user_id = v_uid and pl.course_id = v_row.course_id
      and pl.source_type = 'attendance' and pl.source_id = p_lecture_id
  );

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('attended', true));
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) الاختبارات
-- ---------------------------------------------------------------------------
create or replace function public.student_exams()
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

  with rows as (
    select e.id, e.course_id, e.title, e.description, e.starts_at, e.ends_at,
           e.duration_min, e.exam_kind,
           c.title as course_title, c.code as course_code, c.color as course_color,
           a.id as attempt_id, a.status as attempt_status, a.score as attempt_score,
           a.submitted_at,
           (select count(*) from exam_questions q where q.exam_id = e.id) as questions_count,
           (select coalesce(sum(q.points), 0) from exam_questions q where q.exam_id = e.id) as total_points,
           case
             when a.id is not null and a.submitted_at is not null then 'completed'
             when a.id is not null and a.status = 'in_progress'
                  and now() between coalesce(e.starts_at, now() - interval '1 year')
                                and coalesce(e.ends_at + (e.duration_min || ' minutes')::interval, now() + interval '1 year') then 'open'
             when now() < coalesce(e.starts_at, now() + interval '1 year') then 'upcoming'
             else 'missed'
           end as computed_status
    from exams e
    join courses c on c.id = e.course_id
    join enrollments en on en.course_id = c.id and en.student_id = v_uid and en.status = 'active'
    left join exam_attempts a on a.exam_id = e.id and a.student_id = v_uid
    where e.is_published = true
  )
  select jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'stats', jsonb_build_object(
        'total', (select count(*) from rows),
        'completed', (select count(*) from rows where computed_status = 'completed'),
        'upcoming', (select count(*) from rows where computed_status = 'upcoming'),
        'open', (select count(*) from rows where computed_status = 'open'),
        'average', coalesce((
          select round(avg(case when total_points > 0 then (attempt_score * 100 / total_points) end))
          from rows where attempt_score is not null and total_points > 0
        ), 0)
      ),
      'courses', coalesce((
        select jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'code', c.code, 'color', c.color) order by c.code)
        from courses c
        join enrollments en on en.course_id = c.id and en.student_id = v_uid and en.status = 'active'
      ), '[]'::jsonb),
      'exams', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', r.id, 'course_id', r.course_id,
          'course_title', r.course_title, 'course_code', r.course_code, 'course_color', r.course_color,
          'title', r.title, 'description', r.description,
          'starts_at', r.starts_at, 'ends_at', r.ends_at, 'duration_min', r.duration_min,
          'exam_kind', r.exam_kind, 'questions_count', r.questions_count,
          'total_points', r.total_points, 'status', r.computed_status,
          'attempt_id', r.attempt_id, 'attempt_status', r.attempt_status,
          'score', r.attempt_score, 'submitted_at', r.submitted_at
        ) order by r.starts_at desc nulls last, r.id desc)
        from rows r
      ), '[]'::jsonb)
    )
  )
  into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) بدء/استئناف الاختبار — يُخفي الإجابات الصحيحة
-- ---------------------------------------------------------------------------
create or replace function public.student_exam_take(p_exam_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid bigint := public.current_user_id();
  v_exam record;
  v_attempt_id bigint;
  v_started_at timestamptz;
  v_result jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not authenticated');
  end if;

  select e.*, c.title as course_title, c.code as course_code,
         (select count(*) from exam_questions q where q.exam_id = e.id) as questions_count,
         (select coalesce(sum(q.points), 0) from exam_questions q where q.exam_id = e.id) as total_points
  into v_exam
  from exams e
  join courses c on c.id = e.course_id
  join enrollments en on en.course_id = c.id and en.student_id = v_uid and en.status = 'active'
  where e.id = p_exam_id and e.is_published = true
  limit 1;

  if v_exam.id is null then
    return jsonb_build_object('ok', false, 'error', 'exam_not_found');
  end if;

  select id into v_attempt_id from exam_attempts
  where exam_id = p_exam_id and student_id = v_uid limit 1;

  if v_attempt_id is null then
    if v_exam.starts_at is not null and now() < v_exam.starts_at then
      return jsonb_build_object('ok', false, 'error', 'exam_not_started');
    end if;
    if v_exam.ends_at is not null and now() > v_exam.ends_at + (v_exam.duration_min || ' minutes')::interval then
      return jsonb_build_object('ok', false, 'error', 'exam_closed');
    end if;
    insert into exam_attempts (exam_id, student_id, started_at, status)
    values (p_exam_id, v_uid, now(), 'in_progress')
    returning id into v_attempt_id;
  end if;

  select started_at into v_started_at from exam_attempts where id = v_attempt_id;

  select jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'attempt_id', v_attempt_id,
      'attempt_started_at', v_started_at,
      'exam', jsonb_build_object(
        'id', v_exam.id,
        'title', v_exam.title,
        'description', v_exam.description,
        'course_title', v_exam.course_title,
        'course_code', v_exam.course_code,
        'duration_min', v_exam.duration_min,
        'questions_count', v_exam.questions_count,
        'total_points', v_exam.total_points,
        'starts_at', v_exam.starts_at,
        'ends_at', v_exam.ends_at
      ),
      'questions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', q.id,
          'type', q.type,
          'text', q.text,
          'options', q.options,
          'points', q.points,
          'position', q.position,
          'my_answer', (
            select jsonb_build_object(
              'choice_index', aa.choice_index,
              'choice_indices', aa.choice_indices,
              'text', aa.text
            )
            from exam_answers aa
            where aa.attempt_id = v_attempt_id and aa.question_id = q.id
            limit 1
          )
        ) order by q.position, q.id)
        from exam_questions q where q.exam_id = p_exam_id
      ), '[]'::jsonb)
    )
  )
  into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6) حفظ إجابة
-- ---------------------------------------------------------------------------
create or replace function public.student_exam_save_answer(
  p_attempt_id bigint,
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
  v_uid bigint := public.current_user_id();
  v_ok boolean;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not authenticated');
  end if;

  select true into v_ok
  from exam_attempts a
  join exam_questions q on q.exam_id = a.exam_id
  where a.id = p_attempt_id and a.student_id = v_uid
    and a.submitted_at is null and q.id = p_question_id
  limit 1;

  if v_ok is not true then
    return jsonb_build_object('ok', false, 'error', 'attempt_closed');
  end if;

  insert into exam_answers (attempt_id, question_id, choice_index, choice_indices, text, created_at)
  values (p_attempt_id, p_question_id, p_choice_index, p_choice_indices, p_text, now())
  on conflict (attempt_id, question_id) do update
    set choice_index = excluded.choice_index,
        choice_indices = excluded.choice_indices,
        text = excluded.text;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('saved', true));
end;
$$;

-- ---------------------------------------------------------------------------
-- 7) التسليم والتصحيح الآلي
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
  insert into exam_answers (attempt_id, question_id, points, created_at)
  select p_attempt_id, q.id, 0, now()
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
-- 8) نتيجة الاختبار مع المراجعة
-- ---------------------------------------------------------------------------
create or replace function public.student_exam_result(p_attempt_id bigint)
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
      'attempt', jsonb_build_object(
        'id', a.id,
        'started_at', a.started_at,
        'submitted_at', a.submitted_at,
        'score', a.score,
        'status', a.status,
        'duration_used_min', extract(epoch from (a.submitted_at - a.started_at)) / 60
      ),
      'exam', jsonb_build_object(
        'id', e.id, 'title', e.title, 'course_title', c.title,
        'course_code', c.code, 'teacher', u.name,
        'duration_min', e.duration_min,
        'total_points', (select coalesce(sum(q.points), 0) from exam_questions q where q.exam_id = e.id)
      ),
      'stats', jsonb_build_object(
        'correct', (select count(*) from exam_answers aa join exam_questions q on q.id = aa.question_id
                    where aa.attempt_id = a.id and coalesce(aa.points, 0) > 0),
        'wrong', (select count(*) from exam_answers aa join exam_questions q on q.id = aa.question_id
                  where aa.attempt_id = a.id and coalesce(aa.points, 0) = 0 and q.type <> 'essay'),
        'unanswered', (select count(*) from exam_questions q
                       where q.exam_id = e.id
                         and not exists (select 1 from exam_answers aa where aa.attempt_id = a.id and aa.question_id = q.id)),
        'essay_pending', (select count(*) from exam_answers aa join exam_questions q on q.id = aa.question_id
                          where aa.attempt_id = a.id and q.type = 'essay' and aa.points is null)
      ),
      'review', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', q.id,
          'type', q.type,
          'text', q.text,
          'options', q.options,
          'points', q.points,
          'correct_index', q.correct_index,
          'correct_indices', q.correct_indices,
          'my_choice_index', aa.choice_index,
          'my_choice_indices', aa.choice_indices,
          'my_text', aa.text,
          'earned', aa.points,
          'feedback', aa.feedback
        ) order by q.position, q.id)
        from exam_questions q
        left join exam_answers aa on aa.question_id = q.id and aa.attempt_id = a.id
        where q.exam_id = e.id
      ), '[]'::jsonb)
    )
  )
  into v_result
  from exam_attempts a
  join exams e on e.id = a.exam_id
  join courses c on c.id = e.course_id
  left join users u on u.id = c.teacher_id
  where a.id = p_attempt_id and a.student_id = v_uid and a.submitted_at is not null;

  if v_result is null then
    return jsonb_build_object('ok', false, 'error', 'result_not_found');
  end if;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9) الواجبات
-- ---------------------------------------------------------------------------
create or replace function public.student_assignments()
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

  with rows as (
    select asg.id, asg.course_id, asg.title, asg.description, asg.due_at, asg.max_points,
           c.title as course_title, c.code as course_code, c.color as course_color,
           s.id as submission_id, s.submitted_at, s.points, s.feedback, s.graded_at, s.text as submission_text,
           case
             when s.points is not null then 'graded'
             when s.id is not null and asg.due_at is not null and s.submitted_at > asg.due_at then 'late'
             when s.id is not null then 'submitted'
             when asg.due_at is not null and now() > asg.due_at then 'overdue'
             else 'pending'
           end as computed_status
    from assignments asg
    join courses c on c.id = asg.course_id
    join enrollments e on e.course_id = c.id and e.student_id = v_uid and e.status = 'active'
    left join submissions s on s.assignment_id = asg.id and s.student_id = v_uid
  )
  select jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'stats', jsonb_build_object(
        'total', (select count(*) from rows),
        'pending', (select count(*) from rows where computed_status in ('pending','overdue')),
        'submitted', (select count(*) from rows where computed_status in ('submitted','late')),
        'graded', (select count(*) from rows where computed_status = 'graded')
      ),
      'courses', coalesce((
        select jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'code', c.code, 'color', c.color) order by c.code)
        from courses c
        join enrollments e on e.course_id = c.id and e.student_id = v_uid and e.status = 'active'
      ), '[]'::jsonb),
      'assignments', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', r.id, 'course_id', r.course_id,
          'course_title', r.course_title, 'course_code', r.course_code, 'course_color', r.course_color,
          'title', r.title, 'description', r.description, 'due_at', r.due_at,
          'max_points', r.max_points, 'status', r.computed_status,
          'submission_id', r.submission_id, 'submitted_at', r.submitted_at,
          'points', r.points, 'feedback', r.feedback, 'submission_text', r.submission_text
        ) order by r.due_at desc nulls last, r.id desc)
        from rows r
      ), '[]'::jsonb)
    )
  )
  into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10) تسليم الواجب (نصي — رفع الملفات سيُضاف مع سياسات Storage)
-- ---------------------------------------------------------------------------
create or replace function public.student_assignment_submit(
  p_assignment_id bigint,
  p_text text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid bigint := public.current_user_id();
  v_course_id bigint;
  v_due timestamptz;
  v_body text := btrim(coalesce(p_text, ''));
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not authenticated');
  end if;
  if length(v_body) < 3 then
    return jsonb_build_object('ok', false, 'error', 'empty_submission');
  end if;

  select asg.course_id, asg.due_at into v_course_id, v_due
  from assignments asg
  join enrollments e on e.course_id = asg.course_id and e.student_id = v_uid and e.status = 'active'
  where asg.id = p_assignment_id
  limit 1;

  if v_course_id is null then
    return jsonb_build_object('ok', false, 'error', 'assignment_not_found');
  end if;

  insert into submissions (assignment_id, student_id, text, submitted_at)
  values (p_assignment_id, v_uid, v_body, now())
  on conflict (assignment_id, student_id) do update
    set text = excluded.text, submitted_at = now(), graded_at = null, points = null, feedback = null;

  insert into points_ledger (user_id, course_id, source_type, source_id, source_detail, points, created_at)
  select v_uid, v_course_id, 'assignment', p_assignment_id, 'تسليم واجب', 5, now()
  where not exists (
    select 1 from points_ledger pl
    where pl.user_id = v_uid and pl.course_id = v_course_id
      and pl.source_type = 'assignment' and pl.source_id = p_assignment_id
  );

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('submitted', true));
end;
$$;

-- ---------------------------------------------------------------------------
-- 11) الدرجات (محسوبة من الاختبارات والواجبات والحضور)
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

-- ---------------------------------------------------------------------------
-- 12) النقاط (ملخص + سجل + لوحة صدارة)
-- ---------------------------------------------------------------------------
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
-- الصلاحيات
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'student_lectures()', 'student_lecture_detail(bigint)', 'student_lecture_attendance(bigint,text)',
    'student_exams()', 'student_exam_take(bigint)', 'student_exam_save_answer(bigint,bigint,integer,jsonb,text)',
    'student_exam_submit(bigint)', 'student_exam_result(bigint)',
    'student_assignments()', 'student_assignment_submit(bigint,text)',
    'student_grades()', 'student_points()'
  ]
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

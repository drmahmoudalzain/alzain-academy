-- ============================================================
-- 0121_course_codes_and_shared_lectures_rollback.sql
-- التراجع عن ترحيل 0121: إسقاط الدوال الجديدة، وإعادة توقيع وجسم
-- management_create_course إلى نسخة 0114، ودوال المحاضرات الثلاث
-- وسياسات القراءة إلى نسخها قبل 0121. لا حذف لأي صف أو نقطة.
-- ============================================================

begin;

-- تُستعاد السياسات أولاً: تعتمد على course_for_student_lecture،
-- لذا يجب ألا تُسقَط الدالة قبل إزالة مراجعها من السياسات.
drop policy if exists lectures_select on public.lectures;
create policy lectures_select on public.lectures
  for select to authenticated
  using (
    public.is_owner() or public.is_assistant()
    or exists (
        select 1 from public.courses c
        where c.id = lectures.course_id
          and c.teacher_id = public.current_user_id()
    )
    or exists (
        select 1 from public.enrollments e
        where e.course_id = lectures.course_id
          and e.student_id = public.current_user_id()
          and e.status = 'active'
    )
  );

drop policy if exists files_select on public.files;
create policy files_select on public.files
  for select to authenticated
  using (
    public.is_owner() or public.is_assistant()
    or uploader_id = public.current_user_id()
    or exists (
        select 1 from public.courses c
        where c.id = files.course_id
          and (c.teacher_id = public.current_user_id()
               or exists (select 1 from public.enrollments e
                          where e.course_id = c.id
                            and e.student_id = public.current_user_id()
                            and e.status = 'active'))
    )
    or exists (
        select 1 from public.lectures l
        join public.courses c on c.id = l.course_id
        where l.id = files.lecture_id
          and (c.teacher_id = public.current_user_id()
               or exists (select 1 from public.enrollments e
                          where e.course_id = c.id
                            and e.student_id = public.current_user_id()
                            and e.status = 'active'))
    )
  );

drop policy if exists questions_select on public.questions;
create policy questions_select on public.questions
  for select to authenticated
  using (
    public.is_owner() or public.is_assistant()
    or exists (
        select 1 from public.lectures l
        join public.courses c on c.id = l.course_id
        where l.id = questions.lecture_id
          and c.teacher_id = public.current_user_id()
    )
    or exists (
        select 1 from public.lectures l
        join public.enrollments e on e.course_id = l.course_id
        where l.id = questions.lecture_id
          and e.student_id = public.current_user_id()
          and e.status = 'active'
    )
  );

drop policy if exists lecture_presence_select on public.lecture_presence;
create policy lecture_presence_select on public.lecture_presence
  for select to authenticated
  using (
    student_id = public.current_user_id()
    or public.is_owner() or public.is_assistant()
    or exists (
        select 1 from public.lectures l
        join public.courses c on c.id = l.course_id
        where l.id = lecture_presence.lecture_id
          and c.teacher_id = public.current_user_id()
    )
  );

-- الدوال الجديدة
drop function if exists public.management_generate_course_code(smallint, bigint, text);
drop function if exists public.management_create_course(text, text, text, text, smallint, text, numeric, numeric, numeric, bigint, bigint, text);
drop function if exists public.management_create_course_family(text, smallint, text, text, numeric, numeric, numeric, bigint);
drop function if exists public.course_for_student_lecture(bigint, bigint);

-- إعادة التوقيع والجسم المعتمدين في 0114
create or replace function public.management_create_course(
  p_title text, p_code text, p_description text default null,
  p_track text default 'bachelor_m', p_level smallint default null,
  p_color text default '#123A63',
  p_attendance_weight numeric default 10, p_exams_weight numeric default 60,
  p_assignments_weight numeric default 30,
  p_teacher_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    bigint := public.current_user_id();
  v_id     bigint;
  v_code   text := btrim(coalesce(p_code, ''));
  v_teacher bigint;
begin
  if v_uid is null or not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  if nullif(btrim(coalesce(p_title, '')), '') is null or v_code = '' then
    return jsonb_build_object('ok', false, 'error', 'العنوان والرمز مطلوبان');
  end if;
  if exists (select 1 from public.courses where lower(code) = lower(v_code)) then
    return jsonb_build_object('ok', false, 'error', 'رمز المقرر مستخدم بالفعل');
  end if;
  if p_track not in ('bachelor', 'bachelor_m', 'bachelor_f', 'equiv', 'external', 'grad') then
    return jsonb_build_object('ok', false, 'error', 'المسار غير صالح');
  end if;
  if p_level is not null and p_level not between 1 and 4 then
    return jsonb_build_object('ok', false, 'error', 'المستوى غير صالح');
  end if;
  if coalesce(p_attendance_weight, 0) + coalesce(p_exams_weight, 0)
     + coalesce(p_assignments_weight, 0) <> 100 then
    return jsonb_build_object('ok', false, 'error', 'مجموع الأوزان يجب أن يساوي 100');
  end if;

  v_teacher := coalesce(p_teacher_id, v_uid);
  if not exists (
    select 1 from public.users u
    where u.id = v_teacher and u.role = 'teacher' and u.is_active = true
  ) then
    return jsonb_build_object('ok', false, 'error', 'الأستاذ المسؤول غير صالح');
  end if;

  insert into public.courses (teacher_id, title, code, description, color, track, level,
                              attendance_weight, exams_weight, assignments_weight)
  values (v_teacher, btrim(p_title), v_code,
          nullif(btrim(coalesce(p_description, '')), ''),
          coalesce(nullif(btrim(coalesce(p_color, '')), ''), '#123A63'), p_track, p_level,
          p_attendance_weight, p_exams_weight, p_assignments_weight)
  returning id into v_id;

  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
  values (
    v_uid, 'management_create_course', 'courses', v_id,
    jsonb_build_object('code', v_code, 'teacher_id', v_teacher)
  );

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object('id', v_id, 'code', v_code, 'teacher_id', v_teacher)
  );
end;
$$;

-- إعادة تعريف دوال المحاضرات الثلاث كما في 0108
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

-- صلاحيات التوقيع المعاد
revoke all on function public.management_create_course(text, text, text, text, smallint, text, numeric, numeric, numeric, bigint) from public, anon;
grant execute on function public.management_create_course(text, text, text, text, smallint, text, numeric, numeric, numeric, bigint) to authenticated;

notify pgrst, 'reload schema';

commit;

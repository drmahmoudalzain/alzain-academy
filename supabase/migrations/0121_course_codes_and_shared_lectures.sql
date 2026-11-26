-- ============================================================
-- 0121_course_codes_and_shared_lectures.sql
-- توليد رموز المقررات تلقائياً، وإنشاء أصل البكالوريوس مع فرعيه
-- في عملية واحدة، وإظهار المحاضرة المخزّنة على الأصل لطالب الفرع
-- مرة واحدة دون نسخ المحاضرة ولا مضاعفة سجلات النقاط.
-- لا يُطبَّق هذا الترحيل إلا بعد تأكيد منفصل من المالك.
-- ============================================================

begin;

-- التوقيع القديم (11 معاملاً) يُسقَط حتى لا يبقى تحميل زائف يتجاوز التوليد.
drop function if exists public.management_create_course(text, text, text, text, smallint, text, numeric, numeric, numeric, bigint);
drop function if exists public.management_create_course(text, text, text, text, smallint, text, numeric, numeric, numeric, bigint, bigint, text);

-- ---------------------------------------------------------------------------
-- 1) مولّد الرمز: تسلسل لكل مستوى، واشتقاق -M/-F من رمز الأصل
-- ---------------------------------------------------------------------------
create or replace function public.management_generate_course_code(
  p_level smallint,
  p_parent_course_id bigint default null,
  p_branch_track text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         bigint := public.current_user_id();
  v_code        text;
  v_parent_code text;
  v_parent_level smallint;
  v_track       text := lower(btrim(coalesce(p_branch_track, '')));
  v_seq         integer;
begin
  if v_uid is null or not public.is_owner() then
    raise exception 'not allowed';
  end if;

  -- مفتاح مختلف تماماً عن أقفال 0114 لمنع سباق جلسات المالك المتزامنة.
  perform pg_advisory_xact_lock(72121);

  if p_parent_course_id is null then
    if v_track <> '' then
      raise exception 'مسار الفرع بلا أصل غير صالح';
    end if;
    if p_level is null or p_level not between 1 and 4 then
      raise exception 'المستوى غير صالح';
    end if;

    select coalesce(max(substring(lower(code) from '([0-9]{2})$')::integer), 0) + 1
      into v_seq
    from public.courses
    where lower(code) ~* ('^LAW' || p_level::text || '[0-9]{2}$');

    if v_seq > 99 then
      raise exception 'تسلسل الرموز ممتلئ لهذا المستوى';
    end if;
    return 'LAW' || p_level::text || lpad(v_seq::text, 2, '0');
  end if;

  if v_track not in ('bachelor_m', 'bachelor_f') then
    raise exception 'مسار الفرع غير صالح';
  end if;

  select c.code, c.level into v_parent_code, v_parent_level
  from public.courses c
  where c.id = p_parent_course_id;

  if v_parent_code is null or lower(v_parent_code) !~* '^LAW[1-4][0-9]{2}$' then
    raise exception 'المقرر الأصل غير موجود أو رمزه ليس رمز أصل صالح';
  end if;
  if v_parent_level is null or v_parent_level not between 1 and 4 then
    raise exception 'مستوى المقرر الأصل غير صالح';
  end if;
  if exists (
    select 1 from public.courses
    where parent_course_id = p_parent_course_id
      and lower(btrim(track)) = v_track
  ) then
    raise exception 'يوجد فرع بهذا المسار للمقرر الأصل';
  end if;

  v_code := v_parent_code || case when v_track = 'bachelor_m' then '-M' else '-F' end;
  return v_code;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) إنشاء مقرر مع دعم الفرع وتوليد رمز الأصل عند غيابه
--    نفس صلاحيات وتدقيق 0114، مع معاملين جديدين في النهاية فقط.
-- ---------------------------------------------------------------------------
create or replace function public.management_create_course(
  p_title text, p_code text, p_description text default null,
  p_track text default 'bachelor_m', p_level smallint default null,
  p_color text default '#123A63',
  p_attendance_weight numeric default 10, p_exams_weight numeric default 60,
  p_assignments_weight numeric default 30,
  p_teacher_id bigint default null,
  p_parent_course_id bigint default null,
  p_branch_track text default null
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
  v_track  text := p_track;
  v_level  smallint := p_level;
  v_parent_level smallint;
  v_parent_code text;
begin
  if v_uid is null or not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  if nullif(btrim(coalesce(p_title, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'العنوان والرمز مطلوبان');
  end if;

  if p_parent_course_id is not null then
    if nullif(v_code, '') is not null then
      return jsonb_build_object('ok', false, 'error', 'لا يُمرَّر رمز يدوي عند إنشاء فرع');
    end if;
    select c.code, c.level into v_parent_code, v_parent_level
    from public.courses c
    where c.id = p_parent_course_id;
    if v_parent_code is null then
      return jsonb_build_object('ok', false, 'error', 'المقرر الأصل غير موجود');
    end if;
    if lower(v_parent_code) !~* '^LAW[1-4][0-9]{2}$' then
      return jsonb_build_object('ok', false, 'error', 'رمز المقرر الأصل غير صالح');
    end if;
    if v_parent_level is null then
      return jsonb_build_object('ok', false, 'error', 'مستوى المقرر الأصل غير صالح');
    end if;
    if lower(btrim(coalesce(p_branch_track, ''))) not in ('bachelor_m', 'bachelor_f') then
      return jsonb_build_object('ok', false, 'error', 'مسار الفرع غير صالح');
    end if;
    v_code := public.management_generate_course_code(v_parent_level, p_parent_course_id, p_branch_track);
    v_track := lower(btrim(p_branch_track));
    v_level := v_parent_level;
  elsif nullif(v_code, '') is null then
    if lower(btrim(coalesce(p_track, ''))) not in ('bachelor', 'bachelor_m', 'bachelor_f') then
      return jsonb_build_object('ok', false, 'error', 'الرمز مطلوب للمسارات غير البكالوريوسية');
    end if;
    v_code := public.management_generate_course_code(p_level, null, null);
    v_track := 'bachelor';
  end if;

  if nullif(v_code, '') is null then
    return jsonb_build_object('ok', false, 'error', 'العنوان والرمز مطلوبان');
  end if;
  if exists (select 1 from public.courses where lower(code) = lower(v_code)) then
    return jsonb_build_object('ok', false, 'error', 'رمز المقرر مستخدم بالفعل');
  end if;
  if v_track not in ('bachelor', 'bachelor_m', 'bachelor_f', 'equiv', 'external', 'grad') then
    return jsonb_build_object('ok', false, 'error', 'المسار غير صالح');
  end if;
  if v_level is not null and v_level not between 1 and 4 then
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
                              attendance_weight, exams_weight, assignments_weight,
                              parent_course_id)
  values (v_teacher, btrim(p_title), v_code,
          nullif(btrim(coalesce(p_description, '')), ''),
          coalesce(nullif(btrim(coalesce(p_color, '')), ''), '#123A63'), v_track, v_level,
          p_attendance_weight, p_exams_weight, p_assignments_weight, p_parent_course_id)
  returning id into v_id;

  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
  values (
    v_uid, 'management_create_course', 'courses', v_id,
    jsonb_build_object('code', v_code, 'teacher_id', v_teacher, 'parent_course_id', p_parent_course_id)
  );

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object('id', v_id, 'code', v_code, 'teacher_id', v_teacher,
                               'parent_course_id', p_parent_course_id)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) أصل وفرعاه في معاملة واحدة: الأصل نشط ليُسجَّل فيه الطلاب، والفروع نشطة
-- ---------------------------------------------------------------------------
create or replace function public.management_create_course_family(
  p_title text,
  p_level smallint,
  p_description text default null,
  p_color text default '#1f4e5f',
  p_attendance_weight numeric default 30,
  p_exams_weight numeric default 70,
  p_assignments_weight numeric default 0,
  p_teacher_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        bigint := public.current_user_id();
  v_teacher    bigint;
  v_parent_id  bigint;
  v_male_id    bigint;
  v_female_id  bigint;
  v_parent_code text;
  v_male_code  text;
  v_female_code text;
begin
  if v_uid is null or not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  if nullif(btrim(coalesce(p_title, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'العنوان مطلوب');
  end if;
  if p_level is null or p_level not between 1 and 4 then
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

  v_parent_code := public.management_generate_course_code(p_level, null, null);

  -- الأصل نشط (archived = false) لأن قاعدة التسجيل تشمل الأصل وفرعه معاً.
  insert into public.courses (teacher_id, title, code, description, color, track, level,
                              attendance_weight, exams_weight, assignments_weight, archived)
  values (v_teacher, btrim(p_title), v_parent_code,
          nullif(btrim(coalesce(p_description, '')), ''),
          coalesce(nullif(btrim(coalesce(p_color, '')), ''), '#1f4e5f'),
          'bachelor', p_level, p_attendance_weight, p_exams_weight,
          p_assignments_weight, false)
  returning id into v_parent_id;

  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
  values (v_uid, 'management_create_course_family', 'courses', v_parent_id,
          jsonb_build_object('code', v_parent_code, 'track', 'bachelor', 'archived', false));

  v_male_code := public.management_generate_course_code(p_level, v_parent_id, 'bachelor_m');
  insert into public.courses (teacher_id, title, code, description, color, track, level,
                              attendance_weight, exams_weight, assignments_weight, parent_course_id)
  values (v_teacher, btrim(p_title), v_male_code,
          nullif(btrim(coalesce(p_description, '')), ''),
          coalesce(nullif(btrim(coalesce(p_color, '')), ''), '#1f4e5f'),
          'bachelor_m', p_level, p_attendance_weight, p_exams_weight,
          p_assignments_weight, v_parent_id)
  returning id into v_male_id;

  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
  values (v_uid, 'management_create_course_family', 'courses', v_male_id,
          jsonb_build_object('code', v_male_code, 'track', 'bachelor_m', 'parent_course_id', v_parent_id));

  v_female_code := public.management_generate_course_code(p_level, v_parent_id, 'bachelor_f');
  insert into public.courses (teacher_id, title, code, description, color, track, level,
                              attendance_weight, exams_weight, assignments_weight, parent_course_id)
  values (v_teacher, btrim(p_title), v_female_code,
          nullif(btrim(coalesce(p_description, '')), ''),
          coalesce(nullif(btrim(coalesce(p_color, '')), ''), '#1f4e5f'),
          'bachelor_f', p_level, p_attendance_weight, p_exams_weight,
          p_assignments_weight, v_parent_id)
  returning id into v_female_id;

  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
  values (v_uid, 'management_create_course_family', 'courses', v_female_id,
          jsonb_build_object('code', v_female_code, 'track', 'bachelor_f', 'parent_course_id', v_parent_id));

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'parent_id', v_parent_id,
      'parent_code', v_parent_code,
      'branches', jsonb_build_array(
        jsonb_build_object('id', v_male_id, 'code', v_male_code, 'track', 'bachelor_m'),
        jsonb_build_object('id', v_female_id, 'code', v_female_code, 'track', 'bachelor_f')
      )
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) الفرع النشط الذي يملك الطالب تسجيلاً فيه تحت محاضرة الأصل
--    تسجيل الطالب في الأصل نفسه ليس تعارضاً؛ فرعان نشطان خطأ صريح.
-- ---------------------------------------------------------------------------
create or replace function public.course_for_student_lecture(
  p_lecture_id bigint,
  p_student_id bigint
)
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_course_id bigint;
  v_branch_id bigint;
  v_count     integer := 0;
begin
  -- الدالة SECURITY DEFINER: لا تكشف تسجيل طالب آخر لأي مستخدم عادي.
  if p_student_id is null
     or (p_student_id <> public.current_user_id() and not public.is_owner()) then
    raise exception 'not allowed';
  end if;

  select l.course_id into v_course_id
  from public.lectures l
  where l.id = p_lecture_id;

  if v_course_id is null then
    return null;
  end if;

  select count(*), min(c.id) into v_count, v_branch_id
  from public.courses c
  join public.enrollments e on e.course_id = c.id
    and e.student_id = p_student_id and e.status = 'active'
  where c.parent_course_id = v_course_id
    and c.archived = false
    and c.track in ('bachelor_m', 'bachelor_f');

  if v_count > 1 then
    raise exception 'أكثر من فرع نشط للطالب تحت المحاضرة';
  end if;

  return v_branch_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) دوال الطالب: نفس التواقيع والأشكال، مع مسار محاضرة الأصل
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
           sc.title as course_title, sc.code as course_code, sc.color as course_color,
           u.name as teacher
    from lectures l
    join courses c on c.id = l.course_id
    join lateral (
      select coalesce(public.course_for_student_lecture(l.id, v_uid), l.course_id) as effective_course_id
    ) ec on true
    join courses sc on sc.id = ec.effective_course_id
    join enrollments e on e.course_id = ec.effective_course_id
                       and e.student_id = v_uid and e.status = 'active'
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
  v_course_id bigint;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not authenticated');
  end if;

  select l.id into v_lecture_id
  from lectures l
  where l.id = p_lecture_id
    and exists (
      select 1 from enrollments e
      where e.course_id = coalesce(public.course_for_student_lecture(l.id, v_uid), l.course_id)
        and e.student_id = v_uid and e.status = 'active'
    )
  limit 1;

  if v_lecture_id is null then
    return jsonb_build_object('ok', false, 'error', 'lecture_not_found');
  end if;

  select coalesce(public.course_for_student_lecture(v_lecture_id, v_uid),
                  (select course_id from lectures where id = v_lecture_id))
  into v_course_id;

  select jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'lecture', (
        select jsonb_build_object(
          'id', l.id,
          'title', l.title,
          'description', l.description,
          'course_id', v_course_id,
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
        join courses c on c.id = v_course_id
        left join users u on u.id = (select lc.teacher_id from courses lc where lc.id = l.course_id)
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
        join enrollments e2 on e2.course_id = coalesce(public.course_for_student_lecture(l2.id, v_uid), l2.course_id)
          and e2.student_id = v_uid and e2.status = 'active'
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
-- 6) سياسات القراءة: تسجيل الفرع يفتح محاضرة الأصل وملفاتها وأسئلتها
--    كل السياسات مقيّدة بـ authenticated؛ لا صلاحية جديدة لـ anon.
-- ---------------------------------------------------------------------------
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
    or exists (
        select 1 from public.enrollments e
        where e.course_id = public.course_for_student_lecture(lectures.id, public.current_user_id())
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
    or exists (
        select 1 from public.enrollments e
        where e.course_id = public.course_for_student_lecture(files.lecture_id, public.current_user_id())
          and e.student_id = public.current_user_id()
          and e.status = 'active'
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
    or exists (
        select 1 from public.enrollments e
        where e.course_id = public.course_for_student_lecture(questions.lecture_id, public.current_user_id())
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
    or exists (
        select 1 from public.enrollments e
        where e.course_id = public.course_for_student_lecture(lecture_presence.lecture_id, public.current_user_id())
          and e.student_id = public.current_user_id()
          and e.status = 'active'
    )
  );

-- ---------------------------------------------------------------------------
-- 7) الصلاحيات: authenticated و service_role فقط، بلا anon
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'management_generate_course_code(smallint,bigint,text)',
    'management_create_course(text,text,text,text,smallint,text,numeric,numeric,numeric,bigint,bigint,text)',
    'management_create_course_family(text,smallint,text,text,numeric,numeric,numeric,bigint)',
    'course_for_student_lecture(bigint,bigint)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end $$;

notify pgrst, 'reload schema';

commit;

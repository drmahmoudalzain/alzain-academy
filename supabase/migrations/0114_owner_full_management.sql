-- ============================================================
-- 0114_owner_full_management.sql
-- إدارة المالك الكاملة: المستخدمون والمقررات والطلاب.
--
-- كل عمليات البيانات تمر عبر دوال security definer محمية بـ
-- current_user_id() + is_owner(). عمليات Auth وحدها تتم في
-- Edge Function بصلاحية service_role، وتستدعي هذه الدوال
-- بتوكن جلسة المالك حتى يبقى auth.uid() هو الحارس الفعلي.
-- ============================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) حارس الـ Edge Function: يُستدعى بصلاحية service_role بعد التحقق من JWT
-- ---------------------------------------------------------------------------
create or replace function public.is_owner_by_auth_uid(p_auth_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    exists (
      select 1
      from public.users u
      where u.auth_id = p_auth_uid
        and u.is_active = true
        and u.id = (
          select min(t.id) from public.users t where t.role = 'teacher'
        )
    ),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- 2) حجز الرمز الموحّد للمستخدم الجديد
-- ---------------------------------------------------------------------------
create or replace function public.management_allocate_platform_id(
  p_role text, p_track text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role   text := lower(btrim(coalesce(p_role, '')));
  v_track  text := lower(btrim(coalesce(p_track, '')));
  v_prefix text;
  v_next   integer;
  v_code   text;
begin
  if public.current_user_id() is null or not public.is_owner() then
    return null;
  end if;
  if v_role not in ('teacher', 'assistant', 'student') then
    return null;
  end if;

  v_prefix := case
    when v_role = 'teacher'   then 'TE'
    when v_role = 'assistant' then 'AS'
    when v_track = 'bachelor_m' then 'BM'
    when v_track = 'bachelor_f' then 'BF'
    when v_track = 'equiv'      then 'EQ'
    when v_track = 'external'   then 'EX'
    when v_track = 'grad'       then 'PG'
    else null
  end;
  if v_prefix is null then
    return null;
  end if;

  -- منع تخصيص الرمز نفسه لجلسة مالك متزامنة
  perform pg_advisory_xact_lock(71104);

  select coalesce(max(substring(u.platform_id from 3)::integer), 0) + 1
    into v_next
  from public.users u
  where u.platform_id ~ ('^' || v_prefix || '[0-9]+$');

  loop
    v_code := v_prefix || lpad(v_next::text, 4, '0');
    exit when not exists (
      select 1 from public.users u where lower(u.platform_id) = lower(v_code)
    );
    v_next := v_next + 1;
  end loop;

  return v_code;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) إنشاء صف المستخدم بعد إنشاء حساب Auth في الـ Edge Function
-- ---------------------------------------------------------------------------
create or replace function public.management_create_user_profile(
  p_auth_id uuid, p_platform_id text, p_name text, p_email text,
  p_phone text default null, p_role text, p_track text default null,
  p_level smallint default null, p_university_id text default null,
  p_gender text default null, p_position text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id      bigint;
  v_role    text := lower(btrim(coalesce(p_role, '')));
  v_code    text := upper(btrim(coalesce(p_platform_id, '')));
  v_email   text := lower(btrim(coalesce(p_email, '')));
  v_track   text;
  v_staff   boolean;
begin
  if public.current_user_id() is null or not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  if p_auth_id is null or v_code = '' then
    return jsonb_build_object('ok', false, 'error', 'معرّف الحساب والرمز مطلوبان');
  end if;
  if nullif(btrim(coalesce(p_name, '')), '') is null or v_email = '' then
    return jsonb_build_object('ok', false, 'error', 'الاسم والبريد مطلوبان');
  end if;
  if v_role not in ('teacher', 'assistant', 'student') then
    return jsonb_build_object('ok', false, 'error', 'الدور غير صالح');
  end if;
  if exists (select 1 from public.users u where u.auth_id = p_auth_id) then
    return jsonb_build_object('ok', false, 'error', 'حساب الدخول مرتبط بمستخدم بالفعل');
  end if;
  if exists (select 1 from public.users u where lower(u.platform_id) = lower(v_code)) then
    return jsonb_build_object('ok', false, 'error', 'رمز المنصة مستخدم بالفعل');
  end if;
  if exists (select 1 from public.users u where lower(u.email) = v_email) then
    return jsonb_build_object('ok', false, 'error', 'البريد مستخدم بالفعل');
  end if;
  if nullif(btrim(coalesce(p_university_id, '')), '') is not null
     and exists (
       select 1 from public.users u
       where lower(u.university_id) = lower(btrim(p_university_id))
     ) then
    return jsonb_build_object('ok', false, 'error', 'الرقم الجامعي مستخدم بالفعل');
  end if;
  if p_gender is not null and p_gender not in ('M', 'F') then
    return jsonb_build_object('ok', false, 'error', 'النوع غير صالح');
  end if;

  if v_role = 'student' then
    v_track := lower(btrim(coalesce(p_track, '')));
    if v_track not in ('bachelor_m', 'bachelor_f', 'equiv', 'external', 'grad') then
      return jsonb_build_object('ok', false, 'error', 'مسار الطالب غير صالح');
    end if;
    if p_level is not null and p_level not between 1 and 4 then
      return jsonb_build_object('ok', false, 'error', 'المستوى غير صالح');
    end if;
  else
    v_track := null;
  end if;
  v_staff := v_role in ('teacher', 'assistant');

  insert into public.users (
    role, name, email, phone, platform_id, university_id, track, level,
    gender, position, is_staff, auth_id, must_change_password, is_active, password_hash
  )
  values (
    v_role, btrim(p_name), v_email,
    nullif(btrim(coalesce(p_phone, '')), ''), v_code,
    nullif(btrim(coalesce(p_university_id, '')), ''), v_track,
    case when v_role = 'student' then p_level end,
    case when v_role = 'student' then p_gender end,
    case when v_staff then nullif(btrim(coalesce(p_position, '')), '') end,
    v_staff, p_auth_id, true, true, null
  )
  returning id into v_id;

  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
  values (
    public.current_user_id(), 'management_create_user_profile', 'users', v_id,
    jsonb_build_object('role', v_role, 'platform_id', v_code, 'auth_id', p_auth_id)
  );

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object('id', v_id, 'platform_id', v_code, 'auth_id', p_auth_id)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) تعديل مستخدم: الدور والمسار والمستوى والرمز وبيانات المراسلة
-- ---------------------------------------------------------------------------
create or replace function public.management_update_user(
  p_user_id bigint, p_name text, p_email text, p_phone text default null,
  p_university_id text default null, p_platform_id text default null,
  p_role text default null, p_track text default null,
  p_level smallint default null, p_gender text default null,
  p_position text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid           bigint := public.current_user_id();
  v_old           public.users%rowtype;
  v_owner         bigint;
  v_owner_prefix  text;
  v_role          text;
  v_code          text;
  v_email         text := lower(btrim(coalesce(p_email, '')));
  v_track         text;
begin
  if v_uid is null or not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  select * into v_old from public.users where id = p_user_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'المستخدم غير موجود');
  end if;

  select min(id) into v_owner from public.users where role = 'teacher';
  if p_user_id = v_owner
     and p_role is not null
     and lower(btrim(p_role)) <> 'teacher' then
    return jsonb_build_object('ok', false, 'error', 'لا يمكن تغيير دور المالك');
  end if;

  if nullif(btrim(coalesce(p_name, '')), '') is null or v_email = '' then
    return jsonb_build_object('ok', false, 'error', 'الاسم والبريد مطلوبان');
  end if;

  v_code := case
    when nullif(btrim(coalesce(p_platform_id, '')), '') is null
      then v_old.platform_id
    else upper(btrim(p_platform_id))
  end;
  -- بادئة المالك محفوظة له وحده
  select left(platform_id, 2) into v_owner_prefix
  from public.users where id = v_owner;
  if p_user_id <> v_owner
     and v_owner_prefix is not null
     and upper(left(v_code, 2)) = v_owner_prefix then
    return jsonb_build_object('ok', false, 'error', 'بادئة رمز المالك غير مسموحة');
  end if;
  if exists (
    select 1 from public.users u
    where u.id <> p_user_id and lower(u.platform_id) = lower(v_code)
  ) then
    return jsonb_build_object('ok', false, 'error', 'رمز المنصة مستخدم بالفعل');
  end if;
  if exists (
    select 1 from public.users u
    where u.id <> p_user_id and lower(u.email) = v_email
  ) then
    return jsonb_build_object('ok', false, 'error', 'البريد مستخدم بالفعل');
  end if;
  if nullif(btrim(coalesce(p_university_id, '')), '') is not null
     and exists (
       select 1 from public.users u
       where u.id <> p_user_id
         and lower(u.university_id) = lower(btrim(p_university_id))
     ) then
    return jsonb_build_object('ok', false, 'error', 'الرقم الجامعي مستخدم بالفعل');
  end if;
  if p_gender is not null and p_gender not in ('M', 'F') then
    return jsonb_build_object('ok', false, 'error', 'النوع غير صالح');
  end if;

  v_role := case
    when p_role is null then v_old.role
    else lower(btrim(p_role))
  end;
  if v_role not in ('teacher', 'assistant', 'student') then
    return jsonb_build_object('ok', false, 'error', 'الدور غير صالح');
  end if;
  if v_role = 'student' then
    v_track := lower(btrim(coalesce(p_track, v_old.track, '')));
    if v_track not in ('bachelor_m', 'bachelor_f', 'equiv', 'external', 'grad') then
      return jsonb_build_object('ok', false, 'error', 'مسار الطالب غير صالح');
    end if;
    if coalesce(p_level, v_old.level) is not null
       and coalesce(p_level, v_old.level) not between 1 and 4 then
      return jsonb_build_object('ok', false, 'error', 'المستوى غير صالح');
    end if;
  else
    v_track := null;
  end if;

  update public.users u set
    name = btrim(p_name),
    email = v_email,
    phone = nullif(btrim(coalesce(p_phone, '')), ''),
    university_id = case
      when v_role = 'student'
        then nullif(btrim(coalesce(p_university_id, '')), '')
      else u.university_id
    end,
    platform_id = v_code,
    role = v_role,
    track = v_track,
    level = case when v_role = 'student' then coalesce(p_level, v_old.level) end,
    gender = case when v_role = 'student' then coalesce(p_gender, v_old.gender) end,
    position = case
      when v_role in ('teacher', 'assistant')
        then nullif(btrim(coalesce(p_position, '')), '')
      else null
    end,
    is_staff = v_role in ('teacher', 'assistant')
  where u.id = p_user_id;

  insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data)
  values (
    v_uid, 'management_update_user', 'users', p_user_id,
    to_jsonb(v_old),
    jsonb_build_object('role', v_role, 'platform_id', v_code, 'track', v_track)
  );

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object('id', p_user_id, 'role', v_role, 'platform_id', v_code)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) تفعيل/تعطيل المستخدم (حظر الجلسات يتم في الـ Edge Function)
-- ---------------------------------------------------------------------------
create or replace function public.management_set_user_active(
  p_user_id bigint, p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   bigint := public.current_user_id();
  v_owner bigint;
  v_old   boolean;
begin
  if v_uid is null or not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  select is_active into v_old from public.users where id = p_user_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'المستخدم غير موجود');
  end if;
  select min(id) into v_owner from public.users where role = 'teacher';
  if p_user_id = v_owner and p_active = false then
    return jsonb_build_object('ok', false, 'error', 'لا يمكن تعطيل المالك');
  end if;
  if p_user_id = v_uid and p_active = false then
    return jsonb_build_object('ok', false, 'error', 'لا يمكن تعطيل نفسك');
  end if;

  update public.users set is_active = p_active where id = p_user_id;

  insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data)
  values (
    v_uid, 'management_set_user_active', 'users', p_user_id,
    jsonb_build_object('is_active', v_old),
    jsonb_build_object('is_active', p_active)
  );

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', p_user_id, 'is_active', p_active));
end;
$$;

create or replace function public.management_flag_password_change(
  p_user_id bigint, p_value boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid bigint := public.current_user_id();
begin
  if v_uid is null or not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  if not exists (select 1 from public.users where id = p_user_id) then
    return jsonb_build_object('ok', false, 'error', 'المستخدم غير موجود');
  end if;

  update public.users set must_change_password = p_value where id = p_user_id;

  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
  values (
    v_uid, 'management_flag_password_change', 'users', p_user_id,
    jsonb_build_object('must_change_password', p_value)
  );

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', p_user_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- 6) معاينة أثر حذف المستخدم قبل التأكيد
-- ---------------------------------------------------------------------------
create or replace function public.management_preflight_delete_user(p_user_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          bigint := public.current_user_id();
  v_owner        bigint;
  v_enrollments  integer;
  v_grades       integer;
  v_attendance   integer;
  v_points       integer;
  v_notifications integer;
  v_courses      integer;
  v_publications integer;
  v_blockers     text[] := '{}'::text[];
begin
  if v_uid is null or not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  if not exists (select 1 from public.users where id = p_user_id) then
    return jsonb_build_object('ok', false, 'error', 'المستخدم غير موجود');
  end if;

  select min(id) into v_owner from public.users where role = 'teacher';
  if p_user_id = v_owner then
    v_blockers := array_append(v_blockers, 'لا يمكن حذف المالك الحالي');
  end if;

  select count(*) into v_enrollments
  from public.enrollments where enrollments.student_id = p_user_id;
  select count(*) into v_grades
  from (
    select 1 from public.submissions where student_id = p_user_id and points is not null
    union all
    select 1 from public.exam_attempts where student_id = p_user_id and score is not null
  ) g;
  select count(*) into v_attendance
  from public.attendance where attendance.student_id = p_user_id;
  select count(*) into v_points
  from public.points_ledger where points_ledger.user_id = p_user_id;
  select count(*) into v_notifications
  from public.notifications where notifications.user_id = p_user_id;
  select count(*) into v_courses
  from public.courses where courses.teacher_id = p_user_id;
  select count(*) into v_publications
  from public.publications where publications.author_id = p_user_id;

  if v_courses > 0 then
    v_blockers := array_append(v_blockers, 'يجب إعادة إسناد المقررات المسندة قبل الحذف');
  end if;
  if v_publications > 0 then
    v_blockers := array_append(v_blockers, 'يجب إعادة إسناد المؤلفات قبل الحذف');
  end if;

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'blockers', to_jsonb(v_blockers),
      'counts', jsonb_build_object(
        'enrollments', v_enrollments,
        'grades', v_grades,
        'attendance', v_attendance,
        'points', v_points,
        'notifications', v_notifications,
        'courses', v_courses,
        'publications', v_publications
      )
    )
  );
end;
$$;

create or replace function public.management_delete_user_finalize(
  p_user_id bigint, p_expected_auth_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          bigint := public.current_user_id();
  v_owner        bigint;
  v_auth_id      uuid;
  v_courses      integer;
  v_publications integer;
begin
  if v_uid is null or not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  select auth_id into v_auth_id from public.users where id = p_user_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'المستخدم غير موجود');
  end if;
  if p_expected_auth_id is not null
     and v_auth_id is not null
     and v_auth_id <> p_expected_auth_id then
    return jsonb_build_object('ok', false, 'error', 'معرّف حساب الدخول لا يطابق المتوقع');
  end if;

  select min(id) into v_owner from public.users where role = 'teacher';
  if p_user_id = v_owner then
    return jsonb_build_object('ok', false, 'error', 'لا يمكن حذف المالك الحالي');
  end if;
  select count(*) into v_courses
  from public.courses where courses.teacher_id = p_user_id;
  select count(*) into v_publications
  from public.publications where publications.author_id = p_user_id;
  if v_courses > 0 or v_publications > 0 then
    return jsonb_build_object('ok', false, 'error', 'توجد ارتباطات تمنع الحذف');
  end if;

  insert into public.audit_logs (actor_id, action, table_name, record_id, old_data)
  values (
    v_uid, 'management_delete_user_finalize', 'users', p_user_id,
    jsonb_build_object('auth_id', v_auth_id, 'expected_auth_id', p_expected_auth_id)
  );

  delete from public.users where id = p_user_id;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', p_user_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- 7) المقررات: توقيع موسّع للرمز القابل للتعديل + معاينة وحذف
-- ---------------------------------------------------------------------------
drop function if exists public.management_update_course(bigint,text,text,text,boolean,text,smallint,numeric,numeric,numeric,bigint);

create or replace function public.management_update_course(
  p_course_id bigint, p_title text, p_description text default null,
  p_color text default null, p_archived boolean default null,
  p_track text default null, p_level smallint default null,
  p_attendance_weight numeric default null, p_exams_weight numeric default null,
  p_assignments_weight numeric default null, p_teacher_id bigint default null,
  p_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid            bigint := public.current_user_id();
  v_old            public.courses%rowtype;
  v_teacher        bigint;
  v_code           text;
begin
  if v_uid is null or not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  select * into v_old from public.courses where id = p_course_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'المقرر غير موجود');
  end if;
  if nullif(btrim(coalesce(p_title, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'العنوان مطلوب');
  end if;

  v_code := case
    when nullif(btrim(coalesce(p_code, '')), '') is null
      then v_old.code
    else btrim(p_code)
  end;
  if exists (
    select 1 from public.courses c
    where c.id <> p_course_id and lower(c.code) = lower(v_code)
  ) then
    return jsonb_build_object('ok', false, 'error', 'رمز المقرر مستخدم بالفعل');
  end if;
  if p_track is not null
     and p_track not in ('bachelor', 'bachelor_m', 'bachelor_f', 'equiv', 'external', 'grad') then
    return jsonb_build_object('ok', false, 'error', 'المسار غير صالح');
  end if;
  if p_level is not null and p_level not between 1 and 4 then
    return jsonb_build_object('ok', false, 'error', 'المستوى غير صالح');
  end if;
  if p_attendance_weight is not null or p_exams_weight is not null or p_assignments_weight is not null then
    if coalesce(p_attendance_weight, 0) + coalesce(p_exams_weight, 0)
       + coalesce(p_assignments_weight, 0) <> 100 then
      return jsonb_build_object('ok', false, 'error', 'مجموع الأوزان يجب أن يساوي 100');
    end if;
  end if;

  v_teacher := coalesce(p_teacher_id, v_old.teacher_id);
  if not exists (
    select 1 from public.users u
    where u.id = v_teacher and u.role = 'teacher' and u.is_active = true
  ) then
    return jsonb_build_object('ok', false, 'error', 'الأستاذ المسؤول غير صالح');
  end if;

  update public.courses c set
    teacher_id = v_teacher,
    title = btrim(p_title),
    code = v_code,
    description = nullif(btrim(coalesce(p_description, '')), ''),
    color = coalesce(nullif(btrim(coalesce(p_color, '')), ''), c.color),
    archived = coalesce(p_archived, c.archived),
    track = coalesce(p_track, c.track),
    level = coalesce(p_level, c.level),
    attendance_weight = coalesce(p_attendance_weight, c.attendance_weight),
    exams_weight = coalesce(p_exams_weight, c.exams_weight),
    assignments_weight = coalesce(p_assignments_weight, c.assignments_weight)
  where c.id = p_course_id;

  insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data)
  values (
    v_uid, 'management_update_course', 'courses', p_course_id,
    to_jsonb(v_old), jsonb_build_object('code', v_code, 'teacher_id', v_teacher)
  );

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object('id', p_course_id, 'code', v_code, 'teacher_id', v_teacher)
  );
end;
$$;

create or replace function public.management_preflight_delete_course(p_course_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         bigint := public.current_user_id();
  v_children    integer;
  v_lectures    integer;
  v_exams       integer;
  v_assignments integer;
  v_enrollments integer;
  v_submissions integer;
  v_points      integer;
  v_attendance  integer;
  v_blockers    text[] := '{}'::text[];
begin
  if v_uid is null or not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  if not exists (select 1 from public.courses where id = p_course_id) then
    return jsonb_build_object('ok', false, 'error', 'المقرر غير موجود');
  end if;

  select count(*) into v_children
  from public.courses where parent_course_id = p_course_id;
  select count(*) into v_lectures
  from public.lectures where lectures.course_id = p_course_id;
  select count(*) into v_exams
  from public.exams where exams.course_id = p_course_id;
  select count(*) into v_assignments
  from public.assignments where assignments.course_id = p_course_id;
  select count(*) into v_enrollments
  from public.enrollments where enrollments.course_id = p_course_id;
  select count(*) into v_submissions
  from public.submissions s
  join public.assignments a on a.id = s.assignment_id
  where a.course_id = p_course_id;
  select count(*) into v_points
  from public.points_ledger where points_ledger.course_id = p_course_id;
  select count(*) into v_attendance
  from public.attendance t
  join public.lectures l on l.id = t.lecture_id
  where l.course_id = p_course_id;

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'blockers', to_jsonb(v_blockers),
      'counts', jsonb_build_object(
        'children', v_children,
        'lectures', v_lectures,
        'exams', v_exams,
        'assignments', v_assignments,
        'enrollments', v_enrollments,
        'submissions', v_submissions,
        'points', v_points,
        'attendance', v_attendance
      )
    )
  );
end;
$$;

create or replace function public.management_delete_course(p_course_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    bigint := public.current_user_id();
  v_old    public.courses%rowtype;
  v_result jsonb;
begin
  if v_uid is null or not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  select * into v_old from public.courses where id = p_course_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'المقرر غير موجود');
  end if;

  v_result := public.management_preflight_delete_course(p_course_id);
  if coalesce(v_result ->> 'ok', 'false') <> 'true' then
    return v_result;
  end if;

  insert into public.audit_logs (actor_id, action, table_name, record_id, old_data)
  values (
    v_uid, 'management_delete_course', 'courses', p_course_id, to_jsonb(v_old)
  );

  delete from public.courses where id = p_course_id;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', p_course_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- 8) مسار الطالب وتسجيله ونقله: السجل القديم يُوقَف ولا يُحذف
-- ---------------------------------------------------------------------------
create or replace function public.management_change_student_track(
  p_student_id bigint, p_track text, p_level smallint default null,
  p_sync_enrollments boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    bigint := public.current_user_id();
  v_track  text := lower(btrim(coalesce(p_track, '')));
  v_level  smallint;
  v_old    public.users%rowtype;
  v_added  integer := 0;
begin
  if v_uid is null or not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  select * into v_old from public.users where id = p_student_id;
  if not found or v_old.role <> 'student' then
    return jsonb_build_object('ok', false, 'error', 'الطالب غير موجود');
  end if;
  if v_track not in ('bachelor_m', 'bachelor_f', 'equiv', 'external', 'grad') then
    return jsonb_build_object('ok', false, 'error', 'مسار الطالب غير صالح');
  end if;
  v_level := coalesce(p_level, v_old.level);
  if v_level is not null and v_level not between 1 and 4 then
    return jsonb_build_object('ok', false, 'error', 'المستوى غير صالح');
  end if;

  update public.users set track = v_track, level = v_level where id = p_student_id;

  if p_sync_enrollments then
    update public.enrollments
       set status = 'suspended'
     where student_id = p_student_id and status = 'active';

    insert into public.enrollments (course_id, student_id, status)
    select c.id, p_student_id, 'active'
    from public.courses c
    where c.archived = false
      and (v_level is null or c.level is null or c.level = v_level)
      and (
        c.track = v_track
        or (
          c.track = 'bachelor'
          and exists (
            select 1 from public.courses b
            where b.parent_course_id = c.id
              and b.track = v_track
              and b.archived = false
          )
        )
      )
    on conflict (course_id, student_id) do update set status = 'active';
    get diagnostics v_added = row_count;
  end if;

  insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data)
  values (
    v_uid, 'management_change_student_track', 'users', p_student_id,
    jsonb_build_object('track', v_old.track, 'level', v_old.level),
    jsonb_build_object('track', v_track, 'level', v_level, 'synced', p_sync_enrollments, 'added', v_added)
  );

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object('id', p_student_id, 'track', v_track, 'added', v_added)
  );
end;
$$;

create or replace function public.management_enroll_student_in_track(
  p_student_id bigint, p_track text, p_level smallint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   bigint := public.current_user_id();
  v_track text := lower(btrim(coalesce(p_track, '')));
  v_level smallint;
  v_added integer := 0;
begin
  if v_uid is null or not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  if not exists (
    select 1 from public.users where id = p_student_id and role = 'student'
  ) then
    return jsonb_build_object('ok', false, 'error', 'الطالب غير موجود');
  end if;
  if v_track not in ('bachelor_m', 'bachelor_f', 'equiv', 'external', 'grad') then
    return jsonb_build_object('ok', false, 'error', 'مسار الطالب غير صالح');
  end if;
  select level into v_level from public.users where id = p_student_id;
  v_level := coalesce(p_level, v_level);
  if v_level is not null and v_level not between 1 and 4 then
    return jsonb_build_object('ok', false, 'error', 'المستوى غير صالح');
  end if;

  insert into public.enrollments (course_id, student_id, status)
  select c.id, p_student_id, 'active'
  from public.courses c
  where c.archived = false
    and (v_level is null or c.level is null or c.level = v_level)
    and (
      c.track = v_track
      or (
        c.track = 'bachelor'
        and exists (
          select 1 from public.courses b
          where b.parent_course_id = c.id
            and b.track = v_track
            and b.archived = false
        )
      )
    )
  on conflict (course_id, student_id) do update set status = 'active';
  get diagnostics v_added = row_count;

  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
  values (
    v_uid, 'management_enroll_student_in_track', 'enrollments', p_student_id,
    jsonb_build_object('track', v_track, 'level', v_level, 'added', v_added)
  );

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('added', v_added));
end;
$$;

create or replace function public.management_transfer_student(
  p_student_id bigint, p_from_course_id bigint, p_to_course_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid bigint := public.current_user_id();
begin
  if v_uid is null or not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  if not exists (select 1 from public.users where id = p_student_id and role = 'student') then
    return jsonb_build_object('ok', false, 'error', 'الطالب غير موجود');
  end if;
  if not exists (select 1 from public.courses where id = p_from_course_id)
     or not exists (select 1 from public.courses where id = p_to_course_id) then
    return jsonb_build_object('ok', false, 'error', 'المقرر غير موجود');
  end if;
  if p_from_course_id = p_to_course_id then
    return jsonb_build_object('ok', false, 'error', 'المقرر الهدف هو نفسه المقرر الحالي');
  end if;
  if not exists (
    select 1 from public.enrollments
    where student_id = p_student_id and course_id = p_from_course_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'التسجيل الحالي غير موجود');
  end if;

  update public.enrollments
     set status = 'suspended'
   where student_id = p_student_id and course_id = p_from_course_id;

  insert into public.enrollments (course_id, student_id, status)
  values (p_to_course_id, p_student_id, 'active')
  on conflict (course_id, student_id) do update set status = 'active';

  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
  values (
    v_uid, 'management_transfer_student', 'enrollments', p_student_id,
    jsonb_build_object('from', p_from_course_id, 'to', p_to_course_id)
  );

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object('from', p_from_course_id, 'to', p_to_course_id)
  );
end;
$$;

create or replace function public.management_set_enrollment_status(
  p_course_id bigint, p_student_id bigint, p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   bigint := public.current_user_id();
  v_status text := lower(btrim(coalesce(p_status, '')));
  v_old   text;
begin
  if v_uid is null or not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  if v_status not in ('active', 'suspended') then
    return jsonb_build_object('ok', false, 'error', 'حالة التسجيل غير صالحة');
  end if;
  select status into v_old
  from public.enrollments
  where course_id = p_course_id and student_id = p_student_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'التسجيل غير موجود');
  end if;

  update public.enrollments
     set status = v_status
   where course_id = p_course_id and student_id = p_student_id;

  insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data)
  values (
    v_uid, 'management_set_enrollment_status', 'enrollments', p_student_id,
    jsonb_build_object('course_id', p_course_id, 'status', v_old),
    jsonb_build_object('course_id', p_course_id, 'status', v_status)
  );

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object('course_id', p_course_id, 'student_id', p_student_id, 'status', v_status)
  );
end;
$$;

create or replace function public.management_remove_enrollment(
  p_course_id bigint, p_student_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      bigint := public.current_user_id();
  v_history  integer;
  v_detached boolean := false;
begin
  if v_uid is null or not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  if not exists (
    select 1 from public.enrollments
    where course_id = p_course_id and student_id = p_student_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'التسجيل غير موجود');
  end if;

  select count(*) into v_history
  from (
    select 1
    from public.submissions s
    join public.assignments a on a.id = s.assignment_id
    where a.course_id = p_course_id and s.student_id = p_student_id
    union all
    select 1 from public.points_ledger
    where course_id = p_course_id and user_id = p_student_id
    union all
    select 1
    from public.attendance t
    join public.lectures l on l.id = t.lecture_id
    where l.course_id = p_course_id and t.student_id = p_student_id
  ) h;

  if v_history > 0 then
    update public.enrollments
       set status = 'suspended'
     where course_id = p_course_id and student_id = p_student_id;
    v_detached := true;
  else
    delete from public.enrollments
    where course_id = p_course_id and student_id = p_student_id;
  end if;

  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
  values (
    v_uid, 'management_remove_enrollment', 'enrollments', p_student_id,
    jsonb_build_object('course_id', p_course_id, 'suspended_instead_of_delete', v_detached)
  );

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'course_id', p_course_id, 'student_id', p_student_id,
      'suspended_instead_of_delete', v_detached
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 9) إعادة تعريف دوال 0112/0113 بالتواقيع نفسها لإضافة سجل التدقيق
-- ---------------------------------------------------------------------------
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

create or replace function public.management_assign_course_teacher(
  p_course_id bigint, p_teacher_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid bigint := public.current_user_id();
begin
  if v_uid is null or not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  if not exists (select 1 from public.courses where id = p_course_id) then
    return jsonb_build_object('ok', false, 'error', 'المقرر غير موجود');
  end if;
  if p_teacher_id is null or not exists (
    select 1 from public.users u
    where u.id = p_teacher_id and u.role = 'teacher' and u.is_active = true
  ) then
    return jsonb_build_object('ok', false, 'error', 'الأستاذ المسؤول غير صالح');
  end if;

  update public.courses set teacher_id = p_teacher_id where id = p_course_id;

  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
  values (
    v_uid, 'management_assign_course_teacher', 'courses', p_course_id,
    jsonb_build_object('teacher_id', p_teacher_id)
  );

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object('id', p_course_id, 'teacher_id', p_teacher_id)
  );
end;
$$;

create or replace function public.management_add_lecture(
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
  v_uid bigint := public.current_user_id();
  v_id  bigint;
begin
  if v_uid is null or not public.is_owner()
     or not exists (select 1 from public.courses where id = p_course_id) then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  if nullif(btrim(coalesce(p_title, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'عنوان المحاضرة مطلوب');
  end if;
  if p_lecture_type not in ('direct', 'online', 'recorded') then
    return jsonb_build_object('ok', false, 'error', 'نوع المحاضرة غير صالح');
  end if;

  insert into public.lectures (course_id, title, description, lecture_type, scheduled_at,
                               duration_min, youtube_url, live_url, status)
  values (p_course_id, btrim(p_title), nullif(btrim(coalesce(p_description, '')), ''),
          p_lecture_type, p_scheduled_at, coalesce(p_duration_min, 120),
          nullif(btrim(coalesce(p_youtube_url, '')), ''),
          nullif(btrim(coalesce(p_live_url, '')), ''), 'scheduled')
  returning id into v_id;

  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
  values (v_uid, 'management_add_lecture', 'lectures', v_id, jsonb_build_object('course_id', p_course_id));

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', v_id));
end;
$$;

create or replace function public.management_create_exam(
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
  v_uid bigint := public.current_user_id();
  v_id  bigint;
begin
  if v_uid is null or not public.is_owner()
     or not exists (select 1 from public.courses where id = p_course_id) then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  if nullif(btrim(coalesce(p_title, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'عنوان الاختبار مطلوب');
  end if;
  if p_exam_kind not in ('exam', 'assignment') then
    return jsonb_build_object('ok', false, 'error', ' نوع الاختبار غير صالح');
  end if;

  insert into public.exams (course_id, title, description, exam_kind, starts_at, ends_at,
                            duration_min, is_published)
  values (p_course_id, btrim(p_title), nullif(btrim(coalesce(p_description, '')), ''),
          p_exam_kind, p_starts_at, p_ends_at, p_duration_min, coalesce(p_is_published, false))
  returning id into v_id;

  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
  values (v_uid, 'management_create_exam', 'exams', v_id, jsonb_build_object('course_id', p_course_id));

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', v_id));
end;
$$;

create or replace function public.management_grade_submission(
  p_submission_id bigint, p_points numeric, p_feedback text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      bigint := public.current_user_id();
  v_student  bigint;
  v_course   bigint;
  v_title    text;
  v_max      numeric(6,2);
begin
  if v_uid is null or not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;

  select s.student_id, c.id, a.title, a.max_points
    into v_student, v_course, v_title, v_max
  from public.submissions s
  join public.assignments a on a.id = s.assignment_id
  join public.courses c on c.id = a.course_id
  where s.id = p_submission_id;

  if v_student is null then
    return jsonb_build_object('ok', false, 'error', 'التسليم غير موجود');
  end if;
  if p_points is null or p_points < 0 or p_points > v_max then
    return jsonb_build_object('ok', false, 'error', 'الدرجة خارج النطاق المسموح');
  end if;

  update public.submissions
     set points = p_points,
         feedback = nullif(btrim(coalesce(p_feedback, '')), ''),
         graded_at = now()
   where id = p_submission_id;

  insert into public.points_ledger (user_id, course_id, source_type, source_id, source_detail, points)
  values (v_student, v_course, 'assignment', p_submission_id, v_title, round(p_points)::integer)
  on conflict (user_id, course_id, source_type, source_id)
  do update set points = excluded.points, source_detail = excluded.source_detail;

  insert into public.notifications (audience, course_id, user_id, title, body, link, created_by, type)
  values ('user', v_course, v_student, 'تم تصحيح تسليمك',
          coalesce(v_title, 'واجب') || ' — الدرجة: ' || p_points::text, null, v_uid, 'grade');

  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
  values (
    v_uid, 'management_grade_submission', 'submissions', p_submission_id,
    jsonb_build_object('points', p_points)
  );

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', p_submission_id, 'points', p_points));
end;
$$;

create or replace function public.management_enroll_student(
  p_course_id bigint, p_identifier text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     bigint := public.current_user_id();
  v_student bigint;
  v_name    text;
begin
  if v_uid is null or not public.is_owner()
     or not exists (select 1 from public.courses where id = p_course_id) then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;

  select id, name into v_student, v_name
  from public.users
  where role = 'student' and is_active = true
    and (lower(coalesce(email, '')) = lower(btrim(coalesce(p_identifier, '')))
      or lower(coalesce(university_id, '')) = lower(btrim(coalesce(p_identifier, '')))
      or lower(coalesce(platform_id, '')) = lower(btrim(coalesce(p_identifier, ''))))
  limit 1;

  if v_student is null then
    return jsonb_build_object('ok', false, 'error', 'لم يُعثر على طالب بهذا المعرّف');
  end if;

  insert into public.enrollments (course_id, student_id, status)
  values (p_course_id, v_student, 'active')
  on conflict (course_id, student_id) do update set status = 'active';

  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
  values (
    v_uid, 'management_enroll_student', 'enrollments', v_student,
    jsonb_build_object('course_id', p_course_id)
  );

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', v_student, 'name', v_name));
end;
$$;

create or replace function public.management_set_attendance(
  p_lecture_id bigint, p_open boolean, p_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid bigint := public.current_user_id();
begin
  if v_uid is null or not public.is_owner()
     or not exists (select 1 from public.lectures where id = p_lecture_id) then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;

  update public.lectures
     set attendance_open = coalesce(p_open, false),
         attendance_code = case when p_open then nullif(btrim(coalesce(p_code, '')), '') else attendance_code end
   where id = p_lecture_id;

  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
  values (
    v_uid, 'management_set_attendance', 'lectures', p_lecture_id,
    jsonb_build_object('open', p_open)
  );

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', p_lecture_id));
end;
$$;

create or replace function public.management_post_announcement(
  p_course_id bigint, p_title text, p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid bigint := public.current_user_id();
  v_id  bigint;
begin
  if v_uid is null or not public.is_owner()
     or not exists (select 1 from public.courses where id = p_course_id) then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  if nullif(btrim(coalesce(p_title, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'عنوان الإعلان مطلوب');
  end if;

  insert into public.notifications (audience, course_id, title, body, link, created_by, type)
  values ('course', p_course_id, btrim(p_title),
          nullif(btrim(coalesce(p_body, '')), ''), null, v_uid, 'announcement')
  returning id into v_id;

  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
  values (v_uid, 'management_post_announcement', 'notifications', v_id, jsonb_build_object('course_id', p_course_id));

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', v_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- 10) الصلاحيات: authenticated للبيانات، service_role لحارس JWT فقط
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'management_allocate_platform_id(text,text)',
    'management_create_user_profile(uuid,text,text,text,text,text,text,smallint,text,text,text)',
    'management_update_user(bigint,text,text,text,text,text,text,text,smallint,text,text)',
    'management_set_user_active(bigint,boolean)',
    'management_flag_password_change(bigint,boolean)',
    'management_preflight_delete_user(bigint)',
    'management_delete_user_finalize(bigint,uuid)',
    'management_update_course(bigint,text,text,text,boolean,text,smallint,numeric,numeric,numeric,bigint,text)',
    'management_preflight_delete_course(bigint)',
    'management_delete_course(bigint)',
    'management_change_student_track(bigint,text,smallint,boolean)',
    'management_enroll_student_in_track(bigint,text,smallint)',
    'management_transfer_student(bigint,bigint,bigint)',
    'management_set_enrollment_status(bigint,bigint,text)',
    'management_remove_enrollment(bigint,bigint)',
    'management_create_course(text,text,text,text,smallint,text,numeric,numeric,numeric,bigint)',
    'management_assign_course_teacher(bigint,bigint)',
    'management_add_lecture(bigint,text,text,text,timestamptz,integer,text,text)',
    'management_create_exam(bigint,text,text,text,timestamptz,timestamptz,integer,boolean)',
    'management_grade_submission(bigint,numeric,text)',
    'management_enroll_student(bigint,text)',
    'management_set_attendance(bigint,boolean,text)',
    'management_post_announcement(bigint,text,text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

revoke all on function public.is_owner_by_auth_uid(uuid) from public, anon, authenticated;
grant execute on function public.is_owner_by_auth_uid(uuid) to service_role;

notify pgrst, 'reload schema';

commit;

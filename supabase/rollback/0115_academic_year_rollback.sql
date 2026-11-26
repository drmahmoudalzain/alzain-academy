-- ============================================================
-- 0115_academic_year_rollback.sql
-- التراجع الكامل عن ترحيل العام الدراسي والفصلان.
-- يُعيد مفتاح enrollments وتواقيع الدوال الست إلى حالة 0114.
-- ============================================================

begin;

-- القيم الافتراضية تعتمد على دوال الفترة؛ تُزال أولاً.
alter table public.enrollments alter column year_id drop default;
alter table public.enrollments alter column semester_id drop default;

drop function if exists public.management_enroll_student(bigint, text);
drop function if exists public.management_change_student_track(bigint, text, smallint, boolean);
drop function if exists public.management_enroll_student_in_track(bigint, text, smallint);
drop function if exists public.management_transfer_student(bigint, bigint, bigint);
drop function if exists public.management_set_enrollment_status(bigint, bigint, text);
drop function if exists public.management_remove_enrollment(bigint, bigint);
drop function if exists public.current_semester_id(smallint);
drop function if exists public.current_academic_year_id();

alter table public.enrollments drop constraint if exists enrollments_period_fkey;
drop index if exists public.idx_enrollments_period;
drop index if exists public.idx_enrollments_student_period;
drop index if exists public.idx_results_student_period;
drop index if exists public.idx_results_course_period;
drop index if exists public.idx_graduation_approvals_year;
drop table if exists public.graduation_approvals;
drop table if exists public.course_semester_results;
drop table if exists public.academic_policies;
drop table if exists public.semesters;
drop table if exists public.academic_years;

alter table public.enrollments drop column if exists semester_id;
alter table public.enrollments drop column if exists year_id;
alter table public.enrollments drop constraint if exists enrollments_pkey;
alter table public.enrollments
  add constraint enrollments_pkey primary key (course_id, student_id);

drop index if exists public.idx_users_academic_status;
alter table public.users drop column if exists academic_status;

-- ---------------------------------------------------------------------------
-- إعادة التواقيع السابقة كما كانت في 0114
-- ---------------------------------------------------------------------------
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

do $$
declare f text;
begin
  foreach f in array array[
    'management_enroll_student(bigint,text)',
    'management_change_student_track(bigint,text,smallint,boolean)',
    'management_enroll_student_in_track(bigint,text,smallint)',
    'management_transfer_student(bigint,bigint,bigint)',
    'management_set_enrollment_status(bigint,bigint,text)',
    'management_remove_enrollment(bigint,bigint)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

notify pgrst, 'reload schema';

commit;

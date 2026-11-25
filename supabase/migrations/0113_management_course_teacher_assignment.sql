-- ============================================================
-- 0113_management_course_teacher_assignment.sql
-- استكمال قرار 0112: الإدارة وحدها تملك إنشاء المقررات وتعديلها،
-- ولها كذلك إسناد المقرر إلى أستاذ نشط حتى يتمكن الأستاذ من
-- إنشاء الواجبات في مقرراته فقط عبر teacher_create_assignment.
--
-- لا يُمنح الأستاذ أي صلاحية إسناد: الدوال كلها محمية بـ is_owner().
-- ============================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) إنشاء مقرر مع أستاذ مسؤول اختياري (الافتراضي: المالك نفسه)
-- ---------------------------------------------------------------------------
drop function if exists public.management_create_course(
  text, text, text, text, smallint, text, numeric, numeric, numeric
);

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
  v_id bigint;
  v_code text := btrim(coalesce(p_code, ''));
  v_teacher bigint;
begin
  if public.current_user_id() is null or not public.is_owner() then
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

  v_teacher := coalesce(p_teacher_id, public.current_user_id());
  if not exists (
    select 1 from users u
    where u.id = v_teacher and u.role = 'teacher' and u.is_active = true
  ) then
    return jsonb_build_object('ok', false, 'error', 'الأستاذ المسؤول غير صالح');
  end if;

  insert into courses (teacher_id, title, code, description, color, track, level,
                       attendance_weight, exams_weight, assignments_weight)
  values (v_teacher, btrim(p_title), v_code,
          nullif(btrim(coalesce(p_description,'')), ''),
          coalesce(nullif(btrim(coalesce(p_color,'')), ''), '#123A63'), p_track, p_level,
          p_attendance_weight, p_exams_weight, p_assignments_weight)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', v_id, 'code', v_code, 'teacher_id', v_teacher));
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) تعديل مقرر مع إمكانية تغيير الأستاذ المسؤول
-- ---------------------------------------------------------------------------
drop function if exists public.management_update_course(
  bigint, text, text, text, boolean, text, smallint, numeric, numeric, numeric
);

create or replace function public.management_update_course(
  p_course_id bigint, p_title text, p_description text default null,
  p_color text default null, p_archived boolean default null,
  p_track text default null, p_level smallint default null,
  p_attendance_weight numeric default null, p_exams_weight numeric default null,
  p_assignments_weight numeric default null,
  p_teacher_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_teacher bigint;
  v_teacher bigint;
begin
  if public.current_user_id() is null or not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;

  select teacher_id into v_current_teacher from courses where id = p_course_id;
  if v_current_teacher is null then
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

  v_teacher := coalesce(p_teacher_id, v_current_teacher);
  if not exists (
    select 1 from users u
    where u.id = v_teacher and u.role = 'teacher' and u.is_active = true
  ) then
    return jsonb_build_object('ok', false, 'error', 'الأستاذ المسؤول غير صالح');
  end if;

  update courses set
    teacher_id = v_teacher,
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

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', p_course_id, 'teacher_id', v_teacher));
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) إسناد مقرر قائم إلى أستاذ آخر دون تغيير بياناته الأخرى
-- ---------------------------------------------------------------------------
create or replace function public.management_assign_course_teacher(
  p_course_id bigint, p_teacher_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher bigint;
begin
  if public.current_user_id() is null or not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  if not exists (select 1 from courses where id = p_course_id) then
    return jsonb_build_object('ok', false, 'error', 'المقرر غير موجود');
  end if;
  if p_teacher_id is null or not exists (
    select 1 from users u
    where u.id = p_teacher_id and u.role = 'teacher' and u.is_active = true
  ) then
    return jsonb_build_object('ok', false, 'error', 'الأستاذ المسؤول غير صالح');
  end if;

  update courses set teacher_id = p_teacher_id where id = p_course_id;
  v_teacher := p_teacher_id;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', p_course_id, 'teacher_id', v_teacher));
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) الصلاحيات
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'management_create_course(text,text,text,text,smallint,text,numeric,numeric,numeric,bigint)',
    'management_update_course(bigint,text,text,text,boolean,text,smallint,numeric,numeric,numeric,bigint)',
    'management_assign_course_teacher(bigint,bigint)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

notify pgrst, 'reload schema';

commit;

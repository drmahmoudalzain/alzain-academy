-- ============================================================
-- 0114_owner_full_management_rollback.sql
-- التراجع عن ترحيل إدارة المالك الكاملة.
-- يُعيد توقيع management_update_course المعتمد في 0113.
-- ============================================================

begin;

drop function if exists public.is_owner_by_auth_uid(uuid);
drop function if exists public.management_allocate_platform_id(text, text);
drop function if exists public.management_create_user_profile(uuid, text, text, text, text, text, text, smallint, text, text, text);
drop function if exists public.management_update_user(bigint, text, text, text, text, text, text, text, smallint, text, text);
drop function if exists public.management_set_user_active(bigint, boolean);
drop function if exists public.management_flag_password_change(bigint, boolean);
drop function if exists public.management_preflight_delete_user(bigint);
drop function if exists public.management_delete_user_finalize(bigint, uuid);
drop function if exists public.management_update_course(bigint, text, text, text, boolean, text, smallint, numeric, numeric, numeric, bigint, text);
drop function if exists public.management_preflight_delete_course(bigint);
drop function if exists public.management_delete_course(bigint);
drop function if exists public.management_change_student_track(bigint, text, smallint, boolean);
drop function if exists public.management_enroll_student_in_track(bigint, text, smallint);
drop function if exists public.management_transfer_student(bigint, bigint, bigint);
drop function if exists public.management_set_enrollment_status(bigint, bigint, text);
drop function if exists public.management_remove_enrollment(bigint, bigint);
drop function if exists public.management_link_auth_id(bigint, uuid);
drop function if exists public.management_log_auth_delete(bigint, uuid);

-- إعادة التوقيع السابق المُسقَط في 0114 (السلوك كما في 0113، بلا سجل تدقيق جديد)
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

  select teacher_id into v_current_teacher from public.courses where id = p_course_id;
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
    select 1 from public.users u
    where u.id = v_teacher and u.role = 'teacher' and u.is_active = true
  ) then
    return jsonb_build_object('ok', false, 'error', 'الأستاذ المسؤول غير صالح');
  end if;

  update public.courses set
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
    'management_link_auth_id(bigint,uuid)',
    'management_log_auth_delete(bigint,uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

notify pgrst, 'reload schema';

commit;

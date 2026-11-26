-- ============================================================
-- 0127_optional_user_email.sql
-- جعل «البريد للمراسلة» اختيارياً في management_create_user_profile:
--   - الاسم فقط مطلوب.
--   - بريد فارغ/null يُخزَّن null ولا يُفحص uniqueness.
-- ============================================================

begin;

create or replace function public.management_create_user_profile(
  p_auth_id uuid, p_platform_id text, p_name text, p_email text,
  p_role text, p_phone text default null, p_track text default null,
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
  if nullif(btrim(coalesce(p_name, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'الاسم مطلوب');
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
  if v_email <> '' and exists (select 1 from public.users u where lower(u.email) = v_email) then
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
    v_role, btrim(p_name), nullif(v_email, ''),
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

notify pgrst, 'reload schema';

commit;
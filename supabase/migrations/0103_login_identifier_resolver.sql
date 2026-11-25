-- ============================================================
-- 0103_login_identifier_resolver.sql
-- يحوّل الرقم الأكاديمي / الرمز الوظيفي إلى بريد Supabase Auth.
-- يُستخدم في بوابة الطلاب قبل signInWithPassword.
-- ============================================================

begin;

create or replace function public.login_email_for_identifier(p_identifier text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_input text := lower(trim(coalesce(p_identifier, '')));
  v_role  text;
  v_pid   text;
begin
  if v_input = '' then
    return null;
  end if;

  -- بريد صريح: يُمرَّر كما هو
  if position('@' in v_input) > 0 then
    return v_input;
  end if;

  select u.role, lower(u.platform_id)
    into v_role, v_pid
  from public.users u
  where upper(u.platform_id) = upper(v_input)
    and u.is_active = true
  limit 1;

  if v_pid is null then
    return null;
  end if;

  return v_pid || case
    when v_role = 'student' then '@students.local'
    else '@staff.local'
  end;
end;
$$;

revoke all on function public.login_email_for_identifier(text) from public;
grant execute on function public.login_email_for_identifier(text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;

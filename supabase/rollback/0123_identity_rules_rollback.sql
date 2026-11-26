-- ============================================================
-- 0123_identity_rules_rollback.sql
-- يزيل كائنات 0123 فقط: الدالتان وجدول سجل المحاولات ومنحهما.
-- لا حذف لأي صف في users أو audit_logs، ولا إعادة تعيين لأقفال قائمة.
-- ============================================================

begin;

do $$
begin
  if exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'auth_login_guard_check'
       and pg_get_function_identity_arguments(p.oid) = 'p_identifier text'
  ) then
    revoke all on function public.auth_login_guard_check(text) from service_role;
  end if;

  if exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'auth_record_login_attempt'
       and pg_get_function_identity_arguments(p.oid) = 'p_identifier text, p_success boolean, p_reason text'
  ) then
    revoke all on function public.auth_record_login_attempt(text, boolean, text) from service_role;
  end if;

  if exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'auth_record_login_attempt'
       and pg_get_function_identity_arguments(p.oid) = 'p_identifier text, p_success boolean'
  ) then
    revoke all on function public.auth_record_login_attempt(text, boolean) from service_role;
  end if;

  if to_regclass('public.login_attempts_log') is not null then
    revoke all on public.login_attempts_log from service_role;
  end if;
end $$;

drop function if exists public.auth_login_guard_check(text);
drop function if exists public.auth_record_login_attempt(text, boolean, text);
drop function if exists public.auth_record_login_attempt(text, boolean);
drop table if exists public.login_attempts_log;

notify pgrst, 'reload schema';

commit;

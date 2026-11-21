-- ============================================================
-- 0100_auth_bridge_checks.sql — فحص قراءة فقط بعد تطبيق 0100
-- التشغيل: node scripts/run-sql.mjs supabase/verify/0100_auth_bridge_checks.sql
-- ============================================================

select jsonb_pretty(jsonb_build_object(
  'auth_id_column', exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'auth_id'
  ),
  'auth_id_unique', exists (
    select 1 from pg_constraint
    where conrelid = 'public.users'::regclass and conname = 'users_auth_id_key'
  ),
  'auth_id_fk', exists (
    select 1 from pg_constraint
    where conrelid = 'public.users'::regclass and conname = 'users_auth_id_fkey'
  ),
  'auth_id_index', exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'idx_users_auth_id'
  ),
  'audit_logs_table', to_regclass('public.audit_logs') is not null,
  'audit_logs_rls', coalesce((
    select relrowsecurity from pg_class
    where oid = to_regclass('public.audit_logs')
  ), false),
  'helper_functions', (
    select count(*) from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in (
        'current_user_id', 'current_user_role', 'is_active_user', 'is_owner',
        'is_teacher', 'is_assistant', 'is_student', 'teaches_course',
        'is_enrolled', 'is_self_or_owner'
      )
  ),
  'users_total', (select count(*) from public.users),
  'users_linked', (select count(*) from public.users where auth_id is not null),
  'users_unlinked', (select count(*) from public.users where auth_id is null)
));

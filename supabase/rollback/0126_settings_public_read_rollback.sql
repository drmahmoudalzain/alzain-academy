-- 0126_settings_public_read_rollback.sql
begin;
drop policy if exists settings_select_public on public.settings;
notify pgrst, 'reload schema';
commit;
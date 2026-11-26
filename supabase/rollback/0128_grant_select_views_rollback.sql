-- 0128_grant_select_views_rollback.sql
begin;
revoke select on public.lectures from authenticated;
revoke select on public.settings from authenticated;
notify pgrst, 'reload schema';
commit;
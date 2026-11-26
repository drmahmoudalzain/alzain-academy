-- 0129_management_delete_lecture_rollback.sql
begin;
drop function if exists public.management_delete_lecture(bigint);
notify pgrst, 'reload schema';
commit;

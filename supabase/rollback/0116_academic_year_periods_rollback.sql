-- ============================================================
-- 0116_academic_year_periods_rollback.sql
-- التراجع عن دوال معاينة وإغلاق العام الدراسي.
-- لا تُحذف جداول 0115 ولا تسجيلات الطلاب.
-- ============================================================

begin;

drop function if exists public.academic_preview_close_year(bigint);
drop function if exists public.academic_close_year_and_open_next(text, text, text, boolean);

notify pgrst, 'reload schema';

commit;

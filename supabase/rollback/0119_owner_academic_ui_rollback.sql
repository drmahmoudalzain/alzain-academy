-- ============================================================
-- 0119_owner_academic_ui_rollback.sql
-- إزالة دوال واجهة إدارة العام للمالك. لا تُحذف النتائج ولا التسجيلات
-- ولا الحالات الأكاديمية التي أنشأتها الدوال أثناء تشغيلها.
-- ============================================================

begin;

drop function if exists public.academic_owner_list_course_results(bigint, bigint, text);
drop function if exists public.academic_owner_list_graduation_candidates(bigint);
drop function if exists public.academic_owner_enroll_in_semester(bigint, bigint, bigint, text, smallint);
drop function if exists public.academic_owner_set_academic_status(bigint, text, text);

notify pgrst, 'reload schema';

commit;

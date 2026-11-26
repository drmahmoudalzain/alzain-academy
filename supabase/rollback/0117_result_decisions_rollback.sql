-- ============================================================
-- 0117_result_decisions_rollback.sql
-- التراجع عن دوال نتائج المقررات وقرارات المالك وتوصية الأستاذ.
-- لا تُحذف النتائج ولا الموافقات المُنتَجة أثناء تشغيل الدوال.
-- ============================================================

begin;

drop function if exists public.academic_rebuild_course_results(bigint);
drop function if exists public.academic_owner_decide_course_result(bigint, text, text);
drop function if exists public.academic_owner_decide_graduation(bigint, bigint, text, text);
drop function if exists public.academic_open_second_semester(bigint);
drop function if exists public.teacher_record_result_recommendation(bigint, text);

notify pgrst, 'reload schema';

commit;

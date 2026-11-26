-- ============================================================
-- 0120_teacher_result_read_rollback.sql
-- إزالة دالة قراءة نتائج الأستاذ فقط. لا تُحذف التوصيات المسجّلة.
-- ============================================================

begin;

drop function if exists public.teacher_list_my_course_results(bigint, bigint);

notify pgrst, 'reload schema';

commit;

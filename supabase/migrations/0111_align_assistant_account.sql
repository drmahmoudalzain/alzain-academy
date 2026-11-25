-- ============================================================
-- 0111_align_assistant_account.sql
-- زر «المساعد الإداري» في صفحة الدخول يستخدم الحساب TE0003.
-- كان دوره teacher في users فيفتح بوابة الأستاذ بدل بوابة المساعد.
-- نضبط الدور وعلم is_staff ليطابقا التسمية والبوابة المخصصة.
-- ============================================================

begin;

update public.users
   set role = 'assistant',
       is_staff = true
 where platform_id = 'TE0003'
   and role = 'teacher';

notify pgrst, 'reload schema';

commit;

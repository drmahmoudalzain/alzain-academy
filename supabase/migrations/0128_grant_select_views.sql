-- ============================================================
-- 0128_grant_select_views.sql
-- منح SELECT على الجداول الأساسية لـ authenticated، لأن views
-- (security_invoker=true) تتطلب صلاحية SELECT على الجدول الأصلي.
-- سياسات RLS تبقى مسؤولة عن تصفية الصفوف.
-- ============================================================

begin;

grant select on public.settings to authenticated;
grant select on public.lectures to authenticated;

notify pgrst, 'reload schema';

commit;
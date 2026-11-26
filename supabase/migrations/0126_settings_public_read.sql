-- ============================================================
-- 0126_settings_public_read.sql
-- تمكين قراءة settings_public (security_invoker) للمستخدمين المصادقين
-- (باستثناء ai_api_key). الإعدادات غير السرية (platform_name, ai_model, ...)
-- مخصصة للقراءة من الواجهة (لوحة المالك/المساعد).
-- ============================================================

begin;

drop policy if exists settings_select_public on public.settings;
create policy settings_select_public on public.settings
  for select to authenticated
  using (key <> 'ai_api_key');

notify pgrst, 'reload schema';

commit;
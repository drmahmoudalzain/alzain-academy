-- ============================================================
-- حالة التسجيل داخل المقرر (توقيف/إعادة تنشيط بلا إيقاف الحساب)
-- 0011_enrollment_status.sql
-- ============================================================
-- التوقيف هنا يخص مقرراً واحداً فقط، ولا يلمس users.is_active
-- (الإيقاف العام للحساب يبقى من صلاحية المالك في صفحة المستخدمين).
-- ============================================================

begin;

alter table public.enrollments
  add column if not exists status text not null default 'active'
  check (status in ('active', 'suspended'));

-- جميع التسجيلات الموجودة تصبح نشطة تلقائياً بالقيمة الافتراضية
update public.enrollments set status = 'active' where status is null;

create index if not exists idx_enrollments_status
  on public.enrollments (course_id, status);

commit;

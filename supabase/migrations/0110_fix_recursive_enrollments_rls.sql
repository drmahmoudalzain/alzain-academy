-- ============================================================
-- 0110_fix_recursive_enrollments_rls.sql
-- يكسر حلقة سياسات RLS بين enrollments و courses التي تمنع
-- قراءة جدول users للمستخدم المصادّق عليه (42P17)، فيُرسَل الجميع
-- إلى بوابة الطالب عبر الملف الاحتياطي في الواجهة.
-- ============================================================

begin;

-- دالة آمنة تتحقق من ملكية المقرر دون تطبيق سياسة RLS على courses،
-- فتقطع الحلقة: enrollments -> courses -> enrollments.
create or replace function public.course_taught_by_current_user(p_course_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.courses c
    where c.id = p_course_id
      and c.teacher_id = public.current_user_id()
  );
$$;

revoke all on function public.course_taught_by_current_user(bigint) from public, anon, authenticated;
grant execute on function public.course_taught_by_current_user(bigint) to authenticated, service_role;

-- النسخة الوحيدة التي كانت تُطبّق RLS على courses من داخل سياسة enrollments.
drop policy if exists enrollments_select on public.enrollments;
create policy enrollments_select on public.enrollments
  for select to authenticated
  using (
    student_id = public.current_user_id()
    or public.is_owner()
    or public.is_assistant()
    or public.course_taught_by_current_user(course_id)
  );

notify pgrst, 'reload schema';

commit;

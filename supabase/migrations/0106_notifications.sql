-- 0106_notifications.sql
-- صفحة الإشعارات: أنواع الإشعارات + حالة لكل مستخدم (قراءة/تمييز/إخفاء)
-- + دالة قراءة واحدة تُرجع ما يحقّ للمستخدم رؤيته مع اسم المُرسِل.

begin;

-- ---------------------------------------------------------------------------
-- 1) نوع الإشعار
-- ---------------------------------------------------------------------------
alter table public.notifications
  add column if not exists type text not null default 'system';

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in ('announcement', 'course', 'exam', 'assignment', 'message', 'system', 'grade'));

create index if not exists notifications_created_at_idx
  on public.notifications (created_at desc);

-- ---------------------------------------------------------------------------
-- 2) حالة المستخدم: قراءة + تمييز + إخفاء
--    وجود الصف لا يعني "مقروء" — القراءة يحدّدها read_at.
-- ---------------------------------------------------------------------------
alter table public.notification_reads
  add column if not exists starred boolean not null default false,
  add column if not exists dismissed_at timestamptz;

alter table public.notification_reads
  alter column read_at drop not null;

alter table public.notification_reads
  alter column read_at drop default;

create index if not exists notification_reads_user_idx
  on public.notification_reads (user_id);

grant select, insert, update, delete on public.notification_reads to authenticated;

drop policy if exists notification_reads_insert on public.notification_reads;
create policy notification_reads_insert on public.notification_reads
  for insert to authenticated
  with check (user_id = public.current_user_id());

drop policy if exists notification_reads_update on public.notification_reads;
create policy notification_reads_update on public.notification_reads
  for update to authenticated
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

drop policy if exists notification_reads_delete on public.notification_reads;
create policy notification_reads_delete on public.notification_reads
  for delete to authenticated
  using (user_id = public.current_user_id());

-- ---------------------------------------------------------------------------
-- 3) تضييق قراءة الجدول المباشرة
--    سياسة 0101 كانت تمنح كل أستاذ رؤية إشعارات جميع المستخدمين.
--    هنا تُطابق سياسة القراءة قواعد الدالة أدناه.
--    دالة مساعدة SECURITY DEFINER تتجاوز RLS على enrollments/courses؛
--    الاستعلام المباشر داخل السياسة يسبب recursion مع سياسات تلك الجداول.
-- ---------------------------------------------------------------------------
create or replace function public.can_see_course_notification(p_course_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_course_id is not null and (
    exists (
      select 1 from public.enrollments e
      where e.course_id = p_course_id
        and e.student_id = public.current_user_id()
    )
    or exists (
      select 1 from public.courses c
      where c.id = p_course_id
        and c.teacher_id = public.current_user_id()
    )
  );
$$;

revoke all on function public.can_see_course_notification(bigint) from public, anon;
grant execute on function public.can_see_course_notification(bigint) to authenticated;

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (
    public.is_owner()
    or public.is_assistant()
    or audience = 'all'
    or (audience = 'user' and user_id = public.current_user_id())
    or (audience = 'course' and public.can_see_course_notification(course_id))
  );

-- ---------------------------------------------------------------------------
-- 4) قراءة الإشعارات في استعلام واحد
--    يعيد فقط الإشعارات التي يحقّ للمستخدم رؤيتها، مع اسم المُرسِل وحالة القراءة.
-- ---------------------------------------------------------------------------
create or replace function public.my_notifications()
returns table (
  id           bigint,
  type         text,
  title        text,
  body         text,
  link         text,
  audience     text,
  course_id    bigint,
  course_title text,
  creator_name text,
  created_at   timestamptz,
  is_read      boolean,
  is_starred   boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    n.id,
    n.type,
    n.title,
    n.body,
    n.link,
    n.audience,
    n.course_id,
    c.title as course_title,
    coalesce(u.name, 'إدارة الأكاديمية') as creator_name,
    n.created_at,
    (r.read_at is not null) as is_read,
    coalesce(r.starred, false) as is_starred
  from public.notifications n
  left join public.notification_reads r
    on r.notification_id = n.id
   and r.user_id = public.current_user_id()
  left join public.courses c on c.id = n.course_id
  left join public.users u on u.id = n.created_by
  where public.current_user_id() is not null
    and r.dismissed_at is null
    and (
      public.is_owner()
      or public.is_assistant()
      or n.audience = 'all'
      or (n.audience = 'user' and n.user_id = public.current_user_id())
      or (n.audience = 'course' and public.can_see_course_notification(n.course_id))
    )
  order by n.created_at desc;
$$;

revoke all on function public.my_notifications() from public, anon;
grant execute on function public.my_notifications() to authenticated;

notify pgrst, 'reload schema';

commit;

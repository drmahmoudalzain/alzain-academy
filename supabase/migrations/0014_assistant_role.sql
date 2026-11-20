-- ============================================================
-- 0014 — دور مستقل للمساعد الإداري (عرض + تصدير فقط)
-- لا يُضاف إلى الطلاب ولا إلى الأساتذة، ولا يرث صلاحيات أي منهما.
-- ============================================================

begin;

alter table public.users drop constraint if exists users_role_check;
alter table public.users
  add constraint users_role_check
  check (role in ('teacher', 'student', 'assistant'));

commit;

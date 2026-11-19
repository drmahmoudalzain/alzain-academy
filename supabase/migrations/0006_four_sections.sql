-- ============================================================
-- 0006 — الأقسام الأكاديمية الأربعة
-- ============================================================

begin;

-- 1) اسحب القيد القديم أولاً ثم رحّل البيانات ثم أضف القيد الجديد
alter table public.users drop constraint if exists users_track_check;
update public.users set track = 'bachelor_m' where track = 'bachelor';
alter table public.users add constraint users_track_check
  check (track in ('bachelor_m', 'bachelor_f', 'equiv', 'external', 'grad'));
alter table public.users alter column track set default 'bachelor_m';

-- 2) نفس الشيء للمقررات
alter table public.courses drop constraint if exists courses_track_check;
update public.courses set track = 'bachelor_m' where track = 'bachelor';
alter table public.courses add constraint courses_track_check
  check (track in ('bachelor_m', 'bachelor_f', 'equiv', 'external', 'grad'));
alter table public.courses alter column track set default 'bachelor_m';

commit;

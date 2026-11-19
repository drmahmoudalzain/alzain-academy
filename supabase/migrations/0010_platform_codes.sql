-- ============================================================
-- الرمز الموحّد للمنصة (Platform Code) + الإقفال التلقائي للحساب
-- 0010_platform_codes.sql
-- ============================================================
-- 1) أعمدة جديدة: الرمز الموحد + عدّاد المحاولات الفاشلة + قفل مؤقت
-- 2) توليد رموز للحسابات القائمة حسب الدور/المسار
--    المالك: AD0001 · بقية الأساتذة: TE0001.. · طلاب: BM/BF/EQ/EX/PG تسلسلي
-- 3) فهرس فريد غير حساس للحالة
-- 4) إسقاط خزنة كلمات المرور النصية نهائياً (التوصية: لا تُخزَّن الكلمة صريحة)
-- ============================================================

begin;

alter table public.users
  add column if not exists platform_id text,
  add column if not exists failed_attempts integer not null default 0,
  add column if not exists locked_until timestamptz;

-- ---------- رموز الأساتذة/المالك ----------
with t as (
  select id, row_number() over (order by id) as rn
  from public.users
  where role = 'teacher'
)
update public.users u
set platform_id = (case when t.rn = 1 then 'AD' else 'TE' end)
                || lpad((case when t.rn = 1 then 1 else t.rn - 1 end)::text, 4, '0')
from t
where t.id = u.id
  and u.platform_id is null;

-- ---------- رموز الطلاب حسب المسار ----------
with s as (
  select id,
         track,
         row_number() over (partition by track order by id) as rn
  from public.users
  where role = 'student'
)
update public.users u
set platform_id = (case s.track
                     when 'bachelor_m' then 'BM'
                     when 'bachelor_f' then 'BF'
                     when 'equiv'      then 'EQ'
                     when 'external'   then 'EX'
                     when 'grad'       then 'PG'
                     else 'BM'
                   end)
                || lpad(s.rn::text, 4, '0')
from s
where s.id = u.id
  and u.platform_id is null;

-- أي مستخدم لم يحصل على رمز (بيانات غير متوقعة) يأخذ BM تسلسلياً احتياطياً
with x as (
  select id, row_number() over (order by id) as rn
  from public.users
  where platform_id is null
)
update public.users u
set platform_id = 'BM' || lpad(rn::text, 4, '0')
from x
where u.id = x.id;

-- ---------- فهرس فريد غير حساس لحالة الأحرف ----------
create unique index if not exists users_platform_id_lower_key
  on public.users (lower(platform_id))
  where platform_id is not null;

-- ---------- الإطاحة بخزنة كلمات المرور النصية ----------
drop table if exists public.credentials_vault;

commit;

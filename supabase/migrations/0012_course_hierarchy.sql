-- ============================================================
-- 0012 — هيكل المقرر الأصلي وفروعه (طلاب / طالبات) + المقررات الحقيقية
-- ============================================================

begin;

-- 1) ربط المقرر الفرعي بالمقرر الأصلي. حذف الأصل يحذف فروعه تلقائياً.
alter table public.courses
  add column if not exists parent_course_id bigint references public.courses(id) on delete cascade;

create index if not exists idx_courses_parent
  on public.courses (parent_course_id);

-- 2) مسار «بكالوريوس مشترك» للمقرر الأصل الذي يحضره الطلاب والطالبات معاً.
alter table public.courses drop constraint if exists courses_track_check;
alter table public.courses add constraint courses_track_check
  check (track in ('bachelor', 'bachelor_m', 'bachelor_f', 'equiv', 'external', 'grad'));

-- 3) إزالة المقررات الافتراضية وما عليها من مواد تجريبية (حذف متسلسل).
delete from public.courses where id between 8 and 14;

-- 4) المقررات الحقيقية، لكل مقرر أصل فرعان: طلاب وطالبات.
with parents(title, code, level) as (
  values
    ('مدخل العلوم القانونية', 'LAW110', 1),
    ('القانون الجنائي العام', 'LAW211', 2),
    ('القانون الدستوري', 'LAW212', 2),
    ('القانون الجنائي الخاص', 'LAW311', 3),
    ('قانون الإجراءات الجنائية', 'LAW312', 3),
    ('قانون الإجراءات المدنية', 'LAW313', 3),
    ('قانون المعاملات المدنية', 'LAW314', 3),
    ('الملكية العقارية', 'LAW411', 4),
    ('القانون الإداري', 'LAW412', 4),
    ('القانون البحري والجوي', 'LAW413', 4)
),
inserted as (
  insert into public.courses
    (teacher_id, title, code, description, color, track, level,
     attendance_weight, exams_weight, assignments_weight)
  select 1, title, code, null, '#1f4e5f', 'bachelor', level, 30, 70, 0
  from parents
  returning id, title, code, level
),
branches as (
  insert into public.courses
    (teacher_id, title, code, track, level, parent_course_id,
     attendance_weight, exams_weight, assignments_weight)
  select 1, inserted.title || ' — طلاب', inserted.code || '-M', 'bachelor_m', inserted.level, inserted.id, 30, 70, 0 from inserted
  union all
  select 1, inserted.title || ' — طالبات', inserted.code || '-F', 'bachelor_f', inserted.level, inserted.id, 30, 70, 0 from inserted
  returning id
)
select count(*)::int as branches_created from branches;

commit;

-- تصحيح نتيجة زر «تسجيل الكل» التي سجّلت كل المستويات في مقرر المستوى الثاني.
-- يعاد التسجيل ليشمل طلاب/طالبات المستوى 2 فقط: الأصل + فرع الجنس الخاص بكل طالب.
-- (زر الطوارئ برمز الطالب يبقى الاستثناء المقصود لأي مستوى أو مقرر.)

delete from public.enrollments where course_id in (18, 19, 37);

insert into public.enrollments (course_id, student_id, status)
select 18, u.id, 'active'
from public.users u
where u.role = 'student'
  and u.is_active = true
  and u.level = 2
  and u.track in ('bachelor_m', 'bachelor_f');

insert into public.enrollments (course_id, student_id, status)
select 19, u.id, 'active'
from public.users u
where u.role = 'student'
  and u.is_active = true
  and u.level = 2
  and u.track = 'bachelor_m';

insert into public.enrollments (course_id, student_id, status)
select 37, u.id, 'active'
from public.users u
where u.role = 'student'
  and u.is_active = true
  and u.level = 2
  and u.track = 'bachelor_f';

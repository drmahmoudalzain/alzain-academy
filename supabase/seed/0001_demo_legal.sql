-- ============================================================
-- بذر بيانات قانونية تجريبية (للتجربة فقط) — idempotent
-- الأكاديمية: آل الزين للعلوم القانونية والعدلية
-- ============================================================

begin;

-- ---------- المقررات ----------
insert into public.courses (teacher_id, title, code, description, color, level, track, attendance_weight, exams_weight, assignments_weight)
select t.id, v.title, v.code, v.description, v.color, v.level, v.track, v.att, v.exm, v.asg
from (values
  ('مبادئ القانون العام',   'LAW101', 'مدخل إلى التفكير القانوني وأنواعه ومصادره — أساس التخصص كله.', '#123A63', 1, 'bachelor', 10, 60, 30),
  ('القانون الدستوري',      'LAW102', 'الدولة والدستور والسلطات العامة والحريات العامة.',            '#166E3F', 1, 'bachelor', 10, 60, 30),
  ('القانون المدني',        'LAW201', 'نظرية الالتزام: أركانه ومصادره وآثاره وانقضاؤه.',              '#B5870F', 2, 'bachelor', 10, 60, 30),
  ('قانون العقوبات',        'LAW202', 'الجريمة والعقوبة: الأركان، المسؤولية، الجزاء الجنائي.',        '#1B4A7A', 2, 'bachelor', 10, 60, 30),
  ('القانون التجاري',       'LAW301', 'الأعمال التجارية، التاجر، الشركات، الأوراق التجارية.',         '#0B2545', 3, 'bachelor', 10, 60, 30),
  ('أصول المرافعات',        'LAW302', 'الدعوى، الخصومة، إجراءات التقاضي في القضايا المدنية.',         '#2A5F94', 3, 'bachelor', 10, 60, 30)
) as v(title, code, description, color, level, track, att, exm, asg)
join public.users t on t.email = 'admin@lectures.local'
where not exists (select 1 from public.courses c where c.code = v.code);

insert into public.courses (teacher_id, title, code, description, color, level, track, attendance_weight, exams_weight, assignments_weight)
select t.id, v.title, v.code, v.description, v.color, v.level, v.track, v.att, v.exm, v.asg
from (values
  ('القانون التجاري — قسم المعادلة', 'EQ-C01', 'مسار مكثف لوحدات القانون التجاري لحملة الشهادات.', '#123A63', 1, 'equiv', 10, 60, 30)
) as v(title, code, description, color, level, track, att, exm, asg)
join public.users t on t.email = 'teacher@test.local'
where not exists (select 1 from public.courses c where c.code = v.code);

-- ---------- التسجيل (الطلاب في مقررات المستويين الأول والثاني) ----------
insert into public.enrollments (course_id, student_id)
select c.id, u.id
from public.courses c
cross join public.users u
where u.role = 'student'
  and (
    (c.code in ('LAW101', 'LAW102') and u.id between 2 and 9)
    or (c.code in ('LAW201', 'LAW202') and u.id between 2 and 9)
  )
  and not exists (select 1 from public.enrollments e where e.course_id = c.id and e.student_id = u.id);

-- ---------- المحاضرات ----------
insert into public.lectures (course_id, title, description, youtube_url, live_url, scheduled_at, duration_min, attendance_code, attendance_open, lecture_type, recording_note, status)
select c.id, v.title, v.description, v.youtube_url, v.live_url, v.scheduled_at::timestamptz, v.duration_min, v.attendance_code, v.attendance_open, v.lecture_type, v.recording_note, 'scheduled'
from (values
  ('LAW101', 'مقدمة في القانون ومصادره', 'تعريف القانون، فروعه، مصادر القانون المباشرة والاحتياطية مع تطبيقات.', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', null, '2026-10-28 18:00+03', 120, null, false, 'recorded', 'التسجيل متاح في أي وقت', 'scheduled'),
  ('LAW101', 'القانون الدستوري والمبادئ العامة — جلسة تفاعلية', 'المبادئ الدستورية العامة مع أسئلة تفاعلية خلال الجلسة.', null, null, '2026-11-21 09:00+03', 120, '445566', true, 'direct', null, 'scheduled'),
  ('LAW201', 'مصادر الالتزام في القانون المدني', 'العقد، العمل غير المشروع، الإثراء بلا سبب، القانون.', 'https://www.youtube.com/watch?v=abc12345678', null, '2026-11-04 10:00+03', 120, null, false, 'recorded', 'محاضرة مسجلة + ملخص', 'scheduled'),
  ('LAW201', 'المسؤولية المدنية والعقدية', 'عقدية وتقصيرية — الشروط والنتائج مع قضايا عملية.', null, null, '2026-11-23 10:00+03', 120, null, false, 'direct', null, 'scheduled'),
  ('LAW202', 'أركان الجريمة العامة', 'الركن الشرعي، المادي، المعنوي + الدفوع.', null, 'https://meet.example.com/law202', '2026-11-09 14:00+03', 90, null, false, 'online', null, 'scheduled'),
  ('LAW202', 'المشاركة والشروع في الجريمة', 'تعدد الفاعلين، الشروع، الإعفاء من العقاب.', 'https://www.youtube.com/watch?v=xyz98765432', null, '2026-11-16 11:00+03', 120, null, false, 'recorded', null, 'scheduled'),
  ('LAW102', 'الفصل بين السلطات في الدساتير', 'مبدأ الفصل المرن، الرقابة البرلمانية، مسؤولية الوزراء.', 'https://www.youtube.com/watch?v=sep1234567', null, '2026-11-12 09:00+03', 100, null, false, 'recorded', null, 'scheduled')
) as v(code, title, description, youtube_url, live_url, scheduled_at, duration_min, attendance_code, attendance_open, lecture_type, recording_note, status)
join public.courses c on c.code = v.code
where not exists (select 1 from public.lectures l where l.course_id = c.id and l.title = v.title);

-- ---------- الحضور للطالب 2 ----------
insert into public.attendance (lecture_id, student_id, method, code_used)
select l.id, u.id, 'manual', null
from public.lectures l
join public.users u on u.id = 2
where l.title in ('مقدمة في القانون ومصادره', 'مصادر الالتزام في القانون المدني', 'أركان الجريمة العامة', 'الفصل بين السلطات في الدساتير')
  and not exists (select 1 from public.attendance a where a.lecture_id = l.id and a.student_id = u.id);

-- ---------- أسئلة محاضرة LAW101 التفاعلية ----------
insert into public.questions (lecture_id, text, type, options, correct_index, correct_indices, is_open)
select l.id, 'ما هو أعلى أنواع التشريع في الدولة؟', 'mcq', '["الدستور","القانون العادي","النظام الفرعي","التعليمات"]'::jsonb, 0, null, true
from public.lectures l where l.title = 'القانون الدستوري والمبادئ العامة — جلسة تفاعلية'
  and not exists (select 1 from public.questions q where q.lecture_id = l.id and q.text = 'ما هو أعلى أنواع التشريع في الدولة؟');

insert into public.questions (lecture_id, text, type, options, correct_index, correct_indices, is_open)
select l.id, 'هل شرح المحاضرة كان واضحاً؟', 'poll', '["واضح ممتاز","واضح","مقبول","يحتاج توضيحاً أكثر"]'::jsonb, null, null, true
from public.lectures l where l.title = 'القانون الدستوري والمبادئ العامة — جلسة تفاعلية'
  and not exists (select 1 from public.questions q where q.lecture_id = l.id and q.text = 'هل شرح المحاضرة كان واضحاً؟');

-- إجابة الطالب 2 على سؤال LAW101 (تفاعلية + نقطة)
insert into public.question_answers (question_id, student_id, choice_index, choice_indices, text)
select q.id, 2, 0, null, null
from public.questions q
where q.text = 'ما هو أعلى أنواع التشريع في الدولة؟'
  and not exists (select 1 from public.question_answers qa where qa.question_id = q.id and qa.student_id = 2);

-- ---------- الاختبارات ----------
insert into public.exams (course_id, title, description, starts_at, ends_at, duration_min, is_published, exam_kind)
select c.id, v.title, v.description, v.starts_at::timestamptz, v.ends_at::timestamptz, v.duration_min, true, 'exam'
from (values
  ('LAW202', 'اختبار — قانون العقوبات', 'اختبار مفتوح الآن: الجريمة وأركانها والمشاركة والشروع.', '2026-11-18 00:00+03', '2026-11-20 23:59+03', 60),
  ('LAW101', 'اختبار منتصف الفصل — القانون العام', 'اختبار قصير يغطي مصادر القانون وأنواعه.', '2026-11-25 09:00+03', '2026-11-25 10:00+03', 45),
  ('LAW201', 'اختبار نهاية الفصل — القانون المدني', 'يغطي نظرية الالتزام ومصادرها وآثارها.', '2026-12-15 10:00+03', '2026-12-15 11:30+03', 90)
) as v(code, title, description, starts_at, ends_at, duration_min)
join public.courses c on c.code = v.code
where not exists (select 1 from public.exams e where e.title = v.title and e.course_id = c.id);

-- أسئلة اختبار LAW202 (مفتوح الآن)
insert into public.exam_questions (exam_id, type, text, options, correct_index, correct_indices, points, position)
select e.id, v.type, v.text, v.options::jsonb, v.correct_index, v.correct_indices::jsonb, v.points, v.position
from public.exams e
join (values
  ('mcq', 'ما هو أعلى مصدر مباشر للقانون؟', '["الشريعة الإسلامية","التشريع","العرف","الاجتهاد القضائي"]'::jsonb, 1, null, 2, 1),
  ('mcq', 'من السّلطة التي تضع القوانين في النظام الدستوري المرن؟', '["السلطة القضائية","السلطة التنفيذية","السلطة التشريعية","النقابات"]'::jsonb, 2, null, 2, 2),
  ('truefalse', 'الدستور هو القانون الأعلى الذي تخضع له كل القوانين.', null, 1, null, 2, 3),
  ('multi', 'مصادر القانون الرسمية:', '["التشريع","الشريعة الإسلامية","العرف","الأهواء الشخصية"]'::jsonb, null, '[0,1,2]'::jsonb, 3, 4),
  ('essay', 'وضح الفرق بين التشريع والعرف باختصار.', null, null, null, 6, 5)
) as v(type, text, options, correct_index, correct_indices, points, position) on true
where e.title = 'اختبار — قانون العقوبات'
  and not exists (select 1 from public.exam_questions eq where eq.exam_id = e.id);

-- أسئلة اختبار LAW101 القادم
insert into public.exam_questions (exam_id, type, text, options, correct_index, correct_indices, points, position)
select e.id, v.type, v.text, v.options::jsonb, v.correct_index, v.correct_indices::jsonb, v.points, v.position
from public.exams e
join (values
  ('mcq', 'أي من الآتي من مصادر القانون الاحتياطية؟', '["الدستور","التشريع","الاجتهاد القضائي","اللائحة"]'::jsonb, 2, null, 3, 1),
  ('mcq', 'التشريع هو القانون الذي تصدره:', '["المحاكم","السلطة التشريعية","الجهات الإدارية","النقابات"]'::jsonb, 1, null, 3, 2),
  ('mcq', 'العرف مصدر:', '["إلزامي دائماً","احتياطي عند غياب النص","أساسي في جميع الحالات","غير معتبر"]'::jsonb, 1, null, 2, 3),
  ('truefalse', 'يمكن أن يتعارض التشريع مع الدستور ولا يبطل.', null, 0, null, 2, 4)
) as v(type, text, options, correct_index, correct_indices, points, position) on true
where e.title = 'اختبار منتصف الفصل — القانون العام'
  and not exists (select 1 from public.exam_questions eq where eq.exam_id = e.id);

-- ---------- الواجبات ----------
insert into public.assignments (course_id, title, description, due_at, max_points)
select c.id, v.title, v.description, v.due_at::timestamptz, v.max_points
from (values
  ('LAW101', 'بحث: مصادر القانون المباشرة والاحتياطية', 'اكتب بحثاً موجزاً يفرق بين مصادر القانون المباشرة والاحتياطية مع أمثلة من القانون العراقي والأنظمة العربية.', '2026-11-25 23:59+03', 10),
  ('LAW201', 'حل قضية: عقد بيع سيارة معيبة', 'اقرأ الوقائع المرفقة وارصد الأركان والالتزامات والآثار والمسؤولية المترتبة، مع ذكر المواد ذات الصلة.', '2026-11-30 23:59+03', 10),
  ('LAW102', 'مقارنة بين دساتير عربية', 'قارن بين مبدأ الفصل بين السلطات في دستورين عربيين على الأقل.', '2026-11-15 23:59+03', 10),
  ('LAW202', 'بحث: أركان الجريمة', 'بحث تطبيقي عن أركان الجريمة مع حكم قضائي واحد على الأقل.', '2026-11-28 23:59+03', 10)
) as v(code, title, description, due_at, max_points)
join public.courses c on c.code = v.code
where not exists (select 1 from public.assignments a where a.course_id = c.id and a.title = v.title);

-- تسليم الطالب 2 لواجب LAW201 (مُصحّح)
insert into public.submissions (assignment_id, student_id, text, points, feedback, graded_at)
select a.id, 2,
  'العقد صحيح الأركان (الرضا والمحل والسبب). البائع التزم بتسليم السيارة وعلى ضمان التعرض والاستحقاق. المشتري له الحق في المطالبة بالتنفيذ أو الفسخ مع التعويض. بالنسبة للعيب الخفي: البائع مسؤول بالضمان ما لم يُثبت أن المشتري عرفه، والتقادم سنة من اكتشاف العيب.',
  9, 'عمل ممتاز — الأركان واضحة والاجتهاد مرتب. يُستحسن الاستشهاد بمواد القانون المدني.', now()
from public.assignments a join public.courses c on c.id = a.course_id
where c.code = 'LAW201' and a.title = 'حل قضية: عقد بيع سيارة معيبة'
  and not exists (select 1 from public.submissions s where s.assignment_id = a.id and s.student_id = 2);

-- ---------- النقاط ----------
insert into public.points_ledger (user_id, course_id, source_type, source_id, source_detail, points, created_at)
select 2, c.id, v.source_type, null, v.source_detail, v.points, v.created_at::timestamptz
from public.courses c
join (values
  ('LAW101', 'attendance', 'حضور تسجيل LAW101 — 2026-10-28', 10, '2026-10-28 20:30+03'),
  ('LAW201', 'attendance', 'حضور تسجيل LAW201 — مصادر الالتزام', 10, '2026-11-04 12:15+03'),
  ('LAW202', 'attendance', 'حضور تسجيل LAW202 — أركان الجريمة', 10, '2026-11-09 15:35+03'),
  ('LAW102', 'attendance', 'حضور تسجيل LAW102 — الفصل بين السلطات', 10, '2026-11-12 10:50+03'),
  ('LAW101', 'interaction', 'إجابة صحيحة — سؤال أعلى أنواع التشريع', 2, '2026-11-05 19:20+03'),
  ('LAW201', 'interaction', 'تفاعل نشط في النقاش المدني', 1, '2026-11-08 13:00+03'),
  ('LAW201', 'assignment', 'واجب حل قضية السيارة — 9/10', 8, '2026-11-12 09:00+03')
) as v(code, source_type, source_detail, points, created_at) on c.code = v.code
where not exists (
  select 1 from public.points_ledger p
  where p.user_id = 2 and p.course_id = c.id and p.source_detail = v.source_detail
);

-- ---------- الإشعارات ----------
insert into public.notifications (audience, course_id, user_id, title, body, link, created_by)
select 'all', null, null, 'انطلاق الفصل الدراسي', 'بدأ الفصل الخريفي 2026 — يسرنا الترحيب بكم في أكاديمية آل الزين للعلوم القانونية والعدلية.', '/', 1
where not exists (select 1 from public.notifications n where n.title = 'انطلاق الفصل الدراسي');

insert into public.notifications (audience, course_id, user_id, title, body, link, created_by)
select 'course', c.id, null, 'اختبار قانون العقوبات مفتوح الآن', 'اختبار لمقرر قانون العقوبات متاح حتى 20 نوفمبر — المدة ساعة واحدة.', '/student/exams', 1
from public.courses c
where c.code = 'LAW202'
  and not exists (select 1 from public.notifications n where n.title = 'اختبار قانون العقوبات مفتوح الآن');

insert into public.notifications (audience, course_id, user_id, title, body, link, created_by)
select 'user', null, 2, 'تم تصحيح واجب القانون المدني', 'حصلت على 9 من 10 — عمل ممتاز، راجع ملاحظة الأستاذ.', '/student/assignments', 1
where not exists (select 1 from public.notifications n where n.title = 'تم تصحيح واجب القانون المدني');

commit;

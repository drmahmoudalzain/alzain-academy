# تفعيل القواعد الحاكمة وتوليد رموز المقررات — خطة التنفيذ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** تفعيل القواعد الحاكمة الموثقة التي تبيّن أنها نائمة، وتوليد رموز المقررات تلقائياً مع احترام أصل/فروع البكالوريوس والمحاضرات المشتركة، دون تغيير مضمون أي قاعدة.

**Architecture:** كل تغيير قاعدة يتم في ترحيل مرقّم جديد مع ملف تراجع في `supabase/rollback/`؛ كل عملية كتابة تمر عبر دالة `security definer` محمية بـ`is_owner()`/`current_user_id()` أو `current_user_role()`؛ الواجهة ترسل النية لا البيانات الحساسة. تُطبَّق الترحيلات على Supabase الحقيقي فقط بعد تأكيد منفصل، ويُعاد البناء والتحقق قبل أي نشر.

**Tech Stack:** PostgreSQL/Supabase RPC + RLS، Edge Functions (Deno)، Vite/JS ثابت على GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-11-26-course-code-generation-design.md` (مع ملحقي أ وب).

## Global Constraints

- لا قيمة سرية ولا عرض لأي `.env`؛ لا `service_role` في المتصفح.
- لا `deploy:dev` ولا `build:dev`؛ النشر فقط عبر `npm run deploy:pages`.
- لا تغيير في مضمون القواعد الحاكمة؛ التفعيل فقط.
- الترحيلات بالترتيب `0121`…`0125`، ولكل واحد rollback قابل للتنفيذ قبل تطبيقه.
- لا `EXECUTE` لأي دالة إدارة أو نقاط لـ`anon`.
- لا إعادة حساب للبيانات التاريخية؛ القواعد تُطبَّق من لحظة التفعيل فقط.
- قبل كل تطبيق ترحيل وقبل كل نشر: طلب تأكيد منفصل من المالك.
- التحقق الإلزامي: `node --test web/tests`، `npm run build`، `npm run verify:deploy`، `git diff --check`.

## Review Focus

- محاضرة على الأصل وطالب مسجَّل في الأصل والفرع معاً: يجب أن يُمنح مرة واحدة في الفرع لا مرتين. → اختبار في Task 1.
- سقف أول 10 محاضرات يجب أن يحسب محاضرات الأصل والفرع معاً للطالب الواحد. → اختبار في Task 2.
- درجة الاختبار تُضاف كمصدر `exam` once وبسقف المحاضرة المرتبطة، ولا تُحتسب إن كانت بلا محاضرة. → اختبار في Task 2.
- منع الدخول بالبريد يجب ألا يكسر الدخول برمز المنصة الحقيقي (`BF0001`). → اختبار في Task 4.
- قفل الحساب بعد 5 محاولات فاشلة يجب أن يمنع الدخول ولا يفتح البوابة. → اختبار في Task 4 (مُنفَّذ في `0123`)؛ Turnstile مُسقَط بقرار المالك 2026-11-26، فلا اختبار ولا نشر له.

---

### Task 1: ترحيل 0121 — رموز المقررات والمحاضرة المشتركة

**Files:**
- Create: `supabase/migrations/0121_course_codes_and_shared_lectures.sql`
- Create: `supabase/rollback/0121_course_codes_and_shared_lectures_rollback.sql`
- Test: `web/tests/course-code-generation-sql.test.mjs`
- Modify: `web/src/pages/owner/courses.js`, `web/pages/owner/courses.html`

**Interfaces:**
- Produces:
  - `public.management_generate_course_code(p_level smallint, p_parent_course_id bigint default null, p_branch_track text default null) returns text`
  - `public.management_create_course(... existing 11 args ..., p_parent_course_id bigint default null, p_branch_track text default null) returns jsonb`
  - `public.management_create_course_family(p_title text, p_level smallint, p_description text default null, p_color text default '#1f4e5f', p_attendance_weight numeric default 30, p_exams_weight numeric default 70, p_assignments_weight numeric default 0, p_teacher_id bigint default null) returns jsonb`
  - `public.course_for_student_lecture(p_lecture_id bigint, p_student_id bigint) returns bigint`

- [ ] **Step 1: ابدأ بكتابة اختبار عقد فاشل** في `web/tests/course-code-generation-sql.test.mjs` يثبت: `management_generate_course_code(4,null,null)` يُرجع `LAW414`؛ اشتقاق `-M/-F` من أب موجود؛ رفض فرع مكرر؛ رفض استدعاء بلا مالك.
- [ ] **Step 2: شغّل `node --test web/tests/course-code-generation-sql.test.mjs` وتأكد أنه يفشل** بسبب غياب الترحيل.
- [ ] **Step 3: اكتب الترحيل `0121`** بالدوال الأربع أعلاه، بقفل `pg_advisory_xact_lock` بمفتاح جديد، وتدقيق `audit_logs` لكل عملية، ومنح `authenticated`/`service_role` فقط. اجعل `management_create_course_family` تنشئ الأصل (`bachelor`, `archived=false` لدخوله في قاعدة التسجيل مباشرة) ثم الفرعين في معاملة واحدة.
- [ ] **Step 4: أضف إلى الترحيل توسيع `student_lectures` و`student_lecture_detail` و`student_lecture_attendance` وسياسات RLS** لتظهر محاضرة الأصل لطالب الفرع عبر `course_for_student_lecture`، مع رفض أكثر من فرع نشط تحت الأصل للطالب نفسه.
- [ ] **Step 5: شغّل الاختبار وتأكد من نجاحه**، ثم شغّل `node --test web/tests` بالكامل.
- [ ] **Step 6: اكتب rollback يعيد توقيع `management_create_course` إلى نسخة `0114`** ويسقط الدوال الجديدة ويعيد تعريف دوال المحاضرات إلى نسخ ما قبل `0121`، بلا حذف صفوف.
- [ ] **Step 7: عدّل واجهة المقررات** إلى ثلاثة أوضاع (مقرر جديد / فرع لأصل موجود / أصل وفرعاه) مع حقل رمز للقراءة فقط عند الإنشاء، واستدعاء الدوال الجديدة.
- [ ] **Step 8: التزم** بـ`git add ... && git commit -m "feat: course codes and shared parent lectures"`.

### Task 2: ترحيل 0122 — تفعيل قواعد اكتساب النقاط

**Files:**
- Create: `supabase/migrations/0122_activate_points_rules.sql`
- Create: `supabase/rollback/0122_activate_points_rules_rollback.sql`
- Test: `web/tests/points-rules-sql.test.mjs`
- Modify: `web/src/pages/student/grades.js`, `web/src/pages/student/points.js`

**Interfaces:**
- Consumes: `course_for_student_lecture(bigint,bigint)` من Task 1.
- Produces:
  - مفاتيح جديدة في `academic_policies`: `lecture_count_cap`, `lecture_attendance_points`, `lecture_interaction_points`, `lecture_exam_points`, `recorded_exam_points`, `attendance_minutes_per_point`, `attendance_points_cap`, `attendance_required_minutes`.
  - `public.student_lecture_presence_heartbeat(p_lecture_id bigint, p_seconds integer) returns jsonb` — لا يمكن احتساب الحضور بالدقائق دون كتابة `lecture_presence.total_seconds`.
  - `public.student_lecture_interaction_answer(p_question_id bigint, p_choice_index integer default null, p_choice_indices jsonb default null, p_text text default null) returns jsonb`
  - `public.lecture_points_award(p_lecture_id bigint, p_student_id bigint, p_course_id bigint) returns jsonb`

- [ ] **Step 1: ابدأ باختبار فاشل** يثبت أن قيمة `point_sources` تصبح `["attendance","interaction","assignment","exam"]`، وأن إجابة صحيحة تمنح نقطة واحدة بحد 10 للمحاضرة، وأن محاضرة الحادية عشرة لا تضيف نقاطاً.
- [ ] **Step 2: شغّل الاختبار وتأكد من فشله.**
- [ ] **Step 3: اكتب الترحيل 0122** ليضيف المفاتيح أعلاه، ويعيد تعريف `student_lecture_attendance` لحساب النقاط من `lecture_presence.total_seconds` بمعدل نقطة/10 دقائق بحد 10 بعد 100 من 120 دقيقة مع إبقاء شرط رمز الحضور، ويضيف دالة الإجابة التفاعلية بدالة `security definer` تمنع التكرار وتحترم السقف.
- [ ] **Step 4: أضف مصدر `exam`** إلى `student_exam_submit` عبر إعادة تعريف الدالة: اكتب `points_ledger` بـ`source_type='exam'` و`source_id=exam_id`، بسقف `lecture_exam_points` أو `recorded_exam_points` حسب `lecture_type`، ولا شيء إن لم تكن المحاضرة مرتبطة. عدّل `0117` لتقرأ المصادر من السياسة لا من ثابت.
- [ ] **Step 5: شغّل الاختبار وتأكد من نجاحه**، ثم `node --test web/tests`.
- [ ] **Step 6: اكتب rollback** يعيد `point_sources` والمفاتيح ودوال `0108`/`0117` إلى نسخ ما قبل `0122`، بلا حذف نقاط قائمة.
- [ ] **Step 7: طبّق عرض الدرجات حسب المسار** في واجهتي الطالب: البكالوريوس حضور/تفاعل/اختبارات، وبقية المسارات واجبات/مجموع/تقدير.
- [ ] **Step 8: التزم** بـ`git commit -m "feat: activate documented points rules"`.

### Task 3: واجهة قائمة الطلاب ونافذة الزيارة الأولى

**Files:**
- Modify: `web/pages/owner/students.html`, `web/src/pages/owner/students.js`
- Create: `web/src/lib/first-visit.js`
- Modify: `web/src/lib/portal.js`, `web/pages/guide.html`
- Test: `web/tests/owner-students-ui.test.mjs`, `web/tests/first-visit-ui.test.mjs`

**Interfaces:**
- Consumes: دوال المالك الحالية في `0119`.
- [ ] **Step 1: ابدأ باختبارات فاشلة** تثبت وجود تبويبات المسارات بعدّادات، تبويبات بكالوريوس/طلاب/طالبات، عدّادات مستويات ثابتة، المستوى 0 باهت وغير قابل للنقر، البحث يحفظ `track` و`level` في الرابط، واسم الطالب قابل للنقر.
- [ ] **Step 2: شغّل الاختبارات وتأكد من فشلها.**
- [ ] **Step 3: نفّذ الواجهة** في `students.html`/`students.js` وفق `PROJECT_STATUS_24_7.md` §2.4.
- [ ] **Step 4: أضف `first-visit.js`** لعرض نافذة الزيارة الأولى وتخزين حالتها في `localStorage`، واستدعِه من `portal.js` مع استثناء صفحة الدخول.
- [ ] **Step 5: شغّل الاختبارات وتأكد من نجاحها**، ثم `npm run build`.
- [ ] **Step 6: التزم** بـ`git commit -m "feat: owner student list and first-visit modal"`.

### Task 4: ترحيل 0123 — قواعد الهوية (منع البريد، القفل، أول دخول)

**Files:**
- Create: `supabase/migrations/0123_identity_rules.sql`
- Create: `supabase/rollback/0123_identity_rules_rollback.sql`
- Modify: `supabase/functions/legacy-login/index.ts`, `web/src/pages/login.js`, `web/src/lib/portal.js`
- Test: `web/tests/identity-rules.test.mjs`

**Interfaces:**
- Produces:
  - `public.auth_login_guard_check(p_identifier text) returns jsonb` — يرفض البريد ويعيد `{ok:false,error:'...'}`.
  - `public.auth_record_login_attempt(p_identifier text, p_success boolean) returns jsonb` — يقفل بعد 5 محاولات فاشلة.

- [ ] **Step 1: ابدأ باختبار فاشل** يثبت أن `auth_login_guard_check('x@y.com')` يرفض، وأن خمسة فشل متتالية تُقفل الحساب، وأن السادس يُرفض برسالة قفل.
- [ ] **Step 2: شغّل الاختبار وتأكد من فشله.**
- [ ] **Step 3: اكتب الترحيل 0123** بجدول محاولات الدخول والدالتين أعلاه، محميتين بـ`security definer`، بلا `anon`، مع تدقيق كل قفل.
- [ ] **Step 4: اربط الدالتين بـ`legacy-login` وواجهة الدخول**، بحيث يُرفض البريد قبل أي تحقق، وتُسجَّل المحاولة، ولا تُفتح البوابة قبل تغيير كلمة المرور في أول دخول.
- [ ] **Step 5: شغّل الاختبار وتأكد من نجاحه**، ثم `verify:login` و`node --test web/tests`.
- [ ] **Step 6: اكتب rollback** واختباراً يثبت أن الدخول برمز حقيقي ما زال يعمل بعد التراجع.
- [ ] **Step 7: التزم** بـ`git commit -m "feat: identity rules activation"`.

### Task 5: Turnstile على نموذج الدخول — **مُسقَط بقرار المالك (2026-11-26)**

> **القرار:** أُسقِط متطلب Cloudflare Turnstile من القاعدة الحاكمة، ولا يُنشأ `verify-turnstile` ولا يُضاف أي مفتاح أو حقل إلى نموذج الدخول. الوقاية من محاولات الدخول الآلية تقوم بطريقتنا الحالية: قفل الحساب بعد 5 محاولات فاشلة/15 دقيقة في `0123`، ومنع الدخول بالبريد، وإلزام تغيير كلمة المرور في أول دخول عبر طبقة الواجهة، مع حدود GoTrue لكل IP. لا Firebase في الاستضافة (مؤجّل) ولا سرية في `web/`.

**Files:** لا ملفات؛ المهمة ملغاة توثيقياً فقط.

**Interfaces:** لا واجهة جديدة؛ لا تُستهلك مفاتيح.

- [x] **Step 1: سجّل قرار الإسقاط** في `PROJECT_STATUS_24_7.md` وقائمة قبول خطة Supabase.
- [x] **Step 2: أكّد أن البديل مُفعَّل** في `0123` و`academy-login`، ولا يتوقف على مفتاح خارجي.

> لا يُعدّ Turnstile منجزاً ولا مؤجلاً؛ أُسقِط من المعيار الموثَّق. أي عودة إليه تحتاج قرار مالك جديد وتنفيذ Task كامل باختبارات ونشر منفصل.

### Task 6: ترحيل 0124 — مسار مراجعة النشر العلمي

**Files:**
- Create: `supabase/migrations/0124_publication_review.sql`
- Create: `supabase/rollback/0124_publication_review_rollback.sql`
- Modify: `web/src/pages/library-manage.js`
- Test: `web/tests/publication-review-sql.test.mjs`

**Interfaces:**
- Produces:
  - `public.management_assign_publication_reviewers(p_publication_id bigint, p_reviewer1 bigint, p_reviewer2 bigint) returns jsonb`
  - `public.reviewer_record_publication_decision(p_publication_id bigint, p_decision text, p_reason text) returns jsonb`

- [ ] **Step 1: ابدأ باختبار فاشل** يثبت أن التعيين للمالك فقط، وأن المراجعين اثنان مختلفان، وأن القرار لا يُعد قبل اكتماد مراجعة المراجعين، وأن الحد الأدنى 30 مطبَّق.
- [ ] **Step 2: شغّل الاختبار وتأكد من فشله.**
- [ ] **Step 3: اكتب الترحيل 0124** بالدالتين أعلاه مع تدقيق ومنع `anon`.
- [ ] **Step 4: أضف واجهة تعيين المراجعين وقرار المراجع** في `library-manage.js`.
- [ ] **Step 5: شغّل الاختبار وتأكد من نجاحه**، ثم `node --test web/tests`.
- [ ] **Step 6: اكتب rollback والتزم** بـ`git commit -m "feat: publication review workflow"`.

### Task 7: توثيق القرارات والتحقق النهائي

**Files:**
- Modify: `docs/PROJECT_STATUS_24_7.md`, `docs/2026-11-20-supabase-baas-migration-plan.md`, `docs/superpowers/plans/2026-11-26-academic-year.md`
- [ ] **Step 1: ابدأ بتحديث الوثيقة** لتقول «المساعد يقرأ ويكتب في المكتبة فقط»، وإسقاط قواعد Express القديمة، وتوثيق تعميم تصنيف العام مع حصر الترقية بالبكالوريوس، وتوحيد مواصفة dev-login مع الكود.
- [ ] **Step 2: أضف سجل التفعيل** بقائمة الترحيلات المطبَّقة وتواريخها ونتائج اختباراتها، مع بيان صريح بأن Turnstile أُسقِط بقرار المالك 2026-11-26 وأن قفل الـ5 محاولات مُنفَّذ مستقلًا كبديل له.
- [ ] **Step 3: شغّل `node --test web/tests` و`npm run build` و`npm run verify:deploy` و`git diff --check` وتأكد من نجاحها جميعاً.**
- [ ] **Step 4: التزم** بـ`git commit -m "docs: record activated rules"`.
- [ ] **Step 5: اطلب تأكيداً منفصلاً قبل تطبيق أي ترحيل على Supabase الحي، وتأكيداً منفصلاً قبل `deploy:pages`.**

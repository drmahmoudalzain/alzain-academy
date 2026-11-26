# تصميم: تنقّل ناعم + كاش + أنميشن تحميل + أزرار دخول تطوير

## النية
إزالة الإحساس بـ«إعادة رسم الصفحة بالكامل» عند التنقل داخل بوابات أكاديمية آل الزين، وتقليل طلبات الشبكة المكررة، وتوحيد شكل التحميل ليبدو احترافياً ومختلفاً حسب نوع العملية، وتسهيل الدخول أثناء التطوير من دون نقل كلمات المرور إلى Git أو إلى النشر العام.

## الأهداف
1. التنقل بين صفحات البوابة دون إعادة تحميل المستند كاملة، مع بقاء ملفات HTML مستقلة وقابلة للفتح مباشرة.
2. كاش خفيف للقراءات شبه الثابتة (الملف الشخصي، إعدادات الحساب، قوائم المقررات…) مع إبطال صريح عند الكتابة.
3. نظام تحميل موحّد: هي skeletons مختلفة حسب نوع البيانات، شريط تقدّم للتنقل، حالة انتظار للأزرار، واحترام `prefers-reduced-motion`.
4. أربعة أدوار دخول للتطوير فقط في `web/src/lib/dev-login.js`: `owner` و`student` و`teacher` و`teacher2`؛ لا تظهر قيمها في بناء الإنتاج.

## غير أهداف / محاذير
- لا React ولا SPA.framework؛ لا تغيير في استقلال ملفات HTML ولا في `vite.config.js`.
- لا نطاق مخصص، لا أسرار في Git، لا كلمات مرور في الحزمة المنشورة.
- لا تُضاف سياسات Storage ولا مفاتيح Gemini في هذه الدفعة.
- لا يُغيَّر عقد RPCs ولا أي بيانات إنتاجية.

## القيود المكتشفة
- `web/src/lib/portal.js` → `boot()` يستدعي `requireProfile()` ثم `renderShell()` في كل تحميل؛ `web/src/lib/layout.js` → `bindShell()` يضيف مستمعات على `document`.
- وحدات الصفحات (18 وحدة) تستدعي `boot()` على المستوى الأعلى؛ عند استيراد وحدة كـ ES module مرة ثانية لا تُعاد منفّذة، لذا يلزم استيراد بـ query متغيّر عند كل تنقّل ناعم لإعادة تهيئة حالة الوحدة.
- بعض الصفحات تسجّل مستمعات/مؤقتات عامة (`document`/`window`، `setInterval`) تحتاج تنظيفاً عند مغادرة الصفحة.
- بيانات الأدوار الأربعة للتطوير تُقرأ من متغيرات `VITE_DEV_OWNER_*` و`VITE_DEV_STUDENT_*` و`VITE_DEV_TEACHER_*` و`VITE_DEV_TEACHER2_*` في ملفات `.env.development.local` المحلية المستبعدة من Git؛ لا تُكتب القيم في المستند ولا في الحزمة المنشورة.

## المسارات المُقرَّرة (اختيار المالك)

### 1) التنقّل الناعم — «تبديل المحتوى مع بقاء الهيكل»
- وحدة جديدة `web/src/lib/navigator.js` تعترض نقرات الروابط الداخلية (`pages/...`، `guide.html`، `index.html`) داخل البوابة، وتستدعي `fetch()` لملف HTML الهدف، ثم:
  - تقرأ `<title>` وتحدّث `document.title`.
  - تبدّل محتوى `#content` بالقسم الأصلي من الملف المستلم، وتُحدّث حالة `active` في `.sidebar-nav`.
  - تنفّذ `history.pushState` وتتعامل مع `popstate`.
  - تستورد وحدة الصفحة بـ `import(src + '?nav=' + n)` لضمان إعادة التهيئة، ثم تستدعي `mountPage()`.
- تعديل `boot()` ليسجّل دالة التركيب في `web/src/lib/page-registry.js` ويؤجّل التنفيذ أثناء تنقّل ناعم؛ الصفحات نفسها لا تحتاج تعديلاً. `boot()` يُعيد استخدام الهيكل القائم إن كان portal الصفحة هو نفسه، ويُعيد بناءه عند اختلاف البوابة، ويحوّل تحويلاً كاملاً إن لم يكن الدور مسموحاً.
- وحدة `web/src/lib/lifecycle.js` توفر `onDispose()` / `disposeAll()`؛ `boot()` تستدعي `disposeAll()` قبل كل تركيب. تُحدَّث `bindShell()` والصفحات التي تسجّل مستمعات/مؤقتات عامة لتسجيل دوال تنظيف.
- روابط `<link rel="stylesheet">` من صفحة الهدف تُضاف إلى `<head>` إن لم تكن موجودة (اتحاد الأنماط، لا استبدال) تفادياً لكسر تنسيق صفحات أخرى.
- نطاق الاعتراض: جميع الروابط الداخلية باستثناء `login.html` والروابط الخارجية و`target`/`download` وضغطات Modifier. يُطبَّق `pushState` مع `location.search` قبل استيراد الوحدة كي تقرأ صفحات التفاصيل معاملاتها صحيحة.
- صفحة `pages/student/exam.html` مستثناة من التنقّل الناعم (حفظ مؤجّل + مؤقت + تحذير `beforeunload`)؛ الدخول إليها أو الخروج منها يتم بتنقّل كامل.
- السلوك الاحتياطي: أي فشل في `fetch` أو استيراد الوحدة → تنقّل عادي بالمتصفح.

### 2) الكاش
- وحدة `web/src/lib/cache.js`: `Map` في الذاكرة + `sessionStorage` كطبقة ثانية، مفتاح بادئة `az:cache:`، TTL قابل للضبط (افتراضي 60 ثانية، ملف المستخدم 5 دقائق).
- `web/src/lib/api.js` → `call()` يستخدم الكاش لقائمة بيضاء **صريحة** من القراءات (لا قواعد prefix): `my_profile`، `my_account_stats`، `my_notification_preferences`، `ai_public_settings`، `ai_conversations`، `ai_conversation_messages`، `student_dashboard`، `student_courses`، `student_lectures`، `student_lecture_detail`، `student_exams`، `student_exam_take`، `student_assignments`، `student_grades`، `student_points`، `teacher_dashboard`، `teacher_courses`، `teacher_course_detail`.
- الإبطال عبر قائمة **صريحة** لأسماء الكتابة الفعلية المستخرجة من الكود: `update_my_profile`، `mark_password_changed`، `set_notification_preference`، `ai_create_conversation`، `ai_append_user_message`، `ai_delete_conversation`، `ai_delete_last_assistant_message`، `ai_clear_history`، `student_exam_save_answer`، `student_exam_submit`، `student_assignment_submit`، `student_lecture_attendance`، `teacher_create_course`، `teacher_update_course`، `teacher_add_lecture`، `teacher_create_exam`، `teacher_create_assignment`، `teacher_grade_submission`، `teacher_enroll_student`، `teacher_set_attendance`، `teacher_post_announcement`. أي RPC خارج القائمتين لا يُخزَّن ولا يُبطل شيئاً (الأمان أولاً).
- المفاتيح مقيدة بالمستخدم (`u<id>`) عبر `setCacheUser()` الذي يستدعيه `getProfile()`؛ `signOut()` يُفرغ كامل namespace `az:cache:` لتفادي تسريب بيانات بين الحسابات في نفس التبويب.
- `web/src/lib/auth.js` → `getProfile()` نفسها تستخدم الكاش (وليس `requireProfile()` فقط)، لأن `login.js` يستدعيها مباشرة؛ تحديث الملف الشخصي يُبطل الإدخال عبر RPC الكتابة.

### 3) أنميشن التحميل
- وحدة `web/src/lib/loading.js` مع: `skeleton(kind, count)` لأنواع `stats | cards | rows | hero | table | profile | chat`، و`busy(button, pending)`، و`routeProgress()` لشريط التنقل، و`runTask(el, kind, loader)` التي تعرض الهيكل ثم تستبدله بالنتيجة.
- ملف `web/public/css/views/loading.css` بموجات shimmer متدرّجة، نبض خفيف، شريط تقدّم، ودوران للأزرار، مع `@media (prefers-reduced-motion: reduce)` لتعطيل الحركة.
- تُطبَّق الأنماط أولاً على صفحات الأستاذ الثلاث المُنشأة حديثاً وعلى شريط التنقّل وزر الدخول، ثم تبقى قابلة للاستخدام في بقية الصفحات.

### 4) أزرار دخول التطوير
- أربعة أدوار معرَّفة في `web/src/lib/dev-login.js`: `owner` و`student` و`teacher` و`teacher2` (بترتيب العرض هذا). كل دور زوج `ID`/`PASSWORD`؛ الأزواج الناقصة تُستبعد، وإن غابت كلها لا تُنتَج أي أزرار.
- تُقرأ القيم من `import.meta.env` للأسماء `VITE_DEV_OWNER_ID/PASSWORD` و`VITE_DEV_STUDENT_ID/PASSWORD` و`VITE_DEV_TEACHER_ID/PASSWORD` و`VITE_DEV_TEACHER2_ID/PASSWORD`، ولا تُعرض إلا إذا كان `DEV === true` أو `MODE === "development"`؛ بناء الإنتاج لا يتضمنها أبداً. تُخزَّن القيم محلياً في `web/.env.development.local` (مستبعد من Git عبر `.env.*` و`*.local`) ولا تُضمَّن في `web/dist` المنشور على Pages.
- أزرار «معاينة البوابات» في `login.html` مستقلة عن أزواج dev-login: تعرض الواجهات بلا بيانات اعتماد، ولا تُحقن كلمات مرور التطوير في DOM عند غياب المتغيرات.

## التنفيذ والتحقق
- ترتيب العمل: lifecycle + cache → navigator → loading → dev login → تحقق.
- التحقق: فحص ساكن للمعرّفات/المسارات، `npm run build`، تشغيل خادم dev للتأكد من التنقل الناعم والكاش، ثم نشر `gh-pages` والتأكد من `HTTP 200` للصفحات الثلاث ومن خفاء أزرار التطوير في النسخة المنشورة.
- معيار النجاح: لا يختفي الهيكل عند تغيير القسم، لا يُعاد جلب الملف الشخصي في كل تنقّل، يظهر هيكل تحميل مناسب قبل ظهور البيانات، ولا تظهر كلمات المرور في `dist` ولا في Git.

# UX Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** جعل التنقل داخل البوابة ناعماً، وتقليل طلبات الشبكة بكاش آمن، وتوحيد أنميشن التحميل، وإضافة أزرار دخول للتطوير فقط.

**Architecture:** وحدات صغيرة في `web/src/lib/` (lifecycle، cache، page-registry، navigator، loading) تُحقن في نقطة الدخول الموحّدة `boot()` دون تعديل وحدات الصفحات. التنقّل يجلب HTML الهدف ويستبدل المحتوى فقط مع إعادة تقييم وحدة الصفحة بـ query متغيّر. الكاش قائمة بيضاء صريحة للقراءات وإبطال صريح للكتابة، بمفاتيح مقيدة بالمستخدم.

**Tech Stack:** Vite 5 + vanilla JS modules + Supabase JS v2، بلا أطر عمل، مع `node --test` للاختبارات الخفيفة.

**Spec:** `docs/superpowers/specs/2026-11-25-soft-navigation-cache-loading-dev-login-design.md`

## Global Constraints

- لا React/SPA framework؛ تبقى صفحات HTML مستقلة وقابلة للفتح مباشرة.
- `base: "/alzain-academy/"` في `web/vite.config.js`، وكل المسارات الداخلية تمر عبر `p()` من `web/src/lib/base.js`.
- لا أسرار في Git؛ كلمات مرور التطوير في `web/.env.development.local` فقط، وتُخفى الأزرار خارج `import.meta.env.DEV`.
- قواعد Mobile-First: أي `@media` جديد يجب أن يستخدم `min-width` فقط.
- لا Directly `SELECT` على `users` في كود جديد؛ لا كتابة مباشرة من الواجهة؛ كل الكتابة عبر RPC.
- `student/exam.html` مستثنى من التنقّل الناعم.

## Review Focus

1. تبديل حساب في نفس التبويب بعد دخول سابق → يجب ألا تظهر بيانات الحساب السابق: اختبار في Task 1 يفحص أن مفاتيح الكاش مقيدة بمعرّف المستخدم وأن `clear()` تمسح النطاق كاملاً.
2. كتابة درجة أو تسليم ثم الرجوع للوحة التحكم → يجب ألا تظهر أرقام قديمة: اختبار في Task 1 يفحص أن `teacher_grade_submission` يُبطل الكاش.
3. التنقّل إلى صفحة بوابة أخرى (طالب ← أستاذ ← مالك) → يجب تحديث الهيكل والعنوان أو التحويل الكامل عند عدم السماح: اختبار ساكن في Task 2 يفحص مسارات `boot()` وشرط `portals`.
4. مغادرة صفحة فيها مستمع `keydown` أو `setInterval` → يجب ألا يبقى المستمع: اختبار في Task 2 يفحص تسجيل `onDispose` في `layout.js` والصفحات المعنية.
5. بناء الإنتاج → يجب ألا تحتوي الحزمة على كلمات مرور التطوير: اختبار في Task 4 يفحص غياب القيم في `web/dist/assets` وغياب الأزرار عند `DEV=false`.

---

### Task 1: أساس الكاش ودورة الحياة

**Files:**
- Create: `web/src/lib/lifecycle.js`
- Create: `web/src/lib/cache.js`
- Modify: `web/src/lib/api.js`
- Modify: `web/src/lib/auth.js`
- Test: `web/tests/cache.test.mjs`

**Interfaces:**
- Consumes: `supabase` من `web/src/lib/supabase.js`.
- Produces: `onDispose(fn)`, `disposeAll()`؛ `setCacheUser(id)`, `remember(key, ttl, loader)`, `peek(key)`, `set(key,value,ttl)`, `clear(prefix?)`.

- [ ] **Step 1: اكتب اختبارات فاشلة لـ `cache.test.mjs`** تغطي: انتهاء TTL، `clear("u1:")` لا يمسح `u2:`، و`clear()` يمسح الكل، و`remember()` لا تستدعي loader ثانية قبل انتهاء TTL. استخدم stub لـ `globalThis.sessionStorage` و`localStorage`.
- [ ] **Step 2: شغّل `node --test web/tests/cache.test.mjs` وتأكد من الفشل**.
- [ ] **Step 3: أنشئ `lifecycle.js`** بمجموعة `Set` من دوال التنظيف و`onDispose`/`disposeAll` (يستدعي الجميع ويُفرغ المجموعة، مع `try/catch`).
- [ ] **Step 4: أنشئ `cache.js`** بخريطة ذاكرة + `sessionStorage`، بادئة `az:cache:`، TTL افتراضي 60000ms، ومفاتيح مسبوقة بـ `u<id>:` عبر `setCacheUser()`.
- [ ] **Step 5: عدّل `api.js`** ليمرّر `call()` القراءات المسموحة عبر `remember()`، ويستدعي `clear()` عند أي من أسماء الكتابة الصريحة في المواصفة، دون تغيير شكل `{ok,data}`.
- [ ] **Step 6: عدّل `auth.js`** ليستخدم `getProfile()` الكاش بمفتاح `profile:<user.id>` وTTL 300000ms، و`signOut()` تستدعي `clear()`.
- [ ] **Step 7: شغّل الاختبارات وتأكد من النجاح**.
- [ ] **Step 8: التزام**: `git commit -m "feat(core): add scoped cache and lifecycle cleanup"`.

### Task 2: التنقّل الناعم

**Files:**
- Create: `web/src/lib/page-registry.js`
- Create: `web/src/lib/navigator.js`
- Modify: `web/src/lib/portal.js`
- Modify: `web/src/lib/layout.js`
- Modify: `web/src/pages/{ai-assistant,library,library-manage,account}.js` و`web/src/pages/student/{assignments,exams,exam-result}.js` و`web/src/pages/teacher/common.js`
- Test: `web/tests/navigator.test.mjs`

**Interfaces:**
- Consumes: `onDispose`، `setCacheUser`، `p()`.
- Produces: `initNavigator()`؛ `beginSoftNav()`, `endSoftNav()`, `isSoftNav()`, `registerPage(key, mount)`, `takeMount(key)`, `setPendingPreset(html)`.

- [ ] **Step 1: اكتب اختباراً فاشلاً** يفحص أن `registerPage('/pages/teacher/courses.html', fn)` ثم `takeMount(...)` يعيد الدالة نفسها، وأن `beginSoftNav()` يجعل `isSoftNav()` صحيحاً حتى `endSoftNav()`.
- [ ] **Step 2: شغّل الاختبار وتأكد من الفشل**.
- [ ] **Step 3: أنشئ `page-registry.js`** بالواجهة أعلاه وخزينة للـ preset.
- [ ] **Step 4: أعد هيكلة `boot()`** ليسجّل mount ويؤجّله أثناء التنقّل الناعم، وينظّف بالمستمعات عبر `disposeAll()`، ويعيد استخدام الهيكل إن تطابق الـ portal وإلا يعيد بناءه أو يحوّل كاملاً عند عدم السماح. لا تغيّر توقيع `boot()` العام.
- [ ] **Step 5: عدّل `bindShell()`** لتسجيل إزالة كل مستمعات `document`/`window` عبر `onDispose`.
- [ ] **Step 6: أنشئ `navigator.js`** مع `initNavigator()`: اعتراض النقر الداخلي، استثناءات `login.html` وصفحة الاختبار والمعدّلات، `fetch` + `pushState`، تحديث `document.title`، إضافة روابط CSS المفقودة، تخزين preset، `import(src + '?nav=' + n)`، ثم `takeMount()` وتنفيذه، و`popstate`، والرجوع للتنقّل الكامل عند أي فشل.
- [ ] **Step 7: حدّث الصفحات ذات المستمعات العامة** لتسجيل دوال الإزالة عبر `onDispose` (keydown/hashchange/setInterval/beforeunload).
- [ ] **Step 8: أضف `initNavigator()`** إلى نقاط دخول الصفحات عبر استيراد جانبي في `portal.js` (تأكد أنه لا يعمل في `login.html`).
- [ ] **Step 9: شغّل الاختبارات و`npm run build`**.
- [ ] **Step 10: التزام**: `git commit -m "feat(nav): preserve shell across internal navigation"`.

### Task 3: أنميشن التحميل الموحّد

**Files:**
- Create: `web/src/lib/loading.js`
- Create: `web/public/css/views/loading.css`
- Modify: `web/src/pages/teacher/{dashboard,courses,course}.js`
- Modify: `web/src/pages/teacher/*.html` لإضافة رابط CSS
- Modify: `web/src/lib/navigator.js` لشريط التقدّم
- Test: `web/tests/loading.test.mjs`

**Interfaces:**
- Consumes: `esc()` من `fmt.js`.
- Produces: `skeleton(kind, count)`, `busy(button, pending)`, `routeProgress()`, `runTask(el, kind, loader)`.

- [ ] **Step 1: اكتب اختباراً فاشلاً** يفحص أن `skeleton('stats', 3)` يُنتج 3 عناصر بصنف `ld-skeleton--stat`، وأن الأنواع غير المعروفة تُرجع `cards`.
- [ ] **Step 2: شغّل الاختبار وتأكد من الفشل**.
- [ ] **Step 3: أنشئ `loading.js`** بالواجهة أعلاه؛ `runTask()` يعرض الهيكل ثم ينفّذ loader ويُدخل النتيجة أو رسالة خطأ.
- [ ] **Step 4: أنشئ `loading.css`** بـ shimmer متدرّج، نبض، شريط تقدّم أعلى الصفحة، دوران للأزرار، و`@media (prefers-reduced-motion: reduce)` يعطّل الحركة.
- [ ] **Step 5: استبدل skeletons اليدوية** في صفحات الأستاذ الثلاث بـ `skeleton(kind, count)` وأضف رابط `loading.css` ملفات HTML الثلاثة.
- [ ] **Step 6: اربط شريط التقدّم** ببداية/نهاية التنقّل الناعم.
- [ ] **Step 7: شغّل الاختبارات و`npm run build` والتحقق الساكن (كل `@media` بـ `min-width`)**.
- [ ] **Step 8: التزام**: `git commit -m "feat(ui): add task-specific loading animations"`.

### Task 4: أزرار دخول التطوير

**Files:**
- Modify: `web/login.html`
- Modify: `web/src/pages/login.js`
- Modify: `web/public/css/login-extra.css`
- Modify: `.env.example`
- Create (محلي فقط، مستبعد من Git): `web/.env.development.local`
- Test: `web/tests/dev-login.test.mjs`

**Interfaces:**
- Consumes: `import.meta.env.DEV` و`VITE_DEV_STUDENT_ID/PASSWORD` ونظيري `TEACHER` و`ASSISTANT`.
- Produces: لا واجهة عامة؛ السلوك داخل `login.js` فقط.

- [ ] **Step 1: اكتب اختباراً فاشلاً** يفحص أن مولّد وسوم الأزرار يُخفى عند غياب المتغيرات ولا يُضمّن كلمة مرور عند `DEV=false`.
- [ ] **Step 2: شغّل الاختبار وتأكد من الفشل**.
- [ ] **Step 3: أضف الأزرار الثلاثة** إلى `login.html` داخل `<div class="dev-logins" hidden>` ببيانات `data-dev`.
- [ ] **Step 4: عدّل `login.js`** ليملأ الحقول من متغيرات البيئة داخل `if (import.meta.env.DEV)` فقط ويُخفي الأزرار عند غيابها.
- [ ] **Step 5: أضف أنماط الأزرار** إلى `login-extra.css` بالهاتف أولاً و`min-width` فقط.
- [ ] **Step 6: أضف أسماء المتغيرات دون قيم إلى `.env.example`**، واكتب القيم الفعلية محلياً في `web/.env.development.local` من `tmp/phase1-test-accounts-*.csv` دون طباعتها.
- [ ] **Step 7: شغّل الاختبار و`npm run build` وتأكد من غياب القيم في `dist/assets`**.
- [ ] **Step 8: التزام**: `git commit -m "feat(dev): add local-only autofill login buttons"`.

### Task 5: التحقق والنشر

**Files:** لا ملفات جديدة؛ توثيق النتائج في سجل الالتزام.

- [ ] **Step 1: شغّل كل الاختبارات**: `node --test web/tests/*.test.mjs`.
- [ ] **Step 2: شغّل `npm run build` في `web/` وتأكد من نجاحه**.
- [ ] **Step 3: فحص ساكن**: لا `boot()` خارج `portal.js`، لا `@media (max-width`، لا كلمات مرور في `dist`، لا أسرار في Git.
- [ ] **Step 4: التزام أي إصلاحات ناتجة عن التحقق**.
- [ ] **Step 5: انشر عبر `npm run deploy:pages` وانتظر `status=built`**.
- [ ] **Step 6: تحقق `HTTP 200` للصفحات الثلاث وللأصول، وتأكد من غياب أزرار التطوير في النسخة المنشورة**.

# Header Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** جعل هيدر بوابات الويب ثلاثة عناصر على الهاتف: «القائمة» يميناً، عنوان الصفحة وسطاً، «رجوع» + الإشعارات يساراً، وحذف الإعدادات والخروج والبحث من الهيدر.

**Architecture:** إعادة ترتيب قالب `<header>` في `web/src/lib/layout.js` وإزالة مستمع زر الخروج العلوي؛ شبكة RTL بثلاث خانات في `portal-theme.css` الذي يُحمّل أخيراً، بقواعد mobile-first تبدأ من الهاتف ثم `@media (min-width: ...)`.

**Tech Stack:** HTML/CSS/vanilla JS (Vite، صفحات HTML مستقلة بلا React).

**Spec:** `docs/superpowers/specs/2026-11-25-header-redesign-design.md`

## Global Constraints

- لا React/SPA؛ الهيكل في `web/src/lib/layout.js`.
- `portal-theme.css` + `views/*.css` تبقى؛ لا تعديل على ملفات `views/*.css`.
- mobile-first صريح في الكود الجديد: الأساس للهاتف ثم `@media (min-width: ...)` فقط.
- روابط داخلية مسموحة: `http(s)` أو `pages/...` أو `guide.html/index.html/login.html`.
- احترام `prefers-reduced-motion`؛ لا أسرار في Git.
- البقاء متوافقاً مع أزرار الدخول الأربعة في صفحة الدخول.

## Review Focus

- شاشة 320px: العناصر الثلاثة لا تتداخل ولا يختفي عنوان الصفحة؛ اختبار: قواعد الشبكة في `portal-theme.css` تعطي العمود الأوسط `minmax(0, 1fr)` مع `text-overflow: ellipsis`.
- التنقّل الناعم: `updateShellTitle()` لا يزال يعمل بعد إعادة الترتيب؛ اختبار: ثبات صنف `.topbar-title h1`.
- فتح القائمة: زر «القائمة» بلا أيقونة لكن بمعرّف `menuBtn`؛ اختبار: ساكن يؤكد `id="menuBtn"` وعدم وجود `icon("menu")` داخله.
- تسجيل الخروج: لا معالج معلّق على معرّف محذوف؛ اختبار: ساكن يمنع `logoutBtnTop` في `layout.js`.
- rtl: ترتيب DOM `[menu, title, bell, back]` كي يظهر «رجوع» أقصى اليسار؛ اختبار ساكن بالترتيب.

---

### Task 1: إعادة ترتيب الهيدر وإزالة المستمعات

**Files:**
- Modify: `web/src/lib/layout.js` (قالب `renderShell`، دالة `bindShell`)
- Test: `web/tests/shell.test.mjs` (جديد)

**Interfaces:**
- Consumes: `navFor`, `icon`, `esc`, `signOut`, `homeOf`, `p`, `onDispose` كما هي اليوم.
- Produces: قالب هيدر بثلاث خانات بمعرّفات `menuBtn` و`backBtn` ورابط `pages/notifications.html`.

- [ ] **Step 1: Write the failing test**

Create `web/tests/shell.test.mjs` with `readFileSync(new URL("../src/lib/layout.js", import.meta.url), "utf8")` and assertions:
- `header` contains `id="menuBtn"` with visible text `القائمة` and no `${icon("menu")}` inside that button.
- the order in the template is `menuBtn` → `topbar-title` → `notifications` → `backBtn`.
- no `logoutBtnTop`, no `icon("settings")`, no `search-box` in the header.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test web/tests/shell.test.mjs`
Expected: FAIL on the button order/removed controls.

- [ ] **Step 3: Restructure `renderShell` and `bindShell`**

In `renderShell`, replace `.topbar-left`, `.search-box--static` and `.topbar-actions` with:
`<button class="menu-btn" id="menuBtn" ...>القائمة</button>` → `<div class="topbar-title">…</div>` → `<div class="topbar-end"><a class="icon-btn topbar-notif" href="${p("pages/notifications.html")}" aria-label="الإشعارات" title="الإشعارات">${icon("bell")}</a><button class="topbar-back" id="backBtn" data-fallback="…" aria-label="رجوع" title="رجوع"><span class="back-label">رجوع</span></button></div>`.
In `bindShell`, delete the `logoutBtnTop` listener only; keep `logoutBtn` in the sidebar.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test web/tests/shell.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

`git add web/src/lib/layout.js web/tests/shell.test.mjs && git commit -m "refactor(shell): simplify header to three mobile controls"`

### Task 2: أنماط mobile-first للهيدر

**Files:**
- Modify: `web/public/css/portal-theme.css`
- Test: `web/tests/shell.test.mjs` (إضافة تحققات ساكنة للقواعد)

**Interfaces:**
- Consumes: `.topbar`, `.menu-btn`, `.topbar-title`, `.topbar-back`, `.icon-btn`, `.topbar-end` من Task 1.
- Produces: قواعد شبكة نهائية تُطبَّق على كل صفحات البوابات.

- [ ] **Step 1: Write the failing test**

Add to `web/tests/shell.test.mjs`: read `portal-theme.css` and assert it contains `grid-template-columns: auto minmax(0, 1fr) auto` and `@media (min-width:` for the header rules; assert there is no `@media (max-width:` in the newly added header block.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test web/tests/shell.test.mjs`
Expected: FAIL on missing grid rule.

- [ ] **Step 3: Add mobile-first CSS**

Append to `portal-theme.css`: base `.topbar { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 8px; padding: 0 12px; }`, `.topbar-title { text-align: center; }`, `.topbar-title h1 { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }`, `.topbar-end { display: flex; align-items: center; gap: 4px; }`, `.menu-btn { width: auto; min-width: 40px; padding: 0 12px; }`, `.topbar-notif { width: 40px; height: 40px; }`. Add only `@media (min-width: 640px)` for larger gap/padding and `@media (min-width: 900px)` for a larger title font. Keep `prefers-reduced-motion` untouched.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test web/tests/shell.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

`git add web/public/css/portal-theme.css web/tests/shell.test.mjs && git commit -m "style(shell): mobile-first three-slot header"`

### Task 3: تحقق ونشر

**Files:**
- Modify: none (verification and deployment)

- [ ] **Step 1: Run full test suite**

Run: `node --test web/tests/*.test.mjs`
Expected: all tests pass.

- [ ] **Step 2: Build and deploy**

Run in `web/`: `npm run build:dev` then `npm run deploy:pages`.
Expected: build succeeds, "Published".

- [ ] **Step 3: Verify live**

Wait for Pages status `built`; fetch `login.html` and a portal page, assert HTTP 200, the four dev buttons still present, and `web/dist/pages/student/dashboard.html` scripts resolve.

- [ ] **Step 4: Merge and push**

From `D:\Projects\alzain-academy`: `git merge --ff-only ux-performance && git push origin main`.

# إدارة المالك الكاملة Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** تحويل بوابة المالك في الواجهة الثابتة إلى إدارة فعلية للمستخدمين والمقررات والطلاب عبر دوال Supabase محمية وEdge Function آمنة، دون تغيير نموذج الصلاحيات الحالي.

**Architecture:** تُضاف ترحيل SQL واحد `0114` يحمل كل دوال `management_*` الجديدة والمعدّلة، وتُستخدم Edge Function واحدة لعمليات Supabase Auth فقط؛ تستدعي Edge Function دوال البيانات بجلسة المالك نفسها حتى يعمل `auth.uid()` داخل الدوال. الواجهة تستدعي RPC مباشرة للبيانات، ودالة خلفية واحدة لكل ما يخص Auth. الأجزاء مترابطة عبر واجهات RPC، لذلك خطة واحدة متسلسلة لا خطط منفصلة.

**Tech Stack:** PostgreSQL/PLpgSQL، Supabase Auth Admin API، Deno Edge Function، Vite/ES modules، Node test runner، CSS عربية RTL.

**Spec:** `docs/superpowers/specs/2026-11-25-owner-full-management-design.md`

## Global Constraints

- الواجهة الثابتة `web/` هي الإنتاج؛ Express/EJS أرشيف محلي فقط ولا يُعاد إحياؤه.
- أربع بوابات، واجهة عربية RTL، والحفاظ على كل الأزرار والوظائف الحالية وإضافة الجديد إليها.
- كل كتابة تبقى عبر `management_*` محمية بـ `public.is_owner()`؛ الأستاذ يملك فقط `teacher_create_assignment`.
- لا كتابة مباشرة من المتصفح على `users` أو `courses` أو `enrollments`؛ لا قيمة `service_role` في `web/` أو في أي commit.
- الدخول بالرمز كما هو: بريد Auth مشتق من `platform_id`، والبريد الحقيقي بيانات مراسلة في `users.email` فقط.
- لا بادئة `AD` للمستخدمين الجدد؛ `bachelor` مسموح للمقرر فقط ولا يُقبل كمسار حساب طالب.
- حذف نهائي بعد معاينة أثر صريحة؛ `audit_logs` لا يمنع الحذف؛ المالك والمقررات/المؤلفات المسندة تمنع الحذف حتى إعادة الإسناد.
- نقل الطالب وتغيير المسار يُوقفان السجل القديم ويحفظان الدرجات والحضور والتسليمات والنقاط.
- تعطيل المستخدم يحظر جلسات Auth فوراً ويزيل الحظر عند التفعيل.
- تسجيل `bachelor_m`/`bachelor_f` في مسار يشمل المقرر الأصلي `bachelor` وفرع الجنس معاً.
- لا بيانات تجريبية، لا اسم مالك ثابت، لا كلمات مرور أو أسرار في الكود أو Git.
- لا تطبيق ترحيل، ولا نشر Edge Function، ولا نشر GitHub Pages، ولا تشغيل `deploy:dev` دون موافقة صريحة منفصلة.

## Review Focus

- **غير مالك يستدعي Edge Function أو RPC كتابة:** يجب أن يُرفض قبل أي تغيير؛ اختباره في المهمة 1 (نص الحارس) والمهمة 2 (تحقق التوكن وحارس `is_owner_by_auth_uid`).
- **إنشاء مستخدم بدور/مسار جديد:** يجب أن ينتج البادئة الصحيحة وبريد الدخول المشتق، ويرفض `AD` و`bachelor`؛ اختباره في المهمة 1 والمهمة 2 والمهمة 4.
- **حذف مرتبط بسجلات أو مقرر له فروع:** يجب أن يعرض العدد ويمنع الحذف عند وجود مقررات/مؤلفات مسندة، ولا يُمنع بسبب `audit_logs`؛ اختباره في المهمة 1 والمهمة 4 والمهمة 5.
- **نقل طالب لديه درجات:** يجب أن يُوقف تسجيله القديم ويبقى سجله الأكاديمي محفوظاً؛ اختباره في المهمة 1 والمهمة 6.
- **زر «إنشاء مقرر» و`?new=1`:** يجب أن يفتح النموذج في مكانه ويستقبل التركيز، ولا ينقل الصفحة للأسفل، ويجعل الرمز قابلاً للتعديل فعلياً؛ اختباره في المهمة 3 والمهمة 5.

---

### Task 1: ترحيل `0114` وملف التراجع

**Files:**
- Create: `supabase/migrations/0114_owner_full_management.sql`
- Create: `supabase/rollback/0114_owner_full_management_rollback.sql`
- Test: `web/tests/owner-management-sql.test.mjs`

**Interfaces:**
- Consumes: `public.is_owner()`، `public.current_user_id()`، `public.audit_logs`، جداول `users` / `courses` / `enrollments`، الدوال الحالية في `0112` و`0113`.
- Produces (تواقيع نهائية يعتمد عليها باقي التنفيذ):
  - `public.is_owner_by_auth_uid(p_auth_uid uuid) returns boolean` — لـ `service_role` فقط.
  - `public.management_allocate_platform_id(p_role text, p_track text) returns text`
  - `public.management_create_user_profile(p_auth_id uuid, p_platform_id text, p_name text, p_email text, p_role text, p_phone text default null, p_track text default null, p_level smallint default null, p_university_id text default null, p_gender text default null, p_position text default null) returns jsonb`
  - `public.management_update_user(p_user_id bigint, p_name text, p_email text, p_phone text default null, p_university_id text default null, p_platform_id text default null, p_role text default null, p_track text default null, p_level smallint default null, p_gender text default null, p_position text default null) returns jsonb`
  - `public.management_set_user_active(p_user_id bigint, p_active boolean) returns jsonb`
  - `public.management_flag_password_change(p_user_id bigint, p_value boolean) returns jsonb`
  - `public.management_preflight_delete_user(p_user_id bigint) returns jsonb` → `{ok:true,data:{blockers:text[],counts:object}}`
  - `public.management_delete_user_finalize(p_user_id bigint, p_expected_auth_id uuid) returns jsonb`
  - `public.management_update_course(p_course_id bigint, p_title text, p_description text default null, p_color text default null, p_archived boolean default null, p_track text default null, p_level smallint default null, p_attendance_weight numeric default null, p_exams_weight numeric default null, p_assignments_weight numeric default null, p_teacher_id bigint default null, p_code text default null) returns jsonb` — يُسقط التوقيع القديم ذي 11 معامل صراحةً.
  - `public.management_preflight_delete_course(p_course_id bigint) returns jsonb` → `{ok:true,data:{blockers:text[],counts:object}}`
  - `public.management_delete_course(p_course_id bigint) returns jsonb`
  - `public.management_change_student_track(p_student_id bigint, p_track text, p_level smallint default null, p_sync_enrollments boolean default true) returns jsonb`
  - `public.management_enroll_student_in_track(p_student_id bigint, p_track text, p_level smallint default null) returns jsonb`
  - `public.management_transfer_student(p_student_id bigint, p_from_course_id bigint, p_to_course_id bigint) returns jsonb`
  - `public.management_set_enrollment_status(p_course_id bigint, p_student_id bigint, p_status text) returns jsonb`
  - `public.management_remove_enrollment(p_course_id bigint, p_student_id bigint) returns jsonb`

- [ ] **Step 1: Write the failing SQL contract test**

Create `web/tests/owner-management-sql.test.mjs` with `node:test` and `node:assert/strict`. Read the migration and rollback with `readFileSync(new URL("../../supabase/migrations/0114_owner_full_management.sql", import.meta.url), "utf8")`. Assertions:
- The migration contains every function name in the Interfaces list.
- Every `management_*` function body contains `public.is_owner()` and `public.current_user_id()`.
- `management_allocate_platform_id` maps `teacher→TE`, `assistant→AS`, and `bachelor_m/bachelor_f/equiv/external/grad→BM/BF/EQ/EX/PG`; the migration contains no `'AD'` assignment and no student-track `bachelor` acceptance.
- `management_enroll_student_in_track` and `management_change_student_track` mention `parent_course_id` and `archived` so parent+branch and archived exclusion are pinned.
- `management_change_student_track` and `management_transfer_student` set `status = 'suspended'` on the old enrollment and do not contain `delete from public.enrollments`.
- `management_preflight_delete_user` counts `courses.teacher_id` and `publications.author_id`, and its finalize function does not treat `audit_logs` as a blocker.
- `management_preflight_delete_course` counts `parent_course_id`, `lectures`, `exams`, `assignments`, and `enrollments`.
- The migration drops the old `management_update_course(bigint,text,text,text,boolean,text,smallint,numeric,numeric,numeric,bigint)` signature and grants only `authenticated` on the new functions.
- The rollback file contains a `drop function if exists` statement for every new function name.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd web && node --test tests/owner-management-sql.test.mjs`  
Expected: FAIL because `supabase/migrations/0114_owner_full_management.sql` does not exist.

- [ ] **Step 3: Implement `supabase/migrations/0114_owner_full_management.sql`**

Use `create or replace function`, `language plpgsql`, `security definer`, `set search_path = public` for all functions. Begin every owner function with the same `current_user_id() is null or not is_owner()` guard and return `{ok:false,error:'not allowed'}` on failure. Write one `audit_logs` row per successful write (`action`, `table_name`, `record_id`, `new_data`). Revoke from `public, anon`, grant to `authenticated`; grant `is_owner_by_auth_uid` only to `service_role`. Use a transaction and end with `notify pgrst, 'reload schema'`. Redefine the existing `0112`/`0113` management functions with their current signatures plus audit logging, without changing their behavior.

- [ ] **Step 4: Implement `supabase/rollback/0114_owner_full_management_rollback.sql`**

Drop every function from the Interfaces list with exact signatures, recreate the 11-argument `management_update_course` signature with the behavior from `0113`, revoke the new grants, and end with `notify pgrst, 'reload schema'`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd web && node --test tests/owner-management-sql.test.mjs`  
Expected: PASS with all contract assertions green.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0114_owner_full_management.sql supabase/rollback/0114_owner_full_management_rollback.sql web/tests/owner-management-sql.test.mjs
git commit -m "feat(db): add owner user/course/student management RPCs (0114)"
```

---

### Task 2: Edge Function وعميل Auth المشترك

**Files:**
- Create: `supabase/functions/owner-user-admin/index.ts`
- Create: `web/src/lib/owner-admin.js`
- Test: `web/tests/owner-admin.test.mjs`

**Interfaces:**
- Consumes: Task 1 `is_owner_by_auth_uid`, `management_create_user_profile`, `management_set_user_active`, `management_flag_password_change`, `management_delete_user_finalize`.
- Produces:
  - `web/src/lib/owner-admin.js` exports `generateTemporaryPassword(): string` and `invokeOwnerAdmin(payload: object, client = supabase): Promise<{ok:boolean; data?:unknown; error?:string}>`.
  - Edge Function accepts `{op, ...}` where `op` is one of `create`, `reset_password`, `ensure_auth`, `sync_auth_identity`, `set_active`, `delete_user`; every response is `{ok,data}` or `{ok:false,error,code}`.

- [ ] **Step 1: Write the failing owner-admin test**

Create `web/tests/owner-admin.test.mjs`. Assertions:
- `generateTemporaryPassword()` returns 12 characters, all inside `ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789`, and contains none of `0`, `O`, `1`, `l`, `I`.
- `invokeOwnerAdmin({op:"create", user_id:7}, fakeClient)` calls `fakeClient.functions.invoke("owner-user-admin", {body:{op:"create",user_id:7}})` once and returns the unwrapped `{ok:true,data:...}` payload.
- When `client.functions?.invoke` is missing, `invokeOwnerAdmin(...)` returns `{ok:false,error:"Supabase Functions غير مهيأ"}` and does not throw.
- Static read of `supabase/functions/owner-user-admin/index.ts` asserts it contains all six `op` names, calls `is_owner_by_auth_uid`, reads the service-role key from `Deno.env.get(...)` with no literal secret, and forwards the incoming `Authorization` header when invoking RPCs.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd web && node --test tests/owner-admin.test.mjs`  
Expected: FAIL because neither `owner-admin.js` nor the Edge Function exists.

- [ ] **Step 3: Implement `web/src/lib/owner-admin.js`**

Implement the two exports exactly as declared. `generateTemporaryPassword` must use `crypto.getRandomValues`, not `Math.random`. `invokeOwnerAdmin` must pass the payload through unchanged, unwrap Supabase's `{data,error}` envelope, and return the clear error text above when `functions.invoke` is unavailable.

- [ ] **Step 4: Implement `supabase/functions/owner-user-admin/index.ts`**

Verify the bearer token with an anon client, call `is_owner_by_auth_uid` with a `service_role` client, and reject any failure with `{ok:false,error:'not_allowed'}`. Use the `service_role` client only for Auth Admin operations. For all `management_*` RPC calls, create a client whose global headers include the caller's original `Authorization` value. Implement:
- `create`: derive Auth email from `platform_id` and role (`@students.local` / `@staff.local`), create the Auth user with the supplied temporary password and `must_change_password` metadata, then call `management_create_user_profile`; delete the Auth user as compensation if profile creation fails.
- `reset_password` and `ensure_auth`: update or create the Auth user with a supplied temporary password, then call `management_flag_password_change`.
- `sync_auth_identity`: update only the Auth email and `app_metadata` to the new `platform_id`/role; the profile row is already written by the caller via `management_update_user`.
- `set_active`: set or clear `ban_duration` in Auth and call `management_set_user_active`.
- `delete_user`: call `management_preflight_delete_user`, log the expected Auth uid, delete the Auth user, then call `management_delete_user_finalize` with the caller's token; return a retryable error if finalize fails.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd web && node --test tests/owner-admin.test.mjs`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/owner-user-admin/index.ts web/src/lib/owner-admin.js web/tests/owner-admin.test.mjs
git commit -m "feat(web): add owner Auth admin client and Edge Function"
```

---

### Task 3: مشترك الواجهة — التنقل، الكاش، الأنماط

**Files:**
- Modify: `web/src/pages/owner/dashboard.js:17-22`
- Modify: `web/src/lib/cache-policy.js:23-46`
- Modify: `web/public/css/views/owner-dashboard.css:371-406`
- Test: `web/tests/owner-management-shell.test.mjs`

**Interfaces:**
- Consumes: none beyond existing helpers `p()`, `icon()`, `esc()`.
- Produces: dashboard action URLs with `?new=1`; `INVALIDATES` entries for every new RPC; active `.od-btn` rules and form/grid/message styles.

- [ ] **Step 1: Write the failing shell test**

Create `web/tests/owner-management-shell.test.mjs` using `node:test`. Assertions:
- `dashboard.js` first two `ACTIONS` entries have `href` values `pages/owner/users.html?new=1` and `pages/owner/courses.html?new=1`; the report and guide entries remain unchanged.
- `cache-policy.js` `INVALIDATES` contains every `management_*` function name from Task 1.
- In `owner-dashboard.css`, the count of `/*` equals the count of `*/`, `/* === od-btn variants === */` appears as a closed comment, and `.od-btn{` appears after that comment.
- The stylesheet defines `.od-form`, `.od-field`, `.od-table`, `.od-inline-msg`, `.od-grid`, and `.od-actions-grid`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd web && node --test tests/owner-management-shell.test.mjs`  
Expected: FAIL on the action URLs and the unclosed CSS comment.

- [ ] **Step 3: Implement the shell changes**

Change only the two dashboard `href` values. Add every new RPC name to `INVALIDATES`. Close the CSS comment at line 371 and add focused RTL styles for the form/table/grid/message classes, keeping existing `.od-btn` rules intact.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd web && node --test tests/owner-management-shell.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/owner/dashboard.js web/src/lib/cache-policy.js web/public/css/views/owner-dashboard.css web/tests/owner-management-shell.test.mjs
git commit -m "fix(web): wire owner quick actions and restore dashboard styles"
```

---

### Task 4: صفحة المستخدمين — إضافة وتعديل وحذف

**Files:**
- Modify: `web/pages/owner/users.html:20-51`
- Modify: `web/src/pages/owner/users.js`
- Test: `web/tests/owner-users-ui.test.mjs`

**Interfaces:**
- Consumes: `invokeOwnerAdmin`، `generateTemporaryPassword` from Task 2; Task 1 RPC signatures; Task 3 styles.
- Produces: row actions with `data-action` values `edit`, `toggle`, `reset`, `ensure`, `delete`; a creation form that opens when `?new=1`.

- [ ] **Step 1: Write the failing users UI test**

Create `web/tests/owner-users-ui.test.mjs`. Assertions:
- `users.html` does not contain `قراءة فقط`; it contains `ouNewBtn`, `ouFormPanel`, and form field names `name`, `email`, `phone`, `role`, `track`, `level`, `university_id`, `position`, `temporary_password`.
- `users.js` imports `invokeOwnerAdmin` and `generateTemporaryPassword`.
- `users.js` calls `management_allocate_platform_id`, `management_update_user`, `management_set_user_active`, `management_flag_password_change`, `management_preflight_delete_user`, and `management_delete_user_finalize`.
- The `op:"create"` payload passed to `invokeOwnerAdmin` includes `password`, `platform_id`, `name`, `email`, `phone`, `role`, `track`, `level`, `university_id`, `gender`, and `position`.
- `users.js` contains `data-action="edit"`, `data-action="toggle"`, `data-action="reset"`, `data-action="ensure"`, `data-action="delete"`.
- `users.js` reads `URLSearchParams(location.search).get("new")` and opens the form when it equals `"1"`.
- The refresh button still includes `<span class="od-btn-spinner"></span>` after render.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd web && node --test tests/owner-users-ui.test.mjs`  
Expected: FAIL on the read-only text and missing import.

- [ ] **Step 3: Implement the users page**

Update the intro text to describe full management. Add an actions section with `ouNewBtn` and a hidden `ouFormPanel` containing the fields above. In `users.js`, keep the existing filters and refresh behavior, restore the spinner span on refresh, render the five row actions, and implement:
- create: allocate `platform_id`, generate a temporary password, invoke `owner-user-admin` with `op:"create"` and the exact fields asserted above; the Edge Function creates the Auth user and the profile row, so the browser shows the password once in an `od-inline-msg` and does not call `management_create_user_profile` itself.
- edit: call `management_update_user`, and if role or `platform_id` changed also invoke `op:"sync_auth_identity"`.
- toggle: call `management_set_user_active` and invoke `op:"set_active"`; show a confirmation that sessions will be revoked.
- reset/ensure: generate a temporary password and invoke `op:"reset_password"` or `op:"ensure_auth"`.
- delete: call `management_preflight_delete_user`, show the returned counts and blockers in a confirmation dialog, then invoke `op:"delete_user"`; refresh only after the response reports success.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd web && node --test tests/owner-users-ui.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/pages/owner/users.html web/src/pages/owner/users.js web/tests/owner-users-ui.test.mjs
git commit -m "feat(web): enable full owner user management"
```

---

### Task 5: صفحة المقررات — إنشاء في المكان وحذف محمي

**Files:**
- Modify: `web/pages/owner/courses.html:28-66`
- Modify: `web/src/pages/owner/courses.js`
- Test: `web/tests/owner-courses-ui.test.mjs`

**Interfaces:**
- Consumes: Task 1 `management_update_course` new signature, `management_preflight_delete_course`, `management_delete_course`; Task 3 styles.
- Produces: top action `ocNewBtn` opens `ocFormPanel` in place; delete row action with `data-action="delete"`.

- [ ] **Step 1: Write the failing courses UI test**

Create `web/tests/owner-courses-ui.test.mjs`. Assertions:
- In `courses.html`, the `ocFormPanel` section starts before the `ocListTitle` section.
- `courses.js` reads `URLSearchParams(location.search).get("new")` and opens the form when it equals `"1"`.
- The `ocNewBtn` handler does not contain `scrollIntoView`, `location.hash`, or `window.scrollTo`.
- The `ocNewBtn` handler calls `focus()` on the title input after unhiding the panel.
- `courses.js` passes `p_code` to `management_update_course`.
- `courses.js` calls `management_preflight_delete_course` before `management_delete_course` and renders a row action `data-action="delete"`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd web && node --test tests/owner-courses-ui.test.mjs`  
Expected: FAIL because the form is still after the list and delete is not wired.

- [ ] **Step 3: Implement the courses page**

Move the `ocFormPanel` section directly after the actions section. Rewrite `ocNewBtn` to reset the form, clear `dataset.editId`, unhide the panel, and focus the title field; do not scroll. Keep the existing edit and archive actions. Include `p_code` in both create and update parameter objects. Add a delete action that first displays the preflight counts in `confirm()`, then calls `management_delete_course`, then reloads the list.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd web && node --test tests/owner-courses-ui.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/pages/owner/courses.html web/src/pages/owner/courses.js web/tests/owner-courses-ui.test.mjs
git commit -m "feat(web): create and delete courses from owner page top"
```

---

### Task 6: صفحة الطلاب — إنشاء وتسجيل ونقل

**Files:**
- Modify: `web/pages/owner/students.html:28-43`
- Modify: `web/src/pages/owner/students.js`
- Test: `web/tests/owner-students-ui.test.mjs`

**Interfaces:**
- Consumes: Task 1 track/enrollment RPCs; Task 2 `invokeOwnerAdmin` and `generateTemporaryPassword`; Task 3 styles.
- Produces: top actions `ostNewBtn`, `ostEnrollBtn`, `ostTransferBtn`, `ostTrackBtn`; row actions for enrollment operations.

- [ ] **Step 1: Write the failing students UI test**

Create `web/tests/owner-students-ui.test.mjs`. Assertions:
- `students.html` contains the four top action buttons listed above, a track filter `ostTrackFilter`, and panels/forms for new student, existing enrollment, transfer, and track change.
- The existing `ostEnrollForm`, `ostCourse`, `ostSubmitBtn`, and `ostEnrollMsg` identifiers still exist.
- `students.js` imports `invokeOwnerAdmin` and `generateTemporaryPassword`.
- `students.js` calls `management_enroll_student`, `management_enroll_student_in_track`, `management_transfer_student`, `management_change_student_track`, `management_set_enrollment_status`, and `management_remove_enrollment`.
- The new-student flow passes `op:"create"` to `invokeOwnerAdmin` with `password`, `platform_id`, `name`, `email`, `phone`, `role:"student"`, `track`, `level`, `university_id`, and `gender`.
- Course options include `track` and `level` in their label, and the UI contains explanatory text that `bachelor_m`/`bachelor_f` registration includes the parent course and the gender branch.
- The students table renders row actions `data-action` values `enroll`, `transfer`, `track`, `suspend`, `remove`, `reset`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd web && node --test tests/owner-students-ui.test.mjs`  
Expected: FAIL on the missing action buttons and RPC calls.

- [ ] **Step 3: Implement the students page**

Preserve the existing enrollment form and add the new panels/actions above the list. Load courses with `id, title, code, track, level` and group them by track/level; add a track filter that works on both the course selects and the students table. Implement:
- new student: allocate `platform_id`, generate a temporary password, invoke `op:"create"` with the exact fields asserted above, then optionally call `management_enroll_student_in_track` or `management_enroll_student`.
- existing enrollment: keep the current identifier flow and add an optional track selection that uses `management_enroll_student_in_track`.
- transfer/track change: call `management_transfer_student` or `management_change_student_track`, and show a confirmation that the old enrollment will be suspended, not deleted.
- suspend/remove: call `management_set_enrollment_status` or `management_remove_enrollment`.
- reset: generate a temporary password and invoke `op:"reset_password"`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd web && node --test tests/owner-students-ui.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/pages/owner/students.html web/src/pages/owner/students.js web/tests/owner-students-ui.test.mjs
git commit -m "feat(web): full owner student registration and transfer"
```

---

### Task 7: تحقق محلي شامل

**Files:** None unless a verification step reveals a defect.

**Interfaces:**
- Consumes: all tasks above.
- Produces: green local test suite and successful production build; no production changes.

- [ ] **Step 1: Run the complete local test suite**

Run: `cd web && node --test tests/*.test.mjs`  
Expected: all tests PASS, including the existing cache, navigation, and shell tests.

- [ ] **Step 2: Run the production build**

Run: `cd web && npm run build`  
Expected: exit code 0 and `web/dist/` regenerated with the new owner pages.

- [ ] **Step 3: Confirm the working tree contains only intended files**

Run: `git status --short`  
Expected: no unexpected files and no `.env`, key, or password file.

- [ ] **Step 4: Perform a local browser checklist without deploying**

Start `cd web && npm run dev`, then verify in a browser: the dashboard actions open `?new=1`, the course form opens at the top and the title receives focus, a course code can be edited, delete dialogs show preflight counts, the user form shows the allocated platform code and password once, the students page lists all tracks and supports new/enroll/transfer/suspend/reset. Close the dev server when finished.

- [ ] **Step 5: Record the verification result in the final response**

Report the exact commands run and their results. Do not apply `0114`, deploy the Edge Function, or publish GitHub Pages in this task.

- [ ] **Step 6: Commit only fixes found during verification**

If Step 1–4 found no defects, do not commit. If fixes were needed, commit them with `git commit -m "fix(web): address owner management verification findings"`.

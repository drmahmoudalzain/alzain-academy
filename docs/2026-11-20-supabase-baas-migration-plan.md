# خطة تحويل منصة آل الزين إلى نمط BaaS — Supabase خادماً وقاعدة بيانات، وFirebase Hosting للواجهة

**التاريخ:** 2026-11-20
**المستودع:** `drmahmoudalzain/alzain-academy`
**الحالة:** خطة مقترحة — تنتظر موافقة المالك قبل أي تنفيذ
**المرجع المعماري:** منصة الزين الرقمية (`D:\Projects\alzain-platform`، مشروع Supabase `ynugoeslnbxeolugsxtz`)

---

## 0. الملخص التنفيذي

نحوّل المنصة من تطبيق **Express + EJS** يعمل على خادم دائم، إلى **تطبيق واجهة ثابتة** (Vite) على Firebase Hosting يتصل مباشرة بـ **Supabase** (Auth + Postgres + RLS + RPC + Storage + Realtime + Edge Functions).

**ما يتحقق:**
- لا VM، لا نفق Cloudflare، لا Cloud Run، لا بطاقة دفع.
- Firebase Hosting (خطة Spark) يستضيف الملفات فقط.
- Supabase Free يكفي لحجم البيانات الحالي (311 مستخدماً).
- كل منطق العمل الحسّاس يبقى على الخادم — لكن الخادم الآن **PostgreSQL**، لا Node.

**الثمن:**
- إعادة كتابة طبقة الوصول (309 استدعاء) وطبقة العرض (40+ صفحة EJS).
- كتابة سياسات RLS لكل جدول — وهي **خط الدفاع الأول** بعد إزالة Express.
- المدة التقديرية: **12–14 أسبوعاً** لمطوّر واحد، أو **8–9 أسابيع** لمطوّرين يعملان بالتوازي.

**قرار جوهري يقلّل المخاطر:** نُبقي جداول `alzain-academy` ومفاتيحها `bigint` كما هي، ونضيف عمود ربط `auth_id uuid` إلى `users`. لا نعيد تصميم قاعدة البيانات ولا ننقل بياناتها. الترحيل **إضافي (additive)**، ويمكن تنفيذه بينما يظل تطبيق Express يعمل.

---

## 1. السياق والهدف

### 1.1 الوضع الحالي

| العنصر | الواقع |
| --- | --- |
| التطبيق | Express 5 + EJS، عرض من الخادم |
| استدعاءات قاعدة البيانات | **309** موزعة على 22 ملفاً |
| المسارات | ~100 مسار HTTP |
| الجداول | ~28 جدولاً حياً، ترحيلات `0001`–`0014` |
| المصادقة | `scrypt` مخصص + جدول `sessions` + كوكي `HttpOnly` + قفل بعد 5 محاولات |
| الهوية | رمز المنصة: `AD/TE/AS/BM/BF/EQ/EX/PG` |
| الملفات | قرص الخادم `uploads/publications` |
| الدردشة | WebSocket + إشارات WebRTC في `chat-ws.js` |
| الذكاء الاصطناعي | مفتاح Gemini داخل جدول `settings` ويُستخدم على الخادم |
| التشغيل | جهاز Windows + Cloudflare Quick Tunnel |

### 1.2 الهدف

1. إزالة الخادم الدائم نهائياً.
2. استضافة الواجهة على Firebase Hosting.
3. إبقاء Supabase هي الخادم الخلفي وقاعدة البيانات.
4. الحفاظ على السلوك الوظيفي والأمان — وعدم كسر أي شيء أثناء الانتقال.

### 1.3 ما لا يتغير

- بيانات المستخدمين والمقررات والدرجات (لا حذف، لا إعادة كتابة تاريخية).
- منطق التقييم (300 نقطة) وقواعده.
- الهوية البصرية وCSS الحالي.
- أسماء البوابات الأربع وصلاحياتها.

### 1.4 المبادئ غير القابلة للتفاوض

| # | المبدأ |
| --- | --- |
| P1 | لا يُوضع `service_role` في الواجهة أو في Git — فقط في Edge Functions/CLI. |
| P2 | لا منطق تقييم أو صلاحيات في المتصفح. كل كتابة حسّاسة عبر RPC `security definer`. |
| P3 | RLS مفعّلة على كل جدول، و`anon` ممنوع من كل شيء افتراضياً (deny by default). |
| P4 | لا كلمات مرور نصية مخزّنة. |
| P5 | كل عنصر قاعدة بيانات = ترحيل مستقل + rollback + اختبار. |
| P6 | لا نشر إنتاجي دون طلب صريح من المالك في تلك الجلسة. |
| P7 | التحقق سلوكي: نجاح البناء ليس دليلاً. |

---

## 2. دراسة المرجع: منصة الزين الرقمية

### 2.1 البنية الفعلية

```
web/ (React 19 + TS + Vite)
   └── Firebase Hosting (dist/)
         │ supabase-js + المفتاح العام (publishable)
         ▼
Supabase (ynugoeslnbxeolugsxtz — eu-west-1 — PG 17)
   ├── Auth (email/password)
   ├── Postgres + RLS
   ├── RPC (security definer) ← كل منطق العمل
   ├── Storage
   ├── Realtime
   └── Edge Functions (Deno)
```

**الأدلة المقروءة:**
- `AGENTS.md`: «كل منطق العمل داخل دوال Postgres RPC — لا يُعاد بناؤه في العميل».
- `web/firebase.json`: SPA rewrite إلى `index.html`، وترويسات كاش.
- `supabase/migrations/` (63 ترحيلاً) + `rollback/` + `tests/`.
- `web/src/lib/api.ts`: عقد واحد `rpc<T>(fn, params)` + قراءات جدول محدودة.

### 2.2 المصادقة

- الطالب: `signInWithPassword({ email: `${universityId}@students.local`, password })`.
- الأستاذ/الإدارة: بريد حقيقي + كلمة مرور.
- إنشاء الحسابات عبر Edge Functions (`create-student`, `create-teacher`) تستخدم `service_role` بعد التحقق من هوية المستدعي ودوره.
- `auth.users` → trigger `handle_new_user` ينشئ `public.profiles` تلقائياً.

### 2.3 الأمان

- RLS على كل جدول + دوال مساعدة `is_admin()`, `is_course_instructor()`, `is_course_member()`.
- `revoke all ... from anon, authenticated` ثم منح محدّد فقط.
- قفل الدوال الداخلية (`handle_new_user`, `gen_student_password`, …) بمنحها لـ`service_role` فقط.
- `audit_logs` لكل عملية حساسة.
- إخفاء كلمات المرور من قوائم الجملة (`has_password` بدل النص).
- توليد كلمات المرور بـ`gen_random_bytes` لا `random()`.

### 2.4 ما نأخذه

| الممارسة | لماذا |
| --- | --- |
| كل منطق العمل في RPC | لا يمكن التلاعب بالدرجات من المتصفح |
| RLS + منح دنيا | خط دفاع مستقل عن الواجهة |
| `api.ts` كعقد واحد | نقطة تحكم واحدة في كل الاستدعاءات |
| ترحيل + rollback + اختبار SQL | تراجع آمن |
| Edge Functions للإدارة والذكاء الاصطناعي | إخفاء `service_role` والمفاتيح |
| إعادة استخدام مقبس Realtime واحد | تقليل التكلفة والاتصالات |
| `authErrors` / `rpcErrors` | تمييز الخطأ العابر عن المنطقي |

### 2.5 ما لا نأخذه

| الممارسة | لماذا |
| --- | --- |
| تخزين `login_password` النصي | alzain أسقطت الخزنة في `0010`؛ لا نعيدها |
| `rpc<T>()` يعيد `null` عند الخطأ | يخفي السبب؛ سنستخدم `{ ok, data, error }` |
| الاعتماد على `is_admin` فقط | alzain تحتاج فصل بوابات أدق (مالك/أستاذ/طالب/مساعد) |

---

## 3. البنية المستهدفة

### 3.1 المخطط

```
┌──────────────────────────── Firebase Hosting (Spark) ────────────────────────────┐
│  web/dist  →  index.html + assets + CSS + JS (Vite)                              │
│  rewrites: ** → /index.html                                                      │
└───────────────────────────────────┬──────────────────────────────────────────────┘
                                    │  supabase-js (publishable key + JWT المستخدم)
                                    ▼
┌──────────────────────────────── Supabase (Free) ─────────────────────────────────┐
│ Auth ──► JWT ──► PostgREST ──► RLS ──► Tables/Views                              │
│                                  └──► RPC (SECURITY DEFINER)                     │
│ Storage (private buckets + policies)                                             │
│ Realtime (Postgres Changes + Broadcast + Presence)                               │
│ Edge Functions (create-user, import-users, ai-*, publication-pdf)                │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 مسؤوليات الطبقات

| الطبقة | المسؤولية | ممنوع |
| --- | --- | --- |
| الواجهة | العرض، التنقل، التحقق الشكلي، استدعاء RPC | حساب الدرجات، فحص الصلاحيات النهائي |
| RLS | من يقرأ أي صف/عمود | الاعتماد على الواجهة |
| RPC | كل كتابة، كل حساب، كل تحقق | منح `authenticated` تنفيذ دوال داخلية |
| Edge Functions | إنشاء الحسابات، الاستيراد، AI، توليد PDF | تخزين أسرار في العميل |
| Storage | الملفات الخاصة | حاوية عامة |

### 3.3 المفاتيح

| المفتاح | المكان |
| --- | --- |
| `SUPABASE_URL` + `publishable/anon key` | `web/.env` (يُنشر) |
| `service_role` | Supabase Edge Functions secrets + CI فقط |
| `GEMINI_API_KEY` | Supabase Edge Function secrets |
| لا شيء آخر | — |

---

## 4. الهوية والمصادقة

### 4.1 ربط الحسابات القديمة

نضيف إلى الجدول الحالي:

```sql
alter table public.users
  add column if not exists auth_id uuid unique references auth.users(id) on delete cascade;

create index if not exists idx_users_auth_id on public.users(auth_id);
```

- تُنشأ حسابات `auth.users` لكل مستخدم قائم عبر Edge Function إدارية (Admin API).
- يُملأ `auth_id` بمطابقة `platform_id` أو البريد.
- تبقى كل المفاتيح `bigint` والفهارس الخارجية كما هي — **لا إعادة كتابة للجداول**.

### 4.2 الدخول برمز المنصة

| الدور | بريد الدخول الاصطناعي | كلمة المرور |
| --- | --- | --- |
| طالب | `{platform_id}@students.local` | تُولّد وتُسلّم مرة واحدة |
| أستاذ | `{platform_id}@staff.local` أو بريده الحقيقي | تُولّد وتُسلّم مرة واحدة |
| مالك | `AD0001@staff.local` | تُولّد وتُسلّم مرة واحدة |
| مساعد | `{platform_id}@staff.local` | تُولّد وتُسلّم مرة واحدة |

- يظل حقل `users.email` هو **بريد التواصل**، منفصلاً عن بريد الدخول.
- الواجهة تعرض حقل «الرمز» فقط، وتُحوّله داخلياً إلى البريد الاصطناعي — تماماً كما في المنصة المرجعية.

### 4.3 أول دخول

1. `must_change_password = true` في `users`.
2. بعد `signInWithPassword` تفحص الواجهة `must_change_password` وتوجّه إلى شاشة الإلزام.
3. تغيير كلمة المرور يتم عبر `supabase.auth.updateUser({ password })`.
4. ثم RPC `account_complete_first_login(p_email)`:
   - يتحقق أن `auth.uid()` يطابق المستخدم.
   - يحفظ بريد التواصل.
   - يصفّر `must_change_password`.

### 4.4 القفل والحدود — تغيير سلوك معلن

- `scrypt` و`failed_attempts` و`locked_until` **تخرج من الخدمة**؛ المصادقة تصبح مسؤولية GoTrue.
- Supabase يوفّر حدود معدل مدمجة على تسجيل الدخول.
- إن لزم قفل بعد 5 محاولات بدقة، الخيار الوحيد هو Edge Function وسيطة تسجّل المحاولات — **لا ننصح به** لأنه يعيد بناء ما تحاول إزالته.
- **القرار المطلوب:** قبول حدود Supabase + CAPTCHA عند الحاجة، مقابل التخلي عن القفل المخصص.

### 4.5 إنشاء الحسابات

| العملية | المسار |
| --- | --- |
| إنشاء طالب/أستاذ/مساعد | Edge Function `admin-create-user` (تتحقق من دور المستدعي) |
| استيراد Excel/CSV | Edge Function `admin-import-users` (دفعات، مع تقرير أخطاء) |
| إعادة تعيين كلمة المرور | Edge Function `admin-reset-password` (تعيد الكلمة مرة واحدة ولا تخزّنها) |
| تعطيل/تفعيل | RPC `owner_toggle_user` (لا يلمس `auth.users`، فقط `users.is_active`) |

### 4.6 الجلسات

- جدول `sessions` **يبقى** أثناء الانتقال (Express يحتاجه).
- بعد اكتمال التحول: `revoke all on public.sessions` ثم حذفه في ترحيل مستقل.
- لا تُستخدم الجلسات المخصصة في التطبيق الجديد إطلاقاً.

---

## 5. نموذج البيانات

### 5.1 قرار: لا نعيد تصميم الجداول

| الخيار | الأثر |
| --- | --- |
| تحويل كل المفاتيح إلى `uuid` | إعادة كتابة كل العلاقات والاستعلامات — خطر عالٍ |
| **إبقاء `bigint` + `auth_id`** ✅ | صفر تغيير في العلاقات؛ RLS تستخدم دالة وسيطة |

### 5.2 الجداول الحية (28)

`users`, `sessions`, `courses`, `enrollments`, `lectures`, `files`, `attendance`, `lecture_presence`, `questions`, `question_answers`, `exams`, `exam_questions`, `exam_attempts`, `exam_answers`, `assignments`, `submissions`, `notifications`, `notification_reads`, `settings`, `ai_messages`, `library_sections`, `library_items`, `points_ledger`, `archived_records`, `chat_rooms`, `chat_messages`, `publications`, `publication_reviews`.

### 5.3 إضافات مخططة

| العنصر | الغرض |
| --- | --- |
| `users.auth_id` | ربط الهوية |
| `users.must_change_password` (موجود) | أول دخول |
| `users.contact_email` أو إبقاء `email` | بريد التواصل |
| `audit_logs` | تتبع العمليات الحساسة (كما في المرجع) |
| `login_events` (اختياري) | سجل محاولات مرفوضة |
| View `public_stats` | إحصاءات الصفحة العامة بلا كشف جداول |
| View `lectures_public` | إخفاء `attendance_code` عن الطلاب |
| View `questions_public` | إخفاء `correct_index` قبل الإجابة |
| View `settings_public` | إخفاء `ai_api_key` |

### 5.4 الفهارس المطلوبة

- موجودة أغلبها في `0004`.
- تُضاف فهارس RLS: `enrollments(student_id, status)`, `courses(teacher_id, archived)`, `chat_messages(room_id, id desc)`, `notifications(audience, course_id, user_id)`, `exam_attempts(student_id, exam_id)`, `points_ledger(user_id, course_id)`.
- تُقاس الاستعلامات الثقيلة بـ`EXPLAIN (ANALYZE, BUFFERS)` قبل القبول.

---

## 6. الأمان: RLS والمنح

### 6.1 الدوال المساعدة

```sql
-- المستخدم الحالي (bigint) من JWT
create or replace function public.current_user_id()
returns bigint language sql stable security definer set search_path = public as $$
  select id from public.users where auth_id = auth.uid() and is_active = true;
$$;

create or replace function public.current_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.users where auth_id = auth.uid();
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role() = 'teacher'
    and public.current_user_id() = (select min(id) from public.users where role = 'teacher'), false);
$$;

create or replace function public.is_teacher() ...
create or replace function public.is_assistant() ...
create or replace function public.teaches_course(p_course bigint) ...
create or replace function public.enrolled_in(p_course bigint) ...
create or replace function public.can_view_student(p_student bigint) ...
```

كل الدوال: `security definer` + `set search_path = public` + `revoke from public, anon` + `grant to authenticated`.

### 6.2 مصفوفة RLS المختصرة

| الجدول | قراءة | كتابة |
| --- | --- | --- |
| `users` | الذات، المالك، الأستاذ لطلاب مقرراته (أعمدة محدودة)، المساعد (عرض) | الذات (الاسم/الهاتف/البريد عبر RPC)، المالك |
| `sessions` | لا شيء عبر API | لا شيء (يُحذف بعد التحول) |
| `courses` | المسجلون + الأستاذ + المالك + المساعد | أستاذ المقرر + المالك |
| `enrollments` | الذات + الأستاذ + المالك + المساعد | RPC فقط |
| `lectures` | المسجلون (عبر `lectures_public`) | أستاذ المقرر + المالك |
| `files` | المسجلون حسب النطاق | RPC + Storage |
| `attendance`, `lecture_presence` | الذات + الأستاذ + المالك | RPC فقط |
| `questions` | المسجلون (عبر `questions_public`) | أستاذ المقرر |
| `question_answers` | الذات + الأستاذ + المالك | RPC فقط |
| `exams` | المسجلون | أستاذ المقرر |
| `exam_questions` | **لا يوجد SELECT مباشر** | أستاذ المقرر عبر RPC |
| `exam_attempts`, `exam_answers` | الذات + الأستاذ + المالك | RPC فقط |
| `assignments` | المسجلون | أستاذ المقرر |
| `submissions` | الذات + الأستاذ + المالك | RPC فقط |
| `notifications` | حسب الجمهور (RLS) | RPC (أستاذ/مالك) |
| `settings` | `settings_public` فقط | المالك عبر RPC |
| `ai_messages` | الذات | RPC/Edge |
| `library_*` | كل مستخدم مسجل | الموظفون |
| `points_ledger` | الذات + الأستاذ + المالك | RPC فقط |
| `archived_records` | المالك | RPC |
| `chat_rooms` | أعضاء المقرر/العام | — |
| `chat_messages` | أعضاء الغرفة | RPC فقط |
| `publications` | المؤلف + المحكمون المعينون + المالك | RPC |
| `publication_reviews` | المحكم نفسه + المالك | RPC |

### 6.3 الأعمدة الحساسة

| العمود | الخطر | الحل |
| --- | --- | --- |
| `lectures.attendance_code` | تسريب رمز الحضور | View `lectures_public` + RPC |
| `questions.correct_index/indices` | تسريب الإجابة | View/RPC فقط |
| `exam_questions.correct_index/indices` | تسريب الإجابة | منع SELECT، RPC يعيد نسخة منقّاة |
| `users.password_hash` | لا يُستخدم بعد التحول | حذفه في ترحيل لاحق |
| `settings.ai_api_key` | تسريب مفتاح | يُنقل إلى Edge secrets |
| `users.failed_attempts/locked_until` | بلا معنى بعد GoTrue | حذفهما لاحقاً |

### 6.4 Storage

| الحاوية | المسار | سياسة القراءة | سياسة الكتابة |
| --- | --- | --- | --- |
| `platform-files` (خاصة) | `courses/{course}/lectures/{lecture}/...` | المسجلون/الأستاذ/المالك | الأستاذ/المالك |
| نفسها | `submissions/{assignment}/{student}/...` | الطالب صاحب المسار + الأستاذ | الطالب صاحب المسار |
| نفسها | `publications/{publication}/...` | المؤلف + المحكم + المالك | المؤلف (عند التقديم) |
| نفسها | `library/{item}/...` | كل مسجل | الموظفون |

- الروابط موقّعة ومؤقتة (60–300 ثانية).
- قيود الحجم والنوع: PDF/DOCX/PNG/JPG، بحد 25MB للمنشورات و50MB للمكتبة.

### 6.5 المنح

```sql
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon, public;
alter default privileges in schema public revoke all on tables from anon;
-- ثم منح authenticated ما يحتاجه فقط، ودوال RPC المصرّح بها فقط
```

---

## 7. منطق العمل: RPC

### 7.1 الاصطلاح

```sql
create or replace function public.student_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_uid bigint := public.current_user_id();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;
  -- ...
  return jsonb_build_object('ok', true, 'data', ...);
end;
$$;

revoke all on function public.student_dashboard() from public, anon;
grant execute on function public.student_dashboard() to authenticated;
```

**قواعد:**
- كل النتائج `jsonb` بالشكل `{ ok, data | error }`.
- التحقق من الهوية أولاً، ثم الصلاحية، ثم المدخلات.
- لا `dynamic SQL` بمدخلات مستخدم.
- كل دالة `impl` داخلية تُقفل (`revoke from authenticated`) ويُستدعى إليها من غلاف عام.

### 7.2 جرد المجالات

| المجال | مسارات Express اليوم | الدوال المستهدفة |
| --- | --- | --- |
| الحساب/الدخول | 7 | 6 RPC + Auth client |
| الطالب | 24 | 18 RPC |
| الأستاذ/الإدارة | ~50 | ~35 RPC |
| المالك | 17 | 12 RPC + 3 Edge |
| المساعد | 1 | 1 RPC |
| المنتدى | 3 | 2 RPC + Realtime |
| النشر العلمي | 11 | 8 RPC + Storage |
| الإشعارات | 3 | 3 RPC |
| المكتبة | 5 | 4 RPC + Storage |
| الذكاء الاصطناعي | 2 | 2 Edge |

**الإجمالي: ≈85 دالة.**

### 7.3 التقييم (300 نقطة) — أهم بند

| القاعدة | مكان التنفيذ |
| --- | --- |
| أول 10 محاضرات فقط تُحتسب | RPC `student_heartbeat` / trigger |
| 10 حضور + 10 تفاعل + 10 اختبار للمحاضرة المباشرة | حسبة في RPC عند الكتابة |
| المحاضرة المسجلة: 30 اختباراً فقط | نفس المنطق |
| الحضور: نقطة/10 دقائق بحد 10 بعد 100 دقيقة | `lecture_presence.total_seconds` + RPC |
| إيقاف العداد عند مغادرة الصفحة | heartbeat + `last_heartbeat_at` |
| التفاعل: نقطة/إجابة صحيحة بحد 10 | RPC `answer_question` |
| الاختبار: إعادة قياس لسقف المحاضرة | RPC `exam_submit` |
| عدم إعادة حساب القديم | لا backfill؛ يُطبق من تاريخ الترحيل |

**قاعدة ذهبية:** لا يُسمح للطالب بالكتابة المباشرة في `points_ledger` أو `attendance` أو `exam_attempts`. كلها عبر RPC يتحقق من `auth.uid()` والزمن والحالة.

### 7.4 الاختبارات

- `exam_start`: يتحقق من النافذة الزمنية، ينشئ محاولة، يعيد الأسئلة منقّاة.
- `exam_autosave`: يحفظ الإجابات مؤقتاً مع حد زمني.
- `exam_submit`: يتحقق من انتهاء الوقت، يحسب الدرجة على الخادم، يمنع الإرسال المزدوج.
- `grade_essay`: للأستاذ فقط، مع `audit_logs`.

### 7.5 التقارير والتصدير

- تقرير المالك: RPC تجميعي واحد بدل 20 استعلاماً.
- CSV/Excel: توليد في المتصفح من بيانات RPC (لا كشف جداول إضافي).
- PDF: طباعة المتصفح أو Edge Function عند الحاجة.

---

## 8. المنتدى واللحظي وWebRTC

| الوظيفة الحالية | البديل |
| --- | --- |
| WebSocket room + history | Realtime Postgres Changes على `chat_messages` + RPC `forum_messages` للتاريخ |
| قائمة المتصلين | Realtime Presence |
| `msg` | RPC `forum_send_message` + بث تلقائي |
| `signal` (WebRTC) | Realtime Broadcast على قناة الغرفة |
| `call-state` | Presence + Broadcast |
| Ping keepalive | لا حاجة (Supabase Realtime يدير الاتصال) |

- مقبس واحد مشترك مع عدّاد مراجع (كما في المرجع) لتفادي فتح اتصالات متعددة.
- لا نستخدم Realtime للبيانات الحسّاسة إن أمكن؛ يكفي للدردشة والإشعارات.

---

## 9. الذكاء الاصطناعي

| العملية | التنفيذ |
| --- | --- |
| توليد أسئلة/واجب | Edge Function `ai-generate` |
| محادثة المساعد | Edge Function `ai-chat` |
| المفتاح | Supabase secret `GEMINI_API_KEY` — لا يُخزَّن في `settings` |
| التفعيل/الإيقاف | `settings.ai_enabled` يقرأه الـEdge Function |
| الحدود | حد يومي لكل مستخدم في جدول `ai_usage` |

---

## 10. الواجهة الثابتة

### 10.1 الاختيار

**Vite + TypeScript + قوالب HTML/CSS الحالية** (بدون React).

| لماذا لا React | لماذا لا EJS |
| --- | --- |
| React يضيف إعادة كتابة 5,500 سطر EJS إلى JSX | EJS يحتاج Node |
| CSS والتصميم موجودان وجاهزان | Firebase Hosting لا يشغّل Node |
| الفريق لا يحتاج نموذج مكوّنات الآن | — |

> إن أراد المالك نموذج مكوّنات لاحقاً، يمكن الانتقال إلى React دون تغيير RLS/RPC.

### 10.2 البنية

```
web/
  index.html
  src/
    main.ts
    router.ts          # History API + حماية المسارات
    lib/supabase.ts    # createClient
    lib/api.ts         # العقد: كل RPC هنا
    lib/auth.ts        # الدخول/الخروج/onAuthStateChange
    lib/errors.ts      # تصنيف أخطاء Auth/RPC
    lib/cache.ts       # TTL + إبطال
    lib/realtime.ts    # مقبس مشترك
    views/             # 40+ شاشة
    styles/            # CSS الحالي
  firebase.json
  vite.config.ts
```

### 10.3 عقد `api.ts`

```ts
export type Result<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };

export async function call<T>(fn: string, params?: Record<string, unknown>): Promise<Result<T>> {
  const { data, error } = await supabase.rpc(fn, params ?? {});
  if (error) return { ok: false, error: error.message, code: error.code };
  if (data?.ok === false) return { ok: false, error: data.error };
  return { ok: true, data: data?.data ?? data };
}
```

- لا `null` صامت.
- كل شاشة تتعامل مع `ok/error` صراحةً.
- `PGRST202` (دالة مفقودة) يُصنّف كخطأ نشر، لا خطأ مستخدم.

### 10.4 تحويل EJS

| الخطوة | العمل |
| --- | --- |
| 1 | استخراج التخطيطات (`layouts/*.ejs`) إلى `index.html` + مكوّنات تنقل |
| 2 | تحويل كل صفحة إلى دالة `renderX(data)` تعيد HTML |
| 3 | استبدال `res.locals` بحالة عميل |
| 4 | استبدال النماذج بـ`submit` يستدعي RPC |
| 5 | الحفاظ على نفس أسماء الحقول وCSS |
| 6 | طباعة PDF: نفس `@media print` |

### 10.5 الحماية في الواجهة

- `onAuthStateChange` + إعادة توجيه.
- إخفاء عناصر القوائم حسب الدور — **تجميل فقط**؛ الحماية الحقيقية في RLS/RPC.
- لا تُخزَّن أي بيانات حساسة في `localStorage` غير JWT الذي يديره supabase-js.

---

## 11. الاستضافة والنشر

### 11.1 `firebase.json`

```json
{
  "hosting": {
    "public": "web/dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }],
    "headers": [
      { "source": "/index.html", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] },
      { "source": "/assets/**", "headers": [{ "key": "Cache-Control", "value": "public,max-age=31536000,immutable" }] },
      { "source": "**", "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "same-origin" },
        { "key": "X-Frame-Options", "value": "SAMEORIGIN" }
      ]}
    ]
  }
}
```

### 11.2 البيئات

| البيئة | Supabase | Firebase |
| --- | --- | --- |
| تطوير | مشروع تجريبي أو نفس المشروع | `npm run dev` |
| معاينة | نفس المشروع | Preview Channel |
| إنتاج | المشروع الحالي | القناة الافتراضية |

> **قرار مطلوب:** هل نستخدم نفس مشروع Supabase للإنتاج والمعاينة؟ يُفضّل مشروعان، لكن الخطة المجانية تسمح بمشروعين. البديل: نفس المشروع + بيانات اختبار معزولة.

### 11.3 النشر

```bash
cd web && npm ci && npm run build
firebase deploy --only hosting --project <PROJECT_ID>
```

- GitHub Actions اختياري: بناء + نشر عند دفع `main`.
- Supabase: `supabase link --project-ref <REF>` ثم `supabase db push`.

---

## 12. الترحيل والتحول التدريجي

### 12.1 لماذا لا نحتاج توقفاً

- كل تغييرات قاعدة البيانات **إضافية**.
- تطبيق Express يستخدم `service_role` ويتجاوز RLS — يظل يعمل.
- التطبيق الجديد يستخدم `anon` + RLS — يعمل بالتوازي.

### 12.2 الخطوات

1. **نسخة احتياطية** كاملة (`pg_dump`) + اختبار استعادة.
2. ترحيل `0100`: `auth_id` + `audit_logs` + الدوال المساعدة.
3. Edge Function لإنشاء `auth.users` وربط `auth_id`.
4. ترحيل `0101`: RLS + views + المنح.
5. ترحيل `0102`+: RPC بالمجالات.
6. بناء الواجهة على Preview Channel.
7. اختبار قبول لكل بوابة على حدة.
8. تحويل نطاق Firebase إلى الواجهة الجديدة.
9. إبقاء Express كاحتياط أسبوعين.
10. إيقاف Express وحذف `sessions` و`password_hash`.

### 12.3 التحقق من الترحيل

| الفحص | المتوقع |
| --- | --- |
| عدد المستخدمين | 311 |
| `auth.users` | 311 + الإداريون |
| `auth_id` غير فارغ | 100% |
| تسجيلات `LAW211` | 196 أصل + 55 طلاب + 141 طالبات |
| `points_ledger` | دون تغيير |
| RLS: `anon` على `users` | 401/403 |
| RLS: طالب يقرأ grades غيره | 0 صفوف |

### 12.4 خطة الرجوع

- إعادة نشر نسخة Hosting السابقة.
- إعادة توجيه النطاق إلى Express.
- الترحيلات الإضافية لا تكسر Express.
- RLS لا تؤثر على `service_role`.
- **لا حذف أي جدول قبل أسبوعين من الاستقرار.**

---

## 13. الاختبار والتحقق

### 13.1 اختبارات SQL/RLS

| الاختبار | الأداة |
| --- | --- |
| كل جدول: anon = ممنوع | `supabase/tests/*.sql` |
| طالب لا يرى درجات غيره | JWT طالب |
| أستاذ لا يرى مقرر غيره | JWT أستاذ |
| مساعد لا يكتب | JWT مساعد |
| `exam_questions` لا SELECT | anon/authenticated |
| `attendance_code` مخفي | طالب |
| RPC كتابة بدون صلاحية | 403 |

### 13.2 E2E

- Playwright: دخول كل بوابة، حضور، اختبار، تصحيح، تصدير.
- سيناريو أول دخول (تغيير كلمة المرور).
- سيناريو انقطاع الشبكة وإعادة المحاولة.

### 13.3 أمني

- فحص `service_role` في الحزمة النهائية.
- فحص تسريب المفاتيح (`scan-secrets`).
- مراجعة كل RPC: هل يتحقق من الملكية؟
- اختبار IDOR لكل معرّف في الرابط.
- مراجعة Storage policies.

### 13.4 أداء

- زمن أول تحميل < 2.5s على 3G سريع.
- كل شاشة < 500ms بعد التحميل.
- `EXPLAIN` لأثقل 10 استعلامات.
- مراقبة حجم القراءات (Firestore لا، لكن Supabase egress).

### 13.5 تعريف الإنجاز

- البوابات الأربع تعمل بلا Express.
- 311 مستخدماً يدخلون.
- الدرجات والحضور والاختبارات مطابقة.
- كل اختبارات RLS تمر.
- لا `anon` يصل لجدول.
- خطة الرجوع مجرّبة.
- تقرير أداء وأمان موقّع.

---

## 14. الجدول الزمني

| المرحلة | المدة | المخرج |
| --- | --- | --- |
| 0. تثبيت الأساس | 2 أيام | نسخة احتياطية + بيئة + قائمة قبول |
| 1. الهوية | 5 أيام | `auth_id` + 311 حساباً + أول دخول |
| 2. RLS + Views + اختبارات | 7 أيام | سياسات كل الجداول + اختبارات |
| 3. RPC القراءة (طالب/أستاذ) | 7 أيام | لوحات + قوائم |
| 4. الحضور والنقاط | 7 أيام | heartbeat + 300 نقطة |
| 5. الاختبارات والواجبات | 10 أيام | start/autosave/submit/تصحيح |
| 6. الإدارة والمالك والمساعد | 10 أيام | إنشاء/استيراد/تقارير |
| 7. Storage والنشر والمكتبة | 7 أيام | ملفات + روابط موقعة |
| 8. المنتدى + Realtime + AI | 7 أيام | دردشة + Edge Functions |
| 9. الواجهة (بالتوازي) | 25 يوماً | 40+ شاشة |
| 10. التحول والقبول | 5 أيام | إنتاج + rollback مجرّب |

**الإجمالي:** 12–14 أسبوعاً لمطوّر واحد، 8–9 أسابيع لمطوّرين.

---

## 15. المخاطر

| الخطر | الاحتمال | الأثر | التخفيف |
| --- | --- | --- | --- |
| ثغرة RLS | متوسط | حرج | اختبارات لكل جدول/دور + مراجعة مستقلة |
| تسريب إجابات الاختبارات | متوسط | حرج | منع SELECT + RPC منقّح + اختبار |
| التلاعب بالدرجات | منخفض | حرج | كل الكتابة في RPC |
| كسر سلوك أول دخول | متوسط | مرتفع | مصفوفة قبول + UAT |
| فقدان القفل المخصص | مؤكد | منخفض | حدود Supabase + CAPTCHA |
| توقف المشروع المجاني | متوسط | متوسط | فحص دوري + تصدير نسخ |
| أداء التقارير | متوسط | متوسط | RPC تجميعي + فهارس |
| تضخم النطاق (النشر/المكتبة) | مرتفع | متوسط | مراحل منفصلة |
| تكلفة Realtime | منخفض | منخفض | مقبس واحد + قنوات عند الحاجة |

---

## 16. التكلفة والحدود المجانية

| الخدمة | الحدود التقريبية | ملاحظة |
| --- | --- | --- |
| Firebase Hosting (Spark) | 10GB تخزين، 360MB/يوم نقل | يكفي |
| نطاق مخصص + SSL | مجاني | — |
| Supabase DB | 500MB | البيانات الحالية صغيرة |
| Supabase Storage | 1GB | قد تحتاج تنظيف ملفات قديمة |
| Supabase Auth | 50,000 MAU | 311 فقط |
| Realtime | 200 اتصال متزامن | يكفي |
| Edge Functions | حصة شهرية | تكفي للإنشاء وAI |
| النسخ الاحتياطي | غير متاح مجاناً | تصدير دوري يدوي/مجدول |
| الخمول | إيقاف بعد أسبوع بلا نشاط | فحص دوري أو ترقية |

**لا حاجة إلى Cloud Run أو Blaze أو بطاقة دفع.**

---

## 17. القرارات المطلوبة من المالك

1. **نفس مشروع Supabase أم مشروع جديد؟** (التوصية: نفسه، ترحيل إضافي.)
2. **قبول الدخول بالبريد الاصطناعي** `{code}@students.local`؟ (التوصية: نعم.)
3. **قبول التخلي عن القفل المخصص** لصالح حدود Supabase؟ (التوصية: نعم + CAPTCHA.)
4. **بريد التواصل منفصل عن بريد الدخول؟** (التوصية: نعم.)
5. **نطاق مخصص** — ما اسمه؟
6. **مشروع Firebase** — من يملكه/يدفعه؟ (Spark مجاني.)
7. **الواجهة:** Vite + TS بلا React (التوصية) أم React؟
8. **نطاق المرحلة الأولى:** هل يشمل النشر العلمي والمكتبة والمنتدى أم لاحقاً؟
9. **نسخ احتياطي:** من المسؤول عن التصدير الدوري؟
10. **موعد التحول:** هل نبقى على Express حتى اكتمال كل البوابات؟

---

## 18. الملاحق

### أ. أول ترحيل مقترح (`0100_auth_bridge.sql`)

```sql
begin;

alter table public.users
  add column if not exists auth_id uuid unique references auth.users(id) on delete cascade;

create index if not exists idx_users_auth_id on public.users(auth_id);

create table if not exists public.audit_logs (
  id bigint generated by default as identity primary key,
  actor_id bigint references public.users(id) on delete set null,
  action text not null,
  table_name text,
  record_id bigint,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.current_user_id() ...
create or replace function public.is_owner() ...
-- ... بقية الدوال المساعدة

notify pgrst, 'reload schema';
commit;
```

### ب. أوامر التحقق

```bash
# محلي
npm run dev
node --check server.js

# قاعدة البيانات
supabase link --project-ref <REF>
supabase db push

# نشر الواجهة
cd web && npm run build
firebase deploy --only hosting
```

### ج. قائمة القبول (مختصرة)

- [ ] `anon` لا يقرأ أي جدول.
- [ ] طالب يرى مقرراته فقط.
- [ ] أستاذ يرى طلاب مقرراته فقط.
- [ ] مساعد يقرأ ولا يكتب.
- [ ] مالك يرى كل شيء.
- [ ] `attendance_code` غير مرئي للطالب.
- [ ] `exam_questions` بلا SELECT مباشر.
- [ ] الدرجة تُحسب على الخادم فقط.
- [ ] الملفات بروابط موقّعة.
- [ ] الدخول الأول يفرض تغيير كلمة المرور.
- [ ] 311 مستخدماً يدخلون.
- [ ] Rollback مجرّب.

### د. الفرق بين المرجع وهذه الخطة

| الجانب | منصة الزين الرقمية | alzain-academy |
| --- | --- | --- |
| الهوية | `universityId@students.local` | نفس الفكرة + مالك/مساعد |
| كلمات المرور | مخزّنة نصياً للتوزيع | **لا تخزين** — تُعرض مرة واحدة |
| الأدوار | student/instructor/platform_admin | owner/teacher/student/assistant |
| المقررات | مسطحة | أصل + فروع (طلاب/طالبات) |
| الجداول | `uuid` | `bigint` + `auth_id` |
| التقييم | نقاط داخل المحاضرة | 300 نقطة + سقوف |
| الواجهة | React | Vite + TS (بلا React) |

---

## 19. الخلاصة

- **ممكن بلا أي خطة مدفوعة**، وبلا Cloud Run.
- **ليس نقلة استضافة**، بل إعادة بناء الخادم الخلفي: Express → RLS + RPC.
- **أقل خطراً مما يبدو** لأن الترحيل إضافي ويسمح بالعمل المتوازي.
- **أكبر خطر** هو RLS ومنطق الدرجات، وكلاهما قابل للاختبار.
- **الخطوة التالية:** موافقة المالك على القرارات في القسم 17، ثم تنفيذ المرحلة 0 والمرحلة 1.

---

**آخر تحديث:** 2026-11-20

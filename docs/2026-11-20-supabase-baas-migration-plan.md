# خطة تحويل منصة آل الزين إلى نمط BaaS — Supabase خادماً وقاعدة بيانات، وFirebase Hosting للواجهة

**التاريخ:** 2026-11-20
**المستودع:** `drmahmoudalzain/alzain-academy`
**الحالة:** القرارات الأساسية معتمدة (2026-11-20) — جاهزة للتنفيذ بعد المرحلة 0
**المرجع المعماري:** منصة الزين الرقمية (`D:\Projects\alzain-platform`، مشروع Supabase `ynugoeslnbxeolugsxtz`)

**القرارات المعتمدة:**
1. نفس مشروع Supabase الحالي (لا مشروع جديد).
2. الدخول بالبريد الاصطناعي `{code}@students.local` مقبول.
3. الحماية: حدود Supabase + CAPTCHA، بلا قفل حسابي مخصص (التفصيل في 4.4).
4. الواجهة: نفس HTML/CSS الحالي، لكن **صفحات منفصلة** (MPA)، بلا React وبلا SPA.
5. النشر العلمي والمكتبة: **مؤجلان** إلى مرحلة لاحقة.

---

## 0. الملخص التنفيذي

نحوّل المنصة من تطبيق **Express + EJS** يعمل على خادم دائم، إلى **واجهة ثابتة متعددة الصفحات** (HTML/CSS الحالي + JavaScript) على Firebase Hosting، تتصل مباشرة بـ **Supabase** (Auth + Postgres + RLS + RPC + Storage + Realtime + Edge Functions).

**ما يتحقق:**
- لا VM، لا نفق Cloudflare، لا Cloud Run، لا بطاقة دفع.
- Firebase Hosting (خطة Spark) يستضيف الملفات فقط.
- Supabase Free يكفي لحجم البيانات الحالي (311 مستخدماً).
- كل منطق العمل الحسّاس يبقى على الخادم — لكن الخادم الآن **PostgreSQL**، لا Node.

**الثمن:**
- إعادة كتابة طبقة الوصول (309 استدعاء) وفصل 40+ صفحة EJS إلى صفحات HTML مستقلة.
- كتابة سياسات RLS لكل جدول — وهي **خط الدفاع الأول** بعد إزالة Express.
- المدة التقديرية بعد تأجيل النشر والمكتبة: **10–12 أسبوعاً** لمطوّر واحد، أو **7–8 أسابيع** لمطوّرين يعملان بالتوازي.

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
3. إبقاء Supabase هي الخادم الخلفي وقاعدة البيانات — **في المشروع الحالي نفسه**.
4. الإبقاء على HTML/CSS الحالي وتحويل كل شاشة إلى صفحة مستقلة قابلة للتحكم.
5. الحفاظ على السلوك الوظيفي والأمان — وعدم كسر أي شيء أثناء الانتقال.
6. تأجيل النشر العلمي والمكتبة إلى مرحلة تالية.

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

### 4.4 القفل والحدود — الشرح والقرار

**السؤال:** اليوم، بعد 5 كلمات مرور خاطئة يُقفل الحساب 15 دقيقة. هل يمكن الحفاظ على هذا بعد الانتقال؟

**ما وجدته في وثائق Supabase:** يوجد Auth Hook باسم `password_verification_attempt` يمكنه عدّ المحاولات ورفضها، **لكنه متاح فقط في خطتي Teams وEnterprise**. أي أنه **غير متاح في الخطة المجانية** التي نستهدفها.

**الخيارات المتاحة مجاناً:**

| الخيار | كيف يعمل | العيوب | التقييم |
| --- | --- | --- | --- |
| **A. حدود Supabase + CAPTCHA** | GoTrue يحدّ المحاولات لكل IP، وTurnstile يمنع الأتمتة | القفل لكل IP لا لكل حساب | ✅ **موصى به** |
| **B. Edge Function وسيطة للدخول** | الواجهة ترسل الرمز/الكلمة إلى دالة، والدالة تنادي GoTrue وتعدّ المحاولات وتقفل بعد 5 | تعقيد إضافي، نقطة فشل جديدة، استهلاك حصة، وإعادة بناء ما نريد إزالته | ⚠️ عند الحاجة فقط |
| **C. فحص مسبق في الواجهة (RPC)** | الواجهة تسأل «هل الحساب مقفول؟» قبل الدخول | يُتجاوز بسهولة — تجميلي لا أمني | ❌ مرفوض |

**التوصية: الخيار A.**
- كلمات مرور مولّدة **12 حرفاً** (A-Z + أرقام) — تجعل التخمين غير عملي أصلاً.
- **Cloudflare Turnstile** على نموذج الدخول (مجاني، ويدعمه Supabase).
- حدود GoTrue المدمجة على محاولات الدخول.
- تسجيل المحاولات الفاشلة في جدول `login_events` للمراقبة فقط (لا يمنع).
- إن طلب المالك لاحقاً قفلاً حسابياً صارماً، يُضاف الخيار B كمرحلة منفصلة.

**الأثر المعلن:** يزول «قفل 15 دقيقة بعد 5 محاولات» ويحل محله حدّ IP + CAPTCHA. أمنياً هذا كافٍ مع كلمات مرور مولّدة، لكنه **تغيير سلوك** يجب أن يعرفه المالك.

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
| الإشعارات | 3 | 3 RPC |
| الذكاء الاصطناعي | 2 | 2 Edge |
| **النشر العلمي** | 11 | **مؤجل — المرحلة 2** |
| **المكتبة** | 5 | **مؤجل — المرحلة 2** |

**الإجمالي للمرحلة الأولى: ≈73 دالة** (بعد تأجيل النشر والمكتبة).

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

## 10. الواجهة الثابتة — صفحات منفصلة (MPA)

### 10.1 القرار المعتمد

**لا نغيّر الواجهة:** نفس HTML/CSS الحالي، لكن كل شاشة تصبح **ملف HTML مستقلاً** يعمل بلا خادم، ويمكن تعديله والتحكم فيه بشكل منفصل.

| القرار | التفصيل |
| --- | --- |
| النمط | **MPA** — صفحة HTML لكل شاشة |
| البناء | Vite multi-page (أو سكربت تجميع بسيط) |
| التخطيطات | `partials/` (رأس/قائمة/تذييل) تُحقن **وقت البناء** |
| البيانات | JavaScript يستدعي RPC ثم يملأ العناصر |
| المعرفات | `?id=...` في الرابط — لا حاجة لخادم |
| الروابط | ملفات حقيقية + `cleanUrls: true` |
| الحماية | `guard.js` في كل صفحة + RLS |

**لماذا لا SPA/React:** طلب المالك الإبقاء على HTML الحالي والتحكم في كل صفحة على حدة. MPA يحقق ذلك بأقل تغيير بصري، وكل صفحة قابلة للتعديل دون التأثير على غيرها.

**أمثلة المسارات:**

```
/login.html                → /login
/student/dashboard.html    → /student/dashboard
/student/lecture.html?id=12
/teacher/courses.html
/owner/users.html
```

### 10.2 البنية

```
web/
  index.html                     # الصفحة العامة
  partials/
    head.html                    # meta + CSS
    nav.html                     # قائمة البوابة
    footer.html
  pages/
    login.html
    account.html
    guide.html
    student/
      dashboard.html
      lectures.html
      lecture.html
      exams.html
      exam.html
      assignments.html
      grades.html
      points.html
      courses.html
    teacher/
      dashboard.html
      courses.html
      course.html
      lectures.html
      exams.html
      assignments.html
      students.html
      student.html
      gradebook.html
    owner/
      dashboard.html
      users.html
      user-new.html
      import.html
      staff.html
      settings.html
      archive.html
      report.html
    assistant/
      dashboard.html
    forum.html
    notifications.html
  src/
    lib/supabase.ts              # createClient
    lib/api.ts                   # العقد: كل RPC هنا
    lib/auth.ts                  # الدخول/الخروج/onAuthStateChange
    lib/guard.ts                 # حماية كل صفحة
    lib/errors.ts                # تصنيف أخطاء Auth/RPC
    lib/cache.ts                 # TTL + إبطال
    lib/realtime.ts              # مقبس مشترك
    pages/*.ts                   # منطق كل صفحة (ملف لكل صفحة)
  styles/                        # CSS الحالي كما هو
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
- كل صفحة تتعامل مع `ok/error` صراحةً.
- `PGRST202` (دالة مفقودة) يُصنّف كخطأ نشر، لا خطأ مستخدم.

### 10.4 تحويل EJS إلى صفحات

| الخطوة | العمل |
| --- | --- |
| 1 | نسخ markup من `views/**/*.ejs` إلى `pages/**/*.html` **كما هو** |
| 2 | استبدال `<%= ... %>` بعناصر فارغة تحمل `data-*` |
| 3 | حقن `partials` (رأس/قائمة) وقت البناء |
| 4 | تحويل النماذج إلى `submit` يستدعي RPC |
| 5 | الإبقاء على نفس أسماء الفئات وCSS |
| 6 | طباعة PDF: نفس `@media print` |
| 7 | كل صفحة تحمّل `guard.js` + `pages/<name>.js` فقط |

> **ملاحظة:** الواجهة الحالية موجودة داخل قوالب EJS، لا كملفات HTML جاهزة. التحويل يعني استخراج نفس markup إلى ملفات HTML، وليس إعادة تصميم.

### 10.5 الحماية في الواجهة

- `guard.js` في كل صفحة: يقرأ الجلسة، ويتحقق من البوابة، ويحوّل إلى `/login` أو `/forbidden.html`.
- إخفاء عناصر القوائم حسب الدور — **تجميل فقط**؛ الحماية الحقيقية في RLS/RPC.
- لا تُخزَّن أي بيانات حساسة في `localStorage` غير JWT الذي يديره supabase-js.

---

## 11. الاستضافة والنشر

### 11.1 `firebase.json`

```json
{
  "hosting": {
    "public": "web/dist",
    "cleanUrls": true,
    "trailingSlash": false,
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "headers": [
      { "source": "**/*.html", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] },
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

> لا يوجد `rewrite` عام إلى `index.html` لأن الواجهة ليست SPA. `cleanUrls` يحوّل `/student/dashboard.html` إلى `/student/dashboard`.

### 11.2 البيئات

| البيئة | Supabase | Firebase |
| --- | --- | --- |
| تطوير | **نفس المشروع الحالي** | `npm run dev` |
| معاينة | **نفس المشروع الحالي** | Preview Channel |
| إنتاج | **نفس المشروع الحالي** | القناة الافتراضية |

> **القرار المعتمد:** نفس مشروع Supabase (لا مشروع جديد ولا نسخ بيانات).
> **تنبيه:** هذه بيانات حقيقية. لذلك تُطبّق **ترحيلات إضافية فقط**، ولا تُجرّب أي عملية تُعدّل أو تحذف بيانات حقيقية. الاختبارات التي تكتب بيانات تُنفّذ على مستخدم تجريبي واحد مُعلَّم.

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

> **لأن المشروع نفسه:** لا توجد خطوة «نسخ بيانات» ولا «استيراد 311 طالباً». الخطوات 2–5 تُضيف جداول وأعمدة ودوالاً فقط، والبيانات تبقى في مكانها.

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
| 7. Storage الأساسي | 3 أيام | مرفقات المحاضرات والواجبات + روابط موقعة |
| 8. المنتدى + Realtime + AI | 7 أيام | دردشة + Edge Functions |
| 9. الواجهة (بالتوازي) | 20 يوماً | 35+ صفحة مستقلة |
| 10. التحول والقبول | 5 أيام | إنتاج + rollback مجرّب |
| **المرحلة 2 (مؤجلة)** | 3–4 أسابيع | النشر العلمي + المكتبة |

**الإجمالي للمرحلة الأولى:** 10–12 أسبوعاً لمطوّر واحد، 7–8 أسابيع لمطوّرين.

---

## 15. المخاطر

| الخطر | الاحتمال | الأثر | التخفيف |
| --- | --- | --- | --- |
| ثغرة RLS | متوسط | حرج | اختبارات لكل جدول/دور + مراجعة مستقلة |
| تسريب إجابات الاختبارات | متوسط | حرج | منع SELECT + RPC منقّح + اختبار |
| التلاعب بالدرجات | منخفض | حرج | كل الكتابة في RPC |
| كسر سلوك أول دخول | متوسط | مرتفع | مصفوفة قبول + UAT |
| تغيير سلوك القفل | مؤكد | منخفض | حدود Supabase + Turnstile + كلمات مرور 12 حرفاً (4.4) |
| توقف المشروع المجاني | متوسط | متوسط | فحص دوري + تصدير نسخ |
| أداء التقارير | متوسط | متوسط | RPC تجميعي + فهارس |
| تضخم النطاق | متوسط | متوسط | النشر والمكتبة مؤجلان صراحةً |
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

## 17. القرارات

### 17.1 معتمدة (2026-11-20)

| # | القرار | الأثر |
| --- | --- | --- |
| 1 | **نفس مشروع Supabase** | لا مشروع جديد، لا نسخ بيانات؛ ترحيلات إضافية فقط |
| 2 | **الدخول بالبريد الاصطناعي** `{code}@students.local` | يطابق نمط المنصة المرجعية |
| 3 | **حدود Supabase + CAPTCHA** بدل القفل المخصص | يزول قفل 15 دقيقة بعد 5 محاولات (شرح في 4.4) |
| 4 | **HTML/CSS الحالي كصفحات منفصلة (MPA)** | لا React، لا SPA؛ كل صفحة مستقلة |
| 5 | **تأجيل النشر العلمي والمكتبة** | المرحلة الأولى ≈73 دالة، 10–12 أسبوعاً |

### 17.2 قرارات فنية اتخذتها الخطة (قابلة للنقض)

| # | القرار | السبب |
| --- | --- | --- |
| 6 | بريد التواصل منفصل عن بريد الدخول | الدخول اصطناعي؛ البريد الحقيقي للتواصل فقط |
| 7 | إبقاء `bigint` + `auth_id` | يمنع إعادة كتابة كل العلاقات |
| 8 | كلمات مرور 12 حرفاً مولّدة | تعوّض غياب القفل الحسابي |
| 9 | Vite multi-page للبناء | يجمع الصفحات ويضغط الأصول بلا إطار عمل |
| 10 | `cleanUrls` بلا rewrite عام | واجهة MPA وليست SPA |

### 17.3 ما يزال مطلوباً من المالك

1. **اسم النطاق المخصص** (أو البقاء على `*.web.app`).
2. **مشروع Firebase:** من يملكه ومن يديره؟ (Spark مجاني.)
3. **النسخ الاحتياطي:** من ينفّذ التصدير الدوري وأين يُحفظ؟
4. **موعد التحول:** هل نبقى على Express حتى اكتمال البوابات الأربع؟
5. **حساب تجريبي** لاختبارات الكتابة (طالب + أستاذ + مساعد).

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
- [ ] كل صفحة HTML تعمل بفتح مباشر للرابط (بلا خادم).
- [ ] Turnstile يعمل على نموذج الدخول.
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
| الواجهة | React (SPA) | **صفحات HTML مستقلة (MPA)** بلا React |

---

## 19. الخلاصة

- **ممكن بلا أي خطة مدفوعة**، وبلا Cloud Run.
- **ليس نقلة استضافة**، بل إعادة بناء الخادم الخلفي: Express → RLS + RPC.
- **نفس مشروع Supabase** يعني صفر نسخ بيانات، وترحيلات إضافية فقط.
- **الواجهة تبقى كما هي** بصرياً، لكن كل شاشة تصبح صفحة HTML مستقلة.
- **النشر العلمي والمكتبة مؤجلان** لتقليل النطاق والزمن.
- **أقل خطراً مما يبدو** لأن الترحيل إضافي ويسمح بالعمل المتوازي.
- **أكبر خطر** هو RLS ومنطق الدرجات، وكلاهما قابل للاختبار.
- **الخطوة التالية:** المرحلة 0 (نسخة احتياطية + قائمة قبول)، ثم المرحلة 1 (جسر الهوية وإنشاء حسابات Auth).

---

**آخر تحديث:** 2026-11-20

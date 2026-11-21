# دليل تنفيذ المرحلة 0 و1 — جسر الهوية والحسابات التجريبية

**التاريخ:** 2026-11-21
**المرجع:** `docs/2026-11-20-supabase-baas-migration-plan.md`
**المشروع:** `nsgahdnxpgctkljeusnp`
**الحالة:** جاهز للتنفيذ — ينتظر صلاحية إدارة (Access Token)

---

## 0. ما أُنجز وما بقي

| العنصر | الحالة |
| --- | --- |
| ترحيل `0100_auth_bridge.sql` | ✅ **مُطبَّق 2026-11-21** |
| فحص `0100` | ✅ كل القيم صحيحة (10 دوال، RLS على `audit_logs`) |
| الحسابات التجريبية | ✅ **3/3 أُنشئت ودخلت بنجاح** |
| فحص الدخول | ✅ `scripts/verify-test-logins.mjs` |
| خطة GitHub Pages المؤقتة | ✅ موثّقة في الخطة (11.4) |
| صلاحية تنفيذ SQL | ✅ عبر `supabase login` (Credential Manager) |

### سجل التنفيذ

| الخطوة | النتيجة |
| --- | --- |
| فحص قبل الترحيل | `auth_id_column=false` · `audit_logs=false` · `helper_functions=0` · `users=318` |
| تطبيق `0100` | HTTP 201 |
| فحص بعد الترحيل | `auth_id_column=true` · `auth_id_fk=true` · `auth_id_unique=true` · `audit_logs_rls=true` · `helper_functions=10` · `users=318` |
| صلاحيات | `anon` ممنوع من `current_user_id()` · `authenticated` مسموح · `authenticated` ممنوع من `audit_logs` · `service_role` مسموح |
| الحسابات التجريبية | `BM9001` (id=355) · `TE9002` (id=356) · `AS9001` (id=357) |
| دخول الحسابات | 3/3 ناجح و`auth_id` مطابق |

---

## 1. الصلاحية — تمّت ✅

تم تسجيل الدخول عبر:

```powershell
supabase login
```

الرمز محفوظ في **Windows Credential Manager** (وليس في ملف متعقَّب). السكربت `scripts/run-sql.mjs` يقرأ `SUPABASE_ACCESS_TOKEN` من البيئة إن لم يجده في `.env`، فلا حاجة لكتابة الرمز في أي ملف.

> `.env` مستثنى من Git. لا ترسل الرمز في المحادثة ولا تضعه في أي ملف متعقَّب.

---

## 2. تطبيق الترحيل 0100 — تمّ ✅

```powershell
# 1) فحص سابق — النتيجة: false / 0
node scripts/run-sql.mjs supabase/verify/0100_auth_bridge_checks.sql

# 2) التطبيق — HTTP 201
node scripts/run-sql.mjs supabase/migrations/0100_auth_bridge.sql

# 3) فحص لاحق — كل القيم صحيحة
node scripts/run-sql.mjs supabase/verify/0100_auth_bridge_checks.sql
```

**النتيجة الفعلية في الفحص اللاحق:**

| المفتاح | القيمة |
| --- | --- |
| `auth_id_column` | `true` |
| `auth_id_unique` | `true` |
| `auth_id_fk` | `true` |
| `auth_id_index` | `true` |
| `audit_logs_table` | `true` |
| `audit_logs_rls` | `true` |
| `helper_functions` | `10` |
| `users_total` | `318` |
| `users_linked` | `0` |
| `users_unlinked` | `318` |

ما يفعله الترحيل:

1. يضيف `users.auth_id uuid` + قيد فريد + مفتاح خارجي `on delete set null` + فهرس.
2. ينشئ `audit_logs` مع RLS بلا سياسات (service_role فقط).
3. ينشئ 10 دوال هوية مساعدة (`current_user_id`, `is_owner`, `is_enrolled`, …) ويسحب تنفيذها من `public` و`anon`.

**لا يفعّل RLS على الجداول، ولا يمنح `authenticated` أي وصول.** تطبيق Express يستمر كما هو.

---

## 3. الحسابات التجريبية

```powershell
# معاينة (لا كتابة)
node scripts/phase1-auth-users.mjs

# تنفيذ
node scripts/phase1-auth-users.mjs --apply
```

| الدور | الرمز | بريد الدخول | users.id | auth.users.id |
| --- | --- | --- | --- | --- |
| طالب | `BM9001` | `bm9001@students.local` | 355 | `817507af-d74f-4e0d-9e69-cfe993938723` |
| أستاذ | `TE9002` | `te9002@staff.local` | 356 | `3820d49d-963d-485e-bef3-7789db8c18e4` |
| مساعد | `AS9001` | `as9001@staff.local` | 357 | `cb90f6dd-59d8-4140-80b3-24fe4ca12b1d` |

- كلمة المرور 12 حرفاً لكل حساب، في `tmp/phase1-test-accounts-2026-11-21T03-37-41-141Z.csv` (مستثنى من Git).
- الاسم يبدأ بـ`[اختبار]` ليظهر بوضوح في القوائم.
- السكربت آمن للتكرار: يتخطى أي حساب مربوط مسبقاً.

### التحقق من الدخول — تمّ 3/3 ✅

```powershell
node scripts/verify-test-logins.mjs            # يقرأ أحدث ملف في tmp/
node scripts/verify-test-logins.mjs path.csv   # أو ملفاً محدداً
```

النتيجة الفعلية:

```
✓ BM9001 (student): دخول ناجح — auth_id مطابق
✓ TE9002 (teacher): دخول ناجح — auth_id مطابق
✓ AS9001 (assistant): دخول ناجح — auth_id مطابق
النتيجة: 3/3 ناجح
```

يعمل الاختبار عبر `POST /auth/v1/token?grant_type=password` بالمفتاح العام، ويتأكد أن `users.auth_id` يطابق `user.id`. لا تُطبع كلمات المرور.

---

## 4. الرجوع (Rollback)

الترحيل إضافي، والرجوع لا يمس بيانات:

```sql
begin;

drop function if exists public.is_self_or_owner(bigint);
drop function if exists public.is_enrolled(bigint);
drop function if exists public.teaches_course(bigint);
drop function if exists public.is_student();
drop function if exists public.is_assistant();
drop function if exists public.is_teacher();
drop function if exists public.is_owner();
drop function if exists public.is_active_user();
drop function if exists public.current_user_role();
drop function if exists public.current_user_id();

drop table if exists public.audit_logs;

alter table public.users drop constraint if exists users_auth_id_fkey;
alter table public.users drop constraint if exists users_auth_id_key;
drop index if exists public.idx_users_auth_id;
drop index if exists public.idx_users_platform_id;
alter table public.users drop column if exists auth_id;

commit;
```

> حذف `auth_id` لا يحذف حسابات `auth.users`؛ يزيل الربط فقط. أعد الترحيل وأعد الربط بالسكربت عند الحاجة.
> الحسابات التجريبية في `auth.users` تُحذف يدوياً من لوحة Supabase أو عبر Admin API.

---

## 5. قائمة قبول المرحلة 1

- [x] `auth_id` موجود وقيده الفريد والمفتاح الخارجي صحيحان.
- [x] `audit_logs` موجودة وRLS مفعّلة وبلا سياسات.
- [x] الدوال العشر موجودة.
- [x] `anon` لا يستطيع تنفيذ `current_user_id()`.
- [x] `service_role` يستطيع القراءة من `audit_logs`.
- [x] الحسابات التجريبية الثلاثة أُنشئت وربطت.
- [x] دخول `bm9001@students.local` يعيد `access_token`.
- [x] `users.auth_id` للحسابات الثلاثة يطابق `auth.users.id`.
- [x] تطبيق Express ما زال يعمل (لم يتأثر — التغيير إضافي).
- [x] `users_total` زاد بـ3 فقط (318 → 321).

---

## 6. ملاحظات تشغيلية

- **لا `pg_dump`:** بقرار المالك. الترحيل إضافي بالكامل، والرجوع أعلاه لا يفقد بيانات.
- **النسخ الاحتياطي في الخطة المجانية غير متاح:** إن ظهرت حاجة لاحقاً، تُنفَّذ لقطة قبل كل ترحيل كبير.
- **التسلسل:** لا تُنشئ حسابات Auth قبل `0100`، لأن الربط يحتاج `auth_id`.
- **الاستضافة:** GitHub Pages مؤقتاً؛ لا نشر إلى Firebase الآن (قرار المالك).

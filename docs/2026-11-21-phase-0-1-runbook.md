# دليل تنفيذ المرحلة 0 و1 — جسر الهوية والحسابات التجريبية

**التاريخ:** 2026-11-21
**المرجع:** `docs/2026-11-20-supabase-baas-migration-plan.md`
**المشروع:** `nsgahdnxpgctkljeusnp`
**الحالة:** جاهز للتنفيذ — ينتظر صلاحية إدارة (Access Token)

---

## 0. ما أُنجز وما بقي

| العنصر | الحالة |
| --- | --- |
| ترحيل `0100_auth_bridge.sql` | ✅ مكتوب، **لم يُطبَّق** |
| فحص `0100` | ✅ مكتوب |
| سكربت الحسابات التجريبية | ✅ مكتوب ويعمل (معاينة) |
| خطة GitHub Pages المؤقتة | ✅ موثّقة في الخطة (11.4) |
| **صلاحية تنفيذ SQL** | ❌ `SUPABASE_ACCESS_TOKEN` فارغ في `.env` |

---

## 1. الشرط الوحيد المطلوب من المالك

الترحيل يحتاج رمز وصول لحساب Supabase (ليس مفتاح المشروع). اختر أحد الخيارين:

**الخيار أ — تسجيل دخول CLI (الأفضل):**

```powershell
supabase login
```

يفتح المتصفح ويحفظ الرمز في `~/.supabase/access-token`. بعدها يمكن استخدام CLI مباشرة.

**الخيار ب — وضع الرمز في `.env`:**

```
SUPABASE_ACCESS_TOKEN=sbp_...
```

> `.env` مستثنى من Git. لا ترسل الرمز في المحادثة ولا تضعه في أي ملف متعقَّب.

بعد توفره، يكفي أن أكمل أنا بقية الخطوات.

---

## 2. تطبيق الترحيل 0100

```powershell
# 1) فحص سابق (يجب أن تظهر القيم false / 0)
node scripts/run-sql.mjs supabase/verify/0100_auth_bridge_checks.sql

# 2) التطبيق
node scripts/run-sql.mjs supabase/migrations/0100_auth_bridge.sql

# 3) فحص لاحق
node scripts/run-sql.mjs supabase/verify/0100_auth_bridge_checks.sql
```

**النتيجة المتوقعة في الفحص اللاحق:**

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

| الدور | الرمز | بريد الدخول |
| --- | --- | --- |
| طالب | `BM9001` | `bm9001@students.local` |
| أستاذ | `TE9002` | `te9002@staff.local` |
| مساعد | `AS9001` | `as9001@staff.local` |

- كلمة المرور 12 حرفاً تُولَّد لكل حساب.
- **لا تُطبع في الطرفية** — تُكتب في `tmp/phase1-test-accounts-<time>.csv` (مستثنى من Git).
- الاسم يبدأ بـ`[اختبار]` ليظهر بوضوح في القوائم.
- السكربت آمن للتكرار: يتخطى أي حساب مربوط مسبقاً.

### التحقق من الدخول

يحتاج `SUPABASE_ANON_KEY` (المفتاح العام) في `.env` لاختبار `signInWithPassword` من العميل:

```powershell
# إضافة المفتاح العام (موجود في لوحة Supabase → Settings → API)
# SUPABASE_ANON_KEY=...
```

ثم اختبار سريع عبر REST:

```powershell
$body = @{ email = "bm9001@students.local"; password = "<من الملف>" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$env:SUPABASE_URL/auth/v1/token?grant_type=password" `
  -Headers @{ apikey = $env:SUPABASE_ANON_KEY } -ContentType "application/json" -Body $body
```

النجاح = وجود `access_token` و`user.id`. تحقّق أن `users.auth_id` يساوي `user.id`.

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

- [ ] `auth_id` موجود وقيده الفريد والمفتاح الخارجي صحيحان.
- [ ] `audit_logs` موجودة وRLS مفعّلة وبلا سياسات.
- [ ] الدوال العشر موجودة.
- [ ] `anon` لا يستطيع تنفيذ `current_user_id()`.
- [ ] `service_role` يستطيع القراءة من `audit_logs`.
- [ ] الحسابات التجريبية الثلاثة أُنشئت وربطت.
- [ ] دخول `bm9001@students.local` يعيد `access_token`.
- [ ] `users.auth_id` للحسابات الثلاثة يطابق `auth.users.id`.
- [ ] تطبيق Express ما زال يعمل (لم يتأثر).
- [ ] `users_total` زاد بـ3 فقط (318 → 321).

---

## 6. ملاحظات تشغيلية

- **لا `pg_dump`:** بقرار المالك. الترحيل إضافي بالكامل، والرجوع أعلاه لا يفقد بيانات.
- **النسخ الاحتياطي في الخطة المجانية غير متاح:** إن ظهرت حاجة لاحقاً، تُنفَّذ لقطة قبل كل ترحيل كبير.
- **التسلسل:** لا تُنشئ حسابات Auth قبل `0100`، لأن الربط يحتاج `auth_id`.
- **الاستضافة:** GitHub Pages مؤقتاً؛ لا نشر إلى Firebase الآن (قرار المالك).

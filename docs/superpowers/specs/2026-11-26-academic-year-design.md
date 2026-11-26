# Spec: العام الدراسي والفصلان — V1

الحالة: معتمد من التصور الذي راجعه المالك وعدّله في 2026-11-26.

## Objective

إضافة طبقة زمنية صريحة على تسجيلات **طلاب وطالبات البكالوريوس فقط** (`bachelor_m`, `bachelor_f`)، تسمح للمالك بتحديد الفصل عند التسجيل، وإغلاق العام الحالي يدوياً، ثم إنشاء العام التالي ونقل المسجلين، مع بقاء الدرجات والحضور والتسليمات مرتبطة بالعام القديم.

## Capability Map

| Module id | Responsibility | Depends on |
|---|---|---|
| `academic-schema` | جداول الأعوام والفصول والسياسات والنتائج والأرشفة، والـ backfill | — |
| `period-rules` | دوال المعاينة والإغلاق والإنشاء والنقل والتخرج المحمية بـ `is_owner()` | academic-schema |
| `result-decisions` | نتائج كل مقرر في كل فصل، توصية الأستاذ للقراءة فقط، قرار المالك | academic-schema |
| `owner-ui` | واجهة المالك: اختيار الفصل، المعاينة، القرار، الأرشفة | period-rules, result-decisions |
| `teacher-ui` | واجهة الأستاذ لتسجيل التوصية فقط | result-decisions |

Build order: academic-schema → period-rules + result-decisions → owner-ui + teacher-ui.

## Decisions (approved)

- لا يُفتح عام جديد إلا بعد إغلاق العام الحالي صراحةً. الإغلاق يدوي بمعاينة وتدقيق.
- حالات العام: `open` → `closed` → `archived`؛ إعادة الفتح ممنوعة في V1.
- النقل يعني إنشاء تسجيلات جديدة للعام الجديد، لا نقل الدرجات؛ القديم يُوقَف `suspended`.
- ٣٠٠ نقطة لكل مقرر في كل فصل هي المستهدف؛ ١٥٠ هي حد النجاح الإداري للمقرر. تُوضع في سياسة بيانات قابلة للتعديل لا في الكود.
- من دون ١٥٠: الأستاذ يسجّل توصية `pass/fail` للقراءة فقط، والقرار النهائي للمالك مع سبب موثّق، وله تجاوز رفض الأستاذ.
- نجاح كل مقررات الفصل الأول يفتح الفصل الثاني؛ نجاح الفصلين معاً هو نجاح العام، ثم الترقية أو التخرج.
- النجاح النهائي مرتبط بامتحان خارج المنصة؛ النقاط معيار إداري للانتقال والأرشفة فقط.
- الأستاذ يملك إضافة `teacher_create_assignment` وتسجيل توصية `pass/fail` على نتائج مقرراته المسندة التي لم يحسم المالك قرارها (بقرار المالك 2026-11-26)؛ لا يملك تعديل الدرجات أو النقاط أو حالة النتيجة، والقرار النهائي للمالك وحده.
- `external`, `equiv`, `grad`, والمسار المختلط `bachelor`: لا تطبق عليهم التعديلات الزمنية؛ يُؤرشفون بقرار المالك ويُسجَّل غيرهم عند الحاجة.

## Commands

```powershell
cd web
node --test tests
npm run build
npx supabase@latest db query --remote --file ../supabase/migrations/0115_academic_year.sql
```

## Project Structure

- `supabase/migrations/0115_academic_year.sql` — الترحيل المرقم والـ backfill.
- `supabase/rollback/0115_academic_year_rollback.sql` — التراجع الكامل.
- `web/tests/academic-year-sql.test.mjs` — اختبار عقد الترحيل.
- `web/src/pages/owner/` و`web/src/pages/teacher/` — الواجهات في المراحل اللاحقة.

## Code Style

نمط `0114`: دوال `security definer` مع `set search_path = public`، تحقق `current_user_id()` و`is_owner()`، سجل في `audit_logs`، و`revoke/grant` صريح، ثم `notify pgrst` و`commit`.

## Testing Strategy

- اختبار عقد SQL: وجود الجداول والأعمدة، صلاحية الدوال، منع ON CONFLICT القديم، وجود rollback.
- تحقق عن بعد قراءةً فقط: عدد التسجيلات، تصنيفها في العام الحالي/الفصل الأول، دوال الصلاحية.
- لا إحصاءات وهمية ولا بيانات طلاب حقيقية في الكود أو الاختبارات.

## Boundaries

- Always: ترحيل مرقم + rollback + معاينة قبل أي تنفيذ + تدقيق + حماية `is_owner()` / `current_user_id()`.
- Ask first: تطبيق الترحيل على الإنتاج، أي توسيع لصلاحية الأستاذ، أي تغيير في `0103`.
- Never: حذف سجل طالب، نقل درجات فعلية بين الأعوام، كلمات مرور أو أسرار في الكود/Git، تشغيل `deploy:dev`.

## Success Criteria

- كل تسجيلات اليوم مصنّفة «العام الحالي / الفصل الأول» بعد الترحيل.
- لا يوجد `on conflict (course_id, student_id)` في الدوال المنشورة.
- الدوال الجديدة متاحة لـ `authenticated` فقط، ودوال الحارس لـ `service_role`.
- `npm run build` و`node --test tests` يمرّان.

## Out of Scope (Deferred)

- الأتمتة الكاملة للتخرج والقبول الجماعي: V2.
- إعادة فتح عام مغلق: V2.

## Open Questions

- تسمية العام الحالي في البيانات (`CURRENT` / `2026/2027`) قابلة للتعديل لاحقاً عبر المالك؛ لا تؤثر على المنطق.

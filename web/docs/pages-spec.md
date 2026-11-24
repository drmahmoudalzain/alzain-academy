# مواصفات صفحات الواجهة — لتسليمها لمصمّم الذكاء الاصطناعي

> هذه الوثيقة هي العقد بينك وبين مصمّم AI. أرسل له القسم الأول (القواعد) + صفحة واحدة
> من القسم الثاني في كل مرة. أنا أتولى الدمج والربط والبيانات والصلاحيات.

---

## 1) القواعد العامة (تُرسل كسياق دائم للمصمّم)

أنت تصمم صفحات **بوابة طالب** لمنصة تعليمية عربية (RTL) اسمها «أكاديمية آل الزين للعلوم القانونية والعدلية».

- الاتجاه: `dir="rtl"` واللغة `lang="ar"`. الترميز `UTF-8`.
- الخطوط: `Amiri` للعناوين، `Tajawal` للنصوص (روابط Google Fonts مرفقة أدناه).
- **لا تكتب شريطاً جانبياً ولا شريطاً علوياً** — أنا أضيفهما تلقائياً. اكتب **محتوى الصفحة فقط**.
- **لا تكتب أي منطق JavaScript ولا بيانات وهمية نهائية** — ضع عناصر فارغة بمعرّفات ثابتة (IDs) لأملأها أنا بالبيانات الحقيقية.
- القوائم والجداول المتكررة (مقررات، محاضرات، صفوف درجات…) اترك حاويتها **فارغة** بالمعرّف المطلوب، وأنا أملؤها.
- استخدم أسماء الفئات (CSS) الموجودة في المشروع **كما هي**، ولا تعرّف CSS جديداً إلا للضرورة.
- التصميم: ألوان الهوية هي ذهبي `#D4A017` وكحلي `#0B2545`، خلفية فاتحة، بطاقات ناعمة بظل خفيف، حواف مستديرة.

**البنية الثابتة لكل صفحة** (انسخها كما هي وعدّل فقط: `<title>`، روابط CSS الإضافية، والمحتوى بين تعليقي START/END):

```html
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{عنوان الصفحة} — أكاديمية آل الزين</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Tajawal:wght@300;400;500;700;800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/css/views/student-dashboard.css" />
  {CSS إضافي للصفحة إن وُجد}
  <link rel="stylesheet" href="/css/portal-theme.css" />
</head>
<body class="portal portal-student">
  <main class="content" id="content">
    <!-- ============ START ============ -->
    {محتوى الصفحة فقط — هنا}
    <!-- ============ END ============ -->
  </main>
</body>
</html>
```

---

## 2) الصفحات — بوابة الطالب (أول دفعة)

### 2.1 لوحة التحكم — `pages/student/dashboard.html` ✅ جاهزة
مكتملة بالفعل بالبيانات. لا حاجة لتسليمها (إن أردت إعادة تصميمها أخبرني).

---

### 2.2 المقررات — `pages/student/courses.html`
**CSS إضافي:** `/css/views/student.css`
**المحتوى المطلوب:**
- عنوان قسم «مقرراتي».
- شريط علوي صغير به:
  - `<span id="coursesCount">` لعدد المقررات.
  - `<span id="attendanceOverall">` لنسبة الحضور الكلية.
- حاوية فارغة للقائمة: `<div id="coursesList"></div>` (أنا أملؤها ببطاقات المقررات).
- حالة فارغة: `<div class="empty-state">لا توجد مقررات مسجلة بعد.</div>` (أظهرها أنا عند الحاجة).

---

### 2.3 المحاضرات — `pages/student/lectures.html`
**CSS إضافي:** `/css/views/student-lectures.css`
**المحتوى المطلوب:**
- عنوان قسم «المحاضرات».
- تبويبات تصفية (أنا أربطها):
  ```html
  <div class="tabs-nav">
    <button class="tab-btn active" data-tab="all">الكل</button>
    <button class="tab-btn" data-tab="upcoming">القادمة</button>
    <button class="tab-btn" data-tab="past">السابقة</button>
  </div>
  ```
- قائمة منسدلة للمقرر: `<select id="courseFilter"></select>` (أنا أملؤها).
- حاوية فارغة: `<div id="lecturesList"></div>`.
- حالة فارغة.

---

### 2.4 تفاصيل المحاضرة — `pages/student/lecture.html?id=123`
**CSS إضافي:** `/css/views/student-lecture.css`
**المحتوى المطلوب:**
- `<h1 id="lectureTitle">` عنوان المحاضرة.
- `<div id="lectureMeta">` (التاريخ/الوقت/النوع/المقرر — أملؤه).
- منطقة الفيديو/البث: `<div id="lectureBody"></div>`.
- منطقة الحضور: `<div id="attendanceStatus"></div>`.
- منطقة الأسئلة التفاعلية: `<div id="questions"></div>`.

---

### 2.5 الاختبارات — `pages/student/exams.html`
**CSS إضافي:** `/css/views/student-exam.css`
**المحتوى المطلوب:**
- عنوان قسم «الاختبارات».
- `<span id="examCount">` عدد الاختبارات المتاحة.
- حاوية فارغة: `<div id="examsList"></div>`.
- حالة فارغة.

---

### 2.6 تنفيذ الاختبار — `pages/student/exam.html?id=123`
**CSS إضافي:** `/css/views/student-exam.css`
**المحتوى المطلوب:**
- `<h1 id="examTitle">`.
- عدّاد وقت: `<div id="examTimer"></div>`.
- نموذج الأسئلة: `<form id="examForm"></form>` (أنا أملؤه بالأسئلة).
- زر الإرسال: `<button id="submitExam">تسليم</button>`.

---

### 2.7 الواجبات — `pages/student/assignments.html`
**CSS إضافي:** `/css/views/assignments.css`
**المحتوى المطلوب:**
- عنوان قسم «الواجبات».
- `<span id="pendingCount">` عدد الواجبات المعلقة.
- حاوية فارغة: `<div id="assignmentsList"></div>`.
- حالة فارغة.

---

### 2.8 الدرجات — `pages/student/grades.html`
**CSS إضافي:** `/css/views/grades.css`
**المحتوى المطلوب:**
- عنوان قسم «درجاتي».
- بطاقات ملخص: `<span id="gpaOverall">` (المعدل) و`<span id="coursesGraded">` (عدد المقررات المقيّمة).
- جدول فارغ بجسم: `<table><tbody id="gradesBody"></tbody></table>`.
- حالة فارغة.

---

### 2.9 النقاط — `pages/student/points.html`
**CSS إضافي:** `/css/views/points.css`
**المحتوى المطلوب:**
- `<span id="pointsTotal">` إجمالي النقاط.
- تفصيل الأنواع: `<div id="pointsBreakdown"></div>` (حضور/تفاعل/واجبات).
- تبويبات تصفية لسجل النقاط: `all` / `attendance` / `interaction` / `assignment`.
- جدول سجل: `<tbody id="ledgerBody"></tbody>`.

---

### 2.10 الإشعارات — `pages/notifications.html`
**CSS إضافي:** لا شيء (الأساس كافٍ)
**المحتوى المطلوب:**
- عنوان قسم «الإشعارات».
- حاوية فارغة: `<div id="notificationsList"></div>`.
- حالة فارغة.

---

### 2.11 الحساب — `pages/account.html`
**CSS إضافي:** `/css/views/student.css`
**المحتوى المطلوب:**
- `<span id="accountName">` الاسم.
- `<div id="accountMeta">` (الرمز، البريد، المسار، المستوى).
- نموذج تغيير كلمة المرور: `<form id="passwordForm">` بحقلين (`newPassword`, `confirmPassword`) وزر `<button type="submit">حفظ</button>`.

---

## 3) طريقة التسليم (بينك وبين المصمم)

1. أعطه **القسم 1 (القواعد)** مرة واحدة كسياق.
2. ثم أرسل له صفحة واحدة من القسم 2 في كل مرة.
3. هو يعيد لك **ملف HTML واحد** (محتوى الصفحة فقط بين START/END).
4. أرسل لي الملفات، وأنا أدمجها وأربطها بالبيانات والصلاحيات، ثم ننتقل للبوابة التالية.

> ملاحظة: لوحة تحكم الطالب (2.1) جاهزة الآن كمثال حي على الأسلوب والمظهر المطلوب.

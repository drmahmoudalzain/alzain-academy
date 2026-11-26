import { boot } from "../../lib/portal.js";
import { call } from "../../lib/api.js";
import { esc, fmtNum, fmtPoints, fmtDate, fmtDateTime, rel } from "../../lib/fmt.js";
import { icon } from "../../lib/icons.js";
import { p } from "../../lib/base.js";

const DISTRIBUTION = [
  { key: "excellent", label: "ممتاز" },
  { key: "very_good", label: "جيد جداً" },
  { key: "good", label: "جيد" },
  { key: "pass", label: "مقبول" },
  { key: "low", label: "منخفض" },
];

const isBachelorTrack = (track) =>
  ["bachelor", "bachelor_m", "bachelor_f"].includes(String(track ?? "").trim());

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const clampPct = (v) => Math.min(100, Math.max(0, num(v)));

const colorOf = (v, fallback = "#123A63") => {
  const c = String(v ?? "").trim();
  return /^#[\da-f]{3,8}$/i.test(c) ? c : fallback;
};

const initials = (code) =>
  String(code ?? "")
    .replace(/[^A-Za-z0-9\u0600-\u06FF]/g, "")
    .slice(0, 2) || "—";

const pctText = (v) => (v === null || v === undefined || v === "" ? "—" : `${fmtPoints(v)}%`);

const valueOrDash = (v) => (v === null || v === undefined || v === "" ? "—" : fmtPoints(v));

const skeleton = () => `
  <div class="gr-skeleton gr-skeleton-hero"></div>
  <div class="gr-stats">
    <div class="gr-skeleton gr-skeleton-stat"></div>
    <div class="gr-skeleton gr-skeleton-stat"></div>
    <div class="gr-skeleton gr-skeleton-stat"></div>
  </div>
  <div class="gr-skeleton gr-skeleton-card"></div>
  <div class="gr-skeleton gr-skeleton-card"></div>`;

const emptyBlock = (title, text, iconName = "grades", extra = "") => `
  <div class="gr-empty" role="status">
    <span class="gr-empty-icon">${icon(iconName)}</span>
    <h3>${esc(title)}</h3>
    <p>${esc(text)}</p>
    ${extra}
  </div>`;

const emptyPage = () => `
  <div class="gr-empty gr-empty-page" role="status">
    <span class="gr-empty-icon">${icon("grades")}</span>
    <h2>لا توجد درجات منشورة بعد</h2>
    <p>ستظهر هنا درجاتك ومعدلك فور اعتماد الاختبارات والواجبات وتسجيل الحضور. إن كنت تتوقع ظهور بياناتك، تواصل مع إدارة الأكاديمية.</p>
    <button class="gr-btn gr-btn-primary" type="button" data-reload>${icon("refresh")} تحديث البيانات</button>
  </div>`;

const errorBlock = () => `
  <div class="gr-empty gr-empty-page" role="alert">
    <span class="gr-empty-icon">${icon("close")}</span>
    <h2>تعذّر تحميل الدرجات</h2>
    <p>لم نتمكّن من جلب سجلك الأكاديمي الآن. تحقّق من اتصالك بالشبكة، ثم أعد المحاولة.</p>
    <button class="gr-btn gr-btn-primary" type="button" data-reload>${icon("refresh")} إعادة المحاولة</button>
  </div>`;

function metric(label, value, kind) {
  return `<div class="gr-metric" data-kind="${kind}">
    <div class="gr-metric-head"><span>${esc(label)}</span><strong>${pctText(value)}</strong></div>
    <div class="gr-bar" role="img" aria-label="${esc(label)}: ${pctText(value)}">
      <span style="--gr-bar:${clampPct(value)}%"></span>
    </div>
  </div>`;
}

function courseCard(course, metrics) {
  const title = esc(course.title || "مقرر بدون عنوان");
  const code = esc(course.code || "");
  const letterRaw = String(course.letter ?? "").trim();
  const letter = letterRaw ? esc(letterRaw) : "—";
  const letterTone = letterRaw.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2) || "none";
  const meta = [
    code,
    course.lectures_count != null ? `${fmtNum(course.lectures_count)} محاضرة` : "",
    course.exams_count != null ? `${fmtNum(course.exams_count)} اختبار` : "",
    course.assignments_count != null ? `${fmtNum(course.assignments_count)} واجب` : "",
  ].filter(Boolean);

  return `<article class="gr-course">
    <div class="gr-course-head">
      <span class="gr-course-icon" style="--gr-course:${colorOf(course.color)}">${esc(initials(course.code))}</span>
      <div class="gr-course-title">
        <h3>${title}</h3>
        <p>${meta.map((m) => `<span>${m}</span>`).join('<span class="gr-sep">·</span>')}</p>
      </div>
      <span class="gr-letter gr-letter-${esc(letterTone)}" aria-label="التقدير: ${letter}">${letter}</span>
    </div>
    <div class="gr-metrics">
      ${
        metrics
          ? `${metric("الحضور", course.attendance_pct, "attendance")}
             ${metric("التفاعل", course.interaction_pct, "interaction")}
             ${metric("الاختبارات", course.exam_pct, "exams")}`
          : metric("الواجبات", course.assignment_pct, "assignments")
      }
    </div>
    <div class="gr-course-foot">
      <span>الدرجة النهائية</span>
      <strong>${valueOrDash(course.total_pct ?? course.final_pct)}<small>/100</small></strong>
    </div>
  </article>`;
}

function distributionBlock(distribution) {
  const dist = distribution && typeof distribution === "object" ? distribution : {};
  const rows = DISTRIBUTION.map((d) => ({ ...d, count: Math.max(0, num(dist[d.key])) }));
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const max = Math.max(1, ...rows.map((row) => row.count));

  const body = total
    ? `<div class="gr-dist">${rows
        .map(
          (row) => `<div class="gr-dist-row ${row.key}">
            <span class="gr-dist-label">${esc(row.label)}</span>
            <div class="gr-bar" role="img" aria-label="${esc(row.label)}: ${fmtNum(row.count)} مقرر">
              <span style="--gr-bar:${Math.round((row.count / max) * 100)}%"></span>
            </div>
            <strong>${fmtNum(row.count)}</strong>
          </div>`
        )
        .join("")}</div>`
    : emptyBlock("لا يوجد توزيع بعد", "سيظهر توزيع التقديرات عند توفر مقررات مكتملة الدرجات.", "grades");

  return `<section class="gr-card">
    <h3>${icon("grades")} توزيع التقديرات</h3>
    ${body}
  </section>`;
}

function renderGrades(data, metrics) {
  const d = data && typeof data === "object" ? data : {};
  const courses = Array.isArray(d.courses) ? d.courses : [];

  const hasData =
    courses.length > 0 ||
    num(d.gpa) > 0 ||
    num(d.average) > 0 ||
    DISTRIBUTION.some((k) => num(d.distribution?.[k.key]) > 0);

  if (!hasData) return emptyPage();

  const gpa = num(d.gpa);
  const ring = Math.round((Math.min(4, Math.max(0, gpa)) / 4) * 360);

  return `
    <section class="gr-hero">
      <div class="gr-hero-info">
        <span class="gr-hero-tag">${icon("grades")} سجلك الأكاديمي</span>
        <h2>معدلك التراكمي</h2>
        <p>تُحسب الدرجات من الاختبارات المنشورة والواجبات المقيّمة وسجل الحضور، وتُحدَّث فور اعتماد أي نتيجة جديدة.</p>
        <a class="gr-hero-link" href="${p("pages/student/points.html")}">نقاطي ${icon("arrow")}</a>
      </div>
      <div class="gr-ring" role="img" aria-label="المعدل التراكمي ${valueOrDash(d.gpa)} من أربعة" style="--gr-ring:${ring}deg">
        <div class="gr-ring-inner">
          <strong>${valueOrDash(d.gpa)}</strong>
          <span>من 4.00</span>
        </div>
      </div>
    </section>

    <section class="gr-stats" aria-label="ملخص الدرجات">
      <div class="gr-stat average">
        <span class="gr-stat-icon">${icon("grades")}</span>
        <span class="gr-stat-body"><span>متوسط الدرجات</span><strong>${valueOrDash(d.average)}${d.average === null || d.average === undefined || d.average === "" ? "" : "<small>%</small>"}</strong></span>
      </div>
      <div class="gr-stat courses">
        <span class="gr-stat-icon">${icon("book")}</span>
        <span class="gr-stat-body"><span>المقررات المسجلة</span><strong>${fmtNum(d.courses_count ?? courses.length)}</strong></span>
      </div>
      <div class="gr-stat completed">
        <span class="gr-stat-icon">${icon("checks")}</span>
        <span class="gr-stat-body"><span>مقررات مكتملة</span><strong>${fmtNum(d.completed_count ?? 0)}</strong></span>
      </div>
    </section>

    <section class="gr-section" aria-labelledby="grCoursesTitle">
      <div class="gr-section-head">
        <h2 id="grCoursesTitle">${icon("courses")} درجات المقررات</h2>
        <span>نسب مئوية من الدرجة الكلية لكل مقرر</span>
      </div>
      ${
        courses.length
          ? `<div class="gr-courses">${courses.map((course) => courseCard(course, metrics)).join("")}</div>`
          : emptyBlock("لا توجد درجات مقررات بعد", "ستظهر درجات كل مقرر هنا بعد نشر الاختبارات وتقييم الواجبات وتسجيل الحضور.", "courses")
      }
    </section>

    ${distributionBlock(d.distribution)}`;
}

boot("student", "درجاتي", async ({ profile }) => {
  const view = document.getElementById("grView") || document.getElementById("content");
  const reloadBtn = document.getElementById("grReload");
  const metrics = isBachelorTrack(profile?.track);

  async function load() {
    view.innerHTML = skeleton();
    if (reloadBtn) reloadBtn.disabled = true;
    try {
      const res = await call("student_grades");
      if (!res.ok) {
        console.error("[student_grades]", res.error);
        view.innerHTML = errorBlock();
        return;
      }
      view.innerHTML = renderGrades(res.data, metrics);
    } catch (err) {
      console.error("[student_grades]", err);
      view.innerHTML = errorBlock();
    } finally {
      if (reloadBtn) reloadBtn.disabled = false;
    }
  }

  view.addEventListener("click", (e) => {
    if (e.target.closest("[data-reload]")) load();
  });
  if (reloadBtn) reloadBtn.addEventListener("click", load);

  await load();
});

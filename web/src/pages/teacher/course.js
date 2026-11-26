import { boot } from "../../lib/portal.js";
import { call } from "../../lib/api.js";
import { esc, fmtDate, fmtDateTime, fmtNum, fmtPoints, rel } from "../../lib/fmt.js";
import { icon } from "../../lib/icons.js";
import { p } from "../../lib/base.js";
import { skeleton } from "../../lib/loading.js";
import { $, emptyState, openForm, safeColor } from "./common.js";

const id = Number(new URLSearchParams(location.search).get("id"));
const state = { course: null, data: null };

const TYPES = {
  direct: { label: "مباشر", cls: "tdc-good" },
  online: { label: "أونلاين", cls: "" },
  recorded: { label: "مسجل", cls: "tdc-muted" },
};
const TRACKS = [
  { value: "bachelor", label: "بكالوريوس (عام)" },
  { value: "bachelor_m", label: "بكالوريوس — ذكور" }, { value: "bachelor_f", label: "بكالوريوس — إناث" },
  { value: "equiv", label: "معادل" }, { value: "external", label: "خارجي" }, { value: "grad", label: "دراسات عليا" },
];
const LEVELS = [
  { value: "1", label: "الأول" }, { value: "2", label: "الثاني" },
  { value: "3", label: "الثالث" }, { value: "4", label: "الرابع" },
];

function isoOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function table(headers, rows) {
  if (!rows.length) return "";
  return `<div class="tt-table-wrap"><table class="tt-table">
    <thead><tr>${headers.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead>
    <tbody>${rows.join("")}</tbody></table></div>`;
}

function hero(c, s) {
  const color = safeColor(c.color);
  return `<div class="tdc-hero-body">
    <div class="tdc-crumb"><a href="${p("pages/teacher/courses.html")}">مقرراتي</a> / تفاصيل المقرر</div>
    <div class="tdc-hero-main">
      <span class="tdc-code">${esc(c.code || "—")}</span>
      <div class="tdc-hero-info">
        <div class="tdc-title-row">
          <h1>${esc(c.title || "مقرر")}</h1>
          <span class="tdc-state ${c.archived ? "tdc-off" : ""}">${c.archived ? "مؤرشف" : "نشط"}</span>
        </div>
        ${c.description ? `<p class="tdc-desc">${esc(c.description)}</p>` : ""}
        <div class="tdc-meta">
          <span>${icon("courses")}${esc((TRACKS.find((t) => t.value === c.track) || {}).label || c.track || "—")}</span>
          <span>${icon("grades")}المستوى ${esc((LEVELS.find((l) => l.value === String(c.level)) || {}).label || "—")}</span>
          <span>${icon("calendar")}${esc(fmtDate(c.created_at))}</span>
        </div>
      </div>
    </div>
  </div>
  <div class="tdc-actions">
    <button class="tt-btn" type="button" data-goto="assignments">${icon("plus")}واجب جديد</button>
  </div>
  <div class="tdc-stats">
    <div class="tdc-stat"><span class="tdc-stat-value">${esc(fmtNum(s.students))}</span><span class="tdc-stat-label">طالب</span></div>
    <div class="tdc-stat"><span class="tdc-stat-value">${esc(fmtNum(s.lectures))}</span><span class="tdc-stat-label">محاضرة</span></div>
    <div class="tdc-stat"><span class="tdc-stat-value">${esc(fmtNum(s.exams))}</span><span class="tdc-stat-label">اختبار</span></div>
    <div class="tdc-stat"><span class="tdc-stat-value">${esc(fmtNum(s.assignments))}</span><span class="tdc-stat-label">واجب</span></div>
  </div>`;
}

function activityRow(a) {
  const ico = a.kind === "submission" ? "file" : a.kind === "enrollment" ? "users" : a.kind === "exam" ? "exams" : "lectures";
  return `<div class="tdc-row">
    <span class="tdc-item-icon">${icon(ico)}</span>
    <span class="tdc-row-body"><span class="tdc-row-title">${esc(a.title || "نشاط")}</span><span class="tdc-row-sub">${esc(a.detail || "")}</span></span>
    <span class="tdc-hint">${esc(rel(a.at))}</span>
  </div>`;
}

function submissionRow(s) {
  return `<div class="tdc-row">
    <span class="tdc-item-icon">${icon("file")}</span>
    <span class="tdc-row-body">
      <span class="tdc-row-title">${esc(s.student_name || "طالب")} — ${esc(s.assignment_title || "واجب")}</span>
      <span class="tdc-row-sub">${esc(fmtDateTime(s.submitted_at))} · ${esc(s.feedback || "لا توجد ملاحظات")}</span>
    </span>
    <span class="tdc-badge ${s.points === null ? "tdc-warn" : "tdc-good"}">${s.points === null ? "بانتظار التصحيح" : `${esc(fmtPoints(s.points))}/${esc(fmtPoints(s.max_points))}`}</span>
    <span class="tdc-hint">التصحيح للإدارة</span>
  </div>`;
}

function lectureCard(l) {
  const type = TYPES[l.lecture_type] || TYPES.recorded;
  return `<article class="tdc-item">
    <div class="tdc-item-head">
      <h3>${esc(l.title || "محاضرة")}</h3>
      <span class="tdc-badge ${type.cls}">${esc(type.label)}</span>
    </div>
    ${l.description ? `<p class="tdc-item-desc">${esc(l.description)}</p>` : ""}
    <div class="tdc-item-meta">
      <span>${icon("calendar")}${esc(fmtDateTime(l.scheduled_at))}</span>
      <span>${icon("clock")}${esc(fmtNum(l.duration_min))} دقيقة</span>
      <span>${icon("users")}${esc(fmtNum(l.attendance_count))} حاضر</span>
      <span>${icon("file")}${esc(fmtNum(l.questions_count))} سؤال</span>
    </div>
  </article>`;
}

function examCard(x) {
  return `<article class="tdc-item">
    <div class="tdc-item-head">
      <h3>${esc(x.title || "اختبار")}</h3>
      <span class="tdc-badge ${x.is_published ? "tdc-good" : "tdc-muted"}">${x.is_published ? "منشور" : "مسودة"}</span>
    </div>
    ${x.description ? `<p class="tdc-item-desc">${esc(x.description)}</p>` : ""}
    <div class="tdc-item-meta">
      <span>${icon("calendar")}${esc(fmtDateTime(x.starts_at))}</span>
      <span>${icon("clock")}${esc(x.duration_min ? `${fmtNum(x.duration_min)} دقيقة` : "—")}</span>
      <span>${icon("file")}${esc(fmtNum(x.questions_count))} سؤال</span>
      <span>${icon("users")}${esc(fmtNum(x.attempts_count))} تسليم</span>
      <span>${icon("grades")}${esc(fmtPoints(x.avg_score))} متوسط</span>
    </div>
  </article>`;
}

function assignmentCard(a) {
  return `<article class="tdc-item">
    <div class="tdc-item-head">
      <h3>${esc(a.title || "واجب")}</h3>
      <span class="tdc-badge">${esc(fmtPoints(a.max_points))} درجة</span>
    </div>
    ${a.description ? `<p class="tdc-item-desc">${esc(a.description)}</p>` : ""}
    <div class="tdc-item-meta">
      <span>${icon("calendar")}${esc(fmtDateTime(a.due_at))}</span>
      <span>${icon("users")}${esc(fmtNum(a.submissions_count))} تسليم</span>
      <span>${icon("checks")}${esc(fmtNum(a.graded_count))} مُصحَّح</span>
      <span>${icon("grades")}${esc(fmtPoints(a.avg_points))} متوسط</span>
    </div>
  </article>`;
}

function studentDetailHref(student) {
  const studentId = student.student_id ?? student.id;
  return `${p("pages/teacher/course.html")}?id=${encodeURIComponent(id)}&student=${encodeURIComponent(studentId)}`;
}

function renderStudents(list) {
  const q = $("#tdcStudentSearch").value.trim().toLowerCase();
  const rows = list
    .filter((s) => !q || [s.name, s.platform_id, s.university_id, s.email].some((v) => String(v || "").toLowerCase().includes(q)))
    .map((s) => {
      const detailHref = studentDetailHref(s);
      return `<tr>
        <td><a class="tdc-student-link" href="${detailHref}"><strong>${esc(s.name)}</strong></a><br /><small>${esc(s.platform_id || s.university_id || "—")}</small></td>
        <td>${esc(fmtPoints(s.exam_pct))}%</td><td>${esc(fmtPoints(s.attendance_pct))}%</td>
        <td>${esc(fmtPoints(s.assignment_pct))}%</td><td><strong>${esc(fmtPoints(s.final_pct))}%</strong></td>
        <td>${esc(s.letter)}</td><td>${esc(fmtNum(s.points))}</td>
        <td><a class="tt-btn" href="${detailHref}">بيانات الطالب</a></td>
      </tr>`;
    });
  $("#tdcStudents").innerHTML = table(["الطالب", "الاختبارات", "الحضور", "الواجبات", "النهائي", "التقدير", "النقاط", "بيانات الطالب"], rows)
    || emptyState("لا طلاب مسجلين", "تسجيل الطلاب من بوابة الإدارة.", "users");
}

function renderStudentDetails(list) {
  const panel = $("#tdcStudentDetails");
  if (!panel) return;
  const requested = new URLSearchParams(location.search).get("student");
  const student = requested && list.find((s) => String(s.id ?? s.student_id) === String(requested));
  if (!student) {
    panel.hidden = true;
    return;
  }
  $("#tdcStudentDetailsBody").innerHTML = `<dl class="tdc-student-details">
    <div><dt>الاسم</dt><dd>${esc(student.name || "—")}</dd></div>
    <div><dt>رمز المنصة</dt><dd dir="ltr">${esc(student.platform_id || "—")}</dd></div>
    <div><dt>الرقم الجامعي</dt><dd dir="ltr">${esc(student.university_id || "—")}</dd></div>
    <div><dt>البريد</dt><dd dir="ltr">${esc(student.email || "—")}</dd></div>
    <div><dt>حالة التسجيل</dt><dd>${esc(student.status === "active" ? "نشط" : "موقوف")}</dd></div>
    <div><dt>تاريخ التسجيل</dt><dd>${esc(fmtDate(student.enrolled_at))}</dd></div>
    <div><dt>الاختبارات</dt><dd>${esc(fmtPoints(student.exam_pct))}%</dd></div>
    <div><dt>الحضور</dt><dd>${esc(fmtPoints(student.attendance_pct))}%</dd></div>
    <div><dt>الواجبات</dt><dd>${esc(fmtPoints(student.assignment_pct))}%</dd></div>
    <div><dt>الدرجة النهائية</dt><dd>${esc(fmtPoints(student.final_pct))}% · ${esc(student.letter)}</dd></div>
    <div><dt>النقاط</dt><dd>${esc(fmtNum(student.points))}</dd></div>
  </dl>`;
  panel.hidden = false;
}

function renderGradebook(list) {
  const rows = list.map((g) => `<tr>
    <td><strong>${esc(g.name)}</strong><br /><small>${esc(g.platform_id || "—")}</small></td>
    <td>${esc(fmtPoints(g.exam_pct))}%</td><td>${esc(fmtPoints(g.attendance_pct))}%</td>
    <td>${esc(fmtPoints(g.assignment_pct))}%</td><td><strong>${esc(fmtPoints(g.final_pct))}%</strong></td>
    <td>${esc(g.letter)}</td><td>${esc(fmtNum(g.points))}</td>
  </tr>`);
  $("#tdcGradebook").innerHTML = table(["الطالب", "الاختبارات", "الحضور", "الواجبات", "النهائي", "التقدير", "النقاط"], rows)
    || emptyState("لا درجات محسوبة", "ستظهر الدرجات فور تسجيل الطلاب وإدخال نتائج التقييمات.", "grades");
}

function forms() {
  return {
    assignment: () => openForm({
      title: "واجب جديد",
      fields: [
        { name: "title", label: "عنوان الواجب", required: true },
        { name: "due_at", label: "موعد التسليم", type: "datetime-local" },
        { name: "max_points", label: "الدرجة القصوى", type: "number", value: 10, min: 0.5, step: 0.5, required: true },
        { name: "description", label: "الوصف", type: "textarea", fieldClass: "tt-field-wide" },
      ],
      submitLabel: "إضافة الواجب",
      onSubmit: async (v) => {
        const res = await call("teacher_create_assignment", {
          p_course_id: id, p_title: v.title, p_description: v.description || null,
          p_due_at: isoOrNull(v.due_at), p_max_points: Number(v.max_points),
        });
        if (!res.ok) return { ok: false, error: res.error };
        await load();
        return { ok: true, message: "تمت إضافة الواجب" };
      },
    }),
  };
}

function switchTab(tab) {
  document.querySelectorAll(".tdc-tab").forEach((b) => {
    const on = b.dataset.tab === tab;
    b.classList.toggle("tdc-active", on);
    b.setAttribute("aria-selected", String(on));
  });
  document.querySelectorAll(".tdc-pane").forEach((pane) => { pane.hidden = pane.dataset.pane !== tab; });
}

async function load() {
  const res = await call("teacher_course_detail", { p_course_id: id });
  if (!res.ok) {
    $("#tdcHero").innerHTML = emptyState("تعذّر تحميل المقرر", res.error || "تحقّق من الاتصال ثم أعد المحاولة.", "courses");
    return;
  }
  const d = res.data || {};
  state.course = d.course || {};
  state.data = d;
  const s = d.stats || {};

  $("#tdcHero").innerHTML = hero(state.course, s);
  $("#tdcHero").style.setProperty("--tdc-color", safeColor(state.course.color));
  $("#tdcTabs").hidden = false;
  $("#tdcPanes").hidden = false;
  if (new URLSearchParams(location.search).get("student")) switchTab("students");

  document.querySelectorAll("[data-tab-count]").forEach((n) => {
    n.textContent = fmtNum(s[n.dataset.tabCount] ?? 0);
  });

  $("#tdcActivity").innerHTML = (d.activity || []).length
    ? (d.activity || []).slice(0, 10).map(activityRow).join("")
    : emptyState("لا نشاط بعد", "ستظهر أحداث المقرر هنا فور تسجيل الطلاب أو إضافة المحتوى.", "history");
  $("#tdcPendingCount").textContent = `${fmtNum(s.pending)} بانتظار التصحيح — للإدارة`;
  $("#tdcSubmissions").innerHTML = (d.submissions || []).length
    ? (d.submissions || []).map(submissionRow).join("")
    : emptyState("لا تسليمات بعد", "ستظهر تسليمات الطلاب هنا فور وصولها.", "file");
  renderStudents(d.students || []);
  renderStudentDetails(d.students || []);
  renderGradebook(d.gradebook || []);
  $("#tdcLectures").innerHTML = (d.lectures || []).length
    ? (d.lectures || []).map(lectureCard).join("")
    : emptyState("لا محاضرات بعد", "المحاضرات تُضاف من بوابة الإدارة.", "lectures");
  $("#tdcExams").innerHTML = (d.exams || []).length
    ? (d.exams || []).map(examCard).join("")
    : emptyState("لا اختبارات بعد", "الاختبارات تُضاف من بوابة الإدارة.", "exams");
  $("#tdcAssignments").innerHTML = (d.assignments || []).length
    ? (d.assignments || []).map(assignmentCard).join("")
    : emptyState("لا واجبات بعد", "أضف واجبك الأول من زر «واجب جديد».", "assignments");
}

boot({
  portal: "teacher",
  title: "تفاصيل المقرر",
  render: async ({ content }) => {
    if (!Number.isFinite(id) || id <= 0) {
      $("#tdcHero").innerHTML = emptyState("مقرر غير محدد", "افتح المقرر من صفحة مقرراتي.", "courses");
      return;
    }
    $("#tdcHero").innerHTML = skeleton("hero", 1);
    const f = forms();

    content.addEventListener("click", (e) => {
      const tab = e.target.closest(".tdc-tab");
      if (tab) { switchTab(tab.dataset.tab); return; }
      const go = e.target.closest("[data-goto]");
      if (go) { switchTab(go.dataset.goto); return; }
    });

    $("#tdcAddAssignment").addEventListener("click", f.assignment);
    $("#tdcStudentSearch").addEventListener("input", () => renderStudents(state.data?.students || []));
    $("#tdcStudentDetailsClose")?.addEventListener("click", () => {
      const url = new URL(location.href);
      url.searchParams.delete("student");
      history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
      $("#tdcStudentDetails").hidden = true;
    });

    await load();
  },
});

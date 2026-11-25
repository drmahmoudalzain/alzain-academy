import { boot } from "../../lib/portal.js";
import { call } from "../../lib/api.js";
import { esc, fmtDate, fmtDateTime, fmtNum, fmtPoints, rel } from "../../lib/fmt.js";
import { icon } from "../../lib/icons.js";
import { p } from "../../lib/base.js";
import { skeleton } from "../../lib/loading.js";
import { $, emptyState, openForm, safeColor, toast } from "./common.js";

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
    <button class="tt-btn" type="button" id="tdcEdit">${icon("edit")}تعديل المقرر</button>
    <button class="tt-btn" type="button" data-goto="lectures">${icon("plus")}محاضرة جديدة</button>
    <button class="tt-btn" type="button" data-goto="students">${icon("users")}إضافة طالب</button>
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
    <button class="tt-btn tt-btn-ghost" type="button" data-grade="${esc(s.id)}"
      data-name="${esc(s.student_name || "الطالب")}" data-title="${esc(s.assignment_title || "الواجب")}"
      data-max="${esc(s.max_points ?? 10)}" data-points="${s.points ?? ""}" data-feedback="${esc(s.feedback || "")}">${s.points === null ? "تصحيح" : "تعديل"}</button>
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
    <div class="tdc-item-actions">
      <button class="tt-btn tt-btn-secondary" type="button" data-attendance="${esc(l.id)}" data-open="${l.attendance_open ? "1" : "0"}">
        ${icon(l.attendance_open ? "close" : "check")}${l.attendance_open ? "إغلاق الحضور" : "فتح الحضور"}
      </button>
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

function renderStudents(list) {
  const q = $("#tdcStudentSearch").value.trim().toLowerCase();
  const rows = list
    .filter((s) => !q || [s.name, s.platform_id, s.university_id, s.email].some((v) => String(v || "").toLowerCase().includes(q)))
    .map((s) => `<tr>
      <td><strong>${esc(s.name)}</strong><br /><small>${esc(s.platform_id || s.university_id || "—")}</small></td>
      <td>${esc(fmtPoints(s.exam_pct))}%</td><td>${esc(fmtPoints(s.attendance_pct))}%</td>
      <td>${esc(fmtPoints(s.assignment_pct))}%</td><td><strong>${esc(fmtPoints(s.final_pct))}%</strong></td>
      <td>${esc(s.letter)}</td><td>${esc(fmtNum(s.points))}</td>
    </tr>`);
  $("#tdcStudents").innerHTML = table(["الطالب", "الاختبارات", "الحضور", "الواجبات", "النهائي", "التقدير", "النقاط"], rows)
    || emptyState("لا طلاب مسجلين", "أضف طالباً باستخدام زر «إضافة طالب».", "users");
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

function openGrade(id, name, title, max, points, feedback) {
  openForm({
    title: points === "" ? "تصحيح تسليم" : "تعديل الدرجة",
    intro: `${name} — ${title}`,
    fields: [
      { name: "points", label: `الدرجة (من ${max})`, type: "number", min: 0, max: Number(max) || 0, step: "0.5", value: points, required: true },
      { name: "feedback", label: "ملاحظات للطالب", type: "textarea", value: feedback, fieldClass: "tt-field-wide" },
    ],
    submitLabel: "حفظ الدرجة",
    onSubmit: async (v) => {
      const res = await call("teacher_grade_submission", {
        p_submission_id: Number(id), p_points: Number(v.points), p_feedback: v.feedback || null,
      });
      if (!res.ok) return { ok: false, error: res.error };
      await load();
      return { ok: true, message: "تم حفظ الدرجة" };
    },
  });
}

function forms() {
  const c = state.course || {};
  return {
    edit: () => openForm({
      title: "تعديل المقرر",
      fields: [
        { name: "title", label: "عنوان المقرر", value: c.title || "", required: true },
        { name: "description", label: "الوصف", type: "textarea", value: c.description || "", fieldClass: "tt-field-wide" },
        { name: "track", label: "المسار", type: "select", value: c.track || "bachelor_m", options: TRACKS },
        { name: "level", label: "المستوى", type: "select", value: c.level ? String(c.level) : "1", options: LEVELS },
        { name: "color", label: "اللون", type: "color", value: c.color || "#123A63" },
        { name: "archived", label: "الحالة", type: "select", value: c.archived ? "1" : "0", options: [{ value: "0", label: "نشط" }, { value: "1", label: "مؤرشف" }] },
        { name: "attendance_weight", label: "وزن الحضور %", type: "number", value: c.attendance_weight ?? 10, required: true },
        { name: "exams_weight", label: "وزن الاختبارات %", type: "number", value: c.exams_weight ?? 60, required: true },
        { name: "assignments_weight", label: "وزن الواجبات %", type: "number", value: c.assignments_weight ?? 30, required: true, hint: "المجموع = 100" },
      ],
      submitLabel: "حفظ التعديلات",
      onSubmit: async (v) => {
        const res = await call("teacher_update_course", {
          p_course_id: id, p_title: v.title, p_description: v.description || null, p_color: v.color,
          p_archived: v.archived === "1", p_track: v.track, p_level: Number(v.level),
          p_attendance_weight: Number(v.attendance_weight), p_exams_weight: Number(v.exams_weight),
          p_assignments_weight: Number(v.assignments_weight),
        });
        if (!res.ok) return { ok: false, error: res.error };
        await load();
        return { ok: true, message: "تم حفظ التعديلات" };
      },
    }),
    lecture: () => openForm({
      title: "محاضرة جديدة",
      fields: [
        { name: "title", label: "عنوان المحاضرة", required: true },
        { name: "lecture_type", label: "النوع", type: "select", value: "direct", options: [
          { value: "direct", label: "مباشر" }, { value: "online", label: "أونلاين" }, { value: "recorded", label: "مسجل" },
        ] },
        { name: "scheduled_at", label: "الموعد", type: "datetime-local" },
        { name: "duration_min", label: "المدة (دقيقة)", type: "number", value: 120, min: 1 },
        { name: "description", label: "الوصف", type: "textarea", fieldClass: "tt-field-wide" },
        { name: "youtube_url", label: "رابط يوتيوب" },
        { name: "live_url", label: "رابط البث" },
      ],
      submitLabel: "إضافة المحاضرة",
      onSubmit: async (v) => {
        const res = await call("teacher_add_lecture", {
          p_course_id: id, p_title: v.title, p_description: v.description || null,
          p_lecture_type: v.lecture_type, p_scheduled_at: isoOrNull(v.scheduled_at),
          p_duration_min: Number(v.duration_min) || 120,
          p_youtube_url: v.youtube_url || null, p_live_url: v.live_url || null,
        });
        if (!res.ok) return { ok: false, error: res.error };
        await load();
        return { ok: true, message: "تمت إضافة المحاضرة" };
      },
    }),
    exam: () => openForm({
      title: "اختبار جديد",
      fields: [
        { name: "title", label: "عنوان الاختبار", required: true },
        { name: "exam_kind", label: "النوع", type: "select", value: "exam", options: [
          { value: "exam", label: "اختبار" }, { value: "assignment", label: "واجب كاختبار" },
        ] },
        { name: "starts_at", label: "وقت البدء", type: "datetime-local" },
        { name: "ends_at", label: "وقت الانتهاء", type: "datetime-local" },
        { name: "duration_min", label: "المدة (دقيقة)", type: "number", min: 1 },
        { name: "is_published", label: "الحالة", type: "select", value: "0", options: [
          { value: "0", label: "مسودة" }, { value: "1", label: "منشور" },
        ] },
        { name: "description", label: "الوصف", type: "textarea", fieldClass: "tt-field-wide" },
      ],
      submitLabel: "إضافة الاختبار",
      onSubmit: async (v) => {
        const res = await call("teacher_create_exam", {
          p_course_id: id, p_title: v.title, p_description: v.description || null,
          p_exam_kind: v.exam_kind, p_starts_at: isoOrNull(v.starts_at), p_ends_at: isoOrNull(v.ends_at),
          p_duration_min: v.duration_min ? Number(v.duration_min) : null, p_is_published: v.is_published === "1",
        });
        if (!res.ok) return { ok: false, error: res.error };
        await load();
        return { ok: true, message: "تمت إضافة الاختبار" };
      },
    }),
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
    enroll: () => openForm({
      title: "إضافة طالب",
      intro: "أدخل بريد الطالب أو رقمه الأكاديمي أو رمزه على المنصة.",
      fields: [{ name: "identifier", label: "معرّف الطالب", required: true }],
      submitLabel: "إضافة إلى المقرر",
      onSubmit: async (v) => {
        const res = await call("teacher_enroll_student", { p_course_id: id, p_identifier: v.identifier });
        if (!res.ok) return { ok: false, error: res.error };
        await load();
        return { ok: true, message: `تمت إضافة ${res.data?.name || "الطالب"}` };
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

  document.querySelectorAll("[data-tab-count]").forEach((n) => {
    n.textContent = fmtNum(s[n.dataset.tabCount] ?? 0);
  });

  $("#tdcActivity").innerHTML = (d.activity || []).length
    ? (d.activity || []).slice(0, 10).map(activityRow).join("")
    : emptyState("لا نشاط بعد", "ستظهر أحداث المقرر هنا فور تسجيل الطلاب أو إضافة المحتوى.", "history");
  $("#tdcPendingCount").textContent = `${fmtNum(s.pending)} بانتظار التصحيح`;
  $("#tdcSubmissions").innerHTML = (d.submissions || []).length
    ? (d.submissions || []).map(submissionRow).join("")
    : emptyState("لا تسليمات بعد", "ستظهر تسليمات الطلاب هنا فور وصولها.", "file");
  renderStudents(d.students || []);
  renderGradebook(d.gradebook || []);
  $("#tdcLectures").innerHTML = (d.lectures || []).length
    ? (d.lectures || []).map(lectureCard).join("")
    : emptyState("لا محاضرات بعد", "أضف محاضرتك الأولى من زر «محاضرة جديدة».", "lectures");
  $("#tdcExams").innerHTML = (d.exams || []).length
    ? (d.exams || []).map(examCard).join("")
    : emptyState("لا اختبارات بعد", "أضف اختبارك الأول من زر «اختبار جديد».", "exams");
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
      const grade = e.target.closest("[data-grade]");
      if (grade) {
        openGrade(grade.dataset.grade, grade.dataset.name, grade.dataset.title, grade.dataset.max, grade.dataset.points, grade.dataset.feedback);
        return;
      }
      const attendance = e.target.closest("[data-attendance]");
      if (attendance) {
        const lid = Number(attendance.dataset.attendance);
        if (attendance.dataset.open === "1") {
          call("teacher_set_attendance", { p_lecture_id: lid, p_open: false }).then((res) => {
            if (res.ok) { toast("تم إغلاق باب الحضور"); load(); } else toast(res.error, "error");
          });
        } else {
          openForm({
            title: "فتح باب الحضور",
            intro: "سيظهر رمز الحضور للطلاب المسجلين في المقرر.",
            fields: [{ name: "code", label: "رمز الحضور", required: true, placeholder: "مثال: 4821" }],
            submitLabel: "فتح الحضور",
            onSubmit: async (v) => {
              const res = await call("teacher_set_attendance", { p_lecture_id: lid, p_open: true, p_code: v.code });
              if (!res.ok) return { ok: false, error: res.error };
              await load();
              return { ok: true, message: "تم فتح باب الحضور" };
            },
          });
        }
      }
    });

    content.addEventListener("click", (e) => { if (e.target.closest("#tdcEdit")) f.edit(); });
    $("#tdcEnroll").addEventListener("click", f.enroll);
    $("#tdcAddLecture").addEventListener("click", f.lecture);
    $("#tdcAddExam").addEventListener("click", f.exam);
    $("#tdcAddAssignment").addEventListener("click", f.assignment);
    $("#tdcStudentSearch").addEventListener("input", () => renderStudents(state.data?.students || []));

    await load();
  },
});

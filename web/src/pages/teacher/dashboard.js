import { boot } from "../../lib/portal.js";
import { call } from "../../lib/api.js";
import { esc, fmtDateTime, fmtNum, rel } from "../../lib/fmt.js";
import { icon } from "../../lib/icons.js";
import { p } from "../../lib/base.js";
import { skeleton } from "../../lib/loading.js";
import { $, emptyState, initial, openForm, safeColor } from "./common.js";

function stat(label, value, unit, ico, cls = "") {
  return `<div class="td-stat ${cls}">
    <span class="td-stat-icon">${icon(ico)}</span>
    <span class="td-stat-label">${esc(label)}</span>
    <span class="td-stat-value">${esc(fmtNum(value))}<small>${esc(unit)}</small></span>
  </div>`;
}

function courseCard(c) {
  const color = safeColor(c.color);
  const href = `${p("pages/teacher/course.html")}?id=${encodeURIComponent(c.id)}`;
  return `<a class="td-course" style="--td-color:${color}" href="${esc(href)}">
    <span class="td-course-mark">${esc(initial(c.code))}</span>
    <span class="td-course-body">
      <span class="td-course-title">${esc(c.title || "مقرر")} <span class="td-badge">${esc(c.code || "—")}</span></span>
      <span class="td-course-sub">${fmtNum(c.students)} طالب · ${fmtNum(c.lectures)} محاضرة · ${fmtNum(c.exams)} اختبار${c.pending ? ` · ${fmtNum(c.pending)} بانتظار التصحيح` : ""}</span>
    </span>
    <span class="td-course-arrow">${icon("chevron")}</span>
  </a>`;
}

function submissionRow(s) {
  const course = [s.course_code, s.course_title].filter(Boolean).join(" — ");
  return `<div class="td-item">
    <span class="td-item-icon">${icon("file")}</span>
    <span class="td-item-body">
      <span class="td-item-title">${esc(s.student_name || "طالب")} — ${esc(s.assignment_title || "واجب")}</span>
      <span class="td-item-sub">${esc(course)} · ${esc(fmtDateTime(s.submitted_at))}${s.submitted_at ? ` · ${esc(rel(s.submitted_at))}` : ""}</span>
    </span>
    <button class="tt-btn tt-btn-ghost" type="button" data-grade="${esc(s.id)}"
      data-name="${esc(s.student_name || "الطالب")}" data-title="${esc(s.assignment_title || "الواجب")}"
      data-max="${esc(s.max_points ?? 10)}">تصحيح</button>
  </div>`;
}

function scheduleRow(k) {
  const isExam = k.kind === "exam";
  return `<div class="td-item">
    <span class="td-item-icon">${icon(isExam ? "exams" : "lectures")}</span>
    <span class="td-item-body">
      <span class="td-item-title">${esc(k.title || (isExam ? "اختبار" : "محاضرة"))} <span class="td-badge ${isExam ? "td-exam" : ""}">${isExam ? "اختبار" : "محاضرة"}</span></span>
      <span class="td-item-sub">${esc([k.course_code, k.course_title].filter(Boolean).join(" — "))}</span>
    </span>
    <span class="td-item-time">${esc(fmtDateTime(k.at))}<br />${esc(rel(k.at))}</span>
  </div>`;
}

function renderError(message) {
  $("tdIntro").textContent = "تعذّر تحميل بيانات لوحة التحكم.";
  $("tdStats").innerHTML = "";
  $("tdCourses").innerHTML = emptyState("لا يمكن عرض المقررات", message, "courses");
  $("tdSubmissions").innerHTML = "";
  $("tdSchedule").innerHTML = "";
  $("tdPendingCount").textContent = "—";
}

async function grade(id, name, title, max) {
  openForm({
    title: "تصحيح تسليم",
    intro: `${name} — ${title}`,
    fields: [
      { name: "points", label: `الدرجة (من ${max})`, type: "number", min: 0, max: Number(max) || 0, step: "0.5", value: "", required: true, placeholder: "0" },
      { name: "feedback", label: "ملاحظات للطالب", type: "textarea", value: "", placeholder: "اختياري" },
    ],
    submitLabel: "حفظ الدرجة",
    onSubmit: async (v) => {
      const res = await call("teacher_grade_submission", {
        p_submission_id: Number(id), p_points: Number(v.points), p_feedback: v.feedback || null,
      });
      return res.ok ? { ok: true, message: "تم حفظ الدرجة" } : { ok: false, error: res.error };
    },
  });
}

boot({
  portal: "teacher",
  title: "لوحة التحكم",
  render: async ({ content }) => {
    $("tdAllCourses").href = p("pages/teacher/courses.html");
    $("tdStats").innerHTML = skeleton("stats", 4);
    $("tdCourses").innerHTML = skeleton("cards", 2);
    $("tdSubmissions").innerHTML = skeleton("rows", 2);
    $("tdSchedule").innerHTML = skeleton("rows", 2);

    content.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-grade]");
      if (btn) grade(btn.dataset.grade, btn.dataset.name, btn.dataset.title, btn.dataset.max);
    });

    const res = await call("teacher_dashboard");
    if (!res.ok) {
      renderError(res.error || "تحقّق من الاتصال ثم أعد المحاولة.");
      return;
    }

    const d = res.data || {};
    const pending = Number(d.pending_grading || 0);
    const courses = d.courses || [];
    const submissions = d.submissions || [];
    const schedule = d.schedule || [];

    $("tdIntro").textContent = pending > 0
      ? `لديك ${fmtNum(pending)} تسليماً بانتظار التصحيح، و${fmtNum(d.today_lectures)} محاضرة اليوم، و${fmtNum(d.upcoming_exams)} اختباراً خلال 24 ساعة.`
      : `لا تسليمات بانتظار التصحيح حالياً. لديك ${fmtNum(d.active_courses)} مقررات نشطة و${fmtNum(d.today_lectures)} محاضرة اليوم.`;

    $("tdStats").innerHTML =
      stat("مقررات نشطة", d.active_courses, "مقرر", "courses") +
      stat("طلاب مسجلون", d.students, "طالب", "users") +
      stat("محاضرات", d.lectures, "محاضرة", "lectures") +
      stat("بانتظار التصحيح", pending, "تسليم", "assignments", "td-stat-urgent");

    $("tdPendingCount").textContent = fmtNum(pending);
    $("tdCourses").innerHTML = courses.length
      ? `<div class="td-course-list">${courses.map(courseCard).join("")}</div>`
      : emptyState("لا توجد مقررات بعد", "ستظهر مقرراتك هنا فور إنشائها من صفحة مقرراتي.", "courses");
    $("tdSubmissions").innerHTML = submissions.length
      ? `<div class="td-item-list">${submissions.map(submissionRow).join("")}</div>`
      : emptyState("كل شيء مُصحَّح", "لا توجد تسليمات بانتظار التصحيح حالياً.", "checks");
    $("tdSchedule").innerHTML = schedule.length
      ? `<div class="td-item-list">${schedule.map(scheduleRow).join("")}</div>`
      : emptyState("لا مواعيد قادمة", "لا توجد محاضرات أو اختبارات مجدولة خلال الأسبوع القادم.", "calendar");
  },
});

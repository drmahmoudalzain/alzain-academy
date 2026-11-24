import { boot } from "../../lib/portal.js";
import { call } from "../../lib/api.js";
import { esc, fmtDate, fmtNum } from "../../lib/fmt.js";
import { icon } from "../../lib/icons.js";
import { p } from "../../lib/base.js";
import { $, emptyState, initial, openForm, safeColor } from "./common.js";

const TRACKS = [
  { value: "bachelor", label: "بكالوريوس (عام)" },
  { value: "bachelor_m", label: "بكالوريوس — ذكور" },
  { value: "bachelor_f", label: "بكالوريوس — إناث" },
  { value: "equiv", label: "معادل" },
  { value: "external", label: "خارجي" },
  { value: "grad", label: "دراسات عليا" },
];
const LEVELS = [
  { value: "1", label: "الأول" }, { value: "2", label: "الثاني" },
  { value: "3", label: "الثالث" }, { value: "4", label: "الرابع" },
];

const state = { courses: [], filter: "all", level: "all", sort: "code", query: "" };

function stat(label, value, unit, ico, cls = "") {
  return `<div class="tc-stat ${cls}">
    <span class="tc-stat-icon">${icon(ico)}</span>
    <span><span class="tc-stat-label">${esc(label)}</span><span class="tc-stat-value">${esc(fmtNum(value))}<small>${esc(unit)}</small></span></span>
  </div>`;
}

function card(c) {
  const color = safeColor(c.color);
  const href = `${p("pages/teacher/course.html")}?id=${encodeURIComponent(c.id)}`;
  return `<article class="tc-card" style="--tc-color:${color}">
    <div class="tc-card-body">
      <div class="tc-card-top">
        <span class="tc-code">${esc(c.code || "—")}</span>
        <span class="tc-status ${c.archived ? "tc-off" : ""}">${c.archived ? "مؤرشف" : "نشط"}</span>
      </div>
      <h2>${esc(c.title || "مقرر")}</h2>
      ${c.description ? `<p>${esc(c.description)}</p>` : ""}
      <div class="tc-meta">
        <span>${icon("users")}${fmtNum(c.students)} طالب</span>
        <span>${icon("lectures")}${fmtNum(c.lectures)} محاضرة</span>
        <span>${icon("exams")}${fmtNum(c.exams)} اختبار</span>
        <span>${icon("file")}${fmtNum(c.assignments)} واجب</span>
        <span>${icon("calendar")}${esc(fmtDate(c.created_at))}</span>
      </div>
    </div>
    <div class="tc-card-actions">
      <a class="tt-btn tt-btn-ghost" href="${esc(href)}">${icon("details")}فتح المقرر</a>
      <button class="tt-btn tt-btn-secondary" type="button" data-edit="${esc(c.id)}">${icon("edit")}تعديل</button>
    </div>
  </article>`;
}

function fields(c = null) {
  return [
    { name: "title", label: "عنوان المقرر", value: c?.title || "", required: true, placeholder: "مثال: القانون المدني" },
    { name: "code", label: "رمز المقرر", value: c?.code || "", required: true, dir: "ltr", placeholder: "LAW101" },
    { name: "description", label: "وصف المقرر", type: "textarea", value: c?.description || "", placeholder: "وصف مختصر", fieldClass: "tt-field-wide" },
    { name: "track", label: "المسار", type: "select", value: c?.track || "bachelor_m", options: TRACKS },
    { name: "level", label: "المستوى", type: "select", value: c?.level ? String(c.level) : "1", options: LEVELS },
    { name: "color", label: "لون المقرر", type: "color", value: c?.color || "#123A63" },
    { name: "attendance_weight", label: "وزن الحضور %", type: "number", min: 0, max: 100, value: c?.attendance_weight ?? 10, required: true },
    { name: "exams_weight", label: "وزن الاختبارات %", type: "number", min: 0, max: 100, value: c?.exams_weight ?? 60, required: true },
    { name: "assignments_weight", label: "وزن الواجبات %", type: "number", min: 0, max: 100, value: c?.assignments_weight ?? 30, required: true, hint: "مجموع الأوزان = 100" },
  ];
}

function newCourse() {
  openForm({
    title: "مقرر جديد",
    intro: "أضف مقرراً جديداً إلى بوابتك. يمكنك تعديل بياناته لاحقاً.",
    fields: fields(),
    submitLabel: "إنشاء المقرر",
    onSubmit: async (v) => {
      const res = await call("teacher_create_course", {
        p_title: v.title, p_code: v.code, p_description: v.description || null,
        p_track: v.track, p_level: Number(v.level), p_color: v.color,
        p_attendance_weight: Number(v.attendance_weight),
        p_exams_weight: Number(v.exams_weight),
        p_assignments_weight: Number(v.assignments_weight),
      });
      if (!res.ok) return { ok: false, error: res.error };
      await load();
      return { ok: true, message: "تم إنشاء المقرر" };
    },
  });
}

function editCourse(id) {
  const c = state.courses.find((x) => String(x.id) === String(id));
  if (!c) return;
  openForm({
    title: "تعديل المقرر",
    intro: `${c.code || ""} — ${c.title || ""}`,
    fields: fields(c),
    submitLabel: "حفظ التعديلات",
    onSubmit: async (v) => {
      const res = await call("teacher_update_course", {
        p_course_id: c.id, p_title: v.title, p_description: v.description || null,
        p_color: v.color, p_archived: c.archived, p_track: v.track, p_level: Number(v.level),
        p_attendance_weight: Number(v.attendance_weight),
        p_exams_weight: Number(v.exams_weight),
        p_assignments_weight: Number(v.assignments_weight),
      });
      if (!res.ok) return { ok: false, error: res.error };
      await load();
      return { ok: true, message: "تم حفظ التعديلات" };
    },
  });
}

function renderStats(d) {
  $("tcStats").innerHTML =
    stat("إجمالي المقررات", d.total, "مقرر", "courses") +
    stat("مقررات نشطة", d.active, "مقرر", "check") +
    stat("إجمالي الطلاب", d.students, "طالب", "users", "tc-students") +
    stat("مقررات مؤرشفة", d.archived, "مقرر", "archive", "tc-archived");
}

function renderTabs(d) {
  const counts = { all: d.total, active: d.active, archived: d.archived };
  document.querySelectorAll("[data-count]").forEach((s) => { s.textContent = fmtNum(counts[s.dataset.count]); });
  document.querySelectorAll(".tc-tab").forEach((b) => {
    const active = b.dataset.filter === state.filter;
    b.classList.toggle("tc-active", active);
    b.setAttribute("aria-selected", String(active));
  });
}

function renderCards() {
  const q = state.query.trim().toLowerCase();
  const list = state.courses
    .filter((c) => state.filter === "all" || (state.filter === "active" ? !c.archived : !!c.archived))
    .filter((c) => state.level === "all" || String(c.level ?? "") === state.level)
    .filter((c) => !q || [c.title, c.code, c.description].some((v) => String(v || "").toLowerCase().includes(q)))
    .sort((a, b) => {
      if (state.sort === "students") return Number(b.students) - Number(a.students);
      if (state.sort === "recent") return String(b.created_at || "").localeCompare(String(a.created_at || ""));
      return String(a.code || "").localeCompare(String(b.code || ""));
    });

  if (!list.length) {
    $("tcGrid").innerHTML = emptyState(
      state.courses.length ? "لا مقررات مطابقة" : "لا توجد مقررات بعد",
      state.courses.length ? "جرّب تغيير التصفية أو كلمة البحث." : "أنشئ مقررك الأول باستخدام زر «مقرر جديد».",
      "courses"
    );
    return;
  }
  $("tcGrid").innerHTML = list.map(card).join("");
}

async function load() {
  const res = await call("teacher_courses");
  if (!res.ok) {
    $("tcStats").innerHTML = "";
    $("tcGrid").innerHTML = emptyState("تعذّر تحميل المقررات", res.error || "تحقّق من الاتصال ثم أعد المحاولة.", "courses");
    return;
  }
  const d = res.data || {};
  state.courses = d.courses || [];
  renderStats(d);
  renderTabs(d);
  renderCards();
  ["tcLevel", "tcSort", "tcSearch"].forEach((id) => { $(id).disabled = false; });
}

boot({
  portal: "teacher",
  title: "مقرراتي",
  render: async ({ content }) => {
    $("tcSearch").closest(".tc-search").querySelector(".tc-search-icon").innerHTML = icon("search");

    content.addEventListener("click", (e) => {
      const tab = e.target.closest(".tc-tab");
      if (tab) {
        state.filter = tab.dataset.filter;
        renderTabs({
          total: state.courses.length,
          active: state.courses.filter((c) => !c.archived).length,
          archived: state.courses.filter((c) => !!c.archived).length,
        });
        renderCards();
        return;
      }
      const edit = e.target.closest("[data-edit]");
      if (edit) editCourse(edit.dataset.edit);
    });
    $("tcNewCourse").addEventListener("click", newCourse);
    $("tcLevel").addEventListener("change", (e) => { state.level = e.target.value; renderCards(); });
    $("tcSort").addEventListener("change", (e) => { state.sort = e.target.value; renderCards(); });
    $("tcSearch").addEventListener("input", (e) => { state.query = e.target.value; renderCards(); });

    await load();
  },
});

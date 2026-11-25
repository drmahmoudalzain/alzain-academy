import { boot } from "../../lib/portal.js";
import { supabase } from "../../lib/supabase.js";
import { esc, fmtDateTime, fmtNum, rel } from "../../lib/fmt.js";
import { icon } from "../../lib/icons.js";
import { p } from "../../lib/base.js";

const $ = (id) => document.getElementById(id);

// كل الأرقام تُقرأ من Supabase تحت سياسات RLS؛ لا قيم تجريبية في هذه الواجهة.
const STATS = [
  { key: "students", label: "إجمالي الطلاب", ico: "users", href: "pages/owner/students.html" },
  { key: "courses", label: "المقررات النشطة", ico: "courses", href: "pages/owner/courses.html" },
  { key: "lectures", label: "المحاضرات", ico: "lectures", href: "pages/owner/lectures.html" },
  { key: "assessments", label: "الاختبارات والواجبات", ico: "exams", href: "pages/owner/report.html" },
];

const ACTIONS = [
  { label: "إضافة مستخدم", ico: "plus", href: "pages/owner/users.html?new=1" },
  { label: "إنشاء مقرر", ico: "courses", href: "pages/owner/courses.html?new=1" },
  { label: "التقرير الشامل", ico: "grades", href: "pages/owner/report.html" },
  { label: "دليل المستخدم", ico: "file", href: "guide.html" },
];

function skeleton(kind, count) {
  return Array.from(
    { length: count },
    () => `<div class="od-skeleton od-skeleton-${kind}" aria-hidden="true"></div>`,
  ).join("");
}

async function countRows(table, filters = []) {
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  for (const filter of filters) {
    if (filter.op === "in") query = query.in(filter.column, filter.value);
    else query = query.eq(filter.column, filter.value);
  }
  const { count, error } = await query;
  if (error) throw error;
  return Number(count || 0);
}

async function recentNotifications() {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, body, created_at")
    .order("created_at", { ascending: false })
    .limit(4);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

function statHtml(item, value) {
  const display = value === null ? "—" : fmtNum(value);
  const aria = `${item.label}: ${value === null ? "بيانات غير متاحة" : display}`;
  return `<a class="od-stat" href="${esc(p(item.href))}" aria-label="${esc(aria)}">
    <span class="od-stat-icon">${icon(item.ico)}</span>
    <span class="od-stat-value">${esc(display)}</span>
    <span class="od-stat-label">${esc(item.label)}</span>
  </a>`;
}

function miniHtml(label, value, ico) {
  return `<div class="od-mini">
    <span class="od-mini-icon">${icon(ico)}</span>
    <span class="od-mini-body">
      <span class="od-mini-value">${esc(value === null ? "—" : fmtNum(value))}</span>
      <span class="od-mini-label">${esc(label)}</span>
    </span>
  </div>`;
}

function actionHtml(item) {
  return `<a class="od-action" href="${esc(p(item.href))}">
    <span class="od-action-icon">${icon(item.ico)}</span>
    <span class="od-action-label">${esc(item.label)}</span>
  </a>`;
}

function activityHtml(note) {
  const href = p("pages/notifications.html");
  const when = note.created_at ? `${rel(note.created_at)} · ${fmtDateTime(note.created_at)}` : "بدون تاريخ";
  return `<a class="od-activity" href="${esc(href)}">
    <span class="od-activity-icon">${icon("bell")}</span>
    <span class="od-activity-body">
      <span class="od-activity-title">${esc(note.title || "إشعار")}</span>
      ${note.body ? `<span class="od-activity-text">${esc(note.body)}</span>` : ""}
      <span class="od-activity-time">${icon("clock")}<span>${esc(when)}</span></span>
    </span>
  </a>`;
}

function emptyState(title, text, ico) {
  return `<div class="od-empty" role="status">
    <span class="od-empty-icon">${icon(ico)}</span>
    <h3>${esc(title)}</h3>
    <p>${esc(text)}</p>
  </div>`;
}

boot({
  portal: "owner",
  title: "لوحة التحكم",
  render: async ({ profile }) => {
    $("odAllNotifications").href = p("pages/notifications.html");
    $("odGreeting").textContent = `أهلاً بك، ${String(profile?.name || "").trim().split(/\s+/)[0] || "أستاذي"}`;

    $("odStats").innerHTML = skeleton("stat", 4);
    $("odSecondary").innerHTML = skeleton("mini", 2);
    $("odActivity").innerHTML = skeleton("row", 3);
    $("odActions").innerHTML = ACTIONS.map(actionHtml).join("");

    const tasks = {
      students: countRows("users", [{ column: "role", value: "student" }]),
      activeStudents: countRows("users", [
        { column: "role", value: "student" },
        { column: "is_active", value: true },
      ]),
      courses: countRows("courses", [{ column: "archived", value: false }]),
      lectures: countRows("lectures"),
      exams: countRows("exams"),
      assignments: countRows("assignments"),
      teachers: countRows("users", [{ column: "role", value: "teacher" }]),
      assistants: countRows("users", [{ column: "role", value: "assistant" }]),
      notifications: recentNotifications(),
    };
    const keys = Object.keys(tasks);
    const settled = await Promise.allSettled(keys.map((key) => tasks[key]));
    const loaded = Object.fromEntries(keys.map((key, i) => [key, settled[i]]));
    const value = (key) => (loaded[key].status === "fulfilled" ? loaded[key].value : null);

    const counts = {
      students: value("students"),
      courses: value("courses"),
      lectures: value("lectures"),
      assessments:
        value("exams") === null || value("assignments") === null
          ? null
          : Number(value("exams")) + Number(value("assignments")),
    };
    const staff =
      value("teachers") === null || value("assistants") === null
        ? null
        : Number(value("teachers")) + Number(value("assistants"));

    $("odStats").innerHTML = STATS.map((item) => statHtml(item, counts[item.key])).join("");
    $("odSecondary").innerHTML =
      miniHtml("الطلاب النشطون", value("activeStudents"), "checks") +
      miniHtml("الأساتذة والمساعدون", staff, "users");

    const summary = [
      counts.students === null ? null : `${fmtNum(counts.students)} طالباً`,
      counts.courses === null ? null : `${fmtNum(counts.courses)} مقرراً نشطاً`,
      counts.lectures === null ? null : `${fmtNum(counts.lectures)} محاضرة`,
      counts.assessments === null ? null : `${fmtNum(counts.assessments)} اختباراً وواجباً`,
    ].filter(Boolean);
    $("odIntro").textContent = summary.length
      ? `نظرة عامة على البوابات الأربع: ${summary.join(" · ")}.`
      : "تعذّر تحميل الإحصاءات من قاعدة البيانات. تحقّق من الاتصال ثم أعد المحاولة.";

    if (loaded.notifications.status !== "fulfilled") {
      $("odActivity").innerHTML = emptyState(
        "تعذّر تحميل النشاطات",
        "لم نتمكن من قراءة الإشعارات الآن.",
        "bell",
      );
      return;
    }

    const notes = loaded.notifications.value || [];
    $("odActivity").innerHTML = notes.length
      ? notes.map(activityHtml).join("")
      : emptyState("لا توجد نشاطات حديثة", "ستظهر هنا آخر الإشعارات المسجلة في المنصة.", "bell");
  },
});

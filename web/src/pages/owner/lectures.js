import { boot } from "../../lib/portal.js";
import { supabase } from "../../lib/supabase.js";
import { call } from "../../lib/api.js";
import { esc, fmtDateTime, fmtNum } from "../../lib/fmt.js";
import { icon } from "../../lib/icons.js";

const $ = (id) => document.getElementById(id);

let allLectures = [];
let courses = [];

async function loadCourses() {
  const { data } = await supabase.from("courses").select("id, title, code").order("title");
  courses = Array.isArray(data) ? data : [];
  const courseOpts = courses.map((c) => `<option value="${c.id}">${esc(c.code || "")} — ${esc(c.title || "")}</option>`).join("");
  $("olCourse").innerHTML = `<option value="">كل المقررات</option>` + courseOpts;
  $("olFormCourse").innerHTML = courseOpts || `<option value="">لا يوجد</option>`;
}

function render() {
  const courseId = $("olCourse").value;
  const type = $("olType").value;
  const list = allLectures.filter((l) => {
    if (courseId && String(l.course_id) !== courseId) return false;
    if (type !== "all" && l.lecture_type !== type) return false;
    return true;
  });
  if (!list.length) {
    $("olTable").innerHTML = `<div class="od-empty" role="status"><span class="od-empty-icon">${icon("lectures")}</span><h3>لا توجد محاضرات</h3><p>أضف محاضرة جديدة.</p></div>`;
    return;
  }
  const courseMap = new Map(courses.map((c) => [c.id, c]));
  const rows = list.map((l) => `
    <tr>
      <td>${esc(l.title || "—")}</td>
      <td>${esc(courseMap.get(l.course_id)?.title || "—")}</td>
      <td>${esc(l.lecture_type || "—")}</td>
      <td>${l.scheduled_at ? fmtDateTime(l.scheduled_at) : "—"}</td>
      <td>${l.duration_min || "—"} د</td>
      <td>${l.status || "—"}</td>
    </tr>
  `).join("");
  $("olTable").innerHTML = `<div class="od-table-wrap"><table class="od-table">
    <thead><tr><th>العنوان</th><th>المقرر</th><th>النوع</th><th>الموعد</th><th>المدة</th><th>الحالة</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

async function reload() {
  $("olTable").innerHTML = `<div class="od-skeleton od-skeleton-row" aria-hidden="true"></div>`.repeat(5);
  // lectures base table select revoked; use lectures_public view
  const { data, error } = await supabase.from("lectures_public").select("id, course_id, title, lecture_type, scheduled_at, duration_min, status").order("scheduled_at", { ascending: false });
  // fallback to lectures table if view unavailable
  if (error) {
    const r2 = await supabase.from("lectures").select("id, course_id, title, lecture_type, scheduled_at, duration_min, status").order("scheduled_at", { ascending: false });
    if (r2.error) {
      $("olTable").innerHTML = `<div class="od-empty" role="status"><span class="od-empty-icon">${icon("lectures")}</span><h3>تعذّر تحميل المحاضرات</h3><p>${esc(r2.error.message || "")}</p></div>`;
      return;
    }
    allLectures = Array.isArray(r2.data) ? r2.data : [];
  } else {
    allLectures = Array.isArray(data) ? data : [];
  }
  render();
}

boot({
  portal: "owner",
  title: "المحاضرات",
  render: async () => {
    await loadCourses();
    await reload();
    $("olCourse").addEventListener("change", render);
    $("olType").addEventListener("change", render);
    $("olNewBtn").addEventListener("click", () => { $("olFormPanel").hidden = false; });
    $("olCancel").addEventListener("click", () => { $("olFormPanel").hidden = true; });

    $("olForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      const msg = $("olMsg");
      msg.textContent = "جارٍ الحفظ...";
      const res = await call("management_add_lecture", {
        p_course_id: Number(f.elements.course_id.value),
        p_title: f.elements.title.value,
        p_description: f.elements.description.value,
        p_lecture_type: f.elements.lecture_type.value,
        p_duration_min: Number(f.elements.duration_min.value) || 120,
        p_youtube_url: f.elements.youtube_url.value || null,
        p_live_url: f.elements.live_url.value || null,
        p_scheduled_at: f.elements.scheduled_at.value ? new Date(f.elements.scheduled_at.value).toISOString() : null,
      });
      if (res?.ok) {
        msg.textContent = "تمت الإضافة.";
        $("olFormPanel").hidden = true;
        f.reset();
        await reload();
      } else {
        msg.textContent = res?.error || "فشل.";
      }
    });
  },
});
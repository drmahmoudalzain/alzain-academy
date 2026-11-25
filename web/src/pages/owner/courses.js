import { boot } from "../../lib/portal.js";
import { supabase } from "../../lib/supabase.js";
import { call } from "../../lib/api.js";
import { esc, fmtNum } from "../../lib/fmt.js";
import { icon } from "../../lib/icons.js";

const $ = (id) => document.getElementById(id);

let allCourses = [];
let teachers = [];

async function loadTeachers() {
  const { data } = await supabase.from("users").select("id, name").eq("role", "teacher").eq("is_active", true).order("name");
  teachers = Array.isArray(data) ? data : [];
  const sel = $("ocTeacher");
  if (sel) sel.innerHTML = teachers.map((t) => `<option value="${t.id}">${esc(t.name || "")}</option>`).join("") || `<option value="">لا يوجد</option>`;
}

function renderCourses() {
  const showArchived = $("ocShowArchived").checked;
  const list = allCourses.filter((c) => showArchived || !c.archived);
  if (!list.length) {
    $("ocTable").innerHTML = `<div class="od-empty" role="status"><span class="od-empty-icon">${icon("courses")}</span><h3>لا توجد مقررات</h3><p>أنشئ مقرراً جديداً.</p></div>`;
    return;
  }
  const teacherMap = new Map(teachers.map((t) => [t.id, t.name]));
  const rows = list.map((c) => `
    <tr>
      <td>${esc(c.code || "—")}</td>
      <td>${esc(c.title || "—")}</td>
      <td>${esc(teacherMap.get(c.teacher_id) || "—")}</td>
      <td>${esc(c.track || "—")}</td>
      <td>${c.level || "—"}</td>
      <td>${c.archived ? "أرشيف" : "نشط"}</td>
      <td>
        <button class="od-btn od-btn-small" data-action="edit" data-id="${c.id}">تعديل</button>
        <button class="od-btn od-btn-small" data-action="archive" data-id="${c.id}" data-archived="${c.archived}">${c.archived ? "استعادة" : "أرشفة"}</button>
      </td>
    </tr>
  `).join("");
  $("ocTable").innerHTML = `<div class="od-table-wrap"><table class="od-table">
    <thead><tr><th>الرمز</th><th>العنوان</th><th>الأستاذ</th><th>المسار</th><th>المستوى</th><th>الحالة</th><th>إجراءات</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;

  $("ocTable").querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.dataset.id);
      const action = btn.dataset.action;
      if (action === "archive") {
        const archived = btn.dataset.archived === "true";
        const course = allCourses.find((c) => c.id === id);
        if (!course) return;
        const res = await call("management_update_course", {
          p_course_id: id,
          p_title: course.title,
          p_archived: !archived,
        });
        if (!res?.ok) { alert(res?.error || "فشل"); return; }
        await reload();
      } else if (action === "edit") {
        // populate form
        const course = allCourses.find((c) => c.id === id);
        if (!course) return;
        const f = $("ocForm");
        f.elements.title.value = course.title || "";
        f.elements.code.value = course.code || "";
        f.elements.description.value = course.description || "";
        f.elements.track.value = course.track || "bachelor_m";
        f.elements.level.value = course.level || "";
        f.elements.color.value = course.color || "#123A63";
        f.elements.teacher_id.value = course.teacher_id || "";
        f.elements.aw.value = course.attendance_weight ?? 10;
        f.elements.ew.value = course.exams_weight ?? 60;
        f.elements.asw.value = course.assignments_weight ?? 30;
        $("ocForm").dataset.editId = id;
        $("ocFormTitle").textContent = "تعديل مقرر";
        $("ocFormPanel").hidden = false;
      }
    });
  });
}

async function reload() {
  $("ocTable").innerHTML = `<div class="od-skeleton od-skeleton-row" aria-hidden="true"></div>`.repeat(5);
  const { data, error } = await supabase.from("courses").select("id, teacher_id, title, code, description, color, track, level, archived, attendance_weight, exams_weight, assignments_weight").order("title");
  if (error) {
    $("ocTable").innerHTML = `<div class="od-empty" role="status"><span class="od-empty-icon">${icon("courses")}</span><h3>تعذّر تحميل المقررات</h3><p>${esc(error.message || "")}</p></div>`;
    return;
  }
  allCourses = Array.isArray(data) ? data : [];
  renderCourses();
}

boot({
  portal: "owner",
  title: "المقررات",
  render: async () => {
    $("ocActions").innerHTML = `<button class="od-action" id="ocNewBtn"><span class="od-action-icon">${icon("plus")}</span><span class="od-action-label">إنشاء مقرر</span></button>`;
    $("ocNewBtn").addEventListener("click", () => {
      $("ocForm").reset();
      delete $("ocForm").dataset.editId;
      $("ocFormTitle").textContent = "إنشاء مقرر";
      $("ocFormPanel").hidden = false;
    });
    $("ocCancel").addEventListener("click", () => { $("ocFormPanel").hidden = true; });
    $("ocShowArchived").addEventListener("change", renderCourses);

    await loadTeachers();
    await reload();

    $("ocForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      const msg = $("ocMsg");
      msg.textContent = "جارٍ الحفظ...";
      const params = {
        p_title: f.elements.title.value,
        p_code: f.elements.code.value,
        p_description: f.elements.description.value,
        p_track: f.elements.track.value,
        p_level: f.elements.level.value ? Number(f.elements.level.value) : null,
        p_color: f.elements.color.value,
        p_attendance_weight: Number(f.elements.aw.value),
        p_exams_weight: Number(f.elements.ew.value),
        p_assignments_weight: Number(f.elements.asw.value),
        p_teacher_id: Number(f.elements.teacher_id.value) || null,
      };
      const editId = f.dataset.editId;
      const res = editId
        ? await call("management_update_course", { p_course_id: Number(editId), ...params })
        : await call("management_create_course", params);
      if (res?.ok) {
        msg.textContent = "تم الحفظ بنجاح.";
        $("ocFormPanel").hidden = true;
        await reload();
      } else {
        msg.textContent = res?.error || "فشل الحفظ.";
      }
    });
  },
});
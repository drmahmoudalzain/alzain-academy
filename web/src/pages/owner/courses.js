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

function courseParams(course, overrides = {}) {
  return {
    p_title: course.title || "",
    p_code: course.code || "",
    p_description: course.description || null,
    p_track: course.track || "bachelor_m",
    p_level: course.level ?? null,
    p_color: course.color || "#123A63",
    p_attendance_weight: course.attendance_weight ?? 10,
    p_exams_weight: course.exams_weight ?? 60,
    p_assignments_weight: course.assignments_weight ?? 30,
    p_teacher_id: course.teacher_id || null,
    ...overrides,
  };
}

function fillForm(course) {
  const f = $("ocForm");
  f.elements.title.value = course.title || "";
  f.elements.code.value = course.code || "";
  f.elements.description.value = course.description || "";
  f.elements.track.value = course.track || "bachelor_m";
  f.elements.level.value = course.level ?? "";
  f.elements.color.value = course.color || "#123A63";
  f.elements.teacher_id.value = course.teacher_id || "";
  f.elements.aw.value = course.attendance_weight ?? 10;
  f.elements.ew.value = course.exams_weight ?? 60;
  f.elements.asw.value = course.assignments_weight ?? 30;
  f.dataset.editId = course.id;
  $("ocFormTitle").textContent = "تعديل مقرر";
  $("ocFormPanel").hidden = false;
}

function setButton(btn, state) {
  btn.classList.toggle("is-loading", state);
  btn.disabled = state;
}

async function archiveCourse(btn, course, archived) {
  if (!confirm(archived ? "استعادة المقرر من الأرشيف؟" : "أرشفة المقرر؟")) return;
  setButton(btn, true);
  const res = await call("management_update_course", courseParams(course, { p_archived: !archived }));
  setButton(btn, false);
  if (!res?.ok) { alert(res?.error || "فشل"); return; }
  await reload();
}

async function deleteCourse(btn, course) {
  const preflight = await call("management_preflight_delete_course", { p_course_id: course.id });
  if (!preflight.ok) {
    alert(preflight.error || "تعذّر فحص تبعيات المقرر");
    return;
  }
  const info = preflight.data || {};
  const counts = info.counts || {};
  const blockers = Array.isArray(info.blockers) ? info.blockers : [];
  const summary = [
    ["مقررات فرعية", counts.children],
    ["محاضرات", counts.lectures],
    ["اختبارات", counts.exams],
    ["واجبات", counts.assignments],
    ["تسجيلات", counts.enrollments],
    ["تسليمات", counts.submissions],
    ["نقاط", counts.points],
    ["حضور", counts.attendance],
  ].map(([label, value]) => `${label}: ${fmtNum(value ?? 0)}`).join(" · ");

  const question = `حذف المقرر ${course.title} نهائياً؟ لا يمكن التراجع.\n\n${summary}`
    + (blockers.length ? `\n\nيمنع الحذف: ${blockers.join("، ")}` : "");
  if (!confirm(question)) return;

  setButton(btn, true);
  const res = await call("management_delete_course", { p_course_id: course.id });
  setButton(btn, false);
  if (!res?.ok) { alert(res?.error || "فشل الحذف"); return; }
  await reload();
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
        <div class="od-btn-group">
          <button class="od-btn od-btn--small ${c.archived ? "od-btn--ghost" : "od-btn--danger"}" data-action="archive" data-id="${c.id}" data-archived="${c.archived}">${icon(c.archived ? "refresh" : "archive")} ${c.archived ? "استعادة" : "أرشفة"}</button>
          <button class="od-btn od-btn--small od-btn--ghost" data-action="edit" data-id="${c.id}">${icon("edit")} تعديل</button>
          <button class="od-btn od-btn--small od-btn--danger" data-action="delete" data-id="${c.id}">${icon("trash")} حذف</button>
        </div>
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
      const course = allCourses.find((c) => c.id === id);
      if (!course) return;
      if (action === "archive") {
        await archiveCourse(btn, course, btn.dataset.archived === "true");
      } else if (action === "delete") {
        await deleteCourse(btn, course);
      } else if (action === "edit") {
        fillForm(course);
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
    if ($("ocSubmitBtn")) $("ocSubmitBtn").innerHTML = `<span class="od-btn-spinner"></span>${icon("check")} حفظ`;
    $("ocActions").innerHTML = `<button class="od-btn od-btn--primary" id="ocNewBtn" type="button">${icon("plus")} إنشاء مقرر</button>`;
    $("ocNewBtn").addEventListener("click", () => {
      $("ocForm").reset();
      delete $("ocForm").dataset.editId;
      $("ocFormTitle").textContent = "إنشاء مقرر";
      $("ocFormPanel").hidden = false;
      $("ocTitleInput").focus();
    });
    $("ocCancel").addEventListener("click", () => { $("ocFormPanel").hidden = true; });
    $("ocShowArchived").addEventListener("change", renderCourses);

    await loadTeachers();
    await reload();
    if (new URLSearchParams(location.search).get("new") === "1") $("ocNewBtn").click();

    $("ocForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      const msg = $("ocMsg");
      const btn = $("ocSubmitBtn");
      msg.hidden = false;
      msg.textContent = "جارٍ الحفظ...";
      msg.className = "od-inline-msg";
      setButton(btn, true);
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
      setButton(btn, false);
      if (res?.ok) {
        msg.textContent = "تم الحفظ بنجاح.";
        msg.className = "od-inline-msg od-inline-msg--success";
        $("ocFormPanel").hidden = true;
        await reload();
      } else {
        msg.textContent = res?.error || "فشل الحفظ.";
        msg.className = "od-inline-msg od-inline-msg--error";
      }
    });
  },
});

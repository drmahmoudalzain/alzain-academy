import { boot } from "../../lib/portal.js";
import { supabase } from "../../lib/supabase.js";
import { call } from "../../lib/api.js";
import { esc, fmtNum } from "../../lib/fmt.js";
import { icon } from "../../lib/icons.js";

const $ = (id) => document.getElementById(id);

let allCourses = [];
let teachers = [];

function showTableError(target, message, iconName) {
  target.innerHTML = `<div class="od-empty" role="status"><span class="od-empty-icon">${icon(iconName)}</span><h3>تعذّر تحميل البيانات</h3><p>${esc(message || "خطأ غير معروف")}</p></div>`;
}

async function loadTeachers() {
  try {
    const { data } = await supabase.from("users").select("id, name").eq("role", "teacher").eq("is_active", true).order("name");
    teachers = Array.isArray(data) ? data : [];
  } catch (error) {
    teachers = [];
    console.warn("تعذّر تحميل الأساتذة:", error);
  }
  const sel = $("ocTeacher");
  if (sel) sel.innerHTML = teachers.map((t) => `<option value="${t.id}">${esc(t.name || "")}</option>`).join("") || `<option value="">لا يوجد أساتذة متاحون</option>`;
}

function fillParents() {
  const sel = $("ocParentInput");
  if (!sel) return;
  const parents = allCourses.filter((c) => !c.parent_course_id && /^LAW[1-4]\d{2}$/.test(c.code || ""));
  const current = sel.value;
  sel.innerHTML = parents.map((c) => `<option value="${Number(c.id)}">${esc(c.code || "")} — ${esc(c.title || "")}</option>`).join("")
    || `<option value="">لا يوجد أصل متاح</option>`;
  if (current && parents.some((c) => String(c.id) === current)) sel.value = current;
}

function applyMode() {
  const f = $("ocForm");
  const editId = f.dataset.editId;
  const mode = editId ? "edit" : f.elements.mode.value;
  $("ocMode").closest(".od-field").hidden = Boolean(editId);
  $("ocBranchFields").hidden = mode !== "branch";
  $("ocGenderFields").hidden = mode !== "branch";
  $("ocTrackInput").closest(".od-field").hidden = mode === "branch" || mode === "family";
  $("ocCodeInput").closest(".od-field").hidden = mode === "family";
  const bachelor = ["bachelor", "bachelor_m", "bachelor_f"].includes(f.elements.track.value);
  f.elements.code.readOnly = mode === "edit" ? false : bachelor;
  $("ocFormTitle").textContent = editId ? "تعديل مقرر"
    : mode === "branch" ? "إنشاء فرع لأصل موجود"
    : mode === "family" ? "إنشاء أصل وفرعيه" : "إنشاء مقرر";
}

async function refreshGeneratedCode() {
  const f = $("ocForm");
  if (f.dataset.editId) return;
  const mode = f.elements.mode.value;
  if (mode === "family") {
    f.elements.code.value = "";
    return;
  }
  let rpcParams;
  if (mode === "branch") {
    const parentId = Number(f.elements.parent_course_id.value) || null;
    if (!parentId) { f.elements.code.value = ""; return; }
    rpcParams = { p_level: null, p_parent_course_id: parentId, p_branch_track: f.elements.branch_track.value };
  } else {
    const level = Number(f.elements.level.value) || null;
    if (!level) { f.elements.code.value = ""; return; }
    rpcParams = { p_level: level };
  }
  const res = await call("management_generate_course_code", rpcParams);
  if (res?.ok) f.elements.code.value = typeof res.data === "string" ? res.data : "";
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
  applyMode();
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

async function createAssessment(btn, course, kind) {
  const title = window.prompt(kind === "exam" ? "عنوان الاختبار" : "عنوان الواجب");
  if (!title) return;
  const publish = window.confirm("نشر للطلاب الآن؟ (موافق = نشط/منشور، إلغاء = مسودة)");
  setButton(btn, true);
  const res = await call("management_create_exam", {
    p_course_id: course.id,
    p_title: title.trim(),
    p_exam_kind: kind === "exam" ? "exam" : "assignment",
    p_is_published: publish,
  });
  setButton(btn, false);
  if (!res?.ok) { alert(res?.error || "فشل الإنشاء"); return; }
  alert(kind === "exam" ? "تم إنشاء الاختبار." : "تم إنشاء الواجب.");
}

function renderCourses() {
  const showArchived = $("ocShowArchived").checked;
  const list = allCourses.filter((c) => showArchived || !c.archived);
  if (!list.length) {
    $("ocTable").innerHTML = `<div class="od-empty" role="status"><span class="od-empty-icon">${icon("courses")}</span><h3>لا توجد مقررات</h3><p>أنشئ مقرراً جديداً.</p></div>`;
    return;
  }
  const teacherMap = new Map(teachers.map((t) => [t.id, t.name]));
  const courseMap = new Map(allCourses.map((c) => [c.id, c]));
  const rows = list.map((c) => {
    const parent = c.parent_course_id ? courseMap.get(c.parent_course_id) : null;
    return `
    <tr>
      <td>${esc(c.code || "—")}</td>
      <td>${esc(c.title || "—")}</td>
      <td>${esc(parent?.code || "—")}</td>
      <td>${esc(teacherMap.get(c.teacher_id) || "—")}</td>
      <td>${esc(c.track || "—")}</td>
      <td>${c.level || "—"}</td>
      <td>${c.archived ? "أرشيف" : "نشط"}</td>
      <td>
        <div class="od-btn-group">
          <button class="od-btn od-btn--small ${c.archived ? "od-btn--ghost" : "od-btn--danger"}" data-action="archive" data-id="${c.id}" data-archived="${c.archived}">${icon(c.archived ? "refresh" : "archive")} ${c.archived ? "استعادة" : "أرشفة"}</button>
          <button class="od-btn od-btn--small od-btn--ghost" data-action="edit" data-id="${c.id}">${icon("edit")} تعديل</button>
          <button class="od-btn od-btn--small" data-action="exam" data-id="${c.id}">${icon("exams")} اختبار</button>
          <button class="od-btn od-btn--small" data-action="assignment" data-id="${c.id}">${icon("file")} واجب</button>
          <button class="od-btn od-btn--small od-btn--danger" data-action="delete" data-id="${c.id}">${icon("trash")} حذف</button>
        </div>
      </td>
    </tr>
  `;
  }).join("");
  $("ocTable").innerHTML = `<div class="od-table-wrap"><table class="od-table">
    <thead><tr><th>الرمز</th><th>العنوان</th><th>الأصل</th><th>الأستاذ</th><th>المسار</th><th>المستوى</th><th>الحالة</th><th>إجراءات</th></tr></thead>
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
      } else if (action === "exam" || action === "assignment") {
        await createAssessment(btn, course, action === "exam" ? "exam" : "assignment");
      }
    });
  });
}

async function reload() {
  const target = $("ocTable");
  target.innerHTML = `<div class="od-skeleton od-skeleton-row" aria-hidden="true"></div>`.repeat(5);
  try {
    const { data, error } = await supabase.from("courses").select("id, teacher_id, title, code, description, color, track, level, archived, parent_course_id, attendance_weight, exams_weight, assignments_weight").order("title");
    if (error) {
      showTableError(target, error.message || "", "courses");
      return;
    }
    allCourses = Array.isArray(data) ? data : [];
  } catch (error) {
    showTableError(target, error?.message || String(error), "courses");
    return;
  }
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
      applyMode();
      fillParents();
      $("ocFormPanel").hidden = false;
      $("ocTitleInput").focus();
      void refreshGeneratedCode();
    });
    $("ocCancel").addEventListener("click", () => { $("ocFormPanel").hidden = true; });
    $("ocShowArchived").addEventListener("change", renderCourses);
    $("ocMode").addEventListener("change", () => { applyMode(); refreshGeneratedCode(); });
    $("ocParentInput").addEventListener("change", refreshGeneratedCode);
    $("ocBranchTrackInput").addEventListener("change", refreshGeneratedCode);
    $("ocLevelInput").addEventListener("change", refreshGeneratedCode);
    $("ocTrackInput").addEventListener("change", () => { applyMode(); void refreshGeneratedCode(); });

    await loadTeachers();
    await reload();
    fillParents();
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
      const mode = editId ? "edit" : f.elements.mode.value;
      const generatedTracks = ["bachelor", "bachelor_m", "bachelor_f"];
      const usesGeneratedCode = mode === "branch"
        || (mode === "new" && generatedTracks.includes(f.elements.track.value));
      let res;
      if (mode === "edit") {
        res = await call("management_update_course", { p_course_id: Number(editId), ...params });
      } else if (mode === "family") {
        res = await call("management_create_course_family", {
          p_title: params.p_title,
          p_level: params.p_level,
          p_description: params.p_description,
          p_color: params.p_color,
          p_attendance_weight: params.p_attendance_weight,
          p_exams_weight: params.p_exams_weight,
          p_assignments_weight: params.p_assignments_weight,
          p_teacher_id: params.p_teacher_id,
        });
      } else {
        res = await call("management_create_course", {
          ...params,
          p_code: usesGeneratedCode ? null : params.p_code,
          p_parent_course_id: mode === "branch" ? Number(f.elements.parent_course_id.value) || null : null,
          p_branch_track: mode === "branch" ? f.elements.branch_track.value : null,
          p_track: mode === "branch" ? null : params.p_track,
        });
      }
      setButton(btn, false);
      if (res?.ok) {
        msg.textContent = "تم الحفظ بنجاح.";
        msg.className = "od-inline-msg od-inline-msg--success";
        $("ocFormPanel").hidden = true;
        await reload();
        fillParents();
      } else {
        msg.textContent = res?.error || "فشل الحفظ.";
        msg.className = "od-inline-msg od-inline-msg--error";
      }
    });
  },
});

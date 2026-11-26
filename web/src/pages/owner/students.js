import { boot } from "../../lib/portal.js";
import { supabase } from "../../lib/supabase.js";
import { call } from "../../lib/api.js";
import { esc, fmtNum } from "../../lib/fmt.js";
import { icon } from "../../lib/icons.js";
import { invokeOwnerAdmin, generateTemporaryPassword } from "../../lib/owner-admin.js";
import { p } from "../../lib/base.js";
import {
  buildFilterParams,
  countGenders,
  countLevels,
  countTracks,
  filterStudents,
  isLevelDisabled,
  parseFilters,
} from "../../lib/students-filters.js";
import { onDispose } from "../../lib/lifecycle.js";

const $ = (id) => document.getElementById(id);

const TRACKS = [
  ["bachelor_m", "بكالوريوس · ذكور"],
  ["bachelor_f", "بكالوريوس · إناث"],
  ["equiv", "معادل"],
  ["external", "خارجي"],
  ["grad", "دراسات عليا"],
];

let allStudents = [];
let allCourses = [];
let allSemesters = [];
let enrollmentMap = new Map();

const BACHELOR_TRACKS = ["bachelor_m", "bachelor_f"];
const TRACK_TABS = [
  ["all", "الكل"],
  ["bachelor", "بكالوريوس"],
  ["equiv", "معادل"],
  ["external", "خارجي"],
  ["grad", "دراسات عليا"],
];
const GENDER_TABS = [
  ["bachelor", "كل البكالوريوس"],
  ["bachelor_m", "طلاب"],
  ["bachelor_f", "طالبات"],
];
const LEVELS = [0, 1, 2, 3, 4];
const LEVEL_LABELS = {
  0: "المستوى صفر",
  1: "الأول",
  2: "الثاني",
  3: "الثالث",
  4: "الرابع",
};
function isBachelorTrack(track) {
  return track === "bachelor" || BACHELOR_TRACKS.includes(track);
}

function trackLabel(track) {
  return TRACKS.find(([value]) => value === track)?.[1] || track || "—";
}

function courseLabel(c) {
  const level = c.level ? ` · مستوى ${c.level}` : "";
  return `${c.code || ""} — ${c.title || ""} · ${trackLabel(c.track)}${level}`;
}

function showMessage(id, text, kind = "") {
  const el = $(id);
  if (!el) return;
  el.className = `od-inline-msg${kind ? ` od-inline-msg--${kind}` : ""}`;
  el.textContent = text;
  el.hidden = !text;
}

function setButton(btn, state) {
  if (!btn) return;
  btn.classList.toggle("is-loading", state);
  btn.disabled = state;
}

function showPanel(activeId) {
  ["ostNewPanel", "ostTransferPanel", "ostTrackPanel", "ostDetailsPanel"].forEach((id) => {
    const panel = $(id);
    if (panel) panel.hidden = id !== activeId;
  });
}

function courseOptions(selected = "") {
  const list = allCourses.filter((c) => !c.archived);
  return list.map((c) => `<option value="${c.id}" ${String(c.id) === String(selected) ? "selected" : ""}>${esc(courseLabel(c))}</option>`).join("")
    || `<option value="">لا يوجد</option>`;
}

function trackOptions(selected = "", withEmpty = false) {
  const empty = withEmpty ? `<option value="">— لا شيء —</option>` : "";
  return empty + TRACKS.map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${esc(label)}</option>`).join("");
}

function studentOptions(selected) {
  return allStudents.map((u) => `<option value="${u.id}" ${String(u.id) === String(selected) ? "selected" : ""}>${esc(`${u.name || ""} · ${u.platform_id || ""}`)}</option>`).join("")
    || `<option value="">لا يوجد</option>`;
}

function findStudentByIdentifier(raw) {
  const identifier = String(raw || "").trim().toLowerCase();
  return allStudents.find((u) => [
    u.platform_id, u.email, u.university_id,
  ].some((value) => String(value || "").toLowerCase() === identifier));
}

function syncCourseSelects() {
  $("ostCourse").innerHTML = courseOptions();
  $("ostNewCourse").innerHTML = `<option value="">— لا شيء —</option>` + courseOptions();
  $("ostNewTrackEnroll").innerHTML = trackOptions("", true);
  $("ostEnrollTrack").innerHTML = trackOptions("", true);
  $("ostTransferTo").innerHTML = courseOptions();
}

function semesterOptions() {
  return allSemesters.map((semester) => (
    `<option value="${semester.id}">الفصل ${semester.term_no === 2 ? "الثاني" : "الأول"}</option>`
  )).join("") || `<option value="">— لا يوجد فصل مفتوح —</option>`;
}

function syncSemesterSelects() {
  for (const id of ["ostNewSemester", "ostEnrollSemester"]) {
    const select = $(id);
    if (!select) continue;
    const previous = select.value;
    select.innerHTML = `<option value="">— الفصل المفتوح الحالي —</option>` + semesterOptions();
    if ([...select.options].some((option) => option.value === previous)) select.value = previous;
  }
}

function syncSemesterFields() {
  const newTrack = $("ostNewTrack").value;
  const enrollTrack = $("ostEnrollTrack").value;
  const enrollCourse = allCourses.find((c) => String(c.id) === $("ostCourse").value);
  const newBachelor = BACHELOR_TRACKS.includes(newTrack);
  const enrollBachelor = BACHELOR_TRACKS.includes(enrollTrack)
    || (!enrollTrack && !!enrollCourse && BACHELOR_TRACKS.includes(enrollCourse.track));
  $("ostNewSemesterField").hidden = !newBachelor;
  $("ostEnrollSemesterField").hidden = !enrollBachelor;
  if (!newBachelor) $("ostNewSemester").value = "";
  if (!enrollBachelor) $("ostEnrollSemester").value = "";
}

async function loadSemesters() {
  allSemesters = [];
  try {
    const { data: years } = await supabase
      .from("academic_years")
      .select("id, status")
      .eq("status", "open")
      .order("id", { ascending: false });
    const year = years?.[0];
    if (year) {
      const { data: semesters } = await supabase
        .from("semesters")
        .select("id, year_id, term_no, status")
        .eq("year_id", year.id)
        .eq("status", "open")
        .order("term_no");
      allSemesters = semesters || [];
    }
  } catch (error) {
    console.warn("تعذّر تحميل الفصول:", error);
  }
  syncSemesterSelects();
  syncSemesterFields();
}

async function loadCourses() {
  try {
    const { data } = await supabase.from("courses").select("id, title, code, track, level, archived").order("title");
    allCourses = Array.isArray(data) ? data : [];
  } catch (error) {
    allCourses = [];
    console.warn("تعذّر تحميل المقررات:", error);
  }
  syncCourseSelects();
}

function showTableError(message) {
  $("ostTable").innerHTML = `<div class="od-empty" role="status"><span class="od-empty-icon">${icon("users")}</span><h3>تعذّر تحميل الطلاب</h3><p>${esc(message || "خطأ غير معروف")}</p></div>`;
  $("ostCount").textContent = "—";
}

async function loadStudents() {
  const table = $("ostTable");
  table.innerHTML = `<div class="od-skeleton od-skeleton-row" aria-hidden="true"></div>`.repeat(5);
  try {
    const { data: users, error } = await supabase
      .from("users")
      .select("id, name, email, university_id, platform_id, is_active, track, level, created_at")
      .eq("role", "student")
      .order("name");
    if (error) {
      showTableError(error.message);
      return;
    }

    const { data: enrs } = await supabase.from("enrollments").select("student_id, course_id, status");
    enrollmentMap = new Map();
    for (const enrollment of (enrs || [])) {
      if (!enrollmentMap.has(enrollment.student_id)) enrollmentMap.set(enrollment.student_id, []);
      enrollmentMap.get(enrollment.student_id).push(enrollment);
    }
    allStudents = Array.isArray(users) ? users : [];
  } catch (error) {
    showTableError(error?.message || String(error));
    return;
  }
  renderTable();
}

function enrollmentButtons(user, enrollments) {
  return enrollments.map((enrollment) => {
    const course = allCourses.find((c) => c.id === enrollment.course_id);
    const short = course ? course.code || course.title : `مقرر #${enrollment.course_id}`;
    const statusButton = enrollment.status === "active"
      ? `<button type="button" class="od-btn od-btn--small od-btn--ghost" data-action="suspend" data-id="${user.id}" data-course="${enrollment.course_id}">${icon("eyeOff")} إيقاف ${esc(short)}</button>`
      : `<button type="button" class="od-btn od-btn--small od-btn--ghost" data-action="resume" data-id="${user.id}" data-course="${enrollment.course_id}">${icon("eye")} تفعيل ${esc(short)}</button>`;
    return `${statusButton}
      <button type="button" class="od-btn od-btn--small od-btn--danger" data-action="remove" data-id="${user.id}" data-course="${enrollment.course_id}">${icon("trash")} إزالة ${esc(short)}</button>`;
  }).join("");
}

function trackCount(track) {
  return countTracks(allStudents)[track];
}

function genderCount(track, level) {
  return countGenders(allStudents, level)[track];
}

function levelCount(level) {
  return countLevels(allStudents)[level];
}

function tabHtml(label, count, attrs, { active = false, disabled = false, zero = false } = {}) {
  const classes = ["ost-tab", active ? "ost-tab--active" : "", zero ? "ost-tab--zero" : ""].filter(Boolean).join(" ");
  return `<button type="button" class="${classes}" role="tab" ${attrs}
    ${active ? 'aria-current="true"' : ""} ${disabled ? 'disabled aria-disabled="true"' : ""}>${esc(label)}
    <span class="ost-tab-count">${fmtNum(count)}</span></button>`;
}

function readFilters() {
  return parseFilters(new URLSearchParams(location.search));
}

function writeFilters(filters, mode = "push") {
  const params = buildFilterParams(filters, location.search);
  params.delete("student");
  const search = params.toString();
  const url = `${location.pathname}${search ? `?${search}` : ""}${location.hash}`;
  if (mode === "replace") history.replaceState({ ostFilters: filters }, "", url);
  else history.pushState({ ostFilters: filters }, "", url);
  renderTable();
}

function renderTable() {
  const filters = readFilters();
  const isBachelor = isBachelorTrack(filters.track);
  const search = $("ostStudentSearch");
  if (search && search.value !== filters.q) search.value = filters.q;
  syncDetailsFromUrl();

  $("ostTrackTabs").innerHTML = TRACK_TABS.map(([value, label]) => tabHtml(
    label, trackCount(value), `data-track="${value}"`, { active: filters.track === value },
  )).join("");
  $("ostBachelorTabs").hidden = !isBachelor;
  $("ostLevelTabs").hidden = !isBachelor;
  if (isBachelor) {
    $("ostBachelorTabs").innerHTML = GENDER_TABS.map(([value, label]) => tabHtml(
      label, genderCount(value, filters.level), `data-gender="${value}"`,
      { active: filters.track === value },
    )).join("");
    $("ostLevelTabs").innerHTML = LEVELS.map((level) => {
      const zero = isLevelDisabled(level);
      return tabHtml(
        LEVEL_LABELS[level], levelCount(level), `data-level="${level}"`,
        { active: !zero && filters.level === String(level), disabled: zero, zero },
      );
    }).join("");
  } else {
    $("ostBachelorTabs").innerHTML = "";
    $("ostLevelTabs").innerHTML = "";
  }

  const legacyFilter = $("ostTrackFilter");
  if (legacyFilter) {
    legacyFilter.value = ["bachelor_m", "bachelor_f"].includes(filters.track) ? filters.track : "all";
  }

  const list = filterStudents(allStudents, filters);
  $("ostCount").textContent = `${fmtNum(list.length)} / ${fmtNum(allStudents.length)}`;
  if (!list.length) {
    $("ostTable").innerHTML = `<div class="od-empty" role="status"><span class="od-empty-icon">${icon("users")}</span><h3>لا يوجد طلاب</h3><p>أنشئ طالباً جديداً أو غيّر التصفية.</p></div>`;
    return;
  }

  const rows = list.map((u) => {
    const enrollments = enrollmentMap.get(u.id) || [];
    const active = enrollments.filter((e) => e.status === "active").length;
    return `<tr>
      <td><button type="button" class="ost-student-link" data-action="details" data-id="${u.id}">${esc(u.name || "—")}</button><br /><span class="od-link" dir="ltr">${esc(u.platform_id || "—")}</span></td>
      <td dir="ltr">${esc(u.email || "—")}</td>
      <td dir="ltr">${esc(u.university_id || "—")}</td>
      <td>${esc(trackLabel(u.track))}</td>
      <td>${u.level ? esc(String(u.level)) : "—"}</td>
      <td>${u.is_active ? "✅" : "⛔"}</td>
      <td>${active}/${enrollments.length}</td>
      <td>
        <div class="od-btn-group">
          <button type="button" class="od-btn od-btn--small od-btn--ghost" data-action="details" data-id="${u.id}">${icon("user")} بيانات الطالب</button>
          <button type="button" class="od-btn od-btn--small od-btn--ghost" data-action="enroll" data-id="${u.id}">${icon("plus")} تسجيل</button>
          <button type="button" class="od-btn od-btn--small od-btn--ghost" data-action="transfer" data-id="${u.id}">${icon("arrow")} نقل</button>
          <button type="button" class="od-btn od-btn--small od-btn--ghost" data-action="track" data-id="${u.id}">${icon("courses")} مسار</button>
          <button type="button" class="od-btn od-btn--small od-btn--ghost" data-action="reset" data-id="${u.id}">${icon("key")} كلمة مرور</button>
          ${enrollmentButtons(u, enrollments)}
        </div>
      </td>
    </tr>`;
  }).join("");
  $("ostTable").innerHTML = `<div class="od-table-wrap"><table class="od-table">
    <thead><tr><th>الاسم والرمز</th><th>البريد</th><th>الرقم الجامعي</th><th>المسار</th><th>المستوى</th><th>الحالة</th><th>تسجيلات</th><th>إجراءات</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function openStudentDetails(student) {
  showPanel(null);
  const enrollments = enrollmentMap.get(student.id) || [];
  const courses = enrollments.map((enrollment) => {
    const course = allCourses.find((c) => String(c.id) === String(enrollment.course_id));
    return `<li>${esc(course ? courseLabel(course) : `مقرر #${enrollment.course_id}`)} — ${enrollment.status === "active" ? "نشط" : "موقوف"}</li>`;
  }).join("") || "<li>لا توجد تسجيلات.</li>";
  $("ostDetailsBody").innerHTML = `<dl>
    <div><dt>الاسم</dt><dd>${esc(student.name || "—")}</dd></div>
    <div><dt>رمز المنصة</dt><dd dir="ltr">${esc(student.platform_id || "—")}</dd></div>
    <div><dt>المسار</dt><dd>${esc(trackLabel(student.track))}</dd></div>
    <div><dt>المستوى</dt><dd>${student.level ? esc(String(student.level)) : "—"}</dd></div>
    <div><dt>البريد</dt><dd dir="ltr">${esc(student.email || "—")}</dd></div>
    <div><dt>الرقم الجامعي</dt><dd dir="ltr">${esc(student.university_id || "—")}</dd></div>
  </dl>
  <h4>قائمة المقرر</h4>
  <ul>${courses}</ul>`;
  $("ostDetailsPanel").hidden = false;
  $("ostDetailsPanel").scrollIntoView({ block: "nearest" });
}

function studentDetailLocation(student) {
  const params = buildFilterParams(readFilters(), location.search);
  params.set("student", String(student.id));
  return `${p("pages/owner/students.html")}?${params.toString()}${location.hash}`;
}

function showStudentDetails(student) {
  openStudentDetails(student);
  history.pushState(
    { ...history.state, ostStudent: student.id },
    "",
    studentDetailLocation(student),
  );
}

function closeStudentDetails() {
  const params = new URLSearchParams(location.search);
  params.delete("student");
  const search = params.toString();
  history.replaceState(
    history.state,
    "",
    `${location.pathname}${search ? `?${search}` : ""}${location.hash}`,
  );
  $("ostDetailsPanel").hidden = true;
}

function syncDetailsFromUrl() {
  if (!$("ostDetailsPanel")) return;
  const requested = new URLSearchParams(location.search).get("student");
  const student = requested && allStudents.find((u) => String(u.id) === String(requested));
  if (student) openStudentDetails(student);
  else $("ostDetailsPanel").hidden = true;
}

function openTransfer(student) {
  const enrollments = enrollmentMap.get(student.id) || [];
  const options = enrollments.map((enrollment) => {
    const course = allCourses.find((c) => c.id === enrollment.course_id);
    const label = course ? courseLabel(course) : `مقرر #${enrollment.course_id}`;
    return `<option value="${enrollment.course_id}">${esc(label)}</option>`;
  }).join("");
  if (!options) {
    showPanel("ostTransferPanel");
    showMessage("ostTransferMsg", "لا توجد تسجيلات قابلة للنقل لهذا الطالب.", "error");
    $("ostTransferStudent").innerHTML = studentOptions(student.id);
    $("ostTransferFrom").innerHTML = `<option value="">لا يوجد</option>`;
    return;
  }
  $("ostTransferStudent").innerHTML = studentOptions(student.id);
  $("ostTransferFrom").innerHTML = options;
  $("ostTransferTo").innerHTML = courseOptions();
  showMessage("ostTransferMsg", "");
  showPanel("ostTransferPanel");
}

function openTrack(student) {
  $("ostTrackStudent").innerHTML = studentOptions(student.id);
  $("ostTrackNew").value = student.track || "bachelor_m";
  $("ostTrackLevel").value = student.level ? String(student.level) : "";
  showMessage("ostTrackMsg", "");
  showPanel("ostTrackPanel");
}

async function setEnrollmentStatus(button, student, courseId, active) {
  const course = allCourses.find((c) => c.id === courseId);
  if (!window.confirm(`${active ? "إيقاف" : "تفعيل"} تسجيل ${student.name} في ${course?.title || "المقرر"}؟`)) return;
  setButton(button, true);
  const res = await call("management_set_enrollment_status", {
    p_course_id: courseId,
    p_student_id: student.id,
    p_status: active ? "suspended" : "active",
  });
  setButton(button, false);
  if (!res.ok) { alert(res.error || "فشل"); return; }
  showMessage("ostEnrollMsg", active ? "أُوقف التسجيل." : "فُعّل التسجيل.", "success");
  await loadStudents();
}

async function removeEnrollment(button, student, courseId) {
  if (!window.confirm(`إزالة تسجيل ${student.name} من المقرر؟ إن كان للتسجيل تاريخ درجات أو حضور فسيُوقف بدل الحذف.`)) return;
  setButton(button, true);
  const res = await call("management_remove_enrollment", { p_course_id: courseId, p_student_id: student.id });
  setButton(button, false);
  if (!res.ok) { alert(res.error || "فشل"); return; }
  showMessage("ostEnrollMsg", res.data?.suspended_instead_of_delete
    ? "للتسجيل تاريخ محفوظ؛ أُوقف بدل الحذف." : "أُزيل التسجيل.", "success");
  await loadStudents();
}

async function resetPassword(button, student) {
  if (!window.confirm(`إعادة تعيين كلمة مرور ${student.name}؟`)) return;
  setButton(button, true);
  const password = generateTemporaryPassword();
  const res = await invokeOwnerAdmin({ op: "reset_password", user_id: student.id, password: password });
  setButton(button, false);
  if (!res.ok) {
    showMessage("ostEnrollMsg", res.error || "تعذّر إعادة تعيين كلمة المرور", "error");
    return;
  }
  showMessage("ostEnrollMsg", `كلمة المرور المؤقتة لـ ${student.name}: ${password} — انسخها الآن.`, "success");
}

async function createStudent(form) {
  const msg = $("ostNewMsg");
  const btn = $("ostNewSubmitBtn");
  const name = form.elements.name.value.trim();
  const email = form.elements.email.value.trim();
  const track = form.elements.track.value;
  if (!name || !email || !track) {
    showMessage("ostNewMsg", "الاسم والبريد والمسار مطلوبة.", "error");
    return;
  }
  const level = form.elements.level.value ? Number(form.elements.level.value) : null;
  setButton(btn, true);
  try {
    const { data: platformId, error: allocationError } = await supabase.rpc(
      "management_allocate_platform_id",
      { p_role: "student", p_track: track },
    );
    if (allocationError || !platformId) throw new Error(allocationError?.message || "تعذّر حجز رمز المنصة");

    const password = generateTemporaryPassword();
    const created = await invokeOwnerAdmin({
      op: "create",
      password: password,
      platform_id: platformId,
      name: name,
      email: email,
      phone: form.elements.phone.value.trim(),
      role: "student",
      track: track,
      level: level,
      university_id: form.elements.university_id.value.trim(),
      gender: form.elements.gender.value,
    });
    if (!created.ok) throw new Error(created.error || "تعذّر إنشاء الطالب");

    const courseId = form.elements.course_id.value;
    const targetTrack = form.elements.enroll_track.value;
    const semesterId = form.elements.semester_id.value;
    const inBachelorSemester = BACHELOR_TRACKS.includes(track) && !!semesterId;
    if (inBachelorSemester && !created.data?.id) {
      throw new Error("تعذّر تحديد الطالب للتسجيل في الفصل المحدد");
    }
    let enrollmentNote = "";
    if (courseId) {
      const params = inBachelorSemester
        ? {
          p_semester_id: Number(semesterId),
          p_student_id: created.data?.id,
          p_course_id: Number(courseId),
        }
        : { p_course_id: Number(courseId), p_identifier: platformId };
      const rpc = inBachelorSemester ? "academic_owner_enroll_in_semester" : "management_enroll_student";
      const enrolled = await call(rpc, params);
      enrollmentNote = enrolled.ok ? "تم التسجيل في المقرر المحدد." : `تعذّر التسجيل في المقرر: ${enrolled.error || ""}`;
    } else if (targetTrack && created.data?.id) {
      const rpc = inBachelorSemester
        ? "academic_owner_enroll_in_semester"
        : "management_enroll_student_in_track";
      const params = inBachelorSemester
        ? {
          p_semester_id: Number(semesterId),
          p_student_id: created.data.id,
          p_track: targetTrack,
          p_level: level,
        }
        : {
          p_student_id: created.data.id,
          p_track: targetTrack,
          p_level: level,
        };
      const enrolled = await call(rpc, params);
      enrollmentNote = enrolled.ok ? `تم التسجيل في ${trackLabel(targetTrack)} (${enrolled.data?.added ?? 0} مقرر).` : `تعذّر التسجيل في المسار: ${enrolled.error || ""}`;
    }

    $("ostNewPassword").value = password;
    $("ostNewPasswordField").hidden = false;
    showMessage("ostNewMsg", `تم إنشاء الطالب برمز الدخول ${platformId}. كلمة المرور المؤقتة: ${password} — انسخها الآن. ${enrollmentNote}`, "success");
    await loadStudents();
  } catch (error) {
    showMessage("ostNewMsg", error?.message || String(error), "error");
  } finally {
    setButton(btn, false);
  }
}

async function enrollStudent(form) {
  const btn = $("ostSubmitBtn");
  setButton(btn, true);
  try {
    const track = form.elements.enroll_track.value;
    const semesterId = form.elements.semester_id.value;
    const inBachelorSemester = !!semesterId && BACHELOR_TRACKS.includes(track || allCourses.find((c) => String(c.id) === form.elements.course_id.value)?.track);
    if (track) {
      const student = findStudentByIdentifier(form.elements.identifier.value);
      if (!student) throw new Error("لم يُعثر على الطالب؛ استخدم التسجيل بمقرر محدد.");
      const params = inBachelorSemester
        ? {
          p_semester_id: Number(semesterId),
          p_student_id: student.id,
          p_track: track,
          p_level: student.level ?? null,
        }
        : {
          p_student_id: student.id,
          p_track: track,
          p_level: student.level ?? null,
        };
      const res = await call(
        inBachelorSemester ? "academic_owner_enroll_in_semester" : "management_enroll_student_in_track",
        params,
      );
      if (!res.ok) throw new Error(res.error || "تعذّر التسجيل في المسار");
      showMessage("ostEnrollMsg", `تم التسجيل في ${trackLabel(track)} (${res.data?.added ?? 0} مقرر).`, "success");
    } else if (inBachelorSemester) {
      const student = findStudentByIdentifier(form.elements.identifier.value);
      if (!student) throw new Error("للتسجيل في فصل محدد، اختر طالباً بمعرّف معروف في القائمة.");
      const res = await call("academic_owner_enroll_in_semester", {
        p_semester_id: Number(semesterId),
        p_student_id: student.id,
        p_course_id: Number(form.elements.course_id.value),
      });
      if (!res.ok) throw new Error(res.error || "تعذّر التسجيل في الفصل");
      showMessage("ostEnrollMsg", `تم تسجيل ${student.name} في الفصل المحدد.`, "success");
    } else {
      const res = await call("management_enroll_student", {
        p_course_id: Number(form.elements.course_id.value),
        p_identifier: form.elements.identifier.value.trim(),
      });
      if (!res.ok) throw new Error(res.error || "تعذّر التسجيل");
      showMessage("ostEnrollMsg", `تم تسجيل: ${res.data?.name || ""}`, "success");
    }
    form.reset();
    await loadStudents();
  } catch (error) {
    showMessage("ostEnrollMsg", error?.message || String(error), "error");
  } finally {
    setButton(btn, false);
  }
}

async function transferStudent(form) {
  if (!window.confirm("سيُوقف التسجيل الحالي ولا يُحذف، مع حفظ الدرجات والحضور. متابعة؟")) return;
  const res = await call("management_transfer_student", {
    p_student_id: Number(form.elements.student_id.value),
    p_from_course_id: Number(form.elements.from_course_id.value),
    p_to_course_id: Number(form.elements.to_course_id.value),
  });
  if (!res.ok) {
    showMessage("ostTransferMsg", res.error || "تعذّر النقل", "error");
    return;
  }
  showMessage("ostTransferMsg", "تم نقل الطالب؛ التسجيل القديم موقوف.", "success");
  await loadStudents();
}

async function changeTrack(form) {
  if (!window.confirm("سيُوقف التسجيلات الحالية ويُعاد تسجيل الطالب في مسارات المقررات المناسبة. متابعة؟")) return;
  const res = await call("management_change_student_track", {
    p_student_id: Number(form.elements.student_id.value),
    p_track: form.elements.track.value,
    p_level: form.elements.level.value ? Number(form.elements.level.value) : null,
    p_sync_enrollments: true,
  });
  if (!res.ok) {
    showMessage("ostTrackMsg", res.error || "تعذّر تغيير المسار", "error");
    return;
  }
  showMessage("ostTrackMsg", `تم تغيير المسار إلى ${trackLabel(form.elements.track.value)}.`, "success");
  await loadStudents();
}

async function handleListAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button || button.disabled) return;
  const student = allStudents.find((u) => String(u.id) === String(button.dataset.id));
  if (!student) return;
  switch (button.dataset.action) {
    case "details":
      showStudentDetails(student);
      break;
    case "enroll":
      $("ostIdentifier").value = student.platform_id || student.email || "";
      syncSemesterFields();
      showPanel("ostEnrollPanel");
      $("ostIdentifier").focus();
      break;
    case "transfer":
      openTransfer(student);
      break;
    case "track":
      openTrack(student);
      break;
    case "suspend":
      await setEnrollmentStatus(button, student, Number(button.dataset.course), true);
      break;
    case "resume":
      await setEnrollmentStatus(button, student, Number(button.dataset.course), false);
      break;
    case "remove":
      await removeEnrollment(button, student, Number(button.dataset.course));
      break;
    case "reset":
      await resetPassword(button, student);
      break;
    default:
      break;
  }
}

boot({
  portal: "owner",
  title: "الطلاب",
  render: async () => {
    if ($("ostSubmitBtn")) $("ostSubmitBtn").innerHTML = `<span class="od-btn-spinner"></span>${icon("check")} تسجيل`;

    await loadCourses();
    await loadSemesters();
    await loadStudents();

    $("ostNewTrack").addEventListener("change", syncSemesterFields);
    $("ostEnrollTrack").addEventListener("change", syncSemesterFields);
    $("ostCourse").addEventListener("change", syncSemesterFields);
    $("ostNewBtn").addEventListener("click", () => {
      $("ostNewForm").reset();
      $("ostNewPasswordField").hidden = true;
      $("ostNewPassword").value = "";
      $("ostNewTrackEnrollField").hidden = false;
      syncSemesterFields();
      showMessage("ostNewMsg", "");
      showPanel("ostNewPanel");
      $("ostNewName").focus();
    });
    $("ostNewCancel").addEventListener("click", () => { $("ostNewPanel").hidden = true; });
    $("ostEnrollBtn").addEventListener("click", () => {
      syncSemesterFields();
      showPanel("ostEnrollPanel");
      $("ostIdentifier").focus();
    });
    $("ostTransferBtn").addEventListener("click", () => {
      $("ostTransferStudent").innerHTML = studentOptions();
      $("ostTransferFrom").innerHTML = courseOptions();
      $("ostTransferTo").innerHTML = courseOptions();
      showMessage("ostTransferMsg", "");
      showPanel("ostTransferPanel");
    });
    $("ostTrackBtn").addEventListener("click", () => {
      $("ostTrackStudent").innerHTML = studentOptions();
      showMessage("ostTrackMsg", "");
      showPanel("ostTrackPanel");
    });
    $("ostTransferCancel").addEventListener("click", () => { $("ostTransferPanel").hidden = true; });
    $("ostTrackCancel").addEventListener("click", () => { $("ostTrackPanel").hidden = true; });

    $("ostNewForm").addEventListener("submit", (event) => {
      event.preventDefault();
      createStudent(event.currentTarget);
    });
    $("ostEnrollForm").addEventListener("submit", (event) => {
      event.preventDefault();
      enrollStudent(event.currentTarget);
    });
    $("ostTransferForm").addEventListener("submit", (event) => {
      event.preventDefault();
      transferStudent(event.currentTarget);
    });
    $("ostTrackForm").addEventListener("submit", (event) => {
      event.preventDefault();
      changeTrack(event.currentTarget);
    });

    $("ostTable").addEventListener("click", handleListAction);
    $("ostDetailsPanel").addEventListener("click", handleListAction);
    $("ostDetailsClose").addEventListener("click", closeStudentDetails);
    $("ostTrackTabs").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-track]");
      if (!button || button.disabled) return;
      const filters = readFilters();
      writeFilters({ ...filters, track: button.dataset.track, level: isBachelorTrack(button.dataset.track) ? filters.level : "" });
    });
    $("ostBachelorTabs").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-gender]");
      if (!button || button.disabled) return;
      writeFilters({ ...readFilters(), track: button.dataset.gender });
    });
    $("ostLevelTabs").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-level]");
      if (!button || button.disabled) return;
      writeFilters({ ...readFilters(), level: button.dataset.level });
    });
    $("ostStudentSearch").addEventListener("input", (event) => {
      writeFilters({ ...readFilters(), q: event.target.value.trim() }, "replace");
    });
    $("ostTrackFilter").addEventListener("change", (event) => {
      writeFilters({ ...readFilters(), track: event.target.value, level: "" });
    });
    window.addEventListener("popstate", renderTable);
    onDispose(() => window.removeEventListener("popstate", renderTable));

    if (new URLSearchParams(location.search).get("new") === "1") $("ostNewBtn").click();
  },
});

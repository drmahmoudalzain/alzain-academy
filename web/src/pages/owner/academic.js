import { boot } from "../../lib/portal.js";
import { supabase } from "../../lib/supabase.js";
import { call } from "../../lib/api.js";
import { esc, fmtDateTime, fmtNum } from "../../lib/fmt.js";
import { icon } from "../../lib/icons.js";

const $ = (id) => document.getElementById(id);

const STATUS_LABEL = {
  pass: "نجاح",
  needs_decision: "بانتظار قرار",
  fail: "رسوب",
};
const ACADEMIC_LABEL = {
  active: "نشط",
  graduated: "متخرج",
  archived: "مؤرشف",
};
const TERM_LABEL = { 1: "الأول", 2: "الثاني" };

let years = [];
let semesters = [];
let policies = [];
let students = [];
let preview = null;
let results = [];
let candidates = [];

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
  btn.disabled = state || btn.dataset.locked === "true";
}

function skeleton(kind, count) {
  return `<div class="od-skeleton od-skeleton-${kind}" aria-hidden="true"></div>`.repeat(count);
}

function emptyState(title, text, ico = "calendar") {
  return `<div class="od-empty" role="status"><span class="od-empty-icon">${icon(ico)}</span><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`;
}

function labelFor(map, value) {
  return map[value] || value || "—";
}

function countText(value) {
  return value === null || value === undefined ? "—" : fmtNum(Number(value));
}

function openYear() {
  return years.find((year) => year.status === "open") || null;
}

async function loadPeriods() {
  const target = $("oyPeriods");
  target.innerHTML = skeleton("row", 3);
  const [{ data: yearRows, error: yearError }, { data: semesterRows, error: semesterError }, { data: policyRows }] = await Promise.all([
    supabase.from("academic_years").select("id, label, code, status, closed_at").order("id", { ascending: false }),
    supabase.from("semesters").select("id, year_id, term_no, status").order("term_no"),
    supabase.from("academic_policies").select("key, value, description").order("key"),
  ]);
  if (yearError || semesterError) {
    years = [];
    semesters = [];
    target.innerHTML = emptyState("تعذّر تحميل الأعوام", yearError?.message || semesterError?.message || "خطأ غير معروف");
    return;
  }
  years = yearRows || [];
  semesters = semesterRows || [];
  policies = policyRows || [];
  renderPeriods();
  syncYearSelects();
}

function renderPeriods() {
  if (!years.length) {
    $("oyPeriods").innerHTML = emptyState("لا توجد أعوام", "لم يُنشأ أي عام دراسي بعد.");
    return;
  }
  const rows = years.map((year) => {
    const terms = semesters
      .filter((semester) => semester.year_id === year.id)
      .map((semester) => `الفصل ${labelFor(TERM_LABEL, semester.term_no)}: ${semester.status === "open" ? "مفتوح" : "مغلق"}`)
      .join(" · ") || "—";
    return `<tr>
      <td><strong>${esc(year.label || year.code || "—")}</strong><br /><span class="od-link" dir="ltr">${esc(year.code || "—")}</span></td>
      <td>${esc(labelFor({ open: "مفتوح", closed: "مغلق", archived: "مؤرشف" }, year.status))}</td>
      <td>${esc(terms)}</td>
      <td>${year.closed_at ? esc(fmtDateTime(year.closed_at)) : "—"}</td>
    </tr>`;
  }).join("");
  const target = policies.find((policy) => policy.key === "course_target_points")?.value;
  const pass = policies.find((policy) => policy.key === "course_pass_points")?.value;
  $("oyPeriods").innerHTML = `<div class="od-table-wrap"><table class="od-table">
    <thead><tr><th>العام</th><th>الحالة</th><th>الفصول</th><th>أُغلق في</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
  <p class="od-inline-msg">المستهدف: ${esc(String(target ?? "—"))} نقطة · حد النجاح الإداري: ${esc(String(pass ?? "—"))} نقطة.</p>`;
}

function syncYearSelects() {
  const select = $("oyResultYear");
  const selected = select.value;
  select.innerHTML = years.map((year) => (
    `<option value="${year.id}">${esc(`${year.label || year.code} (${year.code})`)}</option>`
  )).join("") || `<option value="">لا يوجد عام</option>`;
  const open = openYear();
  select.value = years.some((year) => String(year.id) === selected)
    ? selected
    : String(open?.id ?? years[0]?.id ?? "");
  syncSemesterSelect();
}

function syncSemesterSelect() {
  const yearId = Number($("oyResultYear").value);
  const semestersForYear = semesters.filter((semester) => semester.year_id === yearId);
  const previous = $("oyResultSemester").value;
  $("oyResultSemester").innerHTML = `<option value="">كل الفصول</option>` + semestersForYear.map((semester) => (
    `<option value="${semester.id}">الفصل ${esc(labelFor(TERM_LABEL, semester.term_no))}</option>`
  )).join("");
  if (semestersForYear.some((semester) => String(semester.id) === previous)) {
    $("oyResultSemester").value = previous;
  }
}

async function loadPreview() {
  const year = openYear();
  if (!year) {
    preview = null;
    $("oyPreview").innerHTML = emptyState("لا يوجد عام مفتوح", "أغلق العام الحالي أولاً قبل معاينة غيره.", "shield");
    $("oyCloseForm").hidden = true;
    $("oyCloseBtn").disabled = true;
    return;
  }
  $("oyPreview").innerHTML = skeleton("row", 4);
  const res = await call("academic_preview_close_year", { p_year_id: year.id });
  if (!res.ok) {
    preview = null;
    $("oyPreview").innerHTML = emptyState("تعذّرت المعاينة", res.error || "خطأ غير معروف", "shield");
    $("oyCloseForm").hidden = true;
    $("oyCloseBtn").disabled = true;
    return;
  }
  preview = res.data || null;
  renderPreview();
}

function renderPreview() {
  if (!preview) return;
  const blockers = Array.isArray(preview.blockers) ? preview.blockers : [];
  const items = blockers.length
    ? blockers.map((blocker) => `<p class="od-inline-msg od-inline-msg--error">${esc(String(blocker))}</p>`).join("")
    : `<p class="od-inline-msg od-inline-msg--success">لا توجد عوائق; يمكن الإغلاق.</p>`;
  const counts = [
    ["التسجيلات النشطة", preview.active_enrollments],
    ["نتائج بانتظار قرار", preview.pending_decisions],
    ["طلاب بكالوريوس بلا نتائج", preview.students_without_results],
    ["مستوفون للتخرج بلا موافقة", preview.graduation_ready],
  ];
  $("oyPreview").innerHTML = `<div class="od-actions-grid">${counts.map(([label, value]) => `
    <div class="od-mini"><span class="od-mini-body"><span class="od-mini-value">${esc(countText(value))}</span><span class="od-mini-label">${esc(label)}</span></span></div>
  `).join("")}</div>${items}`;
  $("oyCloseForm").hidden = false;
  $("oyCloseBtn").dataset.locked = preview.safe_to_close ? "false" : "true";
  $("oyCloseBtn").disabled = !preview.safe_to_close;
}

async function loadResults() {
  const target = $("oyResults");
  target.innerHTML = skeleton("row", 4);
  const yearId = Number($("oyResultYear").value);
  const semesterId = $("oyResultSemester").value;
  const status = $("oyResultStatus").value;
  const params = {
    p_year_id: Number.isFinite(yearId) && yearId ? yearId : null,
    p_semester_id: semesterId ? Number(semesterId) : null,
    p_status: status || null,
  };
  const res = await call("academic_owner_list_course_results", params);
  if (!res.ok) {
    results = [];
    target.innerHTML = emptyState("تعذّر تحميل النتائج", res.error || "خطأ غير معروف", "grades");
    return;
  }
  results = Array.isArray(res.data) ? res.data : [];
  renderResults();
}

function renderResults() {
  const target = $("oyResults");
  if (!results.length) {
    target.innerHTML = emptyState("لا توجد نتائج", "شغّل تحديث النتائج من سجل النقاط أو غيّر التصفية.", "grades");
    return;
  }
  const rows = results.map((result) => `<tr>
    <td>${esc(result.student_name || "—")}<br /><span class="od-link" dir="ltr">${esc(result.platform_id || "—")}</span></td>
    <td>${esc(result.course_code || "—")} — ${esc(result.course_title || "—")}</td>
    <td>الفصل ${esc(labelFor(TERM_LABEL, result.term_no))}</td>
    <td dir="ltr">${esc(String(result.points ?? "0"))}</td>
    <td>${esc(labelFor(STATUS_LABEL, result.status))}</td>
    <td>${result.teacher_recommendation ? esc(labelFor(STATUS_LABEL, result.teacher_recommendation)) : "—"}</td>
    <td>${result.reason ? esc(result.reason) : "—"}</td>
    <td><div class="od-btn-group">
      <button type="button" class="od-btn od-btn--small od-btn--ghost" data-action="result-decision" data-id="${result.id}" data-decision="pass">نجاح</button>
      <button type="button" class="od-btn od-btn--small od-btn--danger" data-action="result-decision" data-id="${result.id}" data-decision="fail">رسوب</button>
    </div></td>
  </tr>`).join("");
  target.innerHTML = `<div class="od-table-wrap"><table class="od-table">
    <thead><tr><th>الطالب</th><th>المقرر</th><th>الفصل</th><th>النقاط</th><th>الحالة</th><th>توصية الأستاذ</th><th>السبب</th><th>القرار</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

async function loadGraduation() {
  const target = $("oyGraduation");
  target.innerHTML = skeleton("row", 3);
  const yearId = Number($("oyResultYear").value);
  const res = await call("academic_owner_list_graduation_candidates", {
    p_year_id: Number.isFinite(yearId) && yearId ? yearId : null,
  });
  if (!res.ok) {
    candidates = [];
    target.innerHTML = emptyState("تعذّر تحميل المرشحين", res.error || "خطأ غير معروف", "users");
    return;
  }
  candidates = Array.isArray(res.data) ? res.data : [];
  renderGraduation();
}

function renderGraduation() {
  const target = $("oyGraduation");
  if (!candidates.length) {
    target.innerHTML = emptyState("لا يوجد مرشحون", "لا يوجد طلاب بكالوريوس في المستوى الرابع لهذا العام.", "users");
    return;
  }
  const rows = candidates.map((candidate) => `<tr>
    <td>${esc(candidate.name || "—")}<br /><span class="od-link" dir="ltr">${esc(candidate.platform_id || "—")}</span></td>
    <td>${esc(trackLabel(candidate.track))}</td>
    <td>${countText(candidate.results_count)}</td>
    <td>${candidate.all_pass ? "ناجح في الكل" : "غير مستوفٍ"}</td>
    <td>${candidate.decision ? esc(candidate.decision === "approve" ? "موافقة" : "رفض") : "—"}</td>
    <td>${candidate.reason ? esc(candidate.reason) : "—"}</td>
    <td><div class="od-btn-group">
      <button type="button" class="od-btn od-btn--small od-btn--ghost" data-action="graduation-decision" data-id="${candidate.student_id}" data-decision="approve">موافقة</button>
      <button type="button" class="od-btn od-btn--small od-btn--danger" data-action="graduation-decision" data-id="${candidate.student_id}" data-decision="reject">رفض</button>
    </div></td>
  </tr>`).join("");
  target.innerHTML = `<div class="od-table-wrap"><table class="od-table">
    <thead><tr><th>الطالب</th><th>المسار</th><th>النتائج</th><th>الاستيفاء</th><th>القرار</th><th>السبب</th><th>إجراء</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function trackLabel(track) {
  return {
    bachelor_m: "بكالوريوس · ذكور",
    bachelor_f: "بكالوريوس · إناث",
    bachelor: "بكالوريوس",
    equiv: "معادل",
    external: "خارجي",
    grad: "دراسات عليا",
  }[track] || track || "—";
}

async function loadStudents() {
  const { data, error } = await supabase
    .from("users")
    .select("id, name, platform_id, track, level, academic_status")
    .eq("role", "student")
    .order("name");
  if (error) {
    students = [];
    $("oyArchiveList").innerHTML = emptyState("تعذّر تحميل الطلاب", error.message, "users");
    return;
  }
  students = data || [];
  const previous = $("oyArchiveStudent").value;
  $("oyArchiveStudent").innerHTML = students.map((student) => (
    `<option value="${student.id}">${esc(`${student.name || "—"} · ${student.platform_id || "—"}`)}</option>`
  )).join("") || `<option value="">لا يوجد طلاب</option>`;
  if (students.some((student) => String(student.id) === previous)) $("oyArchiveStudent").value = previous;
  const rows = students.slice(0, 100).map((student) => `<tr>
    <td>${esc(student.name || "—")}</td>
    <td dir="ltr">${esc(student.platform_id || "—")}</td>
    <td>${esc(trackLabel(student.track))}</td>
    <td>${esc(labelFor(ACADEMIC_LABEL, student.academic_status))}</td>
  </tr>`).join("");
  $("oyArchiveList").innerHTML = rows
    ? `<div class="od-table-wrap"><table class="od-table">
      <thead><tr><th>الطالب</th><th>الرمز</th><th>المسار</th><th>الحالة الأكاديمية</th></tr></thead><tbody>${rows}</tbody>
    </table></div>`
    : emptyState("لا يوجد طلاب", "تظهر هنا حالات الطلاب الأكاديمية.", "users");
}

async function refreshAll() {
  await loadPeriods();
  await Promise.all([
    loadPreview(),
    loadResults(),
    loadGraduation(),
    loadStudents(),
  ]);
}

async function runWrite(button, messageId, confirmText, action) {
  if (!window.confirm(confirmText)) return false;
  setButton(button, true);
  showMessage(messageId, "");
  try {
    const res = await action();
    if (!res.ok) {
      showMessage(messageId, res.error || "تعذّر تنفيذ الطلب", "error");
      return false;
    }
    showMessage(messageId, "تم التنفيذ بنجاح.", "success");
    await refreshAll();
    return true;
  } catch (error) {
    showMessage(messageId, error?.message || String(error), "error");
    return false;
  } finally {
    setButton(button, false);
  }
}

boot({
  portal: "owner",
  title: "العام الدراسي",
  render: async () => {
    await refreshAll();

    $("oyRefreshBtn").addEventListener("click", async () => {
      setButton($("oyRefreshBtn"), true);
      try { await refreshAll(); } finally { setButton($("oyRefreshBtn"), false); }
    });
    $("oyPreviewBtn").addEventListener("click", async () => {
      setButton($("oyPreviewBtn"), true);
      showMessage("oyCloseMsg", "");
      try { await loadPreview(); } catch (error) {
        showMessage("oyCloseMsg", error?.message || String(error), "error");
      } finally { setButton($("oyPreviewBtn"), false); }
    });
    $("oyResultYear").addEventListener("change", async () => {
      syncSemesterSelect();
      await Promise.all([loadResults(), loadGraduation()]);
    });
    $("oyResultSemester").addEventListener("change", loadResults);
    $("oyResultStatus").addEventListener("change", loadResults);
    $("oyResultsLoadBtn").addEventListener("click", loadResults);

    $("oyRebuildBtn").addEventListener("click", (event) => runWrite(
      event.currentTarget,
      "oyPeriodsMsg",
      "سيُعاد احتساب نتائج العام المفتوح من سجل النقاط. تُحفظ قرارات المالك السابقة. متابعة؟",
      () => call("academic_rebuild_course_results", { p_year_id: openYear()?.id ?? null }),
    ));

    $("oyOpenSecondBtn").addEventListener("click", (event) => runWrite(
      event.currentTarget,
      "oyPeriodsMsg",
      "لن يُفتح الفصل الثاني إلا إذا نجح جميع الطلاب في مقررات الفصل الأول. متابعة؟",
      () => call("academic_open_second_semester", { p_year_id: openYear()?.id ?? null }),
    ));

    $("oyCloseForm").addEventListener("submit", (event) => {
      event.preventDefault();
      if (!preview?.safe_to_close || !openYear()) {
        showMessage("oyCloseMsg", "يجب عرض معاينة خالية من العوائق قبل الإغلاق.", "error");
        return;
      }
      const form = event.currentTarget;
      const label = form.elements.label.value.trim();
      const code = form.elements.code.value.trim();
      const reason = form.elements.reason.value.trim();
      if (!label || !code || !reason) {
        showMessage("oyCloseMsg", "العنوان والرمز والسبب مطلوبة.", "error");
        return;
      }
      runWrite(
        $("oyCloseBtn"),
        "oyCloseMsg",
        `سيُغلق العام الحالي ويُنشأ عام جديد برمز ${code}. ستُوقف تسجيلات العام القديم ولا تُنسخ درجاته. متابعة؟`,
        () => call("academic_close_year_and_open_next", {
          p_label: label,
          p_code: code,
          p_reason: reason,
          p_archive_other_tracks: form.elements.archive_other.checked,
        }),
      );
    });

    $("oyResults").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action='result-decision']");
      if (!button || button.disabled) return;
      const reason = $("oyDecisionReason").value.trim();
      if (!reason) {
        showMessage("oyDecisionMsg", "اكتب سبب القرار قبل اختيار النجاح أو الرسوب.", "error");
        return;
      }
      const decision = button.dataset.decision;
      runWrite(
        button,
        "oyDecisionMsg",
        `تسجيل قرار ${labelFor(STATUS_LABEL, decision)} مع سبب موثّق؟`,
        () => call("academic_owner_decide_course_result", {
          p_result_id: Number(button.dataset.id),
          p_decision: decision,
          p_reason: reason,
        }),
      ).then((done) => { if (done) $("oyDecisionReason").value = ""; });
    });

    $("oyGraduation").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action='graduation-decision']");
      if (!button || button.disabled) return;
      const reason = $("oyGraduationReason").value.trim();
      if (!reason) {
        showMessage("oyGraduationMsg", "اكتب سبب القرار قبل الموافقة أو الرفض.", "error");
        return;
      }
      const decision = button.dataset.decision;
      runWrite(
        button,
        "oyGraduationMsg",
        decision === "approve"
          ? "الموافقة على التخرج تُغيّر الحالة الأكاديمية للطالب. متابعة؟"
          : "رفض التخرج يُسجَّل مع السبب ولا يمنح الطالب ترقية. متابعة؟",
        () => call("academic_owner_decide_graduation", {
          p_student_id: Number(button.dataset.id),
          p_year_id: Number($("oyResultYear").value),
          p_decision: decision,
          p_reason: reason,
        }),
      ).then((done) => { if (done) $("oyGraduationReason").value = ""; });
    });

    $("oyArchiveApplyBtn").addEventListener("click", (event) => {
      const studentId = $("oyArchiveStudent").value;
      const status = $("oyArchiveStatus").value;
      const reason = $("oyArchiveReason").value.trim();
      if (!studentId || !reason) {
        showMessage("oyArchiveMsg", "اختر الطالب واكتب السبب.", "error");
        return;
      }
      runWrite(
        event.currentTarget,
        "oyArchiveMsg",
        `تغيير الحالة الأكاديمية إلى ${labelFor(ACADEMIC_LABEL, status)} دون حذف الطالب. متابعة؟`,
        () => call("academic_owner_set_academic_status", {
          p_student_id: Number(studentId),
          p_status: status,
          p_reason: reason,
        }),
      ).then((done) => { if (done) $("oyArchiveReason").value = ""; });
    });
  },
});

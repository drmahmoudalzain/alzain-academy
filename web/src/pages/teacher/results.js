import { boot } from "../../lib/portal.js";
import { call } from "../../lib/api.js";
import { esc, fmtNum, fmtPoints } from "../../lib/fmt.js";
import { $, emptyState, openForm, skeleton } from "./common.js";

const LABEL = {
  pass: { text: "نجاح", cls: "tr-badge--good" },
  needs_decision: { text: "بانتظار قرار", cls: "tr-badge--warn" },
  fail: { text: "رسوب", cls: "tr-badge--danger" },
};

let results = [];

function showMessage(text, kind = "") {
  const el = $("#trMsg");
  if (!el) return;
  el.className = `tr-msg${kind ? ` tr-msg--${kind}` : ""}`;
  el.textContent = text;
  el.hidden = !text;
}

function badge(value) {
  const meta = LABEL[value] || { text: value || "—", cls: "" };
  return `<span class="tr-badge ${meta.cls}">${esc(meta.text)}</span>`;
}

function updateSummary(rows) {
  const pending = rows.filter((result) => result.can_recommend).length;
  $("#trSummary").textContent = rows.length
    ? `${fmtNum(rows.length)} نتيجة · ${fmtNum(pending)} بانتظار توصيتك`
    : "لا توجد نتائج مطابقة للتصفية الحالية";
}

function resultRow(result) {
  const action = result.can_recommend
    ? `<button class="tt-btn tt-btn-ghost" type="button" data-recommend="${result.id}">${result.teacher_recommendation ? "تعديل التوصية" : "تسجيل توصية"}</button>`
    : `<span class="tr-hint">لا إجراء</span>`;
  return `<tr>
    <td><strong>${esc(result.student_name || "—")}</strong><br /><small dir="ltr">${esc(result.platform_id || "—")}</small></td>
    <td>${esc(result.course_code || "—")} — ${esc(result.course_title || "—")}</td>
    <td>الفصل ${esc(String(result.term_no ?? "—"))}</td>
    <td dir="ltr">${esc(fmtPoints(result.points ?? 0))}</td>
    <td>${badge(result.status)}</td>
    <td>${result.teacher_recommendation ? badge(result.teacher_recommendation) : "—"}</td>
    <td>${result.owner_decision ? badge(result.owner_decision) : "—"}</td>
    <td>${action}</td>
  </tr>`;
}

function render() {
  const term = $("#trTerm").value;
  const rows = results.filter((result) => !term || String(result.term_no) === term);
  updateSummary(rows);
  $("#trResults").innerHTML = rows.length
    ? `<div class="tt-table-wrap"><table class="tt-table">
        <thead><tr><th>الطالب</th><th>المقرر</th><th>الفصل</th><th>النقاط</th><th>الحالة</th><th>توصيتي</th><th>قرار المالك</th><th>إجراء</th></tr></thead>
        <tbody>${rows.map(resultRow).join("")}</tbody>
      </table></div>`
    : emptyState("لا نتائج لهذه التصفية", "ستظهر نتائج مقرراتك بعد تحديث النتائج من سجل النقاط.", "grades");
}

async function load() {
  const target = $("#trResults");
  target.innerHTML = skeleton(4, "row");
  showMessage("");
  const res = await call("teacher_list_my_course_results", { p_year_id: null, p_semester_id: null });
  if (!res.ok) {
    results = [];
    updateSummary(results);
    target.innerHTML = emptyState("تعذّر تحميل النتائج", res.error || "تحقّق من الاتصال ثم أعد المحاولة.", "grades");
    showMessage(res.error || "تعذّر تحميل النتائج", "error");
    return;
  }
  results = Array.isArray(res.data) ? res.data : [];
  render();
}

function openRecommendation(row) {
  if (!row?.can_recommend) return;
  openForm({
    title: "توصية نتيجة المقرر",
    intro: `${row.student_name || "الطالب"} — ${row.course_code || "—"}. تُسجَّل توصيتك للقراءة فقط، والقرار النهائي بيد المالك.`,
    fields: [
      {
        name: "recommendation",
        label: "التوصية",
        type: "select",
        required: true,
        value: row.teacher_recommendation || "pass",
        options: [
          { value: "pass", label: "نجاح" },
          { value: "fail", label: "رسوب" },
        ],
      },
    ],
    submitLabel: "تسجيل التوصية",
    onSubmit: async (values) => {
      const res = await call("teacher_record_result_recommendation", { p_result_id: row.id, p_recommendation: values.recommendation });
      if (!res.ok) return { ok: false, error: res.error };
      await load();
      return { ok: true, message: "تم تسجيل التوصية" };
    },
  });
}

boot({
  portal: "teacher",
  title: "توصيات نتائج المقررات",
  render: async ({ content }) => {
    $("#trLoadBtn").addEventListener("click", load);
    $("#trRefreshBtn").addEventListener("click", load);
    $("#trTerm").addEventListener("change", render);
    content.addEventListener("click", (event) => {
      const button = event.target.closest("[data-recommend]");
      if (!button) return;
      openRecommendation(results.find((result) => String(result.id) === button.dataset.recommend));
    });
    await load();
  },
});

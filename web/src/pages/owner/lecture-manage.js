import { boot } from "../../lib/portal.js";
import { supabase } from "../../lib/supabase.js";
import { call } from "../../lib/api.js";
import { esc, fmtDateTime, fmtNum } from "../../lib/fmt.js";
import { icon } from "../../lib/icons.js";
import { p } from "../../lib/base.js";

const $ = (id) => document.getElementById(id);

const LECTURE_TYPE = {
  direct: "مباشر",
  online: "أونلاين",
  recorded: "مسجل",
};

const BROADCAST_MODE = {
  internal: "على المنصة",
  youtube: "YouTube",
  meet: "Google Meet",
};

const BROADCAST_MEDIA = {
  audio: "صوت",
  video: "صوت وصورة",
  both: "صوت وصورة (كامل)",
};

function typeLabel(value) {
  const key = String(value || "");
  return LECTURE_TYPE[key] || (key ? esc(key) : "محاضرة");
}

function broadcastLabel(value, map) {
  const key = String(value || "");
  if (!key) return "—";
  return esc(map[key] || key);
}

function textOrDash(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return text.trim() ? text : "—";
}

function detailRow(label, value) {
  return `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
}

function renderDetails(lecture, course) {
  const rows = [
    detailRow("العنوان", textOrDash(lecture.title)),
    detailRow("المقرر", course ? `${esc(course.code || "")} — ${esc(course.title || "")}`.trim() || "—" : "—"),
    detailRow("النوع", typeLabel(lecture.lecture_type)),
    detailRow("الحالة", textOrDash(lecture.status)),
    detailRow("موعد البث", lecture.scheduled_at ? fmtDateTime(lecture.scheduled_at) : "—"),
    detailRow("المدة", `${fmtNum(Number(lecture.duration_min) || 0)} دقيقة`),
    detailRow("وضع البث", broadcastLabel(lecture.broadcast_mode, BROADCAST_MODE)),
    detailRow("وسائط البث", broadcastLabel(lecture.broadcast_media, BROADCAST_MEDIA)),
    detailRow("رابط YouTube", textOrDash(lecture.youtube_url)),
    detailRow("رابط Live", textOrDash(lecture.live_url)),
    detailRow("ملاحظة التسجيل", textOrDash(lecture.recording_note)),
    detailRow("الوصف", textOrDash(lecture.description)),
  ];
  $("olmDetail").innerHTML = `<dl>${rows.join("")}</dl>`;
}

async function loadLecture(id) {
  const { data: lecture, error } = await supabase
    .from("lectures_public")
    .select("id, course_id, title, description, youtube_url, live_url, scheduled_at, duration_min, lecture_type, recording_note, status, created_at, broadcast_mode, broadcast_media")
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!lecture) return { ok: false, error: "not_found" };
  const { data: course } = await supabase
    .from("courses")
    .select("id, title, code, teacher_id, color")
    .eq("id", lecture.course_id)
    .maybeSingle();
  return { ok: true, data: { lecture, course } };
}

function renderMissing(message) {
  $("olmDetailPanel").hidden = true;
  $("olmDeletePanel").hidden = true;
  $("olmDetail").innerHTML = `<div class="od-empty" role="status"><span class="od-empty-icon">${icon("lectures")}</span><h3>لا توجد بيانات</h3><p>${esc(message || "تعذّر تحميل هذه المحاضرة.")}</p></div>`;
}

function setButton(btn, state) {
  btn.classList.toggle("is-loading", state);
  btn.disabled = state;
}

async function deleteLecture() {
  const id = Number($("olmLectureId").value);
  const btn = $("olmDeleteBtn");
  const msg = $("olmDeleteMsg");
  const lecture = await loadLecture(id);
  if (!lecture.ok) {
    if (msg) {
      msg.hidden = false;
      msg.textContent = lecture.error === "not_found" ? "تعذّر تحميل المحاضرة قبل الحذف." : (lecture.error || "تعذّر الحذف.");
      msg.className = "od-inline-msg is-error";
    }
    return;
  }
  const title = String(lecture.data.lecture.title || "");
  if (!confirm(`حذف المحاضرة «${title}» نهائياً؟\n\nسيُحذف السجل والحضور والأسئلة المرتبطة بها. لا يمكن التراجع عن هذا الإجراء.`)) return;
  setButton(btn, true);
  const res = await call("management_delete_lecture", { p_lecture_id: id });
  setButton(btn, false);
  if (!res?.ok) {
    if (msg) {
      msg.hidden = false;
      msg.textContent = res?.error || "فشل الحذف.";
      msg.className = "od-inline-msg is-error";
    }
    return;
  }
  location.assign(p("pages/owner/lectures.html"));
}

boot({
  portal: "owner",
  title: "إدارة المحاضرة",
  render: async () => {
    $("olmCancelBtn")?.addEventListener("click", () => { $("olmDeletePanel").hidden = true; });
    $("olmDeleteBtn")?.addEventListener("click", deleteLecture);
    $("olmDeletePanel").hidden = true;
    $("olmDetailPanel").hidden = true;
    const id = Number(new URLSearchParams(location.search).get("id") || 0);
    $("olmLectureId").value = String(id);
    if (!id) {
      renderMissing("لم يتم تحديد المحاضرة.");
      return;
    }
    const result = await loadLecture(id);
    if (!result.ok) {
      renderMissing(result.error === "not_found" ? "تعذّر تحميل تفاصيل هذه المحاضرة." : (result.error || "تعذّر تحميل المحاضرة."));
      return;
    }
    renderDetails(result.data.lecture, result.data.course);
    $("olmDetailPanel").hidden = false;
  },
});

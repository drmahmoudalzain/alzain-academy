import { boot } from "../../lib/portal.js";
import { call } from "../../lib/api.js";
import { esc, fmtNum, fmtDateTime, rel } from "../../lib/fmt.js";
import { icon } from "../../lib/icons.js";
import { p } from "../../lib/base.js";

const LECTURE_TYPE = {
  direct: "مباشر",
  online: "أونلاين",
  recorded: "مسجل",
};

const ERROR_TEXT = {
  lecture_not_found: "لم نعثر على هذه المحاضرة.",
  wrong_code: "رمز الحضور غير صحيح. تحقق من الرمز الذي يعطيك المدرّس.",
  attendance_not_open: "التحضير غير مفتوح لهذه المحاضرة حالياً.",
  code_required: "أدخل رمز الحضور قبل الإرسال.",
  already_attended: "تم تسجيل حضورك في هذه المحاضرة مسبقاً.",
  attendance_closed: "انتهت فترة تسجيل الحضور لهذه المحاضرة.",
};

let contentEl = null;
let S = null;

const lectureId = new URLSearchParams(location.search).get("id");

/* ------------------------------------------------------------------ */
/* أدوات مساعدة                                                        */
/* ------------------------------------------------------------------ */

function errorOf(res, fallback) {
  const key = String(res?.code || res?.error || "");
  const known = ERROR_TEXT[key];
  if (known) return known;
  const raw = res?.error ? String(res.error) : "";
  return raw ? `${fallback} (${raw})` : fallback;
}

function typeLabel(value) {
  const key = String(value || "");
  return LECTURE_TYPE[key] || (key ? esc(key) : "محاضرة");
}

function attendanceLabel(l) {
  if (l?.attended) return "تم الحضور";
  if (l?.attendance_open) return "التحضير مفتوح";
  return "لم يُسجّل الحضور";
}

// نعرض فقط الروابط الآمنة؛ لا نثق في محتوى RPC كرابط قابل للتنفيذ.
function safeUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(String(value));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function formatSize(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "—";
  const units = ["بايت", "كيلوبايت", "ميجابايت", "جيجابايت"];
  let i = 0;
  let size = n;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i += 1;
  }
  const number = i === 0 ? String(Math.round(size)) : size.toFixed(1);
  return `${fmtNum(number)} ${units[i]}`;
}

function optionsOf(q) {
  const list = Array.isArray(q?.options) ? q.options : [];
  return list.map((item) => {
    if (item && typeof item === "object") {
      const value = item.text ?? item.label ?? item.value ?? item.name;
      return value == null ? "" : String(value);
    }
    return item == null ? "" : String(item);
  });
}

function answerText(q, answer) {
  if (!answer) return "لم تجب بعد عن هذا السؤال.";
  const opts = optionsOf(q);
  if (q.type === "multi") {
    const indices = Array.isArray(answer.choice_indices) ? answer.choice_indices.map((v) => Number(v)) : [];
    if (!indices.length) return "لم تختر إجابة بعد.";
    return indices.map((i) => opts[i] || "—").join("، ");
  }
  if (q.type === "essay") {
    const text = answer.text == null ? "" : String(answer.text).trim();
    return text || "لم تكتب إجابة بعد.";
  }
  const index = Number(answer.choice_index);
  return Number.isInteger(index) ? opts[index] || "—" : "لم تختر إجابة بعد.";
}

/* ------------------------------------------------------------------ */
/* قوالب العرض                                                         */
/* ------------------------------------------------------------------ */

function showSkeleton() {
  contentEl.innerHTML = `
    <div class="lec-skel" role="status" aria-busy="true">
      <div class="lec-skel__block"></div>
      <div class="lec-skel__block"></div>
      <div class="lec-skel__block"></div>
      <div class="lec-state">جارٍ تحميل المحاضرة…</div>
    </div>`;
}

function stateHtml({ title, text, role = "alert", retry = true, back = true }) {
  const buttons = [
    retry ? `<button type="button" data-action="retry">${icon("refresh")} إعادة المحاولة</button>` : "",
    back ? `<a href="${p("pages/student/lectures.html")}">العودة إلى المحاضرات</a>` : "",
  ].join("");
  return `<div class="lec-state" role="${role}">
    <h3>${esc(title)}</h3><p>${esc(text)}</p><div class="lec-state__actions">${buttons}</div>
  </div>`;
}

function cardHtml(iconName, title, meta, body, wide = false) {
  return `<section class="lec-card ${wide ? "lec-card--wide" : ""}">
    <div class="lec-card__head">
      <span class="lec-card__icon">${icon(iconName)}</span>
      <h2>${esc(title)}</h2>
      ${meta ? `<span>${esc(meta)}</span>` : ""}
    </div>
    ${body}
  </section>`;
}

function heroHtml() {
  const l = S.lecture;
  const meta = [
    l.teacher ? `<div class="lec-meta__item">${icon("user")}<div><span>المدرّس</span><strong>${esc(l.teacher)}</strong></div></div>` : "",
    l.scheduled_at ? `<div class="lec-meta__item">${icon("calendar")}<div><span>الموعد</span><strong>${esc(fmtDateTime(l.scheduled_at))}${l.scheduled_at ? ` · ${esc(rel(l.scheduled_at))}` : ""}</strong></div></div>` : "",
    l.duration_min != null ? `<div class="lec-meta__item">${icon("clock")}<div><span>المدة</span><strong>${fmtNum(l.duration_min)} دقيقة</strong></div></div>` : "",
    l.presence_seconds > 0 ? `<div class="lec-meta__item">${icon("check")}<div><span>مدة حضورك</span><strong>${fmtNum(Math.round(l.presence_seconds / 60))} دقيقة</strong></div></div>` : "",
  ].filter(Boolean).join("");

  return `<header class="lec-hero">
    <div class="lec-hero__top">
      <button type="button" class="lec-back" data-action="back" aria-label="العودة إلى قائمة المحاضرات">${icon("chevron")}</button>
      <div class="lec-badges">
        <span class="lec-badge lec-badge--gold">${icon("book")} ${esc(l.course_code || l.course_title || "محاضرة")}</span>
        <span class="lec-badge">${icon("video")} ${esc(typeLabel(l.lecture_type))}</span>
        <span class="lec-badge ${l.attendance_open ? "lec-badge--live" : "lec-badge--soft"}" data-role="attendance-badge">
          ${icon(l.attended ? "check" : "clock")} ${esc(attendanceLabel(l))}
        </span>
      </div>
    </div>
    <h1>${esc(l.title || "محاضرة")}</h1>
    ${l.course_title ? `<p class="lec-hero__course">${esc(l.course_title)}</p>` : ""}
    <div class="lec-meta">${meta}</div>
  </header>`;
}

function mediaHtml() {
  const l = S.lecture;
  const live = l.attendance_open ? safeUrl(l.live_url) : "";
  const youtube = safeUrl(l.youtube_url);
  const links = [
    live ? `<a class="lec-link lec-link--live" href="${esc(live)}" target="_blank" rel="noopener noreferrer">
      ${icon("video")}<div><strong>الدبث المباشر</strong><span>افتح البث في نافذة جديدة</span></div>${icon("arrow")}
    </a>` : "",
    youtube ? `<a class="lec-link" href="${esc(youtube)}" target="_blank" rel="noopener noreferrer">
      ${icon("link")}<div><strong>رابط المحاضرة على يوتيوب</strong><span>افتح الرابط في نافذة جديدة</span></div>${icon("arrow")}
    </a>` : "",
  ].join("");
  const note = l.recording_note ? `<div class="lec-note">${icon("clock")}<span>${esc(l.recording_note)}</span></div>` : "";
  const body = links || note
    ? `${links}${note}`
    : `<p class="lec-empty" role="status">لا توجد روابط بث أو ملاحظة تسجيل متاحة لهذه المحاضرة حالياً.</p>`;
  return cardHtml("video", "البث والمصادر", "", body, true);
}

function filesHtml() {
  const files = Array.isArray(S.files) ? S.files : [];
  const body = files.length
    ? `<ul class="lec-files">${files.map((f) => {
        const name = f.name || f.filename || "ملف بدون اسم";
        const ext = String(f.filename || name).split(".").pop().slice(0, 5);
        return `<li class="lec-file">
          <span class="lec-file__icon">${icon("file")}</span>
          <div><strong>${esc(name)}</strong><span>${f.kind ? `${esc(f.kind)} · ` : ""}${f.mime ? `${esc(f.mime)} · ` : ""}${esc(ext)}</span></div>
          <span class="lec-file__size">${esc(formatSize(f.size))}</span>
        </li>`;
      }).join("")}</ul>
      <div class="lec-note">${icon("file")}<span>الملفات مرفقة بالمحاضرة؛ لا يتوفر رابط تنزيل مباشر حالياً. راجع المدرّس للحصول عليها.</span></div>`
    : `<p class="lec-empty" role="status">لا توجد ملفات مرفقة بهذه المحاضرة.</p>`;
  return cardHtml("paper", "ملفات المحاضرة", fmtNum(files.length), body);
}

function questionsHtml() {
  const questions = Array.isArray(S.questions) ? S.questions : [];
  const body = questions.length
    ? `<div class="lec-questions">${questions.map((q) => {
        const answer = q.my_answer || null;
        const pending = !answer;
        return `<details class="lec-q">
          <summary>
            <span class="lec-q__text">${esc(q.text || "")}</span>
            <span class="lec-q__tag ${pending ? "lec-q__tag--pending" : ""}">${pending ? "لم تجب" : "إجابتك"}</span>
          </summary>
          <div class="lec-q__body">
            <span class="lec-q__label">${pending ? "حالتك" : "إجابتك المسجلة"}</span>
            <p class="lec-q__answer">${esc(answerText(q, answer))}</p>
          </div>
        </details>`;
      }).join("")}</div>`
    : `<p class="lec-empty" role="status">لا توجد أسئلة مطروحة في هذه المحاضرة.</p>`;
  return cardHtml("forum", "أسئلة المحاضرة", fmtNum(questions.length), body);
}

function attendanceHtml() {
  const l = S.lecture;
  let body = "";
  if (l.attended) {
    body = `<p class="lec-success" role="status">${icon("check")} تم تسجيل حضورك في هذه المحاضرة.</p>`;
  } else if (l.attendance_open) {
    body = `<div class="lec-attend" id="lec-attendance-body">
      <div class="lec-field">
        <label for="lec-code">رمز الحضور</label>
        <input type="text" id="lec-code" name="code" inputmode="numeric" autocomplete="off" placeholder="أدخل الرمز الذي يشاركه المدرّس">
      </div>
      <div class="lec-attend__actions">
        <button type="button" class="lec-attend__button" data-action="attend">${icon("check")} تسجيل الحضور</button>
        <p class="lec-status" id="lec-status" role="status" aria-live="polite"></p>
      </div>
    </div>`;
  } else {
    body = `<p class="lec-empty" role="status">التحضير غير مفتوح لهذه المحاضرة حالياً.</p>`;
  }
  return cardHtml("key", "تسجيل الحضور", "", body, true);
}

function relatedHtml() {
  const related = Array.isArray(S.related) ? S.related : [];
  const body = related.length
    ? `<div class="lec-related">${related.map((r) => `<a class="lec-related__item" href="${p("pages/student/lecture.html")}?id=${encodeURIComponent(r.id)}">
        ${icon("lectures")}
        <div><strong>${esc(r.title || "محاضرة")}</strong><span>${r.scheduled_at ? `${esc(fmtDateTime(r.scheduled_at))} · ` : ""}${esc(typeLabel(r.lecture_type))}${r.course_title ? ` · ${esc(r.course_title)}` : ""}</span></div>
        ${icon("chevron")}
      </a>`).join("")}</div>`
    : `<p class="lec-empty" role="status">لا توجد محاضرات أخرى مرتبطة بهذه المحاضرة.</p>`;
  return cardHtml("library", "محاضرات ذات صلة", fmtNum(related.length), body, true);
}

function render() {
  contentEl.innerHTML = `<div class="lec-page">
    ${heroHtml()}
    ${S.lecture.description ? cardHtml("book", "وصف المحاضرة", "", `<p class="lec-text">${esc(S.lecture.description)}</p>`) : ""}
    ${mediaHtml()}
    ${filesHtml()}
    ${questionsHtml()}
    ${attendanceHtml()}
    ${relatedHtml()}
  </div>`;
}

/* ------------------------------------------------------------------ */
/* تسجيل الحضور                                                        */
/* ------------------------------------------------------------------ */

async function attend() {
  const input = contentEl.querySelector("#lec-code");
  const status = contentEl.querySelector("#lec-status");
  const btn = contentEl.querySelector('[data-action="attend"]');
  if (!input || !btn || !S) return;
  const code = input.value.trim();
  if (!code) {
    if (status) {
      status.textContent = "أدخل رمز الحضور أولاً.";
      status.className = "lec-status lec-status--error";
    }
    input.focus();
    return;
  }

  btn.disabled = true;
  input.disabled = true;
  if (status) {
    status.textContent = "جارٍ التحقق من الرمز…";
    status.className = "lec-status";
  }

  try {
    const res = await call("student_lecture_attendance", { p_lecture_id: lectureId, p_code: code });
    if (!res.ok) throw new Error(errorOf(res, "تعذّر تسجيل الحضور. حاول مرة أخرى."));
    S.lecture.attended = true;
    S.lecture.attendance_open = false;
    const body = contentEl.querySelector("#lec-attendance-body");
    if (body) body.innerHTML = `<p class="lec-success" role="status">${icon("check")} تم تسجيل حضورك في هذه المحاضرة.</p>`;
    const badge = contentEl.querySelector('[data-role="attendance-badge"]');
    if (badge) {
      badge.className = "lec-badge lec-badge--live";
      badge.innerHTML = `${icon("check")} تم الحضور`;
    }
  } catch (err) {
    if (status) {
      status.textContent = String(err?.message || err);
      status.className = "lec-status lec-status--error";
    }
    btn.disabled = false;
    input.disabled = false;
    input.focus();
  }
}

/* ------------------------------------------------------------------ */
/* الأحداث والتحميل                                                    */
/* ------------------------------------------------------------------ */

async function onClick(event) {
  const btn = event.target.closest("[data-action]");
  if (!btn || !contentEl.contains(btn)) return;
  if (btn.dataset.action === "retry") {
    await load();
  } else if (btn.dataset.action === "back") {
    location.href = p("pages/student/lectures.html");
  } else if (btn.dataset.action === "attend") {
    await attend();
  }
}

function onKeydown(event) {
  if (event.key === "Enter" && event.target?.id === "lec-code") {
    event.preventDefault();
    void attend();
  }
}

async function load() {
  S = null;
  showSkeleton();

  if (!lectureId) {
    contentEl.innerHTML = stateHtml({
      title: "لم يتم تحديد المحاضرة",
      text: "افتح المحاضرة من جدول المحاضرات لعرض تفاصيلها.",
      retry: false,
    });
    return;
  }

  const res = await call("student_lecture_detail", { p_lecture_id: lectureId });
  if (!res.ok) {
    contentEl.innerHTML = stateHtml({
      title: "تعذّر تحميل المحاضرة",
      text: errorOf(res, "تعذّر تحميل تفاصيل المحاضرة. حاول مرة أخرى."),
    });
    return;
  }

  const data = res.data || {};
  if (!data.lecture) {
    contentEl.innerHTML = stateHtml({
      title: "لا توجد بيانات لهذه المحاضرة",
      text: "قد تكون المحاضرة حُذفت أو لم تعد متاحة لك. راجع جدول المحاضرات.",
      role: "status",
      retry: false,
    });
    return;
  }

  S = {
    lecture: data.lecture,
    files: Array.isArray(data.files) ? data.files : [],
    questions: Array.isArray(data.questions) ? data.questions : [],
    related: Array.isArray(data.related) ? data.related : [],
  };
  render();
}

boot("student", "تفاصيل المحاضرة", async ({ profile, content }) => {
  void profile;
  contentEl = content;
  contentEl.addEventListener("click", onClick);
  contentEl.addEventListener("keydown", onKeydown);
  await load();
});

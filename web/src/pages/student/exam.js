import { boot } from "../../lib/portal.js";
import { call } from "../../lib/api.js";
import { esc, fmtNum, fmtPoints, fmtDateTime, rel } from "../../lib/fmt.js";
import { icon } from "../../lib/icons.js";
import { p } from "../../lib/base.js";
import { parseReviewFlags, serializeReviewFlags, toggleReviewFlag } from "../../lib/exam-review.js";

const TYPE_LABEL = {
  mcq: "اختيار واحد",
  multi: "اختيار متعدد",
  truefalse: "صح أو خطأ",
  essay: "إجابة نصية",
};

const ERROR_TEXT = {
  exam_not_started: "لم يبدأ وقت الاختبار بعد. عُد في الموعد المحدد.",
  exam_closed: "انتهى وقت الاختبار أو أُغلق. لا يمكن متابعة الإجابة.",
  exam_not_found: "لم نعثر على هذا الاختبار.",
  attempt_not_found: "لم نعثر على محاولة الاختبار. عُد إلى قائمة الاختبارات.",
  already_submitted: "تم تسليم هذا الاختبار مسبقاً.",
  question_not_found: "أحد الأسئلة لم يعد متاحاً. حدّث الصفحة.",
  invalid_answer: "الإجابة غير صالحة. حاول مرة أخرى.",
  code_required: "أدخل رمز الحضور.",
  wrong_code: "الرمز غير صحيح.",
  attendance_not_open: "التحضير غير مفتوح حالياً.",
};

const SAVE_DELAY = 600;
const MAX_TEXT = 5000;

let contentEl = null;
let S = null;
let clockId = null;
let observer = null;

const examId = new URLSearchParams(location.search).get("id");

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

function qid(q) {
  return String(q?.id ?? "");
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

function readAnswer(q) {
  const a = q?.my_answer && typeof q.my_answer === "object" ? q.my_answer : {};
  const rawIndex = a.choice_index;
  const choiceIndex =
    rawIndex !== null && rawIndex !== undefined && rawIndex !== "" && Number.isFinite(Number(rawIndex))
      ? Number(rawIndex)
      : null;
  const choiceIndices = Array.isArray(a.choice_indices)
    ? a.choice_indices.map((v) => Number(v)).filter((v) => Number.isInteger(v))
    : [];
  return {
    choice_index: choiceIndex,
    choice_indices: choiceIndices,
    text: a.text == null ? "" : String(a.text),
  };
}

function isAnswered(q, a) {
  if (!a || !q) return false;
  if (q.type === "essay") return a.text.trim().length > 0;
  if (q.type === "multi") return a.choice_indices.length > 0;
  return a.choice_index !== null;
}

function answeredCount() {
  if (!S) return 0;
  return S.questions.filter((q) => isAnswered(q, S.answers[qid(q)])).length;
}

function startKey() {
  return `tk-start:${S?.attemptId || examId || "unknown"}`;
}

function reviewStorageKey(attemptId = S?.attemptId) {
  return `tk-review:${attemptId || examId || "unknown"}`;
}

function readStoredReviewFlags(attemptId, validQuestionIds) {
  try {
    return parseReviewFlags(sessionStorage.getItem(reviewStorageKey(attemptId)), validQuestionIds);
  } catch {
    return new Set();
  }
}

function saveReviewFlags() {
  if (!S) return;
  try {
    sessionStorage.setItem(reviewStorageKey(), serializeReviewFlags(S.reviewFlags));
  } catch {
    /* Review markers remain available for the current page even if storage is blocked. */
  }
}

function findQuestion(id) {
  return S?.questions.find((q) => qid(q) === id) || null;
}

function cardOf(id) {
  return Array.from(contentEl?.querySelectorAll(".tk-q") || []).find((el) => el.dataset.qid === id) || null;
}

function chipOf(index) {
  return contentEl?.querySelector(`.tk-chip[data-index="${index}"]`) || null;
}

function reviewAccessibleLabel(question, index, answered, flagged) {
  const state = [answered ? "تمت الإجابة" : "لم تتم الإجابة"];
  if (flagged) state.push("معلّم للمراجعة");
  return `السؤال ${fmtNum(index + 1)}، ${state.join("، ")}`;
}

function updateReviewUI(id) {
  if (!S) return;
  const question = findQuestion(id);
  const index = S.questions.findIndex((item) => qid(item) === id);
  if (!question || index < 0) return;

  const flagged = S.reviewFlags.has(id);
  const answered = isAnswered(question, S.answers[id]);
  const card = cardOf(id);
  const chip = chipOf(index);
  card?.classList.toggle("is-flagged", flagged);
  chip?.classList.toggle("is-flagged", flagged);
  chip?.setAttribute("aria-label", `الانتقال إلى ${reviewAccessibleLabel(question, index, answered, flagged)}`);

  const button = card?.querySelector('[data-action="toggle-review"]');
  if (button) {
    button.setAttribute("aria-pressed", String(flagged));
    button.setAttribute("aria-label", flagged
      ? `إزالة علامة المراجعة عن السؤال ${fmtNum(index + 1)}`
      : `تعليم السؤال ${fmtNum(index + 1)} للمراجعة`);
    const label = button.querySelector(".tk-review-toggle__label");
    if (label) label.textContent = flagged ? "معلّم للمراجعة" : "علّم للمراجعة";
  }
}

/* ------------------------------------------------------------------ */
/* قوالب العرض                                                         */
/* ------------------------------------------------------------------ */

function showSkeleton() {
  contentEl.innerHTML = `
    <div class="tk-skel" role="status" aria-busy="true">
      <div class="tk-skel__card"></div>
      <div class="tk-skel__card"></div>
      <div class="tk-skel__card"></div>
      <div class="tk-state">جارٍ تحميل الاختبار…</div>
    </div>`;
}

function stateHtml({ title, text, role = "alert", retry = true, back = true }) {
  const buttons = [
    retry ? `<button type="button" data-action="retry">${icon("refresh")} إعادة المحاولة</button>` : "",
    back ? `<a href="${p("pages/student/exams.html")}">العودة إلى الاختبارات</a>` : "",
  ].join("");
  return `<div class="tk-state" role="${role}">
    <h3>${esc(title)}</h3><p>${esc(text)}</p><div class="tk-footer">${buttons}</div>
  </div>`;
}

function introHtml() {
  const e = S.exam || {};
  const meta = [
    e.starts_at ? `<span>${icon("calendar")} يبدأ ${esc(fmtDateTime(e.starts_at))}</span>` : "",
    e.ends_at ? `<span>${icon("clock")} ينتهي ${esc(fmtDateTime(e.ends_at))} · ${esc(rel(e.ends_at))}</span>` : "",
    e.questions_count != null ? `<span>${icon("exams")} ${fmtNum(e.questions_count)} سؤال</span>` : "",
    e.total_points != null ? `<span>${icon("star")} ${fmtPoints(e.total_points)} نقطة</span>` : "",
  ].filter(Boolean).join("");
  return `<section class="tk-intro">
    <h2>${esc(e.title || "اختبار")}</h2>
    ${e.description ? `<p>${esc(e.description)}</p>` : ""}
    <div class="tk-intro__meta">${meta}</div>
    <p class="tk-intro__note">تُحفظ إجاباتك تلقائياً. لا تغلق الصفحة قبل تسليم الاختبار.</p>
  </section>`;
}

function questionHtml(q, index) {
  const id = qid(q);
  const type = String(q.type || "");
  const a = S.answers[id];
  const flagged = S.reviewFlags.has(id);
  const opts = optionsOf(q);
  let body = "";

  if (type === "essay") {
    body = `<label class="tk-label" for="tk-text-${esc(id)}">اكتب إجابتك (حد أقصى ${fmtNum(MAX_TEXT)} حرف)</label>
      <textarea class="tk-text" id="tk-text-${esc(id)}" data-field="text" data-qid="${esc(id)}"
        rows="5" maxlength="${MAX_TEXT}">${esc(a.text)}</textarea>
      <span class="tk-count" data-count="${esc(id)}">${fmtNum(a.text.length)} / ${fmtNum(MAX_TEXT)}</span>`;
  } else if (opts.length) {
    const multi = type === "multi";
    body = `<div class="tk-choices">${opts.map((text, i) => {
      const checked = multi ? a.choice_indices.includes(i) : a.choice_index === i;
      return `<label class="tk-choice ${multi ? "tk-choice--multi" : ""}">
        <input type="${multi ? "checkbox" : "radio"}" name="tk-q-${esc(id)}" value="${i}"
          data-field="choice" data-qid="${esc(id)}" ${checked ? "checked" : ""}>
        <span class="tk-choice__mark"></span>
        <span class="tk-choice__text">${esc(text || "خيار بدون نص")}</span>
      </label>`;
    }).join("")}</div>`;
  } else {
    body = `<p class="tk-intro__note">لا توجد خيارات متاحة لهذا السؤال.</p>`;
  }

  return `<article class="tk-q ${isAnswered(q, a) ? "is-answered" : ""} ${index === S.current ? "is-current" : ""} ${flagged ? "is-flagged" : ""}"
      id="tk-q-${esc(id)}" data-qid="${esc(id)}" data-index="${index}">
    <div class="tk-q__head">
      <span class="tk-q__num">${fmtNum(index + 1)}</span>
      <div class="tk-q__heading">
        <span class="tk-q__type">${TYPE_LABEL[type] || esc(type || "سؤال")}</span>
        <h3 class="tk-q__prompt">${esc(q.text || "")}</h3>
      </div>
      <span class="tk-q__points">${fmtPoints(q.points)} نقطة</span>
    </div>
    ${body}
    <div class="tk-q__foot">
      <span>السؤال ${fmtNum(index + 1)} من ${fmtNum(S.questions.length)}</span>
      <span class="tk-q__saved" data-saved="${esc(id)}" ${S.saved.has(id) ? "" : "hidden"}>تم الحفظ</span>
      <button type="button" class="tk-review-toggle${flagged ? " is-flagged" : ""}" data-action="toggle-review" data-qid="${esc(id)}"
        aria-pressed="${flagged}" aria-label="${flagged ? `إزالة علامة المراجعة عن السؤال ${fmtNum(index + 1)}` : `تعليم السؤال ${fmtNum(index + 1)} للمراجعة}`}">
        <span class="tk-review-toggle__label">${flagged ? "معلّم للمراجعة" : "علّم للمراجعة"}</span>
      </button>
      <button type="button" class="tk-step tk-step--prev" data-action="prev" data-index="${index}" ${index === 0 ? "disabled" : ""} aria-label="السؤال السابق">${icon("chevron")} السابق</button>
      <button type="button" class="tk-step" data-action="next" data-index="${index}" ${index === S.questions.length - 1 ? "disabled" : ""} aria-label="السؤال التالي">التالي ${icon("chevron")}</button>
    </div>
  </article>`;
}

function navigatorHtml() {
  return `<aside class="tk-navigator" aria-label="مؤشر أسئلة الاختبار">
    <h3>أسئلة الاختبار</h3>
    <p id="tk-current-label">السؤال ${fmtNum(S.current + 1)} من ${fmtNum(S.questions.length)}</p>
    <div class="tk-navgrid">${S.questions.map((q, i) => {
      const id = qid(q);
      const answered = isAnswered(q, S.answers[id]);
      const flagged = S.reviewFlags.has(id);
      return `<button type="button" class="tk-chip ${answered ? "is-answered" : ""} ${i === S.current ? "is-current" : ""} ${flagged ? "is-flagged" : ""}"
        data-action="goto" data-index="${i}" aria-label="الانتقال إلى ${reviewAccessibleLabel(q, i, answered, flagged)}">${fmtNum(i + 1)}</button>`;
    }).join("")}</div>
  </aside>`;
}

function modalHtml() {
  return `<div class="tk-modal" id="tk-modal" hidden>
    <div class="tk-dialog" role="dialog" aria-modal="true" aria-labelledby="tk-modal-title">
      <div class="tk-dialog__icon">${icon("shield")}</div>
      <h3 id="tk-modal-title">تأكيد تسليم الاختبار</h3>
      <p id="tk-modal-counts"></p>
      <ul>
        <li>بعد التسليم لا يمكن تعديل الإجابات أو إعادة فتح الاختبار.</li>
        <li>ستظهر النتيجة في صفحة مستقلة فور توفرها.</li>
      </ul>
      <div class="tk-dialog__actions">
        <button type="button" class="tk-dialog__cancel" data-action="cancel-submit">العودة للإجابة</button>
        <button type="button" class="tk-dialog__confirm" data-action="confirm-submit">تأكيد التسليم</button>
      </div>
    </div>
  </div>`;
}

function renderExam() {
  contentEl.innerHTML = `
    <div class="tk-page">
      <header class="tk-head">
        <div class="tk-head__row">
          <button type="button" class="tk-back" data-action="back" aria-label="العودة إلى قائمة الاختبارات">${icon("chevron")}</button>
          <div class="tk-head__title">
            <strong>${esc(S.exam?.title || "اختبار")}</strong>
            <span>${esc(S.exam?.course_title || "")}${S.exam?.course_code ? ` · ${esc(S.exam.course_code)}` : ""}</span>
          </div>
          <div class="tk-head__stats">
            <span class="tk-timer" id="tk-timer" aria-live="polite" aria-atomic="true">${icon("clock")}<span id="tk-timer-value">—</span></span>
            <span class="tk-save" id="tk-save" aria-live="polite">${icon("check")}<span>جاهز</span></span>
            <button type="button" class="tk-submit" data-action="submit">تسليم الاختبار ${icon("check")}</button>
          </div>
        </div>
        <div class="tk-progress" aria-live="polite">
          <span id="tk-progress-text"></span>
          <div class="tk-progress__bar"><span class="tk-progress__fill" id="tk-progress-fill"></span></div>
        </div>
      </header>
      <div class="tk-alert" id="tk-alert" role="alert" hidden></div>
      <div class="tk-main">${introHtml()}${S.questions.map(questionHtml).join("")}</div>
      ${navigatorHtml()}
      <div class="tk-footer">
        <button type="button" class="tk-step" data-action="back">${icon("chevron")} العودة للاختبارات</button>
        <button type="button" class="tk-submit" data-action="submit">تسليم الاختبار ${icon("check")}</button>
      </div>
    </div>
    ${modalHtml()}`;

  updateProgress();
  startClock();
  observeCards();
}

/* ------------------------------------------------------------------ */
/* الحفظ والتقدم والعداد                                              */
/* ------------------------------------------------------------------ */

function setSaveStatus(kind, text) {
  const el = contentEl?.querySelector("#tk-save");
  if (!el) return;
  el.className = `tk-save tk-save--${kind}`;
  el.innerHTML = `${icon(kind === "error" ? "close" : kind === "pending" ? "clock" : "check")}<span>${esc(text)}</span>`;
}

function showAlert(text, retry = false) {
  const box = contentEl?.querySelector("#tk-alert");
  if (!box) return;
  box.hidden = false;
  box.innerHTML = `${icon("shield")}<span>${esc(text)}</span>${
    retry ? `<button type="button" data-action="retry-saves">إعادة المحاولة</button>` : ""
  }`;
}

function hideAlert() {
  const box = contentEl?.querySelector("#tk-alert");
  if (box) box.hidden = true;
}

function markPending(id) {
  const card = cardOf(id);
  const index = S.questions.findIndex((q) => qid(q) === id);
  const chip = index >= 0 ? chipOf(index) : null;
  card?.classList.add("is-pending");
  chip?.classList.add("is-pending");
}

function refreshCard(id) {
  const q = findQuestion(id);
  const card = cardOf(id);
  if (!q || !card) return;
  const done = isAnswered(q, S.answers[id]);
  const index = Number(card.dataset.index);
  const chip = chipOf(index);
  card.classList.toggle("is-answered", done);
  chip?.classList.toggle("is-answered", done);
  const saved = card.querySelector("[data-saved]");
  if (saved) saved.hidden = !S.saved.has(id);
  if (!S.timers.has(id) && !S.pending.has(id) && !S.failed.has(id)) {
    card.classList.remove("is-pending");
    chip?.classList.remove("is-pending");
  }
  updateReviewUI(id);
}

function updateProgress() {
  if (!S) return;
  const done = answeredCount();
  const total = S.questions.length;
  const text = contentEl?.querySelector("#tk-progress-text");
  const fill = contentEl?.querySelector("#tk-progress-fill");
  if (text) text.textContent = `أجبت عن ${fmtNum(done)} من ${fmtNum(total)} سؤال`;
  if (fill) fill.style.width = `${total ? Math.round((done / total) * 100) : 0}%`;
}

function updateGuard() {
  if (!S) return;
  S.dirty = S.timers.size > 0 || S.pending.size > 0 || S.failed.size > 0;
}

function queueSave(id) {
  if (!S || S.submitted) return;
  clearTimeout(S.timers.get(id));
  S.timers.delete(id);
  markPending(id);
  const q = findQuestion(id);
  if (q?.type === "essay") {
    S.timers.set(id, setTimeout(() => saveNow(id), SAVE_DELAY));
    setSaveStatus("pending", "سيُحفظ النص بعد توقفك عن الكتابة…");
  } else {
    void saveNow(id);
  }
  updateGuard();
}

async function saveNow(id) {
  if (!S || S.submitted) return;
  clearTimeout(S.timers.get(id));
  S.timers.delete(id);
  const q = findQuestion(id);
  if (!q) return;
  const a = S.answers[id];
  const params = { p_attempt_id: S.attemptId, p_question_id: q.id };
  let hasPayload = false;

  if (q.type === "multi") {
    params.p_choice_indices = [...a.choice_indices];
    hasPayload = true;
  } else if (q.type === "essay") {
    params.p_text = a.text;
    hasPayload = a.text.trim().length > 0;
  } else if (a.choice_index !== null) {
    params.p_choice_index = a.choice_index;
    hasPayload = true;
  }

  if (!hasPayload) {
    refreshCard(id);
    updateGuard();
    return;
  }

  S.pending.add(id);
  setSaveStatus("pending", "جارٍ حفظ الإجابة…");
  updateGuard();

  try {
    const res = await call("student_exam_save_answer", params);
    if (!res.ok) throw new Error(errorOf(res, "تعذّر حفظ الإجابة."));
    S.failed.delete(id);
    S.saved.add(id);
    setSaveStatus("done", "تم حفظ الإجابات");
    if (!S.failed.size) hideAlert();
  } catch (err) {
    S.failed.add(id);
    setSaveStatus("error", "تعذّر الحفظ");
    showAlert(String(err?.message || err), true);
  } finally {
    S.pending.delete(id);
    updateGuard();
    refreshCard(id);
  }
}

async function flushPending() {
  if (!S) return;
  const ids = [...new Set([...S.timers.keys(), ...S.pending, ...S.failed])];
  await Promise.all(ids.map((id) => saveNow(id)));
  updateGuard();
}

function startClock() {
  const el = contentEl?.querySelector("#tk-timer-value");
  if (!el) return;
  const minutes = Number(S.exam?.duration_min);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    el.textContent = "—";
    contentEl.querySelector("#tk-timer")?.setAttribute("title", "لم يتم تحديد مدة للاختبار في البيانات");
    return;
  }
  const now = Date.now();
  const serverStart = S.startedAt ? Date.parse(S.startedAt) : NaN;
  let started = Number.isFinite(serverStart) && serverStart > 0 && serverStart <= now ? serverStart : 0;
  if (!started) {
    try {
      started = Number(sessionStorage.getItem(startKey()));
    } catch {
      started = 0;
    }
  }
  if (!Number.isFinite(started) || started <= 0 || started > now) {
    started = now;
    try {
      sessionStorage.setItem(startKey(), String(started));
    } catch {
      /* التخزين قد يكون معطلاً؛ نستخدم وقت فتح الصفحة الحالي فقط */
    }
  }
  S.deadline = started + minutes * 60000;
  clockId = setInterval(updateClock, 1000);
  updateClock();
}

function updateClock() {
  const el = contentEl?.querySelector("#tk-timer-value");
  if (!el || !S?.deadline) return;
  const left = Math.max(0, S.deadline - Date.now());
  const hours = Math.floor(left / 3600000);
  const mins = Math.floor((left % 3600000) / 60000);
  const secs = Math.floor((left % 60000) / 1000);
  el.textContent = hours
    ? `${fmtNum(hours)}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${fmtNum(mins)}:${String(secs).padStart(2, "0")}`;

  const timer = contentEl.querySelector("#tk-timer");
  timer?.classList.toggle("tk-timer--warn", left <= 300000 && left > 60000);
  timer?.classList.toggle("tk-timer--danger", left <= 60000 && left > 0);

  if (left === 0 && !S.timeUp) {
    S.timeUp = true;
    clearInterval(clockId);
    showAlert("انتهى الوقت المحدد للاختبار. يمكنك التسليم الآن، وقد يرفض الخادم الإجابات المتأخرة.");
  }
}

function observeCards() {
  if (!("IntersectionObserver" in window)) return;
  observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setCurrent(Number(visible.target.dataset.index), false);
    },
    { rootMargin: "-180px 0px -55% 0px", threshold: [0, 0.25, 0.5] }
  );
  contentEl.querySelectorAll(".tk-q").forEach((card) => observer.observe(card));
}

function setCurrent(index, scroll) {
  if (!S || index < 0 || index >= S.questions.length) return;
  S.current = index;
  contentEl.querySelectorAll(".tk-q").forEach((card) => card.classList.toggle("is-current", Number(card.dataset.index) === index));
  S.questions.forEach((_, i) => chipOf(i)?.classList.toggle("is-current", i === index));
  const label = contentEl.querySelector("#tk-current-label");
  if (label) label.textContent = `السؤال ${fmtNum(index + 1)} من ${fmtNum(S.questions.length)}`;
  if (scroll) {
    const card = cardOf(qid(S.questions[index]));
    card?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/* ------------------------------------------------------------------ */
/* التسليم                                                             */
/* ------------------------------------------------------------------ */

function openModal() {
  const modal = contentEl.querySelector("#tk-modal");
  if (!modal) return;
  const done = answeredCount();
  const count = modal.querySelector("#tk-modal-counts");
  if (count) {
    count.textContent = `أجبت عن ${fmtNum(done)} من ${fmtNum(S.questions.length)} سؤال، ولم تجب عن ${fmtNum(S.questions.length - done)} سؤال.`;
  }
  modal.hidden = false;
  modal.querySelector('[data-action="cancel-submit"]')?.focus();
}

function closeModal() {
  const modal = contentEl.querySelector("#tk-modal");
  if (!modal) return;
  modal.hidden = true;
  contentEl.querySelector(".tk-submit")?.focus();
}

async function submitExam() {
  if (!S || S.submitting) return;
  S.submitting = true;
  const confirmBtn = contentEl.querySelector('[data-action="confirm-submit"]');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = "جارٍ التسليم…";
  }
  try {
    await flushPending();
    const res = await call("student_exam_submit", { p_attempt_id: S.attemptId });
    if (!res.ok) throw new Error(errorOf(res, "تعذّر تسليم الاختبار. حاول مرة أخرى."));
    S.submitted = true;
    try {
      sessionStorage.removeItem(startKey());
      sessionStorage.removeItem(reviewStorageKey());
    } catch {
      /* لا يؤثر فشل التخزين على التسليم */
    }
    const attempt = res.data?.attempt_id ?? S.attemptId;
    location.href = `${p("pages/student/exam-result.html")}?attempt=${encodeURIComponent(attempt)}`;
  } catch (err) {
    S.submitting = false;
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "تأكيد التسليم";
    }
    closeModal();
    showAlert(String(err?.message || err), false);
  }
}

/* ------------------------------------------------------------------ */
/* الأحداث والتحميل                                                    */
/* ------------------------------------------------------------------ */

async function onClick(event) {
  const btn = event.target.closest("[data-action]");
  if (!btn || !contentEl.contains(btn)) return;
  const action = btn.dataset.action;

  if (action === "retry") {
    await load();
    return;
  }
  if (action === "retry-saves") {
    await flushPending();
    return;
  }
  if (action === "back") {
    location.href = p("pages/student/exams.html");
    return;
  }
  if (!S) return;

  if (action === "toggle-review") {
    const id = String(btn.dataset.qid || "");
    if (!findQuestion(id)) return;
    S.reviewFlags = toggleReviewFlag(S.reviewFlags, id);
    saveReviewFlags();
    updateReviewUI(id);
  } else if (action === "goto") {
    setCurrent(Number(btn.dataset.index), true);
  } else if (action === "prev") {
    setCurrent(Number(btn.dataset.index) - 1, true);
  } else if (action === "next") {
    setCurrent(Number(btn.dataset.index) + 1, true);
  } else if (action === "submit") {
    openModal();
  } else if (action === "cancel-submit") {
    closeModal();
  } else if (action === "confirm-submit") {
    await submitExam();
  }
}

function onChange(event) {
  const input = event.target.closest('input[data-field="choice"]');
  if (!input || !S) return;
  const id = input.dataset.qid;
  const q = findQuestion(id);
  if (!q) return;
  const a = S.answers[id];
  const value = Number(input.value);

  if (q.type === "multi") {
    if (input.checked && !a.choice_indices.includes(value)) a.choice_indices.push(value);
    if (!input.checked) a.choice_indices = a.choice_indices.filter((v) => v !== value);
    a.choice_indices.sort((x, y) => x - y);
  } else {
    a.choice_index = value;
  }
  refreshCard(id);
  updateProgress();
  queueSave(id);
}

function onInput(event) {
  const area = event.target.closest('textarea[data-field="text"]');
  if (!area || !S) return;
  const id = area.dataset.qid;
  const a = S.answers[id];
  if (!a) return;
  a.text = area.value.slice(0, MAX_TEXT);
  const counter = contentEl.querySelector(`[data-count="${id}"]`);
  if (counter) counter.textContent = `${fmtNum(a.text.length)} / ${fmtNum(MAX_TEXT)}`;
  refreshCard(id);
  updateProgress();
  queueSave(id);
}

function onKeydown(event) {
  if (event.key === "Escape") {
    const modal = contentEl?.querySelector("#tk-modal");
    if (modal && !modal.hidden) closeModal();
  }
}

async function load() {
  if (clockId) clearInterval(clockId);
  clockId = null;
  observer?.disconnect();
  observer = null;
  S = null;
  showSkeleton();

  if (!examId) {
    contentEl.innerHTML = stateHtml({
      title: "لم يتم تحديد الاختبار",
      text: "افتح الاختبار من صفحة الاختبارات لبدء المحاولة.",
      retry: false,
    });
    return;
  }

  const res = await call("student_exam_take", { p_exam_id: examId });
  if (!res.ok) {
    contentEl.innerHTML = stateHtml({
      title: "تعذّر فتح الاختبار",
      text: errorOf(res, "تعذّر تحميل الاختبار. حاول مرة أخرى."),
    });
    return;
  }

  const data = res.data || {};
  const questions = Array.isArray(data.questions) ? data.questions : [];
  if (!data.attempt_id || !questions.length) {
    contentEl.innerHTML = stateHtml({
      title: "لا توجد أسئلة لعرضها",
      text: "هذا الاختبار لا يحتوي على أسئلة متاحة حالياً. راجع قائمة الاختبارات أو تواصل مع إدارة البوابة.",
      role: "status",
      retry: false,
    });
    return;
  }

  const answers = {};
  const saved = new Set();
  const reviewFlags = readStoredReviewFlags(data.attempt_id, questions.map(qid));
  questions.forEach((q) => {
    const id = qid(q);
    answers[id] = readAnswer(q);
    if (isAnswered(q, answers[id])) saved.add(id);
  });

  S = {
    attemptId: data.attempt_id,
    startedAt: data.attempt_started_at || null,
    exam: data.exam || {},
    questions,
    answers,
    saved,
    reviewFlags,
    timers: new Map(),
    pending: new Set(),
    failed: new Set(),
    current: 0,
    dirty: false,
    deadline: null,
    timeUp: false,
    submitting: false,
    submitted: false,
  };
  saveReviewFlags();
  renderExam();
}

boot("student", "أداء الاختبار", async ({ profile, content }) => {
  void profile;
  contentEl = content;
  contentEl.addEventListener("click", onClick);
  contentEl.addEventListener("change", onChange);
  contentEl.addEventListener("input", onInput);
  document.addEventListener("keydown", onKeydown);
  await load();
});

window.addEventListener("beforeunload", (event) => {
  if (!S || S.submitted || !S.dirty) return;
  event.preventDefault();
  event.returnValue = "";
});

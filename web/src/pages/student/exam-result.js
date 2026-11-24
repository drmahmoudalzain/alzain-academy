import { boot } from "../../lib/portal.js";
import { call } from "../../lib/api.js";
import { esc, fmtNum, fmtPoints, fmtDateTime, rel } from "../../lib/fmt.js";
import { icon } from "../../lib/icons.js";
import { p } from "../../lib/base.js";

const TYPE = { mcq: "اختيار من متعدد", multi: "متعدد الإجابات", truefalse: "صح / خطأ", essay: "مقالي" };
const LETTERS = ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح"];
const PANES = { review: "resPaneReview", breakdown: "resPaneBreakdown", info: "resPaneInfo" };

const $ = (id) => document.getElementById(id);
const attemptId = new URLSearchParams(location.search).get("attempt");
let pageHtml = "";
let toastTimer = null;
let el = {};

function initIcons(root) {
  root.querySelectorAll("[data-icon]").forEach((node) => {
    node.innerHTML = icon(node.dataset.icon);
  });
}

function refreshElements() {
  el = {
    page: $("resPage"),
    hero: $("resHero"),
    stats: $("resStats"),
    review: $("resReview"),
    reviewCount: $("resReviewCount"),
    breakdown: $("resBreakdown"),
    info: $("resInfo"),
    toast: $("resToast"),
  };
  const back = $("resBackLink");
  if (back) back.href = p("pages/student/exams.html");
}

function restorePage() {
  el.page.innerHTML = pageHtml;
  initIcons(el.page);
  refreshElements();
}

function notice({ title, text, retry = false, iconName = "file", tone = "status" }) {
  el.page.innerHTML = `<div class="res-empty" role="${tone}">
    <div class="res-empty-icon">${icon(iconName)}</div>
    <h2>${esc(title)}</h2>
    <p>${esc(text)}</p>
    ${retry ? '<div class="res-empty-actions"><button class="res-btn res-btn-secondary" type="button" data-retry>إعادة المحاولة</button></div>' : ""}
  </div>`;
}

function notify(message, tone = "success") {
  if (!el.toast) return;
  if (toastTimer) clearTimeout(toastTimer);
  el.toast.textContent = message;
  el.toast.className = `res-toast ${tone}`;
  el.toast.hidden = false;
  toastTimer = setTimeout(() => {
    el.toast.hidden = true;
  }, 3200);
}

function gradeOf(pct) {
  if (pct >= 90) return "ممتاز";
  if (pct >= 80) return "جيد جداً";
  if (pct >= 70) return "جيد";
  if (pct >= 50) return "مقبول";
  return "يحتاج تحسين";
}

const metaItem = (name, label, value) =>
  `<span class="res-meta-item">${icon(name)}<span>${esc(label)} <strong>${esc(value)}</strong></span></span>`;

function optionText(option) {
  if (typeof option === "string") return option;
  if (option && typeof option === "object") return option.text ?? option.label ?? "";
  return "";
}

function indicesOf(q, which) {
  if (q.type === "multi") {
    const raw = which === "mine" ? q.my_choice_indices : q.correct_indices;
    return Array.isArray(raw) ? raw : [];
  }
  const value = which === "mine" ? q.my_choice_index : q.correct_index;
  return value === null || value === undefined ? [] : [value];
}

function answersText(q, which) {
  const indexes = indicesOf(q, which)
    .map(Number)
    .filter((n) => Number.isFinite(n));
  if (!indexes.length) return which === "mine" ? "لم تُجب" : "—";
  const options = Array.isArray(q.options) ? q.options : [];
  return indexes
    .map((i) => {
      const text = optionText(options[i]);
      return text ? String(text) : `الخيار ${fmtNum(i + 1)}`;
    })
    .join("، ");
}

function questionState(q) {
  if (q.type === "essay") return q.earned === null || q.earned === undefined ? "pending" : "essay";
  const mine = indicesOf(q, "mine");
  const hasText = typeof q.my_text === "string" && q.my_text.trim() !== "";
  if (!mine.length && !hasText) return "unanswered";
  const correct = indicesOf(q, "correct");
  const same =
    correct.length > 0 &&
    mine.length === correct.length &&
    mine.every((v, i) => Number(v) === Number(correct[i]));
  return same ? "correct" : "wrong";
}

const STATE_META = {
  correct: { label: "صحيح", icon: "check" },
  wrong: { label: "خطأ", icon: "close" },
  unanswered: { label: "لم تُجب", icon: "details" },
  essay: { label: "صُحِّح يدوياً", icon: "edit" },
  pending: { label: "قيد التصحيح", icon: "clock" },
};

function optionsHtml(q) {
  const options = Array.isArray(q.options) ? q.options : [];
  if (!options.length || q.type === "essay") return "";
  const correct = new Set(indicesOf(q, "correct").map(Number));
  const mine = new Set(indicesOf(q, "mine").map(Number));
  return `<div class="res-options">${options
    .map((option, i) => {
      const isCorrect = correct.has(i);
      const isMine = mine.has(i);
      const cls = isCorrect ? "correct" : isMine ? "wrong" : "";
      const badges = `${isMine ? '<span class="res-option-badge">إجابتك</span>' : ""}${isCorrect ? '<span class="res-option-badge">الصحيحة</span>' : ""}`;
      return `<div class="res-option ${cls}">
        <span class="res-option-letter">${LETTERS[i] || fmtNum(i + 1)}</span>
        <span class="res-option-text">${esc(optionText(option) || "—")}</span>
        <span class="res-option-badges">${badges}</span>
      </div>`;
    })
    .join("")}</div>`;
}

function answersHtml(q, stateKey) {
  if (q.type === "essay") {
    return `<div class="res-answer-grid">
      <div class="res-answer-box">
        <span class="res-answer-label">${icon("paper")}إجابتك</span>
        <div class="res-answer-text res-essay">${esc(q.my_text || "لم تُجب")}</div>
      </div>
      <div class="res-answer-box correct">
        <span class="res-answer-label">${icon("check")}الإجابة الصحيحة</span>
        <div class="res-answer-text">لا توجد إجابة نموذجية متاحة لهذا السؤال المقالي.</div>
      </div>
    </div>`;
  }
  const myClass = stateKey === "wrong" ? "mine-wrong" : "mine";
  const correctAnswer = answersText(q, "correct");
  return `<div class="res-answer-grid">
    <div class="res-answer-box ${myClass}">
      <span class="res-answer-label">${icon("user")}إجابتك</span>
      <div class="res-answer-text">${esc(answersText(q, "mine"))}</div>
    </div>
    <div class="res-answer-box correct">
      <span class="res-answer-label">${icon("check")}الإجابة الصحيحة</span>
      <div class="res-answer-text">${esc(correctAnswer)}</div>
    </div>
  </div>`;
}

function questionHtml(q, index) {
  const key = questionState(q);
  const meta = STATE_META[key];
  const earned =
    q.earned === null || q.earned === undefined
      ? "بانتظار التصحيح"
      : `${fmtPoints(q.earned)} / ${fmtPoints(q.points)}`;
  return `<article class="res-q ${key} is-open">
    <button class="res-q-head" type="button" data-q-head aria-expanded="true" aria-controls="resQBody${index}">
      <span class="res-q-number">${fmtNum(index + 1)}</span>
      <span class="res-q-type ${esc(q.type || "")}">${esc(TYPE[q.type] || q.type || "سؤال")}</span>
      <span class="res-q-status ${key}">${icon(meta.icon)}${esc(meta.label)}</span>
      <span class="res-q-points">${icon("points")}${esc(earned)}</span>
      <span class="res-q-toggle">${icon("chevron")}</span>
    </button>
    <div class="res-q-body" id="resQBody${index}">
      <p class="res-q-question">${esc(q.text || "")}</p>
      ${optionsHtml(q)}
      ${answersHtml(q, key)}
      ${q.feedback ? `<div class="res-feedback">${icon("forum")}<div><strong>ملاحظة الأستاذ</strong><p>${esc(q.feedback)}</p></div></div>` : ""}
    </div>
  </article>`;
}

function render(data) {
  const attempt = data.attempt || {};
  const exam = data.exam || {};
  const stats = data.stats || {};
  const review = Array.isArray(data.review) ? data.review : [];

  const score = Number(attempt.score ?? 0);
  const total = Number(exam.total_points ?? 0);
  const pct = total > 0 ? Math.max(0, Math.min(100, (score / total) * 100)) : 0;
  const pending = Number(stats.essay_pending ?? 0);

  el.hero.innerHTML = `<div class="res-hero-info">
      <span class="res-status-badge ${pending > 0 ? "pending" : "done"}">${icon(pending > 0 ? "clock" : "check")}${pending > 0 ? "بانتظار تصحيح المقالي" : "تم التصحيح"}</span>
      <h2 class="res-hero-title">${esc(exam.title || "اختبار")}</h2>
      <div class="res-course"><span class="res-course-dot" aria-hidden="true"></span>${esc([exam.course_code, exam.course_title].filter(Boolean).join(" — ") || "—")}</div>
      <div class="res-meta">
        ${attempt.submitted_at ? metaItem("calendar", "سُلّم في", fmtDateTime(attempt.submitted_at)) : ""}
        ${attempt.started_at ? metaItem("clock", "بدأ في", fmtDateTime(attempt.started_at)) : ""}
        ${attempt.duration_used_min !== null && attempt.duration_used_min !== undefined ? metaItem("history", "المدة المستغرقة", `${fmtNum(attempt.duration_used_min)} دقيقة`) : ""}
        ${exam.teacher ? metaItem("user", "أستاذ المقرر", exam.teacher) : ""}
        ${attempt.submitted_at ? metaItem("send", "الوقت النسبي", rel(attempt.submitted_at)) : ""}
      </div>
    </div>
    <div class="res-score-card">
      <div class="res-score-circle" style="--res-pct:${pct.toFixed(1)}%" role="img" aria-label="الدرجة ${esc(fmtPoints(attempt.score))} من ${esc(fmtPoints(exam.total_points))}">
        <div class="res-score-inner">
          <span class="res-score-value">${esc(fmtPoints(attempt.score))}</span>
          <span class="res-score-total">من ${esc(fmtPoints(exam.total_points))}</span>
        </div>
      </div>
      <span class="res-grade">${icon("star")}${esc(gradeOf(pct))}</span>
      <span class="res-percent">${esc(fmtPoints(Math.round(pct * 10) / 10))}% من الدرجة الكلية</span>
    </div>`;

  const tiles = [
    { cls: "correct", icon: "check", label: "إجابات صحيحة", value: fmtNum(stats.correct ?? 0) },
    { cls: "wrong", icon: "close", label: "إجابات خاطئة", value: fmtNum(stats.wrong ?? 0) },
    { cls: "unanswered", icon: "details", label: "لم تُجب", value: fmtNum(stats.unanswered ?? 0) },
    { cls: "pending", icon: "edit", label: "مقالي قيد التصحيح", value: fmtNum(stats.essay_pending ?? 0) },
  ];
  el.stats.innerHTML = tiles
    .map(
      (t) => `<div class="res-stat ${t.cls}">
        <span class="res-stat-icon">${icon(t.icon)}</span>
        <span><span class="res-stat-label">${esc(t.label)}</span><span class="res-stat-value">${esc(t.value)}<small>سؤال</small></span></span>
      </div>`
    )
    .join("");

  el.reviewCount.textContent = fmtNum(review.length);
  el.review.innerHTML = review.length
    ? review.map(questionHtml).join("")
    : `<div class="res-empty" role="status">
        <div class="res-empty-icon">${icon("details")}</div>
        <h2>لا توجد أسئلة للمراجعة</h2>
        <p>لم تُرفق أسئلة مفصّلة مع هذه النتيجة.</p>
      </div>`;

  const rows = [
    { cls: "correct", label: "إجابات صحيحة", value: Number(stats.correct ?? 0) },
    { cls: "wrong", label: "إجابات خاطئة", value: Number(stats.wrong ?? 0) },
    { cls: "unanswered", label: "لم تُجب", value: Number(stats.unanswered ?? 0) },
    { cls: "pending", label: "مقالي قيد التصحيح", value: Number(stats.essay_pending ?? 0) },
  ];
  const answersCount = rows.reduce((sum, row) => sum + row.value, 0);
  el.breakdown.innerHTML = `<div class="res-card">
      <h3 class="res-card-title"><span>${icon("grades")}</span>توزيع الإجابات</h3>
      ${answersCount > 0 ? `<div class="res-breakdown">${rows
        .map((row) => {
          const width = Math.min(100, (row.value / answersCount) * 100);
          return `<div class="res-bar-row">
            <div class="res-bar-head"><span>${esc(row.label)}</span><strong>${fmtNum(row.value)}</strong></div>
            <div class="res-bar-track"><span class="res-bar-fill ${row.cls}" style="width:${width.toFixed(1)}%"></span></div>
          </div>`;
        })
        .join("")}</div>` : '<div class="res-empty" role="status"><p>لا توجد بيانات كافية لعرض التوزيع.</p></div>'}
    </div>`;

  const info = [
    ["عنوان الاختبار", exam.title || "—"],
    ["المقرر", [exam.course_code, exam.course_title].filter(Boolean).join(" — ") || "—"],
    ["أستاذ المقرر", exam.teacher || "—"],
    ["وقت البدء", attempt.started_at ? fmtDateTime(attempt.started_at) : "—"],
    ["وقت التسليم", attempt.submitted_at ? fmtDateTime(attempt.submitted_at) : "—"],
    ["المدة المقررة", exam.duration_min != null ? `${fmtNum(exam.duration_min)} دقيقة` : "—"],
    ["المدة المستغرقة", attempt.duration_used_min != null ? `${fmtNum(attempt.duration_used_min)} دقيقة` : "—"],
    ["الدرجة", `${fmtPoints(attempt.score)} / ${fmtPoints(exam.total_points)}`],
    ["النسبة المئوية", `${fmtPoints(Math.round(pct * 10) / 10)}%`],
    ["التقدير", gradeOf(pct)],
  ];
  el.info.innerHTML = `<div class="res-card">
    <h3 class="res-card-title"><span>${icon("file")}</span>معلومات النتيجة</h3>
    <div class="res-info-rows">${info
      .map(
        ([label, value], i) => `<div class="res-info-row">
          <span class="res-info-label">${esc(label)}</span>
          <span class="res-info-value${i >= 7 ? " green" : ""}">${esc(value)}</span>
        </div>`
      )
      .join("")}</div>
  </div>`;
}

async function load() {
  const res = await call("student_exam_result", { p_attempt_id: attemptId });
  if (!res.ok) {
    console.error("[student_exam_result]", res.error);
    notice({
      title: "تعذّر تحميل النتيجة",
      text: "حدث خطأ أثناء الاتصال. تحقّق من الشبكة ثم أعد المحاولة.",
      retry: true,
      iconName: "close",
      tone: "alert",
    });
    return;
  }
  render(res.data || {});
}

async function share() {
  try {
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
      throw new Error("clipboard unavailable");
    }
    await navigator.clipboard.writeText(location.href);
    notify("تم نسخ رابط النتيجة", "success");
  } catch (error) {
    notify("تعذّر نسخ الرابط تلقائياً؛ انسخه من شريط العنوان.", "warning");
  }
}

function switchTab(name) {
  if (!PANES[name]) return;
  $("resTabs").querySelectorAll("[data-tab]").forEach((btn) => {
    const active = btn.dataset.tab === name;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", String(active));
  });
  Object.entries(PANES).forEach(([key, id]) => {
    const pane = $(id);
    if (pane) pane.hidden = key !== name;
  });
}

function toggleQuestion(head) {
  const body = $(head.getAttribute("aria-controls"));
  if (!body) return;
  const open = body.hidden;
  body.hidden = !open;
  head.setAttribute("aria-expanded", String(open));
  const article = head.closest(".res-q");
  if (article) article.classList.toggle("is-open", open);
}

boot("student", "نتيجة الاختبار", async ({ content }) => {
  refreshElements();
  pageHtml = el.page.innerHTML;
  initIcons(el.page);
  refreshElements();

  content.addEventListener("click", async (e) => {
    if (e.target.closest("[data-retry]")) {
      restorePage();
      await load();
      return;
    }
    if (e.target.closest("#resShare")) {
      await share();
      return;
    }
    const tab = e.target.closest("[data-tab]");
    if (tab) {
      switchTab(tab.dataset.tab);
      return;
    }
    const head = e.target.closest("[data-q-head]");
    if (head) toggleQuestion(head);
  });

  if (!attemptId) {
    notice({
      title: "لم يتم تحديد المحاولة",
      text: "الرابط لا يشير إلى محاولة اختبار. عُد إلى قائمة الاختبارات لاختيار النتيجة المطلوبة.",
      iconName: "exams",
    });
    return;
  }
  await load();
});

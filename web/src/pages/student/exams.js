import { boot } from "../../lib/portal.js";
import { call } from "../../lib/api.js";
import { esc, fmtNum, fmtPoints, fmtDateTime, rel } from "../../lib/fmt.js";
import { icon } from "../../lib/icons.js";
import { p } from "../../lib/base.js";
import { onDispose } from "../../lib/lifecycle.js";

const STATUS = {
  open: { label: "جاري الآن", icon: "clock" },
  upcoming: { label: "قادم", icon: "calendar" },
  completed: { label: "مكتمل", icon: "check" },
  missed: { label: "فائت", icon: "close" },
};
const TABS = [
  { id: "all", label: "الكل" },
  { id: "open", label: "جارٍ" },
  { id: "upcoming", label: "قادم" },
  { id: "completed", label: "مكتمل" },
  { id: "missed", label: "فائت" },
];
const KIND = { exam: "اختبار رسمي", quiz: "اختبار قصير" };

const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, "0");

const state = {
  stats: {},
  exams: [],
  byId: new Map(),
  status: "all",
  course: "all",
  query: "",
  modalExam: null,
  trigger: null,
};
let countdownTimer = null;
let el = null;
onDispose(() => {
  if (countdownTimer) clearInterval(countdownTimer);
});

function countdownText(ms) {
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return `${days > 0 ? `${fmtNum(days)} يوم · ` : ""}${pad(hours)}:${pad(minutes)}:${pad(rest)}`;
}

function updateCountdowns() {
  if (!el) return;
  el.grid.querySelectorAll("[data-ex-countdown]").forEach((node) => {
    const value = node.querySelector(".ex-countdown-value");
    if (!value) return;
    const target = new Date(node.dataset.exCountdown).getTime();
    if (Number.isNaN(target)) {
      value.textContent = "—";
      return;
    }
    const diff = target - Date.now();
    if (diff <= 0) {
      value.textContent = node.dataset.exKind === "end" ? "انتهت المهلة" : "حان موعد البدء";
      return;
    }
    value.textContent = countdownText(diff);
  });
}

function startCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);
  updateCountdowns();
  countdownTimer = setInterval(updateCountdowns, 1000);
}

function showSkeleton() {
  el.stats.innerHTML = Array.from({ length: 4 }, () => '<div class="ex-skeleton ex-skeleton-stat"></div>').join("");
  el.tabs.innerHTML = Array.from({ length: 4 }, () => '<div class="ex-skeleton ex-skeleton-tab"></div>').join("");
  el.grid.innerHTML = Array.from({ length: 2 }, () => '<div class="ex-skeleton ex-skeleton-card"></div>').join("");
  el.course.disabled = true;
  el.search.disabled = true;
}

function showNotice({ title, text, retry = false, reset = false, tone = "status" }) {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
  el.stats.innerHTML = "";
  el.tabs.innerHTML = "";
  el.course.disabled = true;
  el.search.disabled = true;
  el.grid.innerHTML = `<div class="ex-empty" role="${tone}">
    <div class="ex-empty-icon">${icon("exams")}</div>
    <h2>${esc(title)}</h2>
    <p>${esc(text)}</p>
    ${retry ? '<button class="ex-btn ex-btn-secondary" type="button" data-retry>إعادة المحاولة</button>' : ""}
    ${reset ? '<button class="ex-btn ex-btn-secondary" type="button" data-reset>عرض كل الاختبارات</button>' : ""}
  </div>`;
}

function renderStats(stats, exams) {
  const missed = exams.filter((x) => x.status === "missed").length;
  const tiles = [
    { cls: "all", icon: "exams", label: "إجمالي الاختبارات", value: fmtNum(stats.total ?? exams.length), unit: "اختبار" },
    { cls: "completed", icon: "checks", label: "مكتملة", value: fmtNum(stats.completed ?? 0), unit: "اختبار" },
    { cls: "upcoming", icon: "clock", label: "قادمة", value: fmtNum(stats.upcoming ?? 0), unit: "اختبار" },
    { cls: "average", icon: "star", label: "متوسط الدرجات", value: stats.average == null ? "—" : fmtPoints(stats.average), unit: "%" },
  ];
  el.stats.innerHTML = tiles
    .map(
      (t) => `<div class="ex-stat ${t.cls}">
        <span class="ex-stat-icon">${icon(t.icon)}</span>
        <span class="ex-stat-body">
          <span class="ex-stat-label">${esc(t.label)}</span>
          <span class="ex-stat-value">${esc(t.value)}<small>${esc(t.unit)}</small></span>
        </span>
      </div>`
    )
    .join("");
  el.stats.setAttribute(
    "aria-label",
    `إحصاءات الاختبارات: ${fmtNum(stats.total ?? exams.length)} اختباراً، ${fmtNum(missed)} فائت`
  );
}

function renderTabs(stats, exams) {
  const missed = exams.filter((x) => x.status === "missed").length;
  const counts = {
    all: stats.total ?? exams.length,
    open: stats.open ?? exams.filter((x) => x.status === "open").length,
    upcoming: stats.upcoming ?? 0,
    completed: stats.completed ?? 0,
    missed,
  };
  el.tabs.innerHTML = TABS.map(
    (t) => `<button class="ex-tab${state.status === t.id ? " active" : ""}" type="button" role="tab"
        data-status="${t.id}" aria-selected="${state.status === t.id}">
        ${esc(t.label)}<span class="ex-tab-count">${fmtNum(counts[t.id] ?? 0)}</span>
      </button>`
  ).join("");
}

function renderCourses(courses) {
  const options = courses
    .map((c) => `<option value="${esc(c.id)}">${esc([c.code, c.title].filter(Boolean).join(" — "))}</option>`)
    .join("");
  el.course.innerHTML = `<option value="all">كل المقررات</option>${options}`;
  el.course.value = "all";
  el.course.disabled = courses.length === 0;
  el.search.disabled = false;
}

function cardHtml(e) {
  const status = STATUS[e.status] || STATUS.upcoming;
  const kindClass = e.exam_kind === "quiz" ? "quiz" : "exam";
  const kindLabel = KIND[e.exam_kind] || esc(e.exam_kind || "اختبار");
  const course = [e.course_code, e.course_title].filter(Boolean).map(esc).join(" — ") || "—";
  const courseColor = esc(e.course_color || "#123A63");
  const query = state.query.trim().toLowerCase();
  if (query && ![e.title, e.description, e.course_title, e.course_code].some((v) => String(v || "").toLowerCase().includes(query))) return "";

  let countdown = "";
  let countdownTarget = "";
  let countdownKind = "";
  if (e.status === "open" && e.ends_at) {
    countdownTarget = e.ends_at;
    countdownKind = "end";
  } else if (e.status === "upcoming" && e.starts_at) {
    countdownTarget = e.starts_at;
    countdownKind = "start";
  }
  if (countdownTarget) {
    countdown = `<div class="ex-countdown${countdownKind === "end" ? " urgent" : ""}"
        data-ex-countdown="${esc(countdownTarget)}" data-ex-kind="${countdownKind}">
        <span class="ex-countdown-label">${icon("clock")}${countdownKind === "end" ? "ينتهي خلال" : "يبدأ خلال"}</span>
        <span class="ex-countdown-value" aria-live="polite">—</span>
      </div>`;
  }

  let date = "";
  if (e.status === "completed" && e.submitted_at) {
    date = `<div class="ex-date">${icon("calendar")}سُلّم في ${esc(fmtDateTime(e.submitted_at))}</div>`;
  } else if (e.status === "missed" && e.ends_at) {
    date = `<div class="ex-date">${icon("calendar")}انتهى في ${esc(fmtDateTime(e.ends_at))}</div>`;
  } else if (e.starts_at) {
    date = `<div class="ex-date">${icon("calendar")}يبدأ في ${esc(fmtDateTime(e.starts_at))}${e.starts_at ? ` · ${esc(rel(e.starts_at))}` : ""}</div>`;
  }

  let result = "";
  if (e.status === "completed") {
    result = `<div class="ex-result-box">
      <span class="ex-result-label"><span>نتيجتك</span><strong>${fmtPoints(e.score)}<small>/ ${fmtPoints(e.total_points)}</small></strong></span>
      <span class="ex-result-badge">${icon("check")}مكتمل</span>
    </div>`;
  }

  let action = "";
  if (e.status === "open") {
    action = `<button class="ex-btn ex-btn-primary" type="button" data-start="${esc(e.id)}">${icon("exams")}ابدأ الاختبار</button>`;
  } else if (e.status === "upcoming") {
    action = `<button class="ex-btn ex-btn-secondary" type="button" disabled>${icon("clock")}لم يبدأ بعد</button>`;
  } else if (e.status === "missed") {
    action = `<button class="ex-btn ex-btn-secondary" type="button" disabled>${icon("close")}انتهت المهلة</button>`;
  } else if (e.attempt_id) {
    const url = `${p("pages/student/exam-result.html")}?attempt=${encodeURIComponent(e.attempt_id)}`;
    action = `<a class="ex-btn ex-btn-secondary" href="${esc(url)}">${icon("details")}مراجعة النتيجة</a>`;
  } else {
    action = `<button class="ex-btn ex-btn-secondary" type="button" disabled>${icon("details")}لا توجد محاولة</button>`;
  }

  return `<article class="ex-card ${esc(e.status)}">
    <div class="ex-card-top" aria-hidden="true"></div>
    <div class="ex-card-body">
      <div class="ex-card-head">
        <span class="ex-kind-badge ${kindClass}">${icon(kindClass === "quiz" ? "details" : "exams")}${kindLabel}</span>
        <span class="ex-status ${esc(e.status)}">${icon(status.icon)}${esc(status.label)}</span>
      </div>
      <div class="ex-course"><span class="ex-course-dot" style="--course-color:${courseColor};" aria-hidden="true"></span>${course}</div>
      <h2 class="ex-card-title">${esc(e.title || "اختبار")}</h2>
      ${e.description ? `<p class="ex-card-desc">${esc(e.description)}</p>` : ""}
      <div class="ex-meta">
        <span class="ex-meta-item">${icon("clock")}<span><strong>${fmtNum(e.duration_min)}</strong> دقيقة</span></span>
        <span class="ex-meta-item">${icon("paper")}<span><strong>${fmtNum(e.questions_count)}</strong> سؤال</span></span>
        <span class="ex-meta-item">${icon("points")}<span><strong>${fmtPoints(e.total_points)}</strong> نقطة</span></span>
      </div>
      ${date}
      ${countdown}
      ${result}
    </div>
    <div class="ex-card-actions">${action}</div>
  </article>`;
}

function renderCards() {
  const exams = state.exams.filter((e) => {
    if (state.status !== "all" && e.status !== state.status) return false;
    if (state.course !== "all" && String(e.course_id) !== state.course) return false;
    return true;
  });
  const html = exams.map(cardHtml).filter(Boolean).join("");
  if (!html) {
    const filtered = state.status !== "all" || state.course !== "all" || state.query.trim() !== "";
    el.grid.innerHTML = `<div class="ex-empty" role="status">
      <div class="ex-empty-icon">${icon("exams")}</div>
      <h2>${filtered ? "لا توجد اختبارات مطابقة" : "لا توجد اختبارات مسجلة حالياً"}</h2>
      <p>${filtered ? "جرّب تغيير الحالة أو المقرر أو كلمة البحث." : "ستظهر اختباراتك هنا فور إضافتها من قبل الأستاذ. للاستفسار، تواصل مع إدارة الأكاديمية."}</p>
      ${filtered ? '<button class="ex-btn ex-btn-secondary" type="button" data-reset>عرض كل الاختبارات</button>' : ""}
    </div>`;
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    return;
  }
  el.grid.innerHTML = html;
  startCountdown();
}

function openModal(exam, trigger) {
  state.modalExam = exam;
  state.trigger = trigger;
  $("exModalDuration").textContent = `${fmtNum(exam.duration_min)} دقيقة`;
  $("exModalQuestions").textContent = `${fmtNum(exam.questions_count)} سؤال`;
  $("exModalPoints").textContent = `${fmtPoints(exam.total_points)} نقطة`;
  $("exModalSubtitle").textContent = `${exam.title || "اختبار"}${exam.course_title ? ` — ${exam.course_title}` : ""}`;
  $("exModal").hidden = false;
  $("exModalConfirm").focus();
}

function closeModal() {
  $("exModal").hidden = true;
  if (state.trigger && typeof state.trigger.focus === "function") state.trigger.focus();
  state.modalExam = null;
  state.trigger = null;
}

async function load() {
  showSkeleton();
  const res = await call("student_exams");
  if (!res.ok) {
    console.error("[student_exams]", res.error);
    showNotice({
      title: "تعذّر تحميل الاختبارات",
      text: "حدث خطأ أثناء الاتصال. تحقّق من الشبكة ثم أعد المحاولة.",
      retry: true,
      tone: "alert",
    });
    return;
  }
  const data = res.data || {};
  state.stats = data.stats || {};
  state.exams = Array.isArray(data.exams) ? data.exams : [];
  state.byId = new Map(state.exams.map((e) => [String(e.id), e]));
  state.status = "all";
  state.course = "all";
  state.query = "";
  el.search.value = "";
  renderStats(state.stats, state.exams);
  renderTabs(state.stats, state.exams);
  renderCourses(Array.isArray(data.courses) ? data.courses : []);
  renderCards();
}

boot("student", "الاختبارات", async ({ content }) => {
  const root = content || document;
  root.querySelectorAll("[data-icon]").forEach((node) => {
    node.innerHTML = icon(node.dataset.icon);
  });

  el = {
    stats: $("exStats"),
    tabs: $("exTabs"),
    grid: $("exGrid"),
    course: $("exCourse"),
    search: $("exSearch"),
    modal: $("exModal"),
  };

  el.tabs.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-status]");
    if (!tab) return;
    state.status = tab.dataset.status;
    el.tabs.querySelectorAll("[data-status]").forEach((btn) => {
      const active = btn === tab;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", String(active));
    });
    renderCards();
  });

  el.course.addEventListener("change", (e) => {
    state.course = e.target.value;
    renderCards();
  });

  el.search.addEventListener("input", (e) => {
    state.query = e.target.value || "";
    renderCards();
  });

  el.grid.addEventListener("click", (e) => {
    if (e.target.closest("[data-retry]")) {
      load();
      return;
    }
    if (e.target.closest("[data-reset]")) {
      state.status = "all";
      state.course = "all";
      state.query = "";
      el.course.value = "all";
      el.search.value = "";
      renderTabs(state.stats, state.exams);
      renderCards();
      return;
    }
    const start = e.target.closest("[data-start]");
    if (start) {
      const exam = state.byId.get(start.dataset.start);
      if (exam) openModal(exam, start);
    }
  });

  $("exModalClose").addEventListener("click", closeModal);
  $("exModalCancel").addEventListener("click", closeModal);
  $("exModalConfirm").addEventListener("click", () => {
    const exam = state.modalExam;
    if (!exam) return;
    closeModal();
    location.assign(`${p("pages/student/exam.html")}?id=${encodeURIComponent(exam.id)}`);
  });
  const onEscape = (e) => {
    if (e.key === "Escape" && !el.modal.hidden) closeModal();
  };
  document.addEventListener("keydown", onEscape);
  onDispose(() => document.removeEventListener("keydown", onEscape));

  await load();
});

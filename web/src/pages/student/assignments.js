import { boot } from "../../lib/portal.js";
import { call } from "../../lib/api.js";
import { esc, fmtNum, fmtPoints, fmtDateTime, rel } from "../../lib/fmt.js";
import { icon } from "../../lib/icons.js";

const STATUS = {
  pending: { label: "قيد الانتظار", icon: "clock" },
  overdue: { label: "متأخر", icon: "close" },
  submitted: { label: "مُسلَّم", icon: "checks" },
  late: { label: "مُسلَّم متأخراً", icon: "history" },
  graded: { label: "مُصحَّح", icon: "check" },
};

const $ = (id) => document.getElementById(id);

const state = {
  stats: {},
  courses: [],
  assignments: [],
  byId: new Map(),
  course: "all",
  status: "all",
  query: "",
  modalAssignment: null,
  trigger: null,
  busy: false,
};

let el = null;

function showSkeleton() {
  el.stats.innerHTML = Array.from({ length: 4 }, () => '<div class="asg-skeleton asg-skeleton-stat"></div>').join("");
  el.tabs.innerHTML = Array.from({ length: 3 }, () => '<div class="asg-skeleton asg-skeleton-tab"></div>').join("");
  el.grid.innerHTML = Array.from({ length: 2 }, () => '<div class="asg-skeleton asg-skeleton-card"></div>').join("");
  el.status.disabled = true;
  el.search.disabled = true;
}

function showNotice({ title, text, retry = false, tone = "status" }) {
  el.stats.innerHTML = "";
  el.tabs.innerHTML = "";
  el.status.disabled = true;
  el.search.disabled = true;
  el.grid.setAttribute("role", tone);
  el.grid.innerHTML = `<div class="asg-empty">
    <div class="asg-empty-icon">${icon("assignments")}</div>
    <h2>${esc(title)}</h2>
    <p>${esc(text)}</p>
    ${retry ? '<button class="asg-btn asg-btn-secondary" type="button" data-retry>إعادة المحاولة</button>' : ""}
  </div>`;
}

function renderStats() {
  const s = state.stats;
  const list = state.assignments;
  const tiles = [
    { cls: "asg-total", icon: "assignments", label: "إجمالي الواجبات", value: fmtNum(s.total ?? list.length), unit: "واجب" },
    { cls: "asg-pending", icon: "clock", label: "قيد الانتظار", value: fmtNum(s.pending ?? list.filter((a) => a.status === "pending").length), unit: "واجب" },
    { cls: "asg-submitted", icon: "checks", label: "مُسلَّم", value: fmtNum(s.submitted ?? list.filter((a) => ["submitted", "late"].includes(a.status)).length), unit: "واجب" },
    { cls: "asg-graded", icon: "check", label: "مُصحَّح", value: fmtNum(s.graded ?? list.filter((a) => a.status === "graded").length), unit: "واجب" },
  ];

  el.stats.innerHTML = tiles
    .map(
      (t) => `<div class="asg-stat ${t.cls}">
        <span class="asg-stat-icon">${icon(t.icon)}</span>
        <span class="asg-stat-body">
          <span class="asg-stat-label">${esc(t.label)}</span>
          <span class="asg-stat-value">${esc(t.value)}<small>${esc(t.unit)}</small></span>
        </span>
      </div>`
    )
    .join("");

  el.stats.setAttribute(
    "aria-label",
    `إحصاءات الواجبات: ${fmtNum(s.total ?? list.length)} واجباً، ${fmtNum(s.pending ?? 0)} قيد الانتظار، ${fmtNum(s.graded ?? 0)} مُصحَّح`
  );
}

function renderCourseTabs() {
  const tabs = [{ id: "all", label: "كل المقررات", count: state.assignments.length }];
  state.courses.forEach((c) => {
    const cid = String(c.id);
    tabs.push({
      id: cid,
      label: [c.code, c.title].filter(Boolean).join(" — ") || "مقرر",
      count: state.assignments.filter((a) => String(a.course_id) === cid).length,
    });
  });

  el.tabs.innerHTML = tabs
    .map(
      (t) => `<button class="asg-course-tab${state.course === t.id ? " asg-active" : ""}" type="button"
        role="tab" data-course="${esc(t.id)}" aria-selected="${state.course === t.id}">
        ${esc(t.label)}<span class="asg-tab-count">${fmtNum(t.count)}</span>
      </button>`
    )
    .join("");

  if (!tabs.some((t) => t.id === state.course)) {
    state.course = "all";
    renderCourseTabs();
  }
}

function cardHtml(a) {
  const statusKey = STATUS[a.status] ? a.status : "pending";
  const status = STATUS[statusKey];
  const course = [a.course_code, a.course_title].filter(Boolean).map(esc).join(" — ") || "—";
  const color = esc(a.course_color || "#123A63");
  const query = state.query.trim().toLowerCase();
  if (query && ![a.title, a.description, a.course_title, a.course_code].some((v) => String(v || "").toLowerCase().includes(query))) return "";

  const due = a.due_at
    ? `<div class="asg-due${statusKey === "overdue" ? " asg-urgent" : ""}">
        ${icon("calendar")}<span>آخر موعد: ${esc(fmtDateTime(a.due_at))}${a.due_at ? ` · ${esc(rel(a.due_at))}` : ""}</span>
      </div>`
    : "";

  let grade = "";
  if (a.status === "graded" && a.points !== null && a.points !== undefined) {
    grade = `<div class="asg-grade">
      <span class="asg-grade-label"><span>درجتك</span><strong>${fmtPoints(a.points)}<small> / ${fmtPoints(a.max_points)}</small></strong></span>
      <span class="asg-grade-badge">${icon("check")}مُصحَّح</span>
    </div>`;
  }
  const feedback = a.feedback ? `<div class="asg-feedback">${icon("forum")}<span>${esc(a.feedback)}</span></div>` : "";

  const submitted = a.submission_text
    ? `<div class="asg-submitted">
        <span class="asg-submitted-label">${icon("file")}نصك المُسلَّم${a.submitted_at ? ` · ${esc(fmtDateTime(a.submitted_at))}` : ""}</span>
        <p class="asg-submitted-text">${esc(a.submission_text)}</p>
      </div>`
    : "";

  const canSubmit = statusKey === "pending" || statusKey === "overdue";
  const action = canSubmit
    ? `<button class="asg-btn asg-btn-primary" type="button" data-submit="${esc(a.id)}">${icon("send")}تسليم الواجب</button>`
    : `<button class="asg-btn asg-btn-secondary" type="button" disabled>${icon(status.icon)}${esc(status.label)}</button>`;

  return `<article class="asg-card asg-${statusKey}">
    <div class="asg-card-top" aria-hidden="true"></div>
    <div class="asg-card-body">
      <div class="asg-card-head">
        <span class="asg-kind-badge">${icon("paper")}واجب</span>
        <span class="asg-status asg-${statusKey}">${icon(status.icon)}${esc(status.label)}</span>
      </div>

      <div class="asg-course"><span class="asg-course-dot" style="--asg-course-color:${color};" aria-hidden="true"></span>${course}</div>
      <h2 class="asg-card-title">${esc(a.title || "واجب")}</h2>
      ${a.description ? `<p class="asg-card-desc">${esc(a.description)}</p>` : ""}

      <div class="asg-meta">
        <span class="asg-meta-item">${icon("points")}<span><strong>${fmtPoints(a.max_points)}</strong> نقطة</span></span>
        ${a.submitted_at ? `<span class="asg-meta-item">${icon("checks")}<span>سُلِّم في ${esc(fmtDateTime(a.submitted_at))}</span></span>` : ""}
      </div>

      ${due}
      ${grade}
      ${feedback}
      ${submitted}
    </div>
    <div class="asg-card-actions">${action}</div>
  </article>`;
}

function renderCards() {
  el.grid.removeAttribute("role");
  const list = state.assignments.filter((a) => {
    if (state.course !== "all" && String(a.course_id) !== state.course) return false;
    if (state.status !== "all" && a.status !== state.status) return false;
    return true;
  });
  const html = list.map(cardHtml).filter(Boolean).join("");

  if (!html) {
    const filtered = state.course !== "all" || state.status !== "all" || state.query.trim() !== "";
    el.grid.innerHTML = `<div class="asg-empty" role="status">
      <div class="asg-empty-icon">${icon("assignments")}</div>
      <h2>${filtered ? "لا توجد واجبات مطابقة" : "لا توجد واجبات مسجلة حالياً"}</h2>
      <p>${filtered ? "جرّب تغيير المقرر أو الحالة أو كلمة البحث." : "ستظهر واجباتك هنا فور إضافتها من قبل الأستاذ. للاستفسار، تواصل مع إدارة الأكاديمية."}</p>
      ${filtered ? '<button class="asg-btn asg-btn-secondary" type="button" data-reset>عرض كل الواجبات</button>' : ""}
    </div>`;
    return;
  }

  el.grid.innerHTML = html;
}

function setFormError(message) {
  el.formError.textContent = message || "";
  el.formError.hidden = !message;
}

function updateCounter() {
  el.counter.textContent = `${fmtNum(el.textarea.value.trim().length)} حرف`;
}

function toast(message, type = "success") {
  const node = document.createElement("div");
  node.className = `asg-toast asg-toast-${type === "success" ? "success" : "danger"}`;
  node.innerHTML = `${icon(type === "success" ? "check" : "close")}<span>${esc(message)}</span>`;
  el.toasts.appendChild(node);
  setTimeout(() => {
    node.classList.add("asg-toast-hide");
    setTimeout(() => node.remove(), 300);
  }, 2800);
}

function openModal(a, trigger) {
  state.modalAssignment = a;
  state.trigger = trigger;
  el.modalSubtitle.textContent = `${a.title || "واجب"}${a.course_title ? ` — ${a.course_title}` : ""}`;
  el.textarea.value = "";
  updateCounter();
  setFormError("");
  el.modal.hidden = false;
  el.textarea.focus();
}

function closeModal() {
  el.modal.hidden = true;
  state.modalAssignment = null;
  if (state.trigger && typeof state.trigger.focus === "function") state.trigger.focus();
  state.trigger = null;
}

async function submitAssignment() {
  if (state.busy || !state.modalAssignment) return;
  const text = el.textarea.value.trim();
  if (text.length < 3) {
    setFormError("اكتب ما لا يقل عن 3 أحرف في نص التسليم قبل الإرسال.");
    el.textarea.focus();
    return;
  }

  const assignment = state.modalAssignment;
  state.busy = true;
  el.confirm.disabled = true;
  el.confirm.textContent = "جارٍ التسليم...";
  setFormError("");

  const res = await call("student_assignment_submit", { p_assignment_id: assignment.id, p_text: text });
  state.busy = false;
  el.confirm.disabled = false;
  el.confirm.textContent = "تسليم الواجب";

  if (!res.ok) {
    console.error("[student_assignment_submit]", res.error);
    setFormError("تعذّر تسليم الواجب الآن. تحقّق من اتصالك وأعد المحاولة، أو تواصل مع إدارة الأكاديمية إذا استمرت المشكلة.");
    return;
  }

  closeModal();
  toast("تم تسليم الواجب بنجاح.");
  await load();
}

async function load() {
  showSkeleton();
  const res = await call("student_assignments");
  if (!res.ok) {
    console.error("[student_assignments]", res.error);
    state.stats = {};
    state.courses = [];
    state.assignments = [];
    state.byId = new Map();
    showNotice({
      title: "تعذّر تحميل الواجبات",
      text: "حدث خطأ أثناء الاتصال. تحقّق من الشبكة ثم أعد المحاولة.",
      retry: true,
      tone: "alert",
    });
    return;
  }

  const data = res.data || {};
  state.stats = data.stats || {};
  state.courses = Array.isArray(data.courses) ? data.courses : [];
  state.assignments = Array.isArray(data.assignments) ? data.assignments : [];
  state.byId = new Map(state.assignments.map((a) => [String(a.id), a]));
  state.course = "all";
  state.status = "all";
  state.query = "";
  el.status.value = "all";
  el.search.value = "";
  el.status.disabled = false;
  el.search.disabled = state.assignments.length === 0;

  renderStats();
  renderCourseTabs();
  renderCards();
}

boot("student", "الواجبات", async ({ profile, content }) => {
  const root = content || document;
  root.querySelectorAll("[data-icon]").forEach((node) => {
    node.innerHTML = icon(node.dataset.icon);
  });

  el = {
    stats: $("asgStats"),
    tabs: $("asgCourseTabs"),
    status: $("asgStatus"),
    search: $("asgSearch"),
    grid: $("asgGrid"),
    modal: $("asgModal"),
    modalSubtitle: $("asgModalSubtitle"),
    modalClose: $("asgModalClose"),
    modalCancel: $("asgModalCancel"),
    form: $("asgSubmitForm"),
    formError: $("asgFormError"),
    textarea: $("asgSubmissionText"),
    counter: $("asgCounter"),
    confirm: $("asgModalConfirm"),
    toasts: $("asgToasts"),
  };

  el.tabs.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-course]");
    if (!tab || tab.disabled) return;
    state.course = tab.dataset.course;
    el.tabs.querySelectorAll("[data-course]").forEach((btn) => {
      const active = btn === tab;
      btn.classList.toggle("asg-active", active);
      btn.setAttribute("aria-selected", String(active));
    });
    renderCards();
  });

  el.status.addEventListener("change", (e) => {
    state.status = e.target.value;
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
      state.course = "all";
      state.status = "all";
      state.query = "";
      el.status.value = "all";
      el.search.value = "";
      renderCourseTabs();
      renderCards();
      return;
    }
    const submit = e.target.closest("[data-submit]");
    if (submit) {
      const assignment = state.byId.get(submit.dataset.submit);
      if (assignment) openModal(assignment, submit);
    }
  });

  el.modal.addEventListener("click", (e) => {
    if (e.target === el.modal) closeModal();
  });
  el.modalClose.addEventListener("click", closeModal);
  el.modalCancel.addEventListener("click", closeModal);
  el.textarea.addEventListener("input", () => {
    updateCounter();
    if (!el.formError.hidden) setFormError("");
  });
  el.form.addEventListener("submit", (e) => {
    e.preventDefault();
    submitAssignment();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !el.modal.hidden) closeModal();
  });

  await load();
});

import { boot } from "../../lib/portal.js";
import { call } from "../../lib/api.js";
import { esc, fmtNum, fmtDateTime, rel } from "../../lib/fmt.js";
import { icon } from "../../lib/icons.js";
import { p } from "../../lib/base.js";

const STATUS = {
  live: { label: "جارية الآن", icon: "video" },
  attended: { label: "حضرتها", icon: "check" },
  upcoming: { label: "قادمة", icon: "calendar" },
  missed: { label: "فائتة", icon: "close" },
};

const TYPE = {
  direct: { label: "مباشر", icon: "video" },
  online: { label: "أونلاين", icon: "monitor" },
  recorded: { label: "مسجل", icon: "library" },
};

const $ = (id) => document.getElementById(id);

const state = {
  stats: {},
  courses: [],
  lectures: [],
  course: "all",
  status: "all",
  query: "",
};

let el = null;

function dateParts(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { day: "—", month: "" };
  return {
    day: fmtNum(d.getDate()),
    month: new Intl.DateTimeFormat("ar", { month: "short" }).format(d),
  };
}

function showSkeleton() {
  el.stats.innerHTML = Array.from({ length: 4 }, () => '<div class="lcs-skeleton lcs-skeleton-stat"></div>').join("");
  el.tabs.innerHTML = Array.from({ length: 3 }, () => '<div class="lcs-skeleton lcs-skeleton-tab"></div>').join("");
  el.grid.innerHTML = Array.from({ length: 2 }, () => '<div class="lcs-skeleton lcs-skeleton-card"></div>').join("");
  el.status.disabled = true;
  el.search.disabled = true;
}

function showNotice({ title, text, retry = false, tone = "status" }) {
  el.stats.innerHTML = "";
  el.tabs.innerHTML = "";
  el.status.disabled = true;
  el.search.disabled = true;
  el.grid.setAttribute("role", tone);
  el.grid.innerHTML = `<div class="lcs-empty">
    <div class="lcs-empty-icon">${icon("lectures")}</div>
    <h2>${esc(title)}</h2>
    <p>${esc(text)}</p>
    ${retry ? '<button class="lcs-btn lcs-btn-secondary" type="button" data-retry>إعادة المحاولة</button>' : ""}
  </div>`;
}

function statusCounts() {
  const s = state.stats;
  return {
    live: state.lectures.filter((l) => l.status === "live").length,
    attended: Number(s.attended ?? state.lectures.filter((l) => l.status === "attended").length),
    upcoming: Number(s.upcoming ?? state.lectures.filter((l) => l.status === "upcoming").length),
    missed: Number(s.missed ?? state.lectures.filter((l) => l.status === "missed").length),
  };
}

function renderStats() {
  const counts = statusCounts();
  const tiles = [
    { cls: "lcs-total", icon: "lectures", label: "إجمالي المحاضرات", value: fmtNum(state.stats.total ?? state.lectures.length), unit: "محاضرة" },
    { cls: "lcs-attended", icon: "check", label: "حضرتها", value: fmtNum(counts.attended), unit: "محاضرة" },
    { cls: "lcs-upcoming", icon: "calendar", label: "قادمة", value: fmtNum(counts.upcoming), unit: "محاضرة" },
    { cls: "lcs-missed", icon: "close", label: "فائتة", value: fmtNum(counts.missed), unit: "محاضرة" },
  ];

  el.stats.innerHTML = tiles
    .map(
      (t) => `<div class="lcs-stat ${t.cls}">
        <span class="lcs-stat-icon">${icon(t.icon)}</span>
        <span class="lcs-stat-body">
          <span class="lcs-stat-label">${esc(t.label)}</span>
          <span class="lcs-stat-value">${esc(t.value)}<small>${esc(t.unit)}</small></span>
        </span>
      </div>`
    )
    .join("");

  el.stats.setAttribute(
    "aria-label",
    `إحصاءات المحاضرات: ${fmtNum(state.stats.total ?? state.lectures.length)} محاضرة، ${fmtNum(counts.upcoming)} قادمة، ${fmtNum(counts.live)} جارية`
  );
}

function renderCourseTabs() {
  const tabs = [{ id: "all", label: "كل المقررات", count: state.lectures.length }];
  state.courses.forEach((c) => {
    const cid = String(c.id);
    tabs.push({
      id: cid,
      label: [c.code, c.title].filter(Boolean).join(" — ") || "مقرر",
      count: state.lectures.filter((l) => String(l.course_id) === cid).length,
    });
  });

  el.tabs.innerHTML = tabs
    .map(
      (t) => `<button class="lcs-course-tab${state.course === t.id ? " lcs-active" : ""}" type="button"
        role="tab" data-course="${esc(t.id)}" aria-selected="${state.course === t.id}">
        ${esc(t.label)}<span class="lcs-tab-count">${fmtNum(t.count)}</span>
      </button>`
    )
    .join("");

  if (!tabs.some((t) => t.id === state.course)) {
    state.course = "all";
    renderCourseTabs();
  }
}

function cardHtml(l) {
  const statusKey = STATUS[l.status] ? l.status : "upcoming";
  const typeKey = TYPE[l.lecture_type] ? l.lecture_type : "recorded";
  const status = STATUS[statusKey];
  const type = TYPE[typeKey];
  const course = [l.course_code, l.course_title].filter(Boolean).map(esc).join(" — ") || "—";
  const color = esc(l.course_color || "#123A63");
  const date = dateParts(l.scheduled_at);
  const query = state.query.trim().toLowerCase();
  if (query && ![l.title, l.description, l.course_title, l.course_code, l.teacher].some((v) => String(v || "").toLowerCase().includes(query))) return "";

  let attendance = "";
  if (l.attended) {
    attendance = `<span class="lcs-meta-item">${icon("check")}<span>حضرتها</span></span>`;
  } else if (l.attendance_open) {
    attendance = `<span class="lcs-meta-item">${icon("checks")}<span>التسجيل مفتوح</span></span>`;
  }

  const url = `${p("pages/student/lecture.html")}?id=${encodeURIComponent(l.id)}`;
  const isLive = statusKey === "live";

  return `<article class="lcs-card lcs-${statusKey} lcs-${typeKey}">
    <div class="lcs-card-top" aria-hidden="true"></div>
    ${isLive ? `<span class="lcs-live-flag">${icon("video")}مباشر الآن</span>` : ""}
    <div class="lcs-card-body">
      <div class="lcs-date" aria-hidden="true">
        <span class="lcs-date-day">${esc(date.day)}</span>
        <span class="lcs-date-month">${esc(date.month)}</span>
      </div>

      <div class="lcs-card-head">
        <span class="lcs-type-badge lcs-${typeKey}">${icon(type.icon)}${esc(type.label)}</span>
        <span class="lcs-status lcs-${statusKey}">${icon(status.icon)}${esc(status.label)}</span>
      </div>

      <div class="lcs-course"><span class="lcs-course-dot" style="--lcs-course-color:${color};" aria-hidden="true"></span>${course}</div>
      <h2 class="lcs-card-title">${esc(l.title || "محاضرة")}</h2>
      ${l.description ? `<p class="lcs-card-desc">${esc(l.description)}</p>` : ""}

      <div class="lcs-meta">
        <span class="lcs-meta-item">${icon("calendar")}<span>${esc(fmtDateTime(l.scheduled_at))}${l.scheduled_at ? ` · ${esc(rel(l.scheduled_at))}` : ""}</span></span>
        <span class="lcs-meta-item">${icon("clock")}<span><strong>${fmtNum(l.duration_min)}</strong> دقيقة</span></span>
        <span class="lcs-meta-item">${icon("user")}<span>${l.teacher ? esc(l.teacher) : "—"}</span></span>
        ${attendance}
      </div>
    </div>
    <div class="lcs-card-actions">
      <a class="lcs-btn lcs-btn-primary" href="${esc(url)}">${icon("details")}${isLive ? "انضم إلى المحاضرة" : "عرض التفاصيل"}</a>
    </div>
  </article>`;
}

function renderCards() {
  el.grid.removeAttribute("role");
  const list = state.lectures.filter((l) => {
    if (state.course !== "all" && String(l.course_id) !== state.course) return false;
    if (state.status !== "all" && l.status !== state.status) return false;
    return true;
  });
  const html = list.map(cardHtml).filter(Boolean).join("");

  if (!html) {
    const filtered = state.course !== "all" || state.status !== "all" || state.query.trim() !== "";
    el.grid.innerHTML = `<div class="lcs-empty" role="status">
      <div class="lcs-empty-icon">${icon("lectures")}</div>
      <h2>${filtered ? "لا توجد محاضرات مطابقة" : "لا توجد محاضرات مسجلة حالياً"}</h2>
      <p>${filtered ? "جرّب تغيير المقرر أو الحالة أو كلمة البحث." : "ستظهر محاضراتك هنا فور إضافتها من قبل الأستاذ. للاستفسار، تواصل مع إدارة الأكاديمية."}</p>
      ${filtered ? '<button class="lcs-btn lcs-btn-secondary" type="button" data-reset>عرض كل المحاضرات</button>' : ""}
    </div>`;
    return;
  }

  el.grid.innerHTML = html;
}

async function load() {
  showSkeleton();
  const res = await call("student_lectures");
  if (!res.ok) {
    console.error("[student_lectures]", res.error);
    state.stats = {};
    state.courses = [];
    state.lectures = [];
    showNotice({
      title: "تعذّر تحميل المحاضرات",
      text: "حدث خطأ أثناء الاتصال. تحقّق من الشبكة ثم أعد المحاولة.",
      retry: true,
      tone: "alert",
    });
    return;
  }

  const data = res.data || {};
  state.stats = data.stats || {};
  state.courses = Array.isArray(data.courses) ? data.courses : [];
  state.lectures = Array.isArray(data.lectures) ? data.lectures : [];
  state.course = "all";
  state.status = "all";
  state.query = "";
  el.status.value = "all";
  el.search.value = "";
  el.status.disabled = false;
  el.search.disabled = state.lectures.length === 0;

  renderStats();
  renderCourseTabs();
  renderCards();
}

boot("student", "المحاضرات", async ({ profile, content }) => {
  const root = content || document;
  root.querySelectorAll("[data-icon]").forEach((node) => {
    node.innerHTML = icon(node.dataset.icon);
  });

  el = {
    stats: $("lcsStats"),
    tabs: $("lcsCourseTabs"),
    status: $("lcsStatus"),
    search: $("lcsSearch"),
    grid: $("lcsGrid"),
  };

  el.tabs.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-course]");
    if (!tab || tab.disabled) return;
    state.course = tab.dataset.course;
    el.tabs.querySelectorAll("[data-course]").forEach((btn) => {
      const active = btn === tab;
      btn.classList.toggle("lcs-active", active);
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
    }
  });

  await load();
});

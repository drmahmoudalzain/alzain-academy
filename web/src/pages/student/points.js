import { boot } from "../../lib/portal.js";
import { call } from "../../lib/api.js";
import { esc, fmtNum, fmtPoints, fmtDate, fmtDateTime, rel } from "../../lib/fmt.js";
import { icon } from "../../lib/icons.js";
import { p } from "../../lib/base.js";

const SOURCE = {
  attendance: { label: "حضور", icon: "check" },
  interaction: { label: "تفاعل", icon: "forum" },
  assignment: { label: "واجب", icon: "assignments" },
  exam: { label: "اختبارات", icon: "points" },
};

const FILTERS = [
  { key: "all", label: "الكل" },
  { key: "attendance", label: "الحضور" },
  { key: "interaction", label: "التفاعل" },
  { key: "assignment", label: "الواجبات" },
  { key: "exam", label: "الاختبارات" },
];

const isBachelorTrack = (track) =>
  ["bachelor", "bachelor_m", "bachelor_f"].includes(String(track ?? "").trim());

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const clampPct = (v) => Math.min(100, Math.max(0, num(v)));

const colorOf = (v, fallback = "#123A63") => {
  const c = String(v ?? "").trim();
  return /^#[\da-f]{3,8}$/i.test(c) ? c : fallback;
};

const valueOrDash = (v) => (v === null || v === undefined || v === "" ? "—" : fmtPoints(v));

const skeleton = () => `
  <div class="pts-skeleton pts-skeleton-hero"></div>
  <div class="pts-skeleton pts-skeleton-card"></div>
  <div class="pts-skeleton pts-skeleton-card"></div>`;

const emptyBlock = (title, text, iconName = "points") => `
  <div class="pts-empty" role="status">
    <span class="pts-empty-icon">${icon(iconName)}</span>
    <h3>${esc(title)}</h3>
    <p>${esc(text)}</p>
  </div>`;

const emptyPage = () => `
  <div class="pts-empty pts-empty-page" role="status">
    <span class="pts-empty-icon">${icon("points")}</span>
    <h2>لا توجد نقاط مسجّلة بعد</h2>
    <p>تُكتسب النقاط من الحضور والتفاعل وتسليم الواجبات، وتظهر هنا فور تسجيلها. إن كنت تتوقع وجود رصيد لك، تواصل مع إدارة الأكاديمية.</p>
    <button class="pts-btn pts-btn-primary" type="button" data-reload>${icon("refresh")} تحديث البيانات</button>
  </div>`;

const errorBlock = () => `
  <div class="pts-empty pts-empty-page" role="alert">
    <span class="pts-empty-icon">${icon("close")}</span>
    <h2>تعذّر تحميل النقاط</h2>
    <p>لم نتمكّن من جلب بيانات رصيدك الآن. تحقّق من اتصالك بالشبكة، ثم أعد المحاولة.</p>
    <button class="pts-btn pts-btn-primary" type="button" data-reload>${icon("refresh")} إعادة المحاولة</button>
  </div>`;

function hero(data) {
  const rank = num(data.rank);
  const students = num(data.students_count);
  const rankText = rank > 0 && students > 0 ? `المرتبة ${fmtNum(rank)} من ${fmtNum(students)} طالب` : "الترتيب غير متاح بعد";
  const week = num(data.week);

  return `<section class="pts-hero">
    <div class="pts-hero-info">
      <span class="pts-hero-tag">${icon("sparkles")} إنجازك الأكاديمي</span>
      <h2>رصيدك من النقاط</h2>
      <p>تُسجَّل النقاط تلقائياً من حضور المحاضرات والمشاركة فيها وتسليم الواجبات، ويمكن مراجعة كل مكسب في السجل أدناه.</p>
      <div class="pts-hero-pills">
        <span class="pts-pill">${icon("calendar")} هذا الأسبوع: <strong>${valueOrDash(data.week)}</strong> نقطة</span>
        <span class="pts-pill">${icon("users")} ${esc(rankText)}</span>
      </div>
      <a class="pts-hero-link" href="${p("pages/student/grades.html")}">درجاتي ${icon("arrow")}</a>
    </div>
    <div class="pts-total">
      <span class="pts-total-icon">${icon("points")}</span>
      <strong class="pts-total-value">${valueOrDash(data.total)}</strong>
      <span class="pts-total-label">إجمالي النقاط</span>
      <span class="pts-total-week">${week > 0 ? `+${fmtPoints(week)}` : fmtPoints(week)} هذا الأسبوع</span>
    </div>
  </section>`;
}

function breakdownCard(kind, value, total) {
  const meta = SOURCE[kind];
  const share = total > 0 ? Math.round((num(value) / total) * 100) : 0;
  return `<article class="pts-source ${kind}">
    <div class="pts-source-head">
      <span class="pts-source-icon">${icon(meta.icon)}</span>
      <strong>${esc(meta.label)}</strong>
      <span class="pts-source-share">${total > 0 ? `${share}%` : "—"}</span>
    </div>
    <div class="pts-source-value">${valueOrDash(value)} <small>نقطة</small></div>
    <div class="pts-bar" role="img" aria-label="${esc(meta.label)}: ${valueOrDash(value)} نقطة، ${total > 0 ? `${share} بالمئة` : "نسبة غير متاحة"}">
      <span style="--pts-bar:${total > 0 ? share : 0}%"></span>
    </div>
  </article>`;
}

function courseBlock(courses) {
  const list = Array.isArray(courses) ? courses : [];
  if (!list.length) return emptyBlock("لا توجد نقاط حسب المقرر بعد", "ستظهر هنا مساهمة كل مقرر في رصيدك عند تسجيل أول مكسب له.", "courses");

  const max = Math.max(1, ...list.map((c) => num(c.points)));
  return `<div class="pts-course-list">${list
    .map(
      (c) => `<div class="pts-course-row">
        <div class="pts-course-head">
          <span><span class="pts-course-dot" style="--pts-course:${colorOf(c.color)}"></span>${esc(c.course_title || "مقرر بدون عنوان")}</span>
          <strong>${valueOrDash(c.points)} <small>نقطة</small></strong>
        </div>
        <div class="pts-bar" role="img" aria-label="${esc(c.course_title || "مقرر")}: ${valueOrDash(c.points)} نقطة">
          <span style="--pts-bar:${Math.round((num(c.points) / max) * 100)}%"></span>
        </div>
        ${c.course_code ? `<span class="pts-course-code">${esc(c.course_code)}</span>` : ""}
      </div>`
    )
    .join("")}</div>`;
}

function leaderboardBlock(rows) {
  const list = Array.isArray(rows) ? rows.slice(0, 10) : [];
  if (!list.length) return emptyBlock("لوحة الشرف غير متاحة بعد", "ستظهر هنا أعلى عشرة طلاب بعد تسجيل نقاطهم في النظام.", "users");

  return `<ol class="pts-board">${list
    .map(
      (r, i) => `<li class="pts-board-row${r.is_me ? " me" : ""}">
        <span class="pts-rank rank-${i + 1}">${fmtNum(i + 1)}</span>
        <span class="pts-avatar">${esc(String(r.name || "?").trim().charAt(0) || "?")}</span>
        <span class="pts-board-name"><strong>${esc(r.name || "طالب")}${r.is_me ? " (أنت)" : ""}</strong><small>${r.is_me ? "حسابك" : `المرتبة ${fmtNum(i + 1)}`}</small></span>
        <span class="pts-board-points">${icon("points")} ${valueOrDash(r.points)}</span>
      </li>`
    )
    .join("")}</ol>`;
}

function ledgerRow(entry) {
  const type = SOURCE[entry.source_type] ? entry.source_type : "interaction";
  const meta = SOURCE[type];
  const points = num(entry.points);
  const sign = points >= 0 ? "+" : "−";
  const date = entry.created_at ? `${fmtDateTime(entry.created_at)} · ${rel(entry.created_at)}` : "—";

  return `<li class="pts-entry ${type}">
    <span class="pts-entry-icon">${icon(meta.icon)}</span>
    <div class="pts-entry-body">
      <div class="pts-entry-top">
        <span class="pts-entry-tag">${esc(meta.label)}</span>
        <strong class="pts-entry-points">${sign}${fmtPoints(Math.abs(points))}</strong>
      </div>
      <h4>${esc(entry.source_detail || meta.label)}</h4>
      <p>
        ${entry.course_title ? `<span class="pts-entry-course">${icon("book")}${esc(entry.course_title)}</span>` : ""}
        <time>${esc(date)}</time>
      </p>
    </div>
  </li>`;
}

function ledgerBlock(ledger, filter) {
  const list = Array.isArray(ledger) ? ledger : [];
  if (!list.length) return emptyBlock("لا يوجد سجل نقاط بعد", "ستظهر هنا كل زيادة أو خصم في رصيدك مع مصدرها وتاريخها فور تسجيلها.", "history");

  const visible = filter === "all" ? list : list.filter((e) => e.source_type === filter);
  if (!visible.length) return emptyBlock("لا توجد نقاط بهذا التصنيف", "جرّب عرض تصنيف آخر من أزرار التصفية أعلاه.", "history");

  return `<ol class="pts-ledger">${visible.map(ledgerRow).join("")}</ol>`;
}

function renderPoints(data, filter, kinds) {
  const d = data && typeof data === "object" ? data : {};
  const breakdown = d.breakdown && typeof d.breakdown === "object" ? d.breakdown : {};
  const ledger = Array.isArray(d.ledger) ? d.ledger : [];
  const board = Array.isArray(d.leaderboard) ? d.leaderboard : [];
  const courses = Array.isArray(d.by_course) ? d.by_course : [];
  const total = num(d.total);
  const visibleFilters = kinds
    ? FILTERS.filter((f) => f.key !== "assignment")
    : FILTERS.filter((f) => f.key === "all" || f.key === "assignment");

  const hasData = total > 0 || num(d.week) > 0 || ledger.length > 0 || board.length > 0 || courses.length > 0 || Object.values(breakdown).some((v) => num(v) > 0);
  if (!hasData) return emptyPage();

  return `
    ${hero(d)}

    <section class="pts-section" aria-labelledby="ptsBreakdownTitle">
      <div class="pts-section-head">
        <h2 id="ptsBreakdownTitle">${icon("grid")} مصادر النقاط</h2>
        <span>نسب من إجمالي رصيدك الحالي</span>
      </div>
      <div class="pts-sources">
        ${
          kinds
            ? `${breakdownCard("attendance", breakdown.attendance, total)}
               ${breakdownCard("interaction", breakdown.interaction, total)}
               ${breakdownCard("exam", breakdown.exam, total)}`
            : breakdownCard("assignment", breakdown.assignment, total)
        }
      </div>
    </section>

    <div class="pts-lower">
      <section class="pts-card" aria-labelledby="ptsCourseTitle">
        <h2 id="ptsCourseTitle">${icon("book")} النقاط حسب المقرر</h2>
        ${courseBlock(courses)}
      </section>

      <section class="pts-card" aria-labelledby="ptsBoardTitle">
        <h2 id="ptsBoardTitle">${icon("users")} لوحة الشرف</h2>
        ${leaderboardBlock(board)}
      </section>
    </div>

    <section class="pts-card" aria-labelledby="ptsLedgerTitle">
      <h2 id="ptsLedgerTitle">${icon("history")} سجل النقاط</h2>
      <div class="pts-filters" role="group" aria-label="تصفية سجل النقاط">
        ${visibleFilters.map(
          (f) => `<button class="pts-filter${filter === f.key ? " active" : ""}" type="button" data-filter="${f.key}" aria-pressed="${filter === f.key}">${esc(f.label)}</button>`
        ).join("")}
      </div>
      <div id="ptsLedgerList" aria-live="polite">${ledgerBlock(ledger, filter)}</div>
    </section>`;
}

boot("student", "نقاطي", async ({ profile }) => {
  const view = document.getElementById("ptsView") || document.getElementById("content");
  const reloadBtn = document.getElementById("ptsReload");
  const kinds = isBachelorTrack(profile?.track);
  let ledgerCache = [];
  let filter = "all";

  function applyFilter(next) {
    filter = next;
    view.querySelectorAll("[data-filter]").forEach((btn) => {
      const active = btn.dataset.filter === filter;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
    const list = document.getElementById("ptsLedgerList");
    if (list) list.innerHTML = ledgerBlock(ledgerCache, filter);
  }

  async function load() {
    view.innerHTML = skeleton();
    if (reloadBtn) reloadBtn.disabled = true;
    try {
      const res = await call("student_points");
      if (!res.ok) {
        console.error("[student_points]", res.error);
        ledgerCache = [];
        view.innerHTML = errorBlock();
        return;
      }
      ledgerCache = Array.isArray(res.data?.ledger) ? res.data.ledger : [];
      view.innerHTML = renderPoints(res.data, filter, kinds);
    } catch (err) {
      console.error("[student_points]", err);
      ledgerCache = [];
      view.innerHTML = errorBlock();
    } finally {
      if (reloadBtn) reloadBtn.disabled = false;
    }
  }

  view.addEventListener("click", (e) => {
    const reload = e.target.closest("[data-reload]");
    if (reload) {
      load();
      return;
    }
    const btn = e.target.closest("[data-filter]");
    if (btn && btn.dataset.filter !== filter) applyFilter(btn.dataset.filter);
  });
  if (reloadBtn) reloadBtn.addEventListener("click", load);

  await load();
});

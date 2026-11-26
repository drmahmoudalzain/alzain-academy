import { navFor } from "./navigation.js";
import { icon } from "./icons.js";
import { esc } from "./fmt.js";
import { signOut, homeOf } from "./auth.js";
import { p } from "./base.js";
import { onDispose } from "./lifecycle.js";
import { previousEntry } from "./nav-history.js";

const PORTAL_LABELS = {
  student: "بوابة الطلاب",
  teacher: "بوابة الأساتذة",
  assistant: "بوابة المساعد الإداري",
  owner: "بوابة المالك",
};

// يرسم هيكل البوابة (شريط جانبي + شريط علوي + حاوية المحتوى) في #app.
export function renderShell({ portal, title, profile }) {
  const nav = navFor(portal, profile);
  const current = location.pathname;
  const name = profile?.name || "مستخدم";
  const sub = profile?.platform_id || profile?.position || PORTAL_LABELS[portal];

  const navHtml = nav
    .map((section) => {
      const items = section.items
        .map((item) => {
          const href = p(item.href);
          const active = current === href;
          return `<a href="${href}" class="nav-item${active ? " active" : ""}"${active ? ' aria-current="page"' : ""}>${icon(item.icon)}<span>${esc(item.label)}</span></a>`;
        })
        .join("");
      return `<div class="nav-section">${esc(section.section)}</div>${items}`;
    })
    .join("");

  return `
  <div class="app" data-portal="${esc(portal)}">
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-brand">
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M32 6v46"/><path d="M20 52h24"/><circle cx="32" cy="10" r="3" fill="currentColor" stroke="none"/>
          <path d="M10 18h44"/><path d="M10 18L4 32h12L10 18z"/><path d="M54 18L48 32h12L54 18z"/>
          <path d="M4 32a6 6 0 0 0 12 0"/><path d="M48 32a6 6 0 0 0 12 0"/>
        </svg>
        <div class="sidebar-brand-text"><strong>أكاديمية آل الزين</strong><small>للعلوم القانونية والعدلية</small></div>
      </div>
      <div class="sidebar-portal-badge">${esc(PORTAL_LABELS[portal])}</div>
      <nav class="sidebar-nav" aria-label="التنقل الرئيسي">${navHtml}</nav>
      <div class="sidebar-user">
        <div class="user-card">
          <div class="user-avatar">${esc((name.trim().charAt(0) || "؟"))}</div>
          <div class="user-info"><strong>${esc(name)}</strong><span>${esc(sub)}</span></div>
          <button type="button" class="sidebar-logout" id="logoutBtn" aria-label="تسجيل الخروج" title="تسجيل الخروج">${icon("logout")}</button>
        </div>
      </div>
    </aside>
    <div class="sidebar-overlay" id="sidebarOverlay" role="button" tabindex="-1" aria-label="إغلاق القائمة" aria-hidden="true"></div>
    <div class="main">
      <header class="topbar">
        <button class="menu-btn" id="menuBtn" aria-label="فتح القائمة" aria-expanded="false">القائمة</button>
        <div class="topbar-title"><h1>${esc(title)}</h1>
          <div class="breadcrumb"><span>الرئيسية</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon("chevron").replace("stroke-width=\"1.8\"", "stroke-width=\"2.4\"")}</svg><span>${esc(title)}</span></div>
        </div>
        <div class="topbar-end">
          <a class="icon-btn topbar-notif" href="${p("pages/notifications.html")}" aria-label="الإشعارات" title="الإشعارات">${icon("bell")}</a>
          <button class="topbar-back" id="backBtn" data-fallback="${esc(homeOf(profile))}" aria-label="رجوع" title="رجوع"><span class="back-label">رجوع</span></button>
        </div>
      </header>
      ${profile?.is_preview ? `<div class="preview-banner" role="status" style="margin:12px 16px 0;padding:10px 14px;border-radius:10px;background:#fff8e1;border:1px solid #e6c65c;color:#6b4f00;font-size:13px;font-weight:700;text-align:center;">وضع المعاينة — هذه واجهة عرض فقط ولا تعرض بيانات حقيقية. <a href="${p("login.html?v=2")}" style="color:#0B2545;text-decoration:underline;margin-inline-start:8px;">العودة لتسجيل الدخول</a></div>` : ""}
      <main class="content" id="content"></main>
    </div>
  </div>`;
}

// يبقى الهيكل كما هو في التنقّل الناعم؛ هذه الدوال تحدّثه بدل إعادة رسمه.
export function shellPortal() {
  return document.querySelector(".app")?.dataset.portal || null;
}

export function syncActiveNav(path = location.pathname) {
  document.querySelectorAll(".sidebar-nav a").forEach((a) => {
    const active = a.getAttribute("href") === path;
    a.classList.toggle("active", active);
    if (active) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

export function updateShellTitle(title) {
  const heading = document.querySelector(".topbar-title h1");
  if (heading) heading.textContent = title || "";
  const crumbs = document.querySelectorAll(".topbar-title .breadcrumb span");
  const last = crumbs[crumbs.length - 1];
  if (last) last.textContent = title || "";
}

// ربط سلوك الشريط الجانبي والرجوع والخروج. كل مستمع عام يُسجّل للإزالة.
export function bindShell() {
  const sidebar = document.getElementById("sidebar");
  const menuBtn = document.getElementById("menuBtn");
  const overlay = document.getElementById("sidebarOverlay");
  const listen = (target, type, fn) => {
    if (!target) return;
    target.addEventListener(type, fn);
    onDispose(() => target.removeEventListener(type, fn));
  };
  const setOpen = (open) => {
    if (!sidebar) return;
    sidebar.classList.toggle("open", open);
    overlay?.classList.toggle("is-open", open);
    menuBtn?.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("sidebar-open", open);
  };
  const close = () => setOpen(false);
  close();
  listen(window, "pageshow", close);
  listen(menuBtn, "click", () => setOpen(!sidebar.classList.contains("open")));
  listen(overlay, "click", close);
  listen(document, "keydown", (e) => e.key === "Escape" && close());
  document.querySelectorAll(".sidebar-nav a").forEach((a) => listen(a, "click", close));
  const backBtn = document.getElementById("backBtn");
  let goingBack = false;
  listen(backBtn, "click", () => {
    if (goingBack) return;
    const previous = previousEntry();
    if (!previous) {
      location.assign(backBtn?.dataset.fallback || "/");
      return;
    }
    goingBack = true;
    backBtn.disabled = true;
    window.history.back();
  });
  listen(window, "popstate", () => {
    goingBack = false;
    if (backBtn) backBtn.disabled = false;
  });
  const doLogout = () => signOut();
  listen(document.getElementById("logoutBtn"), "click", doLogout);
  syncActiveNav();
}

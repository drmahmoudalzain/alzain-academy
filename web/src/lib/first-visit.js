// نافذة الزيارة الأولى للزائر العام: تظهر مرة واحدة، ولا تحجب رابط الدليل.
export const SEEN_KEY = "alzain.firstVisitGuideSeen";

// ترتيب الثابتات مهم: يطابق ترتيب إزالة الأصناف في portal.js.
const AUTHENTICATED_PORTALS = ["portal-student", "portal-teacher", "portal-assistant", "portal-owner"];
const LOGIN_PAGE = "login.html";
const LOGIN_ROUTE = "login";

function isLoginPath(path) {
  const clean = path.replace(/\/+$/, "");
  return clean === LOGIN_PAGE || clean === LOGIN_ROUTE
    || clean.endsWith(`/${LOGIN_PAGE}`) || clean.endsWith(`/${LOGIN_ROUTE}`);
}

export function isPublicPath(pathname = "") {
  const path = String(pathname || "").toLowerCase();
  if (path.includes("/pages/")) return false;
  if (isLoginPath(path)) return false;
  return !/\.html$/.test(path) || /(^|\/)(index|guide)\.html$/.test(path);
}

export function hasSeen(storage) {
  try {
    return storage ? storage.getItem(SEEN_KEY) === "1" : localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markSeen(storage) {
  try {
    if (storage) storage.setItem(SEEN_KEY, "1");
    else localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // التخزين قد يكون معطلاً؛ تبقى النافذة قابلة للإغلاق يدوياً.
  }
}

const MODAL_CSS = `
.fv-first-visit {
  position: fixed;
  z-index: 60;
  inset-block-end: 18px;
  inset-inline-start: 18px;
  max-width: min(360px, calc(100vw - 36px));
  pointer-events: none;
}
.fv-card {
  position: relative;
  pointer-events: auto;
  padding: 18px 42px 18px 20px;
  border: 1px solid #E2E8F0;
  border-radius: 14px;
  background: #FFFFFF;
  color: #0B2545;
  box-shadow: 0 16px 40px -12px rgba(11, 37, 69, 0.3);
  font-family: "Tajawal", "Segoe UI", sans-serif;
  font-size: 0.92rem;
  line-height: 1.8;
}
.fv-card h2 { margin: 0 0 8px; font-size: 1.1rem; }
.fv-card p { margin: 0 0 12px; color: #4A5A6F; }
.fv-guide-link {
  display: inline-block;
  padding: 7px 14px;
  border-radius: 8px;
  background: #0B2545;
  color: #FFFFFF;
  font-weight: 700;
  text-decoration: none;
}
.fv-guide-link:hover { background: #123A63; }
.fv-close {
  position: absolute;
  inset-block-start: 8px;
  inset-inline-end: 8px;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #536579;
  font-size: 1.3rem;
  line-height: 1;
  cursor: pointer;
}
.fv-close:hover { background: #F1F4F8; }
@media print {
  .fv-first-visit { display: none !important; }
}`;

export function initFirstVisitModal() {
  if (typeof document === "undefined" || typeof location === "undefined") return null;
  if (!isPublicPath(location.pathname)) return null;
  if (AUTHENTICATED_PORTALS.some((name) => document.body.classList.contains(name))) return null;
  if (document.getElementById("fvFirstVisit")) return null;
  if (hasSeen()) return null;

  const style = document.createElement("style");
  style.textContent = MODAL_CSS;
  document.head.appendChild(style);

  const wrap = document.createElement("div");
  wrap.id = "fvFirstVisit";
  wrap.className = "fv-first-visit";
  wrap.innerHTML = `
    <div class="fv-card" role="dialog" aria-modal="false" aria-labelledby="fvTitle" aria-describedby="fvText">
      <button type="button" class="fv-close" aria-label="إغلاق التنبيه">×</button>
      <h2 id="fvTitle">مرحباً بك في أكاديمية آل الزين</h2>
      <p id="fvText">يمكنك التعرّف على البوابات الأربع وخطوات الدخول ونظام الدرجات من دليل المستخدم، ويبقى متاحاً للطباعة أو الحفظ كملف PDF.</p>
      <a class="fv-guide-link" href="guide.html">افتح دليل المستخدم</a>
    </div>`;
  document.body.appendChild(wrap);

  markSeen();

  const close = () => {
    wrap.remove();
    style.remove();
  };
  wrap.querySelector(".fv-close")?.addEventListener("click", close);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  return wrap;
}

if (typeof document !== "undefined" && typeof location !== "undefined" && isPublicPath(location.pathname)) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFirstVisitModal, { once: true });
  } else {
    initFirstVisitModal();
  }
}

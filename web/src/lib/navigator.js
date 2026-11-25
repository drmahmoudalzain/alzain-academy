import { setPendingPreset, takeMount, beginSoftNav, endSoftNav, isSoftNav } from "./page-registry.js";
import { disposeAll } from "./lifecycle.js";

export { beginSoftNav, endSoftNav, isSoftNav };

let started = false;
let navCount = 0;

// صفحات ذات حالة خاصة (حفظ مؤجّل / مؤقتات / تحذير مغادرة) تبقى بتنقّل كامل.
function isExcluded(url) {
  return /login\.html$/.test(url.pathname) || /(^|\/)pages\/student\/exam\.html$/.test(url.pathname);
}

function canIntercept(url, allowSame = false) {
  if (url.origin !== location.origin) return false;
  if (isExcluded(url) || isExcluded(location)) return false;
  if (!allowSame && url.pathname === location.pathname && url.search === location.search) return false;
  return /\.(html|php)$/.test(url.pathname) || url.pathname.endsWith("/");
}

function addStyles(doc, baseUrl) {
  const existing = [...document.querySelectorAll('link[rel="stylesheet"][href]')].map((link) =>
    new URL(link.href, location.href).href,
  );
  doc.querySelectorAll('link[rel="stylesheet"][href]').forEach((link) => {
    const href = new URL(link.getAttribute("href"), baseUrl).href;
    if (existing.includes(href)) return;
    const node = document.createElement("link");
    node.rel = "stylesheet";
    node.href = href;
    document.head.appendChild(node);
    existing.push(href);
  });
}

async function navigate(url, push) {
  let done = false;
  try {
    beginSoftNav();
    const response = await fetch(`${url.pathname}${url.search}`, {
      headers: { "X-Requested-With": "fetch" },
    });
    if (!response.ok) throw new Error(`fetch ${response.status}`);

    const html = await response.text();
    const target = new DOMParser().parseFromString(html, "text/html");
    const script = target.querySelector('script[type="module"][src]');
    if (!script) throw new Error("no page module in target HTML");

    const preset = target.getElementById("content")?.innerHTML || "";
    addStyles(target, url);
    if (push) history.pushState({ soft: true }, "", `${url.pathname}${url.search}${url.hash}`);
    if (target.title) document.title = target.title;
    setPendingPreset(preset);

    // استيراد بعنوان مختلف في كل مرة كي تُعاد تهيئة حالة وحدة الصفحة.
    const src = new URL(script.getAttribute("src"), url).href;
    const moduleUrl = `${src}${src.includes("?") ? "&" : "?"}nav=${++navCount}`;
    // نظّف الصفحة القديمة قبل استيراد الجديدة؛ التسجيلات على مستوى الوحدة
    // يجب أن تبقى للصفحة القادمة، لذلك لا تُنظَّف داخل mount().
    disposeAll();
    await import(moduleUrl);

    const mount = takeMount(url.pathname);
    if (typeof mount !== "function") throw new Error("page did not register a mount");
    await mount();
    done = true;
    window.scrollTo({ top: 0, behavior: "instant" });
  } catch (err) {
    console.warn("soft navigation failed, falling back", err);
  } finally {
    endSoftNav();
  }
  if (!done) location.assign(url.href);
}

export function initNavigator() {
  if (started) return;
  started = true;

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest?.("a[href]");
    if (!anchor || anchor.target && anchor.target !== "_self" || anchor.hasAttribute("download")) return;
    if (anchor.dataset.noSoft !== undefined || anchor.getAttribute("rel") === "external") return;
    const url = new URL(anchor.getAttribute("href"), location.href);
    if (!canIntercept(url)) return;
    event.preventDefault();
    void navigate(url, true);
  });

  window.addEventListener("popstate", () => {
    const url = new URL(location.href);
    if (!canIntercept(url, true)) {
      location.reload();
      return;
    }
    void navigate(url, false);
  });
}

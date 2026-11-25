import { esc } from "./fmt.js";

// أشكال هيكل التحميل حسب نوع البيانات التي ستظهر.
const SHAPES = {
  stats: "stat",
  cards: "card",
  rows: "row",
  hero: "hero",
  table: "table",
  profile: "profile",
  chat: "chat",
};

export function skeleton(kind = "cards", count = 3) {
  const shape = SHAPES[kind] || "card";
  const total = Math.max(1, Math.min(12, Number(count) || 1));
  return Array.from(
    { length: total },
    () => `<div class="ld-skeleton ld-skeleton--${shape}" aria-hidden="true"></div>`,
  ).join("");
}

export async function runTask(el, kind, loader, count = 3) {
  if (el) el.innerHTML = skeleton(kind, count);
  try {
    const result = await loader();
    if (el) el.innerHTML = typeof result === "string" ? result : "";
    return result;
  } catch (err) {
    if (el) el.innerHTML = `<div class="ld-error" role="alert">${esc(String(err?.message || err))}</div>`;
    return null;
  }
}

export function busy(button, pending) {
  if (!button) return;
  button.disabled = Boolean(pending);
  if (pending) button.classList?.add("is-busy");
  else button.classList?.remove("is-busy");
  if (pending) button.setAttribute?.("aria-busy", "true");
  else button.removeAttribute?.("aria-busy");
}

// شريط تقدّم خفيف أعلى الصفحة أثناء التنقّل الناعم.
export function routeProgress() {
  if (typeof document === "undefined") return { start() {}, end() {} };
  let bar = document.getElementById("routeProgress");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "routeProgress";
    bar.className = "route-progress";
    document.body.appendChild(bar);
  }
  let slowTimer = null;
  return {
    start() {
      bar.classList.add("is-active");
      clearTimeout(slowTimer);
      slowTimer = setTimeout(() => bar.classList.add("is-slow"), 600);
    },
    end() {
      clearTimeout(slowTimer);
      bar.classList.remove("is-active", "is-slow");
    },
  };
}

// مسار الاستضافة: Vite يضبطه تلقائياً حسب base في vite.config.js.
// في التطوير = "/"، وعلى GitHub Pages = "/alzain-academy/".
export const BASE = import.meta.env.BASE_URL || "/";

// يبني رابطاً داخل الموقع مع مراعاة base.
export function p(path) {
  const clean = String(path).replace(/^\/+/, "");
  return `${BASE}${clean}`;
}

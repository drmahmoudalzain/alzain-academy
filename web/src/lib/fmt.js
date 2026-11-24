// أدوات تنسيق التواريخ والأرقام بالعربية.

const dateFmt = new Intl.DateTimeFormat("ar", { day: "numeric", month: "long", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("ar", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const numFmt = new Intl.NumberFormat("ar-EG");

export function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return dateFmt.format(d);
}

export function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return dateTimeFmt.format(d);
}

export function fmtNum(n) {
  if (n === null || n === undefined || n === "") return "—";
  return numFmt.format(Number(n));
}

export function fmtPoints(n) {
  if (n === null || n === undefined) return "0";
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

export function rel(iso) {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return iso;
  const diff = d - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  if (mins < 60) return diff < 0 ? `منذ ${mins} دقيقة` : `بعد ${mins} دقيقة`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return diff < 0 ? `منذ ${hours} ساعة` : `بعد ${hours} ساعة`;
  const days = Math.round(hours / 24);
  return diff < 0 ? `منذ ${days} يوم` : `بعد ${days} يوم`;
}

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

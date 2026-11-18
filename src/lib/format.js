// أدوات تنسيق عربية موحّدة للتواريخ والأرقام.
const dateFmt = new Intl.DateTimeFormat("ar", {
  calendar: "gregory",
  numberingSystem: "latn",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const shortDateFmt = new Intl.DateTimeFormat("ar", {
  calendar: "gregory",
  numberingSystem: "latn",
  day: "numeric",
  month: "short",
});

const timeFmt = new Intl.DateTimeFormat("ar", {
  calendar: "gregory",
  numberingSystem: "latn",
  hour: "2-digit",
  minute: "2-digit",
});

const weekdayFmt = new Intl.DateTimeFormat("ar", {
  calendar: "gregory",
  numberingSystem: "latn",
  weekday: "long",
});

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value) {
  const date = toDate(value);
  return date ? dateFmt.format(date) : "—";
}

export function formatShortDate(value) {
  const date = toDate(value);
  return date ? shortDateFmt.format(date) : "—";
}

export function formatTime(value) {
  const date = toDate(value);
  return date ? timeFmt.format(date) : "—";
}

export function formatDateTime(value) {
  const date = toDate(value);
  return date ? `${dateFmt.format(date)} — ${timeFmt.format(date)}` : "—";
}

export function formatWeekday(value) {
  const date = toDate(value);
  return date ? weekdayFmt.format(date) : "—";
}

export function formatNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? new Intl.NumberFormat("ar", { numberingSystem: "latn" }).format(number) : "0";
}

export function formatPercent(value) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return "0%";
  return `${Math.round(number)}%`;
}

export function monthShort(value) {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("ar", { calendar: "gregory", numberingSystem: "latn", month: "short" })
    .format(date)
    .replace("٫", "");
}

export function monthDay(value) {
  const date = toDate(value);
  if (!date) return { day: "—", month: "—" };
  return {
    day: new Intl.DateTimeFormat("ar", { calendar: "gregory", numberingSystem: "latn", day: "numeric" }).format(date),
    month: monthShort(date),
  };
}

export function relativeTime(value) {
  const date = toDate(value);
  if (!date) return "—";
  const diff = Date.now() - date.getTime();
  const abs = Math.abs(diff);
  const minutes = Math.round(abs / 60000);
  const hours = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);

  let text;
  if (minutes < 1) text = "الآن";
  else if (minutes < 60) text = `${minutes} دقيقة`;
  else if (hours < 24) text = `${hours} ساعة`;
  else if (days < 30) text = `${days} يوم`;
  else text = dateFmt.format(date);

  if (text === "الآن") return text;
  return diff >= 0 ? `منذ ${text}` : `بعد ${text}`;
}

export function durationText(minutes) {
  const value = Number(minutes ?? 0);
  if (!value) return "—";
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  if (!hours) return `${mins} دقيقة`;
  if (!mins) return `${hours} ساعة`;
  return `${hours} ساعة و${mins} دقيقة`;
}

export function durationClock(minutes) {
  const value = Math.max(0, Number(minutes ?? 0));
  const seconds = Math.round(value * 60);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function sameDay(a, b) {
  const first = toDate(a);
  const second = toDate(b);
  if (!first || !second) return false;
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

export function isPast(value) {
  const date = toDate(value);
  return date ? date.getTime() < Date.now() : false;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

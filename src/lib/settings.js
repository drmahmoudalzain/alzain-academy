import { db } from "./supabase.js";

const DEFAULTS = {
  platform_name: "منصة آل الزين للعلوم القانونية والعدلية",
  platform_tagline: "المنصة التعليمية المتكاملة للعلوم القانونية والعدلية",
  watermark_text: "نسخة خاصة — غير مسموح بالمشاركة",
  watermark_latin: "AlZain Legal & Judicial",
  ai_provider: "gemini",
  ai_model: "gemini-2.5-flash",
  ai_api_key: "",
  allow_student_register: "0",
  owner_all_gates: "0",
};

let cache = { at: 0, map: { ...DEFAULTS } };
const TTL_MS = 30_000;

export async function getSettings({ force = false } = {}) {
  if (!force && Date.now() - cache.at < TTL_MS) return cache.map;

  const { data, error } = await db.from("settings").select("key, value");
  if (error) {
    console.error("تعذر تحميل الإعدادات:", error.message);
    return cache.map;
  }

  const map = { ...DEFAULTS };
  for (const row of data ?? []) {
    if (row.value !== null && row.value !== undefined) map[row.key] = row.value;
  }
  cache = { at: Date.now(), map };
  return map;
}

export function setSettingCache(key, value) {
  cache.map = { ...cache.map, [key]: value };
  cache.at = Date.now();
}

export function isFlagOn(settings, key) {
  return String(settings?.[key] ?? "0") === "1" || String(settings?.[key]).toLowerCase() === "true";
}

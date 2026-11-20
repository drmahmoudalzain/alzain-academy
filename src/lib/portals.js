// بوابات الدخول الأربع والفصل الصارم بينها (منطق الخادم، وليس الواجهة فقط).
import { db } from "./supabase.js";
import { roleCan } from "./permissions.js";

export const PORTALS = {
  owner: {
    key: "owner",
    label: "بوابة المالك",
    short: "المالك",
    latin: "Owner Access",
    icon: "",
    theme: "owner",
    home: "/owner",
    audience: "مالك الأكاديمية",
  },
  teacher: {
    key: "teacher",
    label: "بوابة الأساتذة",
    short: "الأستاذ",
    latin: "Faculty Access",
    icon: "",
    theme: "teacher",
    home: "/teacher",
    audience: "الأساتذة",
  },
  student: {
    key: "student",
    label: "بوابة الطلاب",
    short: "الطالب",
    latin: "Student Access",
    icon: "",
    theme: "student",
    home: "/student",
    audience: "الطلاب",
  },
  assistant: {
    key: "assistant",
    label: "بوابة المساعد الإداري",
    short: "المساعد الإداري",
    latin: "Assistant Access",
    icon: "",
    theme: "assistant",
    home: "/assistant",
    audience: "المساعدين الإداريين",
  },
};

export function isPortalKey(value) {
  return Object.hasOwn(PORTALS, value);
}

export function portalOf(value) {
  return isPortalKey(value) ? PORTALS[value] : null;
}

let founderCache = { at: 0, id: null };
const FOUNDER_TTL_MS = 60_000;

/** المالك هو أول أستاذ (أقل id في users بدور teacher). */
export async function founderId({ force = false } = {}) {
  if (!force && Date.now() - founderCache.at < FOUNDER_TTL_MS) return founderCache.id;

  const { data, error } = await db
    .from("users")
    .select("id")
    .eq("role", "teacher")
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("تعذر تحديد المالك:", error.message);
    return founderCache.id;
  }

  founderCache = { at: Date.now(), id: data?.id ?? null };
  return founderCache.id;
}

export async function isFounder(user, options = {}) {
  if (!user) return false;
  const id = await founderId(options);
  return id !== null && user.id === id;
}

/**
 * صلاحية دخول بوابة محددة.
 * owner: المالك فقط.
 * teacher: الأساتذة فقط، ويُستثنى المالك إلا عند تفعيل owner_all_gates.
 * student: الطلاب فقط، ويُستثنى المالك إلا عند تفعيل owner_all_gates.
 * assistant: المساعد الإداري فقط، بصلاحياته المحدودة في permissions.js.
 */
export async function canEnterPortal(user, portal, { ownerAllGates = false } = {}) {
  if (!user || !isPortalKey(portal)) return false;

  const founder = await isFounder(user);
  if (portal === "owner") return founder;

  if (portal === "teacher") {
    return user.role === "teacher" && (!founder || ownerAllGates);
  }

  if (portal === "assistant") {
    return roleCan("assistant", "students.view") && user.role === "assistant" && (!founder || ownerAllGates);
  }

  return user.role === "student" || (founder && ownerAllGates);
}

/** البوابة الأساسية للمستخدم (حسب دوره). */
export async function primaryPortal(user) {
  if (!user) return null;
  if (await isFounder(user)) return "owner";
  if (user.role === "teacher") return "teacher";
  if (user.role === "assistant") return "assistant";
  return "student";
}

import { supabase } from "./supabase.js";
import { p } from "./base.js";
import { setCacheUser, peek, set, clear } from "./cache.js";
import { profileFromMetadata } from "./profile.js";
import { clearNavHistory } from "./nav-history.js";

export const PREVIEW_KEY = "alzain_preview_role";
const PREVIEW_PROFILES = {
  owner: { id: "preview-owner", role: "teacher", name: "معاينة المدير", platform_id: "AD0000", position: "مدير المنصة", is_preview: true },
  teacher: { id: "preview-teacher", role: "teacher", name: "معاينة الأستاذ", platform_id: "TE0000", position: "أستاذ", is_preview: true },
  assistant: { id: "preview-assistant", role: "assistant", name: "معاينة المساعد الإداري", platform_id: "AS0000", position: "مساعد إداري", is_preview: true },
  student: { id: "preview-student", role: "student", name: "معاينة الطالب", platform_id: "ST0000", track: "bachelor_m", level: 1, is_preview: true },
};

export function getPreviewRole() {
  try { return sessionStorage.getItem(PREVIEW_KEY); } catch { return null; }
}
export function setPreviewRole(role) {
  try { sessionStorage.setItem(PREVIEW_KEY, role); } catch {}
}
export function clearPreviewRole() {
  try { sessionStorage.removeItem(PREVIEW_KEY); } catch {}
}
export function previewProfileFor(role) {
  const profile = PREVIEW_PROFILES[role];
  return profile ? { ...profile } : null;
}

// جلسة المستخدم الحالية (auth.users) أو null.
export async function currentUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

// ملف المستخدم من جدول users (مرتبط عبر auth_id)، مع احتياط من metadata.
// تُخزَّن صفوف users الناجحة فقط؛ الاحتياطي يُعاد بلا كاش حتى لا يثبت خطأ عابر.
export async function getProfile(user) {
  if (!user) return null;
  setCacheUser(user.id);

  const key = `profile:${user.id}`;
  const cached = peek(key);
  if (cached) return cached;

  const { data, error } = await supabase
    .from("users")
    .select("id, role, name, email, phone, platform_id, university_id, track, level, gender, position, is_staff, must_change_password")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!error && data) return set(key, data, 300000);
  return profileFromMetadata(user);
}

// البوابة الفعلية حسب الدور (المالك = أستاذ برمز AD).
export function portalOf(profile) {
  const role = profile?.role;
  if (role === "teacher" && String(profile?.platform_id || "").toUpperCase().startsWith("AD")) return "owner";
  return role;
}

export function homeOf(profile) {
  const portal = portalOf(profile);
  return p(`pages/${portal}/dashboard.html`);
}

// يتطلب تسجيل دخول؛ يعيد الملف أو يحوّل إلى صفحة الدخول.
// في وضع المعاينة (بدون جلسة حقيقية) يُعاد ملف اصطناعي لعرض الواجهة فقط.
export async function requireProfile() {
  const user = await currentUser();
  if (!user) {
    const previewRole = getPreviewRole();
    const preview = previewProfileFor(previewRole);
    if (preview) return { profile: preview, preview: true };
    const next = encodeURIComponent(location.pathname + location.search);
    location.replace(p(`login.html?v=2&next=${next}`));
    return { profile: null };
  }
  const profile = await getProfile(user);
  if (!profile) {
    await supabase.auth.signOut();
    location.replace(p("login.html?v=2"));
    return { profile: null };
  }
  return { profile };
}

export async function signOut() {
  clearPreviewRole();
  clearNavHistory();
  await supabase.auth.signOut();
  clear();
  location.assign(p("login.html?v=2"));
}

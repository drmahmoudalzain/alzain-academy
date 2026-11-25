import { supabase } from "./supabase.js";
import { p } from "./base.js";
import { setCacheUser, peek, set, clear } from "./cache.js";
import { profileFromMetadata } from "./profile.js";

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
export async function requireProfile() {
  const user = await currentUser();
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    location.replace(p(`login.html?next=${next}`));
    return { profile: null };
  }
  const profile = await getProfile(user);
  if (!profile) {
    await supabase.auth.signOut();
    location.replace(p("login.html"));
    return { profile: null };
  }
  return { profile };
}

export async function signOut() {
  await supabase.auth.signOut();
  clear();
  location.assign(p("login.html"));
}

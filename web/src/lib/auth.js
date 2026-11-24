import { supabase } from "./supabase.js";
import { p } from "./base.js";

// جلسة المستخدم الحالية (auth.users) أو null.
export async function currentUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

// ملف المستخدم من جدول users (مرتبط عبر auth_id)، مع احتياط من metadata.
export async function getProfile(user) {
  if (!user) return null;
  const { data, error } = await supabase
    .from("users")
    .select("id, role, name, email, phone, platform_id, university_id, track, level, gender, position, is_staff, must_change_password")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!error && data) return data;

  const md = user.user_metadata || {};
  const am = user.app_metadata || {};
  return {
    id: am.academy_user_id ?? null,
    role: am.role || "student",
    name: md.full_name || user.email || "مستخدم",
    email: md.contact_email || null,
    phone: md.phone || null,
    platform_id: md.platform_id || null,
    university_id: null,
    track: null,
    level: null,
    gender: null,
    position: null,
    is_staff: am.role === "teacher" || am.role === "assistant",
    must_change_password: false,
  };
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
  location.assign(p("login.html"));
}

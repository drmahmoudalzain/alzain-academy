// الرمز الموحد للمنصة (Platform Code) + توليد كلمات المرور المؤقتة.
// البوادئ: BM/BF/EQ/EX/PG للطلاب حسب مسارهم، TE للأستاذ، AS للمساعد الإداري، AD للمالك.
import crypto from "node:crypto";
import { db } from "./supabase.js";
import { hashPassword } from "./password.js";
import { parseStudentTrack } from "./tracks.js";

export const PREFIX_BY_TRACK = {
  bachelor_m: "BM",
  bachelor_f: "BF",
  equiv: "EQ",
  external: "EX",
  grad: "PG",
};

export const PREFIX_BY_ROLE = { teacher: "TE", assistant: "AS" };

export const PREFIX_OWNER = "AD";

/** بادئة الرمز المناسبة لسياق إنشاء الحساب. */
export function prefixFor({ role, track, founder = false }) {
  if (role === "teacher") return founder ? PREFIX_OWNER : PREFIX_BY_ROLE.teacher;
  if (role === "assistant") return PREFIX_BY_ROLE.assistant;
  return PREFIX_BY_TRACK[track] ?? "BM";
}

/** التالي في التسلسل لبادئة معيّنة (مثلاً BM0004 بعد BM0003). */
export async function nextPlatformId(prefix) {
  // لا نعتمد على الترتيب النصّي لأن «BM9999» يأتي بعد «BM10000» نصّياً،
  // فيتكرر الرمز عند تجاوز 9999. نحسب أعلى رقم فعلياً.
  const { data, error } = await db
    .from("users")
    .select("platform_id")
    .ilike("platform_id", `${prefix}%`);
  if (error) throw error;

  let highest = 0;
  const wanted = String(prefix).toUpperCase();
  for (const row of data ?? []) {
    const match = String(row.platform_id ?? "").match(/^([A-Za-z]+)(\d+)$/);
    if (!match || match[1].toUpperCase() !== wanted) continue;
    highest = Math.max(highest, Number(match[2]));
  }

  const next = highest + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

const PASSWORD_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

/** كلمة مرور مؤقتة مقروءة (بلا رموز ملتبسة مثل O/0 وl/1) بطول 10. */
export function generateTempPassword(length = 10) {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += PASSWORD_ALPHABET[bytes[i] % PASSWORD_ALPHABET.length];
  }
  return out;
}

/**
 * تهيئة حساب كامل: توليد الرمز + كلمة المرور + الإدراج في قاعدة البيانات.
 * يُرجع { user, password, platformId } — يجب عدم تخزين password.
 */
export async function provisionUser({ role, name, track = null, level = null, universityId = null, email = null, position = null }) {
  const password = generateTempPassword();
  // حساب الطالب لا يقبل «bachelor» (مسار المقرر الأصلي)؛ أي قيمة غير صالحة تُستبدل بالافتراضي
  // حتى لا تفشل قاعدة البيانات بسبب قيد users_track_check.
  const studentTrack = role === "student" ? parseStudentTrack(track) : null;
  const prefix = prefixFor({ role, track: studentTrack, founder: role === "teacher" ? !(await anyTeacherExists()) : false });

  // إعادة المحاولة عند تسابق بين طلبين على نفس التسلسل
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const platformId = await nextPlatformId(prefix);
    const created = await db
      .from("users")
      .insert({
        role,
        name,
        email,
        university_id: universityId,
        position,
        track: studentTrack,
        level: role === "student" ? level : null,
        password_hash: hashPassword(password),
        platform_id: platformId,
        must_change_password: true,
        is_active: true,
        is_staff: role === "teacher" || role === "assistant",
      })
      .select("id, name, role, email, university_id, platform_id")
      .maybeSingle();

    if (!created.error) return { user: created.data, password, platformId };
    if (!String(created.error.message ?? "").includes("platform_id")) throw created.error;
  }
  throw new Error("تعذر توليد رمز فريد للحساب بعد عدة محاولات.");
}

async function anyTeacherExists() {
  const { count, error } = await db.from("users").select("*", { count: "exact", head: true }).eq("role", "teacher");
  if (error) return true; // عند الشك اعتبر أنّ هناك أساتذة (لا تُمنح AD لغير المؤسس)
  return (count ?? 0) > 0;
}

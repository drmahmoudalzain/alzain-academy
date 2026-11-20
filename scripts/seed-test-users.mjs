import { db } from "../src/lib/supabase.js";
import { hashPassword } from "../src/lib/password.js";
import { founderId } from "../src/lib/portals.js";
import { nextPlatformId, prefixFor } from "../src/lib/platformCode.js";

// إعداد الحسابات التجريبية من الصفر — يولّد الرمز الموحد تلقائياً.
// لا تُخزَّن كلمات مرور حقيقية في المستودع؛ استخدم متغيرات SEED_* عند الحاجة.
const OWNER_SEED_PASSWORD = process.env.SEED_OWNER_PASSWORD ?? "CHANGE_ME_OWNER";
const TEACHER_SEED_PASSWORD = process.env.SEED_TEACHER_PASSWORD ?? "CHANGE_ME_TEACHER";
const STUDENT_SEED_PASSWORD = process.env.SEED_STUDENT_PASSWORD ?? "CHANGE_ME_STUDENT";

const TEST_USERS = [
  {
    role: "teacher",
    name: "د. محمود الزين عبدالله",
    email: "admin@lectures.local",
    password: OWNER_SEED_PASSWORD,
    position: "مالك الأكاديمية",
    is_staff: true,
  },
  {
    role: "teacher",
    name: "أ. سامي الحربي",
    email: "teacher@test.local",
    password: TEACHER_SEED_PASSWORD,
    position: "أستاذ القانون",
    is_staff: true,
  },
  {
    role: "student",
    name: "أحمد سالم باوزير",
    email: "student@test.local",
    university_id: "2024001",
    password: STUDENT_SEED_PASSWORD,
    track: "bachelor_m",
    level: 1,
    gender: "M",
    is_staff: false,
  },
];

async function upsertUser(spec) {
  const { password, ...fields } = spec;

  const existing = await db
    .from("users")
    .select("id, email, university_id, platform_id")
    .or(
      [
        spec.email ? `email.eq.${spec.email}` : null,
        spec.university_id ? `university_id.eq.${spec.university_id}` : null,
      ]
        .filter(Boolean)
        .join(",")
    )
    .maybeSingle();

  if (existing.error) throw existing.error;

  const payload = {
    ...fields,
    password_hash: hashPassword(password),
    is_active: true,
    must_change_password: false,
  };

  if (existing.data) {
    const updated = await db.from("users").update(payload).eq("id", existing.data.id).select("id, platform_id").single();
    if (updated.error) throw updated.error;
    console.log(`↻ محدث: ${fields.name} (id=${existing.data.id}, ${updated.data.platform_id ?? "—"})`);
    return updated.data.id;
  }

  // حساب جديد: تعيين الرمز الموحد حسب الدور/المسار
  const anyTeacher = fields.role === "teacher"
    ? (await db.from("users").select("*", { count: "exact", head: true }).eq("role", "teacher")).count ?? 0
    : 0;
  const prefix = prefixFor({ role: fields.role, track: fields.track, founder: fields.role === "teacher" && anyTeacher === 0 });
  payload.platform_id = await nextPlatformId(prefix);

  const inserted = await db.from("users").insert(payload).select("id, platform_id").single();
  if (inserted.error) throw inserted.error;
  console.log(`+ أُنشئ: ${fields.name} (id=${inserted.data.id}, ${inserted.data.platform_id})`);
  return inserted.data.id;
}

for (const spec of TEST_USERS) {
  await upsertUser(spec);
}

const founder = await founderId({ force: true });
console.log(`\nالمالك (founder) في القاعدة id=${founder}`);
console.log("حسابات الدخول:");
console.log("  المالك:  AD0001 / " + OWNER_SEED_PASSWORD);
console.log("  الأستاذ: TE0001 / " + TEACHER_SEED_PASSWORD);
console.log("  الطالب:  BM0001 / " + STUDENT_SEED_PASSWORD);

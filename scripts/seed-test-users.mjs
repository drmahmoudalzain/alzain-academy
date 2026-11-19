import { db } from "../src/lib/supabase.js";
import { hashPassword } from "../src/lib/password.js";
import { founderId } from "../src/lib/portals.js";

// بيانات اختبار مؤقتة للتحقق من البوابات — تُحذف قبل الإطلاق الفعلي.
const TEST_USERS = [
  {
    role: "teacher",
    name: "د. محمود الزين عبدالله",
    email: "admin@lectures.local",
    password: "HLDCCYJJDZT3",
    position: "مالك الأكاديمية",
    is_staff: true,
  },
  {
    role: "teacher",
    name: "أ. سامي الحربي",
    email: "teacher@test.local",
    password: "Teacher1234",
    position: "أستاذ مقررات",
    is_staff: true,
  },
  {
    role: "student",
    name: "أحمد سالم باوزير",
    email: "student@test.local",
    university_id: "2024001",
    password: "Student1234",
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
    .select("id, email, university_id")
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
    const updated = await db.from("users").update(payload).eq("id", existing.data.id).select("id").single();
    if (updated.error) throw updated.error;
    console.log(`↻ محدَّث: ${fields.name} (id=${existing.data.id})`);
    return updated.data.id;
  }

  const inserted = await db.from("users").insert(payload).select("id").single();
  if (inserted.error) throw inserted.error;
  console.log(`＋ أُنشئ: ${fields.name} (id=${inserted.data.id})`);
  return inserted.data.id;
}

for (const spec of TEST_USERS) {
  await upsertUser(spec);
}

const founder = await founderId({ force: true });
console.log(`\n👑 المالك (founder) هو المستخدم id=${founder}`);
console.log("بيانات الدخول للاختبار:");
console.log("  المالك:  admin@lectures.local / HLDCCYJJDZT3");
console.log("  أستاذ:   teacher@test.local / Teacher1234");
console.log("  طالب:    2024001 أو student@test.local / Student1234");

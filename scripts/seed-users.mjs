// بذر المستخدمين التجريبيين (المالك + 8 طلاب) — على قاعدة فارغة فقط.
import fs from "node:fs";
import crypto from "node:crypto";

const env = Object.fromEntries(
  fs.readFileSync(".env", "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const URL_ = env.SUPABASE_URL;
const KEY = env.SUPABASE_SECRET_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

// لا تُخزَّن كلمات مرور حقيقية في المستودع؛ استخدم متغيرات SEED_* عند الحاجة.
const OWNER_SEED_PASSWORD = process.env.SEED_OWNER_PASSWORD ?? "CHANGE_ME_OWNER";
const STUDENT_SEED_PASSWORD = process.env.SEED_STUDENT_PASSWORD ?? "CHANGE_ME_STUDENT";

// scrypt: format  s1$N$r$p$saltB64$hashB64
function hashPassword(password) {
  const N = 16384, r = 8, p = 1, keylen = 64;
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, keylen, { N, r, p });
  return `s1$${N}$${r}$${p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

const founder = {
  role: "teacher", name: "د. محمود الزين عبدالله",
  email: "admin@lectures.local", position: "المالك - مالك الأكاديمية",
  is_staff: true, must_change_password: false, password: OWNER_SEED_PASSWORD, platform_id: "AD0001",
};

const trackOf = (uid, gender) => (gender === "F" ? "bachelor_f" : uid === "2024003" ? "equiv" : "bachelor_m");
const prefixOf = (uid, gender) => (gender === "F" ? "BF" : uid === "2024003" ? "EQ" : "BM");

const students = [
  ["2024001", "أحمد سالم باوزير",     "M", STUDENT_SEED_PASSWORD],
  ["2024002", "فاطمة علي الحسني",    "F", STUDENT_SEED_PASSWORD],
  ["2024003", "محمد عبدالعزيز الشمري", "M", STUDENT_SEED_PASSWORD],
  ["2024004", "نورة سعد القحطاني",   "F", STUDENT_SEED_PASSWORD],
  ["2024005", "عمر خالد العمري",     "M", STUDENT_SEED_PASSWORD],
  ["2024006", "سارة يوسف الزهراني",  "F", STUDENT_SEED_PASSWORD],
  ["2024007", "خالد إبراهيم الغامدي", "M", STUDENT_SEED_PASSWORD],
  ["2024008", "ريم محمد الدوسري",    "F", STUDENT_SEED_PASSWORD],
];

async function rest(path, opts = {}) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

// عربة: هل يوجد مستخدمون بالفعل؟ (خروج إن وُجد أي مستخدم)
const existing = await rest("users?select=id,name,role&order=id");
if (existing.length > 0) {
  console.log("المستخدمون موجودون بالفعل:", JSON.stringify(existing, null, 2));
  process.exit(0);
}

const founderPassword = founder.password;
let seq = { BM: 0, BF: 0, EQ: 0 };
const usersPayload = [
  {
    role: founder.role, name: founder.name, email: founder.email,
    university_id: null, phone: null, gender: null,
    position: founder.position, is_staff: founder.is_staff,
    must_change_password: founder.must_change_password,
    password_hash: hashPassword(founderPassword),
    is_active: true, track: "bachelor_m", level: 1,
    platform_id: founder.platform_id,
  },
  ...students.map(([uid, name, gender, pwd]) => {
    const prefix = prefixOf(uid, gender);
    seq[prefix] += 1;
    const platformId = `${prefix}${String(seq[prefix]).padStart(4, "0")}`;
    return {
      role: "student", name, email: null, university_id: uid, phone: null, gender,
      position: null, is_staff: false,
      password_hash: hashPassword(pwd),
      must_change_password: uid === "2024002",
      is_active: true, track: trackOf(uid, gender), level: 1,
      platform_id: platformId,
    };
  }),
];

const inserted = await rest("users", {
  method: "POST",
  headers: { Prefer: "return=representation" },
  body: JSON.stringify(usersPayload),
});

console.log(JSON.stringify(
  inserted.map((u) => ({ id: u.id, role: u.role, name: u.name, platform_id: u.platform_id, university_id: u.university_id, is_staff: u.is_staff })),
  null, 2
));
console.log("\nالدخول بالرموز الموحدة فقط (لا بريد):");
console.log("  المالك: AD0001 / " + OWNER_SEED_PASSWORD);
console.log("  الطالبات/الطلاب: BM0001..BM0003 · BF0001..BF0002 · EQ0001");

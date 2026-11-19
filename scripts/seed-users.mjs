// زرع المستخدمين التجريبيين (المالك + 8 طلاب) — آمن لإعادة التشغيل (يتخطى إن وُجد مستخدمون)
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

// scrypt: format  s1$N$r$p$saltB64$hashB64
function hashPassword(password) {
  const N = 16384, r = 8, p = 1, keylen = 64;
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, keylen, { N, r, p });
  return `s1$${N}$${r}$${p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

const founder = {
  role: "teacher", name: "د. محمود الزين عبدالله",
  email: "admin@lectures.local", position: "المالك — مدير المنصة",
  is_staff: true, must_change_password: false, password: "HLDCCYJJDZT3",
};

const students = [
  ["2024001", "أحمد سالم باوزير",     "M", "Student1234"],
  ["2024002", "فاطمة علي الحسني",     "F", "MGKGQ3QGUW"],
  ["2024003", "محمد عبدالله الشمري",  "M", "5U2DY5C58D"],
  ["2024004", "نورة سعد القحطاني",    "F", "38CPVR8W8V"],
  ["2024005", "عمر خالد العمري",      "M", "PNYGYF7TCT"],
  ["2024006", "سارة يوسف الزهراني",   "F", "KFG27SYV7Y"],
  ["2024007", "خالد إبراهيم الغامدي", "M", "JGKEPLMUSB"],
  ["2024008", "ريم محمد الدوسري",     "F", "FQM7MBE4W8"],
];

async function rest(path, opts = {}) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

// تحقق: هل المستخدمون موجودون؟ (groupId صفر = فارغ)
const existing = await rest("users?select=id,name,role&order=id");
if (existing.length > 0) {
  console.log("موجود مسبقاً، لا إعادة زرع:", JSON.stringify(existing, null, 2));
  process.exit(0);
}

const founderPassword = founder.password;
const usersPayload = [
  {
    role: founder.role, name: founder.name, email: founder.email,
    university_id: null, phone: null, gender: null,
    position: founder.position, is_staff: founder.is_staff,
    must_change_password: founder.must_change_password,
    password_hash: hashPassword(founderPassword),
    is_active: true, track: "bachelor_m", level: 1,
  },
  ...students.map(([uid, name, gender, pwd]) => ({
    role: "student", name, email: null, university_id: uid, phone: null, gender,
    position: null, is_staff: false,
    password_hash: hashPassword(pwd),
    must_change_password: uid === "2024002",
    is_active: true, track: "bachelor_m", level: 1,
  })),
];

const inserted = await rest("users", {
  method: "POST",
  headers: { Prefer: "return=representation" },
  body: JSON.stringify(usersPayload),
});

// خزنة كلمات المرور
const vaultRows = inserted.map((u, idx) => ({
  user_id: u.id,
  password_plain: idx === 0 ? founderPassword : students[idx - 1][3],
}));
await rest("credentials_vault", {
  method: "POST",
  headers: { Prefer: "return=minimal" },
  body: JSON.stringify(vaultRows),
});

console.log(JSON.stringify(
  inserted.map((u) => ({ id: u.id, role: u.role, name: u.name, university_id: u.university_id, is_staff: u.is_staff })),
  null, 2
));

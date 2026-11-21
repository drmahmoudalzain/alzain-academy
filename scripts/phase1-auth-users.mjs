// ============================================================
// scripts/phase1-auth-users.mjs — إنشاء حسابات تجريبية في Supabase Auth
// ============================================================
// الاستخدام:
//   node scripts/phase1-auth-users.mjs            # معاينة فقط (لا كتابة)
//   node scripts/phase1-auth-users.mjs --apply    # تنفيذ فعلي
//
// الشروط: تطبيق الترحيل 0100 أولاً (users.auth_id موجود).
// الناتج: 3 صفوف users + 3 حسابات auth.users + ملف بيانات دخول في tmp/.
// الأسرار: لا تُطبع كلمات المرور في الطرفية، تُكتب في tmp/ فقط (مستثنى من Git).
// ============================================================

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { hashPassword } from "../src/lib/password.js";

const APPLY = process.argv.includes("--apply");

// ---------------------------------------------------------------------------
// إعدادات
// ---------------------------------------------------------------------------
const env = Object.fromEntries(
  fs
    .readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const URL_BASE = String(env.SUPABASE_URL ?? "").replace(/\/+$/, "");
const SERVICE_KEY = env.SUPABASE_SECRET_KEY;
if (!URL_BASE || !SERVICE_KEY) {
  throw new Error("SUPABASE_URL / SUPABASE_SECRET_KEY غير موجودين في .env");
}

const REST = `${URL_BASE}/rest/v1`;
const AUTH_ADMIN = `${URL_BASE}/auth/v1/admin`;

const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

// كلمة مرور 12 حرفاً: حروف كبيرة/صغيرة + أرقام، بلا أحرف متشابهة
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function generatePassword(length = 12) {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

const TEST_USERS = [
  {
    platformId: "BM9001",
    role: "student",
    name: "[اختبار] طالب تجريبي",
    domain: "students.local",
    track: "bachelor_m",
    level: 1,
    gender: "M",
    isStaff: false,
  },
  {
    platformId: "TE9002",
    role: "teacher",
    name: "[اختبار] أستاذ تجريبي",
    domain: "staff.local",
    position: "أستاذ تجريبي",
    isStaff: true,
  },
  {
    platformId: "AS9001",
    role: "assistant",
    name: "[اختبار] مساعد إداري تجريبي",
    domain: "staff.local",
    position: "مساعد إداري تجريبي",
    isStaff: true,
  },
];

// ---------------------------------------------------------------------------
// أدوات HTTP
// ---------------------------------------------------------------------------
async function rest(pathname, options = {}) {
  const res = await fetch(`${REST}${pathname}`, { headers: HEADERS, ...options });
  const text = await res.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    throw new Error(`${options.method ?? "GET"} ${pathname} → ${res.status} ${JSON.stringify(body)}`);
  }
  return body;
}

async function authAdmin(pathname, options = {}) {
  const res = await fetch(`${AUTH_ADMIN}${pathname}`, { headers: HEADERS, ...options });
  const text = await res.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { ok: res.ok, status: res.status, body };
}

async function findAuthUserByEmail(email) {
  for (let page = 1; page <= 20; page += 1) {
    const { ok, body } = await authAdmin(`/users?page=${page}&per_page=200`);
    if (!ok) throw new Error(`تعذّر سرد مستخدمي Auth: ${JSON.stringify(body)}`);
    const users = body?.users ?? [];
    const hit = users.find((u) => String(u.email ?? "").toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (users.length < 200) return null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// الخطوات
// ---------------------------------------------------------------------------
async function findProfile(platformId) {
  const rows = await rest(
    `/users?select=id,role,platform_id,auth_id,name&platform_id=ilike.${encodeURIComponent(platformId)}`
  );
  return rows?.[0] ?? null;
}

async function assertBridgeReady() {
  const res = await fetch(`${REST}/users?select=auth_id&limit=0`, { headers: HEADERS });
  if (!res.ok) {
    const body = await res.text();
    if (/auth_id/.test(body) && /does not exist|42703/.test(body)) {
      throw new Error("العمود users.auth_id غير موجود — طبّق الترحيل 0100_auth_bridge.sql أولاً.");
    }
    throw new Error(`تعذّر فحص الجسر: ${res.status} ${body}`);
  }
}

async function createProfile(spec, password) {
  const payload = {
    role: spec.role,
    name: spec.name,
    platform_id: spec.platformId,
    password_hash: hashPassword(password),
    must_change_password: true,
    is_active: true,
    is_staff: spec.isStaff,
    track: spec.track ?? "bachelor_m",
    level: spec.level ?? null,
    gender: spec.gender ?? null,
    position: spec.position ?? null,
  };
  const rows = await rest(`/users`, {
    method: "POST",
    headers: { ...HEADERS, Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  return rows?.[0] ?? null;
}

async function createAuthUser(spec, password, profileId) {
  const email = `${spec.platformId.toLowerCase()}@${spec.domain}`;
  const res = await authAdmin(`/users`, {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      app_metadata: { academy_user_id: profileId, role: spec.role },
      user_metadata: { full_name: spec.name, platform_id: spec.platformId },
    }),
  });
  if (res.ok) return { id: res.body.id, email, created: true };

  const msg = JSON.stringify(res.body ?? "");
  if (res.status === 422 && /already|registered|exists/i.test(msg)) {
    const existing = await findAuthUserByEmail(email);
    if (existing) return { id: existing.id, email, created: false };
  }
  throw new Error(`إنشاء Auth فشل (${res.status}): ${msg}`);
}

async function linkAuthId(profileId, authId) {
  await rest(`/users?id=eq.${profileId}`, {
    method: "PATCH",
    headers: { ...HEADERS, Prefer: "return=minimal" },
    body: JSON.stringify({ auth_id: authId }),
  });
}

// ---------------------------------------------------------------------------
// التنفيذ
// ---------------------------------------------------------------------------
function credentialsFile(rows) {
  fs.mkdirSync("tmp", { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join("tmp", `phase1-test-accounts-${stamp}.csv`);
  const csv = [
    "platform_id,role,login_email,password,note",
    ...rows.map((r) => `${r.platformId},${r.role},${r.email},${r.password},حساب اختبار — غيّره أو احذفه قبل الإنتاج`),
  ].join("\r\n");
  fs.writeFileSync(file, `\uFEFF${csv}`, "utf8");
  return file;
}

async function main() {
  console.log(APPLY ? "الوضع: تنفيذ فعلي" : "الوضع: معاينة فقط (أضف --apply للتنفيذ)");
  await assertBridgeReady();
  const results = [];

  for (const spec of TEST_USERS) {
    let profile = await findProfile(spec.platformId);

    if (profile?.auth_id) {
      console.log(`- ${spec.platformId}: مربوط مسبقاً (auth_id=${profile.auth_id}) — تخطٍ`);
      continue;
    }

    const password = generatePassword(12);
    const email = `${spec.platformId.toLowerCase()}@${spec.domain}`;

    if (!APPLY) {
      console.log(`- ${spec.platformId}: سيُنشأ ${profile ? "ربط حساب" : "صف users + حساب Auth"} → ${email}`);
      results.push({ ...spec, email, password: "(معاينة)" });
      continue;
    }

    if (!profile) {
      profile = await createProfile(spec, password);
      if (!profile?.id) throw new Error(`فشل إنشاء صف users للرمز ${spec.platformId}`);
      console.log(`- ${spec.platformId}: أُنشئ صف users (id=${profile.id})`);
    }

    const auth = await createAuthUser(spec, password, profile.id);
    await linkAuthId(profile.id, auth.id);
    console.log(
      `- ${spec.platformId}: ${auth.created ? "أُنشئ حساب Auth" : "وُجد حساب Auth مسبقاً"} ورُبط (${auth.id})`
    );

    results.push({ ...spec, email, password: auth.created ? password : "(كلمة المرور السابقة)" });
  }

  if (APPLY && results.length) {
    const file = credentialsFile(results);
    console.log(`\nبيانات الدخول كُتبت في: ${file}`);
    console.log("الملف مستثنى من Git (tmp/). سلّمها للمالك ثم احذفها.");
  }

  if (!APPLY) console.log("\nلم تُكتب أي بيانات. أعد التنفيذ مع --apply بعد التأكد.");
}

main().catch((err) => {
  console.error("خطأ:", err.message);
  process.exitCode = 1;
});

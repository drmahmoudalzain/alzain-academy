// ============================================================
// scripts/verify-test-logins.mjs — التحقق من دخول الحسابات التجريبية
// ============================================================
// الاستخدام: node scripts/verify-test-logins.mjs [path/to/credentials.csv]
// يقرأ أحدث ملف في tmp/ إن لم يُمرَّر مسار.
// لا يطبع كلمات المرور؛ يطبع فقط: الرمز، نجاح الدخول، وتطابق auth_id.
// ============================================================

import fs from "node:fs";
import path from "node:path";

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
const SECRET = env.SUPABASE_SECRET_KEY;
const ANON = env.SUPABASE_ANON_KEY;

if (!URL_BASE || !SECRET) throw new Error("SUPABASE_URL / SUPABASE_SECRET_KEY مفقودان في .env");
if (!ANON) throw new Error("SUPABASE_ANON_KEY مفقود — أضفه في .env لاختبار الدخول من العميل");

function latestCredentials() {
  if (process.argv[2]) return process.argv[2];
  const dir = "tmp";
  if (!fs.existsSync(dir)) throw new Error("لا يوجد مجلد tmp/ — نفّذ scripts/phase1-auth-users.mjs --apply أولاً");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("phase1-test-accounts-") && f.endsWith(".csv"))
    .map((f) => path.join(dir, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  if (!files.length) throw new Error("لا يوجد ملف بيانات دخول في tmp/");
  return files[0];
}

function parseCsv(file) {
  const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines.shift().split(",");
  return lines.map((line) => {
    // كلمة المرور لا تحتوي فواصل، لكن نحمي الحقول الكاملة خلف Header ثابت
    const cells = line.split(",");
    const row = {};
    header.forEach((h, i) => (row[h] = cells[i]));
    return row;
  });
}

async function rest(pathname) {
  const res = await fetch(`${URL_BASE}/rest/v1${pathname}`, {
    headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}` },
  });
  if (!res.ok) throw new Error(`REST ${pathname} → ${res.status}`);
  return res.json();
}

async function signIn(email, password) {
  const res = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error_description ?? body?.msg ?? body?.message ?? `HTTP ${res.status}`;
    return { ok: false, error: msg };
  }
  return { ok: true, userId: body?.user?.id, expiresIn: body?.expires_in };
}

async function main() {
  const file = latestCredentials();
  const rows = parseCsv(file);
  console.log(`ملف البيانات: ${file}`);
  console.log(`عدد الحسابات: ${rows.length}\n`);

  let failures = 0;

  for (const row of rows) {
    const profiles = await rest(
      `/users?select=id,auth_id,role,platform_id&platform_id=ilike.${encodeURIComponent(row.platform_id)}`
    );
    const profile = profiles?.[0];

    if (!profile) {
      console.log(`✗ ${row.platform_id}: لا يوجد صف users`);
      failures += 1;
      continue;
    }

    const login = await signIn(row.login_email, row.password);
    if (!login.ok) {
      console.log(`✗ ${row.platform_id}: فشل الدخول — ${login.error}`);
      failures += 1;
      continue;
    }

    const linked = profile.auth_id === login.userId;
    console.log(
      `${linked ? "✓" : "✗"} ${row.platform_id} (${row.role}): دخول ناجح — auth_id ${linked ? "مطابق" : "غير مطابق"}`
    );
    if (!linked) {
      console.log(`    users.auth_id=${profile.auth_id} · auth user=${login.userId}`);
      failures += 1;
    }
  }

  console.log(`\nالنتيجة: ${rows.length - failures}/${rows.length} ناجح`);
  process.exitCode = failures ? 1 : 0;
}

main().catch((err) => {
  console.error("خطأ:", err.message);
  process.exitCode = 1;
});

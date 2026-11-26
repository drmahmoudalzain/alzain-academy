// تحقق دائم من مسار الدخول على Supabase الحقيقي، دون أي كلمة مرور أو سر.
// الاستخدام: node scripts/verify-login-flow.mjs
import { readFileSync } from "node:fs";

const webEnvPath = new URL("../web/.env", import.meta.url);
const env = Object.fromEntries(
  readFileSync(webEnvPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
);
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("web/.env must contain the two public VITE_SUPABASE_* values");

const headers = { apikey: key, "Content-Type": "application/json", Authorization: `Bearer ${key}` };
const failures = [];

for (const id of ["AD0001", "AS9001", "BF0001"]) {
  const res = await fetch(`${url}/rest/v1/rpc/login_email_for_identifier`, {
    method: "POST",
    headers,
    body: JSON.stringify({ p_identifier: id }),
  });
  const email = await res.json().catch(() => null);
  if (res.status !== 200 || typeof email !== "string" || !email.includes("@")) {
    failures.push(`login_email_for_identifier failed for ${id} (HTTP ${res.status})`);
  }
}

// كلمة مرور وهمية: الهدف التأكد أن الدالة تُجيب 200 بقرار رفض، لا 500.
const res = await fetch(`${url}/functions/v1/legacy-login`, {
  method: "POST",
  headers,
  body: JSON.stringify({ platformId: "bf0001", password: "not-a-real-password" }),
});
const body = await res.json().catch(() => null);
if (res.status !== 200 || body?.ok !== false) {
  failures.push(`legacy-login returned HTTP ${res.status} instead of a structured refusal`);
}

if (failures.length) {
  console.error(`login flow check FAILED (${failures.length}):`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log("login flow OK: identifiers resolve and legacy-login refuses cleanly without HTTP 500.");

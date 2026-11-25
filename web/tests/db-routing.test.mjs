// تحقق تكاملي من توجيه كل حساب إلى بوابته. يحتاج بيانات محلية ولا يعمل افتراضياً في CI.
// شغّله بـ: AZ_DB_ROUTING_TEST=1 node --test web/tests/db-routing.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readEnv(file) {
  const map = {};
  let text;
  try {
    text = readFileSync(new URL(file, import.meta.url), "utf8");
  } catch {
    return map;
  }
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)=(.*)$/);
    if (match) map[match[1]] = match[2].replace(/^["']|["']$/g, "").trim();
  }
  return map;
}

function portalFor(role, platformId) {
  if (role === "teacher" && String(platformId || "").toUpperCase().startsWith("AD")) return "owner";
  return role;
}

const run = process.env.AZ_DB_ROUTING_TEST === "1";
const base = readEnv("../.env");
const dev = readEnv("../.env.development.local");
const url = base.VITE_SUPABASE_URL;
const key = base.VITE_SUPABASE_ANON_KEY;

for (const [name, expectedPortal] of [
  ["OWNER", "owner"],
  ["STUDENT", "student"],
  ["TEACHER", "teacher"],
  ["TEACHER2", "assistant"],
]) {
  test(`dev ${name} resolves to the ${expectedPortal} portal`, { skip: !run || !url || !key }, async () => {
    const id = dev[`VITE_DEV_${name}_ID`];
    const password = dev[`VITE_DEV_${name}_PASSWORD`];
    assert.ok(id && password, `missing local credentials for ${name}`);

    const authRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: id.startsWith("AD") || id.startsWith("TE")
          ? `${id.toLowerCase()}@staff.local`
          : `${id.toLowerCase()}@students.local`,
        password,
      }),
    });
    const auth = await authRes.json();
    assert.equal(authRes.status, 200, `sign-in failed for ${id}: ${JSON.stringify(auth)}`);

    const usersRes = await fetch(
      `${url}/rest/v1/users?select=role,platform_id&auth_id=eq.${auth.user.id}`,
      { headers: { apikey: key, Authorization: `Bearer ${auth.access_token}` } },
    );
    const rows = await usersRes.json();
    assert.equal(usersRes.status, 200, `users query failed for ${id}: ${JSON.stringify(rows)}`);
    assert.equal(rows.length, 1, `expected one profile row for ${id}`);
    assert.equal(portalFor(rows[0].role, rows[0].platform_id), expectedPortal);
  });
}

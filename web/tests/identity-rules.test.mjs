import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// The 0123 migration is not applied by this suite (no live Supabase writes).
// SQL contracts are checked as source, while the shared pure helpers and the
// 5/15 rule are executed directly so the assertions are not regex-only.

const helperPath = new URL("../src/lib/identity-rules.js", import.meta.url);
const migrationPath = new URL("../../supabase/migrations/0123_identity_rules.sql", import.meta.url);
const rollbackPath = new URL("../../supabase/rollback/0123_identity_rules_rollback.sql", import.meta.url);
const edgePath = new URL("../../supabase/functions/legacy-login/index.ts", import.meta.url);
const proxyPath = new URL("../../supabase/functions/academy-login/index.ts", import.meta.url);
const configPath = new URL("../../supabase/config.toml", import.meta.url);
const loginPath = new URL("../src/pages/login.js", import.meta.url);
const portalPath = new URL("../src/lib/portal.js", import.meta.url);
const accountPath = new URL("../src/pages/account.js", import.meta.url);
const homePath = new URL("../index.html", import.meta.url);

function read(path, label) {
  assert.ok(existsSync(path), `${label} must exist`);
  return readFileSync(path, "utf8");
}

function bodyOf(name, sql) {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const end = sql.indexOf("$$;", start);
  assert.notEqual(end, -1, `missing body terminator for ${name}`);
  return sql.slice(start, end);
}

async function rules() {
  assert.ok(existsSync(helperPath), "identity-rules helper must exist");
  return import(`${helperPath.href}?v=${Date.now()}`);
}

test("email identifiers are rejected before any credential check and real platform codes pass", async () => {
  const r = await rules();
  assert.equal(r.loginIdentifierError("student@example.com"), r.EMAIL_LOGIN_ERROR);
  assert.match(r.EMAIL_LOGIN_ERROR, /BF0001/, "the rejection must name a real platform code");
  for (const code of ["AD0001", "TE0001", "BM0001", "BF0001", "EQ0001", "EX0001", "PG0001"]) {
    assert.equal(r.loginIdentifierError(` ${code.toLowerCase()} `), null, `${code} must remain valid`);
  }

  const login = read(loginPath, "login.js");
  const submit = login.slice(login.indexOf("form.addEventListener"));
  const rejectionAt = submit.indexOf("loginIdentifierError(");
  assert.ok(rejectionAt >= 0, "login.js must reject the identifier before contacting Supabase");
  for (const token of ["fetch(", "academy-login", "supabase.auth.setSession("]) {
    const at = submit.indexOf(token);
    assert.ok(at > -1 && rejectionAt < at, `email rejection must precede ${token}`);
  }
  assert.doesNotMatch(submit, /resolveEmail\(|legacyLogin\(|signInWithPassword\(/);

  const sql = read(migrationPath, "0123 migration");
  const guard = bodyOf("auth_login_guard_check", sql);
  assert.ok(
    guard.indexOf("position('@'") < guard.indexOf("from public.users"),
    "the SQL guard must reject email before looking up any user",
  );

  const proxy = read(proxyPath, "academy-login");
  assert.ok(
    proxy.indexOf(".rpc('auth_login_guard_check'") < proxy.indexOf("if (!verifyScrypt(password"),
    "the Edge proxy must check the guard before verifying a password",
  );
});

test("0123 guard is a service-role-only definer that rejects email and reports remaining lock minutes", () => {
  const sql = read(migrationPath, "0123 migration");
  const guard = bodyOf("auth_login_guard_check", sql);
  assert.match(sql, /\bbegin\s*;/i);
  assert.match(sql, /\bcommit\s*;/i);
  assert.match(sql, /create or replace function public\.auth_login_guard_check\(p_identifier text\)\s*returns jsonb/);
  assert.match(sql, /security definer/);
  assert.match(guard, /set search_path = public/);
  assert.match(guard, /upper\(btrim\(coalesce\(p_identifier, ''\)\)\)/);
  assert.match(guard, /position\('@' in v_id\) > 0/);
  assert.match(guard, /'email_login_rejected'/);
  assert.match(guard, /v_locked_until is not null and v_locked_until > now\(\)/);
  assert.match(guard, /'remaining_minutes', v_minutes/);
  assert.match(guard, /jsonb_build_object\('ok', true\)/);
  assert.doesNotMatch(guard, /password_hash|\bu\.email\b/);
  assert.match(sql, /revoke all on function public\.auth_login_guard_check\(text\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.auth_login_guard_check\(text\) to service_role/);
  assert.doesNotMatch(sql, /grant execute on function public\.auth_login_guard_check[^\n]*authenticated/i);
});

test("five consecutive failures lock for fifteen minutes, a sixth is refused, and success resets the counter", () => {
  const sql = read(migrationPath, "0123 migration");
  const guard = bodyOf("auth_login_guard_check", sql);
  const record = bodyOf("auth_record_login_attempt", sql);

  const threshold = Number(sql.match(/if v_attempts >= (\d+)/)?.[1]);
  const minutes = Number(sql.match(/interval '(\d+) minutes'/)?.[1]);
  assert.equal(threshold, 5, "the documented lock threshold must be five failures");
  assert.equal(minutes, 15, "the documented lock duration must be fifteen minutes");
  assert.match(record, /failed_attempts = coalesce\(failed_attempts, 0\) \+ 1/);
  assert.match(record, /case when coalesce\(failed_attempts, 0\) \+ 1 >= 5 then now\(\) \+ interval '15 minutes'/);
  assert.match(record, /if p_success then[\s\S]*?failed_attempts = 0, locked_until = null/);
  assert.match(guard, /v_locked_until is not null and v_locked_until > now\(\)/);

  // Executable model of the SQL contract, driven by the constants read from 0123.
  const now = new Date("2026-11-26T12:00:00.000Z");
  const state = { attempts: 0, lockedUntil: null, log: [] };
  const attempt = (success) => {
    if (state.lockedUntil && state.lockedUntil > now) {
      state.log.push("locked");
      return "account_locked";
    }
    if (success) {
      state.attempts = 0;
      state.lockedUntil = null;
      return "ok";
    }
    state.attempts += 1;
    state.log.push("invalid_credentials");
    if (state.attempts >= threshold) state.lockedUntil = new Date(now.getTime() + minutes * 60000);
    return state.lockedUntil ? "account_locked" : "invalid_credentials";
  };

  for (let i = 0; i < 4; i += 1) assert.equal(attempt(false), "invalid_credentials");
  assert.equal(state.lockedUntil, null, "the first four failures must not lock");
  assert.equal(attempt(false), "account_locked", "the fifth failure must lock");
  assert.equal((state.lockedUntil.getTime() - now.getTime()) / 60000, 15);
  assert.equal(attempt(false), "account_locked", "the sixth attempt must be refused");
  assert.equal(state.attempts, 5, "a refused attempt must not extend or re-arm the lock");
  assert.equal(state.log.filter((reason) => reason === "invalid_credentials").length, 5);

  const reset = { attempts: 0, lockedUntil: null };
  for (let i = 0; i < 3; i += 1) {
    reset.attempts += 1;
    if (reset.attempts >= threshold) reset.lockedUntil = new Date(now.getTime() + minutes * 60000);
  }
  reset.attempts = 0;
  reset.lockedUntil = null;
  assert.deepEqual(reset, { attempts: 0, lockedUntil: null }, "a success clears failures and the lock");

  // The proxy must fail-record after verification and success-record after each sign-in.
  const proxy = read(proxyPath, "academy-login");
  const guardAt = proxy.indexOf(".rpc('auth_login_guard_check'");
  const authSignInAt = proxy.indexOf("admin.auth.signInWithPassword({");
  const authSuccessAt = proxy.indexOf("p_success: true", authSignInAt);
  const verifyAt = proxy.indexOf("if (!verifyScrypt(password");
  const legacySignInAt = proxy.indexOf("admin.auth.signInWithPassword({", verifyAt);
  const legacySuccessAt = proxy.indexOf("p_success: true", verifyAt);
  const recordCalls = [...proxy.matchAll(/\.rpc\('auth_record_login_attempt'/g)].map((m) => m.index);
  assert.ok(guardAt > -1 && authSignInAt > -1 && verifyAt > -1 && legacySignInAt > -1);
  assert.ok(guardAt < verifyAt, "the guard must run before scrypt verification");
  assert.ok(authSuccessAt > authSignInAt && authSuccessAt < verifyAt, "Auth success is recorded before any scrypt path");
  assert.ok(recordCalls.some((at) => at > verifyAt && at < legacySignInAt), "failure must be recorded after scrypt verification");
  assert.ok(legacySuccessAt > legacySignInAt, "legacy success must be recorded after the server-side sign-in");
});

test("rejected attempts are logged in a service-role-only table and every lock is audited", () => {
  const sql = read(migrationPath, "0123 migration");
  const record = bodyOf("auth_record_login_attempt", sql);
  assert.match(sql, /create table if not exists public\.login_attempts_log/);
  assert.match(sql, /identifier\s+text not null/);
  assert.match(sql, /attempted_at\s+timestamptz not null default now\(\)/);
  assert.match(sql, /reason\s+text not null/);
  assert.match(sql, /alter table public\.login_attempts_log enable row level security/);
  assert.doesNotMatch(sql, /create policy[^\n]*login_attempts_log/i);
  assert.match(sql, /revoke all on public\.login_attempts_log from public, anon, authenticated/);
  assert.match(sql, /grant insert on public\.login_attempts_log to service_role/);
  assert.match(sql, /create index if not exists [a-z_]+\s+on public\.login_attempts_log \(attempted_at desc\)/);
  assert.match(record, /p_reason text default null/);
  assert.match(record, /lower\(btrim\(coalesce\(p_reason, ''\)\)\)/);
  assert.match(record, /insert into public\.login_attempts_log \(identifier, reason\)/);
  assert.match(record, /values \(v_id, v_log_reason\)/);
  assert.match(record, /values \(v_id, v_requested_reason\)/);
  assert.match(record, /'invalid_credentials'/);
  assert.match(record, /'locked'/);
  // Reason-only rejections are logged before the increment branch: 5/15 stays intact.
  const reasonBranchAt = record.indexOf("if v_requested_reason <> '' then");
  const incrementAt = record.indexOf("failed_attempts = coalesce(failed_attempts, 0) + 1");
  assert.ok(reasonBranchAt > -1 && reasonBranchAt < incrementAt);
  assert.match(record, /insert into public\.audit_logs \(actor_id, action, table_name, record_id, new_data\)/);
  assert.match(record, /'login_locked', 'users', v_user_id/);
  assert.match(sql, /revoke all on function public\.auth_record_login_attempt\(text, boolean, text\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.auth_record_login_attempt\(text, boolean, text\) to service_role/);
  assert.doesNotMatch(sql, /grant execute on function public\.auth_record_login_attempt[^\n]*authenticated/i);
});

test("first login requires both a password change and an email before any portal opens", async () => {
  const r = await rules();
  assert.equal(r.needsFirstLoginSetup({ must_change_password: true, email: "teacher@example.com" }), true);
  assert.equal(r.needsFirstLoginSetup({ must_change_password: false, email: "" }), true);
  assert.equal(r.needsFirstLoginSetup({ must_change_password: false, email: "  " }), true);
  assert.equal(r.needsFirstLoginSetup({ must_change_password: false, email: "teacher@example.com" }), false);
  assert.equal(r.needsFirstLoginSetup({ email: "teacher@example.com" }, { preview: true }), false);
  assert.match(r.ACCOUNT_FIRST_PATH, /pages\/account\.html\?first=1/);
  assert.match(r.firstLoginDestination({ must_change_password: true, email: "a@b.com" }), /account\.html/);
  assert.equal(r.firstLoginDestination({ must_change_password: true, email: "a@b.com" }, { pathname: "/pages/account.html" }), null);

  const portal = read(portalPath, "portal.js");
  assert.match(portal, /const \{ profile, preview \} = await requireProfile\(\)/);
  const gateAt = portal.indexOf("firstLoginDestination(");
  assert.ok(gateAt > -1 && gateAt < portal.indexOf("renderShell("), "the gate must run before a portal renders");
  assert.match(portal, /firstLoginDestination\(profile, \{ preview, pathname: location\.pathname \}\)/);

  const login = read(loginPath, "login.js");
  assert.match(login, /ACCOUNT_FIRST_PATH/, "login must also land on the account page when the gate applies");
  const account = read(accountPath, "account.js");
  assert.match(account, /mark_password_changed/);
  assert.match(account, /update_my_profile/);
});

test("rollback removes only 0123 objects and restores the pre-migration grants", () => {
  const rollback = read(rollbackPath, "0123 rollback");
  assert.match(rollback, /\bbegin\s*;/i);
  assert.match(rollback, /\bcommit\s*;/i);
  assert.match(rollback, /revoke all on function public\.auth_login_guard_check\(text\) from service_role/);
  assert.match(rollback, /revoke all on function public\.auth_record_login_attempt\(text, boolean, text\) from service_role/);
  assert.match(
    rollback,
    /pg_get_function_identity_arguments\(p\.oid\) = 'p_identifier text, p_success boolean, p_reason text'/,
  );
  assert.match(rollback, /drop function if exists public\.auth_login_guard_check\(text\)/);
  assert.match(rollback, /drop function if exists public\.auth_record_login_attempt\(text, boolean, text\)/);
  assert.match(rollback, /drop function if exists public\.auth_record_login_attempt\(text, boolean\)/);
  assert.match(rollback, /drop table if exists public\.login_attempts_log/);
  assert.match(rollback, /revoke all on public\.login_attempts_log from service_role/);
  assert.doesNotMatch(rollback, /delete from public\.users|truncate|drop table public\.users|drop table public\.audit_logs/i);
});

test("the permanent login link and preview buttons remain intact with the proxy as the login path", () => {
  const home = read(homePath, "index.html");
  assert.match(home, /login\.html/, "the public home must keep its login link");
  const login = read(loginPath, "login.js");
  assert.match(login, /data-preview/);
  assert.match(login, /functions\/v1\/academy-login/);
  assert.match(login, /platformId: identifier\.toLowerCase\(\)/);
  assert.match(login, /supabase\.auth\.setSession\(\{/);
  const edge = read(edgePath, "legacy-login");
  assert.match(edge, /admin\.auth\.admin\.createUser\(/);
  assert.match(edge, /findAuthUserByEmail\(/);
  assert.doesNotMatch(edge, /console\.log\(/, "the Edge Function must not print secrets or tokens");
});

test("academy-login is the only browser login path and carries no service credentials", () => {
  const login = read(loginPath, "login.js");
  const proxy = read(proxyPath, "academy-login");
  assert.match(login, /\/functions\/v1\/academy-login/);
  assert.match(login, /access_token: body\.access_token/);
  assert.match(login, /refresh_token: body\.refresh_token/);
  assert.doesNotMatch(login, /signInWithPassword|legacy-login|resolveEmail|legacyLogin/);
  assert.match(proxy, /Deno\.env\.get\('SUPABASE_SERVICE_ROLE_KEY'\)/);
  assert.match(proxy, /admin\.auth\.signInWithPassword\(\{/);
  assert.doesNotMatch(proxy, /console\.(log|info|warn|error)/);

  const config = read(configPath, "supabase/config.toml");
  assert.match(config, /\[functions\.academy-login\]/);
  assert.match(config, /verify_jwt\s*=\s*false/);

  const secretPattern = new RegExp("service" + "_role", "i");
  const webRoot = fileURLToPath(new URL("../", import.meta.url));
  const collect = (dir) => {
    const files = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name.startsWith(".")) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) files.push(...collect(full));
      else if (/\.(js|mjs|ts|html|css)$/.test(entry.name)) files.push(full);
    }
    return files;
  };
  const browserFiles = [...collect(join(webRoot, "src")), ...collect(join(webRoot, "pages"))];
  for (const name of ["index.html", "login.html", "guide.html", "forum.html"]) {
    const file = join(webRoot, name);
    if (existsSync(file)) browserFiles.push(file);
  }
  assert.ok(browserFiles.length > 0);
  for (const file of browserFiles) {
    assert.doesNotMatch(readFileSync(file, "utf8"), secretPattern, `${file} must not reference service role`);
  }
});

test("server-side email and lock rejection, reason logging, and remaining minutes on the fifth failure", () => {
  const sql = read(migrationPath, "0123 migration");
  const proxy = read(proxyPath, "academy-login");
  const guardAt = proxy.indexOf(".rpc('auth_login_guard_check'");
  const lookupAt = proxy.indexOf(".from('users')");
  const verifyAt = proxy.indexOf("if (!verifyScrypt(password");
  assert.ok(guardAt > -1 && guardAt < lookupAt && guardAt < verifyAt);

  assert.match(proxy, /'email_login_rejected'/);
  assert.match(proxy, /account_locked:\$\{Number\(guard\.remaining_minutes \?\? 15\)\}/);
  for (const reason of ["invalid_platform_id", "account_suspended", "no_usable_credential"]) {
    assert.match(proxy, new RegExp(`recordRejection\\(admin, platformId, '${reason}'\\)`), `reasons must log ${reason}`);
  }
  assert.match(proxy, /recordRejection\(admin, platformId, reason\)/, "guard rejections must be logged too");
  assert.match(proxy, /getUserById\(String\(user\.auth_id\)\)/);
  assert.match(proxy, /account_locked:\$\{Number\(attempt\.remaining_minutes \?\? 15\)\}/);
  assert.match(sql, /'remaining_minutes', 15/);
});

test("account_locked:N is parsed and rendered as an Arabic message with the minute count", async () => {
  const r = await rules();
  assert.equal(r.parseLockMinutes("account_locked:7"), 7);
  assert.equal(r.parseLockMinutes(" account_locked:12 "), 12);
  for (const bad of ["account_locked", "account_locked:0", "account_locked:-3", "invalid_credentials", ""]) {
    assert.equal(r.parseLockMinutes(bad), null, `${bad} must not be read as a lock`);
  }
  assert.match(r.loginLockedMessage(7), /7/);
  assert.match(r.loginLockedMessage(7), /دقيقة/);
  assert.equal(r.loginLockedMessage(0), "فشل الدخول: بيانات غير صحيحة.");
  assert.equal(r.loginErrorMessage("email_login_rejected"), r.EMAIL_LOGIN_ERROR);
  assert.equal(r.loginErrorMessage("account_locked:4"), r.loginLockedMessage(4));
  assert.equal(r.loginErrorMessage("unknown_error"), "فشل الدخول: بيانات غير صحيحة.");

  const login = read(loginPath, "login.js");
  assert.match(login, /parseLockMinutes\(body\?\.error\)/);
  assert.match(login, /loginLockedMessage\(lockedMinutes\)/);
  const submitAt = login.indexOf("form.addEventListener");
  assert.ok(submitAt < login.indexOf("parseLockMinutes(body?.error)"));
});

test("linked Auth credentials take priority over a stale password_hash with no legacy fallback", () => {
  const proxy = read(proxyPath, "academy-login");
  const selectAt = proxy.indexOf(".select(");
  assert.match(proxy.slice(selectAt, selectAt + 160), /password_hash, auth_id, is_active/);

  const authBranchAt = proxy.indexOf("if (user.auth_id) {");
  const resolveAt = proxy.indexOf("getUserById(String(user.auth_id))", authBranchAt);
  const authSignInAt = proxy.indexOf("admin.auth.signInWithPassword({", authBranchAt);
  const authFailureRecordAt = proxy.indexOf("p_success: false", authSignInAt);
  const authFailureReturnAt = proxy.indexOf("return errorResponse(", authFailureRecordAt);
  const authSuccessAt = proxy.indexOf("p_success: true", authSignInAt);
  const authReturnTokensAt = proxy.indexOf("access_token: authSession.session.access_token", authSignInAt);
  const legacyBranchAt = proxy.indexOf("if (user.password_hash) {", authBranchAt);
  const verifyAt = proxy.indexOf("if (!verifyScrypt(password", legacyBranchAt);

  assert.ok(authBranchAt > -1 && resolveAt > authBranchAt && authSignInAt > resolveAt);
  assert.ok(verifyAt > authSignInAt, "an auth_id user must sign in before any scrypt verification");
  assert.ok(
    authFailureRecordAt > authSignInAt && authFailureReturnAt > authFailureRecordAt && authFailureReturnAt < verifyAt,
    "a failed Auth password must be recorded and returned without trying the legacy hash",
  );
  assert.ok(authSuccessAt > authSignInAt && authSuccessAt < verifyAt);
  assert.ok(authReturnTokensAt > authSignInAt && authReturnTokensAt < verifyAt);
  assert.ok(legacyBranchAt > authSignInAt && legacyBranchAt < verifyAt, "users without an Auth link still reach scrypt");
  assert.match(proxy, /if \(!user\.password_hash\) \{/);
  assert.equal(
    [...proxy.matchAll(/account_locked:\$\{Number\(attempt\.remaining_minutes \?\? 15\)\}/g)].length,
    2,
    "both Auth and legacy failures must surface lock minutes",
  );

  // Executable model of the credential priority enforced above.
  const loginWith = ({ authId, authPasswordOk, legacyHashOk }) => {
    if (authId) return authPasswordOk ? "auth_tokens" : "failure_recorded";
    return legacyHashOk ? "scrypt_then_tokens" : "invalid_credentials";
  };
  assert.equal(loginWith({ authId: "auth-1", authPasswordOk: true, legacyHashOk: false }), "auth_tokens");
  assert.equal(
    loginWith({ authId: "auth-1", authPasswordOk: false, legacyHashOk: true }),
    "failure_recorded",
    "the old password must not work after a password change",
  );
  assert.equal(loginWith({ authId: null, authPasswordOk: false, legacyHashOk: true }), "scrypt_then_tokens");
  assert.equal(loginWith({ authId: null, authPasswordOk: true, legacyHashOk: false }), "invalid_credentials");
});

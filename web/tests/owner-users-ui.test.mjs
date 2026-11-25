import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../pages/owner/users.html", import.meta.url), "utf8");
const js = readFileSync(new URL("../src/pages/owner/users.js", import.meta.url), "utf8");

test("users page offers a creation form instead of read-only text", () => {
  assert.doesNotMatch(html, /قراءة فقط/);
  assert.ok(html.includes("ouNewBtn"));
  assert.ok(html.includes("ouFormPanel"));
  for (const field of [
    "name", "email", "phone", "role", "track", "level",
    "university_id", "position", "temporary_password",
  ]) {
    assert.ok(html.includes(`name="${field}"`), `missing form field: ${field}`);
  }
});

test("users script uses the Auth admin client and all owner RPCs", () => {
  assert.match(js, /import\s*\{[^}]*invokeOwnerAdmin[^}]*\}\s*from/);
  assert.match(js, /import\s*\{[^}]*generateTemporaryPassword[^}]*\}\s*from/);
  for (const rpc of [
    "management_allocate_platform_id",
    "management_update_user",
    "management_set_user_active",
    "management_flag_password_change",
    "management_preflight_delete_user",
    "management_delete_user_finalize",
  ]) {
    assert.ok(js.includes(rpc), `missing RPC call: ${rpc}`);
  }
});

test("users script wires every row action and opens the form from ?new=1", () => {
  for (const action of ["edit", "toggle", "reset", "ensure", "delete"]) {
    assert.ok(js.includes(`data-action="${action}"`), `missing row action: ${action}`);
  }
  assert.match(js, /URLSearchParams\(location\.search\)\.get\("new"\)/);
  assert.match(js, /=== "1"/);
});

test("create payload carries every profile field to the Edge Function", () => {
  for (const field of [
    "password", "platform_id", "name", "email", "phone", "role",
    "track", "level", "university_id", "gender", "position",
  ]) {
    assert.ok(js.includes(`${field}:`), `missing create payload field: ${field}`);
  }
  assert.match(js, /op:\s*"create"/);
});

test("refresh restores its spinner after rendering", () => {
  assert.match(js, /ouRefresh"\)\.innerHTML = `[^`]*od-btn-spinner/);
});

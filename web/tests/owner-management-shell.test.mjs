import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dashboard = readFileSync(new URL("../src/pages/owner/dashboard.js", import.meta.url), "utf8");
const cachePolicy = readFileSync(new URL("../src/lib/cache-policy.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/css/views/owner-dashboard.css", import.meta.url), "utf8");

const newRpcs = [
  "is_owner_by_auth_uid",
  "management_allocate_platform_id",
  "management_create_user_profile",
  "management_update_user",
  "management_set_user_active",
  "management_flag_password_change",
  "management_preflight_delete_user",
  "management_delete_user_finalize",
  "management_update_course",
  "management_preflight_delete_course",
  "management_delete_course",
  "management_change_student_track",
  "management_enroll_student_in_track",
  "management_transfer_student",
  "management_set_enrollment_status",
  "management_remove_enrollment",
  "management_link_auth_id",
  "management_log_auth_delete",
];

test("dashboard quick actions open the new forms in place", () => {
  const start = dashboard.indexOf("const ACTIONS = [");
  assert.notEqual(start, -1);
  const end = dashboard.indexOf("];", start);
  const block = dashboard.slice(start, end);
  const hrefs = [...block.matchAll(/href:\s*"([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(hrefs.slice(0, 2), [
    "pages/owner/users.html?new=1",
    "pages/owner/courses.html?new=1",
  ]);
  assert.equal(hrefs[2], "pages/owner/report.html");
  assert.equal(hrefs[3], "guide.html");
});

test("every owner RPC invalidates cached data", () => {
  assert.match(cachePolicy, /const INVALIDATES = new Set\(\[/);
  for (const name of newRpcs.filter((n) => n.startsWith("management_"))) {
    assert.ok(cachePolicy.includes(`"${name}"`), `${name} must be in INVALIDATES`);
  }
});

test("owner dashboard stylesheet has balanced comments and active button rules", () => {
  const opens = (css.match(/\/\*/g) ?? []).length;
  const closes = (css.match(/\*\//g) ?? []).length;
  assert.equal(opens, closes, "CSS comments must be balanced");
  assert.ok(css.includes("/* === od-btn variants === */"));
  assert.ok(css.indexOf(".od-btn{") > css.indexOf("/* === od-btn variants === */"));
});

test("owner dashboard stylesheet defines form and table layout classes", () => {
  for (const selector of [
    ".od-form",
    ".od-field",
    ".od-table",
    ".od-inline-msg",
    ".od-grid",
    ".od-actions-grid",
  ]) {
    assert.ok(css.includes(selector), `missing ${selector}`);
  }
});

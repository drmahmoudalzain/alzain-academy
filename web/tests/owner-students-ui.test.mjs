import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../pages/owner/students.html", import.meta.url), "utf8");
const js = readFileSync(new URL("../src/pages/owner/students.js", import.meta.url), "utf8");

test("students page exposes all four management actions, track filter, and panels", () => {
  for (const id of ["ostNewBtn", "ostEnrollBtn", "ostTransferBtn", "ostTrackBtn", "ostTrackFilter"]) {
    assert.ok(html.includes(`id="${id}"`), `missing control: ${id}`);
  }
  for (const id of ["ostNewPanel", "ostEnrollPanel", "ostTransferPanel", "ostTrackPanel"]) {
    assert.ok(html.includes(`id="${id}"`), `missing panel: ${id}`);
  }
  for (const id of ["ostEnrollForm", "ostCourse", "ostSubmitBtn", "ostEnrollMsg"]) {
    assert.ok(html.includes(`id="${id}"`), `existing control was removed: ${id}`);
  }
});

test("student script imports Auth admin and calls every enrollment RPC", () => {
  assert.match(js, /import\s*\{[^}]*invokeOwnerAdmin[^}]*\}\s*from/);
  assert.match(js, /import\s*\{[^}]*generateTemporaryPassword[^}]*\}\s*from/);
  for (const rpc of [
    "management_enroll_student",
    "management_enroll_student_in_track",
    "management_transfer_student",
    "management_change_student_track",
    "management_set_enrollment_status",
    "management_remove_enrollment",
  ]) {
    assert.ok(js.includes(rpc), `missing RPC call: ${rpc}`);
  }
});

test("new student flow creates the Auth account with the student profile fields", () => {
  assert.ok(js.includes('op: "create"'));
  assert.match(js, /role:\s*"student"/);
  for (const field of [
    "password", "platform_id", "name", "email", "phone",
    "track", "level", "university_id", "gender",
  ]) {
    assert.ok(js.includes(`${field}:`), `missing create field: ${field}`);
  }
});

test("course options show track and level and the page explains the bachelor branches", () => {
  const start = js.indexOf("function courseLabel(");
  assert.notEqual(start, -1);
  const body = js.slice(start, js.indexOf("\n}", start));
  assert.match(body, /c\.track/);
  assert.match(body, /c\.level/);
  assert.match(html, /bachelor_m/);
  assert.match(html, /bachelor_f/);
  assert.match(html, /المقرر الأصل/);
  assert.match(html, /فرع/);
});

test("student rows expose enroll, transfer, track, suspend, remove, and reset actions", () => {
  for (const action of ["enroll", "transfer", "track", "suspend", "remove", "reset"]) {
    assert.ok(js.includes(`data-action="${action}"`), `missing row action: ${action}`);
  }
});

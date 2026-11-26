import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildFilterParams,
  countGenders,
  countLevels,
  isLevelDisabled,
  parseFilters,
  serializeFilters,
} from "../src/lib/students-filters.js";

const html = readFileSync(new URL("../pages/owner/students.html", import.meta.url), "utf8");
const js = readFileSync(new URL("../src/pages/owner/students.js", import.meta.url), "utf8");
const courseJs = readFileSync(new URL("../src/pages/teacher/course.js", import.meta.url), "utf8");
const courseHtml = readFileSync(new URL("../pages/teacher/course.html", import.meta.url), "utf8");

const roster = [
  { id: 1, track: "bachelor_m", level: 1 },
  { id: 2, track: "bachelor_f", level: 1 },
  { id: 3, track: "bachelor_m", level: 2 },
  { id: 4, track: "bachelor_f", level: 4 },
  { id: 5, track: "bachelor_m", level: null },
  { id: 6, track: "equiv", level: 2 },
];

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

test("track tabs carry counts and bachelor tabs expose gender and level rows", () => {
  for (const id of ["ostTrackTabs", "ostBachelorTabs", "ostLevelTabs", "ostStudentSearch"]) {
    assert.ok(html.includes(`id="${id}"`), `missing list control: ${id}`);
  }
  assert.match(js, /const TRACK_TABS = \[/);
  assert.match(js, /const GENDER_TABS = \[/);
  assert.match(js, /data-track="\$\{/);
  assert.match(js, /data-gender="\$\{/);
  assert.match(js, /data-level="\$\{/);
  assert.match(js, /aria-current/);
  assert.match(js, /ostBachelorTabs[\s\S]{0,160}hidden = !isBachelor/);
  assert.match(js, /ostLevelTabs[\s\S]{0,160}hidden = !isBachelor/);
});

test("student rows and the بيانات الطالب button open the owner details panel", () => {
  assert.ok(html.includes('id="ostDetailsPanel"'), "student details panel is missing");
  assert.ok(html.includes('id="ostDetailsClose"'), "student details close control is missing");
  assert.match(js, /class="ost-student-link"/);
  assert.match(js, /بيانات الطالب/);
  assert.match(js, /data-action="details"/);
  assert.match(js, /case "details":/);
  assert.match(js, /showStudentDetails\(student\)/);
});

test("pure level counts cover all bachelor students and ignore gender selection", () => {
  assert.deepEqual(countLevels(roster), { 0: 1, 1: 2, 2: 1, 3: 0, 4: 1 });
  assert.deepEqual(countGenders(roster, "1"), { bachelor: 2, bachelor_m: 1, bachelor_f: 1 });
  assert.deepEqual(countGenders(roster, "2"), { bachelor: 1, bachelor_m: 1, bachelor_f: 0 });
  assert.deepEqual(countLevels(roster), { 0: 1, 1: 2, 2: 1, 3: 0, 4: 1 });
  assert.match(js, /countLevels\(allStudents\)/);
  assert.match(js, /countGenders\(allStudents, level\)/);
});

test("level zero keeps its count but is dimmed and cannot be clicked", () => {
  assert.equal(isLevelDisabled(0), true);
  assert.equal(isLevelDisabled(1), false);
  assert.equal(isLevelDisabled("2"), false);
  assert.match(js, /isLevelDisabled\(level\)/);
  assert.match(js, /disabled: zero, zero/);
  assert.match(html, /ost-tab--zero/);
});

test("URL serialization keeps track and level while replacing q and parses back on popstate", () => {
  const params = buildFilterParams(
    { track: "bachelor_f", level: "2", q: "نور" },
    "track=all&level=1&q=قديم&from=nav&student=7",
  );
  assert.equal(params.get("track"), "bachelor_f");
  assert.equal(params.get("level"), "2");
  assert.equal(params.get("q"), "نور");
  assert.equal(params.get("from"), "nav");
  assert.deepEqual(parseFilters(params), { track: "bachelor_f", level: "2", q: "نور" });
  assert.deepEqual(
    parseFilters(new URLSearchParams(serializeFilters({ track: "bachelor", level: "3", q: "سارة" }))),
    { track: "bachelor", level: "3", q: "سارة" },
  );
  assert.match(js, /parseFilters\(new URLSearchParams\(location\.search\)\)/);
  assert.match(js, /buildFilterParams\(filters, location\.search\)/);
  assert.match(js, /addEventListener\("popstate", renderTable\)/);
});

test("owner details are addressable through the ?student URL", () => {
  assert.ok(js.includes('params.set("student", String(student.id))'));
  assert.ok(js.includes('new URLSearchParams(location.search).get("student")'));
  assert.match(js, /history\.pushState/);
  assert.match(js, /history\.replaceState/);
});

test("course roster names and بيانات الطالب open a student detail view with ?student", () => {
  assert.ok(courseJs.includes('function studentDetailHref(student)'));
  assert.ok(courseJs.includes('p("pages/teacher/course.html")'));
  assert.ok(courseJs.includes('student=${encodeURIComponent(studentId)}'));
  assert.ok(courseJs.includes('class="tdc-student-link" href="${detailHref}"'));
  assert.ok(courseJs.includes(' class="tt-btn" href="${detailHref}"'));
  assert.ok(courseJs.includes("بيانات الطالب"));
  assert.ok(courseJs.includes('new URLSearchParams(location.search).get("student")'));
  assert.ok(courseJs.includes("renderStudentDetails(d.students || [])"));
  assert.ok(courseHtml.includes('id="tdcStudentDetails"'));
  assert.ok(courseHtml.includes('id="tdcStudentDetailsClose"'));
});

test("?student deep link activates the students tab during load", () => {
  const loadStart = courseJs.indexOf("async function load()");
  assert.notEqual(loadStart, -1);
  const loadEnd = courseJs.indexOf("\n}\n", loadStart);
  const loadBody = courseJs.slice(loadStart, loadEnd);

  assert.match(
    loadBody,
    /if \(new URLSearchParams\(location\.search\)\.get\("student"\)\) switchTab\("students"\);/,
  );
  assert.match(loadBody, /renderStudentDetails\(d\.students \|\| \[\]\)/);
  assert.ok(
    loadBody.indexOf('switchTab("students")') < loadBody.indexOf("renderStudentDetails(d.students || [])"),
    "students tab must be activated before the detail panel is rendered",
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../pages/owner/courses.html", import.meta.url), "utf8");
const js = readFileSync(new URL("../src/pages/owner/courses.js", import.meta.url), "utf8");

test("the course form sits above the list so creating is visible", () => {
  const formAt = html.indexOf('id="ocFormPanel"');
  const listAt = html.indexOf('id="ocListTitle"');
  assert.notEqual(formAt, -1);
  assert.notEqual(listAt, -1);
  assert.ok(formAt < listAt);
});

test("deep link opens the course form", () => {
  assert.match(js, /URLSearchParams\(location\.search\)\.get\("new"\)/);
  assert.match(js, /=== "1"/);
});

test("the new button focuses the title without scrolling the page", () => {
  const start = js.indexOf('$("ocNewBtn").addEventListener("click"');
  assert.notEqual(start, -1);
  const end = js.indexOf("});", start);
  const handler = js.slice(start, end);
  assert.doesNotMatch(handler, /scrollIntoView|location\.hash|window\.scrollTo/);
  assert.match(handler, /focus\(\)/);
});

test("course updates carry the editable code", () => {
  const start = js.indexOf("const params = {");
  assert.notEqual(start, -1);
  const params = js.slice(start, js.indexOf("};", start));
  assert.match(params, /p_code:/);
  assert.ok(js.includes("management_update_course"));
});

test("course deletion previews impact before the destructive call", () => {
  assert.ok(js.includes('data-action="delete"'));
  const preflight = js.indexOf("management_preflight_delete_course");
  const deletion = js.indexOf("management_delete_course");
  assert.notEqual(preflight, -1);
  assert.notEqual(deletion, -1);
  assert.ok(preflight < deletion);
});

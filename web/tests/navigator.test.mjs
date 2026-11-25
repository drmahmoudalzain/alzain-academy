import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const registry = await import("../src/lib/page-registry.js");

test("registerPage and takeMount round-trip the same mount function", () => {
  const mount = async () => {};
  registry.registerPage("/pages/teacher/courses.html", mount);
  assert.equal(registry.takeMount("/pages/teacher/courses.html"), mount);
  assert.equal(registry.takeMount("/pages/teacher/courses.html"), null);
});

test("soft navigation flag stays on until endSoftNav", () => {
  assert.equal(registry.isSoftNav(), false);
  registry.beginSoftNav();
  assert.equal(registry.isSoftNav(), true);
  registry.endSoftNav();
  assert.equal(registry.isSoftNav(), false);
});

test("layout registers cleanup for its global listeners", () => {
  const source = readFileSync(new URL("../src/lib/layout.js", import.meta.url), "utf8");
  assert.match(source, /onDispose\(/);
  assert.match(source, /removeEventListener\(/);
});

test("pages with document-level listeners register cleanup", () => {
  const files = [
    "src/pages/ai-assistant.js",
    "src/pages/library.js",
    "src/pages/library-manage.js",
    "src/pages/teacher/common.js",
  ];
  for (const file of files) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(source, /onDispose\(/, `${file} must register disposal`);
  }
});

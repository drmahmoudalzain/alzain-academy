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

test("back button follows the in-app stack, not history.length", () => {
  const layout = readFileSync(new URL("../src/lib/layout.js", import.meta.url), "utf8");
  assert.match(layout, /previousEntry\(\)/);
  assert.match(layout, /history\.back\(\)/);
  assert.doesNotMatch(layout, /history\.length/);

  const navigator = readFileSync(new URL("../src/lib/navigator.js", import.meta.url), "utf8");
  assert.match(navigator, /recordNavigation\(/);
  assert.match(navigator, /syncNavHistory\(/);
  assert.match(navigator, /initNavHistory\(\)/);
});

test("owner sidebar starts with dashboard and ends with account", async () => {
  const { NAVIGATION } = await import("../src/lib/navigation.js");
  const labels = NAVIGATION.owner.flatMap((section) => section.items.map((item) => item.label));
  assert.equal(labels[0], "لوحة التحكم");
  assert.equal(labels[labels.length - 1], "حسابي");
  assert.deepEqual(labels.slice(-4), ["المساعد الذكي", "المكتبة القانونية", "إدارة المكتبة", "حسابي"]);
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

test("direct boot never clears registrations made while its module was imported", () => {
  const source = readFileSync(new URL("../src/lib/portal.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /disposeAll/);
});

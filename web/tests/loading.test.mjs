import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { skeleton, runTask, busy, routeProgress } = await import("../src/lib/loading.js");
const css = readFileSync(new URL("../public/css/views/loading.css", import.meta.url), "utf8");

test("stats skeleton renders the requested number of stat placeholders", () => {
  const html = skeleton("stats", 3);
  assert.equal((html.match(/ld-skeleton--stat/g) || []).length, 3);
});

test("unknown skeleton kind falls back to cards", () => {
  const html = skeleton("unknown", 2);
  assert.match(html, /ld-skeleton--card/);
  assert.doesNotMatch(html, /ld-skeleton--stat/);
});

test("runTask shows the skeleton then inserts the loader result", async () => {
  const el = { innerHTML: "" };
  const result = await runTask(el, "rows", async () => "<p>done</p>", 2);
  assert.equal(result, "<p>done</p>");
  assert.equal(el.innerHTML, "<p>done</p>");
});

test("runTask reports a loader failure inside the target", async () => {
  const el = { innerHTML: "" };
  await runTask(el, "cards", async () => {
    throw new Error("offline");
  });
  assert.match(el.innerHTML, /ld-error/);
  assert.match(el.innerHTML, /offline/);
});

test("busy toggles pending state on a button", () => {
  const classes = new Set();
  const button = {
    disabled: false,
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) },
  };
  busy(button, true);
  assert.equal(button.disabled, true);
  assert.equal(classes.has("is-busy"), true);
  busy(button, false);
  assert.equal(button.disabled, false);
  assert.equal(classes.has("is-busy"), false);
});

test("routeProgress is safe without a DOM", () => {
  const bar = routeProgress();
  bar.start();
  bar.end();
});

test("busy spinner keeps a visible border colour instead of hiding currentColor", () => {
  assert.doesNotMatch(css, /button\.is-busy\s*\{[^}]*color:\s*transparent/);
  assert.match(css, /button\.is-busy::after\s*\{[^}]*currentColor/);
});

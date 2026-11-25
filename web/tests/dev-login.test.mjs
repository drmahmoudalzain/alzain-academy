import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { devLogins } = await import("../src/lib/dev-login.js");

test("no dev buttons are produced when credentials are missing", () => {
  assert.deepEqual(devLogins({ DEV: true }), []);
});

test("production never exposes dev credentials", () => {
  const entries = devLogins({
    DEV: false,
    VITE_DEV_STUDENT_ID: "BM9001",
    VITE_DEV_STUDENT_PASSWORD: "do-not-ship",
  });
  assert.deepEqual(entries, []);
  assert.doesNotMatch(JSON.stringify(entries), /do-not-ship/);
});

test("an explicit DEV flag is required even when credentials exist", () => {
  const entries = devLogins({
    VITE_DEV_STUDENT_ID: "BM9001",
    VITE_DEV_STUDENT_PASSWORD: "local-only",
  });
  assert.deepEqual(entries, []);
});

test("a development-mode build enables the buttons on a deployed site", () => {
  const entries = devLogins({
    MODE: "development",
    VITE_DEV_STUDENT_ID: "BM9001",
    VITE_DEV_STUDENT_PASSWORD: "local-only",
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].key, "student");
});

test("a production-mode build still hides the buttons", () => {
  const entries = devLogins({
    MODE: "production",
    VITE_DEV_STUDENT_ID: "BM9001",
    VITE_DEV_STUDENT_PASSWORD: "local-only",
  });
  assert.deepEqual(entries, []);
});

test("development credentials are returned only for complete pairs", () => {
  const entries = devLogins({
    DEV: true,
    VITE_DEV_STUDENT_ID: "BM9001",
    VITE_DEV_STUDENT_PASSWORD: "local-only",
    VITE_DEV_TEACHER_ID: "TE9002",
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].key, "student");
  assert.equal(entries[0].id, "BM9001");
});

test("login markup hides the dev button group by default", () => {
  const html = readFileSync(new URL("../login.html", import.meta.url), "utf8");
  assert.match(html, /class="dev-logins"[^>]*hidden/);
  assert.match(html, /data-dev="student"/);
  assert.match(html, /data-dev="teacher"/);
  assert.match(html, /data-dev="assistant"/);
});

test("autofill focuses the submit button exactly once", () => {
  const source = readFileSync(new URL("../src/pages/login.js", import.meta.url), "utf8");
  assert.match(source, /submit\.focus\(\)/);
  assert.doesNotMatch(source, /getElementById\("identifier"\)\.focus\(\)/);
});

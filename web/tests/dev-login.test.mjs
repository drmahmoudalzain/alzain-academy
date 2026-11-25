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

test("all four named accounts are available in a development build", () => {
  const entries = devLogins({
    MODE: "development",
    VITE_DEV_OWNER_ID: "AD0001",
    VITE_DEV_OWNER_PASSWORD: "one",
    VITE_DEV_STUDENT_ID: "BM0062",
    VITE_DEV_STUDENT_PASSWORD: "two",
    VITE_DEV_TEACHER_ID: "TE0002",
    VITE_DEV_TEACHER_PASSWORD: "three",
    VITE_DEV_TEACHER2_ID: "TE0003",
    VITE_DEV_TEACHER2_PASSWORD: "four",
  });
  assert.deepEqual(entries.map((entry) => entry.key), ["owner", "student", "teacher", "teacher2"]);
  assert.deepEqual(entries.map((entry) => entry.id), ["AD0001", "BM0062", "TE0002", "TE0003"]);
});

test("login markup shows the four role-preview buttons without credential autofill", () => {
  const html = readFileSync(new URL("../login.html", import.meta.url), "utf8");
  assert.match(html, /class="preview-logins"/);
  assert.doesNotMatch(html, /class="dev-logins"|data-dev=/);
  for (const role of ["owner", "teacher", "assistant", "student"]) {
    assert.match(html, new RegExp(`data-preview="${role}"`), `missing preview role: ${role}`);
  }
  for (const label of ["دخول المدير", "دخول الأستاذ", "دخول المساعد", "دخول الطلاب"]) {
    assert.ok(html.includes(label), `missing portal label: ${label}`);
  }
  for (const detail of ["محمود", "الحسين", "عثمان", "النذير"]) {
    assert.doesNotMatch(html, new RegExp(detail), `personal detail still visible: ${detail}`);
  }
});

test("password visibility and direct preview behavior remain wired", () => {
  const source = readFileSync(new URL("../src/pages/login.js", import.meta.url), "utf8");
  assert.match(source, /passwordInput\.type = show \? "text" : "password"/);
  assert.match(source, /aria-pressed/);
  assert.match(source, /setPreviewRole\(role\)/);
  assert.match(source, /homeOf\(profile\)/);
});

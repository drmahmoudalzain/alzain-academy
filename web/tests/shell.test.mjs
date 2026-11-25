import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const shell = readFileSync(new URL("../src/lib/layout.js", import.meta.url), "utf8");

test("header has a text-only menu button on the right", () => {
  const button = shell.match(/<button class="menu-btn"[^>]*>[\s\S]*?<\/button>/);
  assert.ok(button, "menu button missing");
  assert.match(button[0], />\s*القائمة\s*</);
  assert.doesNotMatch(button[0], /icon\(/);
  assert.match(button[0], /id="menuBtn"/);
});

test("header order is menu, title, notifications, back", () => {
  const markers = ['id="menuBtn"', 'class="topbar-title"', 'pages/notifications.html', 'id="backBtn"'];
  const positions = markers.map((marker) => {
    const index = shell.indexOf(marker);
    assert.notEqual(index, -1, `missing marker: ${marker}`);
    return index;
  });
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  const back = shell.match(/<button class="topbar-back"[^>]*>[\s\S]*?<\/button>/);
  assert.ok(back, "back button missing");
  assert.match(back[0], />\s*رجوع\s*</);
});

test("header no longer contains settings, logout or search controls", () => {
  assert.doesNotMatch(shell, /logoutBtnTop/);
  assert.doesNotMatch(shell, /icon\("settings"\)/);
  assert.doesNotMatch(shell, /search-box/);
  assert.match(shell, /id="logoutBtn"/, "sidebar logout must stay available");
});

test("header styles are mobile-first with a three-slot grid", () => {
  const css = readFileSync(new URL("../public/css/portal-theme.css", import.meta.url), "utf8");
  const marker = "/* هيدر البوابات — mobile-first */";
  const index = css.indexOf(marker);
  assert.notEqual(index, -1, "header CSS marker missing");
  const block = css.slice(index);
  assert.match(block, /grid-template-columns: auto minmax\(0, 1fr\) auto/);
  assert.match(block, /@media \(min-width: 640px\)/);
  assert.match(block, /@media \(min-width: 900px\)/);
  assert.doesNotMatch(block, /@media \(max-width:/);
});

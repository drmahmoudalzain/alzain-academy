import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const modulePath = new URL("../src/lib/first-visit.js", import.meta.url);
const portalPath = new URL("../src/lib/portal.js", import.meta.url);
const guidePath = new URL("../guide.html", import.meta.url);
const loginPath = new URL("../login.html", import.meta.url);
const indexPath = new URL("../index.html", import.meta.url);
const homePath = new URL("../src/pages/home.js", import.meta.url);
const navigationPath = new URL("../src/lib/navigation.js", import.meta.url);

test("first-visit module exists and is called only from public entry points", () => {
  assert.ok(existsSync(modulePath), "first-visit module is missing");
  const source = readFileSync(modulePath, "utf8");
  const portal = readFileSync(portalPath, "utf8");
  const guide = readFileSync(guidePath, "utf8");
  const login = readFileSync(loginPath, "utf8");
  const index = readFileSync(indexPath, "utf8");
  const home = readFileSync(homePath, "utf8");

  assert.match(source, /export function initFirstVisitModal\(/);
  assert.match(portal, /import\s*\{[^}]*initFirstVisitModal[^}]*\}\s*from\s*"\.\/first-visit\.js"/);
  assert.match(guide, /\/src\/lib\/first-visit\.js/);
  assert.match(index, /\/src\/pages\/home\.js/);
  assert.match(home, /import\s*\{[^}]*initFirstVisitModal[^}]*\}\s*from/);
  assert.match(home, /initFirstVisitModal\(\);/);
  assert.doesNotMatch(login, /first-visit\.js/, "login page must not open the first-visit modal");
  assert.match(source, /login\.html/);
  assert.match(source, /LOGIN_ROUTE/);
  assert.match(source, /portal-student[\s\S]*portal-teacher[\s\S]*portal-assistant[\s\S]*portal-owner/);
});

test("public path detection covers home and guide but excludes login and authenticated portals", async () => {
  const { isPublicPath } = await import(`${modulePath.href}?test=${Date.now()}`);
  assert.equal(isPublicPath("/alzain-academy/guide.html"), true);
  assert.equal(isPublicPath("/guide.html"), true);
  assert.equal(isPublicPath("/alzain-academy/index.html"), true);
  assert.equal(isPublicPath("/alzain-academy/"), true);
  assert.equal(isPublicPath("/login.html"), false);
  assert.equal(isPublicPath("/login"), false);
  assert.equal(isPublicPath("/login/"), false);
  assert.equal(isPublicPath("/alzain-academy/login"), false);
  assert.equal(isPublicPath("/pages/owner/students.html"), false);
  assert.equal(isPublicPath("/pages/student/dashboard.html"), false);
});

test("first visit flag is stored in localStorage when the dialog is shown", async () => {
  const source = readFileSync(modulePath, "utf8");
  assert.match(source, /export const SEEN_KEY = "[^"]+"/);
  assert.match(source, /localStorage\.getItem\(SEEN_KEY\)/);
  assert.match(source, /localStorage\.setItem\(SEEN_KEY/);

  const { SEEN_KEY, hasSeen, markSeen } = await import(`${modulePath.href}?flag=${Date.now()}`);
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
  assert.equal(hasSeen(storage), false);
  markSeen(storage);
  assert.equal(hasSeen(storage), true);
  assert.equal(values.get(SEEN_KEY), "1");
});

test("first-visit dialog is dismissible and never blocks the guide link", () => {
  const source = readFileSync(modulePath, "utf8");
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="false"/);
  assert.match(source, /guide\.html/);
  assert.match(source, /fv-close/);
  assert.match(source, /Escape/);
  assert.match(source, /pointer-events:\s*none/);
  assert.match(source, /@media print[\s\S]*fv-first-visit/);
});

test("guide link is fixed in all four portals", () => {
  const navigation = readFileSync(navigationPath, "utf8");
  const links = navigation.match(/\{ label: "دليل المستخدم", href: "guide\.html", icon: "file" \}/g) || [];
  assert.equal(links.length, 4, "all four portals must keep the guide link");
});

test("public guide is static, printable, PDF-safe and carries no real credentials", () => {
  const guide = readFileSync(guidePath, "utf8");
  assert.match(guide, /onclick="window\.print\(\)"/);
  assert.match(guide, /@media print/);
  assert.match(guide, /حفظ الدليل أو طباعته/);
  assert.match(guide, /لا يحوي هذا الدليل أي رموز أو كلمات مرور حقيقية/);
  assert.doesNotMatch(guide, /portal-coming\.js|requireProfile|boot\(/);
  assert.doesNotMatch(guide, /\b[A-Z]{2}\d{4}\b/, "guide must not contain real platform IDs");
  assert.doesNotMatch(guide, /كلمة المرور\s*:\s*\S+/);
});

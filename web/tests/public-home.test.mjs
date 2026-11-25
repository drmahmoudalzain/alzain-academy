import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const htmlPath = new URL("../index.html", import.meta.url);
const scriptPath = new URL("../src/pages/home.js", import.meta.url);
const cssPath = new URL("../public/css/public-home.css", import.meta.url);

test("public home has accessible landmarks and real entry links", () => {
  assert.ok(existsSync(scriptPath), "public home module is missing");
  const html = readFileSync(htmlPath, "utf8");
  assert.equal((html.match(/<h1\b/g) || []).length, 1, "home should have one main heading");
  assert.match(html, /href="#mainContent"/, "skip link should target the main content");
  assert.match(html, /id="mainContent"/, "main landmark should have the skip target");
  assert.match(html, /id="mobileMenuToggle"[^>]*aria-expanded="false"[^>]*aria-controls="mobileNav"/);
  assert.match(html, /id="mobileNav"/, "mobile navigation target is missing");
  assert.match(html, /login\.html/, "login link is missing");
  assert.match(html, /guide\.html/, "public guide link is missing");
  assert.match(html, /pages\/library\.html/, "authenticated library route is missing");
  assert.doesNotMatch(html, /href=["']#["']/, "dead hash links are not allowed");
});

test("public home does not depend on a server or present hard-coded statistics", () => {
  const html = readFileSync(htmlPath, "utf8");
  const script = readFileSync(scriptPath, "utf8");
  assert.doesNotMatch(html, /stat-value|\/api\/public-stats/);
  assert.doesNotMatch(script, /fetch\s*\(|\/api\/public-stats|supabase/i);
});

test("public home styles support narrow screens and reduced motion", () => {
  assert.ok(existsSync(cssPath), "public home stylesheet is missing");
  const css = readFileSync(cssPath, "utf8");
  assert.match(css, /@media\s*\(max-width:\s*480px\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /:focus-visible/);
});

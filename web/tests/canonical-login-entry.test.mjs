import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const CANONICAL = "login.html?v=2";
const entryPages = ["index.html", "guide.html"];
const runtimeFiles = ["src/lib/auth.js", "src/lib/layout.js"];

function entries(name) {
  const html = readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
  return {
    hrefs: [...html.matchAll(/href="([^"]*login\.html[^"]*)"/g)].map((match) => match[1]),
    sitePaths: [...html.matchAll(/data-site-path="([^"]*login\.html[^"]*)"/g)].map((match) => match[1]),
  };
}

test("entry pages point to the cache-safe canonical login URL", () => {
  for (const name of entryPages) {
    const { hrefs, sitePaths } = entries(name);
    assert.ok(hrefs.length > 0, `${name} must link to login`);
    for (const href of hrefs) {
      assert.match(href, /^login\.html\?v=2$/, `${name} has a stale login link: ${href}`);
    }
    for (const sitePath of sitePaths) {
      assert.equal(sitePath, CANONICAL, `${name} has a stale runtime login path: ${sitePath}`);
    }
  }
});

test("runtime login redirects use the canonical login URL", () => {
  for (const name of runtimeFiles) {
    const source = readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
    const calls = [...source.matchAll(/p\(([`"])(login\.html[^`"]*)\1\)/g)].map((match) => match[2]);
    assert.ok(calls.length > 0, `${name} must navigate to login`);
    for (const call of calls) {
      assert.match(call, /^login\.html\?v=2(&|$)/, `${name} has a stale login redirect: ${call}`);
    }
  }
});

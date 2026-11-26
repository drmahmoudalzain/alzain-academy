import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../../supabase/functions/legacy-login/index.ts", import.meta.url),
  "utf8",
);

test("legacy-login imports Buffer explicitly for the Deno runtime", () => {
  assert.match(source, /import\s*\{[^}]*\bBuffer\b[^}]*\}\s*from\s*["']node:buffer["']/);
});

test("legacy-login never lets scrypt errors escape as HTTP 500", () => {
  const verify = source.slice(source.indexOf("function verifyScrypt"), source.indexOf("function errorResponse"));
  assert.match(verify, /try\s*\{/, "verifyScrypt must guard scrypt errors");
  assert.match(verify, /catch\s*(\([^)]*\))?\s*\{/, "verifyScrypt must catch scrypt errors");
});

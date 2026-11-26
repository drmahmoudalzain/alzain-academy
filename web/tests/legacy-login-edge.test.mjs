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

test("credential refusals stay structured 200 responses", () => {
  assert.match(source, /function errorResponse\([^)]*\)\s*\{\s*return json\(200, \{ ok: false, error \}\)/);
  assert.match(source, /errorResponse\('invalid_credentials'\)/);
});

test("service failures are logged and returned as 503, not a structured refusal", () => {
  const helper = source.slice(source.indexOf("function serviceUnavailable"), source.indexOf("Deno.serve"));
  assert.match(helper, /json\(503, \{ ok: false, error: 'service_unavailable' \}\)/);
  assert.match(helper, /console\.error\(/, "service failures must be logged");
  assert.match(source, /serviceUnavailable\('db_error'\)/);
  assert.match(source, /serviceUnavailable\('auth_create_failed'\)/);
});

test("the outer catch reports a service failure instead of internal_error", () => {
  const marker = "} catch (err) {";
  const start = source.lastIndexOf(marker);
  assert.notEqual(start, -1, "the outer catch must bind the error so it can be logged");
  const tail = source.slice(start);
  assert.match(tail, /console\.error\('legacy-login unexpected error:'/);
  assert.match(tail, /err instanceof Error \? err\.name : 'unknown'/);
  assert.match(tail, /serviceUnavailable\('unexpected'\)/);
  assert.doesNotMatch(source, /errorResponse\('internal_error'\)/);
});

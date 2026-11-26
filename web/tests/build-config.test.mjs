import test from "node:test";
import assert from "node:assert/strict";
import { buildConfig } from "../vite.config.js";

const valid = {
  VITE_SUPABASE_URL: "https://abc123xyz.supabase.co",
  VITE_SUPABASE_ANON_KEY: "public-anon-key",
};

test("buildConfig refuses a missing Supabase URL", () => {
  assert.throws(
    () => buildConfig({ VITE_SUPABASE_ANON_KEY: valid.VITE_SUPABASE_ANON_KEY }),
    /VITE_SUPABASE_URL/,
  );
});

test("buildConfig refuses a missing anon key", () => {
  assert.throws(
    () => buildConfig({ VITE_SUPABASE_URL: valid.VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: "YOUR-ANON-KEY" }),
    /VITE_SUPABASE_ANON_KEY/,
  );
});

test("buildConfig refuses placeholder values", () => {
  assert.throws(
    () => buildConfig({ VITE_SUPABASE_URL: "YOUR-PROJECT-REF", VITE_SUPABASE_ANON_KEY: "YOUR-ANON-KEY" }),
    /VITE_SUPABASE_URL/,
  );
});

test("buildConfig keeps the Pages base and discovers the login entry", () => {
  const config = buildConfig(valid);
  assert.equal(config.base, "/alzain-academy/");
  assert.ok(config.build.rollupOptions.input.login, "login entry must be present");
});

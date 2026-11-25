import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { profileFromMetadata } = await import("../src/lib/profile.js");

test("metadata fallback derives identity from auth metadata without trusting a DB row", () => {
  const profile = profileFromMetadata({
    id: "auth-1",
    email: "code@students.local",
    user_metadata: { full_name: "طالب تجريبي", contact_email: "code@students.local", platform_id: "BM9001" },
    app_metadata: { academy_user_id: 42, role: "teacher" },
  });

  assert.equal(profile.id, 42);
  assert.equal(profile.role, "teacher");
  assert.equal(profile.name, "طالب تجريبي");
  assert.equal(profile.platform_id, "BM9001");
  assert.equal(profile.is_staff, true);
  assert.equal(profile.must_change_password, false);
});

test("only a successful users row is cached; the metadata fallback is returned directly", () => {
  const source = readFileSync(new URL("../src/lib/auth.js", import.meta.url), "utf8");
  assert.match(source, /profileFromMetadata\(user\)/);
  assert.doesNotMatch(source, /remember\(/);
  assert.match(source, /set\(key, data, 300000\)/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const clientPath = new URL("../src/lib/owner-admin.js", import.meta.url);
const functionPath = new URL("../../supabase/functions/owner-user-admin/index.ts", import.meta.url);
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

async function loadClient() {
  assert.ok(existsSync(clientPath), "web/src/lib/owner-admin.js must exist");
  return import("../src/lib/owner-admin.js");
}

function readEdgeFunction() {
  assert.ok(existsSync(functionPath), "supabase/functions/owner-user-admin/index.ts must exist");
  return readFileSync(functionPath, "utf8");
}

test("temporary password uses 12 unambiguous characters from crypto randomness", async () => {
  const { generateTemporaryPassword } = await loadClient();
  const source = readFileSync(clientPath, "utf8");
  assert.match(source, /crypto\.getRandomValues/);
  assert.doesNotMatch(source, /Math\.random/);

  for (let i = 0; i < 50; i += 1) {
    const password = generateTemporaryPassword();
    assert.equal(password.length, 12);
    for (const char of password) {
      assert.ok(alphabet.includes(char), `unexpected password character: ${char}`);
    }
    for (const banned of ["0", "O", "1", "l", "I"]) {
      assert.ok(!password.includes(banned), `password contains ambiguous character: ${banned}`);
    }
  }
});

test("invokeOwnerAdmin forwards the payload and unwraps the success envelope", async () => {
  const { invokeOwnerAdmin } = await loadClient();
  const calls = [];
  const fakeClient = {
    functions: {
      invoke: async (name, options) => {
        calls.push([name, options]);
        return { data: { ok: true, data: { id: 7 } }, error: null };
      },
    },
  };

  const result = await invokeOwnerAdmin({ op: "create", user_id: 7 }, fakeClient);

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "owner-user-admin");
  assert.deepEqual(calls[0][1], { body: { op: "create", user_id: 7 } });
  assert.deepEqual(result, { ok: true, data: { id: 7 } });
});

test("invokeOwnerAdmin reports a clear error when Functions is unavailable", async () => {
  const { invokeOwnerAdmin } = await loadClient();
  assert.deepEqual(
    await invokeOwnerAdmin({ op: "set_active" }, {}),
    { ok: false, error: "Supabase Functions غير مهيأ" },
  );
  assert.deepEqual(
    await invokeOwnerAdmin({ op: "set_active" }, { functions: {} }),
    { ok: false, error: "Supabase Functions غير مهيأ" },
  );
});

test("Edge Function guards ownership and supports every Auth operation", () => {
  const source = readEdgeFunction();
  for (const op of ["create", "reset_password", "ensure_auth", "sync_auth_identity", "set_active", "delete_user"]) {
    assert.ok(source.includes(`case "${op}"`), `missing op: ${op}`);
  }
  assert.match(source, /is_owner_by_auth_uid/);
  assert.match(source, /Deno\.env\.get\(/);
  assert.doesNotMatch(source, /eyJ[A-Za-z0-9_-]{10,}/);
  assert.doesNotMatch(source, /(?:service_role|serviceRole)\s*[:=]\s*['"][A-Za-z0-9_-]{20,}/);
});

test("Edge Function forwards the caller token on every data RPC", () => {
  const source = readEdgeFunction();
  assert.match(source, /const authHeader\s*=/);
  assert.match(source, /Authorization:\s*authHeader/);
  assert.match(source, /global:\s*\{\s*headers:/);
  assert.match(source, /auth\.getUser\(token\)/);
});

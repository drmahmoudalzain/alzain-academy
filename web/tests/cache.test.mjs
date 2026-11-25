import test from "node:test";
import assert from "node:assert/strict";

const store = new Map();
globalThis.sessionStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
  key: (i) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
};

const { setCacheUser, set, peek, remember, clear } = await import("../src/lib/cache.js");
const { onDispose, disposeAll } = await import("../src/lib/lifecycle.js");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("peek ignores an entry after its TTL expires", async () => {
  setCacheUser("u-ttl");
  set("expiring", "value", 10);
  assert.equal(peek("expiring"), "value");
  await sleep(40);
  assert.equal(peek("expiring"), null);
});

test("clear(prefix) removes only that user's scoped keys", () => {
  setCacheUser("1");
  set("dashboard", { n: 1 });
  setCacheUser("2");
  set("dashboard", { n: 2 });

  clear("u1:");

  setCacheUser("1");
  assert.equal(peek("dashboard"), null);
  setCacheUser("2");
  assert.deepEqual(peek("dashboard"), { n: 2 });
});

test("clear() empties the whole cache namespace", () => {
  setCacheUser("u-all");
  set("a", 1);
  clear();
  assert.equal(peek("a"), null);
});

test("remember reuses the cached value without calling the loader again", async () => {
  setCacheUser("u-remember");
  let calls = 0;
  const loader = async () => {
    calls += 1;
    return { ok: true, data: calls };
  };

  const first = await remember("stats", 60000, loader);
  const second = await remember("stats", 60000, loader);

  assert.deepEqual(first, { ok: true, data: 1 });
  assert.deepEqual(second, first);
  assert.equal(calls, 1);
});

test("disposeAll runs registered cleanups once and forgets them", () => {
  const seen = [];
  onDispose(() => seen.push("a"));
  onDispose(() => seen.push("b"));
  disposeAll();
  disposeAll();
  assert.deepEqual(seen, ["a", "b"]);
});

const { isCacheable, isInvalidating } = await import("../src/lib/cache-policy.js");

test("read whitelist contains dashboards but never the grading write", () => {
  assert.equal(isCacheable("teacher_dashboard"), true);
  assert.equal(isCacheable("my_profile"), true);
  assert.equal(isCacheable("teacher_grade_submission"), false);
});

test("write list invalidates grading and submission calls but leaves unknown RPCs alone", () => {
  assert.equal(isInvalidating("teacher_grade_submission"), true);
  assert.equal(isInvalidating("student_exam_submit"), true);
  assert.equal(isInvalidating("unknown_rpc"), false);
});

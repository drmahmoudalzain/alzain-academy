import assert from "node:assert/strict";
import test from "node:test";
import { parseReviewFlags, serializeReviewFlags, toggleReviewFlag } from "../src/lib/exam-review.js";

test("toggleReviewFlag returns a new set and toggles only the requested question", () => {
  const original = new Set(["q1"]);
  const added = toggleReviewFlag(original, "q2");
  const removed = toggleReviewFlag(added, "q1");

  assert.deepEqual([...original], ["q1"]);
  assert.deepEqual([...added], ["q1", "q2"]);
  assert.deepEqual([...removed], ["q2"]);
});

test("review flags round-trip only IDs belonging to the current attempt", () => {
  const raw = serializeReviewFlags(new Set(["q3", "q1"]));
  const restored = parseReviewFlags(raw, new Set(["q1", "q2", "q3"]));

  assert.deepEqual([...restored], ["q3", "q1"]);
});

test("malformed storage, stale IDs, and blank IDs are ignored", () => {
  assert.deepEqual([...parseReviewFlags("{broken", ["q1"])], []);
  assert.deepEqual([...parseReviewFlags('{"q1":true}', ["q1"])], []);
  assert.deepEqual([...parseReviewFlags('["q1","stale",""]', ["q1", "q2"])], ["q1"]);
  assert.deepEqual([...toggleReviewFlag(new Set(["q1"]), "")], ["q1"]);
});

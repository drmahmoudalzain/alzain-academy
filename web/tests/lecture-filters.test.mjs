import assert from "node:assert/strict";
import test from "node:test";
import { filterLectures } from "../src/lib/lecture-filters.js";

const lectures = [
  { id: 1, course_id: 10, status: "upcoming", lecture_type: "direct", title: "مرافعات" },
  { id: 2, course_id: 10, status: "attended", lecture_type: "recorded", title: "القانون الإداري", teacher: "سامي" },
  { id: 3, course_id: 20, status: "live", lecture_type: "online", title: "Public Law", course_code: "LAW101" },
];

test("filterLectures applies course, status, and lecture type independently", () => {
  assert.deepEqual(filterLectures(lectures, { course: "10" }).map((row) => row.id), [1, 2]);
  assert.deepEqual(filterLectures(lectures, { status: "live" }).map((row) => row.id), [3]);
  assert.deepEqual(filterLectures(lectures, { type: "recorded" }).map((row) => row.id), [2]);
});

test("filterLectures composes filters and searches Arabic or Latin text", () => {
  assert.deepEqual(
    filterLectures(lectures, { course: "10", status: "attended", type: "recorded", query: "الإداري" }).map((row) => row.id),
    [2],
  );
  assert.deepEqual(filterLectures(lectures, { query: "law101" }).map((row) => row.id), [3]);
});

test("filterLectures tolerates absent optional fields, empty lists, and invalid input", () => {
  const sparse = [{ id: 4, lecture_type: "recorded" }];
  assert.deepEqual(filterLectures(sparse, { query: "missing" }), []);
  assert.deepEqual(filterLectures(sparse, { type: "recorded" }), sparse);
  assert.deepEqual(filterLectures([null, undefined, ...sparse]), sparse);
  assert.deepEqual(filterLectures([], { type: "direct" }), []);
  assert.deepEqual(filterLectures(null, { type: "direct" }), []);
});

test("filterLectures does not mutate its input", () => {
  const input = [...lectures];
  filterLectures(input, { course: "10", query: "مرافعات" });
  assert.deepEqual(input, lectures);
});

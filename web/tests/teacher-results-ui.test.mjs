import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../pages/teacher/results.html", import.meta.url), "utf8");
const js = readFileSync(new URL("../src/pages/teacher/results.js", import.meta.url), "utf8");
const nav = readFileSync(new URL("../src/lib/navigation.js", import.meta.url), "utf8");
const cachePolicy = readFileSync(new URL("../src/lib/cache-policy.js", import.meta.url), "utf8");

test("results page is an RTL teacher page with read-only result controls", () => {
  assert.match(html, /<html lang="ar" dir="rtl">/);
  assert.match(html, /src="\/src\/pages\/teacher\/results\.js"/);
  for (const id of ["trTerm", "trLoadBtn", "trRefreshBtn", "trResults", "trSummary", "trMsg"]) {
    assert.ok(html.includes(`id="${id}"`), `missing control: ${id}`);
  }
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /التوصية فقط/);
  assert.doesNotMatch(html, /id="tr(Grade|Points|Decision|Status)"/);
});

test("teacher script reads assigned results and writes only recommendations", () => {
  assert.match(js, /call\("teacher_list_my_course_results"/);
  assert.match(js, /call\("teacher_record_result_recommendation"/);
  assert.doesNotMatch(js, /call\("(?!(?:teacher_list_my_course_results|teacher_record_result_recommendation))[a-z0-9_]+"/);
  assert.match(js, /import\s*\{[^}]*call[^}]*\}\s*from\s*"\.\.\/\.\.\/lib\/api\.js"/);
  assert.match(js, /import\s*\{[^}]*openForm[^}]*\}\s*from\s*"\.\/\.\/common\.js"|import\s*\{[^}]*openForm[^}]*\}\s*from\s*"\.\/common\.js"/);
  assert.doesNotMatch(js, /from\("course_semester_results"\)/);
});

test("recommendation is limited to undecided rows and never sets outcome fields", () => {
  assert.match(js, /can_recommend/);
  assert.match(js, /if \(!row\?\.can_recommend\) return/);
  assert.match(js, /data-recommend="/);
  assert.match(js, /p_result_id: \w+\.id, p_recommendation: \w+\.recommendation/);
  assert.doesNotMatch(js, /p_status/);
  assert.doesNotMatch(js, /p_owner_decision/);
  assert.doesNotMatch(js, /p_points/);
  assert.doesNotMatch(js, /p_reason/);
});

test("term filtering stays in the page because the reader accepts period ids", () => {
  assert.match(js, /p_year_id: null, p_semester_id: null/);
  assert.match(js, /String\(\w+\.term_no\) === term/);
  assert.match(html, /<option value="1">الفصل الأول<\/option>/);
  assert.match(html, /<option value="2">الفصل الثاني<\/option>/);
});

test("results reload after a recommendation and load failures are visible", () => {
  assert.match(js, /await load\(\);[\s\S]{0,120}تم تسجيل التوصية/);
  assert.match(js, /showMessage\(/);
  assert.match(js, /emptyState\("تعذّر تحميل النتائج"/);
});

test("teacher navigation exposes results and the write invalidates cache", () => {
  assert.match(nav, /label: "نتائج المقررات", href: "pages\/teacher\/results\.html"/);
  assert.match(cachePolicy, /"teacher_record_result_recommendation"/);
  const cacheable = cachePolicy.slice(cachePolicy.indexOf("CACHEABLE"), cachePolicy.indexOf("INVALIDATES"));
  assert.doesNotMatch(cacheable, /teacher_list_my_course_results/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../pages/owner/academic.html", import.meta.url), "utf8");
const js = readFileSync(new URL("../src/pages/owner/academic.js", import.meta.url), "utf8");
const nav = readFileSync(new URL("../src/lib/navigation.js", import.meta.url), "utf8");
const cachePolicy = readFileSync(new URL("../src/lib/cache-policy.js", import.meta.url), "utf8");

const rpcs = [
  "academic_preview_close_year",
  "academic_close_year_and_open_next",
  "academic_rebuild_course_results",
  "academic_owner_list_course_results",
  "academic_owner_list_graduation_candidates",
  "academic_owner_decide_course_result",
  "academic_owner_decide_graduation",
  "academic_open_second_semester",
  "academic_owner_set_academic_status",
];

test("academic page is an RTL owner page with preview, decisions, and archive panels", () => {
  assert.match(html, /<html lang="ar" dir="rtl">/);
  assert.match(html, /src="\/src\/pages\/owner\/academic\.js"/);
  for (const id of [
    "oyPeriods", "oyPreview", "oyPreviewBtn", "oyCloseForm", "oyCloseBtn",
    "oyResults", "oyGraduation", "oyArchiveList", "oyArchiveApplyBtn",
  ]) {
    assert.ok(html.includes(`id="${id}"`), `missing control: ${id}`);
  }
  assert.match(html, /aria-live="polite"/);
});

test("academic script invokes every owner RPC through the unified client", () => {
  for (const rpc of rpcs) {
    assert.ok(js.includes(rpc), `missing RPC: ${rpc}`);
  }
  assert.match(js, /import\s*\{[^}]*call[^}]*\}\s*from\s*"\.\.\/\.\.\/lib\/api\.js"/);
  assert.doesNotMatch(js, /from\("course_semester_results"\)/);
  assert.doesNotMatch(js, /from\("graduation_approvals"\)/);
});

test("closing the year requires a preview with no blockers and a written reason", () => {
  assert.match(js, /safe_to_close/);
  assert.match(js, /oyCloseBtn"\)\.disabled = !preview\.safe_to_close/);
  assert.match(js, /if \(!preview\?\.safe_to_close \|\| !openYear\(\)\)/);
  assert.match(js, /if \(!label \|\| !code \|\| !reason\)/);
  assert.match(js, /p_archive_other_tracks: form\.elements\.archive_other\.checked/);
  assert.match(js, /blockers/);
});

test("every decision button requires a reason before the write", () => {
  assert.match(js, /data-action="result-decision"/);
  assert.match(js, /data-action="graduation-decision"/);
  assert.match(js, /oyDecisionReason"\)\.value\.trim\(\)/);
  assert.match(js, /oyGraduationReason"\)\.value\.trim\(\)/);
  assert.match(js, /اكتب سبب القرار/);
});

test("the page reads policy thresholds instead of copying numbers into code", () => {
  assert.match(js, /academic_policies/);
  assert.match(js, /course_target_points/);
  assert.match(js, /course_pass_points/);
  assert.doesNotMatch(js, /\b300\b/);
  assert.doesNotMatch(js, /\b150\b/);
});

test("owner navigation exposes the academic page and writes invalidate cached data", () => {
  assert.match(nav, /label: "العام الدراسي", href: "pages\/owner\/academic\.html"/);
  for (const rpc of rpcs.filter((name) => !name.includes("preview") && !name.includes("list_"))) {
    assert.ok(cachePolicy.includes(`"${rpc}"`), `${rpc} must invalidate cache`);
  }
});

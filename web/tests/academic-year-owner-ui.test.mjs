import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const migrationPath = new URL("../../supabase/migrations/0119_owner_academic_ui.sql", import.meta.url);
const rollbackPath = new URL("../../supabase/rollback/0119_owner_academic_ui_rollback.sql", import.meta.url);

function read(path, label) {
  assert.ok(existsSync(path), `${label} must exist`);
  return readFileSync(path, "utf8");
}

const migration = () => read(migrationPath, "0119 migration");
const rollback = () => read(rollbackPath, "0119 rollback");

function bodyOf(name) {
  const sql = migration();
  const start = sql.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const end = sql.indexOf("$$;", start);
  assert.notEqual(end, -1, `missing function body terminator for ${name}`);
  return sql.slice(start, end);
}

const functions = [
  "academic_owner_list_course_results",
  "academic_owner_list_graduation_candidates",
  "academic_owner_enroll_in_semester",
  "academic_owner_set_academic_status",
];

test("0119 defines four owner-only functions with definer and fixed search path", () => {
  const sql = migration();
  for (const name of functions) {
    const body = bodyOf(name);
    assert.match(body, /security definer/, `${name}`);
    assert.match(body, /set search_path = public/, `${name}`);
    assert.match(body, /public\.current_user_id\(\)/, `${name}`);
    assert.match(body, /public\.is_owner\(\)/, `${name}`);
  }
  assert.doesNotMatch(migration(), /teacher_record_result_recommendation/);
});

test("result and graduation lists expose owner-only reads of protected tables", () => {
  const results = bodyOf("academic_owner_list_course_results");
  assert.match(results, /from public\.course_semester_results r/);
  assert.match(results, /teacher_recommendation/);
  assert.match(results, /owner_decision/);
  assert.match(results, /v_status is null or r\.status = v_status/);
  assert.match(results, /v_status not in \('pass', 'needs_decision', 'fail'\)/);
  assert.match(results, /p_semester_id is null or r\.semester_id = p_semester_id/);
  const graduation = bodyOf("academic_owner_list_graduation_candidates");
  assert.match(graduation, /join public\.graduation_approvals g/);
  assert.match(graduation, /u\.track in \('bachelor_m', 'bachelor_f'\)/);
  assert.match(graduation, /u\.level = 4/);
  assert.match(graduation, /bool_and\(r\.status = 'pass'\)/);
});

test("semester enrollment is limited to open bachelor periods and audit-logged", () => {
  const body = bodyOf("academic_owner_enroll_in_semester");
  assert.match(body, /s\.status = 'open'/);
  assert.match(body, /y\.status = 'open'/);
  assert.match(body, /v_student\.track not in \('bachelor_m', 'bachelor_f'\)/);
  assert.match(body, /c\.archived = false/);
  assert.match(body, /b\.parent_course_id = c\.id/);
  assert.match(body, /on conflict \(course_id, student_id, year_id, semester_id\)/);
  assert.match(body, /'academic_owner_enroll_in_semester'/);
  assert.match(body, /'year_id', v_semester\.year_id, 'semester_id', v_semester\.id/);
});

test("academic status changes require a reason and never delete the student", () => {
  const body = bodyOf("academic_owner_set_academic_status");
  assert.match(body, /v_status not in \('active', 'graduated', 'archived'\)/);
  assert.match(body, /v_reason = ''/);
  assert.match(body, /update public\.users set academic_status = v_status/);
  assert.match(body, /'academic_owner_set_academic_status'/);
  assert.doesNotMatch(body, /delete from public\.users/i);
});

test("no read or write function is granted to anon", () => {
  const sql = migration();
  const grants = sql.slice(sql.indexOf("do $$"), sql.indexOf("notify pgrst"));
  for (const name of functions) {
    assert.ok(grants.includes(name), `missing grant for ${name}`);
  }
  assert.match(grants, /revoke all on function public\.%s from public, anon/);
  assert.match(grants, /grant execute on function public\.%s to authenticated, service_role/);
  assert.doesNotMatch(sql, /grant\s+execute[^\n]*\banon\b/i);
});

test("rollback removes only the four UI functions", () => {
  const sql = rollback();
  for (const name of functions) {
    assert.match(sql, new RegExp(`drop function if exists public\\.${name}\\(`));
  }
  assert.doesNotMatch(sql, /drop table/i);
  assert.doesNotMatch(sql, /delete from/i);
});

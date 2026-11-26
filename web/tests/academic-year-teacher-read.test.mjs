import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const migrationPath = new URL("../../supabase/migrations/0120_teacher_result_read.sql", import.meta.url);
const rollbackPath = new URL("../../supabase/rollback/0120_teacher_result_read_rollback.sql", import.meta.url);

function read(path, label) {
  assert.ok(existsSync(path), `${label} must exist`);
  return readFileSync(path, "utf8");
}

const migration = () => read(migrationPath, "0120 migration");
const rollback = () => read(rollbackPath, "0120 rollback");

function bodyOf() {
  const sql = migration();
  const start = sql.indexOf("create or replace function public.teacher_list_my_course_results(");
  assert.notEqual(start, -1, "missing teacher result reader");
  const end = sql.indexOf("$$;", start);
  assert.notEqual(end, -1, "missing function terminator");
  return sql.slice(start, end);
}

test("0120 adds one read-only teacher function with definer and fixed search path", () => {
  const sql = migration();
  assert.equal((sql.match(/create or replace function public\./g) ?? []).length, 1);
  const body = bodyOf();
  assert.match(body, /stable/);
  assert.match(body, /security definer/);
  assert.match(body, /set search_path = public/);
  assert.match(body, /public\.current_user_id\(\)/);
  assert.doesNotMatch(body, /\binsert into\b/i);
  assert.doesNotMatch(body, /\bupdate public\./i);
  assert.doesNotMatch(body, /\bdelete from\b/i);
});

test("teacher can read only results of courses assigned to them in the open year", () => {
  const body = bodyOf();
  assert.match(body, /y\.status = 'open'/);
  assert.match(body, /c\.teacher_id = v_uid/);
  assert.match(body, /r\.year_id = v_year_id/);
  assert.match(body, /p_semester_id is null or r\.semester_id = p_semester_id/);
  assert.doesNotMatch(body, /is_owner\(\)/);
});

test("the reader marks which results can receive a recommendation", () => {
  const body = bodyOf();
  assert.match(body, /r\.status = 'needs_decision' and r\.owner_decision is null/);
  assert.match(body, /'can_recommend', t\.can_recommend/);
  assert.match(body, /'teacher_recommendation', t\.teacher_recommendation/);
  assert.match(body, /'owner_decision', t\.owner_decision/);
});

test("the reader is not available to anon and the rollback removes only that reader", () => {
  const sql = migration();
  assert.match(sql, /revoke all on function public\.teacher_list_my_course_results\(bigint, bigint\) from public, anon/);
  assert.match(sql, /grant execute on function public\.teacher_list_my_course_results\(bigint, bigint\) to authenticated, service_role/);
  assert.doesNotMatch(sql, /grant\s+execute[^\n]*\banon\b/i);
  assert.match(rollback(), /drop function if exists public\.teacher_list_my_course_results\(bigint, bigint\)/);
  assert.doesNotMatch(rollback(), /drop table/i);
  assert.doesNotMatch(rollback(), /drop function if exists public\.teacher_record_result_recommendation/i);
});

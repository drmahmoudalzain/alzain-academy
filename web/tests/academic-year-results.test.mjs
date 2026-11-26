import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const migrationPath = new URL("../../supabase/migrations/0117_result_decisions.sql", import.meta.url);
const rollbackPath = new URL("../../supabase/rollback/0117_result_decisions_rollback.sql", import.meta.url);

function read(path, label) {
  assert.ok(existsSync(path), `${label} must exist`);
  return readFileSync(path, "utf8");
}

const migration = () => read(migrationPath, "0117 migration");
const rollback = () => read(rollbackPath, "0117 rollback");

function bodyOf(name) {
  const sql = migration();
  const start = sql.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const end = sql.indexOf("$$;", start);
  assert.notEqual(end, -1, `missing function body terminator for ${name}`);
  return sql.slice(start, end);
}

const ownerFunctions = [
  "academic_rebuild_course_results",
  "academic_owner_decide_course_result",
  "academic_owner_decide_graduation",
  "academic_open_second_semester",
];

const rebuild = () => bodyOf("academic_rebuild_course_results");
const courseDecision = () => bodyOf("academic_owner_decide_course_result");
const graduation = () => bodyOf("academic_owner_decide_graduation");
const secondSemester = () => bodyOf("academic_open_second_semester");
const teacher = () => bodyOf("teacher_record_result_recommendation");

test("0117 defines owner decision functions and one narrow teacher function", () => {
  const sql = migration();
  for (const name of [...ownerFunctions, "teacher_record_result_recommendation"]) {
    assert.match(sql, new RegExp(`create or replace function public\\.${name}\\(`));
  }
  for (const body of [...ownerFunctions.map(bodyOf), teacher()]) {
    assert.match(body, /security definer/);
    assert.match(body, /set search_path = public/);
    assert.match(body, /public\.current_user_id\(\)/);
  }
  for (const name of ownerFunctions) {
    assert.match(bodyOf(name), /public\.is_owner\(\)/, `${name} must check is_owner()`);
  }
  assert.doesNotMatch(teacher(), /public\.is_owner\(\)/);
});

test("results are computed from points_ledger using policies, not hard-coded thresholds", () => {
  const body = rebuild();
  assert.match(body, /key = 'course_pass_points'/);
  assert.match(body, /key = 'point_sources'/);
  assert.match(body, /jsonb_array_elements_text/);
  assert.match(body, /from public\.points_ledger pl/);
  assert.match(body, /pl\.source_type = any\(v_sources\)/);
  assert.match(body, /s\.points >= v_pass then 'pass' else 'needs_decision'/);
  assert.doesNotMatch(body, />=\s*150/);
});

test("rebuild only touches the open year and preserves documented owner decisions", () => {
  const body = rebuild();
  assert.match(body, /y\.status = 'open'/);
  assert.match(body, /e\.status = 'active'/);
  assert.match(body, /on conflict \(student_id, course_id, year_id, semester_id\) do update/);
  assert.match(body, /insert into public\.course_semester_results as csr/);
  assert.match(body, /when csr\.owner_decision is null/);
  assert.match(body, /else csr\.status/);
  assert.doesNotMatch(body, /delete from public\.course_semester_results/i);
});

test("owner can override a teacher recommendation only with a written reason", () => {
  const body = courseDecision();
  assert.match(body, /v_decision not in \('pass', 'fail'\)/);
  assert.match(body, /v_reason = ''/);
  assert.match(body, /set status = v_decision/);
  assert.match(body, /owner_decision = v_decision/);
  assert.match(body, /reason = v_reason/);
  assert.match(body, /decided_by = v_uid/);
  assert.doesNotMatch(body, /v_result\.teacher_recommendation\s*=/);
  assert.match(body, /v_result\.year_id is distinct from v_year_id/);
});

test("graduation approval requires eligibility, reason, and an approver", () => {
  const body = graduation();
  assert.match(body, /v_decision not in \('approve', 'reject'\)/);
  assert.match(body, /v_student\.track not in \('bachelor_m', 'bachelor_f'\)/);
  assert.match(body, /v_student\.level is distinct from 4/);
  assert.match(body, /if v_decision = 'approve' and not v_all_pass then/);
  assert.match(body, /on conflict \(student_id, year_id\) do update/);
  assert.match(body, /approver_id = excluded\.approver_id/);
  assert.match(body, /set academic_status = 'graduated'/);
  assert.match(body, /'reason', v_reason/);
});

test("the second semester opens only after every first-semester course passes", () => {
  const body = secondSemester();
  assert.match(body, /s\.id = v_sem1 and s\.status = 'open'/);
  assert.match(body, /s\.id = v_sem2 and s\.status = 'closed'/);
  assert.match(body, /and r\.status = 'pass'/);
  assert.match(body, /if v_incomplete > 0 then/);
  assert.match(body, /set status = 'closed' where id = v_sem1/);
  assert.match(body, /set status = 'open' where id = v_sem2/);
  assert.match(body, /on conflict \(course_id, student_id, year_id, semester_id\)/);
});

test("opening the second semester copies enrollments, never historical grades", () => {
  const body = secondSemester();
  assert.match(body, /insert into public\.enrollments \(course_id, student_id, status, year_id, semester_id\)/);
  assert.match(body, /e\.semester_id = v_sem1 and e\.status = 'active'/);
  const sql = migration();
  for (const table of ["points_ledger", "attendance", "submissions"]) {
    assert.doesNotMatch(sql, new RegExp(`insert into public\\.${table}`, "i"));
  }
});

test("teacher writes one recommendation on an undecided result in their own course", () => {
  const body = teacher();
  assert.match(body, /v_rec not in \('pass', 'fail'\)/);
  assert.match(body, /c\.teacher_id = v_uid/);
  assert.match(body, /res\.status = 'needs_decision'/);
  assert.match(body, /res\.owner_decision is null/);
  assert.match(body, /set teacher_recommendation = v_rec/);
  assert.doesNotMatch(body, /set status\s*=/i);
  assert.doesNotMatch(body, /set owner_decision\s*=/i);
  assert.doesNotMatch(body, /set points\s*=/i);
  assert.doesNotMatch(body, /set reason\s*=/i);
  assert.doesNotMatch(body, /set decided_by\s*=/i);
  assert.doesNotMatch(body, /create or replace function public\.teacher_(?!record_result_recommendation)/);
});

test("grants keep teacher write narrow and owner decisions authenticated only", () => {
  const sql = migration();
  const loop = sql.slice(sql.indexOf("do $$"), sql.indexOf("notify pgrst"));
  for (const name of ownerFunctions) {
    assert.ok(loop.includes(name), `missing grant for ${name}`);
  }
  assert.match(loop, /grant execute on function public\.%s to authenticated, service_role/);
  assert.match(loop, /revoke all on function public\.teacher_record_result_recommendation\(bigint,text\) from public, anon, service_role/);
  assert.match(loop, /grant execute on function public\.teacher_record_result_recommendation\(bigint,text\) to authenticated/);
  assert.doesNotMatch(sql, /grant\s+execute[^\n]*\banon\b/i);
});

test("every decision path writes an audit row", () => {
  const sql = migration();
  for (const action of [
    "academic_rebuild_course_results",
    "academic_owner_decide_course_result",
    "academic_owner_decide_graduation",
    "academic_open_second_semester",
    "teacher_record_result_recommendation",
  ]) {
    assert.match(sql, new RegExp(`'${action}'`));
  }
  assert.match(courseDecision(), /actor_id, action, table_name, record_id, old_data, new_data/);
});

test("rollback removes only the five result functions", () => {
  const sql = rollback();
  for (const name of [...ownerFunctions, "teacher_record_result_recommendation"]) {
    assert.match(sql, new RegExp(`drop function if exists public\\.${name}\\(`));
  }
  assert.doesNotMatch(sql, /drop table/i);
  assert.doesNotMatch(sql, /drop column/i);
});

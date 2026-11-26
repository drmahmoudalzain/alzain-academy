import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const migrationPath = new URL("../../supabase/migrations/0115_academic_year.sql", import.meta.url);
const rollbackPath = new URL("../../supabase/rollback/0115_academic_year_rollback.sql", import.meta.url);
const specPath = new URL("../../docs/superpowers/specs/2026-11-26-academic-year-design.md", import.meta.url);

function read(path, label) {
  assert.ok(existsSync(path), `${label} must exist`);
  return readFileSync(path, "utf8");
}

const migration = () => read(migrationPath, "0115 migration");
const rollback = () => read(rollbackPath, "0115 rollback");

const redefined = [
  "management_enroll_student",
  "management_change_student_track",
  "management_enroll_student_in_track",
  "management_transfer_student",
  "management_set_enrollment_status",
  "management_remove_enrollment",
];

function bodyOf(name) {
  const sql = migration();
  const start = sql.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const end = sql.indexOf("$$;", start);
  assert.notEqual(end, -1, `missing function body terminator for ${name}`);
  return sql.slice(start, end);
}

test("0115 creates the academic year schema", () => {
  const sql = migration();
  for (const table of [
    "academic_years",
    "semesters",
    "academic_policies",
    "course_semester_results",
    "graduation_approvals",
  ]) {
    assert.match(sql, new RegExp(`create table public\\.${table}\\s*\\(`));
  }
  assert.match(sql, /add column if not exists academic_status text not null default 'active'/);
  assert.match(sql, /add column year_id bigint/);
  assert.match(sql, /add column semester_id bigint/);
});

test("existing enrollments are backfilled as current year and first semester", () => {
  const sql = migration();
  assert.match(sql, /insert into public\.academic_years[\s\S]*?'CURRENT'/);
  assert.match(sql, /select id, 1, 'open' from public\.academic_years where code = 'CURRENT'/);
  assert.match(sql, /set year_id = y\.id,\s*semester_id = s\.id/);
  assert.match(sql, /s\.term_no = 1/);
  assert.match(sql, /alter table public\.enrollments alter column year_id set not null/);
  assert.match(sql, /primary key \(course_id, student_id, year_id, semester_id\)/);
});

test("no old two-column conflict target remains", () => {
  assert.doesNotMatch(migration(), /on conflict \(course_id, student_id\)/);
  for (const name of redefined) {
    assert.match(
      bodyOf(name),
      /on conflict \(course_id, student_id, year_id, semester_id\)|where course_id = p_course_id/,
      `${name} must use the new period key`,
    );
  }
});

test("redefined owner functions still check the signed-in owner", () => {
  for (const name of redefined) {
    const body = bodyOf(name);
    assert.match(body, /public\.current_user_id\(\)/, `${name} must check current_user_id()`);
    assert.match(body, /public\.is_owner\(\)/, `${name} must check is_owner()`);
  }
});

test("writes are limited to the open year and first semester", () => {
  for (const name of redefined) {
    const body = bodyOf(name);
    assert.match(body, /public\.current_academic_year_id\(\)/, `${name} must use the current year`);
    assert.match(body, /public\.current_semester_id\(1(?:::smallint)?\)/, `${name} must use the first semester`);
  }
});

test("teacher permission is not widened", () => {
  assert.doesNotMatch(migration(), /create or replace function public\.teacher_/i);
  assert.doesNotMatch(migration(), /grant[^\n]*teacher_/i);
});

test("thresholds live in data, not in code", () => {
  const sql = migration();
  assert.match(sql, /course_target_points/);
  assert.match(sql, /course_pass_points/);
  assert.match(sql, /'300'::jsonb/);
  assert.match(sql, /'150'::jsonb/);
});

test("parameters with defaults come last in every function signature", () => {
  const signatures = [...migration().matchAll(/create or replace function public\.\w+\(([^)]*)\)/g)];
  assert.ok(signatures.length > 0, "expected function signatures to inspect");
  for (const [, signature] of signatures) {
    let seenDefault = false;
    for (const param of signature.split(",").map((p) => p.trim()).filter(Boolean)) {
      const hasDefault = /\bdefault\b/i.test(param);
      assert.ok(!seenDefault || hasDefault, `parameter after a default must also have a default: ${param}`);
      seenDefault ||= hasDefault;
    }
  }
});

test("grants are scoped to authenticated and service_role", () => {
  const sql = migration();
  const loop = sql.slice(sql.indexOf("do $$"), sql.indexOf("notify pgrst"));
  assert.ok(loop.includes("do $$"), "expected the grant loop");
  for (const signature of [
    "current_academic_year_id()",
    "current_semester_id(smallint)",
    ...redefined.map(
      (name) =>
        ({
          management_enroll_student: "management_enroll_student(bigint,text)",
          management_change_student_track: "management_change_student_track(bigint,text,smallint,boolean)",
          management_enroll_student_in_track: "management_enroll_student_in_track(bigint,text,smallint)",
          management_transfer_student: "management_transfer_student(bigint,bigint,bigint)",
          management_set_enrollment_status: "management_set_enrollment_status(bigint,bigint,text)",
          management_remove_enrollment: "management_remove_enrollment(bigint,bigint)",
        })[name],
    ),
  ]) {
    assert.ok(loop.includes(`'${signature}'`), `missing grant entry for ${signature}`);
  }
  assert.match(loop, /revoke all on function public\.%s from public, anon/);
  assert.match(loop, /grant execute on function public\.%s to authenticated/);
  assert.match(sql, /grant execute on function public\.current_academic_year_id\(\) to service_role/);
  assert.match(sql, /grant execute on function public\.current_semester_id\(smallint\) to service_role/);
  assert.match(sql, /grant all on public\.course_semester_results to service_role/);
  assert.doesNotMatch(sql, /grant\s+execute[^\n]*\banon\b/i);
});

test("results and approvals are not directly readable", () => {
  const sql = migration();
  for (const table of ["course_semester_results", "graduation_approvals"]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(sql, new RegExp(`revoke all on public\\.${table} from public, anon, authenticated`));
    assert.doesNotMatch(sql, new RegExp(`create policy ${table}_select`));
  }
});

test("rollback removes the schema and restores the old enrollment key", () => {
  const sql = rollback();
  for (const table of [
    "academic_years",
    "semesters",
    "academic_policies",
    "course_semester_results",
    "graduation_approvals",
  ]) {
    assert.match(sql, new RegExp(`drop table if exists public\\.${table}`));
  }
  assert.match(sql, /drop column if exists year_id/);
  assert.match(sql, /drop column if exists semester_id/);
  assert.match(sql, /primary key \(course_id, student_id\)/);
  for (const name of redefined) {
    assert.match(sql, new RegExp(`drop function if exists public\\.${name}\\(`));
    assert.match(sql, new RegExp(`create or replace function public\\.${name}\\(`));
  }
  assert.match(sql, /on conflict \(course_id, student_id\)/);
});

test("spec keeps the bachelor-only scope and the owner decision rule", () => {
  const doc = read(specPath, "academic year spec");
  assert.match(doc, /bachelor_m/);
  assert.match(doc, /bachelor_f/);
  assert.match(doc, /external.*equiv.*grad/);
  assert.match(doc, /توصية.*للقراءة فقط/);
  assert.match(doc, /القرار النهائي للمالك/);
});

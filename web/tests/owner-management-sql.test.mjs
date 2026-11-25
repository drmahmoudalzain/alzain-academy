import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const migrationPath = new URL("../../supabase/migrations/0114_owner_full_management.sql", import.meta.url);
const rollbackPath = new URL("../../supabase/rollback/0114_owner_full_management_rollback.sql", import.meta.url);

function read(path, label) {
  assert.ok(existsSync(path), `${label} must exist`);
  return readFileSync(path, "utf8");
}

const migration = () => read(migrationPath, "0114 migration");
const rollback = () => read(rollbackPath, "0114 rollback");

const functions = [
  "is_owner_by_auth_uid",
  "management_allocate_platform_id",
  "management_create_user_profile",
  "management_update_user",
  "management_set_user_active",
  "management_flag_password_change",
  "management_preflight_delete_user",
  "management_delete_user_finalize",
  "management_update_course",
  "management_preflight_delete_course",
  "management_delete_course",
  "management_change_student_track",
  "management_enroll_student_in_track",
  "management_transfer_student",
  "management_set_enrollment_status",
  "management_remove_enrollment",
  "management_link_auth_id",
  "management_log_auth_delete",
];

function bodyOf(name) {
  const sql = migration();
  const start = sql.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const end = sql.indexOf("$$;", start);
  assert.notEqual(end, -1, `missing function body terminator for ${name}`);
  return sql.slice(start, end);
}

test("0114 defines every owner management function", () => {
  const sql = migration();
  for (const name of functions) {
    assert.match(sql, new RegExp(`create or replace function public\\.${name}\\(`));
  }
});

test("every owner management function checks the signed-in owner", () => {
  for (const name of functions.filter((n) => n.startsWith("management_"))) {
    const body = bodyOf(name);
    assert.match(body, /public\.current_user_id\(\)/, `${name} must check current_user_id()`);
    assert.match(body, /public\.is_owner\(\)/, `${name} must check is_owner()`);
  }
});

test("platform codes follow role and track without AD or student bachelor", () => {
  const body = bodyOf("management_allocate_platform_id");
  for (const prefix of ["TE", "AS", "BM", "BF", "EQ", "EX", "PG"]) {
    assert.ok(body.includes(`'${prefix}'`), `missing prefix ${prefix}`);
  }
  assert.doesNotMatch(migration(), /'AD'/);
  assert.doesNotMatch(bodyOf("management_create_user_profile"), /'bachelor'/);
});

test("track enrollment includes the parent course and excludes archived courses", () => {
  for (const name of ["management_enroll_student_in_track", "management_change_student_track"]) {
    const body = bodyOf(name);
    assert.match(body, /parent_course_id/);
    assert.match(body, /archived/);
  }
});

test("transfer and track change suspend old enrollment and preserve history", () => {
  for (const name of ["management_change_student_track", "management_transfer_student"]) {
    const body = bodyOf(name);
    assert.match(body, /status = 'suspended'/);
    assert.doesNotMatch(body, /delete from public\.enrollments/i);
  }
});

test("user delete preflight blocks owned courses and publications but not audit history", () => {
  const preflight = bodyOf("management_preflight_delete_user");
  assert.match(preflight, /courses\.teacher_id/);
  assert.match(preflight, /publications\.author_id/);
  const finalize = bodyOf("management_delete_user_finalize");
  assert.doesNotMatch(finalize, /from\s+public\.audit_logs/i);
  assert.doesNotMatch(finalize, /join\s+public\.audit_logs/i);
});

test("course delete preflight counts every dependent group", () => {
  const body = bodyOf("management_preflight_delete_course");
  for (const token of ["parent_course_id", "lectures", "exams", "assignments", "enrollments"]) {
    assert.match(body, new RegExp(token));
  }
});

test("the old update_course signature is dropped and grants are scoped", () => {
  const sql = migration();
  assert.match(
    sql,
    /drop function if exists public\.management_update_course\(bigint,text,text,text,boolean,text,smallint,numeric,numeric,numeric,bigint\)/,
  );
  assert.match(sql, /revoke all on function public\./);
  assert.match(sql, /grant execute on function public\./);
  assert.match(sql, /to authenticated/);
  assert.doesNotMatch(sql, /grant\s+execute[^\n]*\banon\b/i);
});

test("rollback drops every function introduced by 0114", () => {
  const sql = rollback();
  for (const name of functions) {
    assert.match(sql, new RegExp(`drop function if exists public\\.${name}\\(`));
  }
});

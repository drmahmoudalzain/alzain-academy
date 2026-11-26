import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const migrationPath = new URL("../../supabase/migrations/0129_management_delete_lecture.sql", import.meta.url);
const rollbackPath = new URL("../../supabase/rollback/0129_management_delete_lecture_rollback.sql", import.meta.url);

function read(path, label) {
  assert.ok(existsSync(path), `${label} must exist`);
  return readFileSync(path, "utf8");
}

const migration = () => read(migrationPath, "0129 migration");
const rollback = () => read(rollbackPath, "0129 rollback");

function bodyOf() {
  const sql = migration();
  const start = sql.indexOf("create or replace function public.management_delete_lecture(");
  assert.notEqual(start, -1, "missing function management_delete_lecture");
  const end = sql.indexOf("$$;", start);
  assert.notEqual(end, -1, "missing function terminator");
  return sql.slice(start, end);
}

test("0129 adds a single owner-only lecture delete function", () => {
  const sql = migration();
  assert.equal((sql.match(/create or replace function public\./g) ?? []).length, 1);
  const body = bodyOf();
  assert.match(body, /language plpgsql/);
  assert.match(body, /security definer/);
  assert.match(body, /set search_path = public/);
  assert.match(body, /public\.current_user_id\(\)/);
  assert.match(body, /public\.is_owner\(\)/);
  assert.match(body, /delete from public\.lectures where id = p_lecture_id/);
  assert.match(body, /management_delete_lecture/);
});

test("0129 removes the lecture only through the owner-gated delete", () => {
  const sql = migration();
  assert.match(sql, /revoke all on function public\.management_delete_lecture\(bigint\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.management_delete_lecture\(bigint\) to authenticated, service_role/);
  assert.doesNotMatch(sql, /grant\s+execute[^\n]*\banon\b/i);
});

test("0129 rollback drops only the new delete function", () => {
  const rollbackSql = rollback();
  assert.match(rollbackSql, /drop function if exists public\.management_delete_lecture\(bigint\)/);
  assert.doesNotMatch(rollbackSql, /drop table/i);
});

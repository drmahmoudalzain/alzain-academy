import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const migrationPath = new URL("../../supabase/migrations/0118_close_empty_initial_semester.sql", import.meta.url);
const rollbackPath = new URL("../../supabase/rollback/0118_close_empty_initial_semester_rollback.sql", import.meta.url);

function read(path, label) {
  assert.ok(existsSync(path), `${label} must exist`);
  return readFileSync(path, "utf8");
}

const migration = () => read(migrationPath, "0118 migration");
const rollback = () => read(rollbackPath, "0118 rollback");

test("0118 closes only the empty second semester of the open year", () => {
  const sql = migration();
  assert.match(sql, /where y\.status = 'open'/);
  assert.match(sql, /s\.term_no = 2/);
  assert.match(sql, /s\.status = 'open'/);
  assert.match(sql, /where e\.semester_id = v_semester/);
  assert.match(sql, /if v_enrollments > 0 then/);
  assert.match(sql, /raise exception 'الفصل الثاني يحتوي تسجيلات؛ لم يُغلق'/);
  assert.match(sql, /set status = 'closed'\s+where id = v_semester/);
});

test("the correction is audited", () => {
  const sql = migration();
  assert.match(sql, /'academic_fix_initial_second_semester'/);
  assert.match(sql, /actor_id, action, table_name, record_id, old_data, new_data/);
  assert.match(sql, /jsonb_build_object\('status', 'open'\)/);
  assert.match(sql, /jsonb_build_object\('status', 'closed', 'year_id', v_year\)/);
});

test("rollback restores only an empty closed second semester", () => {
  const sql = rollback();
  assert.match(sql, /where y\.status = 'open'/);
  assert.match(sql, /s\.term_no = 2/);
  assert.match(sql, /s\.status = 'closed'/);
  assert.match(sql, /if v_enrollments > 0 then/);
  assert.match(sql, /set status = 'open'\s+where id = v_semester/);
  assert.doesNotMatch(sql, /drop table/i);
  assert.doesNotMatch(sql, /delete from public\.enrollments/i);
});

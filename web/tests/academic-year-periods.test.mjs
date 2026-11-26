import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const migrationPath = new URL("../../supabase/migrations/0116_academic_year_periods.sql", import.meta.url);
const rollbackPath = new URL("../../supabase/rollback/0116_academic_year_periods_rollback.sql", import.meta.url);

function read(path, label) {
  assert.ok(existsSync(path), `${label} must exist`);
  return readFileSync(path, "utf8");
}

const migration = () => read(migrationPath, "0116 migration");
const rollback = () => read(rollbackPath, "0116 rollback");

function bodyOf(name) {
  const sql = migration();
  const start = sql.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const end = sql.indexOf("$$;", start);
  assert.notEqual(end, -1, `missing function body terminator for ${name}`);
  return sql.slice(start, end);
}

const preview = () => bodyOf("academic_preview_close_year");
const close = () => bodyOf("academic_close_year_and_open_next");

test("0116 defines an owner-only preview and close functions", () => {
  const sql = migration();
  assert.match(sql, /create or replace function public\.academic_preview_close_year\(p_year_id bigint default null\)/);
  assert.match(sql, /create or replace function public\.academic_close_year_and_open_next\(/);
  for (const body of [preview(), close()]) {
    assert.match(body, /security definer/);
    assert.match(body, /set search_path = public/);
    assert.match(body, /public\.current_user_id\(\)/);
    assert.match(body, /public\.is_owner\(\)/);
  }
});

test("preview reports real counts and builds explicit blockers", () => {
  const body = preview();
  for (const token of [
    "active_enrollments",
    "tracks",
    "results",
    "pending_decisions",
    "students_without_results",
    "graduation_ready",
    "graduation_approvals",
    "blockers",
    "safe_to_close",
  ]) {
    assert.ok(body.includes(token), `preview must report ${token}`);
  }
  assert.match(body, /jsonb_array_length\(v_blockers\) = 0/);
  assert.match(body, /v_year\.status <> 'open'/);
});

test("pending decisions and missing outcomes block the close", () => {
  const body = preview();
  assert.match(body, /r\.status = 'needs_decision'/);
  assert.match(body, /and not exists \(\s*select 1 from public\.course_semester_results r\s*where r\.year_id = v_year\.id and r\.student_id = e\.student_id/);
  assert.match(body, /v_results is null/);
  assert.match(body, /v_ready > 0/);
  assert.match(body, /v_pending > 0/);
  assert.ok(body.includes("لا توجد نتائج مسجلة لهذا العام"));
  assert.ok(body.includes("يوجد طلاب مستوفون للتخرج بلا موافقة موثقة"));
});

test("close refuses a missing reason, a used code, and more than one open year", () => {
  const body = close();
  assert.match(body, /v_label = '' or v_code = '' or v_reason = ''/);
  assert.match(body, /exists \(select 1 from public\.academic_years where code = v_code\)/);
  assert.match(body, /v_open_count <> 1/);
  assert.ok(body.includes('أكثر من عام مفتوح؛ لا يُفتح عام جديد قبل إغلاق الحالي'));
});

test("close runs only after the preview says it is safe", () => {
  const body = close();
  assert.match(body, /v_preview := public\.academic_preview_close_year\(v_year\.id\)/);
  assert.match(body, /v_preview #>> '\{data,safe_to_close\}'/);
  assert.ok(body.includes("المعاينة تمنع الإغلاق"));
});

test("closing sets the old year and semesters closed before creating the next one", () => {
  const body = close();
  assert.match(body, /set status = 'closed', closed_at = now\(\)/);
  assert.match(body, /set status = 'closed'\s*\n\s*where year_id = v_year\.id/);
  assert.match(body, /values \(v_label, v_code, 'open'\)/);
  assert.match(body, /values \(v_new_year, 1, 'open'\)/);
  assert.match(body, /values \(v_new_year, 2, 'closed'\)/);
});

test("transfer suspends old enrollments and creates new ones in the new year", () => {
  const body = close();
  assert.match(body, /set status = 'suspended'/);
  assert.match(body, /v_suspended := v_suspended \+ v_rows/);
  assert.match(body, /insert into public\.enrollments \(course_id, student_id, status, year_id, semester_id\)/);
  assert.match(body, /on conflict \(course_id, student_id, year_id, semester_id\)/);
  assert.doesNotMatch(body, /delete from public\.enrollments/i);
  assert.doesNotMatch(body, /delete from public\.users/i);
});

test("no grades, attendance, or points are copied between years", () => {
  const sql = migration();
  for (const table of ["points_ledger", "attendance", "submissions", "grades"]) {
    assert.doesNotMatch(sql, new RegExp(`insert into public\\.${table}`, "i"));
  }
});

test("graduates are marked on users; rejected or incomplete students are held", () => {
  const body = close();
  assert.match(body, /g\.decision = 'approve'/);
  assert.match(body, /set academic_status = 'graduated'/);
  assert.match(body, /g\.decision = 'reject'/);
  assert.match(body, /elsif v_rejected or not v_passed then\s*\n\s*v_held := v_held \+ 1/);
});

test("other tracks are archived only when the owner opts in", () => {
  const body = close();
  assert.match(body, /p_archive_other_tracks boolean default false/);
  assert.match(body, /if p_archive_other_tracks then/);
  assert.match(body, /set academic_status = 'archived'/);
  assert.match(body, /r\.track not in \('bachelor_m', 'bachelor_f'\)/);
});

test("both close and per-student outcomes are audited with the reason", () => {
  const body = close();
  assert.match(body, /'academic_year_student_outcome'/);
  assert.match(body, /'academic_close_year'/);
  assert.match(body, /'reason', v_reason/);
  assert.match(body, /actor_id, action, table_name, record_id, old_data, new_data/);
});

test("grants stay with authenticated and service_role", () => {
  const sql = migration();
  const loop = sql.slice(sql.indexOf("do $$"), sql.indexOf("notify pgrst"));
  for (const signature of [
    "academic_preview_close_year(bigint)",
    "academic_close_year_and_open_next(text,text,text,boolean)",
  ]) {
    assert.ok(loop.includes(`'${signature}'`), `missing grant entry for ${signature}`);
  }
  assert.match(loop, /grant execute on function public\.%s to authenticated, service_role/);
  assert.doesNotMatch(sql, /grant\s+execute[^\n]*\banon\b/i);
});

test("rollback removes only the two period functions", () => {
  const sql = rollback();
  assert.match(sql, /drop function if exists public\.academic_preview_close_year\(bigint\)/);
  assert.match(sql, /drop function if exists public\.academic_close_year_and_open_next\(text, text, text, boolean\)/);
  assert.doesNotMatch(sql, /drop table/i);
  assert.doesNotMatch(sql, /drop column/i);
});

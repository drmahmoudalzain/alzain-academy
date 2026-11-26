import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const migrationPath = new URL("../../supabase/migrations/0121_course_codes_and_shared_lectures.sql", import.meta.url);
const rollbackPath = new URL("../../supabase/rollback/0121_course_codes_and_shared_lectures_rollback.sql", import.meta.url);
const original114Path = new URL("../../supabase/migrations/0114_owner_full_management.sql", import.meta.url);
const original108Path = new URL("../../supabase/migrations/0108_student_pages.sql", import.meta.url);
const original101Path = new URL("../../supabase/migrations/0101_rls_views_grants.sql", import.meta.url);
const htmlPath = new URL("../pages/owner/courses.html", import.meta.url);
const jsPath = new URL("../src/pages/owner/courses.js", import.meta.url);

function read(path, label) {
  assert.ok(existsSync(path), `${label} must exist`);
  return readFileSync(path, "utf8");
}

const migration = () => read(migrationPath, "0121 migration");
const rollback = () => read(rollbackPath, "0121 rollback");
const html = () => read(htmlPath, "courses.html");
const js = () => read(jsPath, "courses.js");

function bodyOf(name, sql) {
  const start = sql.indexOf(`create or replace function public.${name}`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const end = sql.indexOf("$$;", start);
  assert.notEqual(end, -1, `missing function body terminator for ${name}`);
  return sql.slice(start, end);
}

const generation = () => bodyOf("management_generate_course_code", migration());
const createCourse = () => bodyOf("management_create_course", migration());
const family = () => bodyOf("management_create_course_family", migration());
const lectureResolution = () => bodyOf("course_for_student_lecture", migration());

function policyOf(name, sql) {
  const start = sql.indexOf(`drop policy if exists ${name} on `);
  assert.notEqual(start, -1, `missing ${name} policy`);
  const end = sql.indexOf("\n  );", start);
  assert.notEqual(end, -1, `missing ${name} policy terminator`);
  return sql.slice(start, end + 4);
}

test("0121 is a transaction that defines the four new RPCs", () => {
  const sql = migration();
  assert.match(sql, /\bbegin\s*;/i);
  assert.match(sql, /\bcommit\s*;/i);
  assert.match(sql, /create or replace function public\.management_generate_course_code\(\s*p_level smallint,\s*p_parent_course_id bigint default null,\s*p_branch_track text default null\s*\)/);
  assert.match(sql, /create or replace function public\.management_create_course\(/);
  assert.match(sql, /create or replace function public\.management_create_course_family\(\s*p_title text,\s*p_level smallint/);
  assert.match(sql, /create or replace function public\.course_for_student_lecture\(\s*p_lecture_id bigint,\s*p_student_id bigint\s*\)/);

  const signatureMatch = /create or replace function public\.management_create_course\(([^)]*)\)/.exec(createCourse());
  assert.ok(signatureMatch, "expected a create_course signature");
  const params = signatureMatch[1].split(",").map((p) => p.trim()).filter(Boolean);
  assert.deepEqual(params.slice(-2), [
    "p_parent_course_id bigint default null",
    "p_branch_track text default null",
  ]);
  assert.equal(params.length, 12);
});

test("parent codes are LAW plus level and a two digit sequence", () => {
  const body = generation();
  assert.ok(body.includes("'^LAW[1-4][0-9]{2}$'"));
  assert.ok(body.includes("'([0-9]{2})$'"));
  assert.match(body, /'LAW'/);
  assert.match(body, /lpad\(/);
  assert.match(body, /p_level not between 1 and 4/);
  assert.match(body, /pg_advisory_xact_lock\(\d+\)/);
  assert.doesNotMatch(body, /pg_advisory_xact_lock\(71104\)/);
  assert.match(body, /where lower\(code\) ~\* \('\^LAW' \|\| p_level::text \|\| '\[0-9\]\{2\}\$'\)/);
  assert.match(body, /substring\(lower\(code\) from '\(\[0-9\]\{2\}\)\$'\)/);
  assert.doesNotMatch(body, /where code ~ \('\^LAW'/);
});

test("the example contract is LAW413 -> LAW414 -> LAW414-M / LAW414-F", () => {
  const body = generation();
  const prefix = /'\^LAW'/.test(body) ? "LAW" : null;
  const digits = /'\[0-9\]\{2\}\$'/.test(body) ? "[0-9]{2}" : null;
  const sequence = /'\(\[0-9\]\{2\}\)\$'/.test(body) ? "([0-9]{2})$" : null;
  const male = /'-M'/.test(body) ? "-M" : null;
  const female = /'-F'/.test(body) ? "-F" : null;
  assert.ok(prefix && digits && sequence && male && female, "code format must come from the SQL source");

  const existing = ["LAW413", "law410"];
  const level = 4;
  const levelPattern = new RegExp(`^${prefix}${level}${digits}$`, "i");
  const sequencePattern = new RegExp(sequence, "i");
  const last = existing
    .filter((code) => levelPattern.test(code))
    .map((code) => Number(sequencePattern.exec(code)[1]));
  const next = Math.max(0, ...last) + 1;
  const parentCode = `${prefix}${level}${String(next).padStart(2, "0")}`;
  assert.equal(parentCode, "LAW414");
  assert.equal(`${parentCode}${male}`, "LAW414-M");
  assert.equal(`${parentCode}${female}`, "LAW414-F");
  assert.match(body, /v_parent_code \|\| case when v_track = 'bachelor_m' then '-M' else '-F' end/);
  assert.match(body, /return 'LAW' \|\| p_level::text \|\| lpad\(v_seq::text, 2, '0'\)/);
});

test("branch codes derive from the parent and reject an existing same-track branch", () => {
  const body = generation();
  assert.match(body, /select c\.code, c\.level into v_parent_code/);
  assert.match(body, /v_parent_code \|\|/);
  assert.ok(body.includes("'-M'"));
  assert.ok(body.includes("'-F'"));
  assert.match(body, /v_track not in \('bachelor_m',\s*'bachelor_f'\)/);
  assert.match(body, /exists \(\s*select 1 from public\.courses\s+where parent_course_id = p_parent_course_id/);
});

test("create_course keeps 0114 validations and adds parent/branch derivation", () => {
  const body = createCourse();
  for (const message of [
    "العنوان والرمز مطلوبان",
    "رمز المقرر مستخدم بالفعل",
    "المسار غير صالح",
    "المستوى غير صالح",
    "مجموع الأوزان يجب أن يساوي 100",
    "الأستاذ المسؤول غير صالح",
  ]) {
    assert.ok(body.includes(`'${message}'`), `missing 0114 validation: ${message}`);
  }
  assert.match(body, /insert into public\.audit_logs \(actor_id, action, table_name, record_id, new_data\)/);
  assert.match(body, /'management_create_course', 'courses', v_id/);
  assert.match(body, /parent_course_id/);
  assert.match(body, /public\.management_generate_course_code\(/);
  assert.match(body, /nullif\(v_code, ''\) is not null/);
  assert.match(body, /select c\.code, c\.level into v_parent_code, v_parent_level/);
  assert.match(body, /lower\(v_parent_code\) !~\* '\^LAW\[1-4\]\[0-9\]\{2\}\$'/);
  assert.match(body, /return jsonb_build_object\('ok', false, 'error', 'رمز المقرر الأصل غير صالح'\)/);
  assert.doesNotMatch(body, /raise exception 'المقرر الأصل غير موجود أو رمزه ليس رمز أصل صالح'/);
});

test("course family creates the parent and both branches atomically with three audit rows", () => {
  const body = family();
  assert.match(body, /'bachelor'/);
  assert.match(body, /p_assignments_weight, false\)\s+returning id into v_parent_id/);
  assert.doesNotMatch(body, /archived\s*=\s*true/);
  assert.match(body, /'archived', false\)\);/);
  assert.match(body, /'bachelor_m'/);
  assert.match(body, /'bachelor_f'/);
  assert.match(body, /parent_course_id/);
  assert.match(body, /public\.management_generate_course_code\(/);
  assert.equal([...body.matchAll(/insert into public\.audit_logs/g)].length, 3);
});

test("every new management function is owner-only", () => {
  for (const name of ["management_generate_course_code", "management_create_course", "management_create_course_family"]) {
    const body = bodyOf(name, migration());
    assert.match(body, /public\.current_user_id\(\)/, `${name} must check current_user_id()`);
    assert.match(body, /public\.is_owner\(\)/, `${name} must check is_owner()`);
    assert.match(body, /security definer/);
    assert.match(body, /set search_path = public/);
  }
});

test("a parent lecture resolves to the student's single active branch", () => {
  const body = lectureResolution();
  assert.match(body, /security definer/);
  assert.match(body, /public\.lectures/);
  assert.match(body, /c\.parent_course_id = v_course_id/);
  assert.match(body, /e\.status = 'active'/);
  assert.match(body, /c\.archived = false/);
  assert.match(body, /v_count > 1/);
  assert.match(body, /raise exception/);
  assert.match(body, /return v_branch_id/);
  assert.match(body, /p_student_id is null\s+or \(p_student_id <> public\.current_user_id\(\) and not public\.is_owner\(\)\)/);
  assert.match(body, /raise exception 'not allowed'/);
});

test("student lecture functions only pass the current student to the guard", () => {
  const sql = migration();
  for (const signature of [
    "create or replace function public.student_lectures()",
    "create or replace function public.student_lecture_detail(p_lecture_id bigint)",
    "create or replace function public.student_lecture_attendance(\n  p_lecture_id bigint",
  ]) {
    const start = sql.indexOf(signature);
    assert.notEqual(start, -1, `missing ${signature}`);
    const body = sql.slice(start, sql.indexOf("$$;", start));
    assert.match(body, /v_uid bigint := public\.current_user_id\(\)/);
    assert.match(body, /public\.course_for_student_lecture\([^)]*v_uid/);
    assert.doesNotMatch(body, /public\.course_for_student_lecture\([^)]*p_student_id/);
  }
});

test("student lecture detail takes the teacher from the stored lecture course", () => {
  const sql = migration();
  const start = sql.indexOf("create or replace function public.student_lecture_detail(p_lecture_id bigint)");
  assert.notEqual(start, -1);
  const body = sql.slice(start, sql.indexOf("$$;", start));
  assert.match(body, /left join users u on u\.id = \(select lc\.teacher_id from courses lc where lc\.id = l\.course_id\)/);
  assert.doesNotMatch(body, /left join users u on u\.id = c\.teacher_id/);
});

test("student lecture functions use parent resolution and cannot double-insert a points row", () => {
  for (const name of ["student_lectures", "student_lecture_detail(", "student_lecture_attendance("]) {
    const sql = migration();
    const start = sql.indexOf(`create or replace function public.${name === "student_lectures" ? "student_lectures()" : name}`);
    assert.notEqual(start, -1, `missing ${name}`);
    const end = sql.indexOf("$$;", start);
    assert.ok(sql.slice(start, end).includes("public.course_for_student_lecture("), `${name} must resolve parent lectures`);
  }
  const attendance = migration();
  const start = attendance.indexOf("create or replace function public.student_lecture_attendance(");
  const body = attendance.slice(start, attendance.indexOf("$$;", start));
  assert.equal([...body.matchAll(/insert into points_ledger/g)].length, 1);
  assert.match(body, /on conflict on constraint points_ledger_user_course_source_uniq do nothing/);
  assert.match(body, /v_effective_course_id/);
});

test("RLS opens branch access to authenticated users and grants exclude anon", () => {
  const sql = migration();
  for (const table of ["lectures", "files", "questions", "lecture_presence"]) {
    const start = sql.indexOf(`create policy ${table}_select on public.${table}`);
    assert.notEqual(start, -1, `missing ${table}_select policy`);
    const end = sql.indexOf(";", sql.indexOf("using (", start));
    const policy = sql.slice(start, end);
    assert.match(policy, /course_for_student_lecture/);
    assert.match(policy, /to authenticated/);
  }
  assert.match(sql, /revoke all on function public\.%s from public, anon/i);
  assert.match(sql, /grant execute on function public\.%s to authenticated, service_role/i);
  assert.doesNotMatch(sql, /grant\s+execute[^\n]*\banon\b/i);
});

test("rollback restores 0114 and 0108 definitions without deleting rows", () => {
  const back = rollback();
  assert.match(back, /\bbegin\s*;/i);
  assert.match(back, /\bcommit\s*;/i);
  assert.match(back, /drop function if exists public\.management_generate_course_code\(smallint, bigint, text\)/);
  assert.match(back, /drop function if exists public\.management_create_course\(text, text, text, text, smallint, text, numeric, numeric, numeric, bigint, bigint, text\)/);
  assert.match(back, /drop function if exists public\.management_create_course_family\(/);
  assert.match(back, /drop function if exists public\.course_for_student_lecture\(bigint, bigint\)/);

  const policyNames = ["lectures_select", "files_select", "questions_select", "lecture_presence_select"];
  const dropFunctionAt = back.indexOf("drop function if exists public.course_for_student_lecture(bigint, bigint)");
  const firstPolicyAt = Math.min(...policyNames.map((name) => back.indexOf(`drop policy if exists ${name} on `)));
  assert.ok(firstPolicyAt > -1 && dropFunctionAt > -1 && firstPolicyAt < dropFunctionAt,
    "policies must stop referencing course_for_student_lecture before it is dropped");
  const original101 = read(original101Path, "0101 migration");
  for (const name of policyNames) {
    assert.equal([...back.matchAll(new RegExp(`create policy ${name} on`, "g"))].length, 1, `${name} restored once`);
    const restored = policyOf(name, back);
    assert.doesNotMatch(restored, /course_for_student_lecture/);
    assert.equal(restored, policyOf(name, original101), `${name} must match 0101 verbatim`);
  }

  assert.equal(
    bodyOf("management_create_course", back),
    bodyOf("management_create_course", read(original114Path, "0114 migration")),
  );
  const original108 = read(original108Path, "0108 migration");
  const lectureSignatures = [
    ["student_lectures", "student_lectures()"],
    ["student_lecture_detail", "student_lecture_detail(p_lecture_id bigint"],
    ["student_lecture_attendance", "student_lecture_attendance(\n  p_lecture_id bigint"],
  ];
  for (const [label, signature] of lectureSignatures) {
    assert.equal(bodyOf(signature, back), bodyOf(signature, original108), `${label} must be restored verbatim`);
  }
  assert.doesNotMatch(back, /delete\s+from/i);
});

test("the owner course form exposes three creation modes and never sends a manual code", () => {
  const page = html();
  assert.match(page, /id="ocMode"/);
  for (const value of ['value="new"', 'value="branch"', 'value="family"']) {
    assert.ok(page.includes(value), `missing mode ${value}`);
  }
  assert.match(page, /id="ocCodeInput"[^>]*readonly/i);
  assert.match(page, /id="ocParentInput"/);
  assert.match(page, /id="ocBranchTrackInput"/);
  const source = js();
  assert.match(source, /management_generate_course_code/);
  assert.match(source, /management_create_course_family/);
  assert.match(source, /p_parent_course_id:/);
  assert.match(source, /p_branch_track:/);
  assert.match(source, /esc\(/);
});

test("bachelor creation sends a null code derived from the creation mode", () => {
  const source = js();
  assert.match(source, /const generatedTracks = \["bachelor", "bachelor_m", "bachelor_f"\]/);
  assert.match(source, /const usesGeneratedCode = mode === "branch"\s*\|\| \(mode === "new" && generatedTracks\.includes\(f\.elements\.track\.value\)\)/);
  assert.match(source, /p_code: usesGeneratedCode \? null : params\.p_code/);
  assert.doesNotMatch(source, /p_code: f\.elements\.code\.readOnly/);
});

test("the code preview refreshes when the form opens and when the track changes", () => {
  const source = js();
  const start = source.indexOf('$("ocNewBtn").addEventListener("click"');
  assert.notEqual(start, -1);
  const handler = source.slice(start, source.indexOf("});", start));
  assert.match(handler, /refreshGeneratedCode\(\)/);
  assert.match(source, /\$\("ocTrackInput"\)\.addEventListener\("change", \(\) => \{ applyMode\(\); void refreshGeneratedCode\(\); \}\)/);
});

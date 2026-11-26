import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

// Static source tests only. Running the SQL would require applying 0122 to
// Supabase; that is intentionally not done in this repository workflow.

const migrationPath = new URL("../../supabase/migrations/0122_activate_points_rules.sql", import.meta.url);
const rollbackPath = new URL("../../supabase/rollback/0122_activate_points_rules_rollback.sql", import.meta.url);
const original108Path = new URL("../../supabase/migrations/0108_student_pages.sql", import.meta.url);
const original121Path = new URL("../../supabase/migrations/0121_course_codes_and_shared_lectures.sql", import.meta.url);
const resultDecisionsPath = new URL("../../supabase/migrations/0117_result_decisions.sql", import.meta.url);
const gradesPath = new URL("../src/pages/student/grades.js", import.meta.url);
const pointsPath = new URL("../src/pages/student/points.js", import.meta.url);

function read(path, label) {
  assert.ok(existsSync(path), `${label} must exist`);
  return readFileSync(path, "utf8");
}

const migration = () => read(migrationPath, "0122 migration");
const rollback = () => read(rollbackPath, "0122 rollback");
const original108 = () => read(original108Path, "0108 migration");
const original121 = () => read(original121Path, "0121 migration");
const grades = () => read(gradesPath, "grades.js");
const points = () => read(pointsPath, "points.js");

function bodyOf(name, sql) {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const end = sql.indexOf("$$;", start);
  assert.notEqual(end, -1, `missing function body terminator for ${name}`);
  return sql.slice(start, end);
}

const heartbeat = () => bodyOf("student_lecture_presence_heartbeat", migration());
const award = () => bodyOf("lecture_points_award", migration());
const answer = () => bodyOf("student_lecture_interaction_answer", migration());
const attendance = () => bodyOf("student_lecture_attendance", migration());
const examSubmit = () => bodyOf("student_exam_submit", migration());

const sanctionedFunctions = [
  "student_lecture_presence_heartbeat",
  "student_lecture_interaction_answer",
  "student_lecture_attendance",
  "student_exam_submit",
];

test("0122 activates every documented policy key without changing the 300/150 thresholds", () => {
  const sql = migration();
  assert.match(sql, /\bbegin\s*;/i);
  assert.match(sql, /\bcommit\s*;/i);

  const expected = {
    lecture_count_cap: "10",
    lecture_attendance_points: "10",
    lecture_interaction_points: "10",
    lecture_exam_points: "10",
    recorded_exam_points: "30",
    attendance_minutes_per_point: "10",
    attendance_points_cap: "10",
    attendance_required_minutes: "100",
  };
  for (const [key, value] of Object.entries(expected)) {
    assert.match(sql, new RegExp(`\\('${key}', '${value}'::jsonb`), `missing policy ${key}=${value}`);
  }
  assert.match(sql, /'point_sources', '\["attendance","interaction","assignment","exam"\]'::jsonb/);
  assert.match(sql, /'course_target_points', '300'/);
  assert.match(sql, /'course_pass_points', '150'/);
  assert.doesNotMatch(sql, /course_target_points[^\n]*update/i);
});

test("points_ledger accepts exam but keeps the one-row-per-source uniqueness", () => {
  const sql = migration();
  assert.match(sql, /source_type in \('attendance','interaction','assignment','exam'\)/);
  assert.match(sql, /points_ledger_source_type_check/);
  assert.match(sql, /unique nulls not distinct \(user_id, course_id, source_type, source_id\)/);
});

test("first-ten cap counts one distinct lecture set and allows extra sources inside it", () => {
  const body = award();
  assert.match(migration(), /create or replace function public\.lecture_points_award\(\s*p_lecture_id bigint,\s*p_student_id bigint,\s*p_course_id bigint\s*\)\s*returns jsonb/);
  assert.match(body, /'lecture_count_cap'/);
  assert.match(body, /with awarded_lectures as \(/);
  assert.match(body, /select pl\.source_id as lecture_id/);
  assert.match(body, /and pl\.source_type = 'attendance'/);
  assert.match(body, /select q\.lecture_id as lecture_id\s+from public\.points_ledger pl\s+join public\.questions q on q\.id = pl\.source_id/);
  assert.match(body, /and q\.lecture_id is not null/);
  assert.match(body, /select e\.lecture_id as lecture_id\s+from public\.points_ledger pl\s+join public\.exams e on e\.id = pl\.source_id/);
  assert.match(body, /and e\.lecture_id is not null/);
  assert.match(body, /select count\(\*\), bool_or\(lecture_id = p_lecture_id\)/);
  assert.match(body, /'ok', v_already or v_count < v_cap/);
  assert.doesNotMatch(body, /count\(distinct recorded\.lecture_id\)/);
  assert.doesNotMatch(body, /where recorded\.lecture_id = p_lecture_id/);
  assert.doesNotMatch(body, /points_rules\.caller|set_config|current_user_id/);
});

test("lecture_points_award is service-role only with no client-settable caller", () => {
  const sql = migration();
  assert.match(sql, /revoke all on function public\.lecture_points_award\(bigint,bigint,bigint\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.lecture_points_award\(bigint,bigint,bigint\) to service_role/);
  assert.doesNotMatch(sql, /grant execute on function public\.lecture_points_award[^\n]*authenticated/i);
  assert.doesNotMatch(sql, /points_rules\.caller/);
});

test("interaction answer saves once and awards one capped point per correct answer", () => {
  const body = answer();
  assert.match(migration(), /create or replace function public\.student_lecture_interaction_answer\(\s*p_question_id bigint,\s*p_choice_index integer default null,\s*p_choice_indices jsonb default null,\s*p_text text default null\s*\)\s*returns jsonb/);
  assert.match(body, /public\.current_user_id\(\)/);
  assert.match(body, /not authenticated/);
  assert.match(body, /q\.is_open = true/);
  assert.match(body, /public\.course_for_student_lecture\([^)]*v_uid/);
  assert.match(body, /e\.status = 'active'/);
  assert.match(body, /insert into public\.question_answers/);
  assert.match(body, /on conflict \(question_id, student_id\) do nothing/);
  assert.match(body, /correct_index/);
  assert.match(body, /correct_indices/);
  assert.match(body, /'lecture_interaction_points'/);
  assert.match(body, /lecture_type <> 'recorded'/);
  assert.match(body, /join public\.questions /);
  assert.match(body, /v_earned >= v_cap/);
  assert.match(body, /public\.lecture_points_award\(/);
  assert.match(body, /'interaction', p_question_id/);
  assert.match(body, /on conflict on constraint points_ledger_user_course_source_uniq do nothing/);
  assert.match(body, /'points', 1/);
  assert.doesNotMatch(body, /points_rules\.caller|set_config/);
});

test("attendance derives points from presence seconds and keeps the 0121 parent path", () => {
  const body = attendance();
  assert.match(migration(), /create or replace function public\.student_lecture_attendance\(\s*p_lecture_id bigint,\s*p_code text\s*\)\s*returns jsonb/);
  for (const token of [
    "not authenticated",
    "lecture_not_found",
    "attendance_not_open",
    "code_required",
    "wrong_code",
    "public.course_for_student_lecture(",
    "v_effective_course_id",
    "insert into public.attendance",
    "'code', btrim(p_code)",
    "on conflict (lecture_id, student_id) do nothing",
    "'ok', true, 'data', jsonb_build_object('attended', true)",
  ]) {
    assert.ok(body.includes(token), `attendance lost 0121 behavior: ${token}`);
  }
  assert.match(body, /select coalesce\(lp\.total_seconds, 0\)/);
  assert.match(body, /'attendance_minutes_per_point'/);
  assert.match(body, /'attendance_points_cap'/);
  assert.match(body, /'attendance_required_minutes'/);
  assert.match(body, /v_total_seconds >= v_required_minutes \* 60/);
  assert.match(body, /least\(v_cap, floor\(v_total_seconds::numeric \/ 60 \/ v_minutes_per_point\)::integer\)/);
  assert.match(body, /v_points > 0/);
  assert.match(body, /public\.lecture_points_award\(/);
  assert.match(body, /'attendance', p_lecture_id/);
  assert.equal([...body.matchAll(/insert into points_ledger/g)].length, 1);
  assert.match(body, /on conflict on constraint points_ledger_user_course_source_uniq do nothing/);
  assert.doesNotMatch(body, /'attendance', p_lecture_id[^;]*,\s*10,\s*now\(\)/);
  assert.doesNotMatch(body, /points_rules\.caller|set_config/);
});

test("exam submit keeps 0108 grading verbatim and awards to the effective branch course", () => {
  const body = examSubmit();
  const original = bodyOf("student_exam_submit", original108());
  for (const token of [
    "not authenticated",
    "attempt_closed",
    "q.type = 'essay' then null",
    "q.type = 'truefalse' and aa.choice_index = q.correct_index",
    "q.type = 'mcq' and aa.choice_index = q.correct_index",
    "q.type = 'multi' and aa.choice_indices = q.correct_indices",
    "أسئلة لم تُجب تُحتسب صفراً",
    "select coalesce(sum(points), 0)",
    "case when v_has_essay then 'submitted' else 'graded' end",
    "'ok', true, 'data', jsonb_build_object('attempt_id', p_attempt_id, 'score', v_score)",
  ]) {
    assert.ok(original.includes(token), `0108 grading fixture changed: ${token}`);
    assert.ok(body.includes(token), `exam submit lost 0108 behavior: ${token}`);
  }
  assert.match(body, /'lecture_exam_points'/);
  assert.match(body, /'recorded_exam_points'/);
  assert.match(body, /v_lecture_type = 'recorded'/);
  assert.match(body, /least\(v_score, v_cap\)/);
  assert.match(body, /if v_lecture_id is not null then/);
  assert.match(body, /select coalesce\(public\.course_for_student_lecture\(v_lecture_id, v_uid\), exams\.course_id\)/);
  assert.match(body, /into v_effective_course_id\s+from public\.exams exams\s+where exams\.id = v_exam_id/);
  assert.match(body, /public\.lecture_points_award\(v_lecture_id, v_uid, v_effective_course_id\)/);
  assert.match(body, /values \(v_uid, v_effective_course_id, 'exam', v_exam_id/);
  assert.match(body, /'exam', v_exam_id/);
  assert.match(body, /jsonb_build_object\('lecture_id', v_lecture_id\)/);
  assert.equal([...body.matchAll(/insert into points_ledger/g)].length, 1);
  assert.match(body, /on conflict on constraint points_ledger_user_course_source_uniq do nothing/);
  assert.doesNotMatch(body, /public\.lecture_points_award\(v_lecture_id, v_uid, v_course_id\)/);
  assert.doesNotMatch(body, /values \(v_uid, v_course_id, 'exam'/);
  assert.doesNotMatch(body, /points_rules\.caller|set_config/);
});

test("presence heartbeat bounds every increment by real elapsed time and 60 seconds", () => {
  const body = heartbeat();
  assert.match(migration(), /create or replace function public\.student_lecture_presence_heartbeat\(\s*p_lecture_id bigint,\s*p_seconds integer\s*\)\s*returns jsonb/);
  assert.match(body, /public\.current_user_id\(\)/);
  assert.match(body, /not authenticated/);
  assert.match(body, /public\.course_for_student_lecture\([^)]*v_uid/);
  assert.match(body, /public\.enrollments/);
  assert.match(body, /e\.status = 'active'/);
  assert.match(body, /lecture_not_found/);
  assert.match(body, /least\(7200, least\(greatest\(0, coalesce\(p_seconds, 0\)\), 60\)\)/);
  assert.match(body, /extract\(epoch from now\(\) - public\.lecture_presence\.last_heartbeat_at\)::int/);
  assert.match(body, /least\(\s*greatest\(0, coalesce\(p_seconds, 0\)\),\s*greatest\(0, extract\(epoch from now\(\) - public\.lecture_presence\.last_heartbeat_at\)::int\),\s*60\s*\)/);
  assert.match(body, /least\(7200,\s*public\.lecture_presence\.total_seconds\s*\+\s*least\(/);
  assert.match(body, /insert into public\.lecture_presence/);
  assert.match(body, /on conflict \(lecture_id, student_id\) do update/);
  assert.match(body, /last_heartbeat_at = now\(\)/);
  assert.match(body, /returning total_seconds into v_total_seconds/);
  assert.doesNotMatch(body, /v_elapsed|v_increment/);
  assert.doesNotMatch(body, /total_seconds \+ coalesce\(p_seconds, 0\)/);
});

test("student_points is the 0108 reader with exam added to the breakdown only", () => {
  const body = bodyOf("student_points", migration());
  const original = bodyOf("student_points", original108());
  const examLine = ",\n         'exam', coalesce((select sum(points) from points_ledger where user_id = v_uid and source_type = 'exam'), 0)";
  assert.ok(body.includes(examLine), "student_points must add exam to the breakdown");
  assert.equal(body.replace(examLine, ""), original, "student_points must otherwise match 0108 verbatim");
  assert.match(body, /'breakdown', jsonb_build_object\(/);
  assert.match(body, /'total', coalesce\(\(select sum\(points\) from points_ledger where user_id = v_uid\), 0\)/);
  assert.match(body, /'ledger', coalesce\(\(/);
  assert.match(body, /'leaderboard', coalesce\(\(/);
});

test("student_grades is the 0108 reader with interaction_pct from the policy only", () => {
  const body = bodyOf("student_grades", migration());
  const original = bodyOf("student_grades", original108());
  const interactionField = `            coalesce((
              select round(
                coalesce((select sum(pl.points) from points_ledger pl where pl.source_type = 'interaction' and pl.course_id = c.id and pl.user_id = v_uid), 0) * 100
                / nullif(
                  (select count(*) from lectures where course_id = c.id)
                  * (select (p.value #>> '{}')::numeric from academic_policies p where p.key = 'lecture_interaction_points'),
                  0)
              )
            ), 0) as interaction_pct,
`;
  assert.ok(body.includes(interactionField), "student_grades must compute interaction_pct from the policy key");
  assert.ok(body.includes("'interaction_pct', f.interaction_pct, "), "student_grades must expose interaction_pct");
  assert.equal(
    body.replace(interactionField, "").replace("'interaction_pct', f.interaction_pct, ", ""),
    original,
    "student_grades must otherwise match 0108 verbatim",
  );
  assert.match(body, /c\.attendance_weight, c\.exams_weight, c\.assignments_weight/);
  assert.match(body, /r\.attendance_pct \* r\.attendance_weight/);
  assert.match(body, /r\.exam_pct \* r\.exams_weight/);
  assert.match(body, /r\.assignment_pct \* r\.assignments_weight/);
  const finalCte = (text) => text.slice(text.indexOf("  final as ("), text.indexOf("  select jsonb_build_object("));
  assert.equal(finalCte(body), finalCte(original), "final_pct formula must match 0108 verbatim");
});

test("every sanctioned points function is definer, search-pathed, and denied to anon", () => {
  const sql = migration();
  for (const name of sanctionedFunctions) {
    const body = bodyOf(name, sql);
    assert.match(body, /security definer/, `${name} must be security definer`);
    assert.match(body, /set search_path = public/, `${name} must pin search_path`);
  }
  assert.match(sql, /revoke all on function public\.%s from public, anon/);
  assert.match(sql, /grant execute on function public\.%s to authenticated, service_role/);
  assert.doesNotMatch(sql, /grant\s+execute[^\n]*\banon\b/i);
  for (const name of sanctionedFunctions) {
    assert.match(sql, new RegExp(`'${name}\\(`), `${name} must be in the grants loop`);
  }
  assert.doesNotMatch(sql, /create policy/i);
});

test("0117 still reads point_sources from academic_policies", () => {
  const sql = read(resultDecisionsPath, "0117 migration");
  assert.match(sql, /\(select p\.value from public\.academic_policies p where p\.key = 'point_sources'\)/);
  assert.match(sql, /pl\.source_type = any\(v_sources\)/);
  assert.doesNotMatch(sql, /\["attendance","interaction","assignment"\]/);
  const body = bodyOf("academic_rebuild_course_results", sql);
  assert.match(body, /jsonb_array_elements_text/);
});

test("rollback restores pre-0122 readers, the 0121 attendance body, and 0108 exam grading", () => {
  const back = rollback();
  assert.match(back, /\bbegin\s*;/i);
  assert.match(back, /\bcommit\s*;/i);
  assert.match(back, /'point_sources', '\["attendance","interaction","assignment"\]'::jsonb/);
  assert.match(back, /delete from public\.academic_policies/);
  for (const key of [
    "lecture_count_cap",
    "lecture_attendance_points",
    "lecture_interaction_points",
    "lecture_exam_points",
    "recorded_exam_points",
    "attendance_minutes_per_point",
    "attendance_points_cap",
    "attendance_required_minutes",
  ]) {
    assert.match(back, new RegExp(`'${key}'`));
  }
  assert.match(back, /source_type in \('attendance','interaction','assignment','exam'\)/);
  assert.doesNotMatch(back, /source_type in \('attendance','interaction','assignment'\)/);
  assert.equal(bodyOf("student_lecture_attendance", back), bodyOf("student_lecture_attendance", original121()));
  assert.notEqual(bodyOf("student_lecture_attendance", back), bodyOf("student_lecture_attendance", original108()));
  assert.equal(bodyOf("student_exam_submit", back), bodyOf("student_exam_submit", original108()));
  assert.equal(bodyOf("student_points", back), bodyOf("student_points", original108()));
  assert.equal(bodyOf("student_grades", back), bodyOf("student_grades", original108()));
  for (const signature of [
    "student_lecture_presence_heartbeat(bigint,integer)",
    "lecture_points_award(bigint,bigint,bigint)",
    "student_lecture_interaction_answer(bigint,integer,jsonb,text)",
  ]) {
    assert.match(back, new RegExp(`drop function if exists public\\.${signature.replace(/[()]/g, "\\$&")}`));
  }
  assert.match(back, /revoke all on function public\.%s from public, anon, service_role/);
  assert.match(back, /grant execute on function public\.%s to authenticated/);
  assert.match(back, /'student_points\(\)'/);
  assert.match(back, /'student_grades\(\)'/);
  assert.doesNotMatch(back, /delete\s+from\s+public\.(points_ledger|enrollments|lecture_presence|question_answers|exam_answers|exam_attempts|attendance)/i);
  assert.doesNotMatch(back, /create policy/i);
  assert.match(back, /notify pgrst, 'reload schema'/);
});

test("grades page shows attendance, interaction and exams for bachelor, assignments for other tracks", () => {
  const source = grades();
  assert.match(source, /async \(\{ profile \}\)/);
  assert.match(source, /\["bachelor", "bachelor_m", "bachelor_f"\]/);
  assert.match(source, /isBachelorTrack\(profile\?\.track\)/);
  assert.match(source, /const metrics = isBachelorTrack\(profile\?\.track\)/);
  assert.match(source, /"الحضور", course\.attendance_pct/);
  assert.match(source, /"التفاعل", course\.interaction_pct/);
  assert.match(source, /"الاختبارات", course\.exam_pct/);
  assert.match(source, /"الواجبات", course\.assignment_pct/);
  assert.match(source, /course\.total_pct/);
  assert.match(source, /course\.letter/);
  assert.match(source, /esc\(/);
  assert.match(source, /call\("student_grades"\)/);
});

test("points page shows exam points for bachelor and assignment points for other tracks", () => {
  const source = points();
  assert.match(source, /exam: \{ label: "اختبارات", icon: "points" \}/);
  assert.match(source, /\{ key: "exam", label: "الاختبارات" \}/);
  assert.match(source, /async \(\{ profile \}\)/);
  assert.match(source, /isBachelorTrack\(profile\?\.track\)/);
  assert.match(source, /breakdownCard\("exam", breakdown\.exam, total\)/);
  assert.match(source, /const kinds = isBachelorTrack\(profile\?\.track\)/);
  assert.match(source, /breakdownCard\("assignment", breakdown\.assignment, total\)/);
  assert.match(source, /call\("student_points"\)/);
  assert.match(source, /esc\(/);
});

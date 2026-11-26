import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

// The 0124 migration is never applied by this suite. SQL contracts are checked
// as source, while the shared pure helper is executed directly so the score and
// recommendation thresholds are not only regex assertions.

const migrationPath = new URL("../../supabase/migrations/0124_publication_review.sql", import.meta.url);
const rollbackPath = new URL("../../supabase/rollback/0124_publication_review_rollback.sql", import.meta.url);
const original101Path = new URL("../../supabase/migrations/0101_rls_views_grants.sql", import.meta.url);
const uiPath = new URL("../src/pages/library-manage.js", import.meta.url);
const helperPath = new URL("../src/lib/publication-review.js", import.meta.url);

function read(path, label) {
  assert.ok(existsSync(path), `${label} must exist`);
  return readFileSync(path, "utf8");
}

const migration = () => read(migrationPath, "0124 migration");
const rollback = () => read(rollbackPath, "0124 rollback");
const ui = () => read(uiPath, "library-manage.js");

function bodyOf(name, sql) {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const end = sql.indexOf("$$;", start);
  assert.notEqual(end, -1, `missing body terminator for ${name}`);
  return sql.slice(start, end);
}

function policyOf(name, sql) {
  const start = sql.indexOf(`drop policy if exists ${name} on `);
  assert.notEqual(start, -1, `missing ${name} policy`);
  const end = sql.indexOf("\n  );", start);
  assert.notEqual(end, -1, `missing ${name} policy terminator`);
  return sql.slice(start, end + 4);
}

function authorViewSelectList(sql) {
  const start = sql.indexOf("create or replace view public.publications_author");
  assert.notEqual(start, -1, "missing author-facing publication view");
  const asSelectAt = sql.indexOf("as select", start);
  const listAt = sql.indexOf("select", asSelectAt) + "select".length;
  const fromAt = sql.indexOf(" from public.publications", listAt);
  assert.ok(asSelectAt > -1 && fromAt > listAt, "author view needs an explicit select list");
  return sql.slice(listAt, fromAt);
}

async function rules() {
  assert.ok(existsSync(helperPath), "publication-review helper must exist");
  return import(`${helperPath.href}?v=${Date.now()}`);
}

const decision = (scores, recommendation) => ({ scores, recommendation });
const perfectScores = { originality: 10, methodology: 10, documentation: 10, analysis: 10, writing: 10 };
const passingScores = { originality: 6, methodology: 6, documentation: 6, analysis: 6, writing: 6 };
const failingScores = { originality: 6, methodology: 6, documentation: 6, analysis: 6, writing: 5 };

test("0124 is a transaction that records the documented review rules", () => {
  const sql = migration();
  assert.match(sql, /\bbegin\s*;/i);
  assert.match(sql, /\bcommit\s*;/i);
  assert.ok(sql.includes("now() + interval '6 months'"), "six-month decision window must be stored");
  assert.ok(sql.includes("now() + interval '1 month'"), "one-month revision window must be stored");
  assert.ok(sql.includes("'originality', 'methodology', 'documentation', 'analysis', 'writing'"));
  assert.ok(sql.includes("'accept','minor','major','reject'"));
  assert.ok(sql.includes("30"), "the publication threshold must be stored");
  assert.match(sql, /التوقيع الموسّع/, "the five-axis signature must document why the plan's 3-arg form changed");
  assert.match(sql, /إعادة عرض للمحكّمين/, "the automatic re-review must cite the documented rule");
});

test("owner-only assignment requires two distinct qualified non-author reviewers and an anonymized packet", () => {
  const sql = migration();
  assert.match(
    sql,
    /create or replace function public\.management_assign_publication_reviewers\(\s*p_publication_id bigint,\s*p_reviewer1 bigint,\s*p_reviewer2 bigint\s*\)\s*returns jsonb/,
  );
  const body = bodyOf("management_assign_publication_reviewers", sql);
  assert.match(body, /public\.current_user_id\(\)/);
  assert.match(body, /public\.is_owner\(\)/);
  assert.match(body, /p_reviewer1 = p_reviewer2/);
  assert.match(body, /p_reviewer1 = v_author_id or p_reviewer2 = v_author_id/);
  assert.match(body, /u\.role = 'teacher'/);
  assert.match(body, /public\.publication_reviewer_credentials/);
  assert.match(body, /v_anonymized_file/);
  assert.match(body, /regexp_replace/);
  assert.match(body, /v_author_name/);
  assert.match(body, /v_author_email/);
  assert.match(body, /v_author_phone/);
  assert.match(body, /v_author_university_id/);
  assert.match(body, /insert into public\.publication_review_assignments/);
  assert.match(body, /now\(\) \+ interval '6 months'/);
  assert.match(body, /insert into public\.audit_logs/);
  assert.match(body, /'axes', jsonb_build_array\('originality','methodology','documentation','analysis','writing'\)/);
  assert.match(sql, /unique \(publication_id, round\)/);
  assert.match(sql, /check \(reviewer1_id <> reviewer2_id\)/);
});

test("reviewer packet carries only anonymized text, the file link and the scoring axes", () => {
  const sql = migration();
  assert.match(sql, /create or replace function public\.reviewer_publication_blob\(p_publication_id bigint\)\s*returns jsonb/);
  const body = bodyOf("reviewer_publication_blob", sql);
  assert.match(body, /security definer/);
  assert.match(body, /v_uid = a\.reviewer1_id or v_uid = a\.reviewer2_id/);
  assert.match(body, /from public\.publication_review_assignments a/);
  assert.doesNotMatch(body, /from public\.publications/);
  const packetAt = body.indexOf("return jsonb_build_object('ok', true, 'data', jsonb_build_object(");
  assert.ok(packetAt > -1, "blob must build a packet");
  const returned = body.slice(packetAt);
  for (const field of ["author", "email", "phone", "university_id", "name", "reviewer1_id", "reviewer2_id", "notes", "comments"]) {
    assert.doesNotMatch(returned, new RegExp(field, "i"), `blob must not return ${field}`);
  }
  for (const field of ["'title'", "'abstract_ar'", "'abstract_en'", "'file'", "'axes'"]) {
    assert.ok(returned.includes(field), `blob must return ${field}`);
  }
});

test("decision function is reviewer-only, checks five 0..10 axes, and stores confidential notes once", () => {
  const sql = migration();
  assert.match(
    sql,
    /create or replace function public\.reviewer_record_publication_decision\(\s*p_publication_id bigint,\s*p_scores jsonb,\s*p_recommendation text,\s*p_notes text\s*\)\s*returns jsonb/,
  );
  const body = bodyOf("reviewer_record_publication_decision", sql);
  assert.match(body, /v_uid = (a|v_assignment)\.reviewer1_id or v_uid = \1\.reviewer2_id/);
  assert.match(body, /v_axes text\[\] := array\['originality','methodology','documentation','analysis','writing'\]/);
  assert.match(body, /jsonb_typeof\(p_scores\) <> 'object'/);
  assert.match(body, /jsonb_object_keys\(p_scores\)/);
  assert.match(body, /p_scores \? v_axis/);
  assert.match(body, /jsonb_typeof\(p_scores -> v_axis\) <> 'number'/);
  assert.match(body, /v_score < 0 or v_score > 10/);
  assert.match(body, /lower\(btrim\(coalesce\(p_recommendation, ''\)\)\)/);
  assert.match(body, /not in \('accept','minor','major','reject'\)/);
  assert.match(body, /exists \(\s*select 1 from public\.publication_review_decisions/);
  assert.match(body, /insert into public\.publication_review_decisions/);
  assert.match(body, /insert into public\.publication_review_decisions \([\s\S]*?\bnotes\b[\s\S]*?\)\s*values \([\s\S]*?p_notes[\s\S]*?\);/);
  assert.equal(body.match(/p_notes/g).length, 2, "notes must go only into the confidential decision row");
  assert.match(sql, /unique \(assignment_id, reviewer_id\)/);
  assert.match(sql, /alter table public\.publication_review_decisions enable row level security/);
  assert.doesNotMatch(sql, /create policy[^\n]*publication_review_decisions/i);
});

test("final status waits for both reviews and applies the 30-point and recommendation thresholds", async () => {
  const sql = migration();
  const body = bodyOf("reviewer_record_publication_decision", sql);
  assert.match(body, /from public\.publication_review_decisions/);
  assert.match(body, /v_count < 2/);
  assert.match(body, /least\(v_total1, v_total2\) >= 30/);
  assert.match(body, /\(v_rank1 \+ v_rank2\) \/ 2\.0 >= 2/);
  assert.match(body, /now\(\) \+ interval '1 month'/);
  assert.match(body, /'revisions'/);
  assert.match(body, /'rejected'/);
  assert.match(body, /'accepted'/);

  const r = await rules();
  assert.deepEqual(r.SCORE_AXES, ["originality", "methodology", "documentation", "analysis", "writing"]);
  assert.equal(r.MIN_TOTAL_SCORE, 30);
  assert.equal(r.ACCEPTABLE_RANK, 2);
  assert.equal(r.DECISION_MONTHS, 6);
  assert.equal(r.REVISION_MONTHS, 1);
  assert.equal(r.publicationFinalStatus([decision(perfectScores, "accept")]), null, "one review is not a decision");
  assert.equal(r.publicationFinalStatus([decision(perfectScores, "accept"), decision(passingScores, "minor")]), "accepted");
  assert.equal(r.publicationFinalStatus([decision(failingScores, "accept"), decision(perfectScores, "accept")]), "rejected");
  assert.equal(r.publicationFinalStatus([decision(perfectScores, "major"), decision(perfectScores, "accept")]), "revisions");
  assert.equal(r.publicationFinalStatus([decision(perfectScores, "reject"), decision(perfectScores, "accept")]), "rejected");
  assert.equal(r.publicationFinalStatus([decision(perfectScores, "minor"), decision(perfectScores, "minor")]), "accepted");
  assert.match(r.validatePublicationScores({ ...passingScores, originality: 11 }), /0.*10/);
  assert.match(r.validatePublicationScores({ ...passingScores, originality: null }), /numeric/);
  assert.match(r.validatePublicationScores({ ...passingScores, extra: 1 }), /five/i);
});

test("authors see neither reviewer identities nor confidential reviews", () => {
  const sql = migration();
  const publicationsPolicy = policyOf("publications_select", sql);
  assert.match(publicationsPolicy, /public\.is_owner\(\) or public\.is_assistant\(\)/);
  assert.doesNotMatch(publicationsPolicy, /assigned_reviewers/);
  assert.doesNotMatch(publicationsPolicy, /author_id = public\.current_user_id\(\)/);
  const reviewsPolicy = policyOf("publication_reviews_select", sql);
  assert.match(reviewsPolicy, /reviewer_id = public\.current_user_id\(\)/);
  assert.doesNotMatch(reviewsPolicy, /author_id = public\.current_user_id\(\)/);

  const selectList = authorViewSelectList(sql);
  for (const field of ["author_id", "assigned_reviewers", "editor_note", "decision_note", "notes", "comments"]) {
    assert.doesNotMatch(selectList, new RegExp(field, "i"), `author view exposes ${field}`);
  }
  assert.match(sql, /revoke select on public\.publications from authenticated/);
  assert.match(sql, /grant select on public\.publications_author to authenticated/);
  assert.match(sql, /alter table public\.publication_review_assignments enable row level security/);
  assert.doesNotMatch(sql, /create policy[^\n]*publication_review_assignments/i);
});

test("every 0124 RPC is definer, search-pathed and denied to anon", () => {
  const sql = migration();
  const functions = [
    "management_assign_publication_reviewers",
    "management_set_publication_anonymized_file",
    "management_set_publication_reviewer_credentials",
    "management_publication_review_queue",
    "management_publication_reviewer_candidates",
    "reviewer_publication_blob",
    "reviewer_publication_assignments",
    "reviewer_record_publication_decision",
  ];
  for (const name of functions) {
    const body = bodyOf(name, sql);
    assert.match(body, /security definer/, `${name} must be security definer`);
    assert.match(body, /set search_path = public/, `${name} must pin search_path`);
    assert.match(sql, new RegExp(`'${name}\\(`), `${name} must be in the grants loop`);
  }
  assert.match(sql, /revoke all on function public\.%s from public, anon/);
  assert.match(sql, /grant execute on function public\.%s to authenticated, service_role/);
  assert.doesNotMatch(sql, /grant\s+execute[^\n]*\banon\b/i);
});

test("rollback drops only 0124 objects and restores the prior policies and grants", () => {
  const back = rollback();
  assert.match(back, /\bbegin\s*;/i);
  assert.match(back, /\bcommit\s*;/i);
  for (const signature of [
    "management_assign_publication_reviewers(bigint,bigint,bigint)",
    "management_set_publication_anonymized_file(bigint,text)",
    "management_set_publication_reviewer_credentials(bigint,text,text)",
    "management_publication_review_queue()",
    "management_publication_reviewer_candidates()",
    "reviewer_publication_blob(bigint)",
    "reviewer_publication_assignments()",
    "reviewer_record_publication_decision(bigint,jsonb,text,text)",
  ]) {
    assert.match(back, new RegExp(`drop function if exists public\\.${signature.replace(/[()]/g, "\\$&")}`));
  }
  assert.match(back, /drop table if exists public\.publication_review_decisions/);
  assert.match(back, /drop table if exists public\.publication_review_assignments/);
  assert.match(back, /drop table if exists public\.publication_reviewer_credentials/);
  assert.match(back, /drop view if exists public\.publications_author/);
  assert.match(back, /alter table public\.publications drop column if exists anonymized_file/);
  const original101 = read(original101Path, "0101 migration");
  assert.equal(policyOf("publications_select", back), policyOf("publications_select", original101));
  assert.equal(policyOf("publication_reviews_select", back), policyOf("publication_reviews_select", original101));
  assert.match(back, /grant select on public\.publications to authenticated/);
  assert.match(back, /revoke all on public\.publications_author from public, anon, authenticated/);
  assert.doesNotMatch(back, /delete\s+from\s+public\.(publications|publication_reviews)/i);
  assert.doesNotMatch(back, /truncate\s+public\.(publications|publication_reviews)/i);
});

test("library-manage.js wires owner assignment and reviewer decision panels through call()", () => {
  const source = ui();
  assert.match(source, /async \(\{ profile, portal \}\)/);
  for (const rpc of [
    "management_publication_review_queue",
    "management_set_publication_anonymized_file",
    "management_set_publication_reviewer_credentials",
    "management_assign_publication_reviewers",
    "reviewer_publication_assignments",
    "reviewer_publication_blob",
    "reviewer_record_publication_decision",
  ]) {
    assert.ok(source.includes(`call("${rpc}"`), `missing call to ${rpc}`);
  }
  assert.match(source, /portal === "owner" \|\| portal === "teacher"/);
  assert.match(source, /const canAssignReviews = portal === "owner";/);
  assert.doesNotMatch(source, /canAssignReviews = portal === "owner" \|\| portal === "assistant"/);
  assert.match(source, /esc\(/);
  assert.doesNotMatch(source, /author_id/);
  assert.doesNotMatch(source, /assigned_reviewers/);
});

test("reviewer form submits the five documented axes and mandatory recommendation", async () => {
  const source = ui();
  assert.match(source, /validatePublicationScores\(scores\)/);
  assert.match(source, /SCORE_AXES\.map/);
  assert.match(source, /p_scores: scores/);
  assert.match(source, /p_recommendation:/);
  assert.match(source, /p_notes:/);
  const r = await rules();
  assert.ok(r.RECOMMENDATIONS.accept > r.RECOMMENDATIONS.minor);
  assert.ok(r.RECOMMENDATIONS.minor > r.RECOMMENDATIONS.major);
  assert.ok(r.RECOMMENDATIONS.major > r.RECOMMENDATIONS.reject);
  assert.equal(r.validatePublicationScores(passingScores), null);
  assert.match(r.validatePublicationScores({ originality: 6, methodology: 6, documentation: 6, analysis: 6 }), /five/i);
});

test("a major recommendation opens a same-reviewer round and preserves the earlier round", () => {
  const sql = migration();
  const body = bodyOf("reviewer_record_publication_decision", sql);
  assert.match(body, /if v_final = 'revisions' then/);
  const reReview = body.slice(body.indexOf("if v_final = 'revisions' then"));
  assert.match(reReview, /insert into public\.publication_review_assignments/);
  assert.match(reReview, /v_assignment\.reviewer1_id, v_assignment\.reviewer2_id/);
  assert.match(reReview, /v_assignment\.reviewer1_rank, v_assignment\.reviewer1_specialization/);
  assert.match(reReview, /v_assignment\.reviewer2_rank, v_assignment\.reviewer2_specialization/);
  assert.match(reReview, /v_assignment\.anonymized_packet/, "the new round must reuse the anonymized packet");
  assert.match(reReview, /now\(\) \+ interval '6 months'/, "the new round gets a fresh six-month deadline");
  assert.match(reReview, /publication_rereview_round_opened/);
  assert.doesNotMatch(reReview, /insert into public\.publication_review_decisions/);
  assert.doesNotMatch(sql, /delete\s+from\s+public\.publication_review_(assignments|decisions)/i);
  assert.doesNotMatch(sql, /truncate\s+public\.publication_review_(assignments|decisions)/i);
});

test("reviewer reads and decisions are limited to the current round", () => {
  const sql = migration();
  for (const name of [
    "reviewer_publication_assignments",
    "reviewer_publication_blob",
    "reviewer_record_publication_decision",
  ]) {
    const body = bodyOf(name, sql);
    assert.match(body, /a\.round = \(\s*select max\(x\.round\)/, `${name} must read only the current round`);
  }
  assert.match(bodyOf("management_publication_review_queue", sql), /order by x\.round desc\s*\n\s*limit 1/);
  assert.doesNotMatch(bodyOf("reviewer_publication_blob", sql), /from public\.publications/);
  assert.doesNotMatch(bodyOf("reviewer_publication_assignments", sql), /author_id|anonymized_packet/);
});

test("round numbers advance by one only for major-change revisions", async () => {
  const sql = migration();
  assert.match(bodyOf("management_assign_publication_reviewers", sql), /coalesce\(max\(a\.round\), 0\) \+ 1/);
  assert.match(bodyOf("reviewer_record_publication_decision", sql), /select max\(x\.round\)[\s\S]*?\) \+ 1/);

  const r = await rules();
  assert.equal(r.publicationFinalStatus([decision(perfectScores, "major"), decision(perfectScores, "accept")]), "revisions");
  assert.equal(r.nextPublicationReviewRound("revisions", 4), 5);
  assert.equal(r.nextPublicationReviewRound("accepted", 4), null);
  assert.equal(r.nextPublicationReviewRound("rejected", 4), null);
  assert.equal(r.nextPublicationReviewRound(null, 4), null);
  assert.throws(() => r.nextPublicationReviewRound("revisions", 0), /round/i);
});

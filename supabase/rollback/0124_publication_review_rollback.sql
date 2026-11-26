-- ============================================================
-- 0124_publication_review_rollback.sql — التراجع عن مسار مراجعة النشر
-- ============================================================
-- يُسقط كائنات 0124 فقط، ويعيد سياسات ومنح 0101 كما كانت.
-- لا يحذف صفوف publications أو publication_reviews، ولا أي بيانات تحكيم سابقة.
-- ============================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) سحب صلاحيات الدوال قبل إسقاطها.
-- ---------------------------------------------------------------------------
revoke all on function public.management_assign_publication_reviewers(bigint,bigint,bigint) from public, anon, authenticated, service_role;
revoke all on function public.management_set_publication_anonymized_file(bigint,text) from public, anon, authenticated, service_role;
revoke all on function public.management_set_publication_reviewer_credentials(bigint,text,text) from public, anon, authenticated, service_role;
revoke all on function public.management_publication_review_queue() from public, anon, authenticated, service_role;
revoke all on function public.management_publication_reviewer_candidates() from public, anon, authenticated, service_role;
revoke all on function public.reviewer_publication_blob(bigint) from public, anon, authenticated, service_role;
revoke all on function public.reviewer_publication_assignments() from public, anon, authenticated, service_role;
revoke all on function public.reviewer_record_publication_decision(bigint,jsonb,text,text) from public, anon, authenticated, service_role;

drop function if exists public.management_assign_publication_reviewers(bigint,bigint,bigint);
drop function if exists public.management_set_publication_anonymized_file(bigint,text);
drop function if exists public.management_set_publication_reviewer_credentials(bigint,text,text);
drop function if exists public.management_publication_review_queue();
drop function if exists public.management_publication_reviewer_candidates();
drop function if exists public.reviewer_publication_blob(bigint);
drop function if exists public.reviewer_publication_assignments();
drop function if exists public.reviewer_record_publication_decision(bigint,jsonb,text,text);

-- ---------------------------------------------------------------------------
-- 2) إزالة عرض الباحث وإعادة منح القراءة المباشرة كما في 0101.
-- ---------------------------------------------------------------------------
revoke all on public.publications_author from public, anon, authenticated;
drop view if exists public.publications_author;

grant select on public.publications to authenticated;

-- ---------------------------------------------------------------------------
-- 3) إعادة سياسات 0101 حرفياً، بلا حذف صفوف.
-- ---------------------------------------------------------------------------
drop policy if exists publications_select on public.publications;
create policy publications_select on public.publications
  for select to authenticated
  using (
    public.is_owner() or public.is_assistant()
    or author_id = public.current_user_id()
    or public.current_user_id() = any (assigned_reviewers)
  );

drop policy if exists publication_reviews_select on public.publication_reviews;
create policy publication_reviews_select on public.publication_reviews
  for select to authenticated
  using (
    public.is_owner() or public.is_assistant()
    or reviewer_id = public.current_user_id()
    or exists (
        select 1 from public.publications p
        where p.id = publication_reviews.publication_id
          and p.author_id = public.current_user_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 4) إسقاط جداول 0124 والعمود المضاف فقط. صفوف النشر والتحكيم تبقى كما هي.
-- ---------------------------------------------------------------------------
drop table if exists public.publication_review_decisions;
drop table if exists public.publication_review_assignments;
drop table if exists public.publication_reviewer_credentials;

alter table public.publications drop column if exists anonymized_file;

notify pgrst, 'reload schema';

commit;

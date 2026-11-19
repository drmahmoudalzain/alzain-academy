-- ============================================================
-- 0004 — تقوية الأمان والاتساق (بعد المراجعة العامة)
-- 1) سحب المنح المفرطة من anon/authenticated (الوصول عبر service_role فقط، RLS بلا سياسات)
-- 2) فهارس المفاتيح الخارجية المفقودة وفهرس انتهاء الجلسات
-- 3) مفتاح خارجي files.assignment_id -> assignments (كان بلا قيد)
-- 4) منع تكرار points_ledger حتى مع source_id فارغ (NULLS NOT DISTINCT)
-- ============================================================

begin;

-- ---------- 1) المنح ----------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all routines in schema public from anon, authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on routines from anon, authenticated;

grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all routines in schema public to service_role;

-- ---------- 2) فهارس ----------
create index if not exists idx_exams_course             on public.exams(course_id);
create index if not exists idx_exams_lecture            on public.exams(lecture_id);
create index if not exists idx_exam_answers_question    on public.exam_answers(question_id);
create index if not exists idx_files_assignment         on public.files(assignment_id);
create index if not exists idx_files_uploader           on public.files(uploader_id);
create index if not exists idx_lecture_presence_student on public.lecture_presence(student_id);
create index if not exists idx_notifications_course     on public.notifications(course_id);
create index if not exists idx_notifications_created_by on public.notifications(created_by);
create index if not exists idx_library_items_created_by on public.library_items(created_by);
create index if not exists idx_notification_reads_user  on public.notification_reads(user_id);
create index if not exists idx_archived_records_by      on public.archived_records(archived_by);
create index if not exists idx_sessions_expires         on public.sessions(expires_at);
create index if not exists idx_points_ledger_course     on public.points_ledger(course_id);
create index if not exists idx_submissions_file         on public.submissions(file_id);

-- ---------- 3) مفتاح خارجي files.assignment_id ----------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'files_assignment_id_fkey' and conrelid = 'public.files'::regclass
  ) then
    alter table public.files
      add constraint files_assignment_id_fkey
      foreign key (assignment_id) references public.assignments(id)
      on delete set null;
  end if;
end $$;

-- ---------- 4) points_ledger: تكرار ممنوع حتى مع source_id فارغ ----------
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'points_ledger_user_id_course_id_source_type_source_id_key'
      and conrelid = 'public.points_ledger'::regclass
  ) then
    alter table public.points_ledger
      drop constraint points_ledger_user_id_course_id_source_type_source_id_key;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'points_ledger_user_course_source_uniq'
      and conrelid = 'public.points_ledger'::regclass
  ) then
    alter table public.points_ledger
      add constraint points_ledger_user_course_source_uniq
      unique nulls not distinct (user_id, course_id, source_type, source_id);
  end if;
end $$;

commit;

-- ---------- تحقق سريع بعد التطبيق ----------
-- يجب ألا توجد صلاحيات لـ anon/authenticated على جداول public:
-- select grantee, count(*) from information_schema.role_table_grants
-- where table_schema='public' and grantee in ('anon','authenticated') group by grantee;

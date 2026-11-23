-- ============================================================
-- 0101_rls_views_grants.sql — RLS + views + grants (Phase 2)
-- إضافي بالكامل: لا يحذف بيانات، ولا يغيّر مخططات قائمة.
-- يُفعِّل سياسات authenticated (deny by default لـ anon) على كل جدول.
-- تطبيق Express (service_role) غير متأثر.
-- ============================================================

begin;

-- ---------------------------------------------------------------------------
-- 0) إعداد عام: إلغاء وصول anon/public (المنح (authenticated) تُدار أدناه)
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon, public;
revoke all on all tables in schema public from public;
revoke all on all sequences in schema public from public;

alter default privileges in schema public revoke all on tables from anon, public;
alter default privileges in schema public revoke all on sequences from anon, public;
alter default privileges in schema public revoke all on functions from anon, public;

grant usage on schema public to authenticated;

-- ---------------------------------------------------------------------------
-- 1) Views للأعمدة الحساسة
-- ---------------------------------------------------------------------------
create or replace view public.lectures_public
with (security_invoker = true) as
select
  id, course_id, title, description, youtube_url, live_url,
  scheduled_at, duration_min, lecture_type, recording_note, status,
  created_at, broadcast_mode, broadcast_media
from public.lectures;

create or replace view public.questions_public
with (security_invoker = true) as
select
  id, lecture_id, text, type, options, is_open, created_at
from public.questions;

create or replace view public.settings_public
with (security_invoker = true) as
select key, value
from public.settings
where key <> 'ai_api_key';

-- ---------------------------------------------------------------------------
-- 2) policies: users
-- ---------------------------------------------------------------------------
drop policy if exists users_select on public.users;
create policy users_select on public.users
  for select to authenticated
  using (
    id = public.current_user_id()
    or public.is_owner()
    or public.is_assistant()
    or (public.is_teacher() and exists (
        select 1 from public.enrollments e
        join public.courses c on c.id = e.course_id
        where e.student_id = users.id
          and c.teacher_id = public.current_user_id()
    ))
  );

-- ---------------------------------------------------------------------------
-- 3) courses
-- ---------------------------------------------------------------------------
drop policy if exists courses_select on public.courses;
create policy courses_select on public.courses
  for select to authenticated
  using (
    public.is_owner() or public.is_assistant()
    or teacher_id = public.current_user_id()
    or exists (
        select 1 from public.enrollments e
        where e.course_id = courses.id
          and e.student_id = public.current_user_id()
          and e.status = 'active'
    )
  );

-- ---------------------------------------------------------------------------
-- 4) enrollments
-- ---------------------------------------------------------------------------
drop policy if exists enrollments_select on public.enrollments;
create policy enrollments_select on public.enrollments
  for select to authenticated
  using (
    student_id = public.current_user_id()
    or public.is_owner() or public.is_assistant()
    or exists (
        select 1 from public.courses c
        where c.id = enrollments.course_id
          and c.teacher_id = public.current_user_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 5) lectures (base: RLS; students use lectures_public)
-- ---------------------------------------------------------------------------
drop policy if exists lectures_select on public.lectures;
create policy lectures_select on public.lectures
  for select to authenticated
  using (
    public.is_owner() or public.is_assistant()
    or exists (
        select 1 from public.courses c
        where c.id = lectures.course_id
          and c.teacher_id = public.current_user_id()
    )
    or exists (
        select 1 from public.enrollments e
        where e.course_id = lectures.course_id
          and e.student_id = public.current_user_id()
          and e.status = 'active'
    )
  );

-- ---------------------------------------------------------------------------
-- 6) files
-- ---------------------------------------------------------------------------
drop policy if exists files_select on public.files;
create policy files_select on public.files
  for select to authenticated
  using (
    public.is_owner() or public.is_assistant()
    or uploader_id = public.current_user_id()
    or exists (
        select 1 from public.courses c
        where c.id = files.course_id
          and (c.teacher_id = public.current_user_id()
               or exists (select 1 from public.enrollments e
                          where e.course_id = c.id
                            and e.student_id = public.current_user_id()
                            and e.status = 'active'))
    )
    or exists (
        select 1 from public.lectures l
        join public.courses c on c.id = l.course_id
        where l.id = files.lecture_id
          and (c.teacher_id = public.current_user_id()
               or exists (select 1 from public.enrollments e
                          where e.course_id = c.id
                            and e.student_id = public.current_user_id()
                            and e.status = 'active'))
    )
  );

-- ---------------------------------------------------------------------------
-- 7) attendance
-- ---------------------------------------------------------------------------
drop policy if exists attendance_select on public.attendance;
create policy attendance_select on public.attendance
  for select to authenticated
  using (
    student_id = public.current_user_id()
    or public.is_owner() or public.is_assistant()
    or exists (
        select 1 from public.lectures l
        join public.courses c on c.id = l.course_id
        where l.id = attendance.lecture_id
          and c.teacher_id = public.current_user_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 8) lecture_presence
-- ---------------------------------------------------------------------------
drop policy if exists lecture_presence_select on public.lecture_presence;
create policy lecture_presence_select on public.lecture_presence
  for select to authenticated
  using (
    student_id = public.current_user_id()
    or public.is_owner() or public.is_assistant()
    or exists (
        select 1 from public.lectures l
        join public.courses c on c.id = l.course_id
        where l.id = lecture_presence.lecture_id
          and c.teacher_id = public.current_user_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 9) questions (base; students use questions_public)
-- ---------------------------------------------------------------------------
drop policy if exists questions_select on public.questions;
create policy questions_select on public.questions
  for select to authenticated
  using (
    public.is_owner() or public.is_assistant()
    or exists (
        select 1 from public.lectures l
        join public.courses c on c.id = l.course_id
        where l.id = questions.lecture_id
          and c.teacher_id = public.current_user_id()
    )
    or exists (
        select 1 from public.lectures l
        join public.enrollments e on e.course_id = l.course_id
        where l.id = questions.lecture_id
          and e.student_id = public.current_user_id()
          and e.status = 'active'
    )
  );

-- ---------------------------------------------------------------------------
-- 10) question_answers
-- ---------------------------------------------------------------------------
drop policy if exists question_answers_select on public.question_answers;
create policy question_answers_select on public.question_answers
  for select to authenticated
  using (
    student_id = public.current_user_id()
    or public.is_owner() or public.is_assistant()
    or exists (
        select 1 from public.questions q
        join public.lectures l on l.id = q.lecture_id
        join public.courses c on c.id = l.course_id
        where q.id = question_answers.question_id
          and c.teacher_id = public.current_user_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 11) exams
-- ---------------------------------------------------------------------------
drop policy if exists exams_select on public.exams;
create policy exams_select on public.exams
  for select to authenticated
  using (
    public.is_owner() or public.is_assistant()
    or exists (
        select 1 from public.courses c
        where c.id = exams.course_id
          and c.teacher_id = public.current_user_id()
    )
    or exists (
        select 1 from public.enrollments e
        where e.course_id = exams.course_id
          and e.student_id = public.current_user_id()
          and e.status = 'active'
    )
  );

-- exam_questions: no SELECT policy → deny all for authenticated (RPC only).

-- ---------------------------------------------------------------------------
-- 12) exam_attempts
-- ---------------------------------------------------------------------------
drop policy if exists exam_attempts_select on public.exam_attempts;
create policy exam_attempts_select on public.exam_attempts
  for select to authenticated
  using (
    student_id = public.current_user_id()
    or public.is_owner() or public.is_assistant()
    or exists (
        select 1 from public.exams ex
        join public.courses c on c.id = ex.course_id
        where ex.id = exam_attempts.exam_id
          and c.teacher_id = public.current_user_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 13) exam_answers
-- ---------------------------------------------------------------------------
drop policy if exists exam_answers_select on public.exam_answers;
create policy exam_answers_select on public.exam_answers
  for select to authenticated
  using (
    exists (
        select 1 from public.exam_attempts a
        where a.id = exam_answers.attempt_id
          and a.student_id = public.current_user_id()
    )
    or public.is_owner() or public.is_assistant()
    or exists (
        select 1 from public.exam_attempts a
        join public.exams ex on ex.id = a.exam_id
        join public.courses c on c.id = ex.course_id
        where a.id = exam_answers.attempt_id
          and c.teacher_id = public.current_user_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 14) assignments
-- ---------------------------------------------------------------------------
drop policy if exists assignments_select on public.assignments;
create policy assignments_select on public.assignments
  for select to authenticated
  using (
    public.is_owner() or public.is_assistant()
    or exists (
        select 1 from public.courses c
        where c.id = assignments.course_id
          and c.teacher_id = public.current_user_id()
    )
    or exists (
        select 1 from public.enrollments e
        where e.course_id = assignments.course_id
          and e.student_id = public.current_user_id()
          and e.status = 'active'
    )
  );

-- ---------------------------------------------------------------------------
-- 15) submissions
-- ---------------------------------------------------------------------------
drop policy if exists submissions_select on public.submissions;
create policy submissions_select on public.submissions
  for select to authenticated
  using (
    student_id = public.current_user_id()
    or public.is_owner() or public.is_assistant()
    or exists (
        select 1 from public.assignments a
        join public.courses c on c.id = a.course_id
        where a.id = submissions.assignment_id
          and c.teacher_id = public.current_user_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 16) notifications
-- ---------------------------------------------------------------------------
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (
    public.is_owner() or public.is_assistant() or public.is_teacher()
    or audience = 'all'
    or (audience = 'user' and user_id = public.current_user_id())
    or (audience = 'course' and exists (
        select 1 from public.enrollments e
        where e.course_id = notifications.course_id
          and e.student_id = public.current_user_id()
          and e.status = 'active'
    ))
  );

-- ---------------------------------------------------------------------------
-- 17) notification_reads
-- ---------------------------------------------------------------------------
drop policy if exists notification_reads_select on public.notification_reads;
create policy notification_reads_select on public.notification_reads
  for select to authenticated
  using (user_id = public.current_user_id());

-- ---------------------------------------------------------------------------
-- 18) settings (base; students use settings_public)
-- ---------------------------------------------------------------------------
-- لا سياسة SELECT على settings → authenticated لا يقرأ مباشرة (views only).

-- ---------------------------------------------------------------------------
-- 19) ai_messages
-- ---------------------------------------------------------------------------
drop policy if exists ai_messages_select on public.ai_messages;
create policy ai_messages_select on public.ai_messages
  for select to authenticated
  using (user_id = public.current_user_id());

-- ---------------------------------------------------------------------------
-- 20) library
-- ---------------------------------------------------------------------------
drop policy if exists library_sections_select on public.library_sections;
create policy library_sections_select on public.library_sections
  for select to authenticated using (true);

drop policy if exists library_items_select on public.library_items;
create policy library_items_select on public.library_items
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 21) points_ledger
-- ---------------------------------------------------------------------------
drop policy if exists points_ledger_select on public.points_ledger;
create policy points_ledger_select on public.points_ledger
  for select to authenticated
  using (
    user_id = public.current_user_id()
    or public.is_owner() or public.is_assistant()
    or exists (
        select 1 from public.courses c
        where c.id = points_ledger.course_id
          and c.teacher_id = public.current_user_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 22) archived_records
-- ---------------------------------------------------------------------------
drop policy if exists archived_records_select on public.archived_records;
create policy archived_records_select on public.archived_records
  for select to authenticated
  using (public.is_owner());

-- ---------------------------------------------------------------------------
-- 23) chat_rooms
-- ---------------------------------------------------------------------------
drop policy if exists chat_rooms_select on public.chat_rooms;
create policy chat_rooms_select on public.chat_rooms
  for select to authenticated
  using (
    public.is_owner() or public.is_assistant()
    or kind = 'general'
    or exists (
        select 1 from public.courses c
        where c.id = chat_rooms.course_id
          and c.teacher_id = public.current_user_id()
    )
    or exists (
        select 1 from public.enrollments e
        where e.course_id = chat_rooms.course_id
          and e.student_id = public.current_user_id()
          and e.status = 'active'
    )
  );

-- ---------------------------------------------------------------------------
-- 24) chat_messages
-- ---------------------------------------------------------------------------
drop policy if exists chat_messages_select on public.chat_messages;
create policy chat_messages_select on public.chat_messages
  for select to authenticated
  using (
    exists (
        select 1 from public.chat_rooms r
        where r.id = chat_messages.room_id
          and (
            public.is_owner() or public.is_assistant()
            or r.kind = 'general'
            or exists (
                select 1 from public.courses c
                where c.id = r.course_id
                  and c.teacher_id = public.current_user_id()
            )
            or exists (
                select 1 from public.enrollments e
                where e.course_id = r.course_id
                  and e.student_id = public.current_user_id()
                  and e.status = 'active'
            )
          )
    )
  );

-- ---------------------------------------------------------------------------
-- 25) publications
-- ---------------------------------------------------------------------------
drop policy if exists publications_select on public.publications;
create policy publications_select on public.publications
  for select to authenticated
  using (
    public.is_owner() or public.is_assistant()
    or author_id = public.current_user_id()
    or public.current_user_id() = any (assigned_reviewers)
  );

-- ---------------------------------------------------------------------------
-- 26) publication_reviews
-- ---------------------------------------------------------------------------
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
-- 27) sessions: no SELECT for authenticated (Express uses service_role)
-- ---------------------------------------------------------------------------
-- (no policy → deny)

-- ---------------------------------------------------------------------------
-- 28) audit_logs: no policy (service_role only, already set in 0100)
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 29) Grants
-- ---------------------------------------------------------------------------
-- authenticated: SELECT على كل الجداول (RLS يقيّد)، ثم إلغاء direct SELECT
-- على الجداول التي تُعرض عبر views only.
grant select on all tables in schema public to authenticated;

revoke select on public.lectures from authenticated;
revoke select on public.questions from authenticated;
revoke select on public.settings from authenticated;
revoke all on public.exam_questions from authenticated;
revoke all on public.audit_logs from authenticated;
revoke all on public.sessions from authenticated;

grant select on public.lectures_public to authenticated;
grant select on public.questions_public to authenticated;
grant select on public.settings_public to authenticated;

-- views need underlying table privileges? security_invoker uses caller's; RLS applies.
-- sequences: no direct grant (writes via RPC security definer).
revoke all on all sequences in schema public from authenticated;

notify pgrst, 'reload schema';

commit;

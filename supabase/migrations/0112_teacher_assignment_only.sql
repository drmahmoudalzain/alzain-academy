-- ============================================================
-- 0112_teacher_assignment_only.sql
-- قرار المالك (2026-11-25): الأستاذ ينشئ الواجبات فقط.
-- كل عمليات الكتابة الأخرى (المقررات، المحاضرات، الاختبارات،
-- التسجيل، الحضور، التصحيح، الإعلانات) تنتقل إلى الإدارة.
--
-- يُطبَّق بعد 0109؛ تحلّ دوال management_* محل دوال teacher_*،
-- وتُحذف الدوال القديمة حتى لا يتمكن أستاذ من استدعائها مباشرة.
-- ============================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) الصلاحية الوحيدة المتبقية للأستاذ: إنشاء واجب في مقرّره فقط
-- ---------------------------------------------------------------------------
create or replace function public.teacher_create_assignment(
  p_course_id bigint, p_title text, p_description text default null,
  p_due_at timestamptz default null, p_max_points numeric default 10
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  if public.current_user_id() is null or public.current_user_role() <> 'teacher'
     or not exists (select 1 from courses where id = p_course_id and teacher_id = public.current_user_id()) then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  if nullif(btrim(coalesce(p_title, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'عنوان الواجب مطلوب');
  end if;
  if coalesce(p_max_points, 0) <= 0 then
    return jsonb_build_object('ok', false, 'error', 'الدرجة القصوى يجب أن تكون أكبر من صفر');
  end if;

  insert into assignments (course_id, title, description, due_at, max_points)
  values (p_course_id, btrim(p_title), nullif(btrim(coalesce(p_description,'')), ''),
          p_due_at, p_max_points)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', v_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) عمليات الإدارة — متاحة للمالك فقط
-- ---------------------------------------------------------------------------
create or replace function public.management_create_course(
  p_title text, p_code text, p_description text default null,
  p_track text default 'bachelor_m', p_level smallint default null,
  p_color text default '#123A63',
  p_attendance_weight numeric default 10, p_exams_weight numeric default 60,
  p_assignments_weight numeric default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_code text := btrim(coalesce(p_code, ''));
begin
  if public.current_user_id() is null or not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  if nullif(btrim(coalesce(p_title, '')), '') is null or v_code = '' then
    return jsonb_build_object('ok', false, 'error', 'العنوان والرمز مطلوبان');
  end if;
  if exists (select 1 from courses where lower(code) = lower(v_code)) then
    return jsonb_build_object('ok', false, 'error', 'رمز المقرر مستخدم بالفعل');
  end if;
  if p_track not in ('bachelor','bachelor_m','bachelor_f','equiv','external','grad') then
    return jsonb_build_object('ok', false, 'error', 'المسار غير صالح');
  end if;
  if p_level is not null and p_level not between 1 and 4 then
    return jsonb_build_object('ok', false, 'error', 'المستوى غير صالح');
  end if;
  if coalesce(p_attendance_weight,0) + coalesce(p_exams_weight,0) + coalesce(p_assignments_weight,0) <> 100 then
    return jsonb_build_object('ok', false, 'error', 'مجموع الأوزان يجب أن يساوي 100');
  end if;

  insert into courses (teacher_id, title, code, description, color, track, level,
                       attendance_weight, exams_weight, assignments_weight)
  values (public.current_user_id(), btrim(p_title), v_code,
          nullif(btrim(coalesce(p_description,'')), ''),
          coalesce(nullif(btrim(coalesce(p_color,'')), ''), '#123A63'), p_track, p_level,
          p_attendance_weight, p_exams_weight, p_assignments_weight)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', v_id, 'code', v_code));
end;
$$;

create or replace function public.management_update_course(
  p_course_id bigint, p_title text, p_description text default null,
  p_color text default null, p_archived boolean default null,
  p_track text default null, p_level smallint default null,
  p_attendance_weight numeric default null, p_exams_weight numeric default null,
  p_assignments_weight numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_id() is null or not public.is_owner()
     or not exists (select 1 from courses where id = p_course_id) then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  if nullif(btrim(coalesce(p_title, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'العنوان مطلوب');
  end if;
  if p_track is not null and p_track not in ('bachelor','bachelor_m','bachelor_f','equiv','external','grad') then
    return jsonb_build_object('ok', false, 'error', 'المسار غير صالح');
  end if;
  if p_level is not null and p_level not between 1 and 4 then
    return jsonb_build_object('ok', false, 'error', 'المستوى غير صالح');
  end if;
  if p_attendance_weight is not null or p_exams_weight is not null or p_assignments_weight is not null then
    if coalesce(p_attendance_weight,0) + coalesce(p_exams_weight,0) + coalesce(p_assignments_weight,0) <> 100 then
      return jsonb_build_object('ok', false, 'error', 'مجموع الأوزان يجب أن يساوي 100');
    end if;
  end if;

  update courses set
    title = btrim(p_title),
    description = nullif(btrim(coalesce(p_description,'')), ''),
    color = coalesce(nullif(btrim(coalesce(p_color,'')), ''), color),
    archived = coalesce(p_archived, archived),
    track = coalesce(p_track, track),
    level = coalesce(p_level, level),
    attendance_weight = coalesce(p_attendance_weight, attendance_weight),
    exams_weight = coalesce(p_exams_weight, exams_weight),
    assignments_weight = coalesce(p_assignments_weight, assignments_weight)
  where id = p_course_id;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', p_course_id));
end;
$$;

create or replace function public.management_add_lecture(
  p_course_id bigint, p_title text, p_description text default null,
  p_lecture_type text default 'direct', p_scheduled_at timestamptz default null,
  p_duration_min integer default 120, p_youtube_url text default null,
  p_live_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  if public.current_user_id() is null or not public.is_owner()
     or not exists (select 1 from courses where id = p_course_id) then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  if nullif(btrim(coalesce(p_title, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'عنوان المحاضرة مطلوب');
  end if;
  if p_lecture_type not in ('direct','online','recorded') then
    return jsonb_build_object('ok', false, 'error', 'نوع المحاضرة غير صالح');
  end if;

  insert into lectures (course_id, title, description, lecture_type, scheduled_at,
                        duration_min, youtube_url, live_url, status)
  values (p_course_id, btrim(p_title), nullif(btrim(coalesce(p_description,'')), ''),
          p_lecture_type, p_scheduled_at, coalesce(p_duration_min,120),
          nullif(btrim(coalesce(p_youtube_url,'')), ''),
          nullif(btrim(coalesce(p_live_url,'')), ''), 'scheduled')
  returning id into v_id;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', v_id));
end;
$$;

create or replace function public.management_create_exam(
  p_course_id bigint, p_title text, p_description text default null,
  p_exam_kind text default 'exam', p_starts_at timestamptz default null,
  p_ends_at timestamptz default null, p_duration_min integer default null,
  p_is_published boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  if public.current_user_id() is null or not public.is_owner()
     or not exists (select 1 from courses where id = p_course_id) then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  if nullif(btrim(coalesce(p_title, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'عنوان الاختبار مطلوب');
  end if;
  if p_exam_kind not in ('exam','assignment') then
    return jsonb_build_object('ok', false, 'error', 'نوع الاختبار غير صالح');
  end if;

  insert into exams (course_id, title, description, exam_kind, starts_at, ends_at,
                     duration_min, is_published)
  values (p_course_id, btrim(p_title), nullif(btrim(coalesce(p_description,'')), ''),
          p_exam_kind, p_starts_at, p_ends_at, p_duration_min, coalesce(p_is_published,false))
  returning id into v_id;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', v_id));
end;
$$;

create or replace function public.management_grade_submission(
  p_submission_id bigint, p_points numeric, p_feedback text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid bigint := public.current_user_id();
  v_student bigint;
  v_course bigint;
  v_title text;
  v_max numeric(6,2);
begin
  if v_uid is null or not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;

  select s.student_id, c.id, a.title, a.max_points
    into v_student, v_course, v_title, v_max
  from submissions s
  join assignments a on a.id = s.assignment_id
  join courses c on c.id = a.course_id
  where s.id = p_submission_id;

  if v_student is null then
    return jsonb_build_object('ok', false, 'error', 'التسليم غير موجود');
  end if;
  if p_points is null or p_points < 0 or p_points > v_max then
    return jsonb_build_object('ok', false, 'error', 'الدرجة خارج النطاق المسموح');
  end if;

  update submissions
  set points = p_points,
      feedback = nullif(btrim(coalesce(p_feedback,'')), ''),
      graded_at = now()
  where id = p_submission_id;

  insert into points_ledger (user_id, course_id, source_type, source_id, source_detail, points)
  values (v_student, v_course, 'assignment', p_submission_id, v_title, round(p_points)::integer)
  on conflict (user_id, course_id, source_type, source_id)
  do update set points = excluded.points, source_detail = excluded.source_detail;

  insert into notifications (audience, course_id, user_id, title, body, link, created_by, type)
  values ('user', v_course, v_student, 'تم تصحيح تسليمك',
          coalesce(v_title, 'واجب') || ' — الدرجة: ' || p_points::text, null, v_uid, 'grade');

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', p_submission_id, 'points', p_points));
end;
$$;

create or replace function public.management_enroll_student(
  p_course_id bigint, p_identifier text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student bigint;
  v_name text;
begin
  if public.current_user_id() is null or not public.is_owner()
     or not exists (select 1 from courses where id = p_course_id) then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;

  select id, name into v_student, v_name
  from users
  where role = 'student' and is_active = true
    and (lower(coalesce(email,'')) = lower(btrim(coalesce(p_identifier,'')))
      or lower(coalesce(university_id,'')) = lower(btrim(coalesce(p_identifier,'')))
      or lower(coalesce(platform_id,'')) = lower(btrim(coalesce(p_identifier,''))))
  limit 1;

  if v_student is null then
    return jsonb_build_object('ok', false, 'error', 'لم يُعثر على طالب بهذا المعرّف');
  end if;

  insert into enrollments (course_id, student_id, status)
  values (p_course_id, v_student, 'active')
  on conflict (course_id, student_id) do update set status = 'active';

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', v_student, 'name', v_name));
end;
$$;

create or replace function public.management_set_attendance(
  p_lecture_id bigint, p_open boolean, p_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_id() is null or not public.is_owner()
     or not exists (select 1 from lectures where id = p_lecture_id) then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;

  update lectures
  set attendance_open = coalesce(p_open, false),
      attendance_code = case when p_open then nullif(btrim(coalesce(p_code,'')), '') else attendance_code end
  where id = p_lecture_id;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', p_lecture_id));
end;
$$;

create or replace function public.management_post_announcement(
  p_course_id bigint, p_title text, p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  if public.current_user_id() is null or not public.is_owner()
     or not exists (select 1 from courses where id = p_course_id) then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  if nullif(btrim(coalesce(p_title,'')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'عنوان الإعلان مطلوب');
  end if;

  insert into notifications (audience, course_id, title, body, link, created_by, type)
  values ('course', p_course_id, btrim(p_title),
          nullif(btrim(coalesce(p_body,'')), ''), null, public.current_user_id(), 'announcement')
  returning id into v_id;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', v_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) الصلاحيات
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'teacher_create_assignment(bigint,text,text,timestamptz,numeric)',
    'management_create_course(text,text,text,text,smallint,text,numeric,numeric,numeric)',
    'management_update_course(bigint,text,text,text,boolean,text,smallint,numeric,numeric,numeric)',
    'management_add_lecture(bigint,text,text,text,timestamptz,integer,text,text)',
    'management_create_exam(bigint,text,text,text,timestamptz,timestamptz,integer,boolean)',
    'management_grade_submission(bigint,numeric,text)',
    'management_enroll_student(bigint,text)',
    'management_set_attendance(bigint,boolean,text)',
    'management_post_announcement(bigint,text,text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- إزالة الدوال القديمة حتى لا يستطيع أستاذ استدعاء أي عملية كتابة سوى الواجب.
drop function if exists public.teacher_create_course(text,text,text,text,smallint,text,numeric,numeric,numeric);
drop function if exists public.teacher_update_course(bigint,text,text,text,boolean,text,smallint,numeric,numeric,numeric);
drop function if exists public.teacher_add_lecture(bigint,text,text,text,timestamptz,integer,text,text);
drop function if exists public.teacher_create_exam(bigint,text,text,text,timestamptz,timestamptz,integer,boolean);
drop function if exists public.teacher_grade_submission(bigint,numeric,text);
drop function if exists public.teacher_enroll_student(bigint,text);
drop function if exists public.teacher_set_attendance(bigint,boolean,text);
drop function if exists public.teacher_post_announcement(bigint,text,text);

notify pgrst, 'reload schema';

commit;

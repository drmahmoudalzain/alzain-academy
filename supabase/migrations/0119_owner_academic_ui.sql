-- ============================================================
-- 0119_owner_academic_ui.sql
-- طبقة قراءة وكتابة مخصّصة للمالك لإدارة العام الدراسي:
--   * قراءة نتائج المقررات وموافقات التخرج (الجداول محجوبة عن authenticated).
--   * تسجيل طالب بكالوريوس في فصل محدد من العام المفتوح.
--   * تغيير الحالة الأكاديمية للطالب بالأرشفة دون حذف.
-- كل الدوال تتحقق من is_owner()، وتسجّل الكتابة في audit_logs.
-- ============================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) نتائج المقررات للقراءة في واجهة المالك
-- ---------------------------------------------------------------------------
create or replace function public.academic_owner_list_course_results(
  p_year_id bigint default null,
  p_semester_id bigint default null,
  p_status text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     bigint := public.current_user_id();
  v_year_id bigint;
  v_status  text := nullif(btrim(coalesce(p_status, '')), '');
  v_rows    jsonb;
begin
  if v_uid is null or not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;

  v_year_id := coalesce(p_year_id, public.current_academic_year_id());
  if v_year_id is null then
    return jsonb_build_object('ok', false, 'error', 'العام غير موجود');
  end if;
  if p_semester_id is not null and not exists (
    select 1 from public.semesters s
    where s.id = p_semester_id and s.year_id = v_year_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'الفصل لا يتبع العام المحدد');
  end if;
  if v_status is not null and v_status not in ('pass', 'needs_decision', 'fail') then
    return jsonb_build_object('ok', false, 'error', 'حالة النتيجة غير صالحة');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'student_id', t.student_id,
    'student_name', t.student_name,
    'platform_id', t.platform_id,
    'course_id', t.course_id,
    'course_code', t.course_code,
    'course_title', t.course_title,
    'year_id', t.year_id,
    'semester_id', t.semester_id,
    'term_no', t.term_no,
    'points', t.points,
    'status', t.status,
    'teacher_recommendation', t.teacher_recommendation,
    'owner_decision', t.owner_decision,
    'reason', t.reason,
    'decided_by', t.decided_by,
    'decided_at', t.decided_at,
    'updated_at', t.updated_at
  ) order by t.term_no, t.student_name, t.course_code), '[]'::jsonb)
  into v_rows
  from (
    select r.id, r.student_id, r.course_id, r.year_id, r.semester_id,
           r.points, r.status, r.teacher_recommendation, r.owner_decision,
           r.reason, r.decided_by, r.decided_at, r.updated_at,
           u.name as student_name, u.platform_id,
           c.code as course_code, c.title as course_title,
           s.term_no
    from public.course_semester_results r
    join public.users u on u.id = r.student_id
    join public.courses c on c.id = r.course_id
    join public.semesters s on s.id = r.semester_id
    where r.year_id = v_year_id
      and (p_semester_id is null or r.semester_id = p_semester_id)
      and (v_status is null or r.status = v_status)
  ) t;

  return jsonb_build_object('ok', true, 'data', v_rows);
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) مرشحو التخرج للقراءة في واجهة المالك
-- ---------------------------------------------------------------------------
create or replace function public.academic_owner_list_graduation_candidates(
  p_year_id bigint default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     bigint := public.current_user_id();
  v_year_id bigint;
  v_rows    jsonb;
begin
  if v_uid is null or not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;

  v_year_id := coalesce(p_year_id, public.current_academic_year_id());
  if v_year_id is null then
    return jsonb_build_object('ok', false, 'error', 'العام غير موجود');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'student_id', t.student_id,
    'name', t.name,
    'platform_id', t.platform_id,
    'track', t.track,
    'level', t.level,
    'academic_status', t.academic_status,
    'results_count', t.results_count,
    'all_pass', t.all_pass,
    'decision', t.decision,
    'reason', t.reason,
    'decided_at', t.decided_at
  ) order by t.name), '[]'::jsonb)
  into v_rows
  from (
    select u.id as student_id, u.name, u.platform_id, u.track, u.level,
           u.academic_status,
           (select count(*) from public.course_semester_results r
             where r.student_id = u.id and r.year_id = v_year_id) as results_count,
           coalesce((
             select bool_and(r.status = 'pass')
             from public.course_semester_results r
             where r.student_id = u.id and r.year_id = v_year_id
           ), false) as all_pass,
           g.decision, g.reason, g.decided_at
    from public.users u
    left join public.graduation_approvals g
      on g.student_id = u.id and g.year_id = v_year_id
    where u.role = 'student'
      and u.track in ('bachelor_m', 'bachelor_f')
      and u.level = 4
      and exists (
        select 1 from public.enrollments e
        where e.student_id = u.id and e.year_id = v_year_id and e.status = 'active'
      )
  ) t;

  return jsonb_build_object('ok', true, 'data', v_rows);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) تسجيل طالب بكالوريوس في فصل محدد من العام المفتوح
-- ---------------------------------------------------------------------------
create or replace function public.academic_owner_enroll_in_semester(
  p_semester_id bigint,
  p_student_id bigint,
  p_course_id bigint default null,
  p_track text default null,
  p_level smallint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      bigint := public.current_user_id();
  v_semester public.semesters%rowtype;
  v_student  public.users%rowtype;
  v_track    text := lower(btrim(coalesce(p_track, '')));
  v_level    smallint;
  v_added    integer := 0;
begin
  if v_uid is null or not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  if (p_course_id is null) = (v_track = '') then
    return jsonb_build_object('ok', false, 'error', 'اختر مقرراً أو مساراً واحداً');
  end if;

  select * into v_semester
  from public.semesters s
  where s.id = p_semester_id and s.status = 'open'
    and exists (select 1 from public.academic_years y where y.id = s.year_id and y.status = 'open');
  if not found then
    return jsonb_build_object('ok', false, 'error', 'الفصل غير مفتوح للتسجيل');
  end if;

  select * into v_student
  from public.users
  where id = p_student_id and role = 'student' and is_active = true;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'الطالب غير موجود');
  end if;
  if v_student.track not in ('bachelor_m', 'bachelor_f') then
    return jsonb_build_object('ok', false, 'error', 'الفصول تُستخدم لطلاب البكالوريوس فقط');
  end if;

  if p_course_id is not null then
    if not exists (
      select 1 from public.courses c
      where c.id = p_course_id and c.archived = false
    ) then
      return jsonb_build_object('ok', false, 'error', 'المقرر غير موجود أو مؤرشف');
    end if;
    insert into public.enrollments (course_id, student_id, status, year_id, semester_id)
    values (p_course_id, p_student_id, 'active', v_semester.year_id, v_semester.id)
    on conflict (course_id, student_id, year_id, semester_id)
      do update set status = 'active';
    v_added := 1;
  else
    if v_track not in ('bachelor_m', 'bachelor_f') or v_track <> v_student.track then
      return jsonb_build_object('ok', false, 'error', 'مسار الطالب غير صالح');
    end if;
    v_level := coalesce(p_level, v_student.level);
    if v_level is not null and v_level not between 1 and 4 then
      return jsonb_build_object('ok', false, 'error', 'المستوى غير صالح');
    end if;

    insert into public.enrollments (course_id, student_id, status, year_id, semester_id)
    select c.id, p_student_id, 'active', v_semester.year_id, v_semester.id
    from public.courses c
    where c.archived = false
      and (v_level is null or c.level is null or c.level = v_level)
      and (
        c.track = v_track
        or (
          c.track = 'bachelor'
          and exists (
            select 1 from public.courses b
            where b.parent_course_id = c.id
              and b.track = v_track
              and b.archived = false
          )
        )
      )
    on conflict (course_id, student_id, year_id, semester_id)
      do update set status = 'active';
    get diagnostics v_added = row_count;
    if v_added = 0 then
      return jsonb_build_object('ok', false, 'error', 'لا توجد مقررات مطابقة للمسار والمستوى');
    end if;
  end if;

  insert into public.audit_logs (
    actor_id, action, table_name, record_id, new_data
  )
  values (
    v_uid, 'academic_owner_enroll_in_semester', 'enrollments', p_student_id,
    jsonb_build_object(
      'student_id', p_student_id, 'course_id', p_course_id,
      'track', v_track, 'level', v_level,
      'year_id', v_semester.year_id, 'semester_id', v_semester.id,
      'added', v_added
    )
  );

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'student_id', p_student_id, 'semester_id', v_semester.id,
      'year_id', v_semester.year_id, 'added', v_added
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) الحالة الأكاديمية: أرشفة أو استعادة دون حذف الطالب
-- ---------------------------------------------------------------------------
create or replace function public.academic_owner_set_academic_status(
  p_student_id bigint, p_status text, p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      bigint := public.current_user_id();
  v_status   text := lower(btrim(coalesce(p_status, '')));
  v_reason   text := btrim(coalesce(p_reason, ''));
  v_old      text;
begin
  if v_uid is null or not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  if v_status not in ('active', 'graduated', 'archived') then
    return jsonb_build_object('ok', false, 'error', 'الحالة الأكاديمية غير صالحة');
  end if;
  if v_reason = '' then
    return jsonb_build_object('ok', false, 'error', 'سبب تغيير الحالة مطلوب');
  end if;

  select academic_status into v_old
  from public.users
  where id = p_student_id and role = 'student'
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'الطالب غير موجود');
  end if;

  update public.users set academic_status = v_status where id = p_student_id;

  insert into public.audit_logs (
    actor_id, action, table_name, record_id, old_data, new_data
  )
  values (
    v_uid, 'academic_owner_set_academic_status', 'users', p_student_id,
    jsonb_build_object('academic_status', v_old),
    jsonb_build_object('academic_status', v_status, 'reason', v_reason)
  );

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object('student_id', p_student_id, 'academic_status', v_status)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) الصلاحيات
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'academic_owner_list_course_results(bigint,bigint,text)',
    'academic_owner_list_graduation_candidates(bigint)',
    'academic_owner_enroll_in_semester(bigint,bigint,bigint,text,smallint)',
    'academic_owner_set_academic_status(bigint,text,text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end $$;

notify pgrst, 'reload schema';

commit;

-- ============================================================
-- 0117_result_decisions.sql
-- نتائج المقررات لكل فصل: احتساب من points_ledger، توصية الأستاذ
-- للقراءة فقط، والقرار النهائي للمالك مع سبب موثّق.
--
-- العتبات تُقرأ من academic_policies. لا تُنسخ درجات بين الأعوام،
-- ولا يُمنح الأستاذ أي كتابة سوى توصية واحدة على نتيجة لم تُحسم.
-- ============================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) احتساب/تحديث نتائج العام المفتوح من سجل النقاط
-- ---------------------------------------------------------------------------
create or replace function public.academic_rebuild_course_results(
  p_year_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       bigint := public.current_user_id();
  v_year_id   bigint;
  v_pass      numeric;
  v_sources   text[];
  v_rows      integer;
  v_pass_rows integer := 0;
  v_pending   integer := 0;
  v_failed    integer := 0;
begin
  if v_uid is null or not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;

  select y.id into v_year_id
  from public.academic_years y
  where y.id = coalesce(p_year_id, public.current_academic_year_id())
    and y.status = 'open';
  if v_year_id is null then
    return jsonb_build_object('ok', false, 'error', 'العام غير مفتوح');
  end if;

  select (p.value #>> '{}')::numeric into v_pass
  from public.academic_policies p
  where p.key = 'course_pass_points';
  select array_agg(t.value) into v_sources
  from jsonb_array_elements_text(
    (select p.value from public.academic_policies p where p.key = 'point_sources')
  ) as t(value);
  if v_pass is null or v_sources is null then
    return jsonb_build_object('ok', false, 'error', 'سياسات النقاط غير مكتملة');
  end if;

  insert into public.course_semester_results as csr (
    student_id, course_id, year_id, semester_id, points, status, updated_at
  )
  select s.student_id, s.course_id, s.year_id, s.semester_id, s.points,
         case when s.points >= v_pass then 'pass' else 'needs_decision' end,
         now()
  from (
    select e.student_id, e.course_id, e.year_id, e.semester_id,
           coalesce((
             select sum(pl.points)
             from public.points_ledger pl
             where pl.user_id = e.student_id
               and pl.course_id = e.course_id
               and pl.source_type = any(v_sources)
           ), 0) as points
    from public.enrollments e
    where e.year_id = v_year_id and e.status = 'active'
  ) s
  on conflict (student_id, course_id, year_id, semester_id) do update
     set points = excluded.points,
         status = case
           when csr.owner_decision is null then excluded.status
           else csr.status
         end,
         updated_at = now();
  get diagnostics v_rows = row_count;

  select
    count(*) filter (where r.status = 'pass'),
    count(*) filter (where r.status = 'needs_decision'),
    count(*) filter (where r.status = 'fail')
  into v_pass_rows, v_pending, v_failed
  from public.course_semester_results r
  where r.year_id = v_year_id;

  insert into public.audit_logs (
    actor_id, action, table_name, record_id, new_data
  )
  values (
    v_uid, 'academic_rebuild_course_results', 'course_semester_results', v_year_id,
    jsonb_build_object(
      'year_id', v_year_id, 'rows', v_rows, 'pass', v_pass_rows,
      'needs_decision', v_pending, 'fail', v_failed, 'threshold', v_pass
    )
  );

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'year_id', v_year_id, 'rows', v_rows,
      'pass', v_pass_rows, 'needs_decision', v_pending, 'fail', v_failed,
      'threshold', v_pass
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) قرار المالك في نتيجة مقرر — يتجاوز توصية الأستاذ، ويُسبَّب
-- ---------------------------------------------------------------------------
create or replace function public.academic_owner_decide_course_result(
  p_result_id bigint, p_decision text, p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      bigint := public.current_user_id();
  v_decision text := lower(btrim(coalesce(p_decision, '')));
  v_reason   text := btrim(coalesce(p_reason, ''));
  v_result   public.course_semester_results%rowtype;
  v_year_id  bigint;
begin
  if v_uid is null or not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  if v_decision not in ('pass', 'fail') then
    return jsonb_build_object('ok', false, 'error', 'قرار النتيجة غير صالح');
  end if;
  if v_reason = '' then
    return jsonb_build_object('ok', false, 'error', 'سبب القرار مطلوب');
  end if;

  select * into v_result
  from public.course_semester_results
  where id = p_result_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'النتيجة غير موجودة');
  end if;

  select y.id into v_year_id
  from public.academic_years y
  where y.status = 'open';
  if v_result.year_id is distinct from v_year_id then
    return jsonb_build_object('ok', false, 'error', 'نتائج الأعوام المغلقة لا تُعدّل');
  end if;

  update public.course_semester_results
     set status = v_decision,
         owner_decision = v_decision,
         reason = v_reason,
         decided_by = v_uid,
         decided_at = now(),
         updated_at = now()
   where id = p_result_id;

  insert into public.audit_logs (
    actor_id, action, table_name, record_id, old_data, new_data
  )
  values (
    v_uid, 'academic_owner_decide_course_result', 'course_semester_results', p_result_id,
    jsonb_build_object(
      'status', v_result.status, 'points', v_result.points,
      'teacher_recommendation', v_result.teacher_recommendation,
      'owner_decision', v_result.owner_decision, 'reason', v_result.reason
    ),
    jsonb_build_object(
      'status', v_decision, 'owner_decision', v_decision,
      'reason', v_reason, 'decided_by', v_uid
    )
  );

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object('id', p_result_id, 'decision', v_decision)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) موافقة المالك على التخرج أو رفضه — سبب إلزامي وموثّق
-- ---------------------------------------------------------------------------
create or replace function public.academic_owner_decide_graduation(
  p_student_id bigint, p_year_id bigint, p_decision text, p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      bigint := public.current_user_id();
  v_decision text := lower(btrim(coalesce(p_decision, '')));
  v_reason   text := btrim(coalesce(p_reason, ''));
  v_student  public.users%rowtype;
  v_all_pass boolean;
  v_old      jsonb;
begin
  if v_uid is null or not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  if v_decision not in ('approve', 'reject') then
    return jsonb_build_object('ok', false, 'error', 'قرار التخرج غير صالح');
  end if;
  if v_reason = '' then
    return jsonb_build_object('ok', false, 'error', 'سبب القرار مطلوب');
  end if;

  select * into v_student
  from public.users
  where id = p_student_id and role = 'student';
  if not found
     or v_student.track not in ('bachelor_m', 'bachelor_f')
     or v_student.level is distinct from 4 then
    return jsonb_build_object('ok', false, 'error', 'الطالب ليس في مستوى التخرج');
  end if;
  if not exists (
    select 1 from public.academic_years
    where id = p_year_id and status = 'open'
  ) then
    return jsonb_build_object('ok', false, 'error', 'العام غير مفتوح');
  end if;

  v_all_pass := exists (
    select 1 from public.course_semester_results r
    where r.student_id = p_student_id and r.year_id = p_year_id
  ) and not exists (
    select 1 from public.enrollments e
    where e.student_id = p_student_id
      and e.year_id = p_year_id
      and e.status = 'active'
      and not exists (
        select 1 from public.course_semester_results r
        where r.student_id = e.student_id and r.course_id = e.course_id
          and r.year_id = e.year_id and r.semester_id = e.semester_id
          and r.status = 'pass'
      )
  );
  if v_decision = 'approve' and not v_all_pass then
    return jsonb_build_object('ok', false, 'error', 'لم يستوفِ الطالب نجاح جميع المقررات');
  end if;

  select jsonb_build_object(
    'decision', g.decision, 'reason', g.reason, 'approver_id', g.approver_id
  ) into v_old
  from public.graduation_approvals g
  where g.student_id = p_student_id and g.year_id = p_year_id;

  insert into public.graduation_approvals (
    student_id, year_id, decision, reason, approver_id, decided_at
  )
  values (p_student_id, p_year_id, v_decision, v_reason, v_uid, now())
  on conflict (student_id, year_id) do update
     set decision = excluded.decision,
         reason = excluded.reason,
         approver_id = excluded.approver_id,
         decided_at = now();

  if v_decision = 'approve' then
    update public.users
       set academic_status = 'graduated'
     where id = p_student_id;
  end if;

  insert into public.audit_logs (
    actor_id, action, table_name, record_id, old_data, new_data
  )
  values (
    v_uid, 'academic_owner_decide_graduation', 'graduation_approvals', p_student_id,
    v_old,
    jsonb_build_object(
      'year_id', p_year_id, 'decision', v_decision,
      'reason', v_reason, 'approver_id', v_uid
    )
  );

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'student_id', p_student_id, 'year_id', p_year_id, 'decision', v_decision
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) فتح الفصل الثاني بعد نجاح جميع مقررات الفصل الأول
-- ---------------------------------------------------------------------------
create or replace function public.academic_open_second_semester(
  p_year_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        bigint := public.current_user_id();
  v_year_id    bigint;
  v_sem1       bigint;
  v_sem2       bigint;
  v_students   integer := 0;
  v_incomplete integer := 0;
  v_copied     integer := 0;
begin
  if v_uid is null or not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;

  select y.id into v_year_id
  from public.academic_years y
  where y.id = coalesce(p_year_id, public.current_academic_year_id())
    and y.status = 'open';
  if v_year_id is null then
    return jsonb_build_object('ok', false, 'error', 'العام غير مفتوح');
  end if;

  select s.id into v_sem1
  from public.semesters s
  where s.year_id = v_year_id and s.term_no = 1;
  select s.id into v_sem2
  from public.semesters s
  where s.year_id = v_year_id and s.term_no = 2;
  if v_sem1 is null or v_sem2 is null then
    return jsonb_build_object('ok', false, 'error', 'فصول العام غير مكتملة');
  end if;
  if not exists (select 1 from public.semesters s where s.id = v_sem1 and s.status = 'open')
     or not exists (select 1 from public.semesters s where s.id = v_sem2 and s.status = 'closed') then
    return jsonb_build_object('ok', false, 'error', 'الفصل الأول مغلق أو الفصل الثاني مفتوح بالفعل');
  end if;

  select count(distinct e.student_id) into v_students
  from public.enrollments e
  where e.year_id = v_year_id and e.semester_id = v_sem1 and e.status = 'active';
  if v_students = 0 then
    return jsonb_build_object('ok', false, 'error', 'لا يوجد مسجلون في الفصل الأول');
  end if;

  select count(distinct e.student_id) into v_incomplete
  from public.enrollments e
  where e.year_id = v_year_id and e.semester_id = v_sem1 and e.status = 'active'
    and not exists (
      select 1 from public.course_semester_results r
      where r.student_id = e.student_id and r.course_id = e.course_id
        and r.year_id = e.year_id and r.semester_id = e.semester_id
        and r.status = 'pass'
    );
  if v_incomplete > 0 then
    return jsonb_build_object(
      'ok', false,
      'error', 'لم ينجح جميع الطلاب في الفصل الأول',
      'incomplete_students', v_incomplete
    );
  end if;

  update public.semesters set status = 'closed' where id = v_sem1;
  update public.semesters set status = 'open' where id = v_sem2;

  insert into public.enrollments (course_id, student_id, status, year_id, semester_id)
  select e.course_id, e.student_id, 'active', e.year_id, v_sem2
  from public.enrollments e
  where e.year_id = v_year_id and e.semester_id = v_sem1 and e.status = 'active'
  on conflict (course_id, student_id, year_id, semester_id)
    do update set status = 'active';
  get diagnostics v_copied = row_count;

  insert into public.audit_logs (
    actor_id, action, table_name, record_id, new_data
  )
  values (
    v_uid, 'academic_open_second_semester', 'semesters', v_sem2,
    jsonb_build_object(
      'year_id', v_year_id, 'semester_1', v_sem1, 'semester_2', v_sem2,
      'students', v_students, 'enrollments_copied', v_copied
    )
  );

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'year_id', v_year_id, 'semester_2', v_sem2,
      'students', v_students, 'enrollments_copied', v_copied
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) توصية الأستاذ — كتابة واحدة محدودة، بلا قرار وبلا درجات
-- ---------------------------------------------------------------------------
create or replace function public.teacher_record_result_recommendation(
  p_result_id bigint, p_recommendation text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    bigint := public.current_user_id();
  v_rec    text := lower(btrim(coalesce(p_recommendation, '')));
  v_result public.course_semester_results%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  if v_rec not in ('pass', 'fail') then
    return jsonb_build_object('ok', false, 'error', 'التوصية غير صالحة');
  end if;

  select res.* into v_result
  from public.course_semester_results res
  join public.courses c on c.id = res.course_id
  where res.id = p_result_id
    and c.teacher_id = v_uid
    and res.status = 'needs_decision'
    and res.owner_decision is null
  for update of res;
  if not found then
    return jsonb_build_object(
      'ok', false, 'error', 'النتيجة غير موجودة أو ليست ضمن مقررات الأستاذ'
    );
  end if;

  update public.course_semester_results
     set teacher_recommendation = v_rec,
         updated_at = now()
   where id = p_result_id;

  insert into public.audit_logs (
    actor_id, action, table_name, record_id, old_data, new_data
  )
  values (
    v_uid, 'teacher_record_result_recommendation', 'course_semester_results', p_result_id,
    jsonb_build_object('teacher_recommendation', v_result.teacher_recommendation),
    jsonb_build_object('teacher_recommendation', v_rec)
  );

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object('id', p_result_id, 'recommendation', v_rec)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 6) الصلاحيات
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'academic_rebuild_course_results(bigint)',
    'academic_owner_decide_course_result(bigint,text,text)',
    'academic_owner_decide_graduation(bigint,bigint,text,text)',
    'academic_open_second_semester(bigint)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;

  execute 'revoke all on function public.teacher_record_result_recommendation(bigint,text) from public, anon, service_role';
  execute 'grant execute on function public.teacher_record_result_recommendation(bigint,text) to authenticated';
end $$;

notify pgrst, 'reload schema';

commit;

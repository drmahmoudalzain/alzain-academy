-- ============================================================
-- 0116_academic_year_periods.sql
-- قواعد الفترة: معاينة إغلاق العام، ثم إغلاقه وإنشاء العام التالي.
--
-- الإغلاق يدوي ويمر بمعاينة إلزامية وتدقيق. أي قرار مقرر معلّق،
-- أو طالب بلا نتائج، أو مستوفٍ للتخرج بلا موافقة، يمنع الإغلاق.
-- النقل ينشئ تسجيلات جديدة للعام التالي ويُوقف القديمة؛ لا تُنسخ درجات.
-- ============================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) معاينة الإغلاق — للقراءة فقط، ومخصصة للمالك
-- ---------------------------------------------------------------------------
create or replace function public.academic_preview_close_year(p_year_id bigint default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid        bigint := public.current_user_id();
  v_year       public.academic_years%rowtype;
  v_active     integer := 0;
  v_tracks     jsonb;
  v_results    jsonb;
  v_pending    integer := 0;
  v_no_results integer := 0;
  v_ready      integer := 0;
  v_approvals  jsonb;
  v_blockers   jsonb := '[]'::jsonb;
begin
  if v_uid is null or not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;

  select * into v_year
  from public.academic_years
  where id = coalesce(p_year_id, public.current_academic_year_id());
  if not found then
    return jsonb_build_object('ok', false, 'error', 'العام غير موجود');
  end if;
  if v_year.status <> 'open' then
    return jsonb_build_object('ok', false, 'error', 'العام ليس مفتوحاً');
  end if;

  select count(*) into v_active
  from public.enrollments e
  join public.users u on u.id = e.student_id
  where e.year_id = v_year.id and e.status = 'active' and u.role = 'student';

  select jsonb_object_agg(t.track, t.n) into v_tracks
  from (
    select coalesce(u.track, '(null)') as track, count(distinct e.student_id) as n
    from public.enrollments e
    join public.users u on u.id = e.student_id
    where e.year_id = v_year.id and e.status = 'active' and u.role = 'student'
    group by 1
  ) t;

  select jsonb_object_agg(t.status, t.n) into v_results
  from (
    select r.status, count(*) as n
    from public.course_semester_results r
    where r.year_id = v_year.id
    group by 1
  ) t;

  select count(*) into v_pending
  from public.course_semester_results r
  where r.year_id = v_year.id and r.status = 'needs_decision';

  select count(*) into v_no_results
  from (
    select distinct e.student_id
    from public.enrollments e
    join public.users u on u.id = e.student_id
    where e.year_id = v_year.id and e.status = 'active' and u.role = 'student'
      and u.track in ('bachelor_m', 'bachelor_f')
      and not exists (
        select 1 from public.course_semester_results r
        where r.year_id = v_year.id and r.student_id = e.student_id
      )
  ) s;

  select count(*) into v_ready
  from public.users u
  where u.role = 'student'
    and u.track in ('bachelor_m', 'bachelor_f')
    and u.level = 4
    and exists (
      select 1 from public.course_semester_results r
      where r.year_id = v_year.id and r.student_id = u.id
    )
    and not exists (
      select 1 from public.enrollments e
      where e.student_id = u.id and e.year_id = v_year.id and e.status = 'active'
        and not exists (
          select 1 from public.course_semester_results r
          where r.student_id = e.student_id and r.course_id = e.course_id
            and r.year_id = e.year_id and r.semester_id = e.semester_id
            and r.status = 'pass'
        )
    )
    and not exists (
      select 1 from public.graduation_approvals g
      where g.student_id = u.id and g.year_id = v_year.id
    );

  select jsonb_object_agg(t.decision, t.n) into v_approvals
  from (
    select g.decision, count(*) as n
    from public.graduation_approvals g
    where g.year_id = v_year.id
    group by 1
  ) t;

  if v_active = 0 then
    v_blockers := v_blockers || to_jsonb('لا يوجد مسجلون نشطون في العام'::text);
  end if;
  if v_results is null then
    v_blockers := v_blockers || to_jsonb('لا توجد نتائج مسجلة لهذا العام'::text);
  end if;
  if v_pending > 0 then
    v_blockers := v_blockers || to_jsonb('توجد نتائج بانتظار قرار المالك'::text);
  end if;
  if v_no_results > 0 then
    v_blockers := v_blockers || to_jsonb('يوجد طلاب بكالوريوس بلا نتائج مسجلة'::text);
  end if;
  if v_ready > 0 then
    v_blockers := v_blockers || to_jsonb('يوجد طلاب مستوفون للتخرج بلا موافقة موثقة'::text);
  end if;

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'year_id', v_year.id,
      'label', v_year.label,
      'code', v_year.code,
      'active_enrollments', v_active,
      'tracks', coalesce(v_tracks, '{}'::jsonb),
      'results', coalesce(v_results, '{}'::jsonb),
      'pending_decisions', v_pending,
      'students_without_results', v_no_results,
      'graduation_ready', v_ready,
      'graduation_approvals', coalesce(v_approvals, '{}'::jsonb),
      'blockers', v_blockers,
      'safe_to_close', jsonb_array_length(v_blockers) = 0
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) الإغلاق وفتح العام التالي — عملية واحدة قابلة للتراجع فقط عبر rollback
-- ---------------------------------------------------------------------------
create or replace function public.academic_close_year_and_open_next(
  p_label text, p_code text, p_reason text,
  p_archive_other_tracks boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        bigint := public.current_user_id();
  v_label      text := btrim(coalesce(p_label, ''));
  v_code       text := upper(btrim(coalesce(p_code, '')));
  v_reason     text := btrim(coalesce(p_reason, ''));
  v_year       public.academic_years%rowtype;
  v_preview    jsonb;
  v_open_count integer;
  v_new_year   bigint;
  v_new_sem1   bigint;
  v_approved   boolean;
  v_rejected   boolean;
  v_passed     boolean;
  v_rows       integer;
  v_suspended  integer := 0;
  v_promoted   integer := 0;
  v_graduated  integer := 0;
  v_held       integer := 0;
  v_archived   integer := 0;
  r            record;
begin
  if v_uid is null or not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  if v_label = '' or v_code = '' or v_reason = '' then
    return jsonb_build_object('ok', false, 'error', 'العنوان والرمز والسبب مطلوبة');
  end if;
  if exists (select 1 from public.academic_years where code = v_code) then
    return jsonb_build_object('ok', false, 'error', 'رمز العام مستخدم بالفعل');
  end if;

  select count(*) into v_open_count
  from public.academic_years where status = 'open';
  if v_open_count <> 1 then
    return jsonb_build_object(
      'ok', false,
      'error', case when v_open_count = 0
        then 'لا يوجد عام مفتوح لإغلاقه'
        else 'أكثر من عام مفتوح؛ لا يُفتح عام جديد قبل إغلاق الحالي'
      end
    );
  end if;
  select * into v_year from public.academic_years where status = 'open';

  v_preview := public.academic_preview_close_year(v_year.id);
  if coalesce(v_preview ->> 'ok', 'false') <> 'true' then
    return v_preview;
  end if;
  if coalesce(v_preview #>> '{data,safe_to_close}', 'false') <> 'true' then
    return jsonb_build_object(
      'ok', false, 'error', 'المعاينة تمنع الإغلاق', 'preview', v_preview
    );
  end if;

  update public.academic_years
     set status = 'closed', closed_at = now()
   where id = v_year.id;
  update public.semesters
     set status = 'closed'
   where year_id = v_year.id;

  insert into public.academic_years (label, code, status)
  values (v_label, v_code, 'open')
  returning id into v_new_year;

  insert into public.semesters (year_id, term_no, status)
  values (v_new_year, 1, 'open')
  returning id into v_new_sem1;
  insert into public.semesters (year_id, term_no, status)
  values (v_new_year, 2, 'closed');

  for r in
    select u.id as student_id, u.track, u.level, u.academic_status
    from public.users u
    where u.role = 'student' and u.is_active = true
      and exists (
        select 1 from public.enrollments e
        where e.student_id = u.id and e.year_id = v_year.id and e.status = 'active'
      )
    order by u.id
  loop
    v_approved := exists (
      select 1 from public.graduation_approvals g
      where g.student_id = r.student_id and g.year_id = v_year.id
        and g.decision = 'approve'
    );
    v_rejected := exists (
      select 1 from public.graduation_approvals g
      where g.student_id = r.student_id and g.year_id = v_year.id
        and g.decision = 'reject'
    );
    v_passed := r.track in ('bachelor_m', 'bachelor_f')
      and r.level is not null and r.level < 4
      and not exists (
        select 1 from public.enrollments e
        where e.student_id = r.student_id and e.year_id = v_year.id and e.status = 'active'
          and not exists (
            select 1 from public.course_semester_results rs
            where rs.student_id = e.student_id and rs.course_id = e.course_id
              and rs.year_id = e.year_id and rs.semester_id = e.semester_id
              and rs.status = 'pass'
          )
      );

    update public.enrollments
       set status = 'suspended'
     where student_id = r.student_id and year_id = v_year.id and status = 'active';
    get diagnostics v_rows = row_count;
    v_suspended := v_suspended + v_rows;

    if r.track not in ('bachelor_m', 'bachelor_f') then
      if p_archive_other_tracks then
        update public.users
           set academic_status = 'archived'
         where id = r.student_id and academic_status <> 'archived';
        v_archived := v_archived + 1;
      else
        v_held := v_held + 1;
      end if;
    elsif v_approved then
      update public.users set academic_status = 'graduated' where id = r.student_id;
      v_graduated := v_graduated + 1;
    elsif v_rejected or not v_passed then
      v_held := v_held + 1;
    else
      update public.users set level = r.level + 1 where id = r.student_id;

      insert into public.enrollments (course_id, student_id, status, year_id, semester_id)
      select c.id, r.student_id, 'active', v_new_year, v_new_sem1
      from public.courses c
      where c.archived = false
        and c.level = r.level + 1
        and (
          c.track = r.track
          or (
            c.track = 'bachelor'
            and exists (
              select 1 from public.courses b
              where b.parent_course_id = c.id
                and b.track = r.track
                and b.archived = false
            )
          )
        )
      on conflict (course_id, student_id, year_id, semester_id)
        do update set status = 'active';
      get diagnostics v_rows = row_count;
      v_promoted := v_promoted + 1;
    end if;

    insert into public.audit_logs (
      actor_id, action, table_name, record_id, old_data, new_data
    )
    values (
      v_uid, 'academic_year_student_outcome', 'users', r.student_id,
      jsonb_build_object('year_id', v_year.id, 'academic_status', r.academic_status, 'level', r.level),
      jsonb_build_object(
        'year_id', v_year.id, 'new_year_id', v_new_year,
        'outcome', case
          when r.track not in ('bachelor_m', 'bachelor_f') and p_archive_other_tracks then 'archived'
          when r.track not in ('bachelor_m', 'bachelor_f') then 'held'
          when v_approved then 'graduated'
          when v_rejected or not v_passed then 'held'
          else 'promoted'
        end,
        'new_level', case when v_passed and not v_approved and not v_rejected then r.level + 1 else null end,
        'new_enrollments', case when v_passed and not v_approved and not v_rejected then v_rows else null end
      )
    );
  end loop;

  insert into public.audit_logs (
    actor_id, action, table_name, record_id, old_data, new_data
  )
  values (
    v_uid, 'academic_close_year', 'academic_years', v_year.id,
    jsonb_build_object('status', 'open'),
    jsonb_build_object(
      'status', 'closed', 'new_year_id', v_new_year,
      'label', v_label, 'code', v_code, 'reason', v_reason,
      'suspended_enrollments', v_suspended, 'promoted', v_promoted,
      'graduated', v_graduated, 'held', v_held, 'archived_other', v_archived,
      'archive_other_tracks', p_archive_other_tracks
    )
  );

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'from_year_id', v_year.id,
      'to_year_id', v_new_year,
      'label', v_label,
      'code', v_code,
      'suspended_enrollments', v_suspended,
      'promoted', v_promoted,
      'graduated', v_graduated,
      'held', v_held,
      'archived_other', v_archived,
      'preview', v_preview #> '{data,blockers}'
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) الصلاحيات: المالك فقط عبر JWT المستخدم، وservice_role للتشغيل الآمن
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'academic_preview_close_year(bigint)',
    'academic_close_year_and_open_next(text,text,text,boolean)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end $$;

notify pgrst, 'reload schema';

commit;

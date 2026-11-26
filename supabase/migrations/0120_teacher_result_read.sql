-- ============================================================
-- 0120_teacher_result_read.sql
-- قراءة مخصّصة للأستاذ لنتائج مقرراته المسندة فقط. لا تُضاف أي كتابة:
-- التوصية الوحيدة المسموحة هي teacher_record_result_recommendation
-- من 0117، وتظل النتيجة والقرار والنقاط بيد المالك.
-- ============================================================

begin;

create or replace function public.teacher_list_my_course_results(
  p_year_id bigint default null,
  p_semester_id bigint default null
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
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;

  v_year_id := coalesce(p_year_id, public.current_academic_year_id());
  if v_year_id is null or not exists (
    select 1 from public.academic_years y
    where y.id = v_year_id and y.status = 'open'
  ) then
    return jsonb_build_object('ok', false, 'error', 'العام غير مفتوح');
  end if;
  if p_semester_id is not null and not exists (
    select 1 from public.semesters s
    where s.id = p_semester_id and s.year_id = v_year_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'الفصل لا يتبع العام المحدد');
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
    'can_recommend', t.can_recommend
  ) order by t.term_no, t.course_code, t.student_name), '[]'::jsonb)
  into v_rows
  from (
    select r.id, r.student_id, r.course_id, r.year_id, r.semester_id,
           r.points, r.status, r.teacher_recommendation, r.owner_decision,
           u.name as student_name, u.platform_id,
           c.code as course_code, c.title as course_title,
           s.term_no,
           (r.status = 'needs_decision' and r.owner_decision is null) as can_recommend
    from public.course_semester_results r
    join public.courses c on c.id = r.course_id and c.teacher_id = v_uid
    join public.users u on u.id = r.student_id
    join public.semesters s on s.id = r.semester_id
    where r.year_id = v_year_id
      and (p_semester_id is null or r.semester_id = p_semester_id)
  ) t;

  return jsonb_build_object('ok', true, 'data', v_rows);
end;
$$;

do $$
begin
  revoke all on function public.teacher_list_my_course_results(bigint, bigint) from public, anon;
  grant execute on function public.teacher_list_my_course_results(bigint, bigint) to authenticated, service_role;
end $$;

notify pgrst, 'reload schema';

commit;

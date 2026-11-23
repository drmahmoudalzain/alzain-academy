-- ============================================================
-- 0102_student_dashboard.sql — أول RPC (Phase 3): لوحة الطالب
-- إضافي. يقرأ عبر RLS (security definer) ويُعيد jsonb {ok,data}.
-- ============================================================

begin;

create or replace function public.student_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid bigint := public.current_user_id();
  v_courses jsonb;
  v_points bigint;
  v_upcoming_exams bigint;
  v_pending_assignments bigint;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'title', c.title,
    'code', c.code,
    'track', c.track,
    'level', c.level
  ) order by c.id), '[]'::jsonb)
  into v_courses
  from public.courses c
  join public.enrollments e on e.course_id = c.id
  where e.student_id = v_uid and e.status = 'active';

  select coalesce(sum(points), 0) into v_points
  from public.points_ledger where user_id = v_uid;

  select count(*) into v_upcoming_exams
  from public.exams ex
  join public.enrollments e on e.course_id = ex.course_id
  where e.student_id = v_uid and e.status = 'active'
    and (ex.starts_at is null or ex.starts_at > now())
    and (ex.ends_at is null or ex.ends_at > now());

  select count(*) into v_pending_assignments
  from public.assignments a
  join public.enrollments e on e.course_id = a.course_id
  left join public.submissions s on s.assignment_id = a.id and s.student_id = v_uid
  where e.student_id = v_uid and e.status = 'active'
    and s.id is null;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'courses_count', coalesce(jsonb_array_length(v_courses), 0),
    'courses', v_courses,
    'points_total', v_points,
    'upcoming_exams', v_upcoming_exams,
    'pending_assignments', v_pending_assignments
  ));
end;
$$;

revoke all on function public.student_dashboard() from public, anon;
grant execute on function public.student_dashboard() to authenticated;

notify pgrst, 'reload schema';

commit;

-- ============================================================
-- 0104_student_dashboard_full.sql
-- توسيع RPC لوحة الطالب ببيانات حقيقية كاملة (بدون أي بيانات وهمية)
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
  v_user jsonb;
  v_courses jsonb;
  v_lectures jsonb;
  v_exams jsonb;
  v_notifications jsonb;
  v_points jsonb;
  v_courses_count bigint;
  v_today_lectures bigint;
  v_upcoming_exams bigint;
  v_pending_assignments bigint;
  v_attendance_pct numeric;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;

  select jsonb_build_object(
    'name', u.name,
    'platform_id', u.platform_id
  ) into v_user
  from public.users u where u.id = v_uid;

  -- المقررات + نسبة الحضور لكل مقرر
  select coalesce(jsonb_agg(d order by d->>'title'), '[]'::jsonb)
  into v_courses
  from (
    select jsonb_build_object(
      'id', c.id,
      'title', c.title,
      'code', c.code,
      'level', c.level,
      'teacher', t.name,
      'color', c.color,
      'progress', case
        when count(l.id) filter (where l.scheduled_at is not null and l.scheduled_at <= now()) = 0 then 0
        else round(
          100.0 * count(a.id) filter (where l.scheduled_at is not null and l.scheduled_at <= now())
          / count(l.id) filter (where l.scheduled_at is not null and l.scheduled_at <= now())
        )
      end
    ) as d
    from public.courses c
    join public.enrollments e on e.course_id = c.id and e.student_id = v_uid
    left join public.users t on t.id = c.teacher_id
    left join public.lectures l on l.course_id = c.id
    left join public.attendance a on a.lecture_id = l.id and a.student_id = v_uid
    where c.archived = false
    group by c.id, c.title, c.code, c.level, t.name, c.color
  ) s;

  select coalesce(jsonb_array_length(v_courses), 0) into v_courses_count;

  -- نسبة الحضور الكلية
  select coalesce(round(
    100.0 * count(a.id) / nullif(count(l.id) filter (where l.scheduled_at <= now()), 0)
  ), 0)
  into v_attendance_pct
  from public.lectures l
  join public.enrollments e on e.course_id = l.course_id and e.student_id = v_uid
  left join public.attendance a on a.lecture_id = l.id and a.student_id = v_uid
  where l.scheduled_at <= now();

  -- المحاضرات القادمة (3)
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', l.id,
    'title', l.title,
    'course', c.title,
    'scheduled_at', l.scheduled_at,
    'lecture_type', l.lecture_type,
    'duration_min', l.duration_min
  ) order by l.scheduled_at), '[]'::jsonb)
  into v_lectures
  from public.lectures l
  join public.courses c on c.id = l.course_id
  join public.enrollments e on e.course_id = c.id and e.student_id = v_uid
  where l.scheduled_at > now()
    and l.status <> 'cancelled'
  limit 3;

  select count(*) into v_today_lectures
  from public.lectures l
  join public.enrollments e on e.course_id = l.course_id and e.student_id = v_uid
  where l.scheduled_at::date = current_date;

  -- الاختبارات القادمة
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ex.id,
    'title', ex.title,
    'course', c.title,
    'starts_at', ex.starts_at
  ) order by ex.starts_at), '[]'::jsonb)
  into v_exams
  from public.exams ex
  join public.courses c on c.id = ex.course_id
  join public.enrollments e on e.course_id = c.id and e.student_id = v_uid
  where ex.is_published = true
    and (ex.starts_at is null or ex.starts_at > now());
  select coalesce(jsonb_array_length(v_exams), 0) into v_upcoming_exams;

  -- الواجبات غير المسلّمة
  select count(*) into v_pending_assignments
  from public.assignments a
  join public.enrollments e on e.course_id = a.course_id and e.student_id = v_uid
  left join public.submissions s on s.assignment_id = a.id and s.student_id = v_uid
  where s.id is null;

  -- الإشعارات (عامة / مقرراته / مخصصة) غير المقروءة
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', n.id,
    'title', n.title,
    'body', n.body,
    'created_at', n.created_at
  ) order by n.created_at desc), '[]'::jsonb)
  into v_notifications
  from public.notifications n
  left join public.notification_reads r on r.notification_id = n.id and r.user_id = v_uid
  left join public.enrollments e on e.course_id = n.course_id and e.student_id = v_uid
  where r.read_at is null
    and (
      n.audience = 'all'
      or (n.audience = 'user' and n.user_id = v_uid)
      or (n.audience = 'course' and e.student_id = v_uid)
    )
  limit 3;

  -- النقاط مفصّلة
  select coalesce(jsonb_object_agg(source_type, total), '{}'::jsonb)
  into v_points
  from (
    select p.source_type, sum(p.points) as total
    from public.points_ledger p
    where p.user_id = v_uid
    group by p.source_type
  ) pp;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'user', v_user,
    'courses', v_courses,
    'courses_count', v_courses_count,
    'attendance_pct', coalesce(v_attendance_pct, 0),
    'points_total', coalesce((v_points->>'attendance')::bigint, 0)
                  + coalesce((v_points->>'interaction')::bigint, 0)
                  + coalesce((v_points->>'assignment')::bigint, 0),
    'points_breakdown', v_points,
    'lectures', v_lectures,
    'today_lectures', v_today_lectures,
    'exams', v_exams,
    'upcoming_exams', v_upcoming_exams,
    'pending_assignments', v_pending_assignments,
    'notifications', v_notifications
  ));
end;
$$;

revoke all on function public.student_dashboard() from public, anon;
grant execute on function public.student_dashboard() to authenticated;

notify pgrst, 'reload schema';

commit;

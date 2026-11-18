select
  (select json_agg(u) from (
    select id, role, name, email, university_id, is_staff, is_active, level, track
    from public.users order by id
  ) u) as users,
  (select count(*)::int from public.courses) as courses_count,
  (select json_agg(c) from (
    select id, code, title, teacher_id, level, track, archived
    from public.courses order by id
  ) c) as courses;

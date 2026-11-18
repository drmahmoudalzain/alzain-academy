select 'users' t, count(*) from public.users
union all select 'courses', count(*) from public.courses
union all select 'enrollments', count(*) from public.enrollments
union all select 'lectures', count(*) from public.lectures
union all select 'attendance', count(*) from public.attendance
union all select 'exams', count(*) from public.exams
union all select 'exam_questions', count(*) from public.exam_questions
union all select 'assignments', count(*) from public.assignments
union all select 'submissions', count(*) from public.submissions
union all select 'points', count(*) from public.points_ledger
union all select 'notifications', count(*) from public.notifications;

-- ============================================================
-- 0118_close_empty_initial_semester_rollback.sql
-- إعادة الفصل الثاني الخالي للعام المفتوح إلى حالة open.
-- ============================================================

begin;

do $$
declare
  v_year        bigint;
  v_semester    bigint;
  v_enrollments integer;
begin
  select y.id into v_year
  from public.academic_years y
  where y.status = 'open';

  if v_year is null then
    raise exception 'لا يوجد عام مفتوح لاستعادة فصله الثاني';
  end if;

  select s.id into v_semester
  from public.semesters s
  where s.year_id = v_year
    and s.term_no = 2
    and s.status = 'closed';

  if v_semester is not null then
    select count(*) into v_enrollments
    from public.enrollments e
    where e.semester_id = v_semester;

    if v_enrollments > 0 then
      raise exception 'الفصل الثاني يحتوي تسجيلات؛ لم تُعد حالة الدالة';
    end if;

    update public.semesters
       set status = 'open'
     where id = v_semester;
  end if;
end $$;

commit;

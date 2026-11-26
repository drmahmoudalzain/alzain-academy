-- ============================================================
-- 0118_close_empty_initial_semester.sql
-- تصحيح حالة الفصل الثاني للعام الحالي: كان مفتوحاً بالـ backfill،
-- والقاعدة تشترط فتحه بعد نجاح مقررات الفصل الأول فقط.
-- يُغلق فقط إذا كان خالياً تماماً من التسجيلات.
-- ============================================================

begin;

do $$
declare
  v_year       bigint;
  v_semester   bigint;
  v_enrollments integer;
begin
  select y.id into v_year
  from public.academic_years y
  where y.status = 'open';

  if v_year is null then
    raise exception 'لا يوجد عام مفتوح لتصحيح فصله الثاني';
  end if;

  select s.id into v_semester
  from public.semesters s
  where s.year_id = v_year
    and s.term_no = 2
    and s.status = 'open';

  if v_semester is not null then
    select count(*) into v_enrollments
    from public.enrollments e
    where e.semester_id = v_semester;

    if v_enrollments > 0 then
      raise exception 'الفصل الثاني يحتوي تسجيلات؛ لم يُغلق';
    end if;

    update public.semesters
       set status = 'closed'
     where id = v_semester;

    insert into public.audit_logs (
      actor_id, action, table_name, record_id, old_data, new_data
    )
    values (
      null, 'academic_fix_initial_second_semester', 'semesters', v_semester,
      jsonb_build_object('status', 'open'),
      jsonb_build_object('status', 'closed', 'year_id', v_year)
    );
  end if;
end $$;

commit;

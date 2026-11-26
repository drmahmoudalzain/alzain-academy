-- ============================================================
-- 0129_management_delete_lecture.sql
-- حذف محاضرة من قبل المالك (إدارة المحاضرات — الدفعة ٣).
-- يتطلب هوية مالك (is_owner) ويراقب الحذف في audit_logs.
-- cascades تُحذف السجلات المرتبطة (attendance / answers /
-- presence / files / ...).
-- ============================================================

begin;

create or replace function public.management_delete_lecture(p_lecture_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  bigint := public.current_user_id();
  v_old  public.lectures%rowtype;
begin
  if v_uid is null or not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  select * into v_old from public.lectures where id = p_lecture_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'المحاضرة غير موجودة');
  end if;

  insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data)
  values (v_uid, 'management_delete_lecture', 'lectures', p_lecture_id, to_jsonb(v_old), '{}'::jsonb);

  delete from public.lectures where id = p_lecture_id;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', p_lecture_id));
end;
$$;

revoke all on function public.management_delete_lecture(bigint) from public, anon, authenticated;
grant execute on function public.management_delete_lecture(bigint) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;

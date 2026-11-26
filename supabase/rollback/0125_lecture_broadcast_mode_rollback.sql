-- 0125_lecture_broadcast_mode_rollback.sql
begin;
drop function if exists public.management_add_lecture(bigint,text,text,text,timestamptz,integer,text,text,text,text);
create or replace function public.management_add_lecture(
  p_course_id bigint, p_title text, p_description text default null,
  p_lecture_type text default 'direct', p_scheduled_at timestamptz default null,
  p_duration_min integer default 120, p_youtube_url text default null,
  p_live_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid bigint := public.current_user_id();
  v_id  bigint;
begin
  if v_uid is null or not public.is_owner()
     or not exists (select 1 from public.courses where id = p_course_id) then
    return jsonb_build_object('ok', false, 'error', 'not allowed');
  end if;
  if nullif(btrim(coalesce(p_title, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'عنوان المحاضرة مطلوب');
  end if;
  if p_lecture_type not in ('direct', 'online', 'recorded') then
    return jsonb_build_object('ok', false, 'error', 'نوع المحاضرة غير صالح');
  end if;
  insert into public.lectures (course_id, title, description, lecture_type, scheduled_at,
                               duration_min, youtube_url, live_url, status)
  values (p_course_id, btrim(p_title), nullif(btrim(coalesce(p_description, '')), ''),
          p_lecture_type, p_scheduled_at, coalesce(p_duration_min, 120),
          nullif(btrim(coalesce(p_youtube_url, '')), ''),
          nullif(btrim(coalesce(p_live_url, '')), ''), 'scheduled')
  returning id into v_id;
  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
  values (v_uid, 'management_add_lecture', 'lectures', v_id, jsonb_build_object('course_id', p_course_id));
  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', v_id));
end;
$$;
revoke all on function public.management_add_lecture(bigint,text,text,text,timestamptz,integer,text,text,text,text) from public, anon, authenticated;
revoke all on function public.management_add_lecture(bigint,text,text,text,timestamptz,integer,text,text) from public, anon, authenticated;
grant execute on function public.management_add_lecture(bigint,text,text,text,timestamptz,integer,text,text) to authenticated, service_role;
notify pgrst, 'reload schema';
commit;
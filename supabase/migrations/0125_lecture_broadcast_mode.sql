-- ============================================================
-- 0125_lecture_broadcast_mode.sql
-- تفعيل قواعد بث المحاضرات (0005) في دالة إدارة المحاضرات:
--   broadcast_mode in ('internal','youtube','meet') or null
--   broadcast_media in ('audio','video','both') or null
-- لا تغيير في البيانات (broadcast_mode/media يبقيان null للمحاضرات القديمة).
-- ============================================================

begin;

create or replace function public.management_add_lecture(
  p_course_id bigint, p_title text, p_description text default null,
  p_lecture_type text default 'direct', p_scheduled_at timestamptz default null,
  p_duration_min integer default 120, p_youtube_url text default null,
  p_live_url text default null,
  p_broadcast_mode text default null,
  p_broadcast_media text default null
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
  if p_broadcast_mode is not null
     and p_broadcast_mode not in ('internal', 'youtube', 'meet') then
    return jsonb_build_object('ok', false, 'error', 'وضع البث غير صالح');
  end if;
  if p_broadcast_media is not null
     and p_broadcast_media not in ('audio', 'video', 'both') then
    return jsonb_build_object('ok', false, 'error', 'وسائط البث غير صالحة');
  end if;

  insert into public.lectures (course_id, title, description, lecture_type, scheduled_at,
                               duration_min, youtube_url, live_url, status,
                               broadcast_mode, broadcast_media)
  values (p_course_id, btrim(p_title), nullif(btrim(coalesce(p_description, '')), ''),
          p_lecture_type, p_scheduled_at, coalesce(p_duration_min, 120),
          nullif(btrim(coalesce(p_youtube_url, '')), ''),
          nullif(btrim(coalesce(p_live_url, '')), ''), 'scheduled',
          p_broadcast_mode, p_broadcast_media)
  returning id into v_id;

  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
  values (v_uid, 'management_add_lecture', 'lectures', v_id,
          jsonb_build_object('course_id', p_course_id,
                             'broadcast_mode', p_broadcast_mode,
                             'broadcast_media', p_broadcast_media));

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', v_id));
end;
$$;

revoke all on function public.management_add_lecture(bigint,text,text,text,timestamptz,integer,text,text,text,text) from public, anon, authenticated;
grant execute on function public.management_add_lecture(bigint,text,text,text,timestamptz,integer,text,text,text,text) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
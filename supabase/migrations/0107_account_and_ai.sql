-- 0107_account_and_ai.sql
-- صفحة «حسابي» + صفحة «المساعد الذكي»:
--   • تحديث الملف الشخصي وتحديث علم تغيير كلمة المرور عبر RPC مضبوط
--   • تفضيلات إشعارات حقيقية تُطبَّق على my_notifications()
--   • محادثات الذكاء الاصطناعي: جداول وRPCs آمنة + إعدادات عامة بدون مفتاح

begin;

-- ---------------------------------------------------------------------------
-- 1) الملف الشخصي
-- ---------------------------------------------------------------------------
create or replace function public.update_my_profile(
  p_name text,
  p_email text,
  p_phone text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid bigint := public.current_user_id();
  v_name text := btrim(coalesce(p_name, ''));
  v_email text := nullif(btrim(coalesce(p_email, '')), '');
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if length(v_name) < 2 or length(v_name) > 120 then
    raise exception 'invalid name';
  end if;
  if v_email is not null and (length(v_email) > 200 or position('@' in v_email) = 0) then
    raise exception 'invalid email';
  end if;
  if v_phone is not null and length(v_phone) > 40 then
    raise exception 'invalid phone';
  end if;

  update public.users
     set name = v_name,
         email = v_email,
         phone = v_phone
   where id = v_uid;
end;
$$;

create or replace function public.mark_password_changed()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid bigint := public.current_user_id();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  update public.users set must_change_password = false where id = v_uid;
end;
$$;

-- قراءة مضبوطة للملف بعد التعديل؛ السياسة العامة على users لا تُستخدم هنا.
create or replace function public.my_profile()
returns table (
  id bigint, role text, name text, email text, phone text,
  platform_id text, university_id text, level text,
  job_position text, is_staff boolean, must_change_password boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.role, u.name, u.email, u.phone, u.platform_id,
         u.university_id, u.level, u.position as job_position, u.is_staff, u.must_change_password
  from public.users u
  where u.id = public.current_user_id();
$$;

-- إحصاءات حقيقية للبطاقة الجانبية في «حسابي».
create or replace function public.my_account_stats()
returns table (courses_count bigint, unread_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  with me as (select public.current_user_id() as uid)
  select
    case
      when public.is_student() then (
        select count(*) from public.enrollments e, me
        where e.student_id = me.uid and e.status = 'active'
      )
      else (
        select count(*) from public.courses c, me
        where c.teacher_id = me.uid and coalesce(c.archived, false) = false
      )
    end,
    (
      select count(*)
      from public.notifications n, me
      where n.audience = 'all'
         or n.user_id = me.uid
         or (n.audience = 'course' and public.can_see_course_notification(n.course_id))
    )
    - (
      select count(*)
      from public.notification_reads r, me
      where r.user_id = me.uid
        and (r.read_at is not null or r.dismissed_at is not null)
    )
  from me;
$$;

revoke all on function public.update_my_profile(text, text, text) from public, anon;
revoke all on function public.mark_password_changed() from public, anon;
revoke all on function public.my_profile() from public, anon;
revoke all on function public.my_account_stats() from public, anon;
grant execute on function public.update_my_profile(text, text, text) to authenticated;
grant execute on function public.mark_password_changed() to authenticated;
grant execute on function public.my_profile() to authenticated;
grant execute on function public.my_account_stats() to authenticated;

-- ---------------------------------------------------------------------------
-- 2) تفضيلات الإشعارات
--    الغياب = مفعّل افتراضياً؛ الصف يُنشأ فقط عند تعطيل فئة أو إعادة تفعيلها.
-- ---------------------------------------------------------------------------
create table if not exists public.user_notification_prefs (
  user_id    bigint not null references public.users(id) on delete cascade,
  category   text not null check (category in ('announcement','course','exam','assignment','message','system','grade')),
  enabled    boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);

alter table public.user_notification_prefs enable row level security;
revoke all on public.user_notification_prefs from public, anon, authenticated;

create or replace function public.my_notification_preferences()
returns table (category text, enabled boolean)
language sql
stable
security definer
set search_path = public
as $$
  with me as (select public.current_user_id() as uid),
       cats(category) as (
         values ('announcement'), ('course'), ('exam'), ('assignment'),
                ('message'), ('system'), ('grade')
       )
  select cats.category, coalesce(p.enabled, true)
  from cats
  cross join me
  left join public.user_notification_prefs p
    on p.user_id = me.uid and p.category = cats.category;
$$;

create or replace function public.set_notification_preference(p_category text, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid bigint := public.current_user_id();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_category not in ('announcement','course','exam','assignment','message','system','grade') then
    raise exception 'invalid category';
  end if;

  insert into public.user_notification_prefs (user_id, category, enabled, updated_at)
  values (v_uid, p_category, coalesce(p_enabled, true), now())
  on conflict (user_id, category)
  do update set enabled = excluded.enabled, updated_at = now();
end;
$$;

revoke all on function public.my_notification_preferences() from public, anon;
revoke all on function public.set_notification_preference(text, boolean) from public, anon;
grant execute on function public.my_notification_preferences() to authenticated;
grant execute on function public.set_notification_preference(text, boolean) to authenticated;

-- تطبيق التفضيلات داخل خلاصة الإشعارات الحالية.
create or replace function public.my_notifications()
returns table (
  id           bigint,
  type         text,
  title        text,
  body         text,
  link         text,
  audience     text,
  course_id    bigint,
  course_title text,
  creator_name text,
  created_at   timestamptz,
  is_read      boolean,
  is_starred   boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    n.id,
    n.type,
    n.title,
    n.body,
    n.link,
    n.audience,
    n.course_id,
    c.title as course_title,
    coalesce(u.name, 'إدارة الأكاديمية') as creator_name,
    n.created_at,
    (r.read_at is not null) as is_read,
    coalesce(r.starred, false) as is_starred
  from public.notifications n
  left join public.notification_reads r
    on r.notification_id = n.id
   and r.user_id = public.current_user_id()
  left join public.courses c on c.id = n.course_id
  left join public.users u on u.id = n.created_by
  where public.current_user_id() is not null
    and r.dismissed_at is null
    and not exists (
      select 1 from public.user_notification_prefs p
      where p.user_id = public.current_user_id()
        and p.category = n.type
        and p.enabled = false
    )
    and (
      public.is_owner()
      or public.is_assistant()
      or n.audience = 'all'
      or (n.audience = 'user' and n.user_id = public.current_user_id())
      or (n.audience = 'course' and public.can_see_course_notification(n.course_id))
    )
  order by n.created_at desc;
$$;

revoke all on function public.my_notifications() from public, anon;
grant execute on function public.my_notifications() to authenticated;

-- ---------------------------------------------------------------------------
-- 3) محادثات المساعد الذكي
--    البيانات تُكتب عبر RPCs أو عبر Edge Function بصلاحية service_role؛
--    لا تمنح السياسات كتابة مباشرة للمستخدمين.
-- ---------------------------------------------------------------------------
create table if not exists public.ai_conversations (
  id         bigint generated by default as identity primary key,
  user_id    bigint not null references public.users(id) on delete cascade,
  title      text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_conversations_user_idx
  on public.ai_conversations (user_id, updated_at desc);

alter table public.ai_conversations enable row level security;
revoke all on public.ai_conversations from public, anon, authenticated;

alter table public.ai_messages
  add column if not exists conversation_id bigint
  references public.ai_conversations(id) on delete cascade;

create index if not exists ai_messages_conversation_idx
  on public.ai_messages (conversation_id, created_at);

create or replace function public.ai_conversations()
returns table (
  id           bigint,
  title        text,
  created_at   timestamptz,
  updated_at   timestamptz,
  last_message text,
  message_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.title,
    c.created_at,
    c.updated_at,
    coalesce((
      select m.content from public.ai_messages m
      where m.conversation_id = c.id
      order by m.created_at desc, m.id desc
      limit 1
    ), '') as last_message,
    (select count(*) from public.ai_messages m where m.conversation_id = c.id) as message_count
  from public.ai_conversations c
  where c.user_id = public.current_user_id()
  order by c.updated_at desc;
$$;

create or replace function public.ai_conversation_messages(p_conversation_id bigint)
returns table (id bigint, role text, content text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.role, m.content, m.created_at
  from public.ai_messages m
  join public.ai_conversations c on c.id = m.conversation_id
  where m.conversation_id = p_conversation_id
    and c.user_id = public.current_user_id()
  order by m.created_at, m.id;
$$;

create or replace function public.ai_create_conversation(p_title text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid bigint := public.current_user_id();
  v_title text := btrim(coalesce(p_title, ''));
  v_id bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if v_title = '' then
    v_title := 'محادثة جديدة';
  end if;
  insert into public.ai_conversations (user_id, title)
  values (v_uid, left(v_title, 80))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.ai_append_user_message(
  p_conversation_id bigint,
  p_content text
)
returns table (id bigint, role text, content text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid bigint := public.current_user_id();
  v_body text := btrim(coalesce(p_content, ''));
  v_id bigint;
  v_role text;
  v_content text;
  v_created timestamptz;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if v_body = '' or length(v_body) > 8000 then
    raise exception 'invalid message';
  end if;
  if not exists (
    select 1 from public.ai_conversations c
    where c.id = p_conversation_id and c.user_id = v_uid
  ) then
    raise exception 'conversation not found';
  end if;

  insert into public.ai_messages (user_id, conversation_id, role, content)
  values (v_uid, p_conversation_id, 'user', v_body)
  returning ai_messages.id, ai_messages.role, ai_messages.content, ai_messages.created_at
    into v_id, v_role, v_content, v_created;

  update public.ai_conversations
     set updated_at = now()
   where ai_conversations.id = p_conversation_id;

  return query select v_id, v_role, v_content, v_created;
end;
$$;

create or replace function public.ai_delete_last_assistant_message(p_conversation_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid bigint := public.current_user_id();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if not exists (
    select 1 from public.ai_conversations c
    where c.id = p_conversation_id and c.user_id = v_uid
  ) then
    raise exception 'conversation not found';
  end if;

  delete from public.ai_messages m
  where m.id = (
    select m2.id from public.ai_messages m2
    where m2.conversation_id = p_conversation_id and m2.role = 'assistant'
    order by m2.created_at desc, m2.id desc
    limit 1
  );
end;
$$;

create or replace function public.ai_delete_conversation(p_conversation_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid bigint := public.current_user_id();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  delete from public.ai_conversations
  where id = p_conversation_id and user_id = v_uid;
end;
$$;

create or replace function public.ai_clear_history()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid bigint := public.current_user_id();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  delete from public.ai_conversations where user_id = v_uid;
end;
$$;

-- إعدادات عامة: لا يُعرض مفتاح API أبداً.
create or replace function public.ai_public_settings()
returns table (provider text, model text, enabled boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select value from public.settings where key = 'ai_provider'), 'gemini'),
    coalesce((select value from public.settings where key = 'ai_model'), 'gemini-2.5-flash'),
    coalesce(length(coalesce((select value from public.settings where key = 'ai_api_key'), '')) > 0, false);
$$;

revoke all on function public.ai_conversations() from public, anon;
revoke all on function public.ai_conversation_messages(bigint) from public, anon;
revoke all on function public.ai_create_conversation(text) from public, anon;
revoke all on function public.ai_append_user_message(bigint, text) from public, anon;
revoke all on function public.ai_delete_last_assistant_message(bigint) from public, anon;
revoke all on function public.ai_delete_conversation(bigint) from public, anon;
revoke all on function public.ai_clear_history() from public, anon;
revoke all on function public.ai_public_settings() from public, anon;

grant execute on function public.ai_conversations() to authenticated;
grant execute on function public.ai_conversation_messages(bigint) to authenticated;
grant execute on function public.ai_create_conversation(text) to authenticated;
grant execute on function public.ai_append_user_message(bigint, text) to authenticated;
grant execute on function public.ai_delete_last_assistant_message(bigint) to authenticated;
grant execute on function public.ai_delete_conversation(bigint) to authenticated;
grant execute on function public.ai_clear_history() to authenticated;
grant execute on function public.ai_public_settings() to authenticated;

notify pgrst, 'reload schema';

commit;

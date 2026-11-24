-- 0105_library.sql
-- مكتبة قانونية: مفضلة لكل مستخدم + صلاحيات إدارة (مالك/مساعد) + مخزن ملفات خاص.
-- القراءة متاحة لكل مستخدم نشط (السياسات موجودة في 0101). لا يوجد تحميل: معاينة فقط.

begin;

-- ---------------------------------------------------------------------------
-- 1) المفضلة (لكل مستخدم)
-- ---------------------------------------------------------------------------
create table if not exists public.library_favorites (
  user_id    bigint not null references public.users(id) on delete cascade,
  item_id    bigint not null references public.library_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

alter table public.library_favorites enable row level security;

grant select, insert, delete on public.library_favorites to authenticated;

drop policy if exists library_favorites_select on public.library_favorites;
create policy library_favorites_select on public.library_favorites
  for select to authenticated
  using (user_id = public.current_user_id());

drop policy if exists library_favorites_insert on public.library_favorites;
create policy library_favorites_insert on public.library_favorites
  for insert to authenticated
  with check (user_id = public.current_user_id());

drop policy if exists library_favorites_delete on public.library_favorites;
create policy library_favorites_delete on public.library_favorites
  for delete to authenticated
  using (user_id = public.current_user_id());

-- ---------------------------------------------------------------------------
-- 2) صلاحيات الإدارة (المالك + المساعد الإداري)
-- ---------------------------------------------------------------------------
grant insert, update, delete on public.library_sections, public.library_items to authenticated;
grant usage, select on sequence public.library_sections_id_seq, public.library_items_id_seq to authenticated;

drop policy if exists library_sections_manage on public.library_sections;
create policy library_sections_manage on public.library_sections
  for all to authenticated
  using (public.is_owner() or public.is_assistant())
  with check (public.is_owner() or public.is_assistant());

drop policy if exists library_items_manage on public.library_items;
create policy library_items_manage on public.library_items
  for all to authenticated
  using (public.is_owner() or public.is_assistant())
  with check (public.is_owner() or public.is_assistant());

-- ---------------------------------------------------------------------------
-- 3) مخزن ملفات المكتبة (خاص) — قراءة للمستخدمين النشطين، كتابة للإدارة
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('library', 'library', false)
on conflict (id) do nothing;

drop policy if exists library_files_read on storage.objects;
create policy library_files_read on storage.objects
  for select to authenticated
  using (bucket_id = 'library' and public.is_active_user());

drop policy if exists library_files_insert on storage.objects;
create policy library_files_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'library' and (public.is_owner() or public.is_assistant()));

drop policy if exists library_files_update on storage.objects;
create policy library_files_update on storage.objects
  for update to authenticated
  using (bucket_id = 'library' and (public.is_owner() or public.is_assistant()))
  with check (bucket_id = 'library' and (public.is_owner() or public.is_assistant()));

drop policy if exists library_files_delete on storage.objects;
create policy library_files_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'library' and (public.is_owner() or public.is_assistant()));

notify pgrst, 'reload schema';

commit;

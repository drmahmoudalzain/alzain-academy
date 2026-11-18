-- إنشاء حاوية التخزين للملفات (خاصة، الوصول عبر signed URLs)
insert into storage.buckets (id, name, public)
values ('platform-files', 'platform-files', false)
on conflict (id) do nothing;

select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

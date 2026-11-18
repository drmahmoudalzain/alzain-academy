select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

select count(*)::int as settings_rows from public.settings;
select count(*)::int as library_sections_rows from public.library_sections;
select count(*)::int as rls_enabled_tables
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity;

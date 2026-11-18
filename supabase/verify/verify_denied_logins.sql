select
  count(*)::int as denied_count,
  json_agg(json_build_object(
    'label', label,
    'identifier', data->>'identifier',
    'portal', data->>'portal',
    'ip', data->>'ip',
    'at', data->>'at'
  ) order by archived_at desc) filter (where true) as rows
from public.archived_records
where table_name = 'login_denied';

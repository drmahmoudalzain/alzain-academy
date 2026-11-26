-- ============================================================
-- 0123_identity_rules.sql
-- تفعيل قواعد الهوية الموثقة في PROJECT_STATUS §2.1 من لحظة التطبيق:
--   • الدخول برمز المنصة فقط، والبريد مرفوض قبل أي تحقق من كلمة المرور.
--   • قفل تلقائي بعد 5 محاولات فاشلة متتالية لمدة 15 دقيقة، بسجل محاولات مرفوضة.
--   • الدوال للخلفية فقط (service_role)؛ لا execute لـ anon أو authenticated.
-- لا تغيير في مضمون القاعدة، ولا إعادة حساب لبيانات سابقة، ولا إتاحة للمتصفح.
-- لا يُطبَّق إلا بعد تأكيد منفصل من المالك.
-- ============================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) سجل المحاولات المرفوضة. بلا سياسات RLS: الوصول عبر service_role فقط.
-- ---------------------------------------------------------------------------
create table if not exists public.login_attempts_log (
  id           bigint generated always as identity primary key,
  identifier   text not null,
  attempted_at timestamptz not null default now(),
  reason       text not null
);

-- الفهرس يدعم التنظيف الدوري حسب العمر دون مسح الجدول كاملاً.
create index if not exists login_attempts_log_attempted_at_idx
  on public.login_attempts_log (attempted_at desc);

alter table public.login_attempts_log enable row level security;
revoke all on public.login_attempts_log from public, anon, authenticated;
grant insert on public.login_attempts_log to service_role;

-- ---------------------------------------------------------------------------
-- 2) فحص ما قبل التحقق من كلمة المرور: البريد أولاً، ثم القفل القائم.
-- ---------------------------------------------------------------------------
create or replace function public.auth_login_guard_check(p_identifier text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text := upper(btrim(coalesce(p_identifier, '')));
  v_locked_until timestamptz;
  v_minutes integer;
begin
  if position('@' in v_id) > 0 then
    return jsonb_build_object('ok', false, 'error', 'email_login_rejected');
  end if;

  if v_id = '' then
    return jsonb_build_object('ok', false, 'error', 'invalid_platform_id');
  end if;

  select u.locked_until
    into v_locked_until
    from public.users u
   where upper(u.platform_id) = v_id
   limit 1;

  if v_locked_until is not null and v_locked_until > now() then
    v_minutes := ceil(extract(epoch from (v_locked_until - now())) / 60)::integer;
    return jsonb_build_object(
      'ok', false,
      'error', 'account_locked',
      'remaining_minutes', v_minutes
    );
  end if;

  -- لا يُعاد البريد ولا أي تجزئة؛ القرار فقط.
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) تسجيل النتيجة وتطبيق قفل الـ5/15.
-- p_reason اختياري: أسباب الرفض التي ليست كلمة مرور خاطئة تُسجَّل بلا زيادة
-- عدّاد الفشل، فتبقى قاعدة 5/15 كما هي ولا يُقفل حساب بسبب رفض إداري.
-- ---------------------------------------------------------------------------
drop function if exists public.auth_record_login_attempt(text, boolean);

create or replace function public.auth_record_login_attempt(
  p_identifier text,
  p_success boolean,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text := upper(btrim(coalesce(p_identifier, '')));
  v_requested_reason text := lower(btrim(coalesce(p_reason, '')));
  v_log_reason text;
  v_user_id bigint;
  v_attempts integer;
  v_locked_until timestamptz;
begin
  if position('@' in v_id) > 0 then
    insert into public.login_attempts_log (identifier, reason)
    values (v_id, 'email_login_rejected');
    return jsonb_build_object('ok', false, 'error', 'email_login_rejected');
  end if;

  -- محاولات الرمز الواحد متسلسلة؛ القفل لا يُمدَّد أثناء المحاولة المرفوضة.
  perform pg_advisory_xact_lock(hashtext(v_id));

  select u.id, u.failed_attempts, u.locked_until
    into v_user_id, v_attempts, v_locked_until
    from public.users u
   where upper(u.platform_id) = v_id
     and u.is_active = true
   limit 1;

  if p_success then
    if v_user_id is not null then
      update public.users
         set failed_attempts = 0, locked_until = null
       where id = v_user_id;
    end if;
    return jsonb_build_object('ok', true, 'locked', false, 'failed_attempts', 0);
  end if;

  -- رفض البوابة (بريد، صيغة، إيقاف، لا بيانات دخول) يُسجَّل بالسبب المُمرَّر،
  -- حتى لو لم يكن للمعرّف مستخدم في public.users، دون لمس عدّاد الفشل.
  if v_requested_reason <> '' then
    insert into public.login_attempts_log (identifier, reason)
    values (v_id, v_requested_reason);
    return jsonb_build_object('ok', true, 'locked', false, 'failed_attempts', coalesce(v_attempts, 0));
  end if;

  if v_locked_until is not null and v_locked_until > now() then
    insert into public.login_attempts_log (identifier, reason)
    values (v_id, 'locked');
    return jsonb_build_object('ok', true, 'locked', true, 'failed_attempts', coalesce(v_attempts, 0));
  end if;

  v_log_reason := case when v_user_id is null then 'invalid_identifier' else 'invalid_credentials' end;
  insert into public.login_attempts_log (identifier, reason)
  values (v_id, v_log_reason);

  if v_user_id is null then
    return jsonb_build_object('ok', true, 'locked', false, 'failed_attempts', 0);
  end if;

  update public.users
     set failed_attempts = coalesce(failed_attempts, 0) + 1,
         locked_until = case when coalesce(failed_attempts, 0) + 1 >= 5 then now() + interval '15 minutes' else locked_until end
   where id = v_user_id
  returning failed_attempts into v_attempts;

  if v_attempts >= 5 then
    insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
    values (
      v_user_id, 'login_locked', 'users', v_user_id,
      jsonb_build_object('failed_attempts', v_attempts, 'lock_minutes', 15)
    );
    return jsonb_build_object(
      'ok', true,
      'locked', true,
      'failed_attempts', v_attempts,
      'remaining_minutes', 15
    );
  end if;

  return jsonb_build_object('ok', true, 'locked', false, 'failed_attempts', v_attempts);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) الصلاحيات: الدالتان للخلفية وحدها.
-- ---------------------------------------------------------------------------
revoke all on function public.auth_login_guard_check(text) from public, anon, authenticated;
revoke all on function public.auth_record_login_attempt(text, boolean, text) from public, anon, authenticated;
grant execute on function public.auth_login_guard_check(text) to service_role;
grant execute on function public.auth_record_login_attempt(text, boolean, text) to service_role;

notify pgrst, 'reload schema';

commit;

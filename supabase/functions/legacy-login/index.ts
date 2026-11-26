// Edge Function: legacy-login
// أول دخول الطالب القديم بعد نقل المصادقة إلى Supabase Auth:
//   1) يتحقق من كلمة المرور عبر scrypt على public.users.password_hash (نفس التحقق في src/lib/password.js).
//   2) ينشئ حساب auth.users جديدًا (أو يستخدم الحساب الموجود بكلمة مناسبة).
//   3) يربط public.users.auth_id ب auth.users.id.
//   4) يجيب على العميل، ثم يستدعي signInWithPassword بهذه الكلمة نفسها.
//
// لا تُخزَّن كلمة المرور في هذا المحرّك؛ فقط يُتحقق منها على التخزين.
// Request: { platformId: string, password: string }
// Response: { ok: true, auth_user_id: string } | { ok: false, error: string }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import crypto from 'node:crypto'
import { Buffer } from 'node:buffer'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

const SCHEME = 'scrypt';
const N = 16384;
const R = 8;
const P = 1;
const MAX_MEM = 64 * 1024 * 1024;

function verifyScrypt(password: string, stored: string): boolean {
  try {
    if (typeof stored !== 'string') return false;
    const parts = stored.split('$');
    if (parts.length !== 6) return false;
    const [scheme, nStr, rStr, pStr, saltPart, hashPart] = parts;
    if (scheme !== SCHEME) return false;
    const n = Number(nStr);
    const r = Number(rStr);
    const p = Number(pStr);
    if (!n || !r || !p) return false;
    const salt = Buffer.from(saltPart, 'hex');
    const expected = Buffer.from(hashPart, 'hex');
    if (salt.length === 0 || expected.length === 0) return false;
    const actual = crypto.scryptSync(password, salt, expected.length, { N: n, r, p, maxmem: MAX_MEM });
    if (actual.length !== expected.length) return false;
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function errorResponse(error: string) {
  return json(200, { ok: false, error });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });

  try {
  let body: { platformId?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, error: 'invalid_json' });
  }

  const platformId = String(body.platformId ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');

  if (!password) {
    return errorResponse('missing_password');
  }

  const admin = createClient<never>(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // 0123: البريد والقفل يُرفضان هنا قبل قراءة التجزئة أو التحقق منها.
  const { data: guardData, error: guardError } = await admin.rpc('auth_login_guard_check', {
    p_identifier: platformId,
  });
  if (guardError) return errorResponse('login_guard_unavailable');
  const guard = (guardData ?? null) as
    | { ok?: boolean; error?: string; remaining_minutes?: number }
    | null;
  if (guard?.ok === false) {
    const error = guard.error === 'account_locked'
      ? `account_locked:${Number(guard.remaining_minutes ?? 15)}`
      : String(guard.error ?? 'login_rejected');
    return errorResponse(error);
  }
  if (guard?.ok !== true) return errorResponse('login_guard_failed');

  // بعد رفض البريد والقفل فقط تُفحص صيغة الرمز.
  if (!/^[a-z]{2}[0-9]{3,4}$/.test(platformId)) {
    return errorResponse('invalid_platform_id');
  }

  const { data: usersData, error: usersError } = await admin
    .from('users')
    .select('id, role, name, platform_id, password_hash, is_active')
    .ilike('platform_id', platformId)
    .limit(1)
    .maybeSingle();

  const user = (usersData ?? null) as
    | { id: number; role: string; name: string; platform_id: string | null; password_hash: string | null; is_active: boolean }
    | null;
  if (usersError) return errorResponse('db_error');
  if (!user) {
    const { error: recordError } = await admin.rpc('auth_record_login_attempt', {
      p_identifier: platformId,
      p_success: false,
    });
    if (recordError) return errorResponse('attempt_log_failed');
    return errorResponse('invalid_credentials');
  }
  if (!user.is_active) return errorResponse('account_suspended');
  if (!user.password_hash) return errorResponse('no_legacy_password');

  if (!verifyScrypt(password, user.password_hash)) {
    const { data: attemptData, error: recordError } = await admin.rpc('auth_record_login_attempt', {
      p_identifier: platformId,
      p_success: false,
    });
    if (recordError) return errorResponse('attempt_log_failed');
    const attempt = (attemptData ?? null) as { locked?: boolean } | null;
    return errorResponse(attempt?.locked === true ? 'account_locked' : 'invalid_credentials');
  }

  const { error: successRecordError } = await admin.rpc('auth_record_login_attempt', {
    p_identifier: platformId,
    p_success: true,
  });
  if (successRecordError) return errorResponse('attempt_log_failed');

  const domain = user.role === 'student' ? 'students.local' : 'staff.local';
  const authEmail = `${platformId}@${domain}`;

  let authUserId: string;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: true,
    app_metadata: { academy_user_id: user.id, role: user.role },
    user_metadata: { full_name: user.name, platform_id: user.platform_id },
  });

  if (createError) {
    const msg = String(createError.message ?? '');
    if (/already|registered|exists/i.test(msg)) {
      authUserId = await findAuthUserByEmail(admin, authEmail);
      if (!authUserId) return errorResponse('auth_lookup_failed');
    } else {
      return errorResponse('auth_create_failed');
    }
  } else if (created?.user) {
    authUserId = created.user.id;
  } else {
    return errorResponse('auth_create_failed');
  }

  const { error: linkError } = await admin.from('users').update({ auth_id: authUserId }).eq('id', user.id);
  if (linkError) return errorResponse('link_failed');

  return json(200, { ok: true, auth_user_id: authUserId });
  } catch {
    return errorResponse('internal_error');
  }
});

async function findAuthUserByEmail(admin: ReturnType<typeof createClient>, email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return null;
    const users = (data as { users?: Array<{ id: string; email?: string }> } | null)?.users ?? [];
    const found = users.find((u) => String(u.email ?? '').toLowerCase() === email.toLowerCase());
    if (found) return found.id;
    if (users.length < 200) return null;
  }
  return null;
}

// Edge Function: academy-login
// المسار الوحيد لتسجيل الدخول من المتصفح. كل التحقق من الهوية والقفل وكلمة المرور
// يحدث هنا على الخادم؛ المتصفح لا يحصل إلا على جلسة Supabase Auth بعد النجاح.
//
// Request:  { platformId: string, password: string }
// Response: { ok: true, access_token, refresh_token, expires_in }
//        |  { ok: false, error: string }
//
// مفتاح service_role يُقرأ من متغيرات البيئة داخل الدالة فقط، ولا يُرسل للعميل.

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

function errorResponse(error: string): Response {
  return json(200, { ok: false, error })
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

type Admin = ReturnType<typeof createClient>;

// أسباب الرفض تُسجَّل في login_attempts_log بلا زيادة عدّاد الفشل (0123).
async function recordRejection(admin: Admin, platformId: string, reason: string): Promise<string | null> {
  const { error } = await admin.rpc('auth_record_login_attempt', {
    p_identifier: platformId,
    p_success: false,
    p_reason: reason,
  });
  return error ? 'attempt_log_failed' : null;
}

async function findAuthUserByEmail(admin: Admin, email: string): Promise<string | null> {
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

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });

  let body: { platformId?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse('invalid_json');
  }

  const platformId = String(body.platformId ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');

  if (!password) return errorResponse('missing_password');

  const admin = createClient<never>(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // 0123: البريد والقفل يُرفضان هنا قبل أي بحث عن المستخدم أو تحقق من التجزئة.
  const { data: guardData, error: guardError } = await admin.rpc('auth_login_guard_check', {
    p_identifier: platformId,
  });
  if (guardError) return errorResponse('login_guard_unavailable');
  const guard = (guardData ?? null) as
    | { ok?: boolean; error?: string; remaining_minutes?: number }
    | null;
  if (guard?.ok === false) {
    const guardReason = String(guard.error ?? 'login_rejected');
    if (guardReason === 'account_locked') {
      return errorResponse(`account_locked:${Number(guard.remaining_minutes ?? 15)}`);
    }
    const reason = guardReason === 'email_login_rejected' ? 'email_login_rejected' : 'invalid_platform_id';
    const rejectionError = await recordRejection(admin, platformId, reason);
    if (rejectionError) return errorResponse(rejectionError);
    return errorResponse(reason);
  }
  if (guard?.ok !== true) return errorResponse('login_guard_failed');

  // بعد رفض البريد والقفل فقط تُفحص صيغة الرمز.
  if (!/^[a-z]{2}[0-9]{3,4}$/.test(platformId)) {
    const rejectionError = await recordRejection(admin, platformId, 'invalid_platform_id');
    if (rejectionError) return errorResponse(rejectionError);
    return errorResponse('invalid_platform_id');
  }

  const { data: usersData, error: usersError } = await admin
    .from('users')
    .select('id, role, name, platform_id, password_hash, auth_id, is_active')
    .ilike('platform_id', platformId)
    .limit(1)
    .maybeSingle();

  const user = (usersData ?? null) as
    | {
        id: number;
        role: string;
        name: string;
        platform_id: string | null;
        password_hash: string | null;
        auth_id: string | null;
        is_active: boolean;
      }
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
  if (!user.is_active) {
    const rejectionError = await recordRejection(admin, platformId, 'account_suspended');
    if (rejectionError) return errorResponse(rejectionError);
    return errorResponse('account_suspended');
  }

  let authEmail: string;

  if (user.auth_id) {
    // حساب مرتبط بـ Auth: كلمة المرور الحالية في Auth هي المرجع، ولو بقيت تجزئة قديمة
    // بعد تغيير كلمة المرور (0107 لا تمسح password_hash).
    const { data: authData, error: authError } = await admin.auth.admin.getUserById(String(user.auth_id));
    if (!authError && authData?.user?.email) {
      authEmail = String(authData.user.email);

      const { data: authSession, error: authSignInError } = await admin.auth.signInWithPassword({
        email: authEmail,
        password,
      });
      if (authSignInError || !authSession?.session) {
        // فشل كلمة مرور Auth يُسجَّل ولا يسمح أبدًا بالرجوع إلى التجزئة القديمة.
        const { data: attemptData, error: recordError } = await admin.rpc('auth_record_login_attempt', {
          p_identifier: platformId,
          p_success: false,
        });
        if (recordError) return errorResponse('attempt_log_failed');
        const attempt = (attemptData ?? null) as { locked?: boolean; remaining_minutes?: number } | null;
        return errorResponse(
          attempt?.locked === true
            ? `account_locked:${Number(attempt.remaining_minutes ?? 15)}`
            : 'invalid_credentials',
        );
      }

      const { error: successRecordError } = await admin.rpc('auth_record_login_attempt', {
        p_identifier: platformId,
        p_success: true,
      });
      if (successRecordError) return errorResponse('attempt_log_failed');

      return json(200, {
        ok: true,
        access_token: authSession.session.access_token,
        refresh_token: authSession.session.refresh_token,
        expires_in: authSession.session.expires_in,
      });
    }

    // تعذّر حل بريد Auth: التجزئة القديمة هي البديل الوحيد إن وُجدت.
    if (!user.password_hash) {
      const rejectionError = await recordRejection(admin, platformId, 'no_usable_credential');
      if (rejectionError) return errorResponse(rejectionError);
      return errorResponse('no_usable_credential');
    }
  }

  if (user.password_hash) {
    // حساب قديم: التجزئة في public.users؛ التحقق هنا قبل إنشاء/ربط حساب Auth.
    if (!verifyScrypt(password, user.password_hash)) {
      const { data: attemptData, error: recordError } = await admin.rpc('auth_record_login_attempt', {
        p_identifier: platformId,
        p_success: false,
      });
      if (recordError) return errorResponse('attempt_log_failed');
      const attempt = (attemptData ?? null) as { locked?: boolean; remaining_minutes?: number } | null;
      return errorResponse(
        attempt?.locked === true
          ? `account_locked:${Number(attempt.remaining_minutes ?? 15)}`
          : 'invalid_credentials',
      );
    }

    authEmail = `${platformId}@${user.role === 'student' ? 'students.local' : 'staff.local'}`;

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
        const found = await findAuthUserByEmail(admin, authEmail);
        if (!found) return errorResponse('auth_lookup_failed');
        authUserId = found;
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
  } else {
    const rejectionError = await recordRejection(admin, platformId, 'no_usable_credential');
    if (rejectionError) return errorResponse(rejectionError);
    return errorResponse('no_usable_credential');
  }

  // تسجيل الدخول نفسه يتم على الخادم؛ المتصفح لا يرى سوى الجلسة الناتجة.
  const { data: sessionData, error: signInError } = await admin.auth.signInWithPassword({
    email: authEmail,
    password,
  });
  if (signInError || !sessionData?.session) return errorResponse('invalid_credentials');

  // النجاح يُسجَّل بعد الدخول الفعلي، فيُصفَّر عدّاد الفشل والقفل.
  const { error: successRecordError } = await admin.rpc('auth_record_login_attempt', {
    p_identifier: platformId,
    p_success: true,
  });
  if (successRecordError) return errorResponse('attempt_log_failed');

  return json(200, {
    ok: true,
    access_token: sessionData.session.access_token,
    refresh_token: sessionData.session.refresh_token,
    expires_in: sessionData.session.expires_in,
  });
});

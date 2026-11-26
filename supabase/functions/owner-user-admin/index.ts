// Edge Function: owner-user-admin
// عمليات Supabase Auth الخاصة بإدارة المالك فقط.
// يتحقق من JWT المالك ثم من حارس is_owner_by_auth_uid قبل أي عملية.
// بيانات المنصة تُكتب دائماً بتوكن المالك الأصلي (client) لا بصلاحية service_role.
// الطلب: { op, ... }. الاستجابة: { ok: true, data } | { ok: false, error, code }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Profile = {
  id: number
  auth_id: string | null
  platform_id: string | null
  role: string
  name: string
  is_active: boolean
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function fail(error: string, code = error, status = 200): Response {
  return json(status, { ok: false, error, code })
}

function authEmail(platformId: string | null, role: string): string {
  return `${String(platformId ?? '').toLowerCase()}@${role === 'student' ? 'students.local' : 'staff.local'}`
}

async function loadProfile(data: any, userId: number): Promise<Profile | null> {
  const { data: row, error } = await data
    .from('users')
    .select('id, auth_id, platform_id, role, name, is_active')
    .eq('id', userId)
    .maybeSingle()
  if (error || !row) return null
  return row as Profile
}

function authMetadata(profile: Pick<Profile, 'id' | 'role' | 'platform_id'>) {
  return {
    academy_user_id: profile.id,
    academy_role: profile.role,
    platform_id: profile.platform_id,
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return fail('method_not_allowed', 'method_not_allowed', 405)

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !anonKey || !serviceKey) return fail('server_not_configured', 'server_not_configured', 500)

  let body: Record<string, any>
  try {
    body = await req.json()
  } catch {
    return fail('invalid_json')
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return fail('not_allowed', 'not_authenticated')

  const authOptions = { auth: { autoRefreshToken: false, persistSession: false } }
  const anon = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader, apikey: anonKey } },
    ...authOptions,
  })
  const { data: claimed, error: verifyError } = await anon.auth.getUser(token)
  if (verifyError || !claimed?.user) return fail('not_allowed', 'not_authenticated')

  const admin = createClient(url, serviceKey, authOptions)
  const { data: allowed, error: guardError } = await admin.rpc('is_owner_by_auth_uid', {
    p_auth_uid: claimed.user.id,
  })
  if (guardError || allowed !== true) return fail('not_allowed')

  const data = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader, apikey: anonKey } },
    ...authOptions,
  })

  switch (body.op) {
    case "create": {
      const platformId = String(body.platform_id ?? '').toUpperCase()
      const role = String(body.role ?? '')
      const password = String(body.password ?? '')
      if (!platformId || !password || !['teacher', 'assistant', 'student'].includes(role)) {
        return fail('invalid_payload')
      }
      const email = authEmail(platformId, role)
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { academy_role: role, platform_id: platformId },
        user_metadata: { full_name: String(body.name ?? ''), platform_id: platformId },
      })
      if (created.error || !created.data.user) return fail('auth_create_failed')

      const authUserId = created.data.user.id
      const profile = await data.rpc('management_create_user_profile', {
        p_auth_id: authUserId,
        p_platform_id: platformId,
        p_name: String(body.name ?? ''),
        p_email: body.email ? String(body.email).trim() : null,
        p_phone: body.phone ?? null,
        p_role: role,
        p_track: body.track ?? null,
        p_level: body.level ?? null,
        p_university_id: body.university_id ?? null,
        p_gender: body.gender ?? null,
        p_position: body.position ?? null,
      })
      if (profile.error || !profile.data?.ok) {
        await admin.auth.admin.deleteUser(authUserId)
        return fail(String(profile.data?.error ?? profile.error?.message ?? 'profile_create_failed'))
      }
      return json(200, {
        ok: true,
        data: { ...profile.data.data, auth_user_id: authUserId, auth_email: email },
      })
    }

    case "reset_password": {
      const userId = Number(body.user_id)
      const password = String(body.password ?? '')
      if (!userId || !password) return fail('invalid_payload')
      const profile = await loadProfile(data, userId)
      if (!profile) return fail('user_not_found')
      if (!profile.auth_id) return fail('no_auth_account', 'ensure_auth_required')

      const updated = await admin.auth.admin.updateUserById(profile.auth_id, {
        password,
        app_metadata: authMetadata(profile),
      })
      if (updated.error) return fail('auth_update_failed')
      const flagged = await data.rpc('management_flag_password_change', { p_user_id: userId, p_value: true })
      if (flagged.error || !flagged.data?.ok) return fail('flag_failed')
      return json(200, { ok: true, data: { id: userId, auth_user_id: profile.auth_id } })
    }

    case "ensure_auth": {
      const userId = Number(body.user_id)
      const password = String(body.password ?? '')
      if (!userId || !password) return fail('invalid_payload')
      const profile = await loadProfile(data, userId)
      if (!profile) return fail('user_not_found')
      if (profile.auth_id) return fail('auth_already_linked')

      const email = authEmail(profile.platform_id, profile.role)
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: authMetadata(profile),
        user_metadata: { full_name: profile.name, platform_id: profile.platform_id },
      })
      if (created.error || !created.data.user) return fail('auth_create_failed')

      const authUserId = created.data.user.id
      const linked = await data.rpc('management_link_auth_id', { p_user_id: userId, p_auth_id: authUserId })
      if (linked.error || !linked.data?.ok) {
        await admin.auth.admin.deleteUser(authUserId)
        return fail('auth_link_failed')
      }
      const flagged = await data.rpc('management_flag_password_change', { p_user_id: userId, p_value: true })
      if (flagged.error || !flagged.data?.ok) return fail('flag_failed')
      return json(200, { ok: true, data: { id: userId, auth_user_id: authUserId, auth_email: email } })
    }

    case "sync_auth_identity": {
      const userId = Number(body.user_id)
      if (!userId) return fail('invalid_payload')
      const profile = await loadProfile(data, userId)
      if (!profile) return fail('user_not_found')
      if (!profile.auth_id) return fail('no_auth_account', 'ensure_auth_required')

      const platformId = String(body.platform_id ?? profile.platform_id ?? '').toUpperCase()
      const role = String(body.role ?? profile.role ?? '')
      const email = authEmail(platformId, role)
      const updated = await admin.auth.admin.updateUserById(profile.auth_id, {
        email,
        app_metadata: {
          academy_user_id: profile.id,
          academy_role: role,
          platform_id: platformId,
        },
      })
      if (updated.error) return fail('auth_update_failed')
      return json(200, { ok: true, data: { id: userId, auth_email: email } })
    }

    case "set_active": {
      const userId = Number(body.user_id)
      const active = Boolean(body.active)
      if (!userId) return fail('invalid_payload')
      const profile = await loadProfile(data, userId)
      if (!profile) return fail('user_not_found')

      if (profile.auth_id) {
        const updated = await admin.auth.admin.updateUserById(profile.auth_id, {
          ban_duration: active ? 'none' : '876000h',
        })
        if (updated.error) return fail('auth_ban_failed')
      }
      const changed = await data.rpc('management_set_user_active', { p_user_id: userId, p_active: active })
      if (changed.error || !changed.data?.ok) {
        if (profile.auth_id) {
          // التراجع يعيد الحالة الأصلية = عكس المطلوب، بغض النظر عن
          // ما قرأته loadProfile بعد أن حدّث المتصفح قاعدة البيانات أولاً.
          await admin.auth.admin.updateUserById(profile.auth_id, {
            ban_duration: active ? '876000h' : 'none',
          })
        }
        return fail(String(changed.data?.error ?? changed.error?.message ?? 'activation_failed'))
      }
      return json(200, { ok: true, data: { id: userId, is_active: active } })
    }

    case "delete_user": {
      const userId = Number(body.user_id)
      if (!userId) return fail('invalid_payload')
      const preflight = await data.rpc('management_preflight_delete_user', { p_user_id: userId })
      if (preflight.error || !preflight.data?.ok) {
        return fail(String(preflight.data?.error ?? preflight.error?.message ?? 'preflight_failed'))
      }
      const blockers = preflight.data.data?.blockers ?? []
      if (blockers.length > 0) {
        return json(200, {
          ok: false,
          error: 'لا يمكن الحذف قبل إعادة إسناد المقررات أو المؤلفات',
          code: 'blockers',
          data: preflight.data.data,
        })
      }

      const profile = await loadProfile(data, userId)
      if (!profile) return fail('user_not_found')
      const authId = profile.auth_id ?? null
      const logged = await data.rpc('management_log_auth_delete', { p_user_id: userId, p_auth_id: authId })
      if (logged.error || !logged.data?.ok) return fail('audit_failed')

      if (authId) {
        const deleted = await admin.auth.admin.deleteUser(authId)
        if (deleted.error) return fail('auth_delete_failed')
      }
      const finalized = await data.rpc('management_delete_user_finalize', {
        p_user_id: userId,
        p_expected_auth_id: authId,
      })
      if (finalized.error || !finalized.data?.ok) {
        return json(200, {
          ok: false,
          error: 'حُذف حساب الدخول ولكن لم يُكمل حذف الملف الشخصي؛ أعد المحاولة',
          code: 'retry_finalize',
          data: { user_id: userId, auth_id: authId },
        })
      }
      return json(200, { ok: true, data: { id: userId } })
    }

    default:
      return fail('unknown_op')
  }
})

// Edge Function: ai-chat
// يستقبل conversationId فقط، ويتحقق من الجلسة والملكية عبر RPC، ثم يستدعي Gemini
// بمفتاح موجود في Supabase (Deno secret settings.ai_api_key) ويحفظ الرد في ai_messages.
// لا تُخزَّن أي أسرار في المستودع، ولا تُعرض في الاستجابة.
//
// Request:  { conversationId: number }
// Response: { ok: true, message: { id, role, content, created_at } }
//        |  { ok: false, error: 'unauthorized'|'ai_not_configured'|... , message?: string }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SYSTEM_PROMPT = `أنت المساعد القانوني الأكاديمي لأكاديمية آل الزين للعلوم القانونية والعدلية.
أجب بالعربية الفصحى المبسطة، وركّز على المفاهيم القانونية والدراسية.
كن موجزاً وعملياً، واستخدم أمثلة قصيرة عند الحاجة.
لا تدّعي معرفة مواد أو قرارات لم تذكرها، ولا تقدّم استشارة قانونية نهائية.
أنه إجابتك بتنبيه مختصر إلى ضرورة الرجوع إلى المصادر الأصلية عند التطبيق العملي.`

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function fail(error: string, message: string, status = 200): Response {
  return json(status, { ok: false, error, message })
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return fail('method_not_allowed', 'الطريقة غير مدعومة.', 405)

  const authHeader = req.headers.get('Authorization') || ''
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!jwt) return fail('unauthorized', 'يجب تسجيل الدخول أولاً.', 401)

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !anon || !serviceKey) return fail('server_misconfigured', 'إعدادات الخادم غير مكتملة.', 500)

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: authData, error: authError } = await userClient.auth.getUser(jwt)
  if (authError || !authData.user) return fail('unauthorized', 'الجلسة غير صالحة.', 401)

  let body: { conversationId?: number }
  try {
    body = await req.json()
  } catch {
    return fail('invalid_json', 'طلب غير صالح.')
  }
  const conversationId = Number(body.conversationId)
  if (!Number.isFinite(conversationId) || conversationId <= 0) {
    return fail('invalid_conversation', 'معرّف المحادثة غير صالح.')
  }

  // RPC يتحقق من ملكية المحادثة ويعيد الرسائل المرئية للمستخدم فقط.
  const { data: history, error: historyError } = await userClient.rpc('ai_conversation_messages', {
    p_conversation_id: conversationId,
  })
  if (historyError) return fail('conversation_forbidden', 'لا يمكنك الوصول إلى هذه المحادثة.', 403)
  const messages = Array.isArray(history) ? history : []
  if (!messages.length) return fail('empty_conversation', 'أرسل رسالة أولاً.')

  const last = messages[messages.length - 1]
  if (last.role !== 'user') return fail('already_answered', 'تمت الإجابة على هذه الرسالة بالفعل.')

  const service = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: settings, error: settingsError } = await service
    .from('settings')
    .select('key, value')
    .in('key', ['ai_api_key', 'ai_model', 'ai_provider'])
  if (settingsError) return fail('settings_error', 'تعذّر قراءة إعدادات المساعد.', 500)

  const getSetting = (key: string) => settings?.find((row) => row.key === key)?.value || ''
  const apiKey = Deno.env.get('GEMINI_API_KEY') || getSetting('ai_api_key')
  if (!apiKey) {
    return fail('ai_not_configured', 'المساعد غير مُفعّل بعد. تواصل مع الإدارة لإضافة مفتاح الخدمة.')
  }
  const model = getSetting('ai_model') || 'gemini-2.5-flash'

  const contents = messages.slice(-12).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(m.content || '').slice(0, 12000) }],
  }))

  let reply = ''
  try {
    const gemini = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
        }),
      }
    )
    const raw = await gemini.text()
    if (!gemini.ok) {
      console.error('[ai-chat] gemini status', gemini.status, raw.slice(0, 500))
      return fail('provider_error', 'تعذّر الحصول على إجابة من مزوّد الذكاء الاصطناعي.')
    }
    const parsed = JSON.parse(raw)
    reply = (parsed?.candidates || [])
      .flatMap((c: any) => c?.content?.parts || [])
      .map((part: any) => String(part?.text || ''))
      .join('\n')
      .trim()
  } catch (err) {
    console.error('[ai-chat] provider exception', err)
    return fail('provider_error', 'حدث خطأ أثناء الاتصال بمزوّد الذكاء الاصطناعي.')
  }

  if (!reply) return fail('empty_reply', 'لم يُرجع المساعد إجابة. حاول مرة أخرى.')

  const { data: profile } = await service
    .from('users')
    .select('id')
    .eq('auth_id', authData.user.id)
    .maybeSingle()
  if (!profile?.id) return fail('profile_missing', 'ملف المستخدم غير مكتمل.', 403)

  const { data: saved, error: saveError } = await service
    .from('ai_messages')
    .insert({
      user_id: profile.id,
      conversation_id: conversationId,
      role: 'assistant',
      content: reply.slice(0, 12000),
    })
    .select('id, role, content, created_at')
    .maybeSingle()
  if (saveError || !saved) {
    console.error('[ai-chat] save error', saveError)
    return fail('save_error', 'تعذّر حفظ إجابة المساعد.', 500)
  }

  await service
    .from('ai_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId)

  return json(200, { ok: true, message: saved })
})

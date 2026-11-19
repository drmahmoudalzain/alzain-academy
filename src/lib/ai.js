import { getSettings } from "./settings.js";

/**
 * مساعدات الذكاء الاصطناعي (Gemini) — تُستدعى للتوليد داخل إدارة الأكاديمية.
 * ترجع دائماً مخرجات مطبّعة أو رسالة خطأ جاهزة للعرض — لا تُسقط الطلب.
 */
export async function aiStatus() {
  const settings = await getSettings();
  return {
    ready: Boolean(settings.ai_api_key),
    model: settings.ai_model || "gemini-2.5-flash",
    provider: settings.ai_provider || "gemini",
  };
}

// استخراج أول عنصر JSON من رد قد يحتوي نصاً أو أسوار كود
function extractJSON(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return null;

  // أسوار كود ```json ... ```
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : text;

  // ابحث عن أول { أو [ وآخر خاتمة مطابقة
  const firstBrace = candidate.indexOf("{");
  const firstBracket = candidate.indexOf("[");
  const start = firstBrace === -1 ? firstBracket : firstBracket === -1 ? firstBrace : Math.min(firstBrace, firstBracket);
  if (start === -1) return null;

  const open = candidate[start];
  const close = open === "{" ? "}" : "]";
  const last = candidate.lastIndexOf(close);
  if (last <= start) return null;

  try {
    return JSON.parse(candidate.slice(start, last + 1));
  } catch {
    return null;
  }
}

async function callGemini(apiKey, model, systemInstruction, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model || "gemini-2.5-flash"
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4 },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("Gemini error:", response.status, detail.slice(0, 300));
    return { ok: false, error: "تعذر الاتصال بالمساعد الذكي. تحقق من المفتاح أو حاول لاحقاً." };
  }

  const data = await response.json();
  const text =
    data?.candidates?.[0]?.content?.parts?.map((part) => part.text).join("\n") ?? "";
  return { ok: true, text };
}

// ---------- توليد أسئلة اختبار ----------
export async function generateExamQuestions(topic, count) {
  const settings = await getSettings();
  if (!settings.ai_api_key) {
    return { ok: false, error: "المساعد الذكي غير مُفعّل. يفعّله المالك من الإعدادات بإدخال مفتاح Gemini." };
  }

  const n = Math.max(1, Math.min(12, Number(count) || 5));
  const systemInstruction =
    "You are an Arabic legal academy item writer. Return ONLY valid JSON — no markdown fences, no prose.\n" +
    "Write questions in Arabic. Types allowed: mcq (single correct), multi (several correct), truefalse, essay.\n" +
    "Scoring rule (academy): mcq/multi/truefalse = 2 points each, essay = 6 points. The exam total equals the sum of question points.\n" +
    "True/false: correct_index 0 = false statement, 1 = true statement. Multi: correct_indices = array of correct option indices.\n" +
    "mcq: correct_index = single correct option index (0-based). Essays: correct_index/correct_indices = null.\n" +
    "Return shape: {\"questions\":[{\"type\":\"mcq\",\"text\":\"...\",\"options\":[\"...\",\"...\"],\"correct_index\":0,\"points\":2}]}";

  const prompt = `أنشئ ${n} أسئلة في موضوع "${topic}" للأكاديمية القانونية. غطّ الموضوع بالتدرج من السهل إلى المعقد. اخلط الأنواع بشكل معقول (أغلبها موضوعي وقليل من الأسئلة المقالية).`;

  const result = await callGemini(settings.ai_api_key, settings.ai_model, systemInstruction, prompt);
  if (!result.ok) return result;

  const parsed = extractJSON(result.text);
  const rawQuestions = Array.isArray(parsed?.questions) ? parsed.questions : Array.isArray(parsed) ? parsed : [];
  if (!rawQuestions.length) {
    return { ok: false, error: "تعذر قراءة الأسئلة المولّدة — حاول مرة أخرى بموضوع أوضح." };
  }

  const questions = rawQuestions
    .map((q) => normalizeQuestion(q))
    .filter((q) => q && q.text)
    .slice(0, n);

  if (!questions.length) {
    return { ok: false, error: "تعذر توليد أسئلة صالحة — حاول مرة أخرى." };
  }

  return { ok: true, questions };
}

function normalizeQuestion(q) {
  const type = ["mcq", "multi", "truefalse", "essay"].includes(q?.type) ? q.type : "mcq";
  const text = String(q?.text ?? "").trim();
  if (!text) return null;

  if (type === "essay") {
    return { type, text, points: Math.max(1, Number(q?.points) || 6), options: [], correct_index: null, correct_indices: null };
  }

  const options = Array.isArray(q?.options) ? q.options.map((o) => String(o).trim()).filter(Boolean) : [];
  if (type === "truefalse") {
    const idx = Number(q?.correct_index);
    return { type, text, points: Math.max(1, Number(q?.points) || 2), options: ["خطأ", "صح"], correct_index: idx === 1 ? 1 : 0, correct_indices: null };
  }

  if (options.length < 2) return null;

  if (type === "multi") {
    const indices = Array.isArray(q?.correct_indices) ? q.correct_indices.map(Number).filter((v) => Number.isInteger(v) && v >= 0 && v < options.length) : [];
    return { type, text, points: Math.max(1, Number(q?.points) || 2), options, correct_index: null, correct_indices: indices.length ? indices : [0] };
  }

  let idx = Number(q?.correct_index);
  if (!Number.isInteger(idx) || idx < 0 || idx >= options.length) idx = 0;
  return { type, text, points: Math.max(1, Number(q?.points) || 2), options, correct_index: idx, correct_indices: null };
}

// ---------- توليد واجب ----------
export async function generateAssignment(topic) {
  const settings = await getSettings();
  if (!settings.ai_api_key) {
    return { ok: false, error: "المساعد الذكي غير مُفعّل. يفعّله المالك من الإعدادات بإدخال مفتاح Gemini." };
  }

  const systemInstruction =
    "You are an Arabic legal academy assignment designer. Return ONLY valid JSON — no markdown fences, no prose.\n" +
    "Design ONE assignment in Arabic for the given topic, including a clear title, detailed instructions (numbered tasks), and a grading rubric that sums to max_points.\n" +
    "Academy scoring rule: each correct objective element = 1 point, essays up to 6 points, reward = 5 points once graded. Default max_points = 10 (rubric criteria must sum to max_points).\n" +
    "Return shape: {\"title\":\"...\",\"description\":\"...numbered tasks...\",\"max_points\":10,\"rubric\":[\"معيار 1 (نقاط)\",\"...\"]}";

  const prompt = `صمّم واجباً في موضوع "${topic}" للأكاديمية القانونية.`;

  const result = await callGemini(settings.ai_api_key, settings.ai_model, systemInstruction, prompt);
  if (!result.ok) return result;

  const parsed = extractJSON(result.text);
  const title = String(parsed?.title ?? "").trim();
  const description = String(parsed?.description ?? "").trim();
  const maxPoints = Math.max(1, Number(parsed?.max_points) || 10);
  const rubric = Array.isArray(parsed?.rubric) ? parsed.rubric.map((item) => String(item).trim()).filter(Boolean) : [];

  if (!title || !description) {
    return { ok: false, error: "تعذر توليد الواجب — حاول مرة أخرى بموضوع أوضح." };
  }

  const fullDescription = rubric.length
    ? `${description}\n\nمعايير التصحيح:\n${rubric.map((item) => `- ${item}`).join("\n")}`
    : description;

  return { ok: true, title, description: fullDescription, max_points: maxPoints };
}

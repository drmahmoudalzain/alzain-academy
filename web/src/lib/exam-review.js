export function toggleReviewFlag(flags, questionId) {
  const next = new Set(flags instanceof Set ? flags : []);
  const id = String(questionId ?? "").trim();
  if (!id) return next;
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function parseReviewFlags(raw, validQuestionIds) {
  let parsed;
  try {
    parsed = JSON.parse(String(raw ?? ""));
  } catch {
    return new Set();
  }
  if (!Array.isArray(parsed) || !validQuestionIds || typeof validQuestionIds[Symbol.iterator] !== "function") {
    return new Set();
  }

  const valid = new Set([...validQuestionIds].map((id) => String(id ?? "").trim()).filter(Boolean));
  return new Set(
    parsed
      .map((id) => String(id ?? "").trim())
      .filter((id) => id && valid.has(id))
  );
}

export function serializeReviewFlags(flags) {
  return JSON.stringify(flags instanceof Set ? [...flags].map(String).filter(Boolean) : []);
}

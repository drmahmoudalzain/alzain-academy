// قواعد التحكيم السري المزدوج كما وردت في معايير النشر العلمي.
// تُستخدم في المتصفح للتحقق قبل الاستدعاء، وفي الاختبارات كنموذج تنفيذي.

export const SCORE_AXES = Object.freeze([
  "originality",
  "methodology",
  "documentation",
  "analysis",
  "writing",
]);

// accept: قبول دون تعديل / minor: قبول بتعديلات طفيفة /
// major: قبول بتعديلات جوهرية تُعرض على المحكّمين مرة أخرى / reject: عدم القبول.
export const RECOMMENDATIONS = Object.freeze({
  accept: 3,
  minor: 2,
  major: 1,
  reject: 0,
});

// «مقبول أو أعلى» يشمل القبول دون تعديل والقبول بتعديلات طفيفة؛
// التعديلات الجوهرية تعود إلى المحكّمين ولا تُعد قبولاً نهائياً.
export const ACCEPTABLE_RANK = 2;
export const MIN_TOTAL_SCORE = 30;
export const DECISION_MONTHS = 6;
export const REVISION_MONTHS = 1;

// «قبول مشروط بتعديلات جوهرية (إعادة عرض للمحكّمين)»: الجولة الجديدة تبدأ
// بالمحكّمين أنفسهم وبمهلة بتّ كاملة، والجولة السابقة تبقى سجلاً تاريخياً.
export function nextPublicationReviewRound(finalStatus, currentRound) {
  if (finalStatus !== "revisions") return null;
  if (!Number.isInteger(currentRound) || currentRound < 1) {
    throw new Error("currentRound must be a positive integer");
  }
  return currentRound + 1;
}

export function validatePublicationScores(scores) {
  if (!scores || typeof scores !== "object" || Array.isArray(scores)) {
    return "scores must be an object";
  }
  const keys = Object.keys(scores);
  if (keys.length !== SCORE_AXES.length || !SCORE_AXES.every((axis) => keys.includes(axis))) {
    return "scores must contain exactly five axes";
  }
  for (const axis of SCORE_AXES) {
    const value = scores[axis];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return `${axis} must be numeric`;
    }
    if (value < 0 || value > 10) {
      return `${axis} must be between 0 and 10`;
    }
  }
  return null;
}

export function publicationTotal(scores) {
  return SCORE_AXES.reduce((sum, axis) => sum + Number(scores[axis]), 0);
}

export function publicationFinalStatus(decisions) {
  if (!Array.isArray(decisions) || decisions.length !== 2) {
    return null;
  }
  for (const entry of decisions) {
    const invalid = validatePublicationScores(entry?.scores);
    if (invalid) return invalid;
    if (!Object.prototype.hasOwnProperty.call(RECOMMENDATIONS, entry?.recommendation)) {
      return "invalid_recommendation";
    }
  }

  const totals = decisions.map((entry) => publicationTotal(entry.scores));
  if (Math.min(...totals) < MIN_TOTAL_SCORE) {
    return "rejected";
  }

  const ranks = decisions.map((entry) => RECOMMENDATIONS[entry.recommendation]);
  if (ranks.includes(RECOMMENDATIONS.reject)) {
    return "rejected";
  }
  if (ranks.includes(RECOMMENDATIONS.major)) {
    return "revisions";
  }
  return (ranks[0] + ranks[1]) / 2 >= ACCEPTABLE_RANK ? "accepted" : "rejected";
}

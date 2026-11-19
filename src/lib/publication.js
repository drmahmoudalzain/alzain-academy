import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";
import { db } from "./supabase.js";
import { isFounder } from "./portals.js";

export const STATUS_LABEL = {
  submitted: "جديد",
  screening: "قيد الفحص",
  under_review: "قيد التحكيم",
  revisions: "تعديلات مطلوبة",
  accepted: "مقبول",
  published: "منشور",
  rejected: "مرفوض",
};

export const STATUS_TONE = {
  submitted: "info",
  screening: "warning",
  under_review: "info",
  revisions: "warning",
  accepted: "success",
  published: "success",
  rejected: "error",
};

export const VERDICT_LABEL = {
  accept: "قبول دون تعديل",
  minor: "قبول مشروط بتعديلات طفيفة",
  major: "قبول مشروط بتعديلات جوهرية",
  reject: "عدم القبول",
};

export function storageDir() {
  return path.join(process.cwd(), "uploads", "publications");
}

export function randomFileName(ext) {
  return crypto.randomBytes(16).toString("hex") + (ext || ".pdf");
}

/** هل يملك هذا المستخدم حق الاطلاع على ملف البحث؟ */
export async function canSeeManuscript(user, publication) {
  if (!user || !publication) return false;
  if (publication.author_id === user.id) return true;
  if (await isFounder(user)) return true;
  const assigned = Array.isArray(publication.assigned_reviewers) ? publication.assigned_reviewers : [];
  return assigned.includes(user.id);
}

/** هل يمكن صدور هذا البحث للعلن (للنشر في الكتالوج)؟ */
export function isPublicState(status) {
  return status === "accepted" || status === "published";
}

/** حساب النتيجة الإجمالية للورقة من مراجعتين. */
export function aggregateReview(reviews) {
  const totals = reviews.map((r) => Number(r.total_score ?? 0));
  const verdicts = reviews.map((r) => r.verdict);
  if (!verdicts.length) return { recommendation: null, totals: [], verdicts };

  const hasReject = verdicts.includes("reject");
  const allAccept = verdicts.every((v) => v === "accept");
  const avg = totals.reduce((a, b) => a + b, 0) / totals.length;

  let recommendation;
  if (hasReject) recommendation = "reject";
  else if (allAccept && avg >= 30) recommendation = "accept";
  else if (avg >= 30) recommendation = "minor";
  else if (avg >= 20) recommendation = "major";
  else recommendation = "reject";

  return { recommendation, average: Number(avg.toFixed(2)), totals, verdicts };
}

export async function ensureUploadDir() {
  await fs.mkdir(storageDir(), { recursive: true });
}

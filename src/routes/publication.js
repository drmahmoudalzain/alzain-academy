import express from "express";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import multer from "multer";
import { db } from "../lib/supabase.js";
import { renderPage } from "../lib/render.js";
import { requireAuth } from "../middleware/auth.js";
import { PORTALS, primaryPortal, isFounder } from "../lib/portals.js";
import {
  STATUS_LABEL,
  STATUS_TONE,
  VERDICT_LABEL,
  storageDir,
  ensureUploadDir,
  canSeeManuscript,
  aggregateReview,
} from "../lib/publication.js";

const router = express.Router();

// ---------- إعداد الرفع ----------
const storage = multer.diskStorage({
  destination: async (_req, file, cb) => {
    try {
      await ensureUploadDir();
      cb(null, storageDir());
    } catch (error) {
      cb(error);
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".pdf";
    cb(null, crypto.randomBytes(16).toString("hex") + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(pdf|doc|docx)$/i.test(file.originalname || "");
    cb(ok ? null : new Error("الملف يجب أن يكون PDF أو Word (.doc/.docx)"), ok);
  },
});

const pubPage = (res, view, locals) =>
  renderPage(res, view, {
    layout: "portal",
    portal: res.locals.portal,
    ...locals,
  });

async function requirePortalAny(req, res, next) {
  // جميع بوابات الطلاب/الأساتذة/المالك لديهم قسم النشر — نعرض البوابة الحالية للتوجيه
  try {
    const portalKey = await primaryPortal(req.user);
    res.locals.portal = PORTALS[portalKey];
    next();
  } catch (error) {
    next(error);
  }
}

router.use(requireAuth, requirePortalAny);

// ---------- التحقق من قدرة الباحث على النشر (أستاذ/مالك) ----------
async function canAuthor(user) {
  if (!user) return false;
  if (user.role === "teacher") return true;
  return isFounder(user);
}

// ---------- كتالوج الأبحاث المنشورة ----------
router.get("/", async (req, res, next) => {
  try {
    const [published, total] = await Promise.all([
      db
        .from("publications")
        .select("id, title, abstract_ar, keywords, author_id, published_at, users!publications_author_id_fkey(name)")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(30),
      db
        .from("publications")
        .select("*", { count: "exact", head: true })
        .eq("status", "published"),
    ]);

    if (published.error) throw published.error;
    if (total.error) throw total.error;

    return pubPage(res, "publication/catalog", {
      title: "قسم النشر العلمي",
      pageTitle: "قسم النشر العلمي",
      papers: (published.data ?? []).map((paper) => ({
        ...paper,
        authorName: paper.users?.name ?? "الباحث",
      })),
      publishedCount: total.count ?? 0,
      canSubmit: await canAuthor(req.user),
    });
  } catch (error) {
    next(error);
  }
});

// ---------- تفاصيل بحث منشور ----------
router.get("/item/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return pubPage(res.status(400), "publication/item", { title: "غير صالح", pageTitle: "غير صالح", error: "معرّف غير صحيح." });
    }

    const { data, error } = await db
      .from("publications")
      .select("*, users!publications_author_id_fkey(id, name, position)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return pubPage(res.status(404), "publication/item", { title: "غير موجود", pageTitle: "غير موجود", paper: null });
    }

    // غير المنشورة متاحة لصاحبها والمالك والمراجعين فقط
    if (data.status !== "published") {
      const allowed = await canSeeManuscript(req.user, data);
      if (!allowed) return res.status(403).render("error", { title: "غير مسموح", code: 403, message: "لا تملك صلاحية عرض هذا البحث." });
    }

    return pubPage(res, "publication/item", {
      title: data.title,
      pageTitle: "تفاصيل البحث",
      paper: { ...data, authorName: data.users?.name ?? "الباحث", authorPosition: data.users?.position ?? null },
      statusLabel: STATUS_LABEL[data.status] ?? data.status,
      canSeeFile: await canSeeManuscript(req.user, data),
      acceptedNote: data.decision_note ?? null,
    });
  } catch (error) {
    next(error);
  }
});

// ---------- نموذجي تقديم بحث (للأساتذة والمالك) ----------
router.get("/submit", async (req, res, next) => {
  try {
    if (!(await canAuthor(req.user))) {
      return res.redirect("/publication");
    }
    return pubPage(res, "publication/submit", {
      title: "تقديم بحث للنشر",
      pageTitle: "تقديم بحث للنشر",
      error: null,
      canSubmit: true,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/submit", upload.single("manuscript"), async (req, res, next) => {
  try {
    if (!(await canAuthor(req.user))) {
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      return res.redirect("/publication");
    }

    const title = String(req.body.title ?? "").trim();
    const abstractAr = String(req.body.abstract_ar ?? "").trim();
    const abstractEn = String(req.body.abstract_en ?? "").trim();
    const keywords = String(req.body.keywords ?? "").trim();
    const fileName = req.file?.filename ?? null;

    const fail = async (message) => {
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      return pubPage(res.status(422), "publication/submit", {
        title: "تقديم بحث للنشر",
        pageTitle: "تقديم بحث للنشر",
        error: message,
        canSubmit: true,
      });
    };

    if (title.length < 5) return fail("عنوان البحث قصير جداً.");
    if (abstractAr.length < 50) return fail("الملخص بالعربية قصير جداً (50 كلمة على الأقل).");
    if (!fileName) return fail("أرفق ملف البحث (PDF أو Word).");

    const created = await db
      .from("publications")
      .insert({
        author_id: req.user.id,
        title,
        abstract_ar: abstractAr || null,
        abstract_en: abstractEn || null,
        keywords: keywords || null,
        manuscript_file: fileName,
        status: "submitted",
      })
      .select("id")
      .maybeSingle();
    if (created.error) throw created.error;

    return res.redirect(`/publication/mine`);
  } catch (error) {
    if (req.file) await fs.unlink(req.file.path).catch(() => {});
    next(error);
  }
});

// ---------- بحوثي ----------
router.get("/mine", async (req, res, next) => {
  try {
    if (!(await canAuthor(req.user))) return res.redirect("/publication");

    const { data, error } = await db
      .from("publications")
      .select("id, title, abstract_ar, keywords, status, decision_note, created_at, published_at")
      .eq("author_id", req.user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;

    return pubPage(res, "publication/mine", {
      title: "بحوثي",
      pageTitle: "بحوثي",
      papers: (data ?? []).map((paper) => ({
        ...paper,
        statusLabel: STATUS_LABEL[paper.status] ?? paper.status,
        statusTone: STATUS_TONE[paper.status] ?? "info",
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ---------- تحميل ملف البحث ----------
router.get("/file/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { data, error } = await db
      .from("publications")
      .select("id, author_id, manuscript_file, status, assigned_reviewers, title")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).render("error", { title: "غير موجود", code: 404, message: "البحث غير موجود." });

    if (!(await canSeeManuscript(req.user, data))) {
      return res.status(403).render("error", { title: "غير مسموح", code: 403, message: "لا تملك صلاحية تحميل هذا البحث." });
    }

    if (!data.manuscript_file) return res.status(404).render("error", { title: "غير متوفر", code: 404, message: "الملف غير متوفر." });

    const filePath = path.join(storageDir(), data.manuscript_file);
    const exists = await fs.access(filePath).then(() => true).catch(() => false);
    if (!exists) return res.status(404).render("error", { title: "غير متوفر", code: 404, message: "الملف غير متاح على الخادم." });

    return res.download(filePath, `${data.title.slice(0, 80)}.pdf`);
  } catch (error) {
    next(error);
  }
});

// ---------- التحكيم (للمراجعين) ----------
router.get("/review/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { data, error } = await db
      .from("publications")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).render("error", { title: "غير موجود", code: 404, message: "البحث غير موجود." });

    const assigned = Array.isArray(data.assigned_reviewers) ? data.assigned_reviewers : [];
    const isEditor = await isFounder(req.user);
    if (!assigned.includes(req.user.id) && !isEditor && data.author_id !== req.user.id) {
      return res.status(403).render("error", { title: "غير مسموح", code: 403, message: "أنت لست من محكّمي هذا البحث." });
    }

    const reviewsRes = await db
      .from("publication_reviews")
      .select("*")
      .eq("publication_id", id)
      .eq("reviewer_id", req.user.id)
      .maybeSingle();
    if (reviewsRes.error) throw reviewsRes.error;
    const myReview = reviewsRes.data ?? null;

    return pubPage(res, "publication/review", {
      title: "تحكيم البحث",
      pageTitle: "تحكيم البحث",
      paper: data,
      myReview,
      statusLabel: STATUS_LABEL[data.status] ?? data.status,
      verdictLabel: VERDICT_LABEL,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/review/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { data: pub, error } = await db.from("publications").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!pub) return res.status(404).render("error", { title: "غير موجود", code: 404, message: "البحث غير موجود." });

    const assigned = Array.isArray(pub.assigned_reviewers) ? pub.assigned_reviewers : [];
    if (!assigned.includes(req.user.id)) {
      return res.status(403).render("error", { title: "غير مسموح", code: 403, message: "أنت لست من محكّمي هذا البحث." });
    }

    const scoreA = clamp10(req.body.score_authenticity);
    const scoreB = clamp10(req.body.score_methodology);
    const scoreC = clamp10(req.body.score_citation);
    const scoreD = clamp10(req.body.score_analysis);
    const scoreE = clamp10(req.body.score_clarity);
    const total = Number((scoreA + scoreB + scoreC + scoreD + scoreE).toFixed(2));
    const verdict = String(req.body.verdict ?? "minor");
    const comments = String(req.body.comments ?? "").trim() || null;

    const upserted = await db.from("publication_reviews").upsert(
      {
        publication_id: id,
        reviewer_id: req.user.id,
        score_authenticity: scoreA,
        score_methodology: scoreB,
        score_citation: scoreC,
        score_analysis: scoreD,
        score_clarity: scoreE,
        total_score: total,
        verdict,
        comments,
      },
      { onConflict: "publication_id,reviewer_id" }
    );
    if (upserted.error) throw upserted.error;

    // إذا كان جميع المحكّمين قد سلموا مراجعاتهم → "under_review" مكتمل
    const reviewsRes = await db.from("publication_reviews").select("id, reviewer_id, verdict").eq("publication_id", id);
    if (reviewsRes.error) throw reviewsRes.error;
    const submittedCount = (reviewsRes.data ?? []).length;
    if (submittedCount >= assigned.length) {
      const updated = await db.from("publications").update({ status: "under_review", updated_at: new Date().toISOString() }).eq("id", id);
      if (updated.error) throw updated.error;
    }

    return res.redirect(`/publication/review/${id}`);
  } catch (error) {
    next(error);
  }
});

function clamp10(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 5;
  return Math.min(10, Math.max(0, n));
}

// ================= إدارة النشر (للمحرر) =================

// لوحة الإدارة — بطاقات + قوائم بالحالات
router.get("/manage", async (req, res, next) => {
  try {
    if (!(await isFounder(req.user))) return res.redirect("/publication");

    const { data, error } = await db
      .from("publications")
      .select("id, title, status, author_id, assigned_reviewers, created_at, published_at, updated_at, users!publications_author_id_fkey(name)")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const papers = (data ?? []).map((p) => ({ ...p, authorName: p.users?.name ?? "الباحث", statusLabel: STATUS_LABEL[p.status] ?? p.status, statusTone: STATUS_TONE[p.status] ?? "info" }));

    const counts = {
      submitted: papers.filter((p) => p.status === "submitted").length,
      screening: papers.filter((p) => p.status === "screening").length,
      under_review: papers.filter((p) => p.status === "under_review").length,
      revisions: papers.filter((p) => p.status === "revisions").length,
      accepted: papers.filter((p) => p.status === "accepted").length,
      published: papers.filter((p) => p.status === "published").length,
      rejected: papers.filter((p) => p.status === "rejected").length,
    };

    return pubPage(res, "publication/manage", {
      title: "إدارة النشر",
      pageTitle: "إدارة النشر",
      papers,
      counts,
    });
  } catch (error) {
    next(error);
  }
});

// تفاصيل إدارية — إسناد مراجعين + قرارات
router.get("/manage/:id", async (req, res, next) => {
  try {
    if (!(await isFounder(req.user))) {
      return res.status(403).render("error", { title: "غير مسموح", code: 403, message: "قسم الإدارة للمحرر فقط." });
    }

    const id = Number(req.params.id);
    const { data: paper, error } = await db
      .from("publications")
      .select("*, users!publications_author_id_fkey(id, name, position)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!paper) return res.status(404).render("error", { title: "غير موجود", code: 404, message: "البحث غير موجود." });

    const reviewsRes = await db
      .from("publication_reviews")
      .select("*, users!publication_reviews_reviewer_id_fkey(id, name, position)")
      .eq("publication_id", id)
      .order("created_at");
    if (reviewsRes.error) throw reviewsRes.error;
    const reviews = reviewsRes.data ?? [];

    const teachersRes = await db
      .from("users")
      .select("id, name, position, role")
      .eq("role", "teacher")
      .order("id");
    if (teachersRes.error) throw teachersRes.error;

    return pubPage(res, "publication/manage-detail", {
      title: paper.title,
      pageTitle: "إدارة البحث",
      paper: { ...paper, authorName: paper.users?.name ?? "الباحث", authorPosition: paper.users?.position ?? null },
      reviews: reviews.map((r) => ({ ...r, reviewerName: r.users?.name ?? "محكّم" })),
      teachers: teachersRes.data ?? [],
      aggregate: aggregateReview(reviews),
      verdictLabel: VERDICT_LABEL,
      statusLabel: STATUS_LABEL[paper.status] ?? paper.status,
    });
  } catch (error) {
    next(error);
  }
});

// إجراءات الإدارة (استقبال/إسناد/قرار)
router.post("/manage/:id/action", async (req, res, next) => {
  try {
    if (!(await isFounder(req.user))) {
      return res.status(403).render("error", { title: "غير مسموح", code: 403, message: "قسم الإدارة للمحرر فقط." });
    }

    const id = Number(req.params.id);
    const { data: paper, error } = await db.from("publications").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!paper) return res.status(404).render("error", { title: "غير موجود", code: 404, message: "البحث غير موجود." });

    const action = String(req.body.action ?? "");
    const updates = { updated_at: new Date().toISOString() };

    if (action === "screen_accept") {
      updates.status = "under_review";
      updates.editor_note = String(req.body.editor_note ?? "مقبول للتحكيم").trim();
    } else if (action === "screen_reject") {
      updates.status = "rejected";
      updates.decision_note = String(req.body.editor_note ?? "مرفوض في الفحص الأولي").trim();
    } else if (action === "assign") {
      const raw = String(req.body.reviewers ?? "").trim();
      const ids = raw
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n > 0);
      if (!ids.length) return res.redirect(`/publication/manage/${id}?error=reviewers`);
      updates.assigned_reviewers = ids;
      updates.status = "under_review";
      updates.editor_note = "أُسند للتحكيم";
    } else if (action === "accept") {
      updates.status = "accepted";
    } else if (action === "revisions") {
      updates.status = "revisions";
      updates.decision_note = String(req.body.editor_note ?? "مطلوب تعديلات").trim();
    } else if (action === "reject") {
      updates.status = "rejected";
      updates.decision_note = String(req.body.editor_note ?? "مرفوض بعد التحكيم").trim();
    } else if (action === "publish") {
      updates.status = "published";
      updates.published_at = new Date().toISOString();
    } else if (action === "unpublish") {
      updates.status = "accepted";
      updates.published_at = null;
    } else {
      return res.redirect(`/publication/manage/${id}`);
    }

    const updated = await db.from("publications").update(updates).eq("id", id);
    if (updated.error) throw updated.error;

    return res.redirect(`/publication/manage/${id}`);
  } catch (error) {
    next(error);
  }
});

export default router;

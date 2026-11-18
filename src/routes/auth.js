import express from "express";
import { db } from "../lib/supabase.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import {
  SESSION_COOKIE,
  hashToken,
  newSessionToken,
  sessionCookieOptions,
} from "../lib/session.js";
import { getSettings, isFlagOn } from "../lib/settings.js";
import {
  PORTALS,
  canEnterPortal,
  isFounder,
  isPortalKey,
  primaryPortal,
} from "../lib/portals.js";
import { archiveDeniedLogin } from "../lib/archive.js";
import { LOGIN_COPY } from "../lib/login-copy.js";
import { renderPage } from "../lib/render.js";
import { env } from "../lib/env.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

function safeNext(value) {
  const next = String(value ?? "");
  return next.startsWith("/") && !next.startsWith("//") ? next : null;
}

async function findUserByIdentifier(identifier) {
  const value = String(identifier ?? "").trim();
  if (!value) return null;

  const byEmail = await db.from("users").select("*").eq("email", value).maybeSingle();
  if (byEmail.error) throw byEmail.error;
  if (byEmail.data) return byEmail.data;

  const byEmailLower = await db.from("users").select("*").eq("email", value.toLowerCase()).maybeSingle();
  if (byEmailLower.error) throw byEmailLower.error;
  if (byEmailLower.data) return byEmailLower.data;

  const byUniversityId = await db
    .from("users")
    .select("*")
    .eq("university_id", value)
    .maybeSingle();
  if (byUniversityId.error) throw byUniversityId.error;

  return byUniversityId.data ?? null;
}

async function roleLabel(user) {
  if (await isFounder(user)) return "المالك";
  return user.role === "teacher" ? "أستاذ" : "طالب";
}

// ---------- الصفحة الرئيسية ----------
router.get("/", async (req, res, next) => {
  try {
    return renderPage(res, "landing", {
      title: "الرئيسية",
      layout: "base",
      bodyClass: "site-page",
      styles: ["/css/views/home.css"],
      scripts: ["/js/home.js"],
    });
  } catch (error) {
    next(error);
  }
});

// ---------- العرض التجريبي ----------
router.get("/demo", async (req, res, next) => {
  try {
    return renderPage(res, "demo", {
      title: "العرض التجريبي",
      layout: "base",
      bodyClass: "site-page",
      styles: ["/css/views/home.css"],
      scripts: ["/js/home.js"],
    });
  } catch (error) {
    next(error);
  }
});

// ---------- صفحة الدخول ----------
router.get("/login", async (req, res, next) => {
  try {
    const role = String(req.query.role ?? "");
    if (!isPortalKey(role)) return res.redirect("/");

    const portal = PORTALS[role];
    return renderPage(res, "auth/login", {
      title: `الدخول — ${portal.label}`,
      layout: "base",
      bodyClass: `login-page login-${role}`,
      styles: [`/css/views/${role}.css`, "/css/login-extra.css"],
      portal,
      copy: LOGIN_COPY[role],
      identifier: "",
      error: null,
      notice: req.query.expired ? "انتهت الجلسة، يرجى تسجيل الدخول من جديد." : null,
      next: safeNext(req.query.next),
    });
  } catch (error) {
    next(error);
  }
});

// ---------- تنفيذ الدخول مع الفصل الصارم ----------
router.post("/login", async (req, res, next) => {
  const portalKey = String(req.body.portal ?? "");
  const identifier = String(req.body.identifier ?? "").trim();
  const password = String(req.body.password ?? "");

  if (!isPortalKey(portalKey)) return res.redirect("/");

  const portal = PORTALS[portalKey];
  const settings = res.locals.settings ?? (await getSettings());
  const ownerAllGates = isFlagOn(settings, "owner_all_gates");

  const fail = (status, error, user = null) =>
    renderPage(res.status(status), "auth/login", {
      title: `الدخول — ${portal.label}`,
      layout: "base",
      bodyClass: `login-page login-${portalKey}`,
      styles: [`/css/views/${portalKey}.css`, "/css/login-extra.css"],
      portal,
      copy: LOGIN_COPY[portalKey],
      identifier,
      error,
      notice: null,
      next: safeNext(req.body.next),
    });

  try {
    if (!identifier || !password) {
      return fail(422, "يرجى إدخال البريد الجامعي/الرقم الجامعي وكلمة المرور.");
    }

    const user = await findUserByIdentifier(identifier);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return fail(401, "بيانات الدخول غير صحيحة. تحقق من المعرّف وكلمة المرور.");
    }

    if (!user.is_active) {
      return fail(403, "هذا الحساب موقوف. راجع إدارة الأكاديمية.");
    }

    if (!(await canEnterPortal(user, portalKey, { ownerAllGates }))) {
      await archiveDeniedLogin({
        user,
        portal: portalKey,
        identifier,
        ip: req.ip,
      });

      const own = PORTALS[await primaryPortal(user)];
      return fail(
        403,
        `هذه البوابة مخصصة لـ${portal.audience} فقط. حسابك هو ${await roleLabel(
          user
        )} — استخدم بوابتك الخاصة (${own.label}).`
      );
    }

    // إنشاء الجلسة
    const token = newSessionToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + env.SESSION_DAYS * 24 * 60 * 60 * 1000);

    const inserted = await db.from("sessions").insert({
      token_hash: tokenHash,
      user_id: user.id,
      expires_at: expiresAt.toISOString(),
    });
    if (inserted.error) throw inserted.error;

    // تنظيف الجلسات المنتهية لهذا المستخدم.
    await db
      .from("sessions")
      .delete()
      .eq("user_id", user.id)
      .lt("expires_at", new Date().toISOString());

    const touched = await db
      .from("users")
      .update({ last_login: new Date().toISOString() })
      .eq("id", user.id);
    if (touched.error) console.error("تعذر تحديث آخر دخول:", touched.error.message);

    res.cookie(SESSION_COOKIE, token, {
      ...sessionCookieOptions(),
      maxAge: env.SESSION_DAYS * 24 * 60 * 60 * 1000,
    });

    const destination =
      safeNext(req.body.next) ??
      (user.must_change_password ? "/account?first=1" : PORTALS[portalKey].home);

    return res.redirect(destination);
  } catch (error) {
    next(error);
  }
});

// ---------- الخروج ----------
router.post("/logout", async (req, res, next) => {
  try {
    if (req.sessionTokenHash) {
      const { error } = await db.from("sessions").delete().eq("token_hash", req.sessionTokenHash);
      if (error) console.error("تعذر حذف الجلسة:", error.message);
    }
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions());
    return res.redirect("/");
  } catch (error) {
    next(error);
  }
});

// ---------- الحساب ----------
router.get("/account", requireAuth, async (req, res, next) => {
  try {
    const portalKey = await primaryPortal(req.user);
    return renderPage(res, "auth/account", {
      title: "حسابي",
      layout: "portal", pageTitle: "حسابي",
      portal: PORTALS[portalKey],
      mustChange: req.user.must_change_password || req.query.first === "1",
      notice: req.query.saved ? "تم حفظ التغييرات." : null,
      error: null,
      profile: { name: req.user.name, email: req.user.email ?? "", phone: req.user.phone ?? "" },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/account/password", requireAuth, async (req, res, next) => {
  const portalKey = await primaryPortal(req.user);
  const back = (status, error, notice = null) =>
    renderPage(res.status(status), "auth/account", {
      title: "حسابي",
      layout: "portal", pageTitle: "حسابي",
      portal: PORTALS[portalKey],
      mustChange: true,
      notice,
      error,
      profile: { name: req.user.name, email: req.user.email ?? "", phone: req.user.phone ?? "" },
    });

  try {
    const current = String(req.body.current ?? "");
    const nextPassword = String(req.body.next ?? "");
    const confirm = String(req.body.confirm ?? "");

    if (!verifyPassword(current, req.user.password_hash)) {
      return back(401, "كلمة المرور الحالية غير صحيحة.");
    }
    if (nextPassword.length < 8) {
      return back(422, "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.");
    }
    if (nextPassword !== confirm) {
      return back(422, "تأكيد كلمة المرور لا يطابق الكلمة الجديدة.");
    }
    if (verifyPassword(nextPassword, req.user.password_hash)) {
      return back(422, "الكلمة الجديدة مطابقة للحالية، اختر كلمة مختلفة.");
    }

    const updated = await db
      .from("users")
      .update({ password_hash: hashPassword(nextPassword), must_change_password: false })
      .eq("id", req.user.id);
    if (updated.error) throw updated.error;

    // إبطال الجلسات الأخرى مع الإبقاء على الجلسة الحالية.
    await db
      .from("sessions")
      .delete()
      .eq("user_id", req.user.id)
      .neq("token_hash", req.sessionTokenHash ?? "");

    return res.redirect("/account?saved=1");
  } catch (error) {
    next(error);
  }
});

router.post("/account/profile", requireAuth, async (req, res, next) => {
  const portalKey = await primaryPortal(req.user);
  const back = (status, error) =>
    renderPage(res.status(status), "auth/account", {
      title: "حسابي",
      layout: "portal", pageTitle: "حسابي",
      portal: PORTALS[portalKey],
      mustChange: req.user.must_change_password,
      notice: null,
      error,
      profile: {
        name: String(req.body.name ?? req.user.name),
        email: String(req.body.email ?? req.user.email ?? ""),
        phone: String(req.body.phone ?? req.user.phone ?? ""),
      },
    });

  try {
    const name = String(req.body.name ?? "").trim();
    const email = String(req.body.email ?? "").trim().toLowerCase();
    const phone = String(req.body.phone ?? "").trim();

    if (name.length < 3) return back(422, "الاسم قصير جداً.");

    if (email) {
      const clash = await db
        .from("users")
        .select("id")
        .eq("email", email)
        .neq("id", req.user.id)
        .maybeSingle();
      if (clash.error) throw clash.error;
      if (clash.data) return back(422, "البريد مستخدم في حساب آخر.");
    }

    const updated = await db
      .from("users")
      .update({ name, email: email || null, phone: phone || null })
      .eq("id", req.user.id);
    if (updated.error) throw updated.error;

    return res.redirect("/account?saved=1");
  } catch (error) {
    next(error);
  }
});

export default router;

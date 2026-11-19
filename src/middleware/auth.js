import { db } from "../lib/supabase.js";
import {
  SESSION_COOKIE,
  hashToken,
  parseCookies,
  sessionCookieOptions,
} from "../lib/session.js";
import { getSettings, isFlagOn } from "../lib/settings.js";
import { PORTALS, canEnterPortal, primaryPortal } from "../lib/portals.js";
import { navigationFor } from "../lib/navigation.js";
import { renderPage } from "../lib/render.js";

/** يقرأ الكوكي ويجلب المستخدم من جدول sessions (تجزئة الرمز فقط). */
export async function attachUser(req, res, next) {
  res.locals.user = null;
  res.locals.portal = null;
  res.locals.portals = PORTALS;
  res.locals.currentPath = req.path;

  try {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (!token) return next();

    const tokenHash = hashToken(token);
    const { data, error } = await db
      .from("sessions")
      .select("token_hash, expires_at, users(*)")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (error) throw error;

    if (!data || !data.users || new Date(data.expires_at) <= new Date()) {
      if (data) await db.from("sessions").delete().eq("token_hash", tokenHash);
      res.clearCookie(SESSION_COOKIE, sessionCookieOptions());
      return next();
    }

    req.user = data.users;
    req.sessionTokenHash = tokenHash;
    res.locals.user = data.users;
    const portalKey = await primaryPortal(data.users);
    res.locals.homePath = PORTALS[portalKey]?.home ?? "/";
    res.locals.nav = navigationFor(portalKey, data.users);
    res.locals.navBadges = {};
  } catch (error) {
    console.error("تعذر التحقق من الجلسة:", error.message ?? error);
  }

  next();
}

/** تحميل الإعدادات العامة مرة واحدة لكل طلب. */
export async function loadSettings(req, res, next) {
  try {
    res.locals.settings = await getSettings();
  } catch (error) {
    console.error("تعذر تحميل الإعدادات:", error.message ?? error);
    res.locals.settings = {};
  }
  next();
}

// مسارات يسمح بها للحسابات التي لم تكمل ملفاتها بعد (كلمة مرور + بريد)
const COMPLETION_PATHS = new Set([
  "/account",
  "/account/password",
  "/account/profile",
  "/logout",
]);

function pathOf(req) {
  return String(req.originalUrl ?? req.url ?? "/").split("?")[0];
}

/** هل ينقص الحساب إكمال ملفه (تغيير الكلمة أو إدخال البريد)؟ */
export function profileIncomplete(user) {
  return Boolean(user) && (user.must_change_password || !user.email);
}

/** يعيد التوجيه إلى /account?first=1 ما لم يكن المسار مسموحًا — يُستخدم من requireAuth و requirePortal. */
export function redirectIfProfileIncomplete(req, res) {
  if (profileIncomplete(req.user) && !COMPLETION_PATHS.has(pathOf(req))) {
    res.redirect("/account?first=1");
    return true;
  }
  return false;
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    const next_ = encodeURIComponent(req.originalUrl || "/");
    return res.redirect(`/login?next=${next_}`);
  }

  if (redirectIfProfileIncomplete(req, res)) return;

  next();
}

/** حارس البوابة: يرفض غير المسموح لهم بخطأ 403 صريح. */
export function requirePortal(portalKey) {
  return async (req, res, next) => {
    try {
      if (!req.user) return res.redirect(`/login?role=${portalKey}`);

      // لا يسمح بدخول أي بوابة قبل إكمال الملف الشخصي
      if (redirectIfProfileIncomplete(req, res)) return;

      const settings = res.locals.settings ?? (await getSettings());
      const allowed = await canEnterPortal(req.user, portalKey, {
        ownerAllGates: isFlagOn(settings, "owner_all_gates"),
      });

      if (!allowed) return forbidden(req, res, portalKey);

      res.locals.portal = PORTALS[portalKey];
      res.locals.nav = navigationFor(portalKey, req.user);
      res.locals.navBadges = res.locals.navBadges ?? {};
      next();
    } catch (error) {
      next(error);
    }
  };
}

async function forbidden(req, res, portalKey) {
  const settings = res.locals.settings ?? (await getSettings());
  const ownPortalKey = await primaryPortal(req.user);
  const ownPortal = PORTALS[ownPortalKey];

  res.status(403);
  return renderPage(res, "forbidden", {
    title: "دخول غير مسموح",
    layout: "auth",
    attemptedPortal: PORTALS[portalKey],
    ownPortal,
    ownerAllGates: isFlagOn(settings, "owner_all_gates"),
  });
}

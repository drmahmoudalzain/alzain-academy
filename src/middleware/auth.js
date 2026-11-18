import { db } from "../lib/supabase.js";
import {
  SESSION_COOKIE,
  hashToken,
  parseCookies,
  sessionCookieOptions,
} from "../lib/session.js";
import { getSettings, isFlagOn } from "../lib/settings.js";
import { PORTALS, canEnterPortal, primaryPortal } from "../lib/portals.js";
import { NAVIGATION } from "../lib/navigation.js";
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
    res.locals.homePath = PORTALS[await primaryPortal(data.users)]?.home ?? "/";
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

export function requireAuth(req, res, next) {
  if (req.user) return next();
  const next_ = encodeURIComponent(req.originalUrl || "/");
  res.redirect(`/login?next=${next_}`);
}

/** حارس البوابة: يرفض غير المسموح لهم بخطأ 403 صريح. */
export function requirePortal(portalKey) {
  return async (req, res, next) => {
    try {
      if (!req.user) return res.redirect(`/login?role=${portalKey}`);

      const settings = res.locals.settings ?? (await getSettings());
      const allowed = await canEnterPortal(req.user, portalKey, {
        ownerAllGates: isFlagOn(settings, "owner_all_gates"),
      });

      if (!allowed) return forbidden(req, res, portalKey);

      res.locals.portal = PORTALS[portalKey];
      res.locals.nav = NAVIGATION[portalKey] ?? [];
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

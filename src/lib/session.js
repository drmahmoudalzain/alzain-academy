// جلسات مخصصة: رمز عشوائي في الكوكيز، ويُخزَّن في قاعدة البيانات تجزئته فقط.
import crypto from "node:crypto";

export const SESSION_COOKIE = "az_session";

export function newSessionToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function parseCookies(header) {
  const jar = {};
  if (!header) return jar;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (!key) continue;
    try {
      jar[key] = decodeURIComponent(value);
    } catch {
      jar[key] = value;
    }
  }
  return jar;
}

/**
 * خيارات كوكي الجلسة.
 * نحدد علم Secure من بروتوكول الطلب الفعلي (بعد المرور عبر proxy أو Cloudflare)
 * بدل الاعتماد على NODE_ENV وحده، حتى يعمل الكوكي بشكل صحيح على:
 *   - http://localhost:3001
 *   - https://<tunnel>.trycloudflare.com
 *   - الاستضافة الدائمة خلف HTTPS proxy
 * أي خطأ في علم Secure يجعل المتصفح يتجاهل الكوكي عند إعادة التحميل فيخرج المستخدم.
 */
export function sessionCookieOptions(req) {
  const forwarded = String(
    req?.get?.("x-forwarded-proto") ?? req?.headers?.["x-forwarded-proto"] ?? ""
  );
  const proto = forwarded.split(",")[0].trim().toLowerCase();

  let secure;
  if (proto === "https" || req?.secure === true) secure = true;
  else if (proto === "http") secure = false;
  else secure = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
  };
}

/** كتابة كوكي الجلسة بصلاحية مجددة — تُستخدم عند الدخول وفي كل طلب صفحة موثّق. */
export function setSessionCookie(res, req, token, maxAgeMs) {
  return res.cookie(SESSION_COOKIE, token, {
    ...sessionCookieOptions(req),
    maxAge: maxAgeMs,
  });
}

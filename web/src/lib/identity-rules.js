// قواعد الهوية في الواجهة: نقية، بلا استيراد، بلا أسرار.
// الرمز هو وسيلة الدخول الوحيدة؛ البريد يُطلب داخل صفحة الحساب فقط.

export const EMAIL_LOGIN_ERROR =
  "البريد الإلكتروني ليس وسيلة دخول في المنصة. أدخل رمز المنصة (حرفان و4 أرقام)، مثل BF0001.";

export const ACCOUNT_FIRST_PATH = "pages/account.html?first=1";

export function isEmailIdentifier(identifier) {
  return String(identifier ?? "").includes("@");
}

// يُستدعى قبل أي اتصال بالخلفية؛ يعيد null حين يكون الرمز مقبولاً للإرسال.
export function loginIdentifierError(identifier) {
  const value = String(identifier ?? "").trim();
  if (!value) return "أدخل الرمز وكلمة المرور.";
  if (isEmailIdentifier(value)) return EMAIL_LOGIN_ERROR;
  return null;
}

// صيغة خطأ القفل التي تُعيدها دالة الدخول: account_locked:<عدد الدقائق>.
export function parseLockMinutes(error) {
  const match = /^account_locked:(\d+)$/.exec(String(error ?? "").trim());
  if (!match) return null;
  const minutes = Number(match[1]);
  return Number.isSafeInteger(minutes) && minutes > 0 ? minutes : null;
}

export function loginLockedMessage(minutes) {
  const value = Number(minutes);
  if (!Number.isSafeInteger(value) || value <= 0) return "فشل الدخول: بيانات غير صحيحة.";
  return `تم قفل الحساب مؤقتًا بعد محاولات فاشلة. حاول مرة أخرى بعد ${value} دقيقة.`;
}

const LOGIN_ERROR_MESSAGES = {
  email_login_rejected: EMAIL_LOGIN_ERROR,
  invalid_platform_id: "رمز المنصة غير صالح. أدخل رمزًا من حرفين و4 أرقام، مثل BF0001.",
  invalid_credentials: "فشل الدخول: بيانات غير صحيحة.",
  account_suspended: "تم إيقاف هذا الحساب. تواصل مع إدارة المنصة.",
  no_usable_credential: "لا توجد كلمة مرور صالحة لهذا الحساب. تواصل مع إدارة المنصة.",
  login_guard_unavailable: "تعذّر التحقق من حالة الحساب. حاول مرة أخرى.",
  attempt_log_failed: "تعذّر تسجيل محاولة الدخول. حاول مرة أخرى.",
};

export function loginErrorMessage(error) {
  const value = String(error ?? "").trim();
  const lockedMinutes = parseLockMinutes(value);
  if (lockedMinutes !== null) return loginLockedMessage(lockedMinutes);
  return LOGIN_ERROR_MESSAGES[value] ?? "فشل الدخول: بيانات غير صحيحة.";
}

// أول دخول: تغيير كلمة المرور + إدخال بريد حقيقي، كلاهما مطلوب.
export function needsFirstLoginSetup(profile, options = {}) {
  if (options.preview) return false;
  return Boolean(profile?.must_change_password) || !String(profile?.email ?? "").trim();
}

// لا يُعاد هدف تحويل حين تكون الصفحة الحالية هي صفحة الحساب نفسها.
export function firstLoginDestination(profile, options = {}) {
  if (!needsFirstLoginSetup(profile, options)) return null;
  if (String(options.pathname ?? "").includes("account.html")) return null;
  return ACCOUNT_FIRST_PATH;
}

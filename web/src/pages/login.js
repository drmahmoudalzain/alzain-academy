import { supabase } from "../lib/supabase.js";
import { p } from "../lib/base.js";
import { getProfile, homeOf, setPreviewRole, clearPreviewRole, previewProfileFor } from "../lib/auth.js";
import {
  ACCOUNT_FIRST_PATH,
  loginIdentifierError,
  loginErrorMessage,
  loginLockedMessage,
  needsFirstLoginSetup,
  parseLockMinutes,
} from "../lib/identity-rules.js";

const form = document.getElementById("login-form");
const msg = document.getElementById("msg");
const submit = document.getElementById("submit");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");

// العودة إلى صفحة الدخول تعني الخروج من وضع المعاينة.
clearPreviewRole();

togglePassword?.addEventListener("click", () => {
  const show = passwordInput.type === "password";
  passwordInput.type = show ? "text" : "password";
  togglePassword.setAttribute("aria-pressed", String(show));
  togglePassword.setAttribute("aria-label", show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور");
  togglePassword.setAttribute("title", show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور");
  togglePassword.classList.toggle("is-visible", show);
});

document.querySelectorAll("[data-preview]").forEach((button) => {
  button.addEventListener("click", () => {
    const role = button.dataset.preview;
    const profile = previewProfileFor(role);
    if (!profile) return;
    button.disabled = true;
    setPreviewRole(role);
    location.assign(homeOf(profile));
  });
});

function setMessage(text, kind = "error") {
  msg.textContent = text;
  msg.classList.toggle("is-success", kind === "success");
  msg.classList.toggle("is-info", kind === "info");
}

function setBusy(busy) {
  submit.disabled = busy;
  submit.setAttribute("aria-busy", String(busy));
  submit.querySelector(".btn-label").textContent = busy ? "جاري الدخول…" : "تسجيل الدخول";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const identifier = document.getElementById("identifier").value.trim();
  const password = document.getElementById("password").value;
  if (!identifier || !password) {
    setMessage("أدخل الرمز وكلمة المرور.");
    return;
  }

  const identifierError = loginIdentifierError(identifier);
  if (identifierError) {
    setMessage(identifierError);
    return;
  }

  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    setMessage("الاتصال بقاعدة البيانات غير مهيأ. يمكنك استخدام أزرار المعاينة أدناه.");
    return;
  }

  setMessage("جاري الدخول…", "info");
  setBusy(true);

  try {
    // المسار الوحيد للدخول: كل فحص للبريد والقفل وكلمة المرور يتم في academy-login.
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/academy-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
      body: JSON.stringify({ platformId: identifier.toLowerCase(), password }),
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok || body?.ok !== true) {
      const lockedMinutes = parseLockMinutes(body?.error);
      setMessage(lockedMinutes !== null ? loginLockedMessage(lockedMinutes) : loginErrorMessage(body?.error));
      setBusy(false);
      return;
    }

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: body.access_token,
      refresh_token: body.refresh_token,
    });
    if (sessionError) {
      setMessage("فشل الدخول: بيانات غير صحيحة.");
      setBusy(false);
      return;
    }

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      setMessage("فشل الدخول: بيانات غير صحيحة.");
      setBusy(false);
      return;
    }

    const profile = await getProfile(authData.user);
    setMessage("تم الدخول. جارِ التحويل…", "success");
    location.assign(needsFirstLoginSetup(profile) ? p(ACCOUNT_FIRST_PATH) : homeOf(profile));
  } catch {
    setMessage("تعذّر الاتصال بالخادم. حاول مرة أخرى.");
    setBusy(false);
  }
});

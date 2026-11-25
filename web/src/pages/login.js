import { supabase } from "../lib/supabase.js";
import { getProfile, homeOf, setPreviewRole, clearPreviewRole, previewProfileFor } from "../lib/auth.js";

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

async function resolveEmail(identifier) {
  if (identifier.includes("@")) return identifier;
  const { data, error } = await supabase.rpc("login_email_for_identifier", { p_identifier: identifier });
  if (error) return null;
  return typeof data === "string" ? data : null;
}

async function legacyLogin(platformId, password) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/legacy-login`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
      body: JSON.stringify({ platformId, password }),
    });
    const body = await res.json().catch(() => ({}));
    return body?.ok === true;
  } catch {
    return false;
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const identifier = document.getElementById("identifier").value.trim();
  const password = document.getElementById("password").value;
  if (!identifier || !password) {
    setMessage("أدخل الرمز وكلمة المرور.");
    return;
  }

  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    setMessage("الاتصال بقاعدة البيانات غير مهيأ. يمكنك استخدام أزرار المعاينة أدناه.");
    return;
  }

  setMessage("جاري الدخول…", "info");
  setBusy(true);

  const email = await resolveEmail(identifier);
  if (!email) {
    setMessage("رمز غير معروف. تأكد من الرمز الأكاديمي أو الوظيفي.");
    setBusy(false);
    return;
  }

  let { data, error } = await supabase.auth.signInWithPassword({ email, password });

  // ترحيل كسول: إن لم يوجد حساب Auth بعد، ننشئه بكلمة المرور القديمة ثم نعيد المحاولة.
  if (error && !identifier.includes("@")) {
    const okLegacy = await legacyLogin(identifier.toLowerCase(), password);
    if (okLegacy) {
      ({ data, error } = await supabase.auth.signInWithPassword({ email, password }));
    }
  }

  if (error) {
    setMessage("فشل الدخول: بيانات غير صحيحة.");
    setBusy(false);
    return;
  }

  const profile = await getProfile(data.user);
  setMessage("تم الدخول. جارِ التحويل…", "success");
  location.assign(homeOf(profile));
});

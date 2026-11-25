import { supabase } from "../lib/supabase.js";
import { getProfile, homeOf } from "../lib/auth.js";
import { devLogins } from "../lib/dev-login.js";

const form = document.getElementById("login-form");
const msg = document.getElementById("msg");
const submit = document.getElementById("submit");

// أزرار تعبئة محلية للتطوير فقط؛ تبقى مخفية في الإنتاج حتى اكتمال المتغيرات.
const devBar = document.querySelector(".dev-logins");
const devEntries = devLogins({
  DEV: import.meta.env.DEV,
  MODE: import.meta.env.MODE,
  VITE_DEV_OWNER_ID: import.meta.env.VITE_DEV_OWNER_ID,
  VITE_DEV_OWNER_PASSWORD: import.meta.env.VITE_DEV_OWNER_PASSWORD,
  VITE_DEV_STUDENT_ID: import.meta.env.VITE_DEV_STUDENT_ID,
  VITE_DEV_STUDENT_PASSWORD: import.meta.env.VITE_DEV_STUDENT_PASSWORD,
  VITE_DEV_TEACHER_ID: import.meta.env.VITE_DEV_TEACHER_ID,
  VITE_DEV_TEACHER_PASSWORD: import.meta.env.VITE_DEV_TEACHER_PASSWORD,
  VITE_DEV_TEACHER2_ID: import.meta.env.VITE_DEV_TEACHER2_ID,
  VITE_DEV_TEACHER2_PASSWORD: import.meta.env.VITE_DEV_TEACHER2_PASSWORD,
});

if (devBar && devEntries.length) {
  devBar.hidden = false;
  devBar.querySelectorAll("[data-dev]").forEach((button) => {
    const entry = devEntries.find((item) => item.key === button.dataset.dev);
    if (!entry) {
      button.hidden = true;
      return;
    }
    button.addEventListener("click", () => {
      document.getElementById("identifier").value = entry.id;
      document.getElementById("password").value = entry.password;
      submit.focus();
    });
  });
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
    msg.textContent = "أدخل الرمز وكلمة المرور.";
    return;
  }

  msg.style.color = "";
  msg.textContent = "جاري الدخول…";
  submit.disabled = true;

  const email = await resolveEmail(identifier);
  if (!email) {
    msg.textContent = "رمز غير معروف. تأكد من الرمز الجامعي أو الوظيفي.";
    submit.disabled = false;
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
    msg.textContent = "فشل الدخول: بيانات غير صحيحة.";
    submit.disabled = false;
    return;
  }

  const profile = await getProfile(data.user);
  msg.style.color = "#0a0";
  msg.textContent = "تم الدخول. جارِ التحويل…";
  location.assign(homeOf(profile));
});

import { supabase } from "../lib/supabase.js";

const form = document.getElementById("login-form");
const msg = document.getElementById("msg");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.textContent = "جاري الدخول…";
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    msg.textContent = "فشل الدخول: " + error.message;
    return;
  }
  msg.style.color = "#0a0";
  msg.textContent = "تم الدخول بنجاح. user_id=" + data.user.id;
  console.log("session", data.session);
});
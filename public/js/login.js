// صفحة الدخول: إظهار كلمة المرور فقط — الإرسال يتم إلى الخادم مباشرة.
(function () {
  "use strict";

  const toggle = document.getElementById("togglePwd");
  const password = document.getElementById("password");
  const form = document.getElementById("loginForm");
  const submit = document.getElementById("submitBtn");

  if (toggle && password) {
    toggle.addEventListener("click", () => {
      const reveal = password.type === "password";
      password.type = reveal ? "text" : "password";
      toggle.classList.toggle("revealed", reveal);
      toggle.setAttribute("aria-pressed", String(reveal));
      toggle.setAttribute("aria-label", reveal ? "إخفاء كلمة المرور" : "إظهار كلمة المرور");
      password.focus();
    });
  }

  if (form && submit) {
    form.addEventListener("submit", () => {
      const label = submit.querySelector(".btn-text");
      if (label) label.textContent = "جارٍ التحقق...";
      submit.disabled = true;
    });
  }
})();

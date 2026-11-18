(function () {
      'use strict';

      const form       = document.getElementById('loginForm');
      const emailInput = document.getElementById('email');
      const pwdInput   = document.getElementById('password');
      const submitBtn  = document.getElementById('submitBtn');
      const togglePwd  = document.getElementById('togglePwd');
      const errorAlert = document.getElementById('errorAlert');
      const roleAlert  = document.getElementById('roleAlert');
      const errorTitle = document.getElementById('errorTitle');
      const errorMsg   = document.getElementById('errorMsg');
      const fillDemo   = document.getElementById('fillDemo');

      // إظهار/إخفاء كلمة المرور
      if (togglePwd) {
        togglePwd.addEventListener('click', () => {
          const isPwd = pwdInput.type === 'password';
          pwdInput.type = isPwd ? 'text' : 'password';
          togglePwd.classList.toggle('revealed', isPwd);
          togglePwd.setAttribute('aria-pressed', String(isPwd));
          togglePwd.setAttribute('aria-label', isPwd ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
          pwdInput.focus();
        });
      }

      // تعبئة البيانات التجريبية
      if (fillDemo) {
        fillDemo.addEventListener('click', () => {
          emailInput.value = fillDemo.dataset.email;
          pwdInput.value = fillDemo.dataset.password;
          emailInput.dispatchEvent(new Event('input', { bubbles: true }));
          pwdInput.dispatchEvent(new Event('input', { bubbles: true }));
          emailInput.focus();
        });
      }

      // اكتشاف حالات URL
      const params = new URLSearchParams(window.location.search);
      if (params.get('error') === 'role' || params.get('denied') === '1') {
        roleAlert.hidden = false;
      }
      if (params.get('error') === 'invalid') {
        errorTitle.textContent = 'بيانات الدخول غير صحيحة';
        errorMsg.textContent = 'تحقق من البريد الإلكتروني وكلمة المرور ثم أعد المحاولة.';
        errorAlert.hidden = false;
      }
      if (params.get('error') === 'inactive') {
        errorTitle.textContent = 'الحساب غير مُفعَّل';
        errorMsg.textContent = 'حسابك الحالي غير مفعّل — يرجى التواصل مع إدارة المنصة.';
        errorAlert.hidden = false;
      }

      // إظهار خطأ
      function showError(title, msg) {
        errorTitle.textContent = title;
        errorMsg.textContent = msg;
        errorAlert.hidden = false;
        errorAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      // التحقق
      function validate() {
        const email = emailInput.value.trim();
        const pwd = pwdInput.value;

        if (!email) {
          showError('حقل مطلوب', 'يرجى إدخال البريد الإلكتروني.');
          emailInput.focus();
          return false;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          showError('بريد غير صالح', 'يرجى إدخال بريد إلكتروني بصيغة صحيحة (example@domain.com).');
          emailInput.focus();
          return false;
        }
        if (!pwd) {
          showError('حقل مطلوب', 'يرجى إدخال كلمة المرور.');
          pwdInput.focus();
          return false;
        }
        if (pwd.length < 6) {
          showError('كلمة المرور قصيرة', 'يجب أن تكون كلمة المرور 6 أحرف على الأقل.');
          pwdInput.focus();
          return false;
        }
        return true;
      }

      // إرسال
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        errorAlert.hidden = true;
        roleAlert.hidden = true;

        if (!validate()) return;

        submitBtn.classList.add('loading');
        submitBtn.disabled = true;

        setTimeout(() => {
          submitBtn.classList.remove('loading');
          submitBtn.disabled = false;
          showError(
            'هذه واجهة تجريبية',
            'لم يتم ربط النموذج بالخادم بعد — سيتم تفعيل المصادقة عند اكتمال البناء.'
          );
        }, 1600);
      });

      // مسح عند الكتابة
      [emailInput, pwdInput].forEach((input) => {
        input.addEventListener('input', () => {
          errorAlert.hidden = true;
          roleAlert.hidden = true;
        });
      });

      // ESC
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          errorAlert.hidden = true;
          roleAlert.hidden = true;
        }
      });

      console.log(
        '%c[AlZain Academy]',
        'color:#2A5F94;font-weight:bold;font-size:13px;',
        'بوابة الأساتذة جاهزة — وضع تجريبي'
      );
    })();
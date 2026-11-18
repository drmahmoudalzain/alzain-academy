(function () {
      'use strict';

      const form            = document.getElementById('loginForm');
      const identifierInput = document.getElementById('identifier');
      const pwdInput        = document.getElementById('password');
      const submitBtn       = document.getElementById('submitBtn');
      const togglePwd       = document.getElementById('togglePwd');
      const errorAlert      = document.getElementById('errorAlert');
      const roleAlert       = document.getElementById('roleAlert');
      const mustChangeAlert = document.getElementById('mustChangeAlert');
      const errorTitle      = document.getElementById('errorTitle');
      const errorMsg        = document.getElementById('errorMsg');
      const fillDemo        = document.getElementById('fillDemo');
      const registerLink    = document.getElementById('registerLink');

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
          identifierInput.value = fillDemo.dataset.id;
          pwdInput.value = fillDemo.dataset.password;
          identifierInput.dispatchEvent(new Event('input', { bubbles: true }));
          pwdInput.dispatchEvent(new Event('input', { bubbles: true }));
          identifierInput.focus();
        });
      }

      // اكتشاف حالات URL
      const params = new URLSearchParams(window.location.search);
      if (params.get('error') === 'role' || params.get('denied') === '1') {
        roleAlert.hidden = false;
      }
      if (params.get('error') === 'invalid') {
        errorTitle.textContent = 'بيانات الدخول غير صحيحة';
        errorMsg.textContent = 'تحقق من الرقم الجامعي وكلمة المرور ثم أعد المحاولة.';
        errorAlert.hidden = false;
      }
      if (params.get('error') === 'inactive') {
        errorTitle.textContent = 'الحساب غير مُفعَّل';
        errorMsg.textContent = 'حسابك الحالي غير مفعّل — يرجى التواصل مع إدارة المنصة.';
        errorAlert.hidden = false;
      }
      if (params.get('must_change') === '1') {
        mustChangeAlert.hidden = false;
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
        const id = identifierInput.value.trim();
        const pwd = pwdInput.value;

        if (!id) {
          showError('حقل مطلوب', 'يرجى إدخال الرقم الجامعي أو البريد الإلكتروني.');
          identifierInput.focus();
          return false;
        }

        // إذا أدخل بريداً إلكترونياً، تحقق من صيغته
        if (id.includes('@')) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(id)) {
            showError('بريد غير صالح', 'يرجى إدخال بريد إلكتروني بصيغة صحيحة أو رقم جامعي.');
            identifierInput.focus();
            return false;
          }
        } else {
          // الرقم الجامعي: أرقام فقط (يمكن أن يكون 7 أو 8 أو 9 أرقام)
          const idRegex = /^\d{5,12}$/;
          if (!idRegex.test(id)) {
            showError('رقم جامعي غير صالح', 'الرقم الجامعي يجب أن يتكون من أرقام فقط (5 إلى 12 رقماً).');
            identifierInput.focus();
            return false;
          }
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
        mustChangeAlert.hidden = true;

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
      [identifierInput, pwdInput].forEach((input) => {
        input.addEventListener('input', () => {
          errorAlert.hidden = true;
          roleAlert.hidden = true;
          mustChangeAlert.hidden = true;
        });
      });

      // ESC
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          errorAlert.hidden = true;
          roleAlert.hidden = true;
          mustChangeAlert.hidden = true;
        }
      });

      // زر التسجيل (إن كان معطّلاً)
      if (registerLink) {
        registerLink.addEventListener('click', (e) => {
          e.preventDefault();
          showError(
            'التسجيل مغلق',
            'التسجيل حالياً مغلق — يرجى التواصل مع إدارة المنصة لطلب حساب طالب جديد.'
          );
        });
      }

      console.log(
        '%c[AlZain Academy]',
        'color:#166E3F;font-weight:bold;font-size:13px;',
        'بوابة الطلاب جاهزة — وضع تجريبي'
      );
    })();
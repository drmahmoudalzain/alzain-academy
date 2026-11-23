(function () {
      'use strict';

      const SUPABASE_URL = 'https://nsgahdnxpgctkljeusnp.supabase.co';
      const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zZ2FoZG54cGdjdGtsamV1c25wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ5OTg2NjMsImV4cCI6MjExMDU3NDY2M30.9De9nZY5EFLYFOEkzxIqfuP5MFsQJPI56G58slC8TyM';
      const sb = (window.supabase && window.supabase.createClient)
        ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
        : null;

      const form       = document.getElementById('loginForm');
      const submitBtn  = document.getElementById('submitBtn');
      const togglePwd  = document.getElementById('togglePwd');
      const errorAlert = document.getElementById('errorAlert');
      const roleAlert  = document.getElementById('roleAlert');
      const errorTitle = document.getElementById('errorTitle');
      const errorMsg   = document.getElementById('errorMsg');

      // إخفاء كل التنبيهات عند فتح البوابة (لا رسائل قبل الدخول)
      [errorAlert, roleAlert].forEach((a) => { if (a) a.hidden = true; });

      function showError(title, msg) {
        if (roleAlert) roleAlert.hidden = true;
        errorTitle.textContent = title;
        errorMsg.textContent = msg;
        errorAlert.hidden = false;
        errorAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      function showRoleError(msg) {
        errorAlert.hidden = true;
        roleAlert.querySelector('span').textContent = msg;
        roleAlert.hidden = false;
      }

      function setLoading(on) {
        submitBtn.classList.toggle('loading', on);
        submitBtn.disabled = on;
      }

      function authErrorText(err) {
        const m = (err && err.message) ? err.message : '';
        if (/invalid login credentials/i.test(m)) return 'البريد أو كلمة المرور غير صحيحة.';
        if (/email not confirmed/i.test(m)) return 'لم يتم تأكيد البريد الإلكتروني.';
        if (/too many requests/i.test(m)) return 'محاولات كثيرة — انتظر قليلاً ثم أعد المحاولة.';
        if (!sb) return 'تعذر تحميل عميل Supabase — تحقق من الاتصال بالإنترنت.';
        return m || 'تعذر الدخول — حاول مرة أخرى.';
      }

      if (togglePwd) {
        const pwdInput = document.getElementById('password');
        togglePwd.addEventListener('click', () => {
          const isPwd = pwdInput.type === 'password';
          pwdInput.type = isPwd ? 'text' : 'password';
          togglePwd.classList.toggle('revealed', isPwd);
          togglePwd.setAttribute('aria-pressed', String(isPwd));
          togglePwd.setAttribute('aria-label', isPwd ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
          pwdInput.focus();
        });
      }

      [errorAlert, roleAlert].forEach((a) => {
        if (a) a.addEventListener('click', () => { a.hidden = true; });
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          errorAlert.hidden = true;
          roleAlert.hidden = true;
        }
      });

      console.log(
        '%c[AlZain Academy]',
        'color:#166E3F;font-weight:bold;font-size:13px;',
        'بوابة الطلاب — متصل بـ Supabase'
      );


      const identifierInput = document.getElementById('identifier');
      const pwdInput        = document.getElementById('password');
      const fillDemo        = document.getElementById('fillDemo');
      const mustChangeAlert = document.getElementById('mustChangeAlert');
      const registerLink    = document.getElementById('registerLink');

      if (mustChangeAlert) mustChangeAlert.hidden = true;

      if (fillDemo) {
        fillDemo.addEventListener('click', () => {
          identifierInput.value = fillDemo.dataset.id;
          pwdInput.value = fillDemo.dataset.password;
          identifierInput.dispatchEvent(new Event('input', { bubbles: true }));
          identifierInput.focus();
        });
      }

      [identifierInput, pwdInput].forEach((input) => {
        input.addEventListener('input', () => {
          errorAlert.hidden = true;
          roleAlert.hidden = true;
          if (mustChangeAlert) mustChangeAlert.hidden = true;
        });
      });

      function validate() {
        const id = identifierInput.value.trim();
        if (!id) { showError('حقل مطلوب', 'يرجى إدخال الرقم الجامعي أو البريد الإلكتروني.'); identifierInput.focus(); return false; }
        if (id.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id)) { showError('بريد غير صالح', 'يرجى إدخال بريد صحيح أو رقم جامعي.'); identifierInput.focus(); return false; }
        if (!id.includes('@') && !/^\d{5,12}$/.test(id)) { showError('رقم جامعي غير صالح', 'الرقم الجامعي يجب أن يتكون من أرقام فقط.'); identifierInput.focus(); return false; }
        if (!pwdInput.value) { showError('حقل مطلوب', 'يرجى إدخال كلمة المرور.'); pwdInput.focus(); return false; }
        if (pwdInput.value.length < 6) { showError('كلمة المرور قصيرة', 'يجب أن تكون كلمة المرور 6 أحرف على الأقل.'); pwdInput.focus(); return false; }
        return true;
      }

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorAlert.hidden = true;
        roleAlert.hidden = true;
        if (mustChangeAlert) mustChangeAlert.hidden = true;
        if (!validate() || !sb) { if (!sb) showError('خطأ', authErrorText(null)); return; }

        setLoading(true);
        try {
          // الرقم الجامعي → بريد Auth (RPC حي)
          const { data: email, error: resolveErr } = await sb.rpc('login_email_for_identifier', {
            p_identifier: identifierInput.value.trim(),
          });
          if (resolveErr || !email) {
            setLoading(false);
            showError('فشل الدخول', 'لم يتم العثور على حساب بهذا الرقم الجامعي.');
            return;
          }

          const { error } = await sb.auth.signInWithPassword({ email, password: pwdInput.value });
          if (error) { setLoading(false); showError('فشل الدخول', authErrorText(error)); return; }

          const { data: role, error: roleErr } = await sb.rpc('current_user_role');
          if (roleErr || role !== 'student') {
            await sb.auth.signOut();
            setLoading(false);
            showRoleError('هذه البوابة للطلاب فقط — حسابك ليس طالباً.');
            return;
          }
          window.location.hash = '#/student';
        } catch (err) {
          setLoading(false);
          showError('خطأ', authErrorText(err));
        }
      });

      if (registerLink) {
        registerLink.addEventListener('click', (e) => {
          e.preventDefault();
          showError('التسجيل مغلق', 'يرجى التواصل مع إدارة المنصة لطلب حساب طالب جديد.');
        });
      }
    })();

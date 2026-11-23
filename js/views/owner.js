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
        'color:#D4A017;font-weight:bold;font-size:13px;',
        'بوابة المالك — متصل بـ Supabase'
      );


      const emailInput = document.getElementById('email');
      const pwdInput   = document.getElementById('password');
      const fillDemo   = document.getElementById('fillDemo');

      if (fillDemo) {
        fillDemo.addEventListener('click', () => {
          emailInput.value = fillDemo.dataset.email;
          pwdInput.value = fillDemo.dataset.password;
          emailInput.dispatchEvent(new Event('input', { bubbles: true }));
          pwdInput.focus();
        });
      }

      [emailInput, pwdInput].forEach((input) => {
        input.addEventListener('input', () => {
          errorAlert.hidden = true;
          roleAlert.hidden = true;
        });
      });

      function validate() {
        const email = emailInput.value.trim();
        if (!email) { showError('حقل مطلوب', 'يرجى إدخال البريد الإلكتروني.'); emailInput.focus(); return false; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError('بريد غير صالح', 'يرجى إدخال بريد إلكتروني بصيغة صحيحة.'); emailInput.focus(); return false; }
        if (!pwdInput.value) { showError('حقل مطلوب', 'يرجى إدخال كلمة المرور.'); pwdInput.focus(); return false; }
        if (pwdInput.value.length < 6) { showError('كلمة المرور قصيرة', 'يجب أن تكون كلمة المرور 6 أحرف على الأقل.'); pwdInput.focus(); return false; }
        return true;
      }

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorAlert.hidden = true;
        roleAlert.hidden = true;
        if (!validate() || !sb) { if (!sb) showError('خطأ', authErrorText(null)); return; }

        setLoading(true);
        try {
          const { error } = await sb.auth.signInWithPassword({
            email: emailInput.value.trim(),
            password: pwdInput.value,
          });
          if (error) { setLoading(false); showError('فشل الدخول', authErrorText(error)); return; }

          const { data: isOwner, error: roleErr } = await sb.rpc('is_owner');
          if (roleErr || !isOwner) {
            await sb.auth.signOut();
            setLoading(false);
            showRoleError('هذه البوابة للمالك فقط — حسابك ليس مالكاً.');
            return;
          }
          window.location.hash = '#/';
        } catch (err) {
          setLoading(false);
          showError('خطأ', authErrorText(err));
        }
      });
    })();

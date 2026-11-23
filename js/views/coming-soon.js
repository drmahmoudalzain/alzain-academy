(function () {
  'use strict';

  const SUPABASE_URL = 'https://nsgahdnxpgctkljeusnp.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zZ2FoZG54cGdjdGtsamV1c25wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ5OTg2NjMsImV4cCI6MjExMDU3NDY2M30.9De9nZY5EFLYFOEkzxIqfuP5MFsQJPI56G58slC8TyM';
  const sb = (window.supabase && window.supabase.createClient)
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  const signOutBtn  = document.getElementById('signOutBtn');
  const sessionPill = document.getElementById('sessionPill');
  const portalLabel = document.getElementById('soonPortal');

  async function showSession() {
    if (!sb) return;
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return;

      const email = session.user.email || '';
      let role = '';
      try {
        const { data: isOwner } = await sb.rpc('is_owner');
        role = isOwner ? 'المالك' : 'الأستاذ';
      } catch (_) { /* تجاهل تعذر قراءة الدور */ }

      if (portalLabel && role) portalLabel.textContent = 'مرحباً ' + role + ' — تم تسجيل الدخول بنجاح';
      if (sessionPill) {
        sessionPill.textContent = email || 'حساب مسجّل الدخول';
        sessionPill.hidden = false;
      }
      if (signOutBtn) signOutBtn.hidden = false;
    } catch (err) {
      console.warn('[AlZain] session check failed:', err);
    }
  }

  if (signOutBtn) {
    signOutBtn.addEventListener('click', async () => {
      if (!sb) return;
      signOutBtn.disabled = true;
      try {
        await sb.auth.signOut();
        window.location.hash = '#/';
      } catch (err) {
        console.warn('[AlZain] sign out failed:', err);
        signOutBtn.disabled = false;
      }
    });
  }

  showSession();
  document.documentElement.dataset.loginReady = 'coming-soon';
})();

(function () {
      'use strict';

      const sidebar = document.getElementById('sidebar');
      const menuBtn = document.getElementById('menuBtn');

      // تبديل الشريط الجانبي على الجوال
      if (menuBtn) {
        menuBtn.addEventListener('click', () => {
          sidebar.classList.toggle('open');
        });
      }

      // إغلاق الشريط عند النقر خارجياً على الجوال
      document.addEventListener('click', (e) => {
        if (
          window.innerWidth <= 900 &&
          sidebar.classList.contains('open') &&
          !sidebar.contains(e.target) &&
          !menuBtn.contains(e.target)
        ) {
          sidebar.classList.remove('open');
        }
      });

      // إغلاق الشريط بمفتاح ESC
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar.classList.contains('open')) {
          sidebar.classList.remove('open');
        }
      });

      // تفعيل عناصر القائمة
      const navItems = document.querySelectorAll('.nav-item');
      navItems.forEach((item) => {
        item.addEventListener('click', (e) => {
          e.preventDefault();
          navItems.forEach((n) => n.classList.remove('active'));
          item.classList.add('active');
        });
      });

      // حركة الأشرطة
      const progressBars = document.querySelectorAll('.progress-bar > span');
      const progressObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const span = entry.target;
            const target = span.style.width;
            span.style.width = '0%';
            setTimeout(() => { span.style.width = target; }, 100);
            progressObserver.unobserve(span);
          }
        });
      }, { threshold: 0.3 });
      progressBars.forEach((bar) => progressObserver.observe(bar));

      console.log(
        '%c[AlZain Academy]',
        'color:#166E3F;font-weight:bold;font-size:13px;',
        'لوحة الطالب جاهزة'
      );
    })();

// ---- بيانات حية من Supabase (لا بيانات تجريبية) ----
    (async () => {
      try {
        if (!window.supabase) {
          await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
            s.onload = resolve; s.onerror = reject;
            document.head.appendChild(s);
          });
        }
        const sb = window.supabase.createClient(
          'https://nsgahdnxpgctkljeusnp.supabase.co',
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zZ2FoZG54cGdjdGtsamV1c25wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ5OTg2NjMsImV4cCI6MjExMDU3NDY2M30.9De9nZY5EFLYFOEkzxIqfuP5MFsQJPI56G58slC8TyM'
        );
        const { data: { session } } = await sb.auth.getSession();
        if (!session) return;

        const { data: res, error } = await sb.rpc('student_dashboard');
        if (error) throw error;
        if (!res || !res.ok) return;
        const d = res.data;

        const $  = (s, r) => (r || document).querySelector(s);
        const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
        const fmt = (n) => Number(n || 0).toLocaleString('ar-EG');

        function empty(el, text) {
          if (!el) return;
          el.innerHTML = '';
          const p = document.createElement('div');
          p.className = 'empty-state';
          p.style.cssText = 'padding:26px 18px;text-align:center;color:var(--muted,#8fa3bb);font-size:14px;';
          p.textContent = text;
          el.appendChild(p);
        }
        function iconSpan(text, color) {
          const e = document.createElement('div');
          e.className = 'course-icon';
          e.style.setProperty('--course-color', color || '#123A63');
          e.textContent = text;
          return e;
        }
        function el(tag, cls, text) {
          const e = document.createElement(tag);
          if (cls) e.className = cls;
          if (text !== undefined && text !== null) e.textContent = text;
          return e;
        }

        // 1) هوية المستخدم الحقيقية
        const name = (d.user && d.user.name) || 'طالب';
        const pid  = (d.user && d.user.platform_id) || '';
        $$('.user-info strong').forEach((e) => { e.textContent = name; });
        $$('.user-info span').forEach((e) => { e.textContent = pid; });
        $$('.welcome-content .name').forEach((e) => { e.textContent = name; });
        $$('.user-avatar').forEach((e) => { e.textContent = name.charAt(0); });

        // 2) رسالة الترحيب بالأرقام الحقيقية
        const welcomeP = $('.welcome-content p');
        if (welcomeP) {
          welcomeP.textContent = (d.today_lectures || d.upcoming_exams || d.pending_assignments)
            ? 'لديك ' + d.today_lectures + ' محاضرات اليوم، و' + d.upcoming_exams + ' اختبارات قادمة، و' + d.pending_assignments + ' واجبات مستحقة التسليم.'
            : 'لا توجد محاضرات أو اختبارات أو واجبات مستحقة حالياً.';
        }

        // 3) بطاقات الإحصاء (إزالة الأرقام الوهمية)
        const cards = $$('.stat-card');
        const values = [
          fmt(d.courses_count) + ' <small>مقررات</small>',
          fmt(d.attendance_pct) + '<small>%</small>',
          fmt(d.points_total) + ' <small>نقطة</small>',
          fmt(d.upcoming_exams) + ' <small>اختبارات</small>',
        ];
        cards.forEach((c, i) => {
          const v = $('.stat-value', c);
          if (v && values[i] !== undefined) v.innerHTML = values[i];
          const trend = $('.stat-trend', c);
          if (trend) {
            const svg = trend.querySelector('svg');
            trend.textContent = '';
            if (svg) trend.appendChild(svg);
            trend.appendChild(document.createTextNode('حي'));
          }
        });

        // 4) شارات الشريط الجانبي
        const badges = $$('.nav-badge');
        const badgeCounts = [d.courses_count, d.upcoming_exams, d.notifications.length];
        badges.forEach((b, i) => {
          const n = badgeCounts[i] || 0;
          b.textContent = n;
          b.hidden = n === 0;
        });

        // 5) المقررات
        const coursesBox = $('.courses-list');
        if (coursesBox) {
          coursesBox.innerHTML = '';
          const courses = d.courses || [];
          if (!courses.length) {
            empty(coursesBox, 'لا توجد مقررات مسجّلة حالياً.');
          } else {
            courses.forEach((c) => {
              const item = el('div', 'course-item');
              item.appendChild(iconSpan((c.code || c.title || 'C').slice(0, 2).toUpperCase(), c.color));
              const info = el('div', 'course-info');
              info.appendChild(el('h4', null, c.title));
              const meta = el('div', 'course-meta');
              if (c.level) meta.appendChild(el('span', null, 'المستوى ' + c.level));
              if (c.teacher) meta.appendChild(el('span', null, c.teacher));
              info.appendChild(meta);
              item.appendChild(info);
              const prog = el('div', 'course-progress');
              prog.appendChild(el('span', 'progress-label', (c.progress || 0) + '%'));
              const bar = el('div', 'progress-bar');
              const inner = el('span');
              inner.style.width = (c.progress || 0) + '%';
              bar.appendChild(inner);
              prog.appendChild(bar);
              item.appendChild(prog);
              coursesBox.appendChild(item);
            });
          }
        }

        // 6) المحاضرات القادمة
        const lecturesBox = $('.lectures-list');
        if (lecturesBox) {
          lecturesBox.innerHTML = '';
          const lectures = d.lectures || [];
          if (!lectures.length) {
            empty(lecturesBox, 'لا توجد محاضرات قادمة حالياً.');
          } else {
            const labels = { direct: 'مباشر', online: 'أونلاين', recorded: 'مسجل' };
            lectures.forEach((l) => {
              const dt = l.scheduled_at ? new Date(l.scheduled_at) : new Date();
              const item = el('div', 'lecture-item' + (l.lecture_type === 'direct' ? ' live' : ''));
              const dateBox = el('div', 'lecture-date');
              dateBox.appendChild(el('span', 'day', String(dt.getDate())));
              dateBox.appendChild(el('span', 'month', dt.toLocaleDateString('ar-EG', { month: 'short' })));
              item.appendChild(dateBox);
              const info = el('div', 'lecture-info');
              info.appendChild(el('h4', null, (l.course ? l.course + ' — ' : '') + l.title));
              const sub = el('div', 'lecture-sub');
              sub.appendChild(el('span', null, dt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })));
              info.appendChild(sub);
              item.appendChild(info);
              item.appendChild(el('span', 'lecture-type ' + (l.lecture_type || 'direct'), labels[l.lecture_type] || 'مباشر'));
              lecturesBox.appendChild(item);
            });
          }
        }

        // 7) النقاط
        const pt = $('.points-value .num');
        if (pt) pt.textContent = fmt(d.points_total);
        const ptMeta = $('.points-meta');
        if (ptMeta) ptMeta.hidden = true;
        const breakdown = $('.points-breakdown');
        if (breakdown) {
          breakdown.innerHTML = '';
          const map = { attendance: 'الحضور', interaction: 'التفاعل', assignment: 'الواجبات' };
          const dots = { attendance: 'att', interaction: 'int', assignment: 'asg' };
          const pb = d.points_breakdown || {};
          const keys = Object.keys(pb);
          if (!keys.length) {
            empty(breakdown, 'لا توجد نقاط مسجّلة بعد.');
          } else {
            keys.forEach((k) => {
              const row = el('div', 'points-row');
              const label = el('span', 'label');
              label.appendChild(el('span', 'dot ' + (dots[k] || '')));
              label.appendChild(document.createTextNode(map[k] || k));
              row.appendChild(label);
              row.appendChild(el('strong', null, fmt(pb[k])));
              breakdown.appendChild(row);
            });
          }
        }

        // 8) الإشعارات
        const notifBox = $('.notifications-list');
        if (notifBox) {
          notifBox.innerHTML = '';
          const items = d.notifications || [];
          if (!items.length) {
            empty(notifBox, 'لا توجد إشعارات جديدة.');
          } else {
            items.forEach((n) => {
              const item = el('div', 'notif-item unread');
              const content = el('div', 'notif-content');
              content.appendChild(el('h5', null, n.title));
              content.appendChild(el('p', null, n.body || ''));
              const time = el('time');
              time.textContent = n.created_at ? new Date(n.created_at).toLocaleDateString('ar-EG') : '';
              content.appendChild(time);
              item.appendChild(content);
              notifBox.appendChild(item);
            });
          }
        }

        // 9) الجدول الأسبوعي: لا نعرض جدولاً وهمياً
        const week = $('.week-grid');
        if (week) empty(week, 'لا يوجد جدول أسبوعي منشور حالياً.');

        console.log('[AlZain] لوحة الطالب تعرض بيانات حية من Supabase');
      } catch (e) {
        console.error('[AlZain] live dashboard error:', e);
      }
    })();

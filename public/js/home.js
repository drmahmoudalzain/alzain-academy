
    (function () {
      'use strict';

      // ============ تفعيل تأثير التمرير على الهيدر ============
      const header = document.getElementById('header');
      let lastScroll = 0;
      window.addEventListener('scroll', () => {
        const y = window.scrollY;
        if (y > 30) header.classList.add('scrolled');
        else header.classList.remove('scrolled');
        lastScroll = y;
      }, { passive: true });

      // ============ قائمة الجوال ============
      const menuToggle = document.getElementById('menuToggle');
      const navLinks = document.querySelector('.nav-links');
      if (menuToggle) {
        menuToggle.addEventListener('click', () => {
          const isOpen = navLinks && navLinks.style.display === 'flex';
          if (navLinks) {
            navLinks.style.display = isOpen ? 'none' : 'flex';
            if (!isOpen) {
              navLinks.style.position = 'absolute';
              navLinks.style.top = '100%';
              navLinks.style.right = '0';
              navLinks.style.left = '0';
              navLinks.style.flexDirection = 'column';
              navLinks.style.background = 'rgba(11,37,69,0.98)';
              navLinks.style.padding = '20px';
              navLinks.style.borderBottom = '1px solid var(--border-soft)';
              navLinks.style.gap = '4px';
              navLinks.style.zIndex = '99';
            }
          }
        });
      }

      // ============ كشف العناصر عند التمرير ============
      const revealEls = document.querySelectorAll('.reveal');
      if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('visible');
              observer.unobserve(entry.target);
            }
          });
        }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
        revealEls.forEach((el) => observer.observe(el));
      } else {
        revealEls.forEach((el) => el.classList.add('visible'));
      }

      // ============ تمرير سلس لروابط القائمة ============
      document.querySelectorAll('a[href^="#"]').forEach((link) => {
        link.addEventListener('click', (e) => {
          const targetId = link.getAttribute('href');
          if (targetId.length > 1) {
            const target = document.querySelector(targetId);
            if (target) {
              e.preventDefault();
              const offset = 80;
              const top = target.getBoundingClientRect().top + window.scrollY - offset;
              window.scrollTo({ top, behavior: 'smooth' });
              // إغلاق قائمة الجوال إن كانت مفتوحة
              if (navLinks && window.innerWidth <= 860) {
                navLinks.style.display = 'none';
              }
            }
          }
        });
      });

      // ============ عدّادات الإحصاءات ============
      const statValues = document.querySelectorAll('.stat-value');
      const statObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target;
            const text = el.textContent.trim();
            const match = text.match(/\+?(\d+)/);
            if (!match) return;
            const target = parseInt(match[1], 10);
            const prefix = text.startsWith('+') ? '+' : '';
            let current = 0;
            const duration = 1600;
            const start = performance.now();
            function step(now) {
              const p = Math.min((now - start) / duration, 1);
              const eased = 1 - Math.pow(1 - p, 3);
              current = Math.floor(eased * target);
              el.textContent = prefix + current;
              if (p < 1) requestAnimationFrame(step);
              else el.textContent = prefix + target;
            }
            requestAnimationFrame(step);
            statObserver.unobserve(el);
          }
        });
      }, { threshold: 0.5 });
      statValues.forEach((el) => statObserver.observe(el));

      // ============ تحديث دوري للإحصاءات من قاعدة البيانات ============
      (function setupStatsPolling() {
        const bar = document.querySelector('[data-stats-bar]');
        if (!bar) return;
        const fmt = new Intl.NumberFormat('ar', { numberingSystem: 'latn' });
        async function refresh() {
          try {
            const res = await fetch('/api/public-stats', { cache: 'no-store' });
            if (!res.ok) return;
            const data = await res.json();
            const map = {
              students: data.students,
              courses: data.courses,
              lectures: data.lectures,
              libraryItems: data.libraryItems,
            };
            bar.querySelectorAll('[data-stat]').forEach((el) => {
              const key = el.getAttribute('data-stat');
              if (!(key in map)) return;
              const v = el.querySelector('.stat-value');
              if (v) v.textContent = fmt.format(map[key] ?? 0);
            });
          } catch (e) { /* تجاهل أخطاء الشبكة */ }
        }
        // تحديث أولي بعد 5 ثوانٍ، ثم كل 30 ثانية
        setTimeout(refresh, 5000);
        setInterval(refresh, 30000);
        // تحديث عند عودة التبويب للتركيز
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') refresh();
        });
      })();

      // ============ Parallax خفيف للشعار ============
      const emblemLarge = document.querySelector('.emblem-large');
      if (emblemLarge && window.matchMedia('(pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        let rafId = null;
        let tx = 0, ty = 0, cx = 0, cy = 0;
        window.addEventListener('mousemove', (e) => {
          const rect = emblemLarge.getBoundingClientRect();
          if (rect.bottom < 0 || rect.top > window.innerHeight) return;
          const mx = rect.left + rect.width / 2;
          const my = rect.top + rect.height / 2;
          tx = (e.clientX - mx) / 40;
          ty = (e.clientY - my) / 40;
          if (!rafId) rafId = requestAnimationFrame(loop);
        });
        function loop() {
          cx += (tx - cx) * 0.08;
          cy += (ty - cy) * 0.08;
          emblemLarge.style.transform = `translate(${cx}px, ${cy}px)`;
          if (Math.abs(tx - cx) > 0.05 || Math.abs(ty - cy) > 0.05) {
            rafId = requestAnimationFrame(loop);
          } else rafId = null;
        }
      }

      console.log('%c[AlZain Academy]', 'color:#D4A017;font-weight:bold;font-size:14px;', 'الصفحة الرئيسية جاهزة');
    })();
  
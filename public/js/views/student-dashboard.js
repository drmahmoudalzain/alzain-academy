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
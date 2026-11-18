(function () {
      'use strict';

      const sidebar = document.getElementById('sidebar');
      const menuBtn = document.getElementById('menuBtn');

      // ============ الشريط الجانبي على الجوال ============
      if (menuBtn) {
        menuBtn.addEventListener('click', () => {
          sidebar.classList.toggle('open');
        });
      }

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

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar.classList.contains('open')) {
          sidebar.classList.remove('open');
        }
      });

      // ============ فلترة المحاضرات ============
      const filterTabs = document.querySelectorAll('.filter-tab');
      const courseFilter = document.getElementById('courseFilter');
      const lecturesGrid = document.getElementById('lecturesGrid');
      const lectureCards = Array.from(document.querySelectorAll('.lecture-card'));
      const mainSearch = document.getElementById('mainSearch');
      const loadMoreBtn = document.getElementById('loadMoreBtn');

      let currentType = 'all';
      let currentCourse = 'all';
      let currentSearch = '';

      function applyFilters() {
        let visibleCount = 0;
        lectureCards.forEach((card) => {
          const type = card.dataset.type;
          const course = card.dataset.course;
          const text = card.textContent.toLowerCase();

          const matchType = currentType === 'all' || type === currentType;
          const matchCourse = currentCourse === 'all' || course === currentCourse;
          const matchSearch = currentSearch === '' || text.includes(currentSearch);

          if (matchType && matchCourse && matchSearch) {
            card.style.display = '';
            card.style.animation = 'fadeInUp 0.35s ease';
            visibleCount++;
          } else {
            card.style.display = 'none';
          }
        });

        // حالة فارغة
        let emptyEl = lecturesGrid.querySelector('.empty-state');
        if (visibleCount === 0) {
          if (!emptyEl) {
            emptyEl = document.createElement('div');
            emptyEl.className = 'empty-state';
            emptyEl.innerHTML = `
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
                <path d="M8 8l6 6M14 8l-6 6" />
              </svg>
              <h3>لا توجد محاضرات مطابقة</h3>
              <p>جرّب تغيير الفلاتر أو كلمة البحث للعثور على المحاضرات التي تبحث عنها.</p>
            `;
            lecturesGrid.appendChild(emptyEl);
          }
        } else if (emptyEl) {
          emptyEl.remove();
        }
      }

      filterTabs.forEach((tab) => {
        tab.addEventListener('click', () => {
          filterTabs.forEach((t) => {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
          });
          tab.classList.add('active');
          tab.setAttribute('aria-selected', 'true');
          currentType = tab.dataset.filter;
          applyFilters();
        });
      });

      if (courseFilter) {
        courseFilter.addEventListener('change', () => {
          currentCourse = courseFilter.value;
          applyFilters();
        });
      }

      if (mainSearch) {
        let searchTimeout;
        mainSearch.addEventListener('input', (e) => {
          clearTimeout(searchTimeout);
          searchTimeout = setTimeout(() => {
            currentSearch = e.target.value.toLowerCase().trim();
            applyFilters();
          }, 220);
        });
      }

      // ============ تبديل طريقة العرض ============
      const viewButtons = document.querySelectorAll('.view-toggle button');
      viewButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          viewButtons.forEach((b) => {
            b.classList.remove('active');
            b.setAttribute('aria-pressed', 'false');
          });
          btn.classList.add('active');
          btn.setAttribute('aria-pressed', 'true');

          if (btn.dataset.view === 'list') {
            lecturesGrid.classList.add('list-view');
          } else {
            lecturesGrid.classList.remove('list-view');
          }
        });
      });

      // ============ Load More ============
      if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
          loadMoreBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 0.8s linear infinite;">
              <path d="M21 12a9 9 0 1 1-6.22-8.56" />
            </svg>
            جارٍ التحميل...
          `;
          loadMoreBtn.disabled = true;
          setTimeout(() => {
            loadMoreBtn.innerHTML = 'تم تحميل جميع المحاضرات';
            loadMoreBtn.style.cursor = 'default';
          }, 1400);
        });
      }

      // ============ زر ESC لإغلاق ============
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          // إغلاق أي عناصر مفتوحة
        }
      });

      // ============ حركة دخول البطاقات ============
      const styleEl = document.createElement('style');
      styleEl.textContent = `
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(styleEl);

      // ============ انيميشن أشرطة الحضور ============
      const attendanceBars = document.querySelectorAll('.attendance-bar > span');
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const span = entry.target;
            const targetWidth = span.style.width;
            span.style.width = '0%';
            setTimeout(() => { span.style.width = targetWidth; }, 80);
            observer.unobserve(span);
          }
        });
      }, { threshold: 0.3 });
      attendanceBars.forEach((bar) => observer.observe(bar));

      console.log(
        '%c[AlZain Academy]',
        'color:#166E3F;font-weight:bold;font-size:13px;',
        'صفحة المحاضرات جاهزة'
      );
    })();
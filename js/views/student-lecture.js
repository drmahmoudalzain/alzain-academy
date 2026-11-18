(function () {
      'use strict';

      const sidebar = document.getElementById('sidebar');
      const menuBtn = document.getElementById('menuBtn');

      if (menuBtn) {
        menuBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
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

      // ============ Tabs ============
      const tabBtns = document.querySelectorAll('.tab-btn');
      const tabPanes = document.querySelectorAll('.tab-pane');

      tabBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          tabBtns.forEach((b) => {
            b.classList.remove('active');
            b.setAttribute('aria-selected', 'false');
          });
          tabPanes.forEach((p) => p.classList.remove('active'));

          btn.classList.add('active');
          btn.setAttribute('aria-selected', 'true');
          const pane = document.querySelector(`.tab-pane[data-pane="${btn.dataset.tab}"]`);
          if (pane) pane.classList.add('active');
        });
      });

      // ============ Questions interaction ============
      document.querySelectorAll('.question-card').forEach((card) => {
        const options = card.querySelectorAll('.option-btn');
        const submitBtn = card.querySelector('.submit-answer');
        let selectedIndex = -1;

        options.forEach((opt, idx) => {
          opt.addEventListener('click', () => {
            if (opt.classList.contains('disabled')) return;
            options.forEach((o) => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedIndex = idx;
            if (submitBtn) submitBtn.disabled = false;
          });
        });

        if (submitBtn) {
          submitBtn.addEventListener('click', () => {
            if (selectedIndex < 0) return;
            const correctIndex = parseInt(card.dataset.correct, 10);

            options.forEach((o, i) => {
              o.classList.add('disabled');
              o.classList.remove('selected');
              if (correctIndex >= 0) {
                if (i === correctIndex) o.classList.add('correct');
                else if (i === selectedIndex) o.classList.add('wrong');
              }
            });

            const statusEl = card.querySelector('.question-status-open');
            if (statusEl) {
              statusEl.textContent = 'تم الإرسال';
              statusEl.style.background = 'var(--bg-subtle)';
              statusEl.style.color = 'var(--text-muted)';
              statusEl.style.border = '1px solid var(--border)';
            }

            submitBtn.disabled = true;
            submitBtn.textContent = correctIndex >= 0
              ? (selectedIndex === correctIndex ? '✓ إجابة صحيحة' : '✗ إجابة خاطئة')
              : '✓ تم الإرسال';
            submitBtn.style.opacity = '0.7';

            if (correctIndex >= 0 && selectedIndex === correctIndex) {
              console.log('إجابة صحيحة! +2 نقطة');
            }
          });
        }
      });

      // ============ Attendance Timer ============
      const attendanceTimer = document.getElementById('attendanceTimer');
      const attendanceProgress = document.getElementById('attendanceProgress');
      const pointsEarned = document.getElementById('pointsEarned');

      let elapsedSeconds = 25 * 60 + 14; // يبدأ من 25:14
      const TOTAL_SECONDS = 120 * 60;

      function formatTime(sec) {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      }

      function updateAttendance() {
        if (attendanceTimer) {
          attendanceTimer.textContent = formatTime(elapsedSeconds);
        }
        const progressPercent = Math.min((elapsedSeconds / TOTAL_SECONDS) * 100, 100);
        if (attendanceProgress) attendanceProgress.style.width = progressPercent + '%';
        const points = Math.min(Math.floor(elapsedSeconds / 600), 10);
        if (pointsEarned) pointsEarned.textContent = `${points} / 10 نقاط`;
      }

      updateAttendance();
      setInterval(() => {
        if (elapsedSeconds < TOTAL_SECONDS) {
          elapsedSeconds += 1;
          updateAttendance();
        }
      }, 1000);

      // ============ Attendance Code Form ============
      const attendanceForm = document.getElementById('attendanceForm');
      const attendanceCode = document.getElementById('attendanceCode');

      if (attendanceForm) {
        attendanceForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const code = attendanceCode.value.trim();
          if (code.length < 4) {
            attendanceCode.style.borderColor = 'var(--danger)';
            setTimeout(() => { attendanceCode.style.borderColor = ''; }, 1200);
            return;
          }
          attendanceForm.innerHTML = `
            <div class="heartbeat-indicator" style="grid-column:1/-1;justify-content:center;">
              <span class="heartbeat-dot"></span>
              <span>تم تسجيل الحضور بنجاح! +${Math.min(Math.floor(elapsedSeconds/600), 10)} نقطة</span>
            </div>
          `;
        });
      }

      // ============ Video Play Button ============
      const videoPlay = document.querySelector('.video-play');
      if (videoPlay) {
        videoPlay.addEventListener('click', () => {
          videoPlay.innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          `;
          videoPlay.setAttribute('aria-label', 'إيقاف مؤقت');
          videoPlay.style.background = 'rgba(199,56,56,0.2)';
          videoPlay.style.borderColor = 'var(--danger)';
          videoPlay.style.boxShadow = '0 0 40px rgba(199,56,56,0.4)';

          // استبدال المحتوى بـ "قيد التشغيل"
          const wrapper = videoPlay.closest('.video-wrapper');
          if (wrapper) {
            const overlay = wrapper.querySelector('.video-overlay');
            if (overlay) {
              const liveBadge = overlay.querySelector('.video-live-badge');
              if (liveBadge) liveBadge.style.display = 'none';
            }
          }
        });
      }

      console.log(
        '%c[AlZain Academy]',
        'color:#166E3F;font-weight:bold;font-size:13px;',
        'صفحة تفاصيل المحاضرة جاهزة'
      );
    })();
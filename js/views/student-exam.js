(function () {
      'use strict';

      // =========================================================
      // بيانات الاختبار (20 سؤالاً)
      // =========================================================
      const questions = [
        {
          id: 1,
          type: 'mcq',
          points: 2,
          text: 'أي مما يلي يُعدّ من أوامر SQL الأساسية لاسترجاع البيانات من جدول؟',
          options: ['INSERT', 'SELECT', 'UPDATE', 'DELETE'],
          correct: 1
        },
        {
          id: 2,
          type: 'mcq',
          points: 2,
          text: 'ما هو المفتاح الذي يميّز كل صف في الجدول بشكل فريد؟',
          options: ['Foreign Key', 'Primary Key', 'Candidate Key', 'Composite Key'],
          correct: 1
        },
        {
          id: 3,
          type: 'truefalse',
          points: 2,
          text: 'يمكن أن يحتوي الجدول على أكثر من مفتاح أساسي واحد.',
          correct: false
        },
        {
          id: 4,
          type: 'multi',
          points: 3,
          text: 'أي من العبارات التالية صحيحة بخصوص جملة JOIN؟ (اختر كل ما ينطبق)',
          options: [
            'INNER JOIN يُرجع الصفوف المتطابقة في الجدولين فقط',
            'LEFT JOIN يُرجع جميع صفوف الجدول الأيسر',
            'RIGHT JOIN يُرجع جميع صفوف الجدول الأيمن',
            'FULL JOIN يُرجع جميع الصفوف من الجدولين'
          ],
          correct: [0, 1, 2, 3]
        },
        {
          id: 5,
          type: 'mcq',
          points: 2,
          text: 'أي جملة SQL تُستخدم لتصفية نتائج الاستعلام؟',
          options: ['ORDER BY', 'GROUP BY', 'WHERE', 'HAVING'],
          correct: 2
        },
        {
          id: 6,
          type: 'mcq',
          points: 2,
          text: 'ما وظيفة الأمر DISTINCT في SQL؟',
          options: [
            'ترتيب النتائج',
            'إزالة الصفوف المكررة',
            'تصفية الصفوف',
            'تجميع الصفوف'
          ],
          correct: 1
        },
        {
          id: 7,
          type: 'truefalse',
          points: 2,
          text: 'يمكن استخدام الدالة COUNT() لعدّ الصفوف في جدول.',
          correct: true
        },
        {
          id: 8,
          type: 'mcq',
          points: 2,
          text: 'أي مما يلي ليس من أنواع البيانات في SQL؟',
          options: ['INTEGER', 'VARCHAR', 'BOOLEAN', 'ARRAYLIST'],
          correct: 3
        },
        {
          id: 9,
          type: 'mcq',
          points: 2,
          text: 'ما الفرق الرئيسي بين HAVING و WHERE؟',
          options: [
            'لا يوجد فرق',
            'WHERE تُستخدم قبل التجميع، HAVING بعده',
            'HAVING أسرع من WHERE',
            'WHERE تعمل فقط على النصوص'
          ],
          correct: 1
        },
        {
          id: 10,
          type: 'essay',
          points: 4,
          text: 'اشرح بإيجاز الفرق بين INNER JOIN و LEFT JOIN، مع ذكر مثال تطبيقي على كل منهما.'
        },
        {
          id: 11,
          type: 'mcq',
          points: 2,
          text: 'أي جملة تُستخدم لإنشاء جدول جديد في قاعدة البيانات؟',
          options: ['CREATE TABLE', 'ADD TABLE', 'NEW TABLE', 'MAKE TABLE'],
          correct: 0
        },
        {
          id: 12,
          type: 'mcq',
          points: 2,
          text: 'ما وظيفة القيد FOREIGN KEY؟',
          options: [
            'يضمن تفرد كل صف',
            'يربط بين جدولين ويضمن التكامل المرجعي',
            'يمنع القيم الفارغة',
            'يرتب البيانات تلقائياً'
          ],
          correct: 1
        },
        {
          id: 13,
          type: 'truefalse',
          points: 2,
          text: 'يمكن أن تحتوي قاعدة البيانات على أكثر من جدول.',
          correct: true
        },
        {
          id: 14,
          type: 'mcq',
          points: 2,
          text: 'أي من الدوال التالية تُرجع متوسط القيم؟',
          options: ['SUM()', 'COUNT()', 'AVG()', 'MAX()'],
          correct: 2
        },
        {
          id: 15,
          type: 'multi',
          points: 3,
          text: 'أي من الأوامر التالية يُستخدم لتعديل البيانات؟ (اختر كل ما ينطبق)',
          options: ['INSERT', 'UPDATE', 'DELETE', 'SELECT'],
          correct: [0, 1, 2]
        },
        {
          id: 16,
          type: 'mcq',
          points: 2,
          text: 'ما الفرق بين TRUNCATE و DELETE؟',
          options: [
            'لا يوجد فرق',
            'TRUNCATE أسرع ولا يمكن التراجع عنه بسهولة',
            'DELETE أسرع من TRUNCATE',
            'DELETE يحذف الجدول بالكامل'
          ],
          correct: 1
        },
        {
          id: 17,
          type: 'mcq',
          points: 2,
          text: 'أي مما يلي يُعدّ من مستويات التطبيع (Normalization)؟',
          options: ['1NF', '2NF', '3NF', 'كل ما سبق'],
          correct: 3
        },
        {
          id: 18,
          type: 'mcq',
          points: 2,
          text: 'ما وظيفة INDEX في قاعدة البيانات؟',
          options: [
            'تحسين أداء الاستعلامات',
            'حذف البيانات',
            'إنشاء نسخ احتياطية',
            'ضغط البيانات'
          ],
          correct: 0
        },
        {
          id: 19,
          type: 'truefalse',
          points: 2,
          text: 'يمكن استخدام Subquery داخل جملة SELECT.',
          correct: true
        },
        {
          id: 20,
          type: 'essay',
          points: 4,
          text: 'اذكر ثلاثة من مزايا استخدام قواعد البيانات العلائقية مقارنة بتخزين البيانات في ملفات نصية بسيطة.'
        }
      ];

      const TOTAL_QUESTIONS = questions.length;
      const TOTAL_SECONDS = 60 * 60; // 60 دقيقة

      // =========================================================
      // الحالة
      // =========================================================
      let currentIndex = 0;
      let remainingSeconds = 59 * 60 + 42; // 59:42
      let answers = {};           // { qIndex: value }
      let flags = {};             // { qIndex: true }
      let timerInterval = null;
      let hasSubmitted = false;

      // =========================================================
      // العناصر
      // =========================================================
      const timerEl = document.getElementById('examTimer');
      const timerValue = document.getElementById('timerValue');
      const mapGrid = document.getElementById('mapGrid');
      const mapAnswered = document.getElementById('mapAnswered');
      const mapStatAnswered = document.getElementById('mapStatAnswered');
      const mapStatRemaining = document.getElementById('mapStatRemaining');
      const answeredCount = document.getElementById('answeredCount');
      const sideAnswered = document.getElementById('sideAnswered');
      const sideProgressBar = document.getElementById('sideProgressBar');
      const currentQNum = document.getElementById('currentQNum');
      const qNumBadge = document.getElementById('qNumBadge');
      const qTypeTag = document.getElementById('qTypeTag');
      const qPoints = document.getElementById('qPoints');
      const questionBody = document.getElementById('questionBody');
      const flagBtn = document.getElementById('flagBtn');
      const prevBtn = document.getElementById('prevBtn');
      const nextBtn = document.getElementById('nextBtn');
      const clearBtn = document.getElementById('clearBtn');
      const exitBtn = document.getElementById('exitBtn');
      const submitModal = document.getElementById('submitModal');
      const modalCancel = document.getElementById('modalCancel');
      const modalConfirm = document.getElementById('modalConfirm');
      const modalAnswered = document.getElementById('modalAnswered');
      const modalRemaining = document.getElementById('modalRemaining');
      const toastContainer = document.getElementById('toastContainer');

      // =========================================================
      // توليد خريطة الأسئلة
      // =========================================================
      function buildMap() {
        mapGrid.innerHTML = '';
        questions.forEach((q, i) => {
          const btn = document.createElement('button');
          btn.className = 'map-btn';
          btn.textContent = i + 1;
          btn.dataset.index = i;
          btn.setAttribute('aria-label', `السؤال ${i + 1}`);
          btn.addEventListener('click', () => goToQuestion(i));
          mapGrid.appendChild(btn);
        });
      }

      // =========================================================
      // تحديث الخريطة والإحصاءات
      // =========================================================
      function updateMapState() {
        const mapBtns = mapGrid.querySelectorAll('.map-btn');
        let answered = 0;

        mapBtns.forEach((btn, i) => {
          btn.classList.remove('answered', 'current', 'flagged');

          if (answers[i] !== undefined && answers[i] !== null && answers[i] !== '' &&
              !(Array.isArray(answers[i]) && answers[i].length === 0)) {
            btn.classList.add('answered');
            answered++;
          }
          if (i === currentIndex) {
            btn.classList.add('current');
          }
          if (flags[i]) {
            btn.classList.add('flagged');
          }
        });

        const remaining = TOTAL_QUESTIONS - answered;

        mapAnswered.textContent = answered;
        mapStatAnswered.textContent = answered;
        mapStatRemaining.textContent = remaining;
        answeredCount.textContent = answered;
        sideAnswered.textContent = answered;
        sideProgressBar.style.width = (answered / TOTAL_QUESTIONS * 100) + '%';
      }

      // =========================================================
      // عرض السؤال
      // =========================================================
      function renderQuestion() {
        const q = questions[currentIndex];

        // تحديث الرأس
        currentQNum.textContent = currentIndex + 1;
        qNumBadge.textContent = currentIndex + 1;
        qPoints.textContent = q.points;

        // نوع السؤال
        qTypeTag.className = 'question-type-tag ' + q.type;
        const typeLabels = {
          mcq: 'اختيار من متعدد',
          multi: 'متعدد الإجابات',
          truefalse: 'صح / خطأ',
          essay: 'سؤال مقالي'
        };
        const typeIcons = {
          mcq: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>',
          multi: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
          truefalse: '<path d="M20 6L9 17l-5-5"/><path d="M18 19l-6-6M12 19l6-6"/>',
          essay: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>'
        };
        qTypeTag.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            ${typeIcons[q.type]}
          </svg>
          ${typeLabels[q.type]}
        `;

        // تحديث حالة زر التعليم
        if (flags[currentIndex]) {
          flagBtn.classList.add('flagged');
          flagBtn.querySelector('span').textContent = 'مُعلَّم للمراجعة';
        } else {
          flagBtn.classList.remove('flagged');
          flagBtn.querySelector('span').textContent = 'علّم للمراجعة';
        }

        // بناء جسم السؤال
        let html = `<div class="question-text">${q.text}</div>`;

        if (q.type === 'mcq' || q.type === 'multi') {
          const currentValue = answers[currentIndex];
          html += '<div class="options-list">';
          q.options.forEach((opt, i) => {
            const isSelected = q.type === 'mcq'
              ? currentValue === i
              : (Array.isArray(currentValue) && currentValue.includes(i));

            const letters = ['أ', 'ب', 'ج', 'د', 'هـ'];
            html += `
              <button type="button" class="option-card ${isSelected ? 'selected' : ''}" data-option-index="${i}">
                <span class="option-letter">${letters[i]}</span>
                <span class="option-text">${opt}</span>
                <span class="option-check ${q.type === 'multi' ? 'square' : ''}"></span>
              </button>
            `;
          });
          html += '</div>';
        } else if (q.type === 'truefalse') {
          const currentValue = answers[currentIndex];
          html += `
            <div class="tf-options">
              <button type="button" class="tf-option ${currentValue === true ? 'selected' : ''}" data-tf="true">
                <div class="tf-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                </div>
                <span>صح</span>
              </button>
              <button type="button" class="tf-option ${currentValue === false ? 'selected' : ''}" data-tf="false">
                <div class="tf-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </div>
                <span>خطأ</span>
              </button>
            </div>
          `;
        } else if (q.type === 'essay') {
          const currentValue = answers[currentIndex] || '';
          html += `
            <textarea class="essay-area" id="essayInput" placeholder="اكتب إجابتك هنا بالتفصيل..." maxlength="2000">${currentValue}</textarea>
            <div class="essay-meta">
              <span>اكتب إجابة وافية ومدعومة بالأمثلة</span>
              <span class="char-count"><span id="charCount">${currentValue.length}</span> / 2000 حرف</span>
            </div>
          `;
        }

        questionBody.innerHTML = html;

        // ربط الأحداث
        if (q.type === 'mcq' || q.type === 'multi') {
          questionBody.querySelectorAll('.option-card').forEach((btn) => {
            btn.addEventListener('click', () => selectOption(parseInt(btn.dataset.optionIndex, 10), q.type));
          });
        } else if (q.type === 'truefalse') {
          questionBody.querySelectorAll('.tf-option').forEach((btn) => {
            btn.addEventListener('click', () => {
              const val = btn.dataset.tf === 'true';
              answers[currentIndex] = val;
              renderQuestion();
              updateMapState();
            });
          });
        } else if (q.type === 'essay') {
          const essayInput = document.getElementById('essayInput');
          const charCount = document.getElementById('charCount');
          if (essayInput) {
            essayInput.addEventListener('input', () => {
              answers[currentIndex] = essayInput.value;
              charCount.textContent = essayInput.value.length;
              updateMapState();
            });
          }
        }

        // تحديث الأزرار
        prevBtn.disabled = currentIndex === 0;
        nextBtn.disabled = currentIndex === TOTAL_QUESTIONS - 1;

        updateMapState();

        // تمرير لأعلى منطقة السؤال
        document.getElementById('questionArea').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      // =========================================================
      // اختيار خيار
      // =========================================================
      function selectOption(optionIndex, type) {
        if (type === 'mcq') {
          answers[currentIndex] = optionIndex;
        } else if (type === 'multi') {
          const current = Array.isArray(answers[currentIndex]) ? [...answers[currentIndex]] : [];
          const idx = current.indexOf(optionIndex);
          if (idx > -1) {
            current.splice(idx, 1);
          } else {
            current.push(optionIndex);
          }
          answers[currentIndex] = current;
        }
        renderQuestion();
      }

      // =========================================================
      // التنقل
      // =========================================================
      function goToQuestion(index) {
        if (index < 0 || index >= TOTAL_QUESTIONS) return;
        currentIndex = index;
        renderQuestion();
      }

      prevBtn.addEventListener('click', () => {
        if (currentIndex > 0) goToQuestion(currentIndex - 1);
      });

      nextBtn.addEventListener('click', () => {
        if (currentIndex < TOTAL_QUESTIONS - 1) goToQuestion(currentIndex + 1);
      });

      clearBtn.addEventListener('click', () => {
        delete answers[currentIndex];
        renderQuestion();
        showToast('تم مسح الإجابة', 'warning');
      });

      // =========================================================
      // تعليم للمراجعة
      // =========================================================
      flagBtn.addEventListener('click', () => {
        flags[currentIndex] = !flags[currentIndex];
        if (!flags[currentIndex]) delete flags[currentIndex];
        renderQuestion();
        showToast(
          flags[currentIndex] ? 'تم تعليم السؤال للمراجعة' : 'تم إلغاء التعليم',
          flags[currentIndex] ? 'warning' : 'success'
        );
      });

      // =========================================================
      // المؤقت
      // =========================================================
      function formatTime(sec) {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      }

      function updateTimer() {
        timerValue.textContent = formatTime(remainingSeconds);

        timerEl.classList.remove('warning', 'danger');

        if (remainingSeconds <= 300 && remainingSeconds > 60) {
          timerEl.classList.add('warning');
        } else if (remainingSeconds <= 60) {
          timerEl.classList.add('danger');
        }

        if (remainingSeconds <= 0) {
          clearInterval(timerInterval);
          handleAutoSubmit();
        }
      }

      function startTimer() {
        updateTimer();
        timerInterval = setInterval(() => {
          remainingSeconds--;
          updateTimer();
        }, 1000);
      }

      // =========================================================
      // نافذة التسليم
      // =========================================================
      function openSubmitModal() {
        let answered = 0;
        questions.forEach((q, i) => {
          const val = answers[i];
          if (val !== undefined && val !== null && val !== '' &&
              !(Array.isArray(val) && val.length === 0)) {
            answered++;
          }
        });
        modalAnswered.textContent = answered;
        modalRemaining.textContent = TOTAL_QUESTIONS - answered;
        submitModal.classList.add('open');
        document.body.style.overflow = 'hidden';
      }

      function closeSubmitModal() {
        submitModal.classList.remove('open');
        document.body.style.overflow = '';
      }

      exitBtn.addEventListener('click', openSubmitModal);
      modalCancel.addEventListener('click', closeSubmitModal);

      submitModal.addEventListener('click', (e) => {
        if (e.target === submitModal) closeSubmitModal();
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && submitModal.classList.contains('open')) {
          closeSubmitModal();
        }
      });

      // =========================================================
      // تأكيد التسليم
      // =========================================================
      modalConfirm.addEventListener('click', () => {
        if (hasSubmitted) return;
        hasSubmitted = true;

        const originalHTML = modalConfirm.innerHTML;
        modalConfirm.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 0.8s linear infinite;">
            <path d="M21 12a9 9 0 1 1-6.22-8.56" />
          </svg>
          جارٍ التسليم...
        `;
        modalConfirm.disabled = true;

        setTimeout(() => {
          closeSubmitModal();
          clearInterval(timerInterval);
          showSuccessState();
        }, 1500);
      });

      // =========================================================
      // التسليم التلقائي
      // =========================================================
      function handleAutoSubmit() {
        if (hasSubmitted) return;
        hasSubmitted = true;
        clearInterval(timerInterval);
        showToast('انتهى وقت الاختبار — تم التسليم تلقائياً', 'danger', 4000);
        setTimeout(() => showSuccessState(), 1000);
      }

      function showSuccessState() {
        document.querySelector('.exam-main').innerHTML = `
          <div style="grid-column:1/-1;display:flex;align-items:center;justify-content:center;min-height:70vh;padding:20px;">
            <div style="background:var(--bg-surface);border-radius:var(--radius-xl);padding:48px 36px;max-width:520px;text-align:center;box-shadow:var(--shadow-xl);border:1px solid var(--border);">
              <div style="width:96px;height:96px;border-radius:50%;background:var(--success-bg);border:2px solid var(--success-border);display:flex;align-items:center;justify-content:center;margin:0 auto 24px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:48px;height:48px;">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              </div>
              <h2 style="font-family:var(--font-head);font-size:1.75rem;font-weight:700;color:var(--text-primary);margin-bottom:12px;">تم تسليم الاختبار بنجاح</h2>
              <p style="font-size:0.95rem;color:var(--text-secondary);line-height:1.75;margin-bottom:28px;">
                سيتم تصحيح إجاباتك تلقائياً وإشعارك بالنتيجة عند اكتمال التصحيح. يمكنك متابعة النتيجة من صفحة الاختبارات.
              </p>
              <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
                <a href="#" style="display:inline-flex;align-items:center;gap:8px;padding:12px 24px;background:linear-gradient(135deg,var(--gold-light),var(--gold));color:var(--navy-dark);border-radius:12px;font-weight:700;font-size:0.88rem;box-shadow:0 6px 16px -4px rgba(212,160,23,0.5);text-decoration:none;">
                  العودة للاختبارات
                </a>
                <a href="#" style="display:inline-flex;align-items:center;gap:8px;padding:12px 24px;background:var(--bg-subtle);color:var(--text-primary);border:1px solid var(--border);border-radius:12px;font-weight:700;font-size:0.88rem;text-decoration:none;">
                  لوحة التحكم
                </a>
              </div>
            </div>
          </div>
        `;
      }

      // =========================================================
      // Toast
      // =========================================================
      function showToast(message, type = 'info', duration = 2800) {
        const icons = {
          success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
          warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
          danger: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
          info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>'
        };
        const toast = document.createElement('div');
        toast.className = 'toast ' + type;
        toast.innerHTML = icons[type] + '<span>' + message + '</span>';
        toastContainer.appendChild(toast);
        setTimeout(() => {
          toast.classList.add('hide');
          setTimeout(() => toast.remove(), 300);
        }, duration);
      }

      // =========================================================
      // حفظ تلقائي
      // =========================================================
      setInterval(() => {
        if (!hasSubmitted) {
          const saved = { answers, flags, currentIndex, remainingSeconds };
          try {
            localStorage.setItem('exam_draft_cs201', JSON.stringify(saved));
          } catch (e) {}
        }
      }, 30000);

      // =========================================================
      // تحذير عند مغادرة الصفحة
      // =========================================================
      window.addEventListener('beforeunload', (e) => {
        if (!hasSubmitted) {
          e.preventDefault();
          e.returnValue = '';
        }
      });

      // =========================================================
      // الحركة
      // =========================================================
      const styleEl = document.createElement('style');
      styleEl.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
      document.head.appendChild(styleEl);

      // =========================================================
      // التهيئة
      // =========================================================
      buildMap();
      renderQuestion();
      startTimer();

      console.log(
        '%c[AlZain Academy]',
        'color:#D4A017;font-weight:bold;font-size:13px;',
        'صفحة الاختبار جاهزة — 20 سؤالاً، مؤقت 59:42'
      );
    })();
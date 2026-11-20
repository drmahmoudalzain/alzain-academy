// صفحة المحاضرة: نبضات الحضور والأسئلة التفاعلية.
(function () {
  "use strict";

  const lectureId = document.body.dataset.lectureId;
  const durationMinutes = Number(document.body.dataset.durationMinutes || 120);
  const maxSeconds = durationMinutes * 60;
  const minutesForFullPoints = 100; // 10 نقاط × 10 دقائق
  let presenceSeconds = Number(document.body.dataset.presenceSeconds || 0);
  let codeEntered = document.body.dataset.codeEntered === "1";

  const timeEl = document.getElementById("attendanceTimer");
  const barEl = document.getElementById("attendanceProgress");
  const pointsEl = document.getElementById("pointsEarned");
  const presenceMetaEl = document.getElementById("presenceMinutes");
  const statusEl = document.getElementById("attendanceStatus");

  function updateStatus() {
    if (!statusEl) return;
    statusEl.textContent = !codeEntered
      ? "أدخل رمز الحضور لتفعيل العداد"
      : document.hidden
        ? "العداد متوقف — الصفحة غير نشطة"
        : "نبضة نشطة — يتم تتبّع حضورك الآن";
  }

  function renderPresence() {
    const minutes = Math.floor(presenceSeconds / 60);
    const pct = Math.min(100, (minutes / minutesForFullPoints) * 100);
    const points = Math.min(10, Math.floor(minutes / 10));

    if (timeEl) {
      const h = String(Math.floor(minutes / 60)).padStart(2, "0");
      const m = String(minutes % 60).padStart(2, "0");
      const s = String(Math.floor(presenceSeconds % 60)).padStart(2, "0");
      timeEl.textContent = `${h}:${m}:${s}`;
    }
    if (barEl) barEl.style.width = pct + "%";
    if (pointsEl) pointsEl.textContent = codeEntered ? `${points} / 10 نقاط` : "أدخل رمز الحضور أولاً";
    if (presenceMetaEl) presenceMetaEl.textContent = `${minutes} دقيقة`;
    updateStatus();
  }

  renderPresence();

  if (lectureId) {
    // العدّاد المحلي يسير فقط حين يكون الرمز مُدخلاً والصفحة ظاهرة.
    window.setInterval(() => {
      if (!codeEntered || document.hidden) return;
      if (presenceSeconds >= maxSeconds) return;
      presenceSeconds += 1;
      renderPresence();
    }, 1000);

    document.addEventListener("visibilitychange", renderPresence);

    const sendHeartbeat = async () => {
      if (!codeEntered || document.hidden) return;
      try {
        const res = await fetch(`/student/lectures/${lectureId}/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) return;
        if (data.needCode) {
          codeEntered = false;
          presenceSeconds = 0;
        } else if (data.ok) {
          codeEntered = true;
          if (data.seconds != null) presenceSeconds = Math.max(presenceSeconds, Number(data.seconds));
          else if (data.minutes != null) presenceSeconds = Math.max(presenceSeconds, Number(data.minutes) * 60);
        }
        renderPresence();
      } catch {
        // فشل صامت — سيُعاد المحاولة مع النبضة التالية
      }
    };

    window.setInterval(sendHeartbeat, 30000);
    window.setTimeout(sendHeartbeat, 5000);
  }

  // ---------- تبديل نموذج موضوع النقاش ----------
  const discussionToggle = document.getElementById("toggleDiscussionForm");
  const discussionForm = document.getElementById("discussionForm");
  const discussionCancel = document.getElementById("cancelDiscussionForm");

  if (discussionToggle && discussionForm) {
    discussionToggle.addEventListener("click", () => {
      discussionForm.hidden = !discussionForm.hidden;
      if (!discussionForm.hidden) {
        discussionForm.querySelector("textarea")?.focus();
      }
    });
    discussionCancel?.addEventListener("click", () => {
      discussionForm.hidden = true;
    });
  }

  // نسخ نص الرد إلى الحقل المخصص لإرساله
  document.querySelectorAll(".discussion-reply-input").forEach((textarea) => {
    textarea.addEventListener("input", () => {
      const target = document.getElementById(textarea.dataset.target);
      if (target) target.value = textarea.value;
    });
  });
  document.querySelectorAll(".discussion-reply-form").forEach((form) => {
    form.addEventListener("submit", () => {
      const target = form.querySelector("textarea");
      const hidden = form.querySelector("input[type='hidden']");
      if (target && hidden) hidden.value = target.value.trim();
    });
  });

  // ---------- روابط التنقل إلى تبويب الحضور ----------
  document.querySelectorAll("[data-goto-tab]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const tab = document.querySelector(`.tab-btn[data-tab="${link.dataset.gotoTab}"]`);
      if (tab) tab.click();
    });
  });

  // الأسئلة التفاعلية: تحديد خيار ثم تأكيد
  document.querySelectorAll(".question-card").forEach((card) => {
    const submitBtn = card.querySelector(".submit-answer");
    const isMulti = card.dataset.type === "multi";
    const options = card.querySelectorAll(".option-btn");

    function updateSubmitState() {
      if (!submitBtn) return;
      if (isMulti) {
        submitBtn.disabled = card.querySelectorAll(".option-btn.selected").length === 0;
      } else {
        submitBtn.disabled = !card.querySelector(".option-btn.selected");
      }
    }

    options.forEach((option) => {
      option.addEventListener("click", () => {
        if (option.disabled) return;
        if (isMulti) {
          option.classList.toggle("selected");
        } else {
          options.forEach((item) => item.classList.remove("selected"));
          option.classList.add("selected");
        }
        updateSubmitState();
      });
    });

    if (submitBtn) {
      submitBtn.addEventListener("click", () => {
        const questionId = card.dataset.question;
        const form = document.createElement("form");
        form.method = "post";
        form.action = `/student/lectures/${lectureId}/questions/${questionId}/answer`;
        if (isMulti) {
          card.querySelectorAll(".option-btn.selected").forEach((option) => {
            const input = document.createElement("input");
            input.type = "hidden";
            input.name = "choice_indices";
            input.value = option.dataset.index;
            form.appendChild(input);
          });
        } else {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = "choice_index";
          input.value = card.querySelector(".option-btn.selected")?.dataset.index ?? "";
          form.appendChild(input);
        }
        document.body.appendChild(form);
        form.submit();
      });
    }
  });
})();

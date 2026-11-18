// صفحة المحاضرة: نبضات الحضور والأسئلة التفاعلية.
(function () {
  "use strict";

  const lectureId = document.body.dataset.lectureId;
  const durationMinutes = Number(document.body.dataset.durationMinutes || 120);
  let presenceSeconds = Number(document.body.dataset.presenceSeconds || 0);

  const timeEl = document.getElementById("attendanceTimer");
  const barEl = document.getElementById("attendanceProgress");
  const pointsEl = document.getElementById("pointsEarned");
  const presenceMetaEl = document.getElementById("presenceMinutes");

  function renderPresence() {
    const minutes = Math.floor(presenceSeconds / 60);
    const pct = Math.min(100, (minutes / durationMinutes) * 100);
    const points = Math.min(10, Math.floor(minutes / 12)); // نقطة لكل 12 دقيقة تقريباً

    if (timeEl) {
      const h = String(Math.floor(minutes / 60)).padStart(2, "0");
      const m = String(minutes % 60).padStart(2, "0");
      const s = String(presenceSeconds % 60).padStart(2, "0");
      timeEl.textContent = `${h}:${m}:${s}`;
    }
    if (barEl) barEl.style.width = pct + "%";
    if (pointsEl) pointsEl.textContent = `${points} / 10 نقاط`;
    if (presenceMetaEl) presenceMetaEl.textContent = `${minutes} دقيقة`;
  }

  renderPresence();

  if (lectureId) {
    // عدّاد محلي يتناسب مع أرقام الخادم
    window.setInterval(() => {
      presenceSeconds += 1;
      renderPresence();
    }, 1000);

    // نبضة كل 30 ثانية أثناء وجود الطالب في الصفحة
    window.setInterval(async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`/student/lectures/${lectureId}/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.minutes != null) presenceSeconds = Math.max(presenceSeconds, data.minutes * 60);
        }
      } catch {
        // فشل صامت — سيُعاد المحاولة مع النبضة التالية
      }
    }, 30000);

    // أول نبضة بعد 5 ثوانٍ من فتح الصفحة
    window.setTimeout(async () => {
      try {
        await fetch(`/student/lectures/${lectureId}/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
        });
      } catch { /* ignore */ }
    }, 5000);
  }

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

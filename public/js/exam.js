// صفحة الاختبار: مؤقّت، خريطة أسئلة، تنقّل وتجزئة، وتسليم.
(function () {
  "use strict";

  const remainingData = Number(document.body.dataset.remainingSeconds || 0);
  const mapGrid = document.getElementById("mapGrid");
  const timerEl = document.getElementById("timerValue");
  const form = document.getElementById("examForm");
  const blocks = [...document.querySelectorAll(".exam-question")];
  const total = blocks.length;
  if (!blocks.length || !mapGrid) return;

  let current = 0;
  let remaining = remainingData;
  const flagged = new Set();

  // ---------- حساب المُجابة ----------
  function isAnswered(block) {
    const type = block.dataset.type;
    if (type === "essay") {
      const area = block.querySelector("textarea");
      return Boolean(area && area.value.trim().length > 0);
    }
    if (type === "multi") {
      return block.querySelectorAll("input[type=checkbox]:checked").length > 0;
    }
    return Boolean(block.querySelector("input[type=radio]:checked"));
  }

  const answered = () => blocks.filter(isAnswered).length;

  // ---------- خريطة الأسئلة ----------
  const mapButtons = blocks.map((block, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "map-cell";
    button.textContent = String(index + 1);
    button.dataset.index = String(index);
    button.setAttribute("aria-label", `السؤال ${index + 1}`);
    button.addEventListener("click", () => goTo(index));
    mapGrid.appendChild(button);
    return button;
  });

  function renderMap() {
    mapButtons.forEach((button, index) => {
      button.classList.toggle("current", index === current);
      button.classList.toggle("answered", isAnswered(blocks[index]));
      button.classList.toggle("flagged", flagged.has(index));
    });
    const count = answered();
    document.querySelectorAll("[data-bind=answered]").forEach((el) => (el.textContent = String(count)));
    document.querySelectorAll("[data-bind=remaining]").forEach((el) => (el.textContent = String(total - count)));
    const bar = document.getElementById("sideProgressBar");
    if (bar) bar.style.width = (total ? (count / total) * 100 : 0) + "%";
    const currentNum = document.querySelectorAll("[data-bind=current]");
    currentNum.forEach((el) => (el.textContent = String(current + 1)));
    const typeTag = document.getElementById("qTypeTag");
    if (typeTag) typeTag.textContent = blocks[current].dataset.typeLabel || "";
    const pointsTag = document.getElementById("qPoints");
    if (pointsTag) pointsTag.textContent = blocks[current].dataset.points || "";
    const flagBtn = document.getElementById("flagBtn");
    if (flagBtn) flagBtn.classList.toggle("active", flagged.has(current));
    const modalAnswered = document.getElementById("modalAnswered");
    if (modalAnswered) modalAnswered.textContent = String(count);
    const modalRemaining = document.getElementById("modalRemaining");
    if (modalRemaining) modalRemaining.textContent = String(total - count);
  }

  function goTo(index) {
    current = Math.max(0, Math.min(total - 1, index));
    blocks.forEach((block, i) => block.classList.toggle("active", i === current));
    window.scrollTo({ top: 0, behavior: "smooth" });
    renderMap();
  }

  document.getElementById("prevBtn")?.addEventListener("click", () => goTo(current - 1));
  document.getElementById("nextBtn")?.addEventListener("click", () => goTo(current + 1));
  document.getElementById("clearBtn")?.addEventListener("click", () => {
    blocks[current].querySelectorAll("input").forEach((input) => (input.checked = false));
    const area = blocks[current].querySelector("textarea");
    if (area) area.value = "";
    renderMap();
  });
  document.getElementById("flagBtn")?.addEventListener("click", () => {
    if (flagged.has(current)) flagged.delete(current);
    else flagged.add(current);
    renderMap();
  });

  document.querySelectorAll("input, textarea").forEach((input) => {
    input.addEventListener("change", renderMap);
    input.addEventListener("input", renderMap);
  });

  // ---------- المؤقّت ----------
  function renderTimer() {
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    if (timerEl) timerEl.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    document.getElementById("examTimer")?.classList.toggle("danger", remaining <= 60);
  }

  const timer = window.setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      remaining = 0;
      renderTimer();
      window.clearInterval(timer);
      if (form) form.submit();
      return;
    }
    renderTimer();
  }, 1000);
  renderTimer();

  // ---------- حفظ تلقائي أثناء الاختبار ----------
  const autosaveUrl = window.location.pathname.replace(/\/$/, "") + "/autosave";

  function serializeAnswers() {
    const params = new URLSearchParams();
    document.querySelectorAll("#examForm input, #examForm textarea").forEach((el) => {
      if (!el.name) return;
      if (el.type === "radio" || el.type === "checkbox") {
        if (el.checked) params.append(el.name, el.value);
      } else {
        params.append(el.name, el.value);
      }
    });
    return params.toString();
  }

  async function sendAutosave() {
    try {
      await fetch(autosaveUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
        body: serializeAnswers(),
        keepalive: true,
      });
    } catch {
      // فشل صامت — تُرسل محاولة أخرى لاحقاً (أو عند التسليم)
    }
  }

  let autosaveTimer = null;
  function queueAutosave() {
    window.clearTimeout(autosaveTimer);
    autosaveTimer = window.setTimeout(sendAutosave, 2500);
  }

  document.querySelectorAll("input, textarea").forEach((el) => {
    el.addEventListener("change", queueAutosave);
    el.addEventListener("input", queueAutosave);
  });

  window.setInterval(sendAutosave, 30000);
  window.addEventListener("pagehide", sendAutosave);
  window.setTimeout(sendAutosave, 8000);

  // ---------- نافذة التأكيد ----------
  const modal = document.getElementById("submitModal");
  document.getElementById("exitBtn")?.addEventListener("click", () => {
    renderMap();
    modal?.classList.add("open");
  });
  document.getElementById("modalCancel")?.addEventListener("click", () => modal?.classList.remove("open"));
  modal?.addEventListener("click", (event) => {
    if (event.target === modal) modal.classList.remove("open");
  });
  document.getElementById("modalConfirm")?.addEventListener("click", () => {
    if (form) form.submit();
  });

  goTo(0);
})();

// سلوك البوابة المشترك: الشريط الجانبي، التبويبات، والتصفية.
(function () {
  "use strict";

  // ---------- زر الرجوع ----------
  const backBtn = document.getElementById("backBtn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      if (window.history.length > 1) window.history.back();
      else window.location.assign(backBtn.dataset.fallback || "/");
    });
  }

  // ---------- الشريط الجانبي ----------
  const sidebar = document.getElementById("sidebar");
  const menuBtn = document.getElementById("menuBtn");
  const overlay = document.getElementById("sidebarOverlay");

  function setSidebar(open) {
    if (!sidebar) return;
    sidebar.classList.toggle("open", open);
    if (overlay) {
      overlay.classList.toggle("is-open", open);
      overlay.setAttribute("aria-hidden", String(!open));
    }
    if (menuBtn) menuBtn.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("sidebar-open", open);
  }

  if (menuBtn) {
    menuBtn.addEventListener("click", () => setSidebar(!sidebar.classList.contains("open")));
  }
  if (overlay) overlay.addEventListener("click", () => setSidebar(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setSidebar(false);
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) setSidebar(false);
  });

  // ---------- روابط الخروج (POST) ----------
  document.querySelectorAll("[data-logout-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const form = document.createElement("form");
      form.method = "post";
      form.action = "/logout";
      document.body.appendChild(form);
      form.submit();
    });
  });

  // ---------- التبويبات ----------
  function activateTab(button) {
    const scope = button.closest(".tabs-container, .content, body") || document;
    const nav = button.closest(".tabs-nav");
    const buttons = nav ? nav.querySelectorAll(".tab-btn") : scope.querySelectorAll(".tab-btn");
    const panes = scope.querySelectorAll(".tab-pane");
    buttons.forEach((item) => {
      item.classList.toggle("active", item === button);
      item.setAttribute("aria-selected", String(item === button));
    });
    panes.forEach((pane) => {
      pane.classList.toggle("active", pane.dataset.pane === button.dataset.tab);
    });
  }

  document.querySelectorAll(".tab-btn").forEach((button) => {
    button.addEventListener("click", () => activateTab(button));
  });

  // ---------- تصفية بطاقات المحاضرات / الواجبات ----------
  const filterTabs = document.querySelectorAll(".filter-tab[data-filter]");
  if (filterTabs.length) {
    const items = document.querySelectorAll("[data-type], [data-status]");
    const courseFilter = document.getElementById("courseFilter");
    const search = document.getElementById("mainSearch");

    function applyFilters() {
      const active = document.querySelector(".filter-tab.active");
      const filter = active ? active.dataset.filter : "all";
      const course = courseFilter ? courseFilter.value : "all";
      const term = search ? search.value.trim().toLowerCase() : "";

      items.forEach((item) => {
        const type = item.dataset.type || item.dataset.status || "";
        const typeOk = filter === "all" || type.split(" ").includes(filter);
        const courseOk = !course || course === "all" || item.dataset.course === course;
        const textOk = !term || item.textContent.toLowerCase().includes(term);
        item.hidden = !(typeOk && courseOk && textOk);
      });
    }

    filterTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        filterTabs.forEach((item) => {
          item.classList.toggle("active", item === tab);
          item.setAttribute("aria-selected", String(item === tab));
        });
        applyFilters();
      });
    });

    if (courseFilter) courseFilter.addEventListener("change", applyFilters);
    if (search) search.addEventListener("input", applyFilters);
  }

  // ---------- أزرار الاختيار (بث المحاضرات) ----------
  document.querySelectorAll(".choice-btn input[type='radio']").forEach((input) => {
    input.addEventListener("change", () => {
      const group = input.closest(".choice-buttons");
      if (!group) return;
      group.querySelectorAll(".choice-btn").forEach((btn) => btn.classList.toggle("selected", btn.contains(input)));
    });
  });

  // ---------- تصفية سجل النقاط ----------
  const ledgerBody = document.getElementById("ledgerBody");
  const pills = document.querySelectorAll(".filter-pill[data-filter]");
  if (ledgerBody && pills.length) {
    pills.forEach((pill) => {
      pill.addEventListener("click", () => {
        pills.forEach((item) => {
          item.classList.toggle("active", item === pill);
          item.setAttribute("aria-selected", String(item === pill));
        });
        const filter = pill.dataset.filter;
        ledgerBody.querySelectorAll("tr[data-source]").forEach((row) => {
          row.hidden = filter !== "all" && row.dataset.source !== filter;
        });
      });
    });
  }

  // ---------- عدّاد تنازلي للواجبات ----------
  document.querySelectorAll("[data-countdown]").forEach((element) => {
    let seconds = Number(element.dataset.countdown || 0);
    if (!seconds) return;
    const tick = () => {
      if (seconds <= 0) {
        element.textContent = "انتهى الموعد";
        return;
      }
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      element.textContent = days > 0 ? `${days} يوم و${hours} ساعة` : `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
      seconds -= 60;
      window.setTimeout(tick, 60000);
    };
    tick();
  });
})();

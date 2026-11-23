/* ==========================================================================
   أكاديمية آل الزين — موجّه SPA (Hash Router)
   ========================================================================== */
(function () {
  "use strict";

  const VIEW_CSS_ID = "spa-view-css";
  const CACHE_VERSION = "c3a74e1"; // يتغيّر مع كل نشر لضمان جلب الملفات الجديدة
  const ROOT = document.getElementById("spa-root");

  // خريطة المسارات → ملفات العرض
  const routeTable = [
    { match: /^#\/$/, view: "home" },
    { match: /^#\/login\/owner$/, view: "owner" },
    { match: /^#\/login\/teacher$/, view: "teacher" },
    { match: /^#\/login\/student$/, view: "student" },
    { match: /^#\/student\/lectures$/, view: "student-lectures" },
    { match: /^#\/student\/lecture/, view: "student-lecture" },
    { match: /^#\/student\/exam/, view: "student-exam" },
    { match: /^#\/student\/dashboard$/, view: "student-dashboard" },
    { match: /^#\/student$/, view: "student-dashboard" },
    { match: /^#\/(soon|coming-soon)$/, view: "coming-soon" },
  ];

  // خريطة عناصر الشريط الجانبي → مسارات
  const sidebarMap = {
    "لوحة التحكم": "#/student",
    "مقرراتي": "#/student",
    "المحاضرات": "#/student/lectures",
    "الاختبارات": "#/student",
    "الواجبات": "#/student",
    "نقاطي": "#/student",
    "درجاتي": "#/student",
    "المكتبة": "#/student",
    "المساعد الذكي": "#/student",
    "الإشعارات": "#/student",
  };

  function resolveView(hash) {
    const h = hash || "#/";
    for (const r of routeTable) {
      if (r.match.test(h)) return r.view;
    }
    return "home";
  }

  function setLoading() {
    ROOT.innerHTML = '<div class="spa-loading"><span class="dot"></span> جاري التحميل…</div>';
  }

  function setError(msg) {
    ROOT.innerHTML =
      '<div class="spa-error"><h2>تعذر تحميل الصفحة</h2><p>' +
      (msg || "حدث خطأ غير متوقع.") +
      '</p><a href="#/" style="color:#D4A017;font-weight:700;">العودة للرئيسية</a></div>';
  }

  function loadCss(view) {
    let link = document.getElementById(VIEW_CSS_ID);
    if (!link) {
      link = document.createElement("link");
      link.id = VIEW_CSS_ID;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = "css/views/" + view + ".css?v=" + CACHE_VERSION;
  }

  function runScript(text) {
    if (!text || !text.trim()) return;
    const s = document.createElement("script");
    s.textContent = text;
    document.body.appendChild(s);
    s.remove();
  }

  async function loadView(hash) {
    const view = resolveView(hash);
    setLoading();
    loadCss(view);

    try {
      const res = await fetch("views/" + view + ".html?v=" + CACHE_VERSION, { cache: "no-cache" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const html = await res.text();
      ROOT.innerHTML = html;

      // تحميل JS الخاص بالعرض
      const jsRes = await fetch("js/views/" + view + ".js?v=" + CACHE_VERSION, { cache: "no-cache" });
      if (jsRes.ok) {
        const js = await jsRes.text();
        runScript(js);
      }

      // ربط عناصر الشريط الجانبي بالمسارات
      hydrateSidebar();

      // تحديث عنوان التبويب
      document.title = viewTitle(view);

      // التمرير للأعلى
      window.scrollTo({ top: 0, behavior: "instant" });
    } catch (err) {
      console.error("[SPA]", err);
      setError(err && err.message);
    }
  }

  function viewTitle(view) {
    const map = {
      home: "أكاديمية آل الزين | الرئيسية",
      owner: "بوابة المالك | أكاديمية آل الزين",
      teacher: "بوابة الأساتذة | أكاديمية آل الزين",
      student: "بوابة الطلاب | أكاديمية آل الزين",
      "student-dashboard": "لوحة الطالب | أكاديمية آل الزين",
      "student-lectures": "المحاضرات | لوحة الطالب",
      "student-lecture": "المحاضرة | لوحة الطالب",
      "student-exam": "أداء الاختبار | أكاديمية آل الزين",
      "coming-soon": "قيد الإنشاء | أكاديمية آل الزين",
    };
    return map[view] || "أكاديمية آل الزين للعلوم القانونية والعدلية";
  }

  function hydrateSidebar() {
    const items = document.querySelectorAll(".nav-item");
    items.forEach((item) => {
      const label = (item.textContent || "").trim().replace(/\s+/g, " ");
      // استخراج النص (تجاهل الشارات)
      const text = label.replace(/\d+/g, "").trim();
      let route = null;
      for (const key of Object.keys(sidebarMap)) {
        if (text.includes(key) || label.includes(key)) {
          route = sidebarMap[key];
          break;
        }
      }
      if (route) {
        item.setAttribute("href", route);
        item.addEventListener("click", (e) => {
          e.preventDefault();
          if (location.hash !== route) location.hash = route;
          // تحديث active
          document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
          item.classList.add("active");
        });
      }
    });
  }

  // اعتراض النقرات على الروابط #/...
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a");
    if (!a) return;
    const href = a.getAttribute("href");
    if (href && href.startsWith("#/") ) {
      e.preventDefault();
      if (location.hash !== href) location.hash = href;
      else loadView(href);
    }
  });

  window.addEventListener("hashchange", () => loadView(location.hash));

  // تحميل أولي
  if (!location.hash) location.hash = "#/";
  else loadView(location.hash);
})();

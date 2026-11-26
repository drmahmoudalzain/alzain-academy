import { requireProfile, portalOf, homeOf } from "./auth.js";
import { renderShell, bindShell, shellPortal, syncActiveNav, updateShellTitle } from "./layout.js";
import { registerPage, takePendingPreset, isSoftNav } from "./page-registry.js";
import { initNavigator } from "./navigator.js";
import { initFirstVisitModal, isPublicPath } from "./first-visit.js";

// نقطة دخول موحّدة لكل صفحة بوابة. التنقّل الناعم يستورد وحدة الصفحة من جديد،
// فتسجّل mount هنا بدل تنفيذها فوراً، ثم ينفّذها الموجّه بعد جلب HTML الهدف.
//
// الصيغ المدعومة (بدون تغيير):
//   boot("student", "العنوان", render)
//   boot({ portal: "student", title, render })
//   boot({ portals: ["student", "teacher"], title, render })
export async function boot(portalOrOptions, title, render) {
  const opts =
    typeof portalOrOptions === "string"
      ? { portal: portalOrOptions, title, render }
      : portalOrOptions || {};

  const pageTitle = opts.title || "";
  const pageRender = opts.render || (() => {});
  const allowed = opts.portals || (opts.portal ? [opts.portal] : []);

  const mount = async () => {
    // التنظيف يتم في navigator.js قبل استيراد وحدة الصفحة التالية فقط.
    // هنا لا يُنظَّف شيء: تسجيلات الوحدة الحالية أُضيفت قبل استدعاء boot().
    const { profile } = await requireProfile();
    if (!profile) return;

    const actual = portalOf(profile);
    if (allowed.length && !allowed.includes(actual)) {
      location.assign(homeOf(profile));
      return;
    }

    const app = document.getElementById("app");
    const preset = isSoftNav() ? takePendingPreset() : document.getElementById("content")?.innerHTML || "";
    const reuseShell = isSoftNav() && shellPortal() === actual && app?.querySelector("#content");

    document.body.classList.remove("portal-student", "portal-teacher", "portal-assistant", "portal-owner");
    document.body.classList.add(`portal-${actual}`);

    if (reuseShell) {
      updateShellTitle(pageTitle);
      syncActiveNav();
      bindShell();
    } else {
      app.innerHTML = renderShell({ portal: actual, title: pageTitle, profile });
      bindShell();
    }

    const content = document.getElementById("content");
    content.className = "content";
    if (preset.trim()) content.innerHTML = preset;

    try {
      await pageRender({ profile, portal: actual, content, el: content });
    } catch (err) {
      console.error(err);
      content.innerHTML = `<div class="empty">تعذّر تحميل الصفحة: ${String(err?.message || err)}</div>`;
    }
  };

  registerPage(location.pathname, mount);
  if (isSoftNav()) return;
  await mount();
}

initNavigator();

// الدليل صفحة عامة، لكن بوابات الدخول لا تعرض نافذة الزيارة الأولى.
if (typeof location !== "undefined" && isPublicPath(location.pathname)) initFirstVisitModal();

import { requireProfile, portalOf, homeOf } from "./auth.js";
import { renderShell, bindShell, shellPortal, syncActiveNav, updateShellTitle } from "./layout.js";
import { disposeAll } from "./lifecycle.js";
import { registerPage, takePendingPreset, isSoftNav } from "./page-registry.js";
import { initNavigator } from "./navigator.js";

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
    // في التنقّل الناعم يحدث التنظيف في navigator.js قبل استيراد الوحدة،
    // كي لا تُزال تسجيلات الوحدة الجديدة. في التحميل المباشر لا يوجد ما يُزال.
    if (!isSoftNav()) disposeAll();

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

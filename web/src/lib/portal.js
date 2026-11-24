import { requireProfile, portalOf, homeOf } from "./auth.js";
import { renderShell, bindShell } from "./layout.js";

// نقطة دخول موحّدة لكل صفحة بوابة:
//   1) يتطلب تسجيل الدخول، 2) يتحقق من البوابة، 3) يرسم الهيكل، 4) يستدعي render.
export async function boot(portalKey, title, render) {
  const { profile } = await requireProfile();
  if (!profile) return;

  const actual = portalOf(profile);
  if (actual !== portalKey) {
    location.assign(homeOf(profile));
    return;
  }

  document.getElementById("app").innerHTML = renderShell({ portal: portalKey, title, profile });
  bindShell();

  const content = document.getElementById("content");
  try {
    await render({ profile, content, el: content });
  } catch (err) {
    console.error(err);
    content.innerHTML = `<div class="empty">تعذّر تحميل الصفحة: ${String(err?.message || err)}</div>`;
  }
}

import { requireProfile, portalOf, homeOf } from "./auth.js";
import { renderShell, bindShell } from "./layout.js";

// نقطة دخول موحّدة لكل صفحة بوابة:
//   1) يتطلب تسجيل الدخول، 2) يتحقق من البوابة، 3) يرسم الهيكل، 4) يستدعي render.
//
// الصيغ المدعومة:
//   boot("student", "العنوان", render)
//   boot({ portal: "student", title, render })
//   boot({ portals: ["student", "teacher"], title, render })   // صفحة مشتركة
//
// إن وُجد #content جاهزاً في ملف HTML (محتوى ثابت)، يُنقل إلى الهيكل تلقائياً
// قبل استدعاء render — هكذا تبقى الصفحات الجاهزة قابلة للدمج كما هي.
export async function boot(portalOrOptions, title, render) {
  const opts =
    typeof portalOrOptions === "string"
      ? { portal: portalOrOptions, title, render }
      : portalOrOptions || {};

  const pageTitle = opts.title || "";
  const pageRender = opts.render || (() => {});
  const allowed = opts.portals || (opts.portal ? [opts.portal] : []);

  const { profile } = await requireProfile();
  if (!profile) return;

  const actual = portalOf(profile);
  if (allowed.length && !allowed.includes(actual)) {
    location.assign(homeOf(profile));
    return;
  }

  const app = document.getElementById("app");
  const preset = document.getElementById("content")?.innerHTML || "";

  document.body.classList.add(`portal-${actual}`);
  app.innerHTML = renderShell({ portal: actual, title: pageTitle, profile });
  bindShell();

  const content = document.getElementById("content");
  if (preset.trim()) content.innerHTML = preset;

  try {
    await pageRender({ profile, portal: actual, content, el: content });
  } catch (err) {
    console.error(err);
    content.innerHTML = `<div class="empty">تعذّر تحميل الصفحة: ${String(err?.message || err)}</div>`;
  }
}

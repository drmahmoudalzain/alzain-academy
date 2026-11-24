import { boot } from "../lib/portal.js";
import { esc } from "../lib/fmt.js";
import { icon } from "../lib/icons.js";
import { p } from "../lib/base.js";

const PORTAL_LABEL = {
  student: "الطالب",
  teacher: "الأستاذ",
  assistant: "المساعد",
  owner: "الإدارة",
};

const pageTitle = String(document.title || "").split(" — ")[0] || "قيد التطوير";

// لوحة مؤقتة صادقة للبوابات التي لم تُسلَّم واجهاتها بعد.
// تمنع الروابط المعطوبة بعد النشر، وتُستبدل بصفحاتها النهائية عند تسليمها.
boot({
  portals: ["student", "teacher", "assistant", "owner"],
  title: pageTitle,
  render: async ({ profile, portal, content }) => {
    const firstName = String(profile?.name || "").split(" ")[0] || "أستاذي";
    const label = PORTAL_LABEL[portal] || "البوابة";

    content.innerHTML = `
      <section class="welcome-card">
        <div class="welcome-content">
          <div class="welcome-tag">${icon("sparkles")} بوابة ${esc(label)}</div>
          <h2>أهلاً بعودتك، <span class="name">${esc(firstName)}</span></h2>
          <p>صفحة <strong>${esc(pageTitle)}</strong> قيد التجهيز. يمكنك في الوقت الحالي استخدام الأقسام المتاحة أدناه بشكل كامل.</p>
        </div>
        <div class="welcome-illustration" aria-hidden="true">
          <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="8" y="10" width="48" height="44" rx="6" /><path d="M8 22h48" /><path d="M18 32h12M18 40h28" />
          </svg>
        </div>
      </section>

      <section class="card">
        <div class="card-header"><div class="card-title">${icon("grid")} أقسام متاحة الآن</div></div>
        <div class="card-body">
          <div class="quick-actions">
            <a class="action-btn" href="${p("pages/library.html")}"><div class="icon-wrap">${icon("library")}</div><span>المكتبة القانونية</span></a>
            <a class="action-btn blue" href="${p("pages/notifications.html")}"><div class="icon-wrap">${icon("bell")}</div><span>الإشعارات</span></a>
            <a class="action-btn green" href="${p("pages/ai-assistant.html")}"><div class="icon-wrap">${icon("assistant")}</div><span>المساعد الذكي</span></a>
            <a class="action-btn" href="${p("pages/account.html")}"><div class="icon-wrap">${icon("user")}</div><span>حسابي</span></a>
          </div>
        </div>
      </section>

      <section class="empty-state" role="status">
        <h3>${esc(pageTitle)} — قيد التطوير</h3>
        <p>ستظهر هنا بيانات بوابة ${esc(label)} فور اكتمال هذه الصفحة. لا بيانات تجريبية في هذه النسخة.</p>
      </section>`;
  },
});

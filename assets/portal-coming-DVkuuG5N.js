import{b as l,i as s,e as a}from"./portal-BGrs2lRg.js";import{p as t}from"./base-CCmrW03f.js";const d={student:"الطالب",teacher:"الأستاذ",assistant:"المساعد",owner:"الإدارة"},n=String(document.title||"").split(" — ")[0]||"قيد التطوير";l({portals:["student","teacher","assistant","owner"],title:n,render:async({profile:i,portal:c,content:o})=>{const r=String((i==null?void 0:i.name)||"").split(" ")[0]||"أستاذي",e=d[c]||"البوابة";o.innerHTML=`
      <section class="welcome-card">
        <div class="welcome-content">
          <div class="welcome-tag">${s("sparkles")} بوابة ${a(e)}</div>
          <h2>أهلاً بعودتك، <span class="name">${a(r)}</span></h2>
          <p>صفحة <strong>${a(n)}</strong> قيد التجهيز. يمكنك في الوقت الحالي استخدام الأقسام المتاحة أدناه بشكل كامل.</p>
        </div>
        <div class="welcome-illustration" aria-hidden="true">
          <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="8" y="10" width="48" height="44" rx="6" /><path d="M8 22h48" /><path d="M18 32h12M18 40h28" />
          </svg>
        </div>
      </section>

      <section class="card">
        <div class="card-header"><div class="card-title">${s("grid")} أقسام متاحة الآن</div></div>
        <div class="card-body">
          <div class="quick-actions">
            <a class="action-btn" href="${t("pages/library.html")}"><div class="icon-wrap">${s("library")}</div><span>المكتبة القانونية</span></a>
            <a class="action-btn blue" href="${t("pages/notifications.html")}"><div class="icon-wrap">${s("bell")}</div><span>الإشعارات</span></a>
            <a class="action-btn green" href="${t("pages/ai-assistant.html")}"><div class="icon-wrap">${s("assistant")}</div><span>المساعد الذكي</span></a>
            <a class="action-btn" href="${t("pages/account.html")}"><div class="icon-wrap">${s("user")}</div><span>حسابي</span></a>
          </div>
        </div>
      </section>

      <section class="empty-state" role="status">
        <h3>${a(n)} — قيد التطوير</h3>
        <p>ستظهر هنا بيانات بوابة ${a(e)} فور اكتمال هذه الصفحة. لا بيانات تجريبية في هذه النسخة.</p>
      </section>`}});

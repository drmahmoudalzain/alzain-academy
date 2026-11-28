import"./modulepreload-polyfill-B5Qt9EMX.js";import{b as A,i as r,e as l,f as L,r as B,d as v,a as h}from"./portal-CvPpoiNp.js";import{c as C}from"./api-DQI-AaeE.js";import{p as E}from"./base-CLcZMpw2.js";import{d as x,t as S}from"./csv-DOYG_5pE.js";import"./identity-rules-Cp64wFaG.js";import"https://esm.sh/@supabase/supabase-js@2";import"./first-visit-BDQ6DJqx.js";const M={attendance:"حضور",interaction:"تفاعل",assignment:"واجب",exam:"اختبارات"},I=[{label:"التاريخ",value:s=>s.created_at||""},{label:"التصنيف",value:s=>M[s.source_type]||s.source_type||""},{label:"التفاصيل",value:s=>s.source_detail||""},{label:"المقرر",value:s=>s.course_title||""},{label:"النقاط",value:s=>s.points??""}];function O(s){return S(I,s)}function j(s,a){x(a,O(s))}const k={attendance:{label:"حضور",icon:"check"},interaction:{label:"تفاعل",icon:"forum"},assignment:{label:"واجب",icon:"assignments"},exam:{label:"اختبارات",icon:"points"}},_=[{key:"all",label:"الكل"},{key:"attendance",label:"الحضور"},{key:"interaction",label:"التفاعل"},{key:"assignment",label:"الواجبات"},{key:"exam",label:"الاختبارات"}],N=s=>["bachelor","bachelor_m","bachelor_f"].includes(String(s??"").trim()),u=s=>{const a=Number(s);return Number.isFinite(a)?a:0},P=(s,a="#123A63")=>{const e=String(s??"").trim();return/^#[\da-f]{3,8}$/i.test(e)?e:a},$=s=>s==null||s===""?"—":v(s),D=()=>`
  <div class="pts-skeleton pts-skeleton-hero"></div>
  <div class="pts-skeleton pts-skeleton-card"></div>
  <div class="pts-skeleton pts-skeleton-card"></div>`,f=(s,a,e="points")=>`
  <div class="pts-empty" role="status">
    <span class="pts-empty-icon">${r(e)}</span>
    <h3>${l(s)}</h3>
    <p>${l(a)}</p>
  </div>`,H=()=>`
  <div class="pts-empty pts-empty-page" role="status">
    <span class="pts-empty-icon">${r("points")}</span>
    <h2>لا توجد نقاط مسجّلة بعد</h2>
    <p>تُكتسب النقاط من الحضور والتفاعل وتسليم الواجبات، وتظهر هنا فور تسجيلها. إن كنت تتوقع وجود رصيد لك، تواصل مع إدارة الأكاديمية.</p>
    <button class="pts-btn pts-btn-primary" type="button" data-reload>${r("refresh")} تحديث البيانات</button>
  </div>`,w=()=>`
  <div class="pts-empty pts-empty-page" role="alert">
    <span class="pts-empty-icon">${r("close")}</span>
    <h2>تعذّر تحميل النقاط</h2>
    <p>لم نتمكّن من جلب بيانات رصيدك الآن. تحقّق من اتصالك بالشبكة، ثم أعد المحاولة.</p>
    <button class="pts-btn pts-btn-primary" type="button" data-reload>${r("refresh")} إعادة المحاولة</button>
  </div>`;function R(s){const a=u(s.rank),e=u(s.students_count),t=a>0&&e>0?`المرتبة ${h(a)} من ${h(e)} طالب`:"الترتيب غير متاح بعد",o=u(s.week);return`<section class="pts-hero">
    <div class="pts-hero-info">
      <span class="pts-hero-tag">${r("sparkles")} إنجازك الأكاديمي</span>
      <h2>رصيدك من النقاط</h2>
      <p>تُسجَّل النقاط تلقائياً من حضور المحاضرات والمشاركة فيها وتسليم الواجبات، ويمكن مراجعة كل مكسب في السجل أدناه.</p>
      <div class="pts-hero-pills">
        <span class="pts-pill">${r("calendar")} هذا الأسبوع: <strong>${$(s.week)}</strong> نقطة</span>
        <span class="pts-pill">${r("users")} ${l(t)}</span>
      </div>
      <a class="pts-hero-link" href="${E("pages/student/grades.html")}">درجاتي ${r("arrow")}</a>
    </div>
    <div class="pts-total">
      <span class="pts-total-icon">${r("points")}</span>
      <strong class="pts-total-value">${$(s.total)}</strong>
      <span class="pts-total-label">إجمالي النقاط</span>
      <span class="pts-total-week">${o>0?`+${v(o)}`:v(o)} هذا الأسبوع</span>
    </div>
  </section>`}function g(s,a,e){const t=k[s],o=e>0?Math.round(u(a)/e*100):0;return`<article class="pts-source ${s}">
    <div class="pts-source-head">
      <span class="pts-source-icon">${r(t.icon)}</span>
      <strong>${l(t.label)}</strong>
      <span class="pts-source-share">${e>0?`${o}%`:"—"}</span>
    </div>
    <div class="pts-source-value">${$(a)} <small>نقطة</small></div>
    <div class="pts-bar" role="img" aria-label="${l(t.label)}: ${$(a)} نقطة، ${e>0?`${o} بالمئة`:"نسبة غير متاحة"}">
      <span style="--pts-bar:${e>0?o:0}%"></span>
    </div>
  </article>`}function F(s){const a=Array.isArray(s)?s:[];if(!a.length)return f("لا توجد نقاط حسب المقرر بعد","ستظهر هنا مساهمة كل مقرر في رصيدك عند تسجيل أول مكسب له.","courses");const e=Math.max(1,...a.map(t=>u(t.points)));return`<div class="pts-course-list">${a.map(t=>`<div class="pts-course-row">
        <div class="pts-course-head">
          <span><span class="pts-course-dot" style="--pts-course:${P(t.color)}"></span>${l(t.course_title||"مقرر بدون عنوان")}</span>
          <strong>${$(t.points)} <small>نقطة</small></strong>
        </div>
        <div class="pts-bar" role="img" aria-label="${l(t.course_title||"مقرر")}: ${$(t.points)} نقطة">
          <span style="--pts-bar:${Math.round(u(t.points)/e*100)}%"></span>
        </div>
        ${t.course_code?`<span class="pts-course-code">${l(t.course_code)}</span>`:""}
      </div>`).join("")}</div>`}function U(s){const a=Array.isArray(s)?s.slice(0,10):[];return a.length?`<ol class="pts-board">${a.map((e,t)=>`<li class="pts-board-row${e.is_me?" me":""}">
        <span class="pts-rank rank-${t+1}">${h(t+1)}</span>
        <span class="pts-avatar">${l(String(e.name||"?").trim().charAt(0)||"?")}</span>
        <span class="pts-board-name"><strong>${l(e.name||"طالب")}${e.is_me?" (أنت)":""}</strong><small>${e.is_me?"حسابك":`المرتبة ${h(t+1)}`}</small></span>
        <span class="pts-board-points">${r("points")} ${$(e.points)}</span>
      </li>`).join("")}</ol>`:f("لوحة الشرف غير متاحة بعد","ستظهر هنا أعلى عشرة طلاب بعد تسجيل نقاطهم في النظام.","users")}function q(s){const a=k[s.source_type]?s.source_type:"interaction",e=k[a],t=u(s.points),o=t>=0?"+":"−",c=s.created_at?`${L(s.created_at)} · ${B(s.created_at)}`:"—";return`<li class="pts-entry ${a}">
    <span class="pts-entry-icon">${r(e.icon)}</span>
    <div class="pts-entry-body">
      <div class="pts-entry-top">
        <span class="pts-entry-tag">${l(e.label)}</span>
        <strong class="pts-entry-points">${o}${v(Math.abs(t))}</strong>
      </div>
      <h4>${l(s.source_detail||e.label)}</h4>
      <p>
        ${s.course_title?`<span class="pts-entry-course">${r("book")}${l(s.course_title)}</span>`:""}
        <time>${l(c)}</time>
      </p>
    </div>
  </li>`}function T(s,a){const e=Array.isArray(s)?s:[];if(!e.length)return f("لا يوجد سجل نقاط بعد","ستظهر هنا كل زيادة أو خصم في رصيدك مع مصدرها وتاريخها فور تسجيلها.","history");const t=a==="all"?e:e.filter(o=>o.source_type===a);return t.length?`<ol class="pts-ledger">${t.map(q).join("")}</ol>`:f("لا توجد نقاط بهذا التصنيف","جرّب عرض تصنيف آخر من أزرار التصفية أعلاه.","history")}function V(s,a,e){const t=s&&typeof s=="object"?s:{},o=t.breakdown&&typeof t.breakdown=="object"?t.breakdown:{},c=Array.isArray(t.ledger)?t.ledger:[],d=Array.isArray(t.leaderboard)?t.leaderboard:[],b=Array.isArray(t.by_course)?t.by_course:[],m=u(t.total),p=e?_.filter(n=>n.key!=="assignment"):_.filter(n=>n.key==="all"||n.key==="assignment");return m>0||u(t.week)>0||c.length>0||d.length>0||b.length>0||Object.values(o).some(n=>u(n)>0)?`
    ${R(t)}

    <section class="pts-section" aria-labelledby="ptsBreakdownTitle">
      <div class="pts-section-head">
        <h2 id="ptsBreakdownTitle">${r("grid")} مصادر النقاط</h2>
        <span>نسب من إجمالي رصيدك الحالي</span>
      </div>
      <div class="pts-sources">
        ${e?`${g("attendance",o.attendance,m)}
               ${g("interaction",o.interaction,m)}
               ${g("exam",o.exam,m)}`:g("assignment",o.assignment,m)}
      </div>
    </section>

    <div class="pts-lower">
      <section class="pts-card" aria-labelledby="ptsCourseTitle">
        <h2 id="ptsCourseTitle">${r("book")} النقاط حسب المقرر</h2>
        ${F(b)}
      </section>

      <section class="pts-card" aria-labelledby="ptsBoardTitle">
        <h2 id="ptsBoardTitle">${r("users")} لوحة الشرف</h2>
        ${U(d)}
      </section>
    </div>

    <section class="pts-card" aria-labelledby="ptsLedgerTitle">
      <h2 id="ptsLedgerTitle">${r("history")} سجل النقاط</h2>
      <div class="pts-filters" role="group" aria-label="تصفية سجل النقاط">
        ${p.map(n=>`<button class="pts-filter${a===n.key?" active":""}" type="button" data-filter="${n.key}" aria-pressed="${a===n.key}">${l(n.label)}</button>`).join("")}
      </div>
      <div id="ptsLedgerList" aria-live="polite">${T(c,a)}</div>
    </section>`:H()}A("student","نقاطي",async({profile:s})=>{const a=document.getElementById("ptsView")||document.getElementById("content"),e=document.getElementById("ptsReload"),t=document.getElementById("ptsExport"),o=N(s==null?void 0:s.track);let c=[],d="all";function b(p){d=p,a.querySelectorAll("[data-filter]").forEach(n=>{const y=n.dataset.filter===d;n.classList.toggle("active",y),n.setAttribute("aria-pressed",String(y))});const i=document.getElementById("ptsLedgerList");i&&(i.innerHTML=T(c,d))}async function m(){var p;a.innerHTML=D(),e&&(e.disabled=!0),t&&(t.disabled=!0);try{const i=await C("student_points");if(!i.ok){console.error("[student_points]",i.error),c=[],a.innerHTML=w();return}c=Array.isArray((p=i.data)==null?void 0:p.ledger)?i.data.ledger:[],a.innerHTML=V(i.data,d,o),t&&(t.disabled=c.length===0)}catch(i){console.error("[student_points]",i),c=[],a.innerHTML=w()}finally{e&&(e.disabled=!1)}}a.addEventListener("click",p=>{if(p.target.closest("[data-reload]")){m();return}const n=p.target.closest("[data-filter]");n&&n.dataset.filter!==d&&b(n.dataset.filter)}),e&&e.addEventListener("click",m),t&&t.addEventListener("click",()=>{const p=d==="all"?c:c.filter(y=>y.source_type===d);if(!p.length)return;const i=new Date().toISOString().slice(0,10);j(p,`points-${d}-${i}.csv`);const n=t.textContent;t.textContent="تم التصدير",setTimeout(()=>{t.textContent=n},1500)}),await m()});

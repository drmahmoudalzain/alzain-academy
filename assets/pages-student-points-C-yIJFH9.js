import"./modulepreload-polyfill-B5Qt9EMX.js";import{b as _,i as r,e as o,f as w,r as A,d as b,c as m}from"./portal-eUwZL1O8.js";import{c as T}from"./api-Cx-w9ZQ2.js";import{p as L}from"./auth-BGBkidcA.js";import"https://esm.sh/@supabase/supabase-js@2";const h={attendance:{label:"حضور",icon:"check"},interaction:{label:"تفاعل",icon:"forum"},assignment:{label:"واجب",icon:"assignments"}},B=[{key:"all",label:"الكل"},{key:"attendance",label:"الحضور"},{key:"interaction",label:"التفاعل"},{key:"assignment",label:"الواجبات"}],p=t=>{const e=Number(t);return Number.isFinite(e)?e:0},M=(t,e="#123A63")=>{const s=String(t??"").trim();return/^#[\da-f]{3,8}$/i.test(s)?s:e},d=t=>t==null||t===""?"—":b(t),E=()=>`
  <div class="pts-skeleton pts-skeleton-hero"></div>
  <div class="pts-skeleton pts-skeleton-card"></div>
  <div class="pts-skeleton pts-skeleton-card"></div>`,y=(t,e,s="points")=>`
  <div class="pts-empty" role="status">
    <span class="pts-empty-icon">${r(s)}</span>
    <h3>${o(t)}</h3>
    <p>${o(e)}</p>
  </div>`,j=()=>`
  <div class="pts-empty pts-empty-page" role="status">
    <span class="pts-empty-icon">${r("points")}</span>
    <h2>لا توجد نقاط مسجّلة بعد</h2>
    <p>تُكتسب النقاط من الحضور والتفاعل وتسليم الواجبات، وتظهر هنا فور تسجيلها. إن كنت تتوقع وجود رصيد لك، تواصل مع إدارة الأكاديمية.</p>
    <button class="pts-btn pts-btn-primary" type="button" data-reload>${r("refresh")} تحديث البيانات</button>
  </div>`,f=()=>`
  <div class="pts-empty pts-empty-page" role="alert">
    <span class="pts-empty-icon">${r("close")}</span>
    <h2>تعذّر تحميل النقاط</h2>
    <p>لم نتمكّن من جلب بيانات رصيدك الآن. تحقّق من اتصالك بالشبكة، ثم أعد المحاولة.</p>
    <button class="pts-btn pts-btn-primary" type="button" data-reload>${r("refresh")} إعادة المحاولة</button>
  </div>`;function S(t){const e=p(t.rank),s=p(t.students_count),a=e>0&&s>0?`المرتبة ${m(e)} من ${m(s)} طالب`:"الترتيب غير متاح بعد",n=p(t.week);return`<section class="pts-hero">
    <div class="pts-hero-info">
      <span class="pts-hero-tag">${r("sparkles")} إنجازك الأكاديمي</span>
      <h2>رصيدك من النقاط</h2>
      <p>تُسجَّل النقاط تلقائياً من حضور المحاضرات والمشاركة فيها وتسليم الواجبات، ويمكن مراجعة كل مكسب في السجل أدناه.</p>
      <div class="pts-hero-pills">
        <span class="pts-pill">${r("calendar")} هذا الأسبوع: <strong>${d(t.week)}</strong> نقطة</span>
        <span class="pts-pill">${r("users")} ${o(a)}</span>
      </div>
      <a class="pts-hero-link" href="${L("pages/student/grades.html")}">درجاتي ${r("arrow")}</a>
    </div>
    <div class="pts-total">
      <span class="pts-total-icon">${r("points")}</span>
      <strong class="pts-total-value">${d(t.total)}</strong>
      <span class="pts-total-label">إجمالي النقاط</span>
      <span class="pts-total-week">${n>0?`+${b(n)}`:b(n)} هذا الأسبوع</span>
    </div>
  </section>`}function g(t,e,s){const a=h[t],n=s>0?Math.round(p(e)/s*100):0;return`<article class="pts-source ${t}">
    <div class="pts-source-head">
      <span class="pts-source-icon">${r(a.icon)}</span>
      <strong>${o(a.label)}</strong>
      <span class="pts-source-share">${s>0?`${n}%`:"—"}</span>
    </div>
    <div class="pts-source-value">${d(e)} <small>نقطة</small></div>
    <div class="pts-bar" role="img" aria-label="${o(a.label)}: ${d(e)} نقطة، ${s>0?`${n} بالمئة`:"نسبة غير متاحة"}">
      <span style="--pts-bar:${s>0?n:0}%"></span>
    </div>
  </article>`}function C(t){const e=Array.isArray(t)?t:[];if(!e.length)return y("لا توجد نقاط حسب المقرر بعد","ستظهر هنا مساهمة كل مقرر في رصيدك عند تسجيل أول مكسب له.","courses");const s=Math.max(1,...e.map(a=>p(a.points)));return`<div class="pts-course-list">${e.map(a=>`<div class="pts-course-row">
        <div class="pts-course-head">
          <span><span class="pts-course-dot" style="--pts-course:${M(a.color)}"></span>${o(a.course_title||"مقرر بدون عنوان")}</span>
          <strong>${d(a.points)} <small>نقطة</small></strong>
        </div>
        <div class="pts-bar" role="img" aria-label="${o(a.course_title||"مقرر")}: ${d(a.points)} نقطة">
          <span style="--pts-bar:${Math.round(p(a.points)/s*100)}%"></span>
        </div>
        ${a.course_code?`<span class="pts-course-code">${o(a.course_code)}</span>`:""}
      </div>`).join("")}</div>`}function H(t){const e=Array.isArray(t)?t.slice(0,10):[];return e.length?`<ol class="pts-board">${e.map((s,a)=>`<li class="pts-board-row${s.is_me?" me":""}">
        <span class="pts-rank rank-${a+1}">${m(a+1)}</span>
        <span class="pts-avatar">${o(String(s.name||"?").trim().charAt(0)||"?")}</span>
        <span class="pts-board-name"><strong>${o(s.name||"طالب")}${s.is_me?" (أنت)":""}</strong><small>${s.is_me?"حسابك":`المرتبة ${m(a+1)}`}</small></span>
        <span class="pts-board-points">${r("points")} ${d(s.points)}</span>
      </li>`).join("")}</ol>`:y("لوحة الشرف غير متاحة بعد","ستظهر هنا أعلى عشرة طلاب بعد تسجيل نقاطهم في النظام.","users")}function D(t){const e=h[t.source_type]?t.source_type:"interaction",s=h[e],a=p(t.points),n=a>=0?"+":"−",u=t.created_at?`${w(t.created_at)} · ${A(t.created_at)}`:"—";return`<li class="pts-entry ${e}">
    <span class="pts-entry-icon">${r(s.icon)}</span>
    <div class="pts-entry-body">
      <div class="pts-entry-top">
        <span class="pts-entry-tag">${o(s.label)}</span>
        <strong class="pts-entry-points">${n}${b(Math.abs(a))}</strong>
      </div>
      <h4>${o(t.source_detail||s.label)}</h4>
      <p>
        ${t.course_title?`<span class="pts-entry-course">${r("book")}${o(t.course_title)}</span>`:""}
        <time>${o(u)}</time>
      </p>
    </div>
  </li>`}function k(t,e){const s=Array.isArray(t)?t:[];if(!s.length)return y("لا يوجد سجل نقاط بعد","ستظهر هنا كل زيادة أو خصم في رصيدك مع مصدرها وتاريخها فور تسجيلها.","history");const a=e==="all"?s:s.filter(n=>n.source_type===e);return a.length?`<ol class="pts-ledger">${a.map(D).join("")}</ol>`:y("لا توجد نقاط بهذا التصنيف","جرّب عرض تصنيف آخر من أزرار التصفية أعلاه.","history")}function I(t,e){const s=t&&typeof t=="object"?t:{},a=s.breakdown&&typeof s.breakdown=="object"?s.breakdown:{},n=Array.isArray(s.ledger)?s.ledger:[],u=Array.isArray(s.leaderboard)?s.leaderboard:[],$=Array.isArray(s.by_course)?s.by_course:[],i=p(s.total);return i>0||p(s.week)>0||n.length>0||u.length>0||$.length>0||Object.values(a).some(l=>p(l)>0)?`
    ${S(s)}

    <section class="pts-section" aria-labelledby="ptsBreakdownTitle">
      <div class="pts-section-head">
        <h2 id="ptsBreakdownTitle">${r("grid")} مصادر النقاط</h2>
        <span>نسب من إجمالي رصيدك الحالي</span>
      </div>
      <div class="pts-sources">
        ${g("attendance",a.attendance,i)}
        ${g("interaction",a.interaction,i)}
        ${g("assignment",a.assignment,i)}
      </div>
    </section>

    <div class="pts-lower">
      <section class="pts-card" aria-labelledby="ptsCourseTitle">
        <h2 id="ptsCourseTitle">${r("book")} النقاط حسب المقرر</h2>
        ${C($)}
      </section>

      <section class="pts-card" aria-labelledby="ptsBoardTitle">
        <h2 id="ptsBoardTitle">${r("users")} لوحة الشرف</h2>
        ${H(u)}
      </section>
    </div>

    <section class="pts-card" aria-labelledby="ptsLedgerTitle">
      <h2 id="ptsLedgerTitle">${r("history")} سجل النقاط</h2>
      <div class="pts-filters" role="group" aria-label="تصفية سجل النقاط">
        ${B.map(l=>`<button class="pts-filter${e===l.key?" active":""}" type="button" data-filter="${l.key}" aria-pressed="${e===l.key}">${o(l.label)}</button>`).join("")}
      </div>
      <div id="ptsLedgerList" aria-live="polite">${k(n,e)}</div>
    </section>`:j()}_("student","نقاطي",async({content:t})=>{const e=document.getElementById("ptsView")||t,s=document.getElementById("ptsReload");let a=[],n="all";function u(i){n=i,e.querySelectorAll("[data-filter]").forEach(l=>{const v=l.dataset.filter===n;l.classList.toggle("active",v),l.setAttribute("aria-pressed",String(v))});const c=document.getElementById("ptsLedgerList");c&&(c.innerHTML=k(a,n))}async function $(){var i;e.innerHTML=E(),s&&(s.disabled=!0);try{const c=await T("student_points");if(!c.ok){console.error("[student_points]",c.error),a=[],e.innerHTML=f();return}a=Array.isArray((i=c.data)==null?void 0:i.ledger)?c.data.ledger:[],e.innerHTML=I(c.data,n)}catch(c){console.error("[student_points]",c),a=[],e.innerHTML=f()}finally{s&&(s.disabled=!1)}}e.addEventListener("click",i=>{if(i.target.closest("[data-reload]")){$();return}const l=i.target.closest("[data-filter]");l&&l.dataset.filter!==n&&u(l.dataset.filter)}),s&&s.addEventListener("click",$),await $()});

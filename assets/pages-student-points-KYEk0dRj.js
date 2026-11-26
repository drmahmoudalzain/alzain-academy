import"./modulepreload-polyfill-B5Qt9EMX.js";import{b as A,i as r,e as o,f as T,r as B,d as g,a as h}from"./portal-xyj4PMfy.js";import{c as L}from"./api-DQI-AaeE.js";import{p as E}from"./base-CLcZMpw2.js";import"./identity-rules-Cp64wFaG.js";import"https://esm.sh/@supabase/supabase-js@2";import"./first-visit-BDQ6DJqx.js";const k={attendance:{label:"حضور",icon:"check"},interaction:{label:"تفاعل",icon:"forum"},assignment:{label:"واجب",icon:"assignments"},exam:{label:"اختبارات",icon:"points"}},f=[{key:"all",label:"الكل"},{key:"attendance",label:"الحضور"},{key:"interaction",label:"التفاعل"},{key:"assignment",label:"الواجبات"},{key:"exam",label:"الاختبارات"}],M=s=>["bachelor","bachelor_m","bachelor_f"].includes(String(s??"").trim()),d=s=>{const a=Number(s);return Number.isFinite(a)?a:0},j=(s,a="#123A63")=>{const e=String(s??"").trim();return/^#[\da-f]{3,8}$/i.test(e)?e:a},m=s=>s==null||s===""?"—":g(s),x=()=>`
  <div class="pts-skeleton pts-skeleton-hero"></div>
  <div class="pts-skeleton pts-skeleton-card"></div>
  <div class="pts-skeleton pts-skeleton-card"></div>`,v=(s,a,e="points")=>`
  <div class="pts-empty" role="status">
    <span class="pts-empty-icon">${r(e)}</span>
    <h3>${o(s)}</h3>
    <p>${o(a)}</p>
  </div>`,S=()=>`
  <div class="pts-empty pts-empty-page" role="status">
    <span class="pts-empty-icon">${r("points")}</span>
    <h2>لا توجد نقاط مسجّلة بعد</h2>
    <p>تُكتسب النقاط من الحضور والتفاعل وتسليم الواجبات، وتظهر هنا فور تسجيلها. إن كنت تتوقع وجود رصيد لك، تواصل مع إدارة الأكاديمية.</p>
    <button class="pts-btn pts-btn-primary" type="button" data-reload>${r("refresh")} تحديث البيانات</button>
  </div>`,_=()=>`
  <div class="pts-empty pts-empty-page" role="alert">
    <span class="pts-empty-icon">${r("close")}</span>
    <h2>تعذّر تحميل النقاط</h2>
    <p>لم نتمكّن من جلب بيانات رصيدك الآن. تحقّق من اتصالك بالشبكة، ثم أعد المحاولة.</p>
    <button class="pts-btn pts-btn-primary" type="button" data-reload>${r("refresh")} إعادة المحاولة</button>
  </div>`;function C(s){const a=d(s.rank),e=d(s.students_count),t=a>0&&e>0?`المرتبة ${h(a)} من ${h(e)} طالب`:"الترتيب غير متاح بعد",n=d(s.week);return`<section class="pts-hero">
    <div class="pts-hero-info">
      <span class="pts-hero-tag">${r("sparkles")} إنجازك الأكاديمي</span>
      <h2>رصيدك من النقاط</h2>
      <p>تُسجَّل النقاط تلقائياً من حضور المحاضرات والمشاركة فيها وتسليم الواجبات، ويمكن مراجعة كل مكسب في السجل أدناه.</p>
      <div class="pts-hero-pills">
        <span class="pts-pill">${r("calendar")} هذا الأسبوع: <strong>${m(s.week)}</strong> نقطة</span>
        <span class="pts-pill">${r("users")} ${o(t)}</span>
      </div>
      <a class="pts-hero-link" href="${E("pages/student/grades.html")}">درجاتي ${r("arrow")}</a>
    </div>
    <div class="pts-total">
      <span class="pts-total-icon">${r("points")}</span>
      <strong class="pts-total-value">${m(s.total)}</strong>
      <span class="pts-total-label">إجمالي النقاط</span>
      <span class="pts-total-week">${n>0?`+${g(n)}`:g(n)} هذا الأسبوع</span>
    </div>
  </section>`}function y(s,a,e){const t=k[s],n=e>0?Math.round(d(a)/e*100):0;return`<article class="pts-source ${s}">
    <div class="pts-source-head">
      <span class="pts-source-icon">${r(t.icon)}</span>
      <strong>${o(t.label)}</strong>
      <span class="pts-source-share">${e>0?`${n}%`:"—"}</span>
    </div>
    <div class="pts-source-value">${m(a)} <small>نقطة</small></div>
    <div class="pts-bar" role="img" aria-label="${o(t.label)}: ${m(a)} نقطة، ${e>0?`${n} بالمئة`:"نسبة غير متاحة"}">
      <span style="--pts-bar:${e>0?n:0}%"></span>
    </div>
  </article>`}function H(s){const a=Array.isArray(s)?s:[];if(!a.length)return v("لا توجد نقاط حسب المقرر بعد","ستظهر هنا مساهمة كل مقرر في رصيدك عند تسجيل أول مكسب له.","courses");const e=Math.max(1,...a.map(t=>d(t.points)));return`<div class="pts-course-list">${a.map(t=>`<div class="pts-course-row">
        <div class="pts-course-head">
          <span><span class="pts-course-dot" style="--pts-course:${j(t.color)}"></span>${o(t.course_title||"مقرر بدون عنوان")}</span>
          <strong>${m(t.points)} <small>نقطة</small></strong>
        </div>
        <div class="pts-bar" role="img" aria-label="${o(t.course_title||"مقرر")}: ${m(t.points)} نقطة">
          <span style="--pts-bar:${Math.round(d(t.points)/e*100)}%"></span>
        </div>
        ${t.course_code?`<span class="pts-course-code">${o(t.course_code)}</span>`:""}
      </div>`).join("")}</div>`}function I(s){const a=Array.isArray(s)?s.slice(0,10):[];return a.length?`<ol class="pts-board">${a.map((e,t)=>`<li class="pts-board-row${e.is_me?" me":""}">
        <span class="pts-rank rank-${t+1}">${h(t+1)}</span>
        <span class="pts-avatar">${o(String(e.name||"?").trim().charAt(0)||"?")}</span>
        <span class="pts-board-name"><strong>${o(e.name||"طالب")}${e.is_me?" (أنت)":""}</strong><small>${e.is_me?"حسابك":`المرتبة ${h(t+1)}`}</small></span>
        <span class="pts-board-points">${r("points")} ${m(e.points)}</span>
      </li>`).join("")}</ol>`:v("لوحة الشرف غير متاحة بعد","ستظهر هنا أعلى عشرة طلاب بعد تسجيل نقاطهم في النظام.","users")}function D(s){const a=k[s.source_type]?s.source_type:"interaction",e=k[a],t=d(s.points),n=t>=0?"+":"−",p=s.created_at?`${T(s.created_at)} · ${B(s.created_at)}`:"—";return`<li class="pts-entry ${a}">
    <span class="pts-entry-icon">${r(e.icon)}</span>
    <div class="pts-entry-body">
      <div class="pts-entry-top">
        <span class="pts-entry-tag">${o(e.label)}</span>
        <strong class="pts-entry-points">${n}${g(Math.abs(t))}</strong>
      </div>
      <h4>${o(s.source_detail||e.label)}</h4>
      <p>
        ${s.course_title?`<span class="pts-entry-course">${r("book")}${o(s.course_title)}</span>`:""}
        <time>${o(p)}</time>
      </p>
    </div>
  </li>`}function w(s,a){const e=Array.isArray(s)?s:[];if(!e.length)return v("لا يوجد سجل نقاط بعد","ستظهر هنا كل زيادة أو خصم في رصيدك مع مصدرها وتاريخها فور تسجيلها.","history");const t=a==="all"?e:e.filter(n=>n.source_type===a);return t.length?`<ol class="pts-ledger">${t.map(D).join("")}</ol>`:v("لا توجد نقاط بهذا التصنيف","جرّب عرض تصنيف آخر من أزرار التصفية أعلاه.","history")}function F(s,a,e){const t=s&&typeof s=="object"?s:{},n=t.breakdown&&typeof t.breakdown=="object"?t.breakdown:{},p=Array.isArray(t.ledger)?t.ledger:[],b=Array.isArray(t.leaderboard)?t.leaderboard:[],$=Array.isArray(t.by_course)?t.by_course:[],i=d(t.total),c=e?f.filter(l=>l.key!=="assignment"):f.filter(l=>l.key==="all"||l.key==="assignment");return i>0||d(t.week)>0||p.length>0||b.length>0||$.length>0||Object.values(n).some(l=>d(l)>0)?`
    ${C(t)}

    <section class="pts-section" aria-labelledby="ptsBreakdownTitle">
      <div class="pts-section-head">
        <h2 id="ptsBreakdownTitle">${r("grid")} مصادر النقاط</h2>
        <span>نسب من إجمالي رصيدك الحالي</span>
      </div>
      <div class="pts-sources">
        ${e?`${y("attendance",n.attendance,i)}
               ${y("interaction",n.interaction,i)}
               ${y("exam",n.exam,i)}`:y("assignment",n.assignment,i)}
      </div>
    </section>

    <div class="pts-lower">
      <section class="pts-card" aria-labelledby="ptsCourseTitle">
        <h2 id="ptsCourseTitle">${r("book")} النقاط حسب المقرر</h2>
        ${H($)}
      </section>

      <section class="pts-card" aria-labelledby="ptsBoardTitle">
        <h2 id="ptsBoardTitle">${r("users")} لوحة الشرف</h2>
        ${I(b)}
      </section>
    </div>

    <section class="pts-card" aria-labelledby="ptsLedgerTitle">
      <h2 id="ptsLedgerTitle">${r("history")} سجل النقاط</h2>
      <div class="pts-filters" role="group" aria-label="تصفية سجل النقاط">
        ${c.map(l=>`<button class="pts-filter${a===l.key?" active":""}" type="button" data-filter="${l.key}" aria-pressed="${a===l.key}">${o(l.label)}</button>`).join("")}
      </div>
      <div id="ptsLedgerList" aria-live="polite">${w(p,a)}</div>
    </section>`:S()}A("student","نقاطي",async({profile:s})=>{const a=document.getElementById("ptsView")||document.getElementById("content"),e=document.getElementById("ptsReload"),t=M(s==null?void 0:s.track);let n=[],p="all";function b(i){p=i,a.querySelectorAll("[data-filter]").forEach(u=>{const l=u.dataset.filter===p;u.classList.toggle("active",l),u.setAttribute("aria-pressed",String(l))});const c=document.getElementById("ptsLedgerList");c&&(c.innerHTML=w(n,p))}async function $(){var i;a.innerHTML=x(),e&&(e.disabled=!0);try{const c=await L("student_points");if(!c.ok){console.error("[student_points]",c.error),n=[],a.innerHTML=_();return}n=Array.isArray((i=c.data)==null?void 0:i.ledger)?c.data.ledger:[],a.innerHTML=F(c.data,p,t)}catch(c){console.error("[student_points]",c),n=[],a.innerHTML=_()}finally{e&&(e.disabled=!1)}}a.addEventListener("click",i=>{if(i.target.closest("[data-reload]")){$();return}const u=i.target.closest("[data-filter]");u&&u.dataset.filter!==p&&b(u.dataset.filter)}),e&&e.addEventListener("click",$),await $()});

import"./modulepreload-polyfill-B5Qt9EMX.js";import{b as k,i as o,a as d,d as h,e as c}from"./portal-CvPpoiNp.js";import{c as f}from"./api-DQI-AaeE.js";import{p as _}from"./base-CLcZMpw2.js";import"./identity-rules-Cp64wFaG.js";import"https://esm.sh/@supabase/supabase-js@2";import"./first-visit-BDQ6DJqx.js";const b=[{key:"excellent",label:"ممتاز"},{key:"very_good",label:"جيد جداً"},{key:"good",label:"جيد"},{key:"pass",label:"مقبول"},{key:"low",label:"منخفض"}],M=s=>["bachelor","bachelor_m","bachelor_f"].includes(String(s??"").trim()),g=s=>{const a=Number(s);return Number.isFinite(a)?a:0},x=s=>Math.min(100,Math.max(0,g(s))),T=(s,a="#123A63")=>{const t=String(s??"").trim();return/^#[\da-f]{3,8}$/i.test(t)?t:a},B=s=>String(s??"").replace(/[^A-Za-z0-9\u0600-\u06FF]/g,"").slice(0,2)||"—",v=s=>s==null||s===""?"—":`${h(s)}%`,u=s=>s==null||s===""?"—":h(s),I=()=>`
  <div class="gr-skeleton gr-skeleton-hero"></div>
  <div class="gr-stats">
    <div class="gr-skeleton gr-skeleton-stat"></div>
    <div class="gr-skeleton gr-skeleton-stat"></div>
    <div class="gr-skeleton gr-skeleton-stat"></div>
  </div>
  <div class="gr-skeleton gr-skeleton-card"></div>
  <div class="gr-skeleton gr-skeleton-card"></div>`,y=(s,a,t="grades",r="")=>`
  <div class="gr-empty" role="status">
    <span class="gr-empty-icon">${o(t)}</span>
    <h3>${c(s)}</h3>
    <p>${c(a)}</p>
    ${r}
  </div>`,L=()=>`
  <div class="gr-empty gr-empty-page" role="status">
    <span class="gr-empty-icon">${o("grades")}</span>
    <h2>لا توجد درجات منشورة بعد</h2>
    <p>ستظهر هنا درجاتك ومعدلك فور اعتماد الاختبارات والواجبات وتسجيل الحضور. إن كنت تتوقع ظهور بياناتك، تواصل مع إدارة الأكاديمية.</p>
    <button class="gr-btn gr-btn-primary" type="button" data-reload>${o("refresh")} تحديث البيانات</button>
  </div>`,$=()=>`
  <div class="gr-empty gr-empty-page" role="alert">
    <span class="gr-empty-icon">${o("close")}</span>
    <h2>تعذّر تحميل الدرجات</h2>
    <p>لم نتمكّن من جلب سجلك الأكاديمي الآن. تحقّق من اتصالك بالشبكة، ثم أعد المحاولة.</p>
    <button class="gr-btn gr-btn-primary" type="button" data-reload>${o("refresh")} إعادة المحاولة</button>
  </div>`;function m(s,a,t){return`<div class="gr-metric" data-kind="${t}">
    <div class="gr-metric-head"><span>${c(s)}</span><strong>${v(a)}</strong></div>
    <div class="gr-bar" role="img" aria-label="${c(s)}: ${v(a)}">
      <span style="--gr-bar:${x(a)}%"></span>
    </div>
  </div>`}function j(s,a){const t=c(s.title||"مقرر بدون عنوان"),r=c(s.code||""),l=String(s.letter??"").trim(),n=l?c(l):"—",e=l.toUpperCase().replace(/[^A-Z]/g,"").slice(0,2)||"none",i=[r,s.lectures_count!=null?`${d(s.lectures_count)} محاضرة`:"",s.exams_count!=null?`${d(s.exams_count)} اختبار`:"",s.assignments_count!=null?`${d(s.assignments_count)} واجب`:""].filter(Boolean);return`<article class="gr-course">
    <div class="gr-course-head">
      <span class="gr-course-icon" style="--gr-course:${T(s.color)}">${c(B(s.code))}</span>
      <div class="gr-course-title">
        <h3>${t}</h3>
        <p>${i.map(p=>`<span>${p}</span>`).join('<span class="gr-sep">·</span>')}</p>
      </div>
      <span class="gr-letter gr-letter-${c(e)}" aria-label="التقدير: ${n}">${n}</span>
    </div>
    <div class="gr-metrics">
      ${a?`${m("الحضور",s.attendance_pct,"attendance")}
             ${m("التفاعل",s.interaction_pct,"interaction")}
             ${m("الاختبارات",s.exam_pct,"exams")}`:m("الواجبات",s.assignment_pct,"assignments")}
    </div>
    <div class="gr-course-foot">
      <span>الدرجة النهائية</span>
      <strong>${u(s.total_pct??s.final_pct)}<small>/100</small></strong>
    </div>
  </article>`}function A(s){const a=s&&typeof s=="object"?s:{},t=b.map(e=>({...e,count:Math.max(0,g(a[e.key]))})),r=t.reduce((e,i)=>e+i.count,0),l=Math.max(1,...t.map(e=>e.count)),n=r?`<div class="gr-dist">${t.map(e=>`<div class="gr-dist-row ${e.key}">
            <span class="gr-dist-label">${c(e.label)}</span>
            <div class="gr-bar" role="img" aria-label="${c(e.label)}: ${d(e.count)} مقرر">
              <span style="--gr-bar:${Math.round(e.count/l*100)}%"></span>
            </div>
            <strong>${d(e.count)}</strong>
          </div>`).join("")}</div>`:y("لا يوجد توزيع بعد","سيظهر توزيع التقديرات عند توفر مقررات مكتملة الدرجات.","grades");return`<section class="gr-card">
    <h3>${o("grades")} توزيع التقديرات</h3>
    ${n}
  </section>`}function E(s,a){const t=s&&typeof s=="object"?s:{},r=Array.isArray(t.courses)?t.courses:[];if(!(r.length>0||g(t.gpa)>0||g(t.average)>0||b.some(i=>{var p;return g((p=t.distribution)==null?void 0:p[i.key])>0})))return L();const n=g(t.gpa),e=Math.round(Math.min(4,Math.max(0,n))/4*360);return`
    <section class="gr-hero">
      <div class="gr-hero-info">
        <span class="gr-hero-tag">${o("grades")} سجلك الأكاديمي</span>
        <h2>معدلك التراكمي</h2>
        <p>تُحسب الدرجات من الاختبارات المنشورة والواجبات المقيّمة وسجل الحضور، وتُحدَّث فور اعتماد أي نتيجة جديدة.</p>
        <a class="gr-hero-link" href="${_("pages/student/points.html")}">نقاطي ${o("arrow")}</a>
      </div>
      <div class="gr-ring" role="img" aria-label="المعدل التراكمي ${u(t.gpa)} من أربعة" style="--gr-ring:${e}deg">
        <div class="gr-ring-inner">
          <strong>${u(t.gpa)}</strong>
          <span>من 4.00</span>
        </div>
      </div>
    </section>

    <section class="gr-stats" aria-label="ملخص الدرجات">
      <div class="gr-stat average">
        <span class="gr-stat-icon">${o("grades")}</span>
        <span class="gr-stat-body"><span>متوسط الدرجات</span><strong>${u(t.average)}${t.average===null||t.average===void 0||t.average===""?"":"<small>%</small>"}</strong></span>
      </div>
      <div class="gr-stat courses">
        <span class="gr-stat-icon">${o("book")}</span>
        <span class="gr-stat-body"><span>المقررات المسجلة</span><strong>${d(t.courses_count??r.length)}</strong></span>
      </div>
      <div class="gr-stat completed">
        <span class="gr-stat-icon">${o("checks")}</span>
        <span class="gr-stat-body"><span>مقررات مكتملة</span><strong>${d(t.completed_count??0)}</strong></span>
      </div>
    </section>

    <section class="gr-section" aria-labelledby="grCoursesTitle">
      <div class="gr-section-head">
        <h2 id="grCoursesTitle">${o("courses")} درجات المقررات</h2>
        <span>نسب مئوية من الدرجة الكلية لكل مقرر</span>
      </div>
      ${r.length?`<div class="gr-courses">${r.map(i=>j(i,a)).join("")}</div>`:y("لا توجد درجات مقررات بعد","ستظهر درجات كل مقرر هنا بعد نشر الاختبارات وتقييم الواجبات وتسجيل الحضور.","courses")}
    </section>

    ${A(t.distribution)}`}k("student","درجاتي",async({profile:s})=>{const a=document.getElementById("grView")||document.getElementById("content"),t=document.getElementById("grReload"),r=M(s==null?void 0:s.track);async function l(){a.innerHTML=I(),t&&(t.disabled=!0);try{const n=await f("student_grades");if(!n.ok){console.error("[student_grades]",n.error),a.innerHTML=$();return}a.innerHTML=E(n.data,r)}catch(n){console.error("[student_grades]",n),a.innerHTML=$()}finally{t&&(t.disabled=!1)}}a.addEventListener("click",n=>{n.target.closest("[data-reload]")&&l()}),t&&t.addEventListener("click",l),await l()});

import"./modulepreload-polyfill-B5Qt9EMX.js";import{b as y,i as o,c,d as $,e as l}from"./portal-uUs1xKsy.js";import{c as f}from"./api-CE-Y1P0n.js";import{p as k}from"./auth-DJQIbBRA.js";import"https://esm.sh/@supabase/supabase-js@2";const b=[{key:"excellent",label:"ممتاز"},{key:"very_good",label:"جيد جداً"},{key:"good",label:"جيد"},{key:"pass",label:"مقبول"},{key:"low",label:"منخفض"}],d=s=>{const t=Number(s);return Number.isFinite(t)?t:0},_=s=>Math.min(100,Math.max(0,d(s))),M=(s,t="#123A63")=>{const a=String(s??"").trim();return/^#[\da-f]{3,8}$/i.test(a)?a:t},x=s=>String(s??"").replace(/[^A-Za-z0-9\u0600-\u06FF]/g,"").slice(0,2)||"—",u=s=>s==null||s===""?"—":`${$(s)}%`,p=s=>s==null||s===""?"—":$(s),T=()=>`
  <div class="gr-skeleton gr-skeleton-hero"></div>
  <div class="gr-stats">
    <div class="gr-skeleton gr-skeleton-stat"></div>
    <div class="gr-skeleton gr-skeleton-stat"></div>
    <div class="gr-skeleton gr-skeleton-stat"></div>
  </div>
  <div class="gr-skeleton gr-skeleton-card"></div>
  <div class="gr-skeleton gr-skeleton-card"></div>`,h=(s,t,a="grades",r="")=>`
  <div class="gr-empty" role="status">
    <span class="gr-empty-icon">${o(a)}</span>
    <h3>${l(s)}</h3>
    <p>${l(t)}</p>
    ${r}
  </div>`,B=()=>`
  <div class="gr-empty gr-empty-page" role="status">
    <span class="gr-empty-icon">${o("grades")}</span>
    <h2>لا توجد درجات منشورة بعد</h2>
    <p>ستظهر هنا درجاتك ومعدلك فور اعتماد الاختبارات والواجبات وتسجيل الحضور. إن كنت تتوقع ظهور بياناتك، تواصل مع إدارة الأكاديمية.</p>
    <button class="gr-btn gr-btn-primary" type="button" data-reload>${o("refresh")} تحديث البيانات</button>
  </div>`,v=()=>`
  <div class="gr-empty gr-empty-page" role="alert">
    <span class="gr-empty-icon">${o("close")}</span>
    <h2>تعذّر تحميل الدرجات</h2>
    <p>لم نتمكّن من جلب سجلك الأكاديمي الآن. تحقّق من اتصالك بالشبكة، ثم أعد المحاولة.</p>
    <button class="gr-btn gr-btn-primary" type="button" data-reload>${o("refresh")} إعادة المحاولة</button>
  </div>`;function m(s,t,a){return`<div class="gr-metric" data-kind="${a}">
    <div class="gr-metric-head"><span>${l(s)}</span><strong>${u(t)}</strong></div>
    <div class="gr-bar" role="img" aria-label="${l(s)}: ${u(t)}">
      <span style="--gr-bar:${_(t)}%"></span>
    </div>
  </div>`}function L(s){const t=l(s.title||"مقرر بدون عنوان"),a=l(s.code||""),r=String(s.letter??"").trim(),n=r?l(r):"—",g=r.toUpperCase().replace(/[^A-Z]/g,"").slice(0,2)||"none",e=[a,s.lectures_count!=null?`${c(s.lectures_count)} محاضرة`:"",s.exams_count!=null?`${c(s.exams_count)} اختبار`:"",s.assignments_count!=null?`${c(s.assignments_count)} واجب`:""].filter(Boolean);return`<article class="gr-course">
    <div class="gr-course-head">
      <span class="gr-course-icon" style="--gr-course:${M(s.color)}">${l(x(s.code))}</span>
      <div class="gr-course-title">
        <h3>${t}</h3>
        <p>${e.map(i=>`<span>${i}</span>`).join('<span class="gr-sep">·</span>')}</p>
      </div>
      <span class="gr-letter gr-letter-${l(g)}" aria-label="التقدير: ${n}">${n}</span>
    </div>
    <div class="gr-metrics">
      ${m("الاختبارات",s.exam_pct,"exams")}
      ${m("الواجبات",s.assignment_pct,"assignments")}
      ${m("الحضور",s.attendance_pct,"attendance")}
    </div>
    <div class="gr-course-foot">
      <span>الدرجة النهائية</span>
      <strong>${p(s.final_pct)}<small>/100</small></strong>
    </div>
  </article>`}function j(s){const t=s&&typeof s=="object"?s:{},a=b.map(e=>({...e,count:Math.max(0,d(t[e.key]))})),r=a.reduce((e,i)=>e+i.count,0),n=Math.max(1,...a.map(e=>e.count)),g=r?`<div class="gr-dist">${a.map(e=>`<div class="gr-dist-row ${e.key}">
            <span class="gr-dist-label">${l(e.label)}</span>
            <div class="gr-bar" role="img" aria-label="${l(e.label)}: ${c(e.count)} مقرر">
              <span style="--gr-bar:${Math.round(e.count/n*100)}%"></span>
            </div>
            <strong>${c(e.count)}</strong>
          </div>`).join("")}</div>`:h("لا يوجد توزيع بعد","سيظهر توزيع التقديرات عند توفر مقررات مكتملة الدرجات.","grades");return`<section class="gr-card">
    <h3>${o("grades")} توزيع التقديرات</h3>
    ${g}
  </section>`}function A(s){const t=s&&typeof s=="object"?s:{},a=Array.isArray(t.courses)?t.courses:[];if(!(a.length>0||d(t.gpa)>0||d(t.average)>0||b.some(e=>{var i;return d((i=t.distribution)==null?void 0:i[e.key])>0})))return B();const n=d(t.gpa),g=Math.round(Math.min(4,Math.max(0,n))/4*360);return`
    <section class="gr-hero">
      <div class="gr-hero-info">
        <span class="gr-hero-tag">${o("grades")} سجلك الأكاديمي</span>
        <h2>معدلك التراكمي</h2>
        <p>تُحسب الدرجات من الاختبارات المنشورة والواجبات المقيّمة وسجل الحضور، وتُحدَّث فور اعتماد أي نتيجة جديدة.</p>
        <a class="gr-hero-link" href="${k("pages/student/points.html")}">نقاطي ${o("arrow")}</a>
      </div>
      <div class="gr-ring" role="img" aria-label="المعدل التراكمي ${p(t.gpa)} من أربعة" style="--gr-ring:${g}deg">
        <div class="gr-ring-inner">
          <strong>${p(t.gpa)}</strong>
          <span>من 4.00</span>
        </div>
      </div>
    </section>

    <section class="gr-stats" aria-label="ملخص الدرجات">
      <div class="gr-stat average">
        <span class="gr-stat-icon">${o("grades")}</span>
        <span class="gr-stat-body"><span>متوسط الدرجات</span><strong>${p(t.average)}${t.average===null||t.average===void 0||t.average===""?"":"<small>%</small>"}</strong></span>
      </div>
      <div class="gr-stat courses">
        <span class="gr-stat-icon">${o("book")}</span>
        <span class="gr-stat-body"><span>المقررات المسجلة</span><strong>${c(t.courses_count??a.length)}</strong></span>
      </div>
      <div class="gr-stat completed">
        <span class="gr-stat-icon">${o("checks")}</span>
        <span class="gr-stat-body"><span>مقررات مكتملة</span><strong>${c(t.completed_count??0)}</strong></span>
      </div>
    </section>

    <section class="gr-section" aria-labelledby="grCoursesTitle">
      <div class="gr-section-head">
        <h2 id="grCoursesTitle">${o("courses")} درجات المقررات</h2>
        <span>نسب مئوية من الدرجة الكلية لكل مقرر</span>
      </div>
      ${a.length?`<div class="gr-courses">${a.map(L).join("")}</div>`:h("لا توجد درجات مقررات بعد","ستظهر درجات كل مقرر هنا بعد نشر الاختبارات وتقييم الواجبات وتسجيل الحضور.","courses")}
    </section>

    ${j(t.distribution)}`}y("student","درجاتي",async({content:s})=>{const t=document.getElementById("grView")||s,a=document.getElementById("grReload");async function r(){t.innerHTML=T(),a&&(a.disabled=!0);try{const n=await f("student_grades");if(!n.ok){console.error("[student_grades]",n.error),t.innerHTML=v();return}t.innerHTML=A(n.data)}catch(n){console.error("[student_grades]",n),t.innerHTML=v()}finally{a&&(a.disabled=!1)}}t.addEventListener("click",n=>{n.target.closest("[data-reload]")&&r()}),a&&a.addEventListener("click",r),await r()});

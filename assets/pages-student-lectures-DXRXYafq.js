import"./modulepreload-polyfill-B5Qt9EMX.js";import{b as w,i as o,e as n,a as u,f as A,r as T}from"./portal-DWIJxEh3.js";import{c as _}from"./api-DM929jBM.js";import{p as k}from"./base-CLcZMpw2.js";import"./identity-rules-DVz3p2Gs.js";import"https://esm.sh/@supabase/supabase-js@2";import"./first-visit-BDQ6DJqx.js";const v="all";function q(t,s={}){if(!Array.isArray(t))return[];const c=String(s.course??v),l=String(s.status??v),r=String(s.type??v),d=String(s.query??"").trim().toLocaleLowerCase();return t.filter(i=>!i||typeof i!="object"||c!==v&&String(i.course_id??"")!==c||l!==v&&String(i.status??"")!==l||r!==v&&String(i.lecture_type??"")!==r?!1:d?[i.title,i.description,i.course_title,i.course_code,i.teacher].some(m=>String(m??"").toLocaleLowerCase().includes(d)):!0)}const f={live:{label:"جارية الآن",icon:"video"},attended:{label:"حضرتها",icon:"check"},upcoming:{label:"قادمة",icon:"calendar"},missed:{label:"فائتة",icon:"close"}},$={direct:{label:"مباشر",icon:"video"},online:{label:"أونلاين",icon:"monitor"},recorded:{label:"مسجل",icon:"library"}},b=t=>document.getElementById(t),e={stats:{},courses:[],lectures:[],course:"all",status:"all",type:"all",view:"grid",query:""};let a=null;function E(t){const s=new Date(t);return Number.isNaN(s.getTime())?{day:"—",month:""}:{day:u(s.getDate()),month:new Intl.DateTimeFormat("ar",{month:"short"}).format(s)}}function H(){a.stats.innerHTML=Array.from({length:4},()=>'<div class="lcs-skeleton lcs-skeleton-stat"></div>').join(""),a.tabs.innerHTML=Array.from({length:3},()=>'<div class="lcs-skeleton lcs-skeleton-tab"></div>').join(""),a.grid.innerHTML=Array.from({length:2},()=>'<div class="lcs-skeleton lcs-skeleton-card"></div>').join(""),a.status.disabled=!0,a.type.disabled=!0,a.search.disabled=!0,a.view.querySelectorAll("button").forEach(t=>{t.disabled=!0})}function M({title:t,text:s,retry:c=!1,tone:l="status"}){a.stats.innerHTML="",a.tabs.innerHTML="",a.status.disabled=!0,a.type.disabled=!0,a.search.disabled=!0,a.view.querySelectorAll("button").forEach(r=>{r.disabled=!0}),a.grid.setAttribute("role",l),a.grid.innerHTML=`<div class="lcs-empty">
    <div class="lcs-empty-icon">${o("lectures")}</div>
    <h2>${n(t)}</h2>
    <p>${n(s)}</p>
    ${c?'<button class="lcs-btn lcs-btn-secondary" type="button" data-retry>إعادة المحاولة</button>':""}
  </div>`}function j(){const t=e.stats;return{live:e.lectures.filter(s=>s.status==="live").length,attended:Number(t.attended??e.lectures.filter(s=>s.status==="attended").length),upcoming:Number(t.upcoming??e.lectures.filter(s=>s.status==="upcoming").length),missed:Number(t.missed??e.lectures.filter(s=>s.status==="missed").length)}}function N(){const t=j(),s=[{cls:"lcs-total",icon:"lectures",label:"إجمالي المحاضرات",value:u(e.stats.total??e.lectures.length),unit:"محاضرة"},{cls:"lcs-attended",icon:"check",label:"حضرتها",value:u(t.attended),unit:"محاضرة"},{cls:"lcs-upcoming",icon:"calendar",label:"قادمة",value:u(t.upcoming),unit:"محاضرة"},{cls:"lcs-missed",icon:"close",label:"فائتة",value:u(t.missed),unit:"محاضرة"}];a.stats.innerHTML=s.map(c=>`<div class="lcs-stat ${c.cls}">
        <span class="lcs-stat-icon">${o(c.icon)}</span>
        <span class="lcs-stat-body">
          <span class="lcs-stat-label">${n(c.label)}</span>
          <span class="lcs-stat-value">${n(c.value)}<small>${n(c.unit)}</small></span>
        </span>
      </div>`).join(""),a.stats.setAttribute("aria-label",`إحصاءات المحاضرات: ${u(e.stats.total??e.lectures.length)} محاضرة، ${u(t.upcoming)} قادمة، ${u(t.live)} جارية`)}function g(){const t=[{id:"all",label:"كل المقررات",count:e.lectures.length}];e.courses.forEach(s=>{const c=String(s.id);t.push({id:c,label:[s.code,s.title].filter(Boolean).join(" — ")||"مقرر",count:e.lectures.filter(l=>String(l.course_id)===c).length})}),a.tabs.innerHTML=t.map(s=>`<button class="lcs-course-tab${e.course===s.id?" lcs-active":""}" type="button"
        role="tab" data-course="${n(s.id)}" aria-selected="${e.course===s.id}">
        ${n(s.label)}<span class="lcs-tab-count">${u(s.count)}</span>
      </button>`).join(""),t.some(s=>s.id===e.course)||(e.course="all",g())}function C(t){const s=f[t.status]?t.status:"upcoming",c=$[t.lecture_type]?t.lecture_type:"recorded",l=f[s],r=$[c],d=[t.course_code,t.course_title].filter(Boolean).map(n).join(" — ")||"—",i=n(t.course_color||"#123A63"),m=E(t.scheduled_at);let y="";t.attended?y=`<span class="lcs-meta-item">${o("check")}<span>حضرتها</span></span>`:t.attendance_open&&(y=`<span class="lcs-meta-item">${o("checks")}<span>التسجيل مفتوح</span></span>`);const S=`${k("pages/student/lecture.html")}?id=${encodeURIComponent(t.id)}`,h=s==="live";return`<article class="lcs-card lcs-${s} lcs-${c}">
    <div class="lcs-card-top" aria-hidden="true"></div>
    ${h?`<span class="lcs-live-flag">${o("video")}مباشر الآن</span>`:""}
    <div class="lcs-card-body">
      <div class="lcs-date" aria-hidden="true">
        <span class="lcs-date-day">${n(m.day)}</span>
        <span class="lcs-date-month">${n(m.month)}</span>
      </div>

      <div class="lcs-card-head">
        <span class="lcs-type-badge lcs-${c}">${o(r.icon)}${n(r.label)}</span>
        <span class="lcs-status lcs-${s}">${o(l.icon)}${n(l.label)}</span>
      </div>

      <div class="lcs-course"><span class="lcs-course-dot" style="--lcs-course-color:${i};" aria-hidden="true"></span>${d}</div>
      <h2 class="lcs-card-title">${n(t.title||"محاضرة")}</h2>
      ${t.description?`<p class="lcs-card-desc">${n(t.description)}</p>`:""}

      <div class="lcs-meta">
        <span class="lcs-meta-item">${o("calendar")}<span>${n(A(t.scheduled_at))}${t.scheduled_at?` · ${n(T(t.scheduled_at))}`:""}</span></span>
        <span class="lcs-meta-item">${o("clock")}<span><strong>${u(t.duration_min)}</strong> دقيقة</span></span>
        <span class="lcs-meta-item">${o("user")}<span>${t.teacher?n(t.teacher):"—"}</span></span>
        ${y}
      </div>
    </div>
    <div class="lcs-card-actions">
      <a class="lcs-btn lcs-btn-primary" href="${n(S)}">${o("details")}${h?"انضم إلى المحاضرة":"عرض التفاصيل"}</a>
    </div>
  </article>`}function p(){a.grid.removeAttribute("role"),a.grid.classList.toggle("lcs-grid--list",e.view==="list");const s=q(e.lectures,{course:e.course,status:e.status,type:e.type,query:e.query}).map(C).filter(Boolean).join("");if(!s){const c=e.course!=="all"||e.status!=="all"||e.type!=="all"||e.query.trim()!=="";a.grid.innerHTML=`<div class="lcs-empty" role="status">
      <div class="lcs-empty-icon">${o("lectures")}</div>
      <h2>${c?"لا توجد محاضرات مطابقة":"لا توجد محاضرات مسجلة حالياً"}</h2>
      <p>${c?"جرّب تغيير المقرر أو الحالة أو كلمة البحث.":"ستظهر محاضراتك هنا فور إضافتها من قبل الأستاذ. للاستفسار، تواصل مع إدارة الأكاديمية."}</p>
      ${c?'<button class="lcs-btn lcs-btn-secondary" type="button" data-reset>عرض كل المحاضرات</button>':""}
    </div>`;return}a.grid.innerHTML=s}async function L(){H();const t=await _("student_lectures");if(!t.ok){console.error("[student_lectures]",t.error),e.stats={},e.courses=[],e.lectures=[],M({title:"تعذّر تحميل المحاضرات",text:"حدث خطأ أثناء الاتصال. تحقّق من الشبكة ثم أعد المحاولة.",retry:!0,tone:"alert"});return}const s=t.data||{};e.stats=s.stats||{},e.courses=Array.isArray(s.courses)?s.courses:[],e.lectures=Array.isArray(s.lectures)?s.lectures:[],e.course="all",e.status="all",e.type="all",e.view="grid",e.query="",a.status.value="all",a.type.value="all",a.search.value="";const c=e.lectures.length>0;a.status.disabled=!c,a.type.disabled=!c,a.search.disabled=!c,a.view.querySelectorAll("button").forEach(l=>{l.disabled=!c;const r=l.dataset.view===e.view;l.classList.toggle("is-active",r),l.setAttribute("aria-pressed",String(r))}),N(),g(),p()}w("student","المحاضرات",async({profile:t,content:s})=>{const c=s||document;c.querySelectorAll("[data-icon]").forEach(l=>{l.innerHTML=o(l.dataset.icon)}),a={stats:b("lcsStats"),tabs:b("lcsCourseTabs"),status:b("lcsStatus"),type:b("lcsType"),search:b("lcsSearch"),view:c.querySelector(".lcs-view-toggle"),grid:b("lcsGrid")},a.tabs.addEventListener("click",l=>{const r=l.target.closest("[data-course]");!r||r.disabled||(e.course=r.dataset.course,a.tabs.querySelectorAll("[data-course]").forEach(d=>{const i=d===r;d.classList.toggle("lcs-active",i),d.setAttribute("aria-selected",String(i))}),p())}),a.status.addEventListener("change",l=>{e.status=l.target.value,p()}),a.type.addEventListener("change",l=>{e.type=l.target.value,p()}),a.search.addEventListener("input",l=>{e.query=l.target.value||"",p()}),a.view.addEventListener("click",l=>{const r=l.target.closest("[data-view]");!r||r.disabled||(e.view=r.dataset.view==="list"?"list":"grid",a.view.querySelectorAll("[data-view]").forEach(d=>{const i=d===r;d.classList.toggle("is-active",i),d.setAttribute("aria-pressed",String(i))}),p())}),a.grid.addEventListener("click",l=>{if(l.target.closest("[data-retry]")){L();return}l.target.closest("[data-reset]")&&(e.course="all",e.status="all",e.type="all",e.query="",a.status.value="all",a.type.value="all",a.search.value="",g(),p())}),await L()});

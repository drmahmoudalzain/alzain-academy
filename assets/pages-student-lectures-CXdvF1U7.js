import"./modulepreload-polyfill-B5Qt9EMX.js";import{b as k,i as n,e as l,c as i,f as A,r as S}from"./portal-74CEB6wo.js";import{c as H}from"./api-B6M8rEuj.js";import{d as M}from"./auth-3ST7bxXK.js";import"https://esm.sh/@supabase/supabase-js@2";const g={live:{label:"جارية الآن",icon:"video"},attended:{label:"حضرتها",icon:"check"},upcoming:{label:"قادمة",icon:"calendar"},missed:{label:"فائتة",icon:"close"}},y={direct:{label:"مباشر",icon:"video"},online:{label:"أونلاين",icon:"monitor"},recorded:{label:"مسجل",icon:"library"}},d=s=>document.getElementById(s),e={stats:{},courses:[],lectures:[],course:"all",status:"all",query:""};let a=null;function q(s){const t=new Date(s);return Number.isNaN(t.getTime())?{day:"—",month:""}:{day:i(t.getDate()),month:new Intl.DateTimeFormat("ar",{month:"short"}).format(t)}}function E(){a.stats.innerHTML=Array.from({length:4},()=>'<div class="lcs-skeleton lcs-skeleton-stat"></div>').join(""),a.tabs.innerHTML=Array.from({length:3},()=>'<div class="lcs-skeleton lcs-skeleton-tab"></div>').join(""),a.grid.innerHTML=Array.from({length:2},()=>'<div class="lcs-skeleton lcs-skeleton-card"></div>').join(""),a.status.disabled=!0,a.search.disabled=!0}function j({title:s,text:t,retry:c=!1,tone:r="status"}){a.stats.innerHTML="",a.tabs.innerHTML="",a.status.disabled=!0,a.search.disabled=!0,a.grid.setAttribute("role",r),a.grid.innerHTML=`<div class="lcs-empty">
    <div class="lcs-empty-icon">${n("lectures")}</div>
    <h2>${l(s)}</h2>
    <p>${l(t)}</p>
    ${c?'<button class="lcs-btn lcs-btn-secondary" type="button" data-retry>إعادة المحاولة</button>':""}
  </div>`}function w(){const s=e.stats;return{live:e.lectures.filter(t=>t.status==="live").length,attended:Number(s.attended??e.lectures.filter(t=>t.status==="attended").length),upcoming:Number(s.upcoming??e.lectures.filter(t=>t.status==="upcoming").length),missed:Number(s.missed??e.lectures.filter(t=>t.status==="missed").length)}}function N(){const s=w(),t=[{cls:"lcs-total",icon:"lectures",label:"إجمالي المحاضرات",value:i(e.stats.total??e.lectures.length),unit:"محاضرة"},{cls:"lcs-attended",icon:"check",label:"حضرتها",value:i(s.attended),unit:"محاضرة"},{cls:"lcs-upcoming",icon:"calendar",label:"قادمة",value:i(s.upcoming),unit:"محاضرة"},{cls:"lcs-missed",icon:"close",label:"فائتة",value:i(s.missed),unit:"محاضرة"}];a.stats.innerHTML=t.map(c=>`<div class="lcs-stat ${c.cls}">
        <span class="lcs-stat-icon">${n(c.icon)}</span>
        <span class="lcs-stat-body">
          <span class="lcs-stat-label">${l(c.label)}</span>
          <span class="lcs-stat-value">${l(c.value)}<small>${l(c.unit)}</small></span>
        </span>
      </div>`).join(""),a.stats.setAttribute("aria-label",`إحصاءات المحاضرات: ${i(e.stats.total??e.lectures.length)} محاضرة، ${i(s.upcoming)} قادمة، ${i(s.live)} جارية`)}function v(){const s=[{id:"all",label:"كل المقررات",count:e.lectures.length}];e.courses.forEach(t=>{const c=String(t.id);s.push({id:c,label:[t.code,t.title].filter(Boolean).join(" — ")||"مقرر",count:e.lectures.filter(r=>String(r.course_id)===c).length})}),a.tabs.innerHTML=s.map(t=>`<button class="lcs-course-tab${e.course===t.id?" lcs-active":""}" type="button"
        role="tab" data-course="${l(t.id)}" aria-selected="${e.course===t.id}">
        ${l(t.label)}<span class="lcs-tab-count">${i(t.count)}</span>
      </button>`).join(""),s.some(t=>t.id===e.course)||(e.course="all",v())}function C(s){const t=g[s.status]?s.status:"upcoming",c=y[s.lecture_type]?s.lecture_type:"recorded",r=g[t],o=y[c],u=[s.course_code,s.course_title].filter(Boolean).map(l).join(" — ")||"—",m=l(s.course_color||"#123A63"),h=q(s.scheduled_at),$=e.query.trim().toLowerCase();if($&&![s.title,s.description,s.course_title,s.course_code,s.teacher].some(_=>String(_||"").toLowerCase().includes($)))return"";let b="";s.attended?b=`<span class="lcs-meta-item">${n("check")}<span>حضرتها</span></span>`:s.attendance_open&&(b=`<span class="lcs-meta-item">${n("checks")}<span>التسجيل مفتوح</span></span>`);const T=`${M("pages/student/lecture.html")}?id=${encodeURIComponent(s.id)}`,f=t==="live";return`<article class="lcs-card lcs-${t} lcs-${c}">
    <div class="lcs-card-top" aria-hidden="true"></div>
    ${f?`<span class="lcs-live-flag">${n("video")}مباشر الآن</span>`:""}
    <div class="lcs-card-body">
      <div class="lcs-date" aria-hidden="true">
        <span class="lcs-date-day">${l(h.day)}</span>
        <span class="lcs-date-month">${l(h.month)}</span>
      </div>

      <div class="lcs-card-head">
        <span class="lcs-type-badge lcs-${c}">${n(o.icon)}${l(o.label)}</span>
        <span class="lcs-status lcs-${t}">${n(r.icon)}${l(r.label)}</span>
      </div>

      <div class="lcs-course"><span class="lcs-course-dot" style="--lcs-course-color:${m};" aria-hidden="true"></span>${u}</div>
      <h2 class="lcs-card-title">${l(s.title||"محاضرة")}</h2>
      ${s.description?`<p class="lcs-card-desc">${l(s.description)}</p>`:""}

      <div class="lcs-meta">
        <span class="lcs-meta-item">${n("calendar")}<span>${l(A(s.scheduled_at))}${s.scheduled_at?` · ${l(S(s.scheduled_at))}`:""}</span></span>
        <span class="lcs-meta-item">${n("clock")}<span><strong>${i(s.duration_min)}</strong> دقيقة</span></span>
        <span class="lcs-meta-item">${n("user")}<span>${s.teacher?l(s.teacher):"—"}</span></span>
        ${b}
      </div>
    </div>
    <div class="lcs-card-actions">
      <a class="lcs-btn lcs-btn-primary" href="${l(T)}">${n("details")}${f?"انضم إلى المحاضرة":"عرض التفاصيل"}</a>
    </div>
  </article>`}function p(){a.grid.removeAttribute("role");const t=e.lectures.filter(c=>!(e.course!=="all"&&String(c.course_id)!==e.course||e.status!=="all"&&c.status!==e.status)).map(C).filter(Boolean).join("");if(!t){const c=e.course!=="all"||e.status!=="all"||e.query.trim()!=="";a.grid.innerHTML=`<div class="lcs-empty" role="status">
      <div class="lcs-empty-icon">${n("lectures")}</div>
      <h2>${c?"لا توجد محاضرات مطابقة":"لا توجد محاضرات مسجلة حالياً"}</h2>
      <p>${c?"جرّب تغيير المقرر أو الحالة أو كلمة البحث.":"ستظهر محاضراتك هنا فور إضافتها من قبل الأستاذ. للاستفسار، تواصل مع إدارة الأكاديمية."}</p>
      ${c?'<button class="lcs-btn lcs-btn-secondary" type="button" data-reset>عرض كل المحاضرات</button>':""}
    </div>`;return}a.grid.innerHTML=t}async function L(){E();const s=await H("student_lectures");if(!s.ok){console.error("[student_lectures]",s.error),e.stats={},e.courses=[],e.lectures=[],j({title:"تعذّر تحميل المحاضرات",text:"حدث خطأ أثناء الاتصال. تحقّق من الشبكة ثم أعد المحاولة.",retry:!0,tone:"alert"});return}const t=s.data||{};e.stats=t.stats||{},e.courses=Array.isArray(t.courses)?t.courses:[],e.lectures=Array.isArray(t.lectures)?t.lectures:[],e.course="all",e.status="all",e.query="",a.status.value="all",a.search.value="",a.status.disabled=!1,a.search.disabled=e.lectures.length===0,N(),v(),p()}k("student","المحاضرات",async({profile:s,content:t})=>{(t||document).querySelectorAll("[data-icon]").forEach(r=>{r.innerHTML=n(r.dataset.icon)}),a={stats:d("lcsStats"),tabs:d("lcsCourseTabs"),status:d("lcsStatus"),search:d("lcsSearch"),grid:d("lcsGrid")},a.tabs.addEventListener("click",r=>{const o=r.target.closest("[data-course]");!o||o.disabled||(e.course=o.dataset.course,a.tabs.querySelectorAll("[data-course]").forEach(u=>{const m=u===o;u.classList.toggle("lcs-active",m),u.setAttribute("aria-selected",String(m))}),p())}),a.status.addEventListener("change",r=>{e.status=r.target.value,p()}),a.search.addEventListener("input",r=>{e.query=r.target.value||"",p()}),a.grid.addEventListener("click",r=>{if(r.target.closest("[data-retry]")){L();return}r.target.closest("[data-reset]")&&(e.course="all",e.status="all",e.query="",a.status.value="all",a.search.value="",v(),p())}),await L()});

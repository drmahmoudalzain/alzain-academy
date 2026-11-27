import"./modulepreload-polyfill-B5Qt9EMX.js";import{b as A,i as c,o as T,e as i,a as u,f as v,r as C,d as $}from"./portal-75pk5vcp.js";import{c as _}from"./api-DQI-AaeE.js";import"./identity-rules-Cp64wFaG.js";import"https://esm.sh/@supabase/supabase-js@2";import"./base-CLcZMpw2.js";import"./first-visit-BDQ6DJqx.js";const k={pending:{label:"قيد الانتظار",icon:"clock"},overdue:{label:"متأخر",icon:"close"},submitted:{label:"مُسلَّم",icon:"checks"},late:{label:"مُسلَّم متأخراً",icon:"history"},graded:{label:"مُصحَّح",icon:"check"}},l=s=>document.getElementById(s),e={stats:{},courses:[],assignments:[],byId:new Map,course:"all",status:"all",query:"",modalAssignment:null,trigger:null,busy:!1};let t=null;function w(){t.stats.innerHTML=Array.from({length:4},()=>'<div class="asg-skeleton asg-skeleton-stat"></div>').join(""),t.tabs.innerHTML=Array.from({length:3},()=>'<div class="asg-skeleton asg-skeleton-tab"></div>').join(""),t.grid.innerHTML=Array.from({length:2},()=>'<div class="asg-skeleton asg-skeleton-card"></div>').join(""),t.status.disabled=!0,t.search.disabled=!0}function H({title:s,text:a,retry:n=!1,tone:r="status"}){t.stats.innerHTML="",t.tabs.innerHTML="",t.status.disabled=!0,t.search.disabled=!0,t.grid.setAttribute("role",r),t.grid.innerHTML=`<div class="asg-empty">
    <div class="asg-empty-icon">${c("assignments")}</div>
    <h2>${i(s)}</h2>
    <p>${i(a)}</p>
    ${n?'<button class="asg-btn asg-btn-secondary" type="button" data-retry>إعادة المحاولة</button>':""}
  </div>`}function q(){const s=e.stats,a=e.assignments,n=[{cls:"asg-total",icon:"assignments",label:"إجمالي الواجبات",value:u(s.total??a.length),unit:"واجب"},{cls:"asg-pending",icon:"clock",label:"قيد الانتظار",value:u(s.pending??a.filter(r=>r.status==="pending").length),unit:"واجب"},{cls:"asg-submitted",icon:"checks",label:"مُسلَّم",value:u(s.submitted??a.filter(r=>["submitted","late"].includes(r.status)).length),unit:"واجب"},{cls:"asg-graded",icon:"check",label:"مُصحَّح",value:u(s.graded??a.filter(r=>r.status==="graded").length),unit:"واجب"}];t.stats.innerHTML=n.map(r=>`<div class="asg-stat ${r.cls}">
        <span class="asg-stat-icon">${c(r.icon)}</span>
        <span class="asg-stat-body">
          <span class="asg-stat-label">${i(r.label)}</span>
          <span class="asg-stat-value">${i(r.value)}<small>${i(r.unit)}</small></span>
        </span>
      </div>`).join(""),t.stats.setAttribute("aria-label",`إحصاءات الواجبات: ${u(s.total??a.length)} واجباً، ${u(s.pending??0)} قيد الانتظار، ${u(s.graded??0)} مُصحَّح`)}function y(){const s=[{id:"all",label:"كل المقررات",count:e.assignments.length}];e.courses.forEach(a=>{const n=String(a.id);s.push({id:n,label:[a.code,a.title].filter(Boolean).join(" — ")||"مقرر",count:e.assignments.filter(r=>String(r.course_id)===n).length})}),t.tabs.innerHTML=s.map(a=>`<button class="asg-course-tab${e.course===a.id?" asg-active":""}" type="button"
        role="tab" data-course="${i(a.id)}" aria-selected="${e.course===a.id}">
        ${i(a.label)}<span class="asg-tab-count">${u(a.count)}</span>
      </button>`).join(""),s.some(a=>a.id===e.course)||(e.course="all",y())}function j(s){const a=k[s.status]?s.status:"pending",n=k[a],r=[s.course_code,s.course_title].filter(Boolean).map(i).join(" — ")||"—",o=i(s.course_color||"#123A63"),d=e.query.trim().toLowerCase();if(d&&![s.title,s.description,s.course_title,s.course_code].some(x=>String(x||"").toLowerCase().includes(d)))return"";const g=s.due_at?`<div class="asg-due${a==="overdue"?" asg-urgent":""}">
        ${c("calendar")}<span>آخر موعد: ${i(v(s.due_at))}${s.due_at?` · ${i(C(s.due_at))}`:""}</span>
      </div>`:"";let m="";s.status==="graded"&&s.points!==null&&s.points!==void 0&&(m=`<div class="asg-grade">
      <span class="asg-grade-label"><span>درجتك</span><strong>${$(s.points)}<small> / ${$(s.max_points)}</small></strong></span>
      <span class="asg-grade-badge">${c("check")}مُصحَّح</span>
    </div>`);const E=s.feedback?`<div class="asg-feedback">${c("forum")}<span>${i(s.feedback)}</span></div>`:"",M=s.submission_text?`<div class="asg-submitted">
        <span class="asg-submitted-label">${c("file")}نصك المُسلَّم${s.submitted_at?` · ${i(v(s.submitted_at))}`:""}</span>
        <p class="asg-submitted-text">${i(s.submission_text)}</p>
      </div>`:"",S=a==="pending"||a==="overdue"?`<button class="asg-btn asg-btn-primary" type="button" data-submit="${i(s.id)}">${c("send")}تسليم الواجب</button>`:`<button class="asg-btn asg-btn-secondary" type="button" disabled>${c(n.icon)}${i(n.label)}</button>`;return`<article class="asg-card asg-${a}">
    <div class="asg-card-top" aria-hidden="true"></div>
    <div class="asg-card-body">
      <div class="asg-card-head">
        <span class="asg-kind-badge">${c("paper")}واجب</span>
        <span class="asg-status asg-${a}">${c(n.icon)}${i(n.label)}</span>
      </div>

      <div class="asg-course"><span class="asg-course-dot" style="--asg-course-color:${o};" aria-hidden="true"></span>${r}</div>
      <h2 class="asg-card-title">${i(s.title||"واجب")}</h2>
      ${s.description?`<p class="asg-card-desc">${i(s.description)}</p>`:""}

      <div class="asg-meta">
        <span class="asg-meta-item">${c("points")}<span><strong>${$(s.max_points)}</strong> نقطة</span></span>
        ${s.submitted_at?`<span class="asg-meta-item">${c("checks")}<span>سُلِّم في ${i(v(s.submitted_at))}</span></span>`:""}
      </div>

      ${g}
      ${m}
      ${E}
      ${M}
    </div>
    <div class="asg-card-actions">${S}</div>
  </article>`}function b(){t.grid.removeAttribute("role");const a=e.assignments.filter(n=>!(e.course!=="all"&&String(n.course_id)!==e.course||e.status!=="all"&&n.status!==e.status)).map(j).filter(Boolean).join("");if(!a){const n=e.course!=="all"||e.status!=="all"||e.query.trim()!=="";t.grid.innerHTML=`<div class="asg-empty" role="status">
      <div class="asg-empty-icon">${c("assignments")}</div>
      <h2>${n?"لا توجد واجبات مطابقة":"لا توجد واجبات مسجلة حالياً"}</h2>
      <p>${n?"جرّب تغيير المقرر أو الحالة أو كلمة البحث.":"ستظهر واجباتك هنا فور إضافتها من قبل الأستاذ. للاستفسار، تواصل مع إدارة الأكاديمية."}</p>
      ${n?'<button class="asg-btn asg-btn-secondary" type="button" data-reset>عرض كل الواجبات</button>':""}
    </div>`;return}t.grid.innerHTML=a}function f(s){t.formError.textContent=s||"",t.formError.hidden=!s}function L(){t.counter.textContent=`${u(t.textarea.value.trim().length)} حرف`}function I(s,a="success"){const n=document.createElement("div");n.className=`asg-toast asg-toast-${a==="success"?"success":"danger"}`,n.innerHTML=`${c(a==="success"?"check":"close")}<span>${i(s)}</span>`,t.toasts.appendChild(n),setTimeout(()=>{n.classList.add("asg-toast-hide"),setTimeout(()=>n.remove(),300)},2800)}function B(s,a){e.modalAssignment=s,e.trigger=a,t.modalSubtitle.textContent=`${s.title||"واجب"}${s.course_title?` — ${s.course_title}`:""}`,t.textarea.value="",L(),f(""),t.modal.hidden=!1,t.textarea.focus()}function p(){t.modal.hidden=!0,e.modalAssignment=null,e.trigger&&typeof e.trigger.focus=="function"&&e.trigger.focus(),e.trigger=null}async function D(){if(e.busy||!e.modalAssignment)return;const s=t.textarea.value.trim();if(s.length<3){f("اكتب ما لا يقل عن 3 أحرف في نص التسليم قبل الإرسال."),t.textarea.focus();return}const a=e.modalAssignment;e.busy=!0,t.confirm.disabled=!0,t.confirm.textContent="جارٍ التسليم...",f("");const n=await _("student_assignment_submit",{p_assignment_id:a.id,p_text:s});if(e.busy=!1,t.confirm.disabled=!1,t.confirm.textContent="تسليم الواجب",!n.ok){console.error("[student_assignment_submit]",n.error),f("تعذّر تسليم الواجب الآن. تحقّق من اتصالك وأعد المحاولة، أو تواصل مع إدارة الأكاديمية إذا استمرت المشكلة.");return}p(),I("تم تسليم الواجب بنجاح."),await h()}async function h(){w();const s=await _("student_assignments");if(!s.ok){console.error("[student_assignments]",s.error),e.stats={},e.courses=[],e.assignments=[],e.byId=new Map,H({title:"تعذّر تحميل الواجبات",text:"حدث خطأ أثناء الاتصال. تحقّق من الشبكة ثم أعد المحاولة.",retry:!0,tone:"alert"});return}const a=s.data||{};e.stats=a.stats||{},e.courses=Array.isArray(a.courses)?a.courses:[],e.assignments=Array.isArray(a.assignments)?a.assignments:[],e.byId=new Map(e.assignments.map(n=>[String(n.id),n])),e.course="all",e.status="all",e.query="",t.status.value="all",t.search.value="",t.status.disabled=!1,t.search.disabled=e.assignments.length===0,q(),y(),b()}A("student","الواجبات",async({profile:s,content:a})=>{(a||document).querySelectorAll("[data-icon]").forEach(o=>{o.innerHTML=c(o.dataset.icon)}),t={stats:l("asgStats"),tabs:l("asgCourseTabs"),status:l("asgStatus"),search:l("asgSearch"),grid:l("asgGrid"),modal:l("asgModal"),modalSubtitle:l("asgModalSubtitle"),modalClose:l("asgModalClose"),modalCancel:l("asgModalCancel"),form:l("asgSubmitForm"),formError:l("asgFormError"),textarea:l("asgSubmissionText"),counter:l("asgCounter"),confirm:l("asgModalConfirm"),toasts:l("asgToasts")},t.tabs.addEventListener("click",o=>{const d=o.target.closest("[data-course]");!d||d.disabled||(e.course=d.dataset.course,t.tabs.querySelectorAll("[data-course]").forEach(g=>{const m=g===d;g.classList.toggle("asg-active",m),g.setAttribute("aria-selected",String(m))}),b())}),t.status.addEventListener("change",o=>{e.status=o.target.value,b()}),t.search.addEventListener("input",o=>{e.query=o.target.value||"",b()}),t.grid.addEventListener("click",o=>{if(o.target.closest("[data-retry]")){h();return}if(o.target.closest("[data-reset]")){e.course="all",e.status="all",e.query="",t.status.value="all",t.search.value="",y(),b();return}const d=o.target.closest("[data-submit]");if(d){const g=e.byId.get(d.dataset.submit);g&&B(g,d)}}),t.modal.addEventListener("click",o=>{o.target===t.modal&&p()}),t.modalClose.addEventListener("click",p),t.modalCancel.addEventListener("click",p),t.textarea.addEventListener("input",()=>{L(),t.formError.hidden||f("")}),t.form.addEventListener("submit",o=>{o.preventDefault(),D()});const r=o=>{o.key==="Escape"&&!t.modal.hidden&&p()};document.addEventListener("keydown",r),T(()=>document.removeEventListener("keydown",r)),await h()});

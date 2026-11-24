import"./modulepreload-polyfill-B5Qt9EMX.js";import{b as A,i as l,e as r,c as u,f,r as T,d as v}from"./portal-eUwZL1O8.js";import{c as _}from"./api-Cx-w9ZQ2.js";import"./auth-BGBkidcA.js";import"https://esm.sh/@supabase/supabase-js@2";const k={pending:{label:"قيد الانتظار",icon:"clock"},overdue:{label:"متأخر",icon:"close"},submitted:{label:"مُسلَّم",icon:"checks"},late:{label:"مُسلَّم متأخراً",icon:"history"},graded:{label:"مُصحَّح",icon:"check"}},o=s=>document.getElementById(s),e={stats:{},courses:[],assignments:[],byId:new Map,course:"all",status:"all",query:"",modalAssignment:null,trigger:null,busy:!1};let t=null;function C(){t.stats.innerHTML=Array.from({length:4},()=>'<div class="asg-skeleton asg-skeleton-stat"></div>').join(""),t.tabs.innerHTML=Array.from({length:3},()=>'<div class="asg-skeleton asg-skeleton-tab"></div>').join(""),t.grid.innerHTML=Array.from({length:2},()=>'<div class="asg-skeleton asg-skeleton-card"></div>').join(""),t.status.disabled=!0,t.search.disabled=!0}function H({title:s,text:a,retry:i=!1,tone:n="status"}){t.stats.innerHTML="",t.tabs.innerHTML="",t.status.disabled=!0,t.search.disabled=!0,t.grid.setAttribute("role",n),t.grid.innerHTML=`<div class="asg-empty">
    <div class="asg-empty-icon">${l("assignments")}</div>
    <h2>${r(s)}</h2>
    <p>${r(a)}</p>
    ${i?'<button class="asg-btn asg-btn-secondary" type="button" data-retry>إعادة المحاولة</button>':""}
  </div>`}function w(){const s=e.stats,a=e.assignments,i=[{cls:"asg-total",icon:"assignments",label:"إجمالي الواجبات",value:u(s.total??a.length),unit:"واجب"},{cls:"asg-pending",icon:"clock",label:"قيد الانتظار",value:u(s.pending??a.filter(n=>n.status==="pending").length),unit:"واجب"},{cls:"asg-submitted",icon:"checks",label:"مُسلَّم",value:u(s.submitted??a.filter(n=>["submitted","late"].includes(n.status)).length),unit:"واجب"},{cls:"asg-graded",icon:"check",label:"مُصحَّح",value:u(s.graded??a.filter(n=>n.status==="graded").length),unit:"واجب"}];t.stats.innerHTML=i.map(n=>`<div class="asg-stat ${n.cls}">
        <span class="asg-stat-icon">${l(n.icon)}</span>
        <span class="asg-stat-body">
          <span class="asg-stat-label">${r(n.label)}</span>
          <span class="asg-stat-value">${r(n.value)}<small>${r(n.unit)}</small></span>
        </span>
      </div>`).join(""),t.stats.setAttribute("aria-label",`إحصاءات الواجبات: ${u(s.total??a.length)} واجباً، ${u(s.pending??0)} قيد الانتظار، ${u(s.graded??0)} مُصحَّح`)}function h(){const s=[{id:"all",label:"كل المقررات",count:e.assignments.length}];e.courses.forEach(a=>{const i=String(a.id);s.push({id:i,label:[a.code,a.title].filter(Boolean).join(" — ")||"مقرر",count:e.assignments.filter(n=>String(n.course_id)===i).length})}),t.tabs.innerHTML=s.map(a=>`<button class="asg-course-tab${e.course===a.id?" asg-active":""}" type="button"
        role="tab" data-course="${r(a.id)}" aria-selected="${e.course===a.id}">
        ${r(a.label)}<span class="asg-tab-count">${u(a.count)}</span>
      </button>`).join(""),s.some(a=>a.id===e.course)||(e.course="all",h())}function q(s){const a=k[s.status]?s.status:"pending",i=k[a],n=[s.course_code,s.course_title].filter(Boolean).map(r).join(" — ")||"—",c=r(s.course_color||"#123A63"),d=e.query.trim().toLowerCase();if(d&&![s.title,s.description,s.course_title,s.course_code].some(x=>String(x||"").toLowerCase().includes(d)))return"";const p=s.due_at?`<div class="asg-due${a==="overdue"?" asg-urgent":""}">
        ${l("calendar")}<span>آخر موعد: ${r(f(s.due_at))}${s.due_at?` · ${r(T(s.due_at))}`:""}</span>
      </div>`:"";let y="";s.status==="graded"&&s.points!==null&&s.points!==void 0&&(y=`<div class="asg-grade">
      <span class="asg-grade-label"><span>درجتك</span><strong>${v(s.points)}<small> / ${v(s.max_points)}</small></strong></span>
      <span class="asg-grade-badge">${l("check")}مُصحَّح</span>
    </div>`);const E=s.feedback?`<div class="asg-feedback">${l("forum")}<span>${r(s.feedback)}</span></div>`:"",M=s.submission_text?`<div class="asg-submitted">
        <span class="asg-submitted-label">${l("file")}نصك المُسلَّم${s.submitted_at?` · ${r(f(s.submitted_at))}`:""}</span>
        <p class="asg-submitted-text">${r(s.submission_text)}</p>
      </div>`:"",S=a==="pending"||a==="overdue"?`<button class="asg-btn asg-btn-primary" type="button" data-submit="${r(s.id)}">${l("send")}تسليم الواجب</button>`:`<button class="asg-btn asg-btn-secondary" type="button" disabled>${l(i.icon)}${r(i.label)}</button>`;return`<article class="asg-card asg-${a}">
    <div class="asg-card-top" aria-hidden="true"></div>
    <div class="asg-card-body">
      <div class="asg-card-head">
        <span class="asg-kind-badge">${l("paper")}واجب</span>
        <span class="asg-status asg-${a}">${l(i.icon)}${r(i.label)}</span>
      </div>

      <div class="asg-course"><span class="asg-course-dot" style="--asg-course-color:${c};" aria-hidden="true"></span>${n}</div>
      <h2 class="asg-card-title">${r(s.title||"واجب")}</h2>
      ${s.description?`<p class="asg-card-desc">${r(s.description)}</p>`:""}

      <div class="asg-meta">
        <span class="asg-meta-item">${l("points")}<span><strong>${v(s.max_points)}</strong> نقطة</span></span>
        ${s.submitted_at?`<span class="asg-meta-item">${l("checks")}<span>سُلِّم في ${r(f(s.submitted_at))}</span></span>`:""}
      </div>

      ${p}
      ${y}
      ${E}
      ${M}
    </div>
    <div class="asg-card-actions">${S}</div>
  </article>`}function g(){t.grid.removeAttribute("role");const a=e.assignments.filter(i=>!(e.course!=="all"&&String(i.course_id)!==e.course||e.status!=="all"&&i.status!==e.status)).map(q).filter(Boolean).join("");if(!a){const i=e.course!=="all"||e.status!=="all"||e.query.trim()!=="";t.grid.innerHTML=`<div class="asg-empty" role="status">
      <div class="asg-empty-icon">${l("assignments")}</div>
      <h2>${i?"لا توجد واجبات مطابقة":"لا توجد واجبات مسجلة حالياً"}</h2>
      <p>${i?"جرّب تغيير المقرر أو الحالة أو كلمة البحث.":"ستظهر واجباتك هنا فور إضافتها من قبل الأستاذ. للاستفسار، تواصل مع إدارة الأكاديمية."}</p>
      ${i?'<button class="asg-btn asg-btn-secondary" type="button" data-reset>عرض كل الواجبات</button>':""}
    </div>`;return}t.grid.innerHTML=a}function b(s){t.formError.textContent=s||"",t.formError.hidden=!s}function L(){t.counter.textContent=`${u(t.textarea.value.trim().length)} حرف`}function j(s,a="success"){const i=document.createElement("div");i.className=`asg-toast asg-toast-${a==="success"?"success":"danger"}`,i.innerHTML=`${l(a==="success"?"check":"close")}<span>${r(s)}</span>`,t.toasts.appendChild(i),setTimeout(()=>{i.classList.add("asg-toast-hide"),setTimeout(()=>i.remove(),300)},2800)}function I(s,a){e.modalAssignment=s,e.trigger=a,t.modalSubtitle.textContent=`${s.title||"واجب"}${s.course_title?` — ${s.course_title}`:""}`,t.textarea.value="",L(),b(""),t.modal.hidden=!1,t.textarea.focus()}function m(){t.modal.hidden=!0,e.modalAssignment=null,e.trigger&&typeof e.trigger.focus=="function"&&e.trigger.focus(),e.trigger=null}async function B(){if(e.busy||!e.modalAssignment)return;const s=t.textarea.value.trim();if(s.length<3){b("اكتب ما لا يقل عن 3 أحرف في نص التسليم قبل الإرسال."),t.textarea.focus();return}const a=e.modalAssignment;e.busy=!0,t.confirm.disabled=!0,t.confirm.textContent="جارٍ التسليم...",b("");const i=await _("student_assignment_submit",{p_assignment_id:a.id,p_text:s});if(e.busy=!1,t.confirm.disabled=!1,t.confirm.textContent="تسليم الواجب",!i.ok){console.error("[student_assignment_submit]",i.error),b("تعذّر تسليم الواجب الآن. تحقّق من اتصالك وأعد المحاولة، أو تواصل مع إدارة الأكاديمية إذا استمرت المشكلة.");return}m(),j("تم تسليم الواجب بنجاح."),await $()}async function $(){C();const s=await _("student_assignments");if(!s.ok){console.error("[student_assignments]",s.error),e.stats={},e.courses=[],e.assignments=[],e.byId=new Map,H({title:"تعذّر تحميل الواجبات",text:"حدث خطأ أثناء الاتصال. تحقّق من الشبكة ثم أعد المحاولة.",retry:!0,tone:"alert"});return}const a=s.data||{};e.stats=a.stats||{},e.courses=Array.isArray(a.courses)?a.courses:[],e.assignments=Array.isArray(a.assignments)?a.assignments:[],e.byId=new Map(e.assignments.map(i=>[String(i.id),i])),e.course="all",e.status="all",e.query="",t.status.value="all",t.search.value="",t.status.disabled=!1,t.search.disabled=e.assignments.length===0,w(),h(),g()}A("student","الواجبات",async({profile:s,content:a})=>{(a||document).querySelectorAll("[data-icon]").forEach(n=>{n.innerHTML=l(n.dataset.icon)}),t={stats:o("asgStats"),tabs:o("asgCourseTabs"),status:o("asgStatus"),search:o("asgSearch"),grid:o("asgGrid"),modal:o("asgModal"),modalSubtitle:o("asgModalSubtitle"),modalClose:o("asgModalClose"),modalCancel:o("asgModalCancel"),form:o("asgSubmitForm"),formError:o("asgFormError"),textarea:o("asgSubmissionText"),counter:o("asgCounter"),confirm:o("asgModalConfirm"),toasts:o("asgToasts")},t.tabs.addEventListener("click",n=>{const c=n.target.closest("[data-course]");!c||c.disabled||(e.course=c.dataset.course,t.tabs.querySelectorAll("[data-course]").forEach(d=>{const p=d===c;d.classList.toggle("asg-active",p),d.setAttribute("aria-selected",String(p))}),g())}),t.status.addEventListener("change",n=>{e.status=n.target.value,g()}),t.search.addEventListener("input",n=>{e.query=n.target.value||"",g()}),t.grid.addEventListener("click",n=>{if(n.target.closest("[data-retry]")){$();return}if(n.target.closest("[data-reset]")){e.course="all",e.status="all",e.query="",t.status.value="all",t.search.value="",h(),g();return}const c=n.target.closest("[data-submit]");if(c){const d=e.byId.get(c.dataset.submit);d&&I(d,c)}}),t.modal.addEventListener("click",n=>{n.target===t.modal&&m()}),t.modalClose.addEventListener("click",m),t.modalCancel.addEventListener("click",m),t.textarea.addEventListener("input",()=>{L(),t.formError.hidden||b("")}),t.form.addEventListener("submit",n=>{n.preventDefault(),B()}),document.addEventListener("keydown",n=>{n.key==="Escape"&&!t.modal.hidden&&m()}),await $()});

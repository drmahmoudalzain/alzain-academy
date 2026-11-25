import"./modulepreload-polyfill-B5Qt9EMX.js";import{o as I,b as R,i as r,e as n,f as y,c as l,r as F,d as p}from"./portal-Sks-N-0q.js";import{c as O}from"./api-CE-Y1P0n.js";import{p as Q}from"./auth-DJQIbBRA.js";import"https://esm.sh/@supabase/supabase-js@2";const D={mcq:"اختيار من متعدد",multi:"متعدد الإجابات",truefalse:"صح / خطأ",essay:"مقالي"},U=["أ","ب","ج","د","هـ","و","ز","ح"],k={review:"resPaneReview",breakdown:"resPaneBreakdown",info:"resPaneInfo"},d=e=>document.getElementById(e),H=new URLSearchParams(location.search).get("attempt");let S="",g=null,i={};I(()=>{g&&clearTimeout(g)});function E(e){e.querySelectorAll("[data-icon]").forEach(s=>{s.innerHTML=r(s.dataset.icon)})}function _(){i={page:d("resPage"),hero:d("resHero"),stats:d("resStats"),review:d("resReview"),reviewCount:d("resReviewCount"),breakdown:d("resBreakdown"),info:d("resInfo"),toast:d("resToast")};const e=d("resBackLink");e&&(e.href=Q("pages/student/exams.html"))}function Y(){i.page.innerHTML=S,E(i.page),_()}function j({title:e,text:s,retry:t=!1,iconName:a="file",tone:o="status"}){i.page.innerHTML=`<div class="res-empty" role="${o}">
    <div class="res-empty-icon">${r(a)}</div>
    <h2>${n(e)}</h2>
    <p>${n(s)}</p>
    ${t?'<div class="res-empty-actions"><button class="res-btn res-btn-secondary" type="button" data-retry>إعادة المحاولة</button></div>':""}
  </div>`}function N(e,s="success"){i.toast&&(g&&clearTimeout(g),i.toast.textContent=e,i.toast.className=`res-toast ${s}`,i.toast.hidden=!1,g=setTimeout(()=>{i.toast.hidden=!0},3200))}function A(e){return e>=90?"ممتاز":e>=80?"جيد جداً":e>=70?"جيد":e>=50?"مقبول":"يحتاج تحسين"}const $=(e,s,t)=>`<span class="res-meta-item">${r(e)}<span>${n(s)} <strong>${n(t)}</strong></span></span>`;function P(e){return typeof e=="string"?e:e&&typeof e=="object"?e.text??e.label??"":""}function w(e,s){if(e.type==="multi"){const a=s==="mine"?e.my_choice_indices:e.correct_indices;return Array.isArray(a)?a:[]}const t=s==="mine"?e.my_choice_index:e.correct_index;return t==null?[]:[t]}function M(e,s){const t=w(e,s).map(Number).filter(o=>Number.isFinite(o));if(!t.length)return s==="mine"?"لم تُجب":"—";const a=Array.isArray(e.options)?e.options:[];return t.map(o=>{const u=P(a[o]);return u?String(u):`الخيار ${l(o+1)}`}).join("، ")}function z(e){if(e.type==="essay")return e.earned===null||e.earned===void 0?"pending":"essay";const s=w(e,"mine"),t=typeof e.my_text=="string"&&e.my_text.trim()!=="";if(!s.length&&!t)return"unanswered";const a=w(e,"correct");return a.length>0&&s.length===a.length&&s.every((u,v)=>Number(u)===Number(a[v]))?"correct":"wrong"}const G={correct:{label:"صحيح",icon:"check"},wrong:{label:"خطأ",icon:"close"},unanswered:{label:"لم تُجب",icon:"details"},essay:{label:"صُحِّح يدوياً",icon:"edit"},pending:{label:"قيد التصحيح",icon:"clock"}};function J(e){const s=Array.isArray(e.options)?e.options:[];if(!s.length||e.type==="essay")return"";const t=new Set(w(e,"correct").map(Number)),a=new Set(w(e,"mine").map(Number));return`<div class="res-options">${s.map((o,u)=>{const v=t.has(u),m=a.has(u),f=v?"correct":m?"wrong":"",h=`${m?'<span class="res-option-badge">إجابتك</span>':""}${v?'<span class="res-option-badge">الصحيحة</span>':""}`;return`<div class="res-option ${f}">
        <span class="res-option-letter">${U[u]||l(u+1)}</span>
        <span class="res-option-text">${n(P(o)||"—")}</span>
        <span class="res-option-badges">${h}</span>
      </div>`}).join("")}</div>`}function K(e,s){if(e.type==="essay")return`<div class="res-answer-grid">
      <div class="res-answer-box">
        <span class="res-answer-label">${r("paper")}إجابتك</span>
        <div class="res-answer-text res-essay">${n(e.my_text||"لم تُجب")}</div>
      </div>
      <div class="res-answer-box correct">
        <span class="res-answer-label">${r("check")}الإجابة الصحيحة</span>
        <div class="res-answer-text">لا توجد إجابة نموذجية متاحة لهذا السؤال المقالي.</div>
      </div>
    </div>`;const t=s==="wrong"?"mine-wrong":"mine",a=M(e,"correct");return`<div class="res-answer-grid">
    <div class="res-answer-box ${t}">
      <span class="res-answer-label">${r("user")}إجابتك</span>
      <div class="res-answer-text">${n(M(e,"mine"))}</div>
    </div>
    <div class="res-answer-box correct">
      <span class="res-answer-label">${r("check")}الإجابة الصحيحة</span>
      <div class="res-answer-text">${n(a)}</div>
    </div>
  </div>`}function V(e,s){const t=z(e),a=G[t],o=e.earned===null||e.earned===void 0?"بانتظار التصحيح":`${p(e.earned)} / ${p(e.points)}`;return`<article class="res-q ${t} is-open">
    <button class="res-q-head" type="button" data-q-head aria-expanded="true" aria-controls="resQBody${s}">
      <span class="res-q-number">${l(s+1)}</span>
      <span class="res-q-type ${n(e.type||"")}">${n(D[e.type]||e.type||"سؤال")}</span>
      <span class="res-q-status ${t}">${r(a.icon)}${n(a.label)}</span>
      <span class="res-q-points">${r("points")}${n(o)}</span>
      <span class="res-q-toggle">${r("chevron")}</span>
    </button>
    <div class="res-q-body" id="resQBody${s}">
      <p class="res-q-question">${n(e.text||"")}</p>
      ${J(e)}
      ${K(e,t)}
      ${e.feedback?`<div class="res-feedback">${r("forum")}<div><strong>ملاحظة الأستاذ</strong><p>${n(e.feedback)}</p></div></div>`:""}
    </div>
  </article>`}function W(e){const s=e.attempt||{},t=e.exam||{},a=e.stats||{},o=Array.isArray(e.review)?e.review:[],u=Number(s.score??0),v=Number(t.total_points??0),m=v>0?Math.max(0,Math.min(100,u/v*100)):0,f=Number(a.essay_pending??0);i.hero.innerHTML=`<div class="res-hero-info">
      <span class="res-status-badge ${f>0?"pending":"done"}">${r(f>0?"clock":"check")}${f>0?"بانتظار تصحيح المقالي":"تم التصحيح"}</span>
      <h2 class="res-hero-title">${n(t.title||"اختبار")}</h2>
      <div class="res-course"><span class="res-course-dot" aria-hidden="true"></span>${n([t.course_code,t.course_title].filter(Boolean).join(" — ")||"—")}</div>
      <div class="res-meta">
        ${s.submitted_at?$("calendar","سُلّم في",y(s.submitted_at)):""}
        ${s.started_at?$("clock","بدأ في",y(s.started_at)):""}
        ${s.duration_used_min!==null&&s.duration_used_min!==void 0?$("history","المدة المستغرقة",`${l(s.duration_used_min)} دقيقة`):""}
        ${t.teacher?$("user","أستاذ المقرر",t.teacher):""}
        ${s.submitted_at?$("send","الوقت النسبي",F(s.submitted_at)):""}
      </div>
    </div>
    <div class="res-score-card">
      <div class="res-score-circle" style="--res-pct:${m.toFixed(1)}%" role="img" aria-label="الدرجة ${n(p(s.score))} من ${n(p(t.total_points))}">
        <div class="res-score-inner">
          <span class="res-score-value">${n(p(s.score))}</span>
          <span class="res-score-total">من ${n(p(t.total_points))}</span>
        </div>
      </div>
      <span class="res-grade">${r("star")}${n(A(m))}</span>
      <span class="res-percent">${n(p(Math.round(m*10)/10))}% من الدرجة الكلية</span>
    </div>`;const h=[{cls:"correct",icon:"check",label:"إجابات صحيحة",value:l(a.correct??0)},{cls:"wrong",icon:"close",label:"إجابات خاطئة",value:l(a.wrong??0)},{cls:"unanswered",icon:"details",label:"لم تُجب",value:l(a.unanswered??0)},{cls:"pending",icon:"edit",label:"مقالي قيد التصحيح",value:l(a.essay_pending??0)}];i.stats.innerHTML=h.map(c=>`<div class="res-stat ${c.cls}">
        <span class="res-stat-icon">${r(c.icon)}</span>
        <span><span class="res-stat-label">${n(c.label)}</span><span class="res-stat-value">${n(c.value)}<small>سؤال</small></span></span>
      </div>`).join(""),i.reviewCount.textContent=l(o.length),i.review.innerHTML=o.length?o.map(V).join(""):`<div class="res-empty" role="status">
        <div class="res-empty-icon">${r("details")}</div>
        <h2>لا توجد أسئلة للمراجعة</h2>
        <p>لم تُرفق أسئلة مفصّلة مع هذه النتيجة.</p>
      </div>`;const x=[{cls:"correct",label:"إجابات صحيحة",value:Number(a.correct??0)},{cls:"wrong",label:"إجابات خاطئة",value:Number(a.wrong??0)},{cls:"unanswered",label:"لم تُجب",value:Number(a.unanswered??0)},{cls:"pending",label:"مقالي قيد التصحيح",value:Number(a.essay_pending??0)}],T=x.reduce((c,b)=>c+b.value,0);i.breakdown.innerHTML=`<div class="res-card">
      <h3 class="res-card-title"><span>${r("grades")}</span>توزيع الإجابات</h3>
      ${T>0?`<div class="res-breakdown">${x.map(c=>{const b=Math.min(100,c.value/T*100);return`<div class="res-bar-row">
            <div class="res-bar-head"><span>${n(c.label)}</span><strong>${l(c.value)}</strong></div>
            <div class="res-bar-track"><span class="res-bar-fill ${c.cls}" style="width:${b.toFixed(1)}%"></span></div>
          </div>`}).join("")}</div>`:'<div class="res-empty" role="status"><p>لا توجد بيانات كافية لعرض التوزيع.</p></div>'}
    </div>`;const B=[["عنوان الاختبار",t.title||"—"],["المقرر",[t.course_code,t.course_title].filter(Boolean).join(" — ")||"—"],["أستاذ المقرر",t.teacher||"—"],["وقت البدء",s.started_at?y(s.started_at):"—"],["وقت التسليم",s.submitted_at?y(s.submitted_at):"—"],["المدة المقررة",t.duration_min!=null?`${l(t.duration_min)} دقيقة`:"—"],["المدة المستغرقة",s.duration_used_min!=null?`${l(s.duration_used_min)} دقيقة`:"—"],["الدرجة",`${p(s.score)} / ${p(t.total_points)}`],["النسبة المئوية",`${p(Math.round(m*10)/10)}%`],["التقدير",A(m)]];i.info.innerHTML=`<div class="res-card">
    <h3 class="res-card-title"><span>${r("file")}</span>معلومات النتيجة</h3>
    <div class="res-info-rows">${B.map(([c,b],C)=>`<div class="res-info-row">
          <span class="res-info-label">${n(c)}</span>
          <span class="res-info-value${C>=7?" green":""}">${n(b)}</span>
        </div>`).join("")}</div>
  </div>`}async function L(){const e=await O("student_exam_result",{p_attempt_id:H});if(!e.ok){console.error("[student_exam_result]",e.error),j({title:"تعذّر تحميل النتيجة",text:"حدث خطأ أثناء الاتصال. تحقّق من الشبكة ثم أعد المحاولة.",retry:!0,iconName:"close",tone:"alert"});return}W(e.data||{})}async function X(){try{if(!navigator.clipboard||typeof navigator.clipboard.writeText!="function")throw new Error("clipboard unavailable");await navigator.clipboard.writeText(location.href),N("تم نسخ رابط النتيجة","success")}catch{N("تعذّر نسخ الرابط تلقائياً؛ انسخه من شريط العنوان.","warning")}}function Z(e){k[e]&&(d("resTabs").querySelectorAll("[data-tab]").forEach(s=>{const t=s.dataset.tab===e;s.classList.toggle("active",t),s.setAttribute("aria-selected",String(t))}),Object.entries(k).forEach(([s,t])=>{const a=d(t);a&&(a.hidden=s!==e)}))}function q(e){const s=d(e.getAttribute("aria-controls"));if(!s)return;const t=s.hidden;s.hidden=!t,e.setAttribute("aria-expanded",String(t));const a=e.closest(".res-q");a&&a.classList.toggle("is-open",t)}R("student","نتيجة الاختبار",async({content:e})=>{if(_(),S=i.page.innerHTML,E(i.page),_(),e.addEventListener("click",async s=>{if(s.target.closest("[data-retry]")){Y(),await L();return}if(s.target.closest("#resShare")){await X();return}const t=s.target.closest("[data-tab]");if(t){Z(t.dataset.tab);return}const a=s.target.closest("[data-q-head]");a&&q(a)}),!H){j({title:"لم يتم تحديد المحاولة",text:"الرابط لا يشير إلى محاولة اختبار. عُد إلى قائمة الاختبارات لاختيار النتيجة المطلوبة.",iconName:"exams"});return}await L()});

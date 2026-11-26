import{p as $}from"./base-CCmrW03f.js";import{b as x,i as l,e as c,f as m,r as S,a as d}from"./portal-Dovf_Yw9.js";import{c as y}from"./api-a_g5aMSg.js";import"./auth-BSie1sbi.js";import"https://esm.sh/@supabase/supabase-js@2";const w={direct:"مباشر",online:"أونلاين",recorded:"مسجل"},A={lecture_not_found:"لم نعثر على هذه المحاضرة.",wrong_code:"رمز الحضور غير صحيح. تحقق من الرمز الذي يعطيك المدرّس.",attendance_not_open:"التحضير غير مفتوح لهذه المحاضرة حالياً.",code_required:"أدخل رمز الحضور قبل الإرسال.",already_attended:"تم تسجيل حضورك في هذه المحاضرة مسبقاً.",attendance_closed:"انتهت فترة تسجيل الحضور لهذه المحاضرة."};let i=null,r=null;const f=new URLSearchParams(location.search).get("id");function b(e,t){const n=String((e==null?void 0:e.code)||(e==null?void 0:e.error)||""),a=A[n];if(a)return a;const s=e!=null&&e.error?String(e.error):"";return s?`${t} (${s})`:t}function g(e){const t=String(e||"");return w[t]||(t?c(t):"محاضرة")}function H(e){return e!=null&&e.attended?"تم الحضور":e!=null&&e.attendance_open?"التحضير مفتوح":"لم يُسجّل الحضور"}function v(e){if(!e)return"";try{const t=new URL(String(e));return["http:","https:"].includes(t.protocol)?t.href:""}catch{return""}}function L(e){const t=Number(e);if(!Number.isFinite(t)||t<=0)return"—";const n=["بايت","كيلوبايت","ميجابايت","جيجابايت"];let a=0,s=t;for(;s>=1024&&a<n.length-1;)s/=1024,a+=1;const o=a===0?String(Math.round(s)):s.toFixed(1);return`${d(o)} ${n[a]}`}function T(e){return(Array.isArray(e==null?void 0:e.options)?e.options:[]).map(n=>{if(n&&typeof n=="object"){const a=n.text??n.label??n.value??n.name;return a==null?"":String(a)}return n==null?"":String(n)})}function q(e,t){if(!t)return"لم تجب بعد عن هذا السؤال.";const n=T(e);if(e.type==="multi"){const s=Array.isArray(t.choice_indices)?t.choice_indices.map(o=>Number(o)):[];return s.length?s.map(o=>n[o]||"—").join("، "):"لم تختر إجابة بعد."}if(e.type==="essay")return(t.text==null?"":String(t.text).trim())||"لم تكتب إجابة بعد.";const a=Number(t.choice_index);return Number.isInteger(a)?n[a]||"—":"لم تختر إجابة بعد."}function E(){i.innerHTML=`
    <div class="lec-skel" role="status" aria-busy="true">
      <div class="lec-skel__block"></div>
      <div class="lec-skel__block"></div>
      <div class="lec-skel__block"></div>
      <div class="lec-state">جارٍ تحميل المحاضرة…</div>
    </div>`}function _({title:e,text:t,role:n="alert",retry:a=!0,back:s=!0}){const o=[a?`<button type="button" data-action="retry">${l("refresh")} إعادة المحاولة</button>`:"",s?`<a href="${$("pages/student/lectures.html")}">العودة إلى المحاضرات</a>`:""].join("");return`<div class="lec-state" role="${n}">
    <h3>${c(e)}</h3><p>${c(t)}</p><div class="lec-state__actions">${o}</div>
  </div>`}function u(e,t,n,a,s=!1){return`<section class="lec-card ${s?"lec-card--wide":""}">
    <div class="lec-card__head">
      <span class="lec-card__icon">${l(e)}</span>
      <h2>${c(t)}</h2>
      ${n?`<span>${c(n)}</span>`:""}
    </div>
    ${a}
  </section>`}function N(){const e=r.lecture,t=[e.teacher?`<div class="lec-meta__item">${l("user")}<div><span>المدرّس</span><strong>${c(e.teacher)}</strong></div></div>`:"",e.scheduled_at?`<div class="lec-meta__item">${l("calendar")}<div><span>الموعد</span><strong>${c(m(e.scheduled_at))}${e.scheduled_at?` · ${c(S(e.scheduled_at))}`:""}</strong></div></div>`:"",e.duration_min!=null?`<div class="lec-meta__item">${l("clock")}<div><span>المدة</span><strong>${d(e.duration_min)} دقيقة</strong></div></div>`:"",e.presence_seconds>0?`<div class="lec-meta__item">${l("check")}<div><span>مدة حضورك</span><strong>${d(Math.round(e.presence_seconds/60))} دقيقة</strong></div></div>`:""].filter(Boolean).join("");return`<header class="lec-hero">
    <div class="lec-hero__top">
      <button type="button" class="lec-back" data-action="back" aria-label="العودة إلى قائمة المحاضرات">${l("chevron")}</button>
      <div class="lec-badges">
        <span class="lec-badge lec-badge--gold">${l("book")} ${c(e.course_code||e.course_title||"محاضرة")}</span>
        <span class="lec-badge">${l("video")} ${c(g(e.lecture_type))}</span>
        <span class="lec-badge ${e.attendance_open?"lec-badge--live":"lec-badge--soft"}" data-role="attendance-badge">
          ${l(e.attended?"check":"clock")} ${c(H(e))}
        </span>
      </div>
    </div>
    <h1>${c(e.title||"محاضرة")}</h1>
    ${e.course_title?`<p class="lec-hero__course">${c(e.course_title)}</p>`:""}
    <div class="lec-meta">${t}</div>
  </header>`}function M(){const e=r.lecture,t=e.attendance_open?v(e.live_url):"",n=v(e.youtube_url),a=[t?`<a class="lec-link lec-link--live" href="${c(t)}" target="_blank" rel="noopener noreferrer">
      ${l("video")}<div><strong>الدبث المباشر</strong><span>افتح البث في نافذة جديدة</span></div>${l("arrow")}
    </a>`:"",n?`<a class="lec-link" href="${c(n)}" target="_blank" rel="noopener noreferrer">
      ${l("link")}<div><strong>رابط المحاضرة على يوتيوب</strong><span>افتح الرابط في نافذة جديدة</span></div>${l("arrow")}
    </a>`:""].join(""),s=e.recording_note?`<div class="lec-note">${l("clock")}<span>${c(e.recording_note)}</span></div>`:"",o=a||s?`${a}${s}`:'<p class="lec-empty" role="status">لا توجد روابط بث أو ملاحظة تسجيل متاحة لهذه المحاضرة حالياً.</p>';return u("video","البث والمصادر","",o,!0)}function j(){const e=Array.isArray(r.files)?r.files:[],t=e.length?`<ul class="lec-files">${e.map(n=>{const a=n.name||n.filename||"ملف بدون اسم",s=String(n.filename||a).split(".").pop().slice(0,5);return`<li class="lec-file">
          <span class="lec-file__icon">${l("file")}</span>
          <div><strong>${c(a)}</strong><span>${n.kind?`${c(n.kind)} · `:""}${n.mime?`${c(n.mime)} · `:""}${c(s)}</span></div>
          <span class="lec-file__size">${c(L(n.size))}</span>
        </li>`}).join("")}</ul>
      <div class="lec-note">${l("file")}<span>الملفات مرفقة بالمحاضرة؛ لا يتوفر رابط تنزيل مباشر حالياً. راجع المدرّس للحصول عليها.</span></div>`:'<p class="lec-empty" role="status">لا توجد ملفات مرفقة بهذه المحاضرة.</p>';return u("paper","ملفات المحاضرة",d(e.length),t)}function R(){const e=Array.isArray(r.questions)?r.questions:[],t=e.length?`<div class="lec-questions">${e.map(n=>{const a=n.my_answer||null,s=!a;return`<details class="lec-q">
          <summary>
            <span class="lec-q__text">${c(n.text||"")}</span>
            <span class="lec-q__tag ${s?"lec-q__tag--pending":""}">${s?"لم تجب":"إجابتك"}</span>
          </summary>
          <div class="lec-q__body">
            <span class="lec-q__label">${s?"حالتك":"إجابتك المسجلة"}</span>
            <p class="lec-q__answer">${c(q(n,a))}</p>
          </div>
        </details>`}).join("")}</div>`:'<p class="lec-empty" role="status">لا توجد أسئلة مطروحة في هذه المحاضرة.</p>';return u("forum","أسئلة المحاضرة",d(e.length),t)}function C(){const e=r.lecture;let t="";return e.attended?t=`<p class="lec-success" role="status">${l("check")} تم تسجيل حضورك في هذه المحاضرة.</p>`:e.attendance_open?t=`<div class="lec-attend" id="lec-attendance-body">
      <div class="lec-field">
        <label for="lec-code">رمز الحضور</label>
        <input type="text" id="lec-code" name="code" inputmode="numeric" autocomplete="off" placeholder="أدخل الرمز الذي يشاركه المدرّس">
      </div>
      <div class="lec-attend__actions">
        <button type="button" class="lec-attend__button" data-action="attend">${l("check")} تسجيل الحضور</button>
        <p class="lec-status" id="lec-status" role="status" aria-live="polite"></p>
      </div>
    </div>`:t='<p class="lec-empty" role="status">التحضير غير مفتوح لهذه المحاضرة حالياً.</p>',u("key","تسجيل الحضور","",t,!0)}function U(){const e=Array.isArray(r.related)?r.related:[],t=e.length?`<div class="lec-related">${e.map(n=>`<a class="lec-related__item" href="${$("pages/student/lecture.html")}?id=${encodeURIComponent(n.id)}">
        ${l("lectures")}
        <div><strong>${c(n.title||"محاضرة")}</strong><span>${n.scheduled_at?`${c(m(n.scheduled_at))} · `:""}${c(g(n.lecture_type))}${n.course_title?` · ${c(n.course_title)}`:""}</span></div>
        ${l("chevron")}
      </a>`).join("")}</div>`:'<p class="lec-empty" role="status">لا توجد محاضرات أخرى مرتبطة بهذه المحاضرة.</p>';return u("library","محاضرات ذات صلة",d(e.length),t,!0)}function z(){i.innerHTML=`<div class="lec-page">
    ${N()}
    ${r.lecture.description?u("book","وصف المحاضرة","",`<p class="lec-text">${c(r.lecture.description)}</p>`):""}
    ${M()}
    ${j()}
    ${R()}
    ${C()}
    ${U()}
  </div>`}async function h(){const e=i.querySelector("#lec-code"),t=i.querySelector("#lec-status"),n=i.querySelector('[data-action="attend"]');if(!e||!n||!r)return;const a=e.value.trim();if(!a){t&&(t.textContent="أدخل رمز الحضور أولاً.",t.className="lec-status lec-status--error"),e.focus();return}n.disabled=!0,e.disabled=!0,t&&(t.textContent="جارٍ التحقق من الرمز…",t.className="lec-status");try{const s=await y("student_lecture_attendance",{p_lecture_id:f,p_code:a});if(!s.ok)throw new Error(b(s,"تعذّر تسجيل الحضور. حاول مرة أخرى."));r.lecture.attended=!0,r.lecture.attendance_open=!1;const o=i.querySelector("#lec-attendance-body");o&&(o.innerHTML=`<p class="lec-success" role="status">${l("check")} تم تسجيل حضورك في هذه المحاضرة.</p>`);const p=i.querySelector('[data-role="attendance-badge"]');p&&(p.className="lec-badge lec-badge--live",p.innerHTML=`${l("check")} تم الحضور`)}catch(s){t&&(t.textContent=String((s==null?void 0:s.message)||s),t.className="lec-status lec-status--error"),n.disabled=!1,e.disabled=!1,e.focus()}}async function I(e){const t=e.target.closest("[data-action]");!t||!i.contains(t)||(t.dataset.action==="retry"?await k():t.dataset.action==="back"?location.href=$("pages/student/lectures.html"):t.dataset.action==="attend"&&await h())}function O(e){var t;e.key==="Enter"&&((t=e.target)==null?void 0:t.id)==="lec-code"&&(e.preventDefault(),h())}async function k(){if(r=null,E(),!f){i.innerHTML=_({title:"لم يتم تحديد المحاضرة",text:"افتح المحاضرة من جدول المحاضرات لعرض تفاصيلها.",retry:!1});return}const e=await y("student_lecture_detail",{p_lecture_id:f});if(!e.ok){i.innerHTML=_({title:"تعذّر تحميل المحاضرة",text:b(e,"تعذّر تحميل تفاصيل المحاضرة. حاول مرة أخرى.")});return}const t=e.data||{};if(!t.lecture){i.innerHTML=_({title:"لا توجد بيانات لهذه المحاضرة",text:"قد تكون المحاضرة حُذفت أو لم تعد متاحة لك. راجع جدول المحاضرات.",role:"status",retry:!1});return}r={lecture:t.lecture,files:Array.isArray(t.files)?t.files:[],questions:Array.isArray(t.questions)?t.questions:[],related:Array.isArray(t.related)?t.related:[]},z()}x("student","تفاصيل المحاضرة",async({profile:e,content:t})=>{i=t,i.addEventListener("click",I),i.addEventListener("keydown",O),await k()});

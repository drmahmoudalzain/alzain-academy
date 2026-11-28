import"./modulepreload-polyfill-B5Qt9EMX.js";import{b as I,o as C,i as l,e as a,f as E,r as j,a as u}from"./portal-CvPpoiNp.js";import{c as k}from"./api-DQI-AaeE.js";import{p as x}from"./base-CLcZMpw2.js";import"./identity-rules-Cp64wFaG.js";import"https://esm.sh/@supabase/supabase-js@2";import"./first-visit-BDQ6DJqx.js";const F=6e4,P="student_lecture_presence_heartbeat";function U(e,t,n={}){const s=n.intervalMs??F,c=Math.round(s/1e3),i=n.isHidden??(()=>typeof document<"u"&&document.hidden),f=n.setIntervalFn??setInterval,R=n.clearIntervalFn??clearInterval,b=n.addListener??(typeof document<"u"?document.addEventListener.bind(document):void 0),y=n.removeListener??(typeof document<"u"?document.removeEventListener.bind(document):void 0),h=n.onResult;let m=!1,v=null;const S=async()=>{if(!m&&!i())try{const A=await t(P,{p_lecture_id:e,p_seconds:c});h==null||h(A)}catch{}},H=()=>{m||i()||S()};return v=f(S,s),b==null||b("visibilitychange",H),function(){m||(m=!0,v!==null&&R(v),v=null,y==null||y("visibilitychange",H))}}const z={direct:"مباشر",online:"أونلاين",recorded:"مسجل"},B={lecture_not_found:"لم نعثر على هذه المحاضرة.",wrong_code:"رمز الحضور غير صحيح. تحقق من الرمز الذي يعطيك المدرّس.",attendance_not_open:"التحضير غير مفتوح لهذه المحاضرة حالياً.",code_required:"أدخل رمز الحضور قبل الإرسال.",already_attended:"تم تسجيل حضورك في هذه المحاضرة مسبقاً.",attendance_closed:"انتهت فترة تسجيل الحضور لهذه المحاضرة."};let o=null,r=null,d=null,$=0;function T(e){const t=Math.max(0,Math.floor(Number(e)||0)),n=Math.floor(t/60),s=t%60;return`${n}:${String(s).padStart(2,"0")}`}function D(){const e=document.getElementById("lecPresence");e&&(e.textContent=`الوقت المسجّل: ${T($)}`)}function O(){d&&(d(),d=null),_&&($=0,d=U(_,k,{onResult:e=>{var n;const t=Number((n=e==null?void 0:e.data)==null?void 0:n.total_seconds);Number.isFinite(t)&&($=t,D())}}))}const _=new URLSearchParams(location.search).get("id");function L(e,t){const n=String((e==null?void 0:e.code)||(e==null?void 0:e.error)||""),s=B[n];if(s)return s;const c=e!=null&&e.error?String(e.error):"";return c?`${t} (${c})`:t}function M(e){const t=String(e||"");return z[t]||(t?a(t):"محاضرة")}function K(e){return e!=null&&e.attended?"تم الحضور":e!=null&&e.attendance_open?"التحضير مفتوح":"لم يُسجّل الحضور"}function w(e){if(!e)return"";try{const t=new URL(String(e));return["http:","https:"].includes(t.protocol)?t.href:""}catch{return""}}function V(e){const t=Number(e);if(!Number.isFinite(t)||t<=0)return"—";const n=["بايت","كيلوبايت","ميجابايت","جيجابايت"];let s=0,c=t;for(;c>=1024&&s<n.length-1;)c/=1024,s+=1;const i=s===0?String(Math.round(c)):c.toFixed(1);return`${u(i)} ${n[s]}`}function X(e){return(Array.isArray(e==null?void 0:e.options)?e.options:[]).map(n=>{if(n&&typeof n=="object"){const s=n.text??n.label??n.value??n.name;return s==null?"":String(s)}return n==null?"":String(n)})}function Y(e,t){if(!t)return"لم تجب بعد عن هذا السؤال.";const n=X(e);if(e.type==="multi"){const c=Array.isArray(t.choice_indices)?t.choice_indices.map(i=>Number(i)):[];return c.length?c.map(i=>n[i]||"—").join("، "):"لم تختر إجابة بعد."}if(e.type==="essay")return(t.text==null?"":String(t.text).trim())||"لم تكتب إجابة بعد.";const s=Number(t.choice_index);return Number.isInteger(s)?n[s]||"—":"لم تختر إجابة بعد."}function G(){o.innerHTML=`
    <div class="lec-skel" role="status" aria-busy="true">
      <div class="lec-skel__block"></div>
      <div class="lec-skel__block"></div>
      <div class="lec-skel__block"></div>
      <div class="lec-state">جارٍ تحميل المحاضرة…</div>
    </div>`}function g({title:e,text:t,role:n="alert",retry:s=!0,back:c=!0}){const i=[s?`<button type="button" data-action="retry">${l("refresh")} إعادة المحاولة</button>`:"",c?`<a href="${x("pages/student/lectures.html")}">العودة إلى المحاضرات</a>`:""].join("");return`<div class="lec-state" role="${n}">
    <h3>${a(e)}</h3><p>${a(t)}</p><div class="lec-state__actions">${i}</div>
  </div>`}function p(e,t,n,s,c=!1){return`<section class="lec-card ${c?"lec-card--wide":""}">
    <div class="lec-card__head">
      <span class="lec-card__icon">${l(e)}</span>
      <h2>${a(t)}</h2>
      ${n?`<span>${a(n)}</span>`:""}
    </div>
    ${s}
  </section>`}function J(){const e=r.lecture,t=[e.teacher?`<div class="lec-meta__item">${l("user")}<div><span>المدرّس</span><strong>${a(e.teacher)}</strong></div></div>`:"",e.scheduled_at?`<div class="lec-meta__item">${l("calendar")}<div><span>الموعد</span><strong>${a(E(e.scheduled_at))}${e.scheduled_at?` · ${a(j(e.scheduled_at))}`:""}</strong></div></div>`:"",e.duration_min!=null?`<div class="lec-meta__item">${l("clock")}<div><span>المدة</span><strong>${u(e.duration_min)} دقيقة</strong></div></div>`:"",e.presence_seconds>0?`<div class="lec-meta__item">${l("check")}<div><span>مدة حضورك</span><strong>${u(Math.round(e.presence_seconds/60))} دقيقة</strong></div></div>`:""].filter(Boolean).join("");return`<header class="lec-hero">
    <div class="lec-hero__top">
      <button type="button" class="lec-back" data-action="back" aria-label="العودة إلى قائمة المحاضرات">${l("chevron")}</button>
      <div class="lec-badges">
        <span class="lec-badge lec-badge--gold">${l("book")} ${a(e.course_code||e.course_title||"محاضرة")}</span>
        <span class="lec-badge">${l("video")} ${a(M(e.lecture_type))}</span>
        <span class="lec-badge ${e.attendance_open?"lec-badge--live":"lec-badge--soft"}" data-role="attendance-badge">
          ${l(e.attended?"check":"clock")} ${a(K(e))}
        </span>
      </div>
    </div>
    <h1>${a(e.title||"محاضرة")}</h1>
    ${e.course_title?`<p class="lec-hero__course">${a(e.course_title)}</p>`:""}
    <div class="lec-meta">${t}</div>
  </header>`}function Q(){const e=r.lecture,t=e.attendance_open?w(e.live_url):"",n=w(e.youtube_url),s=[t?`<a class="lec-link lec-link--live" href="${a(t)}" target="_blank" rel="noopener noreferrer">
      ${l("video")}<div><strong>الدبث المباشر</strong><span>افتح البث في نافذة جديدة</span></div>${l("arrow")}
    </a>`:"",n?`<a class="lec-link" href="${a(n)}" target="_blank" rel="noopener noreferrer">
      ${l("link")}<div><strong>رابط المحاضرة على يوتيوب</strong><span>افتح الرابط في نافذة جديدة</span></div>${l("arrow")}
    </a>`:""].join(""),c=e.recording_note?`<div class="lec-note">${l("clock")}<span>${a(e.recording_note)}</span></div>`:"",i=s||c?`${s}${c}`:'<p class="lec-empty" role="status">لا توجد روابط بث أو ملاحظة تسجيل متاحة لهذه المحاضرة حالياً.</p>';return p("video","البث والمصادر","",i,!0)}function W(){const e=Array.isArray(r.files)?r.files:[],t=e.length?`<ul class="lec-files">${e.map(n=>{const s=n.name||n.filename||"ملف بدون اسم",c=String(n.filename||s).split(".").pop().slice(0,5);return`<li class="lec-file">
          <span class="lec-file__icon">${l("file")}</span>
          <div><strong>${a(s)}</strong><span>${n.kind?`${a(n.kind)} · `:""}${n.mime?`${a(n.mime)} · `:""}${a(c)}</span></div>
          <span class="lec-file__size">${a(V(n.size))}</span>
        </li>`}).join("")}</ul>
      <div class="lec-note">${l("file")}<span>الملفات مرفقة بالمحاضرة؛ لا يتوفر رابط تنزيل مباشر حالياً. راجع المدرّس للحصول عليها.</span></div>`:'<p class="lec-empty" role="status">لا توجد ملفات مرفقة بهذه المحاضرة.</p>';return p("paper","ملفات المحاضرة",u(e.length),t)}function Z(){const e=Array.isArray(r.questions)?r.questions:[],t=e.length?`<div class="lec-questions">${e.map(n=>{const s=n.my_answer||null,c=!s;return`<details class="lec-q">
          <summary>
            <span class="lec-q__text">${a(n.text||"")}</span>
            <span class="lec-q__tag ${c?"lec-q__tag--pending":""}">${c?"لم تجب":"إجابتك"}</span>
          </summary>
          <div class="lec-q__body">
            <span class="lec-q__label">${c?"حالتك":"إجابتك المسجلة"}</span>
            <p class="lec-q__answer">${a(Y(n,s))}</p>
          </div>
        </details>`}).join("")}</div>`:'<p class="lec-empty" role="status">لا توجد أسئلة مطروحة في هذه المحاضرة.</p>';return p("forum","أسئلة المحاضرة",u(e.length),t)}function ee(){const e=r.lecture;let t="";return e.attended?t=`<p class="lec-success" role="status">${l("check")} تم تسجيل حضورك في هذه المحاضرة.</p>`:e.attendance_open?t=`<div class="lec-attend" id="lec-attendance-body">
      <div class="lec-field">
        <label for="lec-code">رمز الحضور</label>
        <input type="text" id="lec-code" name="code" inputmode="numeric" autocomplete="off" placeholder="أدخل الرمز الذي يشاركه المدرّس">
      </div>
      <div class="lec-attend__actions">
        <button type="button" class="lec-attend__button" data-action="attend">${l("check")} تسجيل الحضور</button>
        <p class="lec-status" id="lec-status" role="status" aria-live="polite"></p>
      </div>
    </div>`:t='<p class="lec-empty" role="status">التحضير غير مفتوح لهذه المحاضرة حالياً.</p>',p("key","تسجيل الحضور","",t,!0)}function te(){const e=Array.isArray(r.related)?r.related:[],t=e.length?`<div class="lec-related">${e.map(n=>`<a class="lec-related__item" href="${x("pages/student/lecture.html")}?id=${encodeURIComponent(n.id)}">
        ${l("lectures")}
        <div><strong>${a(n.title||"محاضرة")}</strong><span>${n.scheduled_at?`${a(E(n.scheduled_at))} · `:""}${a(M(n.lecture_type))}${n.course_title?` · ${a(n.course_title)}`:""}</span></div>
        ${l("chevron")}
      </a>`).join("")}</div>`:'<p class="lec-empty" role="status">لا توجد محاضرات أخرى مرتبطة بهذه المحاضرة.</p>';return p("library","محاضرات ذات صلة",u(e.length),t,!0)}function ne(){o.innerHTML=`<div class="lec-page">
    ${J()}
    ${r.lecture.description?p("book","وصف المحاضرة","",`<p class="lec-text">${a(r.lecture.description)}</p>`):""}
    ${Q()}
    ${W()}
    ${Z()}
    ${ee()}
    <p class="lec-text" id="lecPresence" aria-live="polite">الوقت المسجّل: ${a(T($))}</p>
    ${te()}
  </div>`}async function N(){const e=o.querySelector("#lec-code"),t=o.querySelector("#lec-status"),n=o.querySelector('[data-action="attend"]');if(!e||!n||!r)return;const s=e.value.trim();if(!s){t&&(t.textContent="أدخل رمز الحضور أولاً.",t.className="lec-status lec-status--error"),e.focus();return}if(s.length<4){t&&(t.textContent="رمز الحضور يجب أن يكون 4 أحرف على الأقل.",t.className="lec-status lec-status--error"),e.focus();return}n.disabled=!0,e.disabled=!0,t&&(t.textContent="جارٍ التحقق من الرمز…",t.className="lec-status");try{const c=await k("student_lecture_attendance",{p_lecture_id:_,p_code:s});if(!c.ok)throw new Error(L(c,"تعذّر تسجيل الحضور. حاول مرة أخرى."));r.lecture.attended=!0,r.lecture.attendance_open=!1;const i=o.querySelector("#lec-attendance-body");i&&(i.innerHTML=`<p class="lec-success" role="status">${l("check")} تم تسجيل حضورك في هذه المحاضرة.</p>`);const f=o.querySelector('[data-role="attendance-badge"]');f&&(f.className="lec-badge lec-badge--live",f.innerHTML=`${l("check")} تم الحضور`)}catch(c){t&&(t.textContent=String((c==null?void 0:c.message)||c),t.className="lec-status lec-status--error"),n.disabled=!1,e.disabled=!1,e.focus()}}async function se(e){const t=e.target.closest("[data-action]");!t||!o.contains(t)||(t.dataset.action==="retry"?await q():t.dataset.action==="back"?location.href=x("pages/student/lectures.html"):t.dataset.action==="attend"&&await N())}function ce(e){var t;e.key==="Enter"&&((t=e.target)==null?void 0:t.id)==="lec-code"&&(e.preventDefault(),N())}async function q(){if(r=null,G(),!_){o.innerHTML=g({title:"لم يتم تحديد المحاضرة",text:"افتح المحاضرة من جدول المحاضرات لعرض تفاصيلها.",retry:!1});return}const e=await k("student_lecture_detail",{p_lecture_id:_});if(!e.ok){o.innerHTML=g({title:"تعذّر تحميل المحاضرة",text:L(e,"تعذّر تحميل تفاصيل المحاضرة. حاول مرة أخرى.")});return}const t=e.data||{};if(!t.lecture){o.innerHTML=g({title:"لا توجد بيانات لهذه المحاضرة",text:"قد تكون المحاضرة حُذفت أو لم تعد متاحة لك. راجع جدول المحاضرات.",role:"status",retry:!1});return}r={lecture:t.lecture,files:Array.isArray(t.files)?t.files:[],questions:Array.isArray(t.questions)?t.questions:[],related:Array.isArray(t.related)?t.related:[]},ne(),O()}I("student","تفاصيل المحاضرة",async({profile:e,content:t})=>{o=t,o.addEventListener("click",se),o.addEventListener("keydown",ce),C(()=>{d&&(d(),d=null)}),await q()});

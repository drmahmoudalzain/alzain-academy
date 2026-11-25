import"./modulepreload-polyfill-B5Qt9EMX.js";import{b as X,i as u,e as c,f as j,r as E,c as l,d as R}from"./portal-Sks-N-0q.js";import{c as I}from"./api-CE-Y1P0n.js";import{p as A}from"./auth-DJQIbBRA.js";import"https://esm.sh/@supabase/supabase-js@2";const K={mcq:"اختيار واحد",multi:"اختيار متعدد",truefalse:"صح أو خطأ",essay:"إجابة نصية"},Y={exam_not_started:"لم يبدأ وقت الاختبار بعد. عُد في الموعد المحدد.",exam_closed:"انتهى وقت الاختبار أو أُغلق. لا يمكن متابعة الإجابة.",exam_not_found:"لم نعثر على هذا الاختبار.",attempt_not_found:"لم نعثر على محاولة الاختبار. عُد إلى قائمة الاختبارات.",already_submitted:"تم تسليم هذا الاختبار مسبقاً.",question_not_found:"أحد الأسئلة لم يعد متاحاً. حدّث الصفحة.",invalid_answer:"الإجابة غير صالحة. حاول مرة أخرى.",code_required:"أدخل رمز الحضور.",wrong_code:"الرمز غير صحيح.",attendance_not_open:"التحضير غير مفتوح حالياً."},G=600,h=5e3;let r=null,s=null,k=null,p=null;const S=new URLSearchParams(location.search).get("id");function N(t,e){const n=String((t==null?void 0:t.code)||(t==null?void 0:t.error)||""),a=Y[n];if(a)return a;const i=t!=null&&t.error?String(t.error):"";return i?`${e} (${i})`:e}function f(t){return String((t==null?void 0:t.id)??"")}function Q(t){return(Array.isArray(t==null?void 0:t.options)?t.options:[]).map(n=>{if(n&&typeof n=="object"){const a=n.text??n.label??n.value??n.name;return a==null?"":String(a)}return n==null?"":String(n)})}function J(t){const e=t!=null&&t.my_answer&&typeof t.my_answer=="object"?t.my_answer:{},n=e.choice_index,a=n!=null&&n!==""&&Number.isFinite(Number(n))?Number(n):null,i=Array.isArray(e.choice_indices)?e.choice_indices.map(o=>Number(o)).filter(o=>Number.isInteger(o)):[];return{choice_index:a,choice_indices:i,text:e.text==null?"":String(e.text)}}function b(t,e){return!e||!t?!1:t.type==="essay"?e.text.trim().length>0:t.type==="multi"?e.choice_indices.length>0:e.choice_index!==null}function D(){return s?s.questions.filter(t=>b(t,s.answers[f(t)])).length:0}function q(){return`tk-start:${(s==null?void 0:s.attemptId)||S||"unknown"}`}function y(t){return(s==null?void 0:s.questions.find(e=>f(e)===t))||null}function C(t){return Array.from((r==null?void 0:r.querySelectorAll(".tk-q"))||[]).find(e=>e.dataset.qid===t)||null}function M(t){return(r==null?void 0:r.querySelector(`.tk-chip[data-index="${t}"]`))||null}function W(){r.innerHTML=`
    <div class="tk-skel" role="status" aria-busy="true">
      <div class="tk-skel__card"></div>
      <div class="tk-skel__card"></div>
      <div class="tk-skel__card"></div>
      <div class="tk-state">جارٍ تحميل الاختبار…</div>
    </div>`}function w({title:t,text:e,role:n="alert",retry:a=!0,back:i=!0}){const o=[a?`<button type="button" data-action="retry">${u("refresh")} إعادة المحاولة</button>`:"",i?`<a href="${A("pages/student/exams.html")}">العودة إلى الاختبارات</a>`:""].join("");return`<div class="tk-state" role="${n}">
    <h3>${c(t)}</h3><p>${c(e)}</p><div class="tk-footer">${o}</div>
  </div>`}function Z(){const t=s.exam||{},e=[t.starts_at?`<span>${u("calendar")} يبدأ ${c(j(t.starts_at))}</span>`:"",t.ends_at?`<span>${u("clock")} ينتهي ${c(j(t.ends_at))} · ${c(E(t.ends_at))}</span>`:"",t.questions_count!=null?`<span>${u("exams")} ${l(t.questions_count)} سؤال</span>`:"",t.total_points!=null?`<span>${u("star")} ${R(t.total_points)} نقطة</span>`:""].filter(Boolean).join("");return`<section class="tk-intro">
    <h2>${c(t.title||"اختبار")}</h2>
    ${t.description?`<p>${c(t.description)}</p>`:""}
    <div class="tk-intro__meta">${e}</div>
    <p class="tk-intro__note">تُحفظ إجاباتك تلقائياً. لا تغلق الصفحة قبل تسليم الاختبار.</p>
  </section>`}function tt(t,e){const n=f(t),a=String(t.type||""),i=s.answers[n],o=Q(t);let d="";if(a==="essay")d=`<label class="tk-label" for="tk-text-${c(n)}">اكتب إجابتك (حد أقصى ${l(h)} حرف)</label>
      <textarea class="tk-text" id="tk-text-${c(n)}" data-field="text" data-qid="${c(n)}"
        rows="5" maxlength="${h}">${c(i.text)}</textarea>
      <span class="tk-count" data-count="${c(n)}">${l(i.text.length)} / ${l(h)}</span>`;else if(o.length){const m=a==="multi";d=`<div class="tk-choices">${o.map((B,x)=>{const V=m?i.choice_indices.includes(x):i.choice_index===x;return`<label class="tk-choice ${m?"tk-choice--multi":""}">
        <input type="${m?"checkbox":"radio"}" name="tk-q-${c(n)}" value="${x}"
          data-field="choice" data-qid="${c(n)}" ${V?"checked":""}>
        <span class="tk-choice__mark"></span>
        <span class="tk-choice__text">${c(B||"خيار بدون نص")}</span>
      </label>`}).join("")}</div>`}else d='<p class="tk-intro__note">لا توجد خيارات متاحة لهذا السؤال.</p>';return`<article class="tk-q ${b(t,i)?"is-answered":""} ${e===s.current?"is-current":""}"
      id="tk-q-${c(n)}" data-qid="${c(n)}" data-index="${e}">
    <div class="tk-q__head">
      <span class="tk-q__num">${l(e+1)}</span>
      <div class="tk-q__heading">
        <span class="tk-q__type">${K[a]||c(a||"سؤال")}</span>
        <h3 class="tk-q__prompt">${c(t.text||"")}</h3>
      </div>
      <span class="tk-q__points">${R(t.points)} نقطة</span>
    </div>
    ${d}
    <div class="tk-q__foot">
      <span>السؤال ${l(e+1)} من ${l(s.questions.length)}</span>
      <span class="tk-q__saved" data-saved="${c(n)}" ${s.saved.has(n)?"":"hidden"}>تم الحفظ</span>
      <button type="button" class="tk-step tk-step--prev" data-action="prev" data-index="${e}" ${e===0?"disabled":""} aria-label="السؤال السابق">${u("chevron")} السابق</button>
      <button type="button" class="tk-step" data-action="next" data-index="${e}" ${e===s.questions.length-1?"disabled":""} aria-label="السؤال التالي">التالي ${u("chevron")}</button>
    </div>
  </article>`}function et(){return`<aside class="tk-navigator" aria-label="مؤشر أسئلة الاختبار">
    <h3>أسئلة الاختبار</h3>
    <p id="tk-current-label">السؤال ${l(s.current+1)} من ${l(s.questions.length)}</p>
    <div class="tk-navgrid">${s.questions.map((t,e)=>{const n=f(t);return`<button type="button" class="tk-chip ${b(t,s.answers[n])?"is-answered":""} ${e===s.current?"is-current":""}"
        data-action="goto" data-index="${e}" aria-label="الانتقال إلى السؤال ${l(e+1)}">${l(e+1)}</button>`}).join("")}</div>
  </aside>`}function nt(){return`<div class="tk-modal" id="tk-modal" hidden>
    <div class="tk-dialog" role="dialog" aria-modal="true" aria-labelledby="tk-modal-title">
      <div class="tk-dialog__icon">${u("shield")}</div>
      <h3 id="tk-modal-title">تأكيد تسليم الاختبار</h3>
      <p id="tk-modal-counts"></p>
      <ul>
        <li>بعد التسليم لا يمكن تعديل الإجابات أو إعادة فتح الاختبار.</li>
        <li>ستظهر النتيجة في صفحة مستقلة فور توفرها.</li>
      </ul>
      <div class="tk-dialog__actions">
        <button type="button" class="tk-dialog__cancel" data-action="cancel-submit">العودة للإجابة</button>
        <button type="button" class="tk-dialog__confirm" data-action="confirm-submit">تأكيد التسليم</button>
      </div>
    </div>
  </div>`}function st(){var t,e,n;r.innerHTML=`
    <div class="tk-page">
      <header class="tk-head">
        <div class="tk-head__row">
          <button type="button" class="tk-back" data-action="back" aria-label="العودة إلى قائمة الاختبارات">${u("chevron")}</button>
          <div class="tk-head__title">
            <strong>${c(((t=s.exam)==null?void 0:t.title)||"اختبار")}</strong>
            <span>${c(((e=s.exam)==null?void 0:e.course_title)||"")}${(n=s.exam)!=null&&n.course_code?` · ${c(s.exam.course_code)}`:""}</span>
          </div>
          <div class="tk-head__stats">
            <span class="tk-timer" id="tk-timer" aria-live="polite" aria-atomic="true">${u("clock")}<span id="tk-timer-value">—</span></span>
            <span class="tk-save" id="tk-save" aria-live="polite">${u("check")}<span>جاهز</span></span>
            <button type="button" class="tk-submit" data-action="submit">تسليم الاختبار ${u("check")}</button>
          </div>
        </div>
        <div class="tk-progress" aria-live="polite">
          <span id="tk-progress-text"></span>
          <div class="tk-progress__bar"><span class="tk-progress__fill" id="tk-progress-fill"></span></div>
        </div>
      </header>
      <div class="tk-alert" id="tk-alert" role="alert" hidden></div>
      <div class="tk-main">${Z()}${s.questions.map(tt).join("")}</div>
      ${et()}
      <div class="tk-footer">
        <button type="button" class="tk-step" data-action="back">${u("chevron")} العودة للاختبارات</button>
        <button type="button" class="tk-submit" data-action="submit">تسليم الاختبار ${u("check")}</button>
      </div>
    </div>
    ${nt()}`,H(),rt(),ot()}function v(t,e){const n=r==null?void 0:r.querySelector("#tk-save");n&&(n.className=`tk-save tk-save--${t}`,n.innerHTML=`${u(t==="error"?"close":t==="pending"?"clock":"check")}<span>${c(e)}</span>`)}function T(t,e=!1){const n=r==null?void 0:r.querySelector("#tk-alert");n&&(n.hidden=!1,n.innerHTML=`${u("shield")}<span>${c(t)}</span>${e?'<button type="button" data-action="retry-saves">إعادة المحاولة</button>':""}`)}function at(){const t=r==null?void 0:r.querySelector("#tk-alert");t&&(t.hidden=!0)}function it(t){const e=C(t),n=s.questions.findIndex(i=>f(i)===t),a=n>=0?M(n):null;e==null||e.classList.add("is-pending"),a==null||a.classList.add("is-pending")}function $(t){const e=y(t),n=C(t);if(!e||!n)return;const a=b(e,s.answers[t]),i=Number(n.dataset.index),o=M(i);n.classList.toggle("is-answered",a),o==null||o.classList.toggle("is-answered",a);const d=n.querySelector("[data-saved]");d&&(d.hidden=!s.saved.has(t)),!s.timers.has(t)&&!s.pending.has(t)&&!s.failed.has(t)&&(n.classList.remove("is-pending"),o==null||o.classList.remove("is-pending"))}function H(){if(!s)return;const t=D(),e=s.questions.length,n=r==null?void 0:r.querySelector("#tk-progress-text"),a=r==null?void 0:r.querySelector("#tk-progress-fill");n&&(n.textContent=`أجبت عن ${l(t)} من ${l(e)} سؤال`),a&&(a.style.width=`${e?Math.round(t/e*100):0}%`)}function _(){s&&(s.dirty=s.timers.size>0||s.pending.size>0||s.failed.size>0)}function U(t){if(!s||s.submitted)return;clearTimeout(s.timers.get(t)),s.timers.delete(t),it(t);const e=y(t);(e==null?void 0:e.type)==="essay"?(s.timers.set(t,setTimeout(()=>L(t),G)),v("pending","سيُحفظ النص بعد توقفك عن الكتابة…")):L(t),_()}async function L(t){if(!s||s.submitted)return;clearTimeout(s.timers.get(t)),s.timers.delete(t);const e=y(t);if(!e)return;const n=s.answers[t],a={p_attempt_id:s.attemptId,p_question_id:e.id};let i=!1;if(e.type==="multi"?(a.p_choice_indices=[...n.choice_indices],i=!0):e.type==="essay"?(a.p_text=n.text,i=n.text.trim().length>0):n.choice_index!==null&&(a.p_choice_index=n.choice_index,i=!0),!i){$(t),_();return}s.pending.add(t),v("pending","جارٍ حفظ الإجابة…"),_();try{const o=await I("student_exam_save_answer",a);if(!o.ok)throw new Error(N(o,"تعذّر حفظ الإجابة."));s.failed.delete(t),s.saved.add(t),v("done","تم حفظ الإجابات"),s.failed.size||at()}catch(o){s.failed.add(t),v("error","تعذّر الحفظ"),T(String((o==null?void 0:o.message)||o),!0)}finally{s.pending.delete(t),_(),$(t)}}async function z(){if(!s)return;const t=[...new Set([...s.timers.keys(),...s.pending,...s.failed])];await Promise.all(t.map(e=>L(e))),_()}function rt(){var o,d;const t=r==null?void 0:r.querySelector("#tk-timer-value");if(!t)return;const e=Number((o=s.exam)==null?void 0:o.duration_min);if(!Number.isFinite(e)||e<=0){t.textContent="—",(d=r.querySelector("#tk-timer"))==null||d.setAttribute("title","لم يتم تحديد مدة للاختبار في البيانات");return}const n=Date.now(),a=s.startedAt?Date.parse(s.startedAt):NaN;let i=Number.isFinite(a)&&a>0&&a<=n?a:0;if(!i)try{i=Number(sessionStorage.getItem(q()))}catch{i=0}if(!Number.isFinite(i)||i<=0||i>n){i=n;try{sessionStorage.setItem(q(),String(i))}catch{}}s.deadline=i+e*6e4,k=setInterval(O,1e3),O()}function O(){const t=r==null?void 0:r.querySelector("#tk-timer-value");if(!t||!(s!=null&&s.deadline))return;const e=Math.max(0,s.deadline-Date.now()),n=Math.floor(e/36e5),a=Math.floor(e%36e5/6e4),i=Math.floor(e%6e4/1e3);t.textContent=n?`${l(n)}:${String(a).padStart(2,"0")}:${String(i).padStart(2,"0")}`:`${l(a)}:${String(i).padStart(2,"0")}`;const o=r.querySelector("#tk-timer");o==null||o.classList.toggle("tk-timer--warn",e<=3e5&&e>6e4),o==null||o.classList.toggle("tk-timer--danger",e<=6e4&&e>0),e===0&&!s.timeUp&&(s.timeUp=!0,clearInterval(k),T("انتهى الوقت المحدد للاختبار. يمكنك التسليم الآن، وقد يرفض الخادم الإجابات المتأخرة."))}function ot(){"IntersectionObserver"in window&&(p=new IntersectionObserver(t=>{const e=t.filter(n=>n.isIntersecting).sort((n,a)=>a.intersectionRatio-n.intersectionRatio)[0];e&&g(Number(e.target.dataset.index),!1)},{rootMargin:"-180px 0px -55% 0px",threshold:[0,.25,.5]}),r.querySelectorAll(".tk-q").forEach(t=>p.observe(t)))}function g(t,e){if(!s||t<0||t>=s.questions.length)return;s.current=t,r.querySelectorAll(".tk-q").forEach(a=>a.classList.toggle("is-current",Number(a.dataset.index)===t)),s.questions.forEach((a,i)=>{var o;return(o=M(i))==null?void 0:o.classList.toggle("is-current",i===t)});const n=r.querySelector("#tk-current-label");if(n&&(n.textContent=`السؤال ${l(t+1)} من ${l(s.questions.length)}`),e){const a=C(f(s.questions[t]));a==null||a.scrollIntoView({behavior:"smooth",block:"start"})}}function ct(){var a;const t=r.querySelector("#tk-modal");if(!t)return;const e=D(),n=t.querySelector("#tk-modal-counts");n&&(n.textContent=`أجبت عن ${l(e)} من ${l(s.questions.length)} سؤال، ولم تجب عن ${l(s.questions.length-e)} سؤال.`),t.hidden=!1,(a=t.querySelector('[data-action="cancel-submit"]'))==null||a.focus()}function P(){var e;const t=r.querySelector("#tk-modal");t&&(t.hidden=!0,(e=r.querySelector(".tk-submit"))==null||e.focus())}async function lt(){var e;if(!s||s.submitting)return;s.submitting=!0;const t=r.querySelector('[data-action="confirm-submit"]');t&&(t.disabled=!0,t.textContent="جارٍ التسليم…");try{await z();const n=await I("student_exam_submit",{p_attempt_id:s.attemptId});if(!n.ok)throw new Error(N(n,"تعذّر تسليم الاختبار. حاول مرة أخرى."));s.submitted=!0;try{sessionStorage.removeItem(q())}catch{}const a=((e=n.data)==null?void 0:e.attempt_id)??s.attemptId;location.href=`${A("pages/student/exam-result.html")}?attempt=${encodeURIComponent(a)}`}catch(n){s.submitting=!1,t&&(t.disabled=!1,t.textContent="تأكيد التسليم"),P(),T(String((n==null?void 0:n.message)||n),!1)}}async function dt(t){const e=t.target.closest("[data-action]");if(!e||!r.contains(e))return;const n=e.dataset.action;if(n==="retry"){await F();return}if(n==="retry-saves"){await z();return}if(n==="back"){location.href=A("pages/student/exams.html");return}s&&(n==="goto"?g(Number(e.dataset.index),!0):n==="prev"?g(Number(e.dataset.index)-1,!0):n==="next"?g(Number(e.dataset.index)+1,!0):n==="submit"?ct():n==="cancel-submit"?P():n==="confirm-submit"&&await lt())}function ut(t){const e=t.target.closest('input[data-field="choice"]');if(!e||!s)return;const n=e.dataset.qid,a=y(n);if(!a)return;const i=s.answers[n],o=Number(e.value);a.type==="multi"?(e.checked&&!i.choice_indices.includes(o)&&i.choice_indices.push(o),e.checked||(i.choice_indices=i.choice_indices.filter(d=>d!==o)),i.choice_indices.sort((d,m)=>d-m)):i.choice_index=o,$(n),H(),U(n)}function ft(t){const e=t.target.closest('textarea[data-field="text"]');if(!e||!s)return;const n=e.dataset.qid,a=s.answers[n];if(!a)return;a.text=e.value.slice(0,h);const i=r.querySelector(`[data-count="${n}"]`);i&&(i.textContent=`${l(a.text.length)} / ${l(h)}`),$(n),H(),U(n)}function pt(t){if(t.key==="Escape"){const e=r==null?void 0:r.querySelector("#tk-modal");e&&!e.hidden&&P()}}async function F(){if(k&&clearInterval(k),k=null,p==null||p.disconnect(),p=null,s=null,W(),!S){r.innerHTML=w({title:"لم يتم تحديد الاختبار",text:"افتح الاختبار من صفحة الاختبارات لبدء المحاولة.",retry:!1});return}const t=await I("student_exam_take",{p_exam_id:S});if(!t.ok){r.innerHTML=w({title:"تعذّر فتح الاختبار",text:N(t,"تعذّر تحميل الاختبار. حاول مرة أخرى.")});return}const e=t.data||{},n=Array.isArray(e.questions)?e.questions:[];if(!e.attempt_id||!n.length){r.innerHTML=w({title:"لا توجد أسئلة لعرضها",text:"هذا الاختبار لا يحتوي على أسئلة متاحة حالياً. راجع قائمة الاختبارات أو تواصل مع إدارة البوابة.",role:"status",retry:!1});return}const a={},i=new Set;n.forEach(o=>{const d=f(o);a[d]=J(o),b(o,a[d])&&i.add(d)}),s={attemptId:e.attempt_id,startedAt:e.attempt_started_at||null,exam:e.exam||{},questions:n,answers:a,saved:i,timers:new Map,pending:new Set,failed:new Set,current:0,dirty:!1,deadline:null,timeUp:!1,submitting:!1,submitted:!1},st()}X("student","أداء الاختبار",async({profile:t,content:e})=>{r=e,r.addEventListener("click",dt),r.addEventListener("change",ut),r.addEventListener("input",ft),document.addEventListener("keydown",pt),await F()});window.addEventListener("beforeunload",t=>{!s||s.submitted||!s.dirty||(t.preventDefault(),t.returnValue="")});

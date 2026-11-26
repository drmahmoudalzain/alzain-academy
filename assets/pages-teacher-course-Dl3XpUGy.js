import"./modulepreload-polyfill-B5Qt9EMX.js";import{b as L,s as k,e,d as c,a as r,i,c as f,r as H,f as m}from"./portal-CirgJEFP.js";import{c as h}from"./api-rUQmnFmR.js";import{p as _}from"./base-CLcZMpw2.js";import{$ as n,e as o,s as g,o as T}from"./common-PnjW3H2x.js";import"./identity-rules-DVz3p2Gs.js";import"https://esm.sh/@supabase/supabase-js@2";import"./first-visit-BDQ6DJqx.js";const p=Number(new URLSearchParams(location.search).get("id")),u={course:null,data:null},b={direct:{label:"مباشر",cls:"tdc-good"},online:{label:"أونلاين",cls:""},recorded:{label:"مسجل",cls:"tdc-muted"}},C=[{value:"bachelor",label:"بكالوريوس (عام)"},{value:"bachelor_m",label:"بكالوريوس — ذكور"},{value:"bachelor_f",label:"بكالوريوس — إناث"},{value:"equiv",label:"معادل"},{value:"external",label:"خارجي"},{value:"grad",label:"دراسات عليا"}],M=[{value:"1",label:"الأول"},{value:"2",label:"الثاني"},{value:"3",label:"الثالث"},{value:"4",label:"الرابع"}];function E(t){if(!t)return null;const s=new Date(t);return Number.isNaN(s.getTime())?null:s.toISOString()}function y(t,s){return s.length?`<div class="tt-table-wrap"><table class="tt-table">
    <thead><tr>${t.map(d=>`<th scope="col">${e(d)}</th>`).join("")}</tr></thead>
    <tbody>${s.join("")}</tbody></table></div>`:""}function q(t,s){return g(t.color),`<div class="tdc-hero-body">
    <div class="tdc-crumb"><a href="${_("pages/teacher/courses.html")}">مقرراتي</a> / تفاصيل المقرر</div>
    <div class="tdc-hero-main">
      <span class="tdc-code">${e(t.code||"—")}</span>
      <div class="tdc-hero-info">
        <div class="tdc-title-row">
          <h1>${e(t.title||"مقرر")}</h1>
          <span class="tdc-state ${t.archived?"tdc-off":""}">${t.archived?"مؤرشف":"نشط"}</span>
        </div>
        ${t.description?`<p class="tdc-desc">${e(t.description)}</p>`:""}
        <div class="tdc-meta">
          <span>${i("courses")}${e((C.find(d=>d.value===t.track)||{}).label||t.track||"—")}</span>
          <span>${i("grades")}المستوى ${e((M.find(d=>d.value===String(t.level))||{}).label||"—")}</span>
          <span>${i("calendar")}${e(f(t.created_at))}</span>
        </div>
      </div>
    </div>
  </div>
  <div class="tdc-actions">
    <button class="tt-btn" type="button" data-goto="assignments">${i("plus")}واجب جديد</button>
  </div>
  <div class="tdc-stats">
    <div class="tdc-stat"><span class="tdc-stat-value">${e(r(s.students))}</span><span class="tdc-stat-label">طالب</span></div>
    <div class="tdc-stat"><span class="tdc-stat-value">${e(r(s.lectures))}</span><span class="tdc-stat-label">محاضرة</span></div>
    <div class="tdc-stat"><span class="tdc-stat-value">${e(r(s.exams))}</span><span class="tdc-stat-label">اختبار</span></div>
    <div class="tdc-stat"><span class="tdc-stat-value">${e(r(s.assignments))}</span><span class="tdc-stat-label">واجب</span></div>
  </div>`}function x(t){const s=t.kind==="submission"?"file":t.kind==="enrollment"?"users":t.kind==="exam"?"exams":"lectures";return`<div class="tdc-row">
    <span class="tdc-item-icon">${i(s)}</span>
    <span class="tdc-row-body"><span class="tdc-row-title">${e(t.title||"نشاط")}</span><span class="tdc-row-sub">${e(t.detail||"")}</span></span>
    <span class="tdc-hint">${e(H(t.at))}</span>
  </div>`}function A(t){return`<div class="tdc-row">
    <span class="tdc-item-icon">${i("file")}</span>
    <span class="tdc-row-body">
      <span class="tdc-row-title">${e(t.student_name||"طالب")} — ${e(t.assignment_title||"واجب")}</span>
      <span class="tdc-row-sub">${e(m(t.submitted_at))} · ${e(t.feedback||"لا توجد ملاحظات")}</span>
    </span>
    <span class="tdc-badge ${t.points===null?"tdc-warn":"tdc-good"}">${t.points===null?"بانتظار التصحيح":`${e(c(t.points))}/${e(c(t.max_points))}`}</span>
    <span class="tdc-hint">التصحيح للإدارة</span>
  </div>`}function D(t){const s=b[t.lecture_type]||b.recorded;return`<article class="tdc-item">
    <div class="tdc-item-head">
      <h3>${e(t.title||"محاضرة")}</h3>
      <span class="tdc-badge ${s.cls}">${e(s.label)}</span>
    </div>
    ${t.description?`<p class="tdc-item-desc">${e(t.description)}</p>`:""}
    <div class="tdc-item-meta">
      <span>${i("calendar")}${e(m(t.scheduled_at))}</span>
      <span>${i("clock")}${e(r(t.duration_min))} دقيقة</span>
      <span>${i("users")}${e(r(t.attendance_count))} حاضر</span>
      <span>${i("file")}${e(r(t.questions_count))} سؤال</span>
    </div>
  </article>`}function P(t){return`<article class="tdc-item">
    <div class="tdc-item-head">
      <h3>${e(t.title||"اختبار")}</h3>
      <span class="tdc-badge ${t.is_published?"tdc-good":"tdc-muted"}">${t.is_published?"منشور":"مسودة"}</span>
    </div>
    ${t.description?`<p class="tdc-item-desc">${e(t.description)}</p>`:""}
    <div class="tdc-item-meta">
      <span>${i("calendar")}${e(m(t.starts_at))}</span>
      <span>${i("clock")}${e(t.duration_min?`${r(t.duration_min)} دقيقة`:"—")}</span>
      <span>${i("file")}${e(r(t.questions_count))} سؤال</span>
      <span>${i("users")}${e(r(t.attempts_count))} تسليم</span>
      <span>${i("grades")}${e(c(t.avg_score))} متوسط</span>
    </div>
  </article>`}function R(t){return`<article class="tdc-item">
    <div class="tdc-item-head">
      <h3>${e(t.title||"واجب")}</h3>
      <span class="tdc-badge">${e(c(t.max_points))} درجة</span>
    </div>
    ${t.description?`<p class="tdc-item-desc">${e(t.description)}</p>`:""}
    <div class="tdc-item-meta">
      <span>${i("calendar")}${e(m(t.due_at))}</span>
      <span>${i("users")}${e(r(t.submissions_count))} تسليم</span>
      <span>${i("checks")}${e(r(t.graded_count))} مُصحَّح</span>
      <span>${i("grades")}${e(c(t.avg_points))} متوسط</span>
    </div>
  </article>`}function N(t){const s=t.student_id??t.id;return`${_("pages/teacher/course.html")}?id=${encodeURIComponent(p)}&student=${encodeURIComponent(s)}`}function S(t){const s=n("#tdcStudentSearch").value.trim().toLowerCase(),d=t.filter(a=>!s||[a.name,a.platform_id,a.university_id,a.email].some(l=>String(l||"").toLowerCase().includes(s))).map(a=>{const l=N(a);return`<tr>
        <td><a class="tdc-student-link" href="${l}"><strong>${e(a.name)}</strong></a><br /><small>${e(a.platform_id||a.university_id||"—")}</small></td>
        <td>${e(c(a.exam_pct))}%</td><td>${e(c(a.attendance_pct))}%</td>
        <td>${e(c(a.assignment_pct))}%</td><td><strong>${e(c(a.final_pct))}%</strong></td>
        <td>${e(a.letter)}</td><td>${e(r(a.points))}</td>
        <td><a class="tt-btn" href="${l}">بيانات الطالب</a></td>
      </tr>`});n("#tdcStudents").innerHTML=y(["الطالب","الاختبارات","الحضور","الواجبات","النهائي","التقدير","النقاط","بيانات الطالب"],d)||o("لا طلاب مسجلين","تسجيل الطلاب من بوابة الإدارة.","users")}function j(t){const s=n("#tdcStudentDetails");if(!s)return;const d=new URLSearchParams(location.search).get("student"),a=d&&t.find(l=>String(l.id??l.student_id)===String(d));if(!a){s.hidden=!0;return}n("#tdcStudentDetailsBody").innerHTML=`<dl class="tdc-student-details">
    <div><dt>الاسم</dt><dd>${e(a.name||"—")}</dd></div>
    <div><dt>رمز المنصة</dt><dd dir="ltr">${e(a.platform_id||"—")}</dd></div>
    <div><dt>الرقم الجامعي</dt><dd dir="ltr">${e(a.university_id||"—")}</dd></div>
    <div><dt>البريد</dt><dd dir="ltr">${e(a.email||"—")}</dd></div>
    <div><dt>حالة التسجيل</dt><dd>${e(a.status==="active"?"نشط":"موقوف")}</dd></div>
    <div><dt>تاريخ التسجيل</dt><dd>${e(f(a.enrolled_at))}</dd></div>
    <div><dt>الاختبارات</dt><dd>${e(c(a.exam_pct))}%</dd></div>
    <div><dt>الحضور</dt><dd>${e(c(a.attendance_pct))}%</dd></div>
    <div><dt>الواجبات</dt><dd>${e(c(a.assignment_pct))}%</dd></div>
    <div><dt>الدرجة النهائية</dt><dd>${e(c(a.final_pct))}% · ${e(a.letter)}</dd></div>
    <div><dt>النقاط</dt><dd>${e(r(a.points))}</dd></div>
  </dl>`,s.hidden=!1}function U(t){const s=t.map(d=>`<tr>
    <td><strong>${e(d.name)}</strong><br /><small>${e(d.platform_id||"—")}</small></td>
    <td>${e(c(d.exam_pct))}%</td><td>${e(c(d.attendance_pct))}%</td>
    <td>${e(c(d.assignment_pct))}%</td><td><strong>${e(c(d.final_pct))}%</strong></td>
    <td>${e(d.letter)}</td><td>${e(r(d.points))}</td>
  </tr>`);n("#tdcGradebook").innerHTML=y(["الطالب","الاختبارات","الحضور","الواجبات","النهائي","التقدير","النقاط"],s)||o("لا درجات محسوبة","ستظهر الدرجات فور تسجيل الطلاب وإدخال نتائج التقييمات.","grades")}function I(){return{assignment:()=>T({title:"واجب جديد",fields:[{name:"title",label:"عنوان الواجب",required:!0},{name:"due_at",label:"موعد التسليم",type:"datetime-local"},{name:"max_points",label:"الدرجة القصوى",type:"number",value:10,min:.5,step:.5,required:!0},{name:"description",label:"الوصف",type:"textarea",fieldClass:"tt-field-wide"}],submitLabel:"إضافة الواجب",onSubmit:async t=>{const s=await h("teacher_create_assignment",{p_course_id:p,p_title:t.title,p_description:t.description||null,p_due_at:E(t.due_at),p_max_points:Number(t.max_points)});return s.ok?(await w(),{ok:!0,message:"تمت إضافة الواجب"}):{ok:!1,error:s.error}}})}}function $(t){document.querySelectorAll(".tdc-tab").forEach(s=>{const d=s.dataset.tab===t;s.classList.toggle("tdc-active",d),s.setAttribute("aria-selected",String(d))}),document.querySelectorAll(".tdc-pane").forEach(s=>{s.hidden=s.dataset.pane!==t})}async function w(){const t=await h("teacher_course_detail",{p_course_id:p});if(!t.ok){n("#tdcHero").innerHTML=o("تعذّر تحميل المقرر",t.error||"تحقّق من الاتصال ثم أعد المحاولة.","courses");return}const s=t.data||{};u.course=s.course||{},u.data=s;const d=s.stats||{};n("#tdcHero").innerHTML=q(u.course,d),n("#tdcHero").style.setProperty("--tdc-color",g(u.course.color)),n("#tdcTabs").hidden=!1,n("#tdcPanes").hidden=!1,new URLSearchParams(location.search).get("student")&&$("students"),document.querySelectorAll("[data-tab-count]").forEach(a=>{a.textContent=r(d[a.dataset.tabCount]??0)}),n("#tdcActivity").innerHTML=(s.activity||[]).length?(s.activity||[]).slice(0,10).map(x).join(""):o("لا نشاط بعد","ستظهر أحداث المقرر هنا فور تسجيل الطلاب أو إضافة المحتوى.","history"),n("#tdcPendingCount").textContent=`${r(d.pending)} بانتظار التصحيح — للإدارة`,n("#tdcSubmissions").innerHTML=(s.submissions||[]).length?(s.submissions||[]).map(A).join(""):o("لا تسليمات بعد","ستظهر تسليمات الطلاب هنا فور وصولها.","file"),S(s.students||[]),j(s.students||[]),U(s.gradebook||[]),n("#tdcLectures").innerHTML=(s.lectures||[]).length?(s.lectures||[]).map(D).join(""):o("لا محاضرات بعد","المحاضرات تُضاف من بوابة الإدارة.","lectures"),n("#tdcExams").innerHTML=(s.exams||[]).length?(s.exams||[]).map(P).join(""):o("لا اختبارات بعد","الاختبارات تُضاف من بوابة الإدارة.","exams"),n("#tdcAssignments").innerHTML=(s.assignments||[]).length?(s.assignments||[]).map(R).join(""):o("لا واجبات بعد","أضف واجبك الأول من زر «واجب جديد».","assignments")}L({portal:"teacher",title:"تفاصيل المقرر",render:async({content:t})=>{var d;if(!Number.isFinite(p)||p<=0){n("#tdcHero").innerHTML=o("مقرر غير محدد","افتح المقرر من صفحة مقرراتي.","courses");return}n("#tdcHero").innerHTML=k("hero",1);const s=I();t.addEventListener("click",a=>{const l=a.target.closest(".tdc-tab");if(l){$(l.dataset.tab);return}const v=a.target.closest("[data-goto]");if(v){$(v.dataset.goto);return}}),n("#tdcAddAssignment").addEventListener("click",s.assignment),n("#tdcStudentSearch").addEventListener("input",()=>{var a;return S(((a=u.data)==null?void 0:a.students)||[])}),(d=n("#tdcStudentDetailsClose"))==null||d.addEventListener("click",()=>{const a=new URL(location.href);a.searchParams.delete("student"),history.replaceState(history.state,"",`${a.pathname}${a.search}${a.hash}`),n("#tdcStudentDetails").hidden=!0}),await w()}});

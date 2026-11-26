import{p as y}from"./base-CCmrW03f.js";import{b as w,s as L,e as s,d as r,a as i,i as c,c as S,r as k,f as m}from"./portal-Dovf_Yw9.js";import{c as v}from"./api-a_g5aMSg.js";import{$ as d,e as l,s as f,o as T}from"./common-BFajHHnf.js";import"./auth-BSie1sbi.js";import"https://esm.sh/@supabase/supabase-js@2";const u=Number(new URLSearchParams(location.search).get("id")),o={course:null,data:null},$={direct:{label:"مباشر",cls:"tdc-good"},online:{label:"أونلاين",cls:""},recorded:{label:"مسجل",cls:"tdc-muted"}},H=[{value:"bachelor",label:"بكالوريوس (عام)"},{value:"bachelor_m",label:"بكالوريوس — ذكور"},{value:"bachelor_f",label:"بكالوريوس — إناث"},{value:"equiv",label:"معادل"},{value:"external",label:"خارجي"},{value:"grad",label:"دراسات عليا"}],C=[{value:"1",label:"الأول"},{value:"2",label:"الثاني"},{value:"3",label:"الثالث"},{value:"4",label:"الرابع"}];function M(t){if(!t)return null;const e=new Date(t);return Number.isNaN(e.getTime())?null:e.toISOString()}function _(t,e){return e.length?`<div class="tt-table-wrap"><table class="tt-table">
    <thead><tr>${t.map(a=>`<th scope="col">${s(a)}</th>`).join("")}</tr></thead>
    <tbody>${e.join("")}</tbody></table></div>`:""}function E(t,e){return f(t.color),`<div class="tdc-hero-body">
    <div class="tdc-crumb"><a href="${y("pages/teacher/courses.html")}">مقرراتي</a> / تفاصيل المقرر</div>
    <div class="tdc-hero-main">
      <span class="tdc-code">${s(t.code||"—")}</span>
      <div class="tdc-hero-info">
        <div class="tdc-title-row">
          <h1>${s(t.title||"مقرر")}</h1>
          <span class="tdc-state ${t.archived?"tdc-off":""}">${t.archived?"مؤرشف":"نشط"}</span>
        </div>
        ${t.description?`<p class="tdc-desc">${s(t.description)}</p>`:""}
        <div class="tdc-meta">
          <span>${c("courses")}${s((H.find(a=>a.value===t.track)||{}).label||t.track||"—")}</span>
          <span>${c("grades")}المستوى ${s((C.find(a=>a.value===String(t.level))||{}).label||"—")}</span>
          <span>${c("calendar")}${s(S(t.created_at))}</span>
        </div>
      </div>
    </div>
  </div>
  <div class="tdc-actions">
    <button class="tt-btn" type="button" data-goto="assignments">${c("plus")}واجب جديد</button>
  </div>
  <div class="tdc-stats">
    <div class="tdc-stat"><span class="tdc-stat-value">${s(i(e.students))}</span><span class="tdc-stat-label">طالب</span></div>
    <div class="tdc-stat"><span class="tdc-stat-value">${s(i(e.lectures))}</span><span class="tdc-stat-label">محاضرة</span></div>
    <div class="tdc-stat"><span class="tdc-stat-value">${s(i(e.exams))}</span><span class="tdc-stat-label">اختبار</span></div>
    <div class="tdc-stat"><span class="tdc-stat-value">${s(i(e.assignments))}</span><span class="tdc-stat-label">واجب</span></div>
  </div>`}function q(t){const e=t.kind==="submission"?"file":t.kind==="enrollment"?"users":t.kind==="exam"?"exams":"lectures";return`<div class="tdc-row">
    <span class="tdc-item-icon">${c(e)}</span>
    <span class="tdc-row-body"><span class="tdc-row-title">${s(t.title||"نشاط")}</span><span class="tdc-row-sub">${s(t.detail||"")}</span></span>
    <span class="tdc-hint">${s(k(t.at))}</span>
  </div>`}function x(t){return`<div class="tdc-row">
    <span class="tdc-item-icon">${c("file")}</span>
    <span class="tdc-row-body">
      <span class="tdc-row-title">${s(t.student_name||"طالب")} — ${s(t.assignment_title||"واجب")}</span>
      <span class="tdc-row-sub">${s(m(t.submitted_at))} · ${s(t.feedback||"لا توجد ملاحظات")}</span>
    </span>
    <span class="tdc-badge ${t.points===null?"tdc-warn":"tdc-good"}">${t.points===null?"بانتظار التصحيح":`${s(r(t.points))}/${s(r(t.max_points))}`}</span>
    <span class="tdc-hint">التصحيح للإدارة</span>
  </div>`}function A(t){const e=$[t.lecture_type]||$.recorded;return`<article class="tdc-item">
    <div class="tdc-item-head">
      <h3>${s(t.title||"محاضرة")}</h3>
      <span class="tdc-badge ${e.cls}">${s(e.label)}</span>
    </div>
    ${t.description?`<p class="tdc-item-desc">${s(t.description)}</p>`:""}
    <div class="tdc-item-meta">
      <span>${c("calendar")}${s(m(t.scheduled_at))}</span>
      <span>${c("clock")}${s(i(t.duration_min))} دقيقة</span>
      <span>${c("users")}${s(i(t.attendance_count))} حاضر</span>
      <span>${c("file")}${s(i(t.questions_count))} سؤال</span>
    </div>
  </article>`}function N(t){return`<article class="tdc-item">
    <div class="tdc-item-head">
      <h3>${s(t.title||"اختبار")}</h3>
      <span class="tdc-badge ${t.is_published?"tdc-good":"tdc-muted"}">${t.is_published?"منشور":"مسودة"}</span>
    </div>
    ${t.description?`<p class="tdc-item-desc">${s(t.description)}</p>`:""}
    <div class="tdc-item-meta">
      <span>${c("calendar")}${s(m(t.starts_at))}</span>
      <span>${c("clock")}${s(t.duration_min?`${i(t.duration_min)} دقيقة`:"—")}</span>
      <span>${c("file")}${s(i(t.questions_count))} سؤال</span>
      <span>${c("users")}${s(i(t.attempts_count))} تسليم</span>
      <span>${c("grades")}${s(r(t.avg_score))} متوسط</span>
    </div>
  </article>`}function j(t){return`<article class="tdc-item">
    <div class="tdc-item-head">
      <h3>${s(t.title||"واجب")}</h3>
      <span class="tdc-badge">${s(r(t.max_points))} درجة</span>
    </div>
    ${t.description?`<p class="tdc-item-desc">${s(t.description)}</p>`:""}
    <div class="tdc-item-meta">
      <span>${c("calendar")}${s(m(t.due_at))}</span>
      <span>${c("users")}${s(i(t.submissions_count))} تسليم</span>
      <span>${c("checks")}${s(i(t.graded_count))} مُصحَّح</span>
      <span>${c("grades")}${s(r(t.avg_points))} متوسط</span>
    </div>
  </article>`}function g(t){const e=d("#tdcStudentSearch").value.trim().toLowerCase(),a=t.filter(n=>!e||[n.name,n.platform_id,n.university_id,n.email].some(p=>String(p||"").toLowerCase().includes(e))).map(n=>`<tr>
      <td><strong>${s(n.name)}</strong><br /><small>${s(n.platform_id||n.university_id||"—")}</small></td>
      <td>${s(r(n.exam_pct))}%</td><td>${s(r(n.attendance_pct))}%</td>
      <td>${s(r(n.assignment_pct))}%</td><td><strong>${s(r(n.final_pct))}%</strong></td>
      <td>${s(n.letter)}</td><td>${s(i(n.points))}</td>
    </tr>`);d("#tdcStudents").innerHTML=_(["الطالب","الاختبارات","الحضور","الواجبات","النهائي","التقدير","النقاط"],a)||l("لا طلاب مسجلين","تسجيل الطلاب من بوابة الإدارة.","users")}function P(t){const e=t.map(a=>`<tr>
    <td><strong>${s(a.name)}</strong><br /><small>${s(a.platform_id||"—")}</small></td>
    <td>${s(r(a.exam_pct))}%</td><td>${s(r(a.attendance_pct))}%</td>
    <td>${s(r(a.assignment_pct))}%</td><td><strong>${s(r(a.final_pct))}%</strong></td>
    <td>${s(a.letter)}</td><td>${s(i(a.points))}</td>
  </tr>`);d("#tdcGradebook").innerHTML=_(["الطالب","الاختبارات","الحضور","الواجبات","النهائي","التقدير","النقاط"],e)||l("لا درجات محسوبة","ستظهر الدرجات فور تسجيل الطلاب وإدخال نتائج التقييمات.","grades")}function R(){return{assignment:()=>T({title:"واجب جديد",fields:[{name:"title",label:"عنوان الواجب",required:!0},{name:"due_at",label:"موعد التسليم",type:"datetime-local"},{name:"max_points",label:"الدرجة القصوى",type:"number",value:10,min:.5,step:.5,required:!0},{name:"description",label:"الوصف",type:"textarea",fieldClass:"tt-field-wide"}],submitLabel:"إضافة الواجب",onSubmit:async t=>{const e=await v("teacher_create_assignment",{p_course_id:u,p_title:t.title,p_description:t.description||null,p_due_at:M(t.due_at),p_max_points:Number(t.max_points)});return e.ok?(await h(),{ok:!0,message:"تمت إضافة الواجب"}):{ok:!1,error:e.error}}})}}function b(t){document.querySelectorAll(".tdc-tab").forEach(e=>{const a=e.dataset.tab===t;e.classList.toggle("tdc-active",a),e.setAttribute("aria-selected",String(a))}),document.querySelectorAll(".tdc-pane").forEach(e=>{e.hidden=e.dataset.pane!==t})}async function h(){const t=await v("teacher_course_detail",{p_course_id:u});if(!t.ok){d("#tdcHero").innerHTML=l("تعذّر تحميل المقرر",t.error||"تحقّق من الاتصال ثم أعد المحاولة.","courses");return}const e=t.data||{};o.course=e.course||{},o.data=e;const a=e.stats||{};d("#tdcHero").innerHTML=E(o.course,a),d("#tdcHero").style.setProperty("--tdc-color",f(o.course.color)),d("#tdcTabs").hidden=!1,d("#tdcPanes").hidden=!1,document.querySelectorAll("[data-tab-count]").forEach(n=>{n.textContent=i(a[n.dataset.tabCount]??0)}),d("#tdcActivity").innerHTML=(e.activity||[]).length?(e.activity||[]).slice(0,10).map(q).join(""):l("لا نشاط بعد","ستظهر أحداث المقرر هنا فور تسجيل الطلاب أو إضافة المحتوى.","history"),d("#tdcPendingCount").textContent=`${i(a.pending)} بانتظار التصحيح — للإدارة`,d("#tdcSubmissions").innerHTML=(e.submissions||[]).length?(e.submissions||[]).map(x).join(""):l("لا تسليمات بعد","ستظهر تسليمات الطلاب هنا فور وصولها.","file"),g(e.students||[]),P(e.gradebook||[]),d("#tdcLectures").innerHTML=(e.lectures||[]).length?(e.lectures||[]).map(A).join(""):l("لا محاضرات بعد","المحاضرات تُضاف من بوابة الإدارة.","lectures"),d("#tdcExams").innerHTML=(e.exams||[]).length?(e.exams||[]).map(N).join(""):l("لا اختبارات بعد","الاختبارات تُضاف من بوابة الإدارة.","exams"),d("#tdcAssignments").innerHTML=(e.assignments||[]).length?(e.assignments||[]).map(j).join(""):l("لا واجبات بعد","أضف واجبك الأول من زر «واجب جديد».","assignments")}w({portal:"teacher",title:"تفاصيل المقرر",render:async({content:t})=>{if(!Number.isFinite(u)||u<=0){d("#tdcHero").innerHTML=l("مقرر غير محدد","افتح المقرر من صفحة مقرراتي.","courses");return}d("#tdcHero").innerHTML=L("hero",1);const e=R();t.addEventListener("click",a=>{const n=a.target.closest(".tdc-tab");if(n){b(n.dataset.tab);return}const p=a.target.closest("[data-goto]");if(p){b(p.dataset.goto);return}}),d("#tdcAddAssignment").addEventListener("click",e.assignment),d("#tdcStudentSearch").addEventListener("input",()=>{var a;return g(((a=o.data)==null?void 0:a.students)||[])}),await h()}});

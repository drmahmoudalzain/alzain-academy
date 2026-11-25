import"./modulepreload-polyfill-B5Qt9EMX.js";import{b as C,s as H,c as r,e as a,d,i,a as A,r as M,f as y}from"./portal-CrSS4adt.js";import{c as u}from"./api-DvV83kVs.js";import{p as j}from"./auth-CiwDk5OQ.js";import{$ as l,e as o,t as w,o as _,s as S}from"./common-DkBGqTQQ.js";import"https://esm.sh/@supabase/supabase-js@2";const m=Number(new URLSearchParams(location.search).get("id")),f={course:null,data:null},L={direct:{label:"مباشر",cls:"tdc-good"},online:{label:"أونلاين",cls:""},recorded:{label:"مسجل",cls:"tdc-muted"}},q=[{value:"bachelor",label:"بكالوريوس (عام)"},{value:"bachelor_m",label:"بكالوريوس — ذكور"},{value:"bachelor_f",label:"بكالوريوس — إناث"},{value:"equiv",label:"معادل"},{value:"external",label:"خارجي"},{value:"grad",label:"دراسات عليا"}],E=[{value:"1",label:"الأول"},{value:"2",label:"الثاني"},{value:"3",label:"الثالث"},{value:"4",label:"الرابع"}];function h(e){if(!e)return null;const t=new Date(e);return Number.isNaN(t.getTime())?null:t.toISOString()}function N(e,t){return t.length?`<div class="tt-table-wrap"><table class="tt-table">
    <thead><tr>${e.map(s=>`<th scope="col">${a(s)}</th>`).join("")}</tr></thead>
    <tbody>${t.join("")}</tbody></table></div>`:""}function P(e,t){return S(e.color),`<div class="tdc-hero-body">
    <div class="tdc-crumb"><a href="${j("pages/teacher/courses.html")}">مقرراتي</a> / تفاصيل المقرر</div>
    <div class="tdc-hero-main">
      <span class="tdc-code">${a(e.code||"—")}</span>
      <div class="tdc-hero-info">
        <div class="tdc-title-row">
          <h1>${a(e.title||"مقرر")}</h1>
          <span class="tdc-state ${e.archived?"tdc-off":""}">${e.archived?"مؤرشف":"نشط"}</span>
        </div>
        ${e.description?`<p class="tdc-desc">${a(e.description)}</p>`:""}
        <div class="tdc-meta">
          <span>${i("courses")}${a((q.find(s=>s.value===e.track)||{}).label||e.track||"—")}</span>
          <span>${i("grades")}المستوى ${a((E.find(s=>s.value===String(e.level))||{}).label||"—")}</span>
          <span>${i("calendar")}${a(A(e.created_at))}</span>
        </div>
      </div>
    </div>
  </div>
  <div class="tdc-actions">
    <button class="tt-btn" type="button" id="tdcEdit">${i("edit")}تعديل المقرر</button>
    <button class="tt-btn" type="button" data-goto="lectures">${i("plus")}محاضرة جديدة</button>
    <button class="tt-btn" type="button" data-goto="students">${i("users")}إضافة طالب</button>
  </div>
  <div class="tdc-stats">
    <div class="tdc-stat"><span class="tdc-stat-value">${a(r(t.students))}</span><span class="tdc-stat-label">طالب</span></div>
    <div class="tdc-stat"><span class="tdc-stat-value">${a(r(t.lectures))}</span><span class="tdc-stat-label">محاضرة</span></div>
    <div class="tdc-stat"><span class="tdc-stat-value">${a(r(t.exams))}</span><span class="tdc-stat-label">اختبار</span></div>
    <div class="tdc-stat"><span class="tdc-stat-value">${a(r(t.assignments))}</span><span class="tdc-stat-label">واجب</span></div>
  </div>`}function R(e){const t=e.kind==="submission"?"file":e.kind==="enrollment"?"users":e.kind==="exam"?"exams":"lectures";return`<div class="tdc-row">
    <span class="tdc-item-icon">${i(t)}</span>
    <span class="tdc-row-body"><span class="tdc-row-title">${a(e.title||"نشاط")}</span><span class="tdc-row-sub">${a(e.detail||"")}</span></span>
    <span class="tdc-hint">${a(M(e.at))}</span>
  </div>`}function D(e){return`<div class="tdc-row">
    <span class="tdc-item-icon">${i("file")}</span>
    <span class="tdc-row-body">
      <span class="tdc-row-title">${a(e.student_name||"طالب")} — ${a(e.assignment_title||"واجب")}</span>
      <span class="tdc-row-sub">${a(y(e.submitted_at))} · ${a(e.feedback||"لا توجد ملاحظات")}</span>
    </span>
    <span class="tdc-badge ${e.points===null?"tdc-warn":"tdc-good"}">${e.points===null?"بانتظار التصحيح":`${a(d(e.points))}/${a(d(e.max_points))}`}</span>
    <button class="tt-btn tt-btn-ghost" type="button" data-grade="${a(e.id)}"
      data-name="${a(e.student_name||"الطالب")}" data-title="${a(e.assignment_title||"الواجب")}"
      data-max="${a(e.max_points??10)}" data-points="${e.points??""}" data-feedback="${a(e.feedback||"")}">${e.points===null?"تصحيح":"تعديل"}</button>
  </div>`}function G(e){const t=L[e.lecture_type]||L.recorded;return`<article class="tdc-item">
    <div class="tdc-item-head">
      <h3>${a(e.title||"محاضرة")}</h3>
      <span class="tdc-badge ${t.cls}">${a(t.label)}</span>
    </div>
    ${e.description?`<p class="tdc-item-desc">${a(e.description)}</p>`:""}
    <div class="tdc-item-meta">
      <span>${i("calendar")}${a(y(e.scheduled_at))}</span>
      <span>${i("clock")}${a(r(e.duration_min))} دقيقة</span>
      <span>${i("users")}${a(r(e.attendance_count))} حاضر</span>
      <span>${i("file")}${a(r(e.questions_count))} سؤال</span>
    </div>
    <div class="tdc-item-actions">
      <button class="tt-btn tt-btn-secondary" type="button" data-attendance="${a(e.id)}" data-open="${e.attendance_open?"1":"0"}">
        ${i(e.attendance_open?"close":"check")}${e.attendance_open?"إغلاق الحضور":"فتح الحضور"}
      </button>
    </div>
  </article>`}function F(e){return`<article class="tdc-item">
    <div class="tdc-item-head">
      <h3>${a(e.title||"اختبار")}</h3>
      <span class="tdc-badge ${e.is_published?"tdc-good":"tdc-muted"}">${e.is_published?"منشور":"مسودة"}</span>
    </div>
    ${e.description?`<p class="tdc-item-desc">${a(e.description)}</p>`:""}
    <div class="tdc-item-meta">
      <span>${i("calendar")}${a(y(e.starts_at))}</span>
      <span>${i("clock")}${a(e.duration_min?`${r(e.duration_min)} دقيقة`:"—")}</span>
      <span>${i("file")}${a(r(e.questions_count))} سؤال</span>
      <span>${i("users")}${a(r(e.attempts_count))} تسليم</span>
      <span>${i("grades")}${a(d(e.avg_score))} متوسط</span>
    </div>
  </article>`}function O(e){return`<article class="tdc-item">
    <div class="tdc-item-head">
      <h3>${a(e.title||"واجب")}</h3>
      <span class="tdc-badge">${a(d(e.max_points))} درجة</span>
    </div>
    ${e.description?`<p class="tdc-item-desc">${a(e.description)}</p>`:""}
    <div class="tdc-item-meta">
      <span>${i("calendar")}${a(y(e.due_at))}</span>
      <span>${i("users")}${a(r(e.submissions_count))} تسليم</span>
      <span>${i("checks")}${a(r(e.graded_count))} مُصحَّح</span>
      <span>${i("grades")}${a(d(e.avg_points))} متوسط</span>
    </div>
  </article>`}function T(e){const t=l("#tdcStudentSearch").value.trim().toLowerCase(),s=e.filter(n=>!t||[n.name,n.platform_id,n.university_id,n.email].some(b=>String(b||"").toLowerCase().includes(t))).map(n=>`<tr>
      <td><strong>${a(n.name)}</strong><br /><small>${a(n.platform_id||n.university_id||"—")}</small></td>
      <td>${a(d(n.exam_pct))}%</td><td>${a(d(n.attendance_pct))}%</td>
      <td>${a(d(n.assignment_pct))}%</td><td><strong>${a(d(n.final_pct))}%</strong></td>
      <td>${a(n.letter)}</td><td>${a(r(n.points))}</td>
    </tr>`);l("#tdcStudents").innerHTML=N(["الطالب","الاختبارات","الحضور","الواجبات","النهائي","التقدير","النقاط"],s)||o("لا طلاب مسجلين","أضف طالباً باستخدام زر «إضافة طالب».","users")}function I(e){const t=e.map(s=>`<tr>
    <td><strong>${a(s.name)}</strong><br /><small>${a(s.platform_id||"—")}</small></td>
    <td>${a(d(s.exam_pct))}%</td><td>${a(d(s.attendance_pct))}%</td>
    <td>${a(d(s.assignment_pct))}%</td><td><strong>${a(d(s.final_pct))}%</strong></td>
    <td>${a(s.letter)}</td><td>${a(r(s.points))}</td>
  </tr>`);l("#tdcGradebook").innerHTML=N(["الطالب","الاختبارات","الحضور","الواجبات","النهائي","التقدير","النقاط"],t)||o("لا درجات محسوبة","ستظهر الدرجات فور تسجيل الطلاب وإدخال نتائج التقييمات.","grades")}function K(e,t,s,n,b,c){_({title:b===""?"تصحيح تسليم":"تعديل الدرجة",intro:`${t} — ${s}`,fields:[{name:"points",label:`الدرجة (من ${n})`,type:"number",min:0,max:Number(n)||0,step:"0.5",value:b,required:!0},{name:"feedback",label:"ملاحظات للطالب",type:"textarea",value:c,fieldClass:"tt-field-wide"}],submitLabel:"حفظ الدرجة",onSubmit:async $=>{const v=await u("teacher_grade_submission",{p_submission_id:Number(e),p_points:Number($.points),p_feedback:$.feedback||null});return v.ok?(await p(),{ok:!0,message:"تم حفظ الدرجة"}):{ok:!1,error:v.error}}})}function U(){const e=f.course||{};return{edit:()=>_({title:"تعديل المقرر",fields:[{name:"title",label:"عنوان المقرر",value:e.title||"",required:!0},{name:"description",label:"الوصف",type:"textarea",value:e.description||"",fieldClass:"tt-field-wide"},{name:"track",label:"المسار",type:"select",value:e.track||"bachelor_m",options:q},{name:"level",label:"المستوى",type:"select",value:e.level?String(e.level):"1",options:E},{name:"color",label:"اللون",type:"color",value:e.color||"#123A63"},{name:"archived",label:"الحالة",type:"select",value:e.archived?"1":"0",options:[{value:"0",label:"نشط"},{value:"1",label:"مؤرشف"}]},{name:"attendance_weight",label:"وزن الحضور %",type:"number",value:e.attendance_weight??10,required:!0},{name:"exams_weight",label:"وزن الاختبارات %",type:"number",value:e.exams_weight??60,required:!0},{name:"assignments_weight",label:"وزن الواجبات %",type:"number",value:e.assignments_weight??30,required:!0,hint:"المجموع = 100"}],submitLabel:"حفظ التعديلات",onSubmit:async t=>{const s=await u("teacher_update_course",{p_course_id:m,p_title:t.title,p_description:t.description||null,p_color:t.color,p_archived:t.archived==="1",p_track:t.track,p_level:Number(t.level),p_attendance_weight:Number(t.attendance_weight),p_exams_weight:Number(t.exams_weight),p_assignments_weight:Number(t.assignments_weight)});return s.ok?(await p(),{ok:!0,message:"تم حفظ التعديلات"}):{ok:!1,error:s.error}}}),lecture:()=>_({title:"محاضرة جديدة",fields:[{name:"title",label:"عنوان المحاضرة",required:!0},{name:"lecture_type",label:"النوع",type:"select",value:"direct",options:[{value:"direct",label:"مباشر"},{value:"online",label:"أونلاين"},{value:"recorded",label:"مسجل"}]},{name:"scheduled_at",label:"الموعد",type:"datetime-local"},{name:"duration_min",label:"المدة (دقيقة)",type:"number",value:120,min:1},{name:"description",label:"الوصف",type:"textarea",fieldClass:"tt-field-wide"},{name:"youtube_url",label:"رابط يوتيوب"},{name:"live_url",label:"رابط البث"}],submitLabel:"إضافة المحاضرة",onSubmit:async t=>{const s=await u("teacher_add_lecture",{p_course_id:m,p_title:t.title,p_description:t.description||null,p_lecture_type:t.lecture_type,p_scheduled_at:h(t.scheduled_at),p_duration_min:Number(t.duration_min)||120,p_youtube_url:t.youtube_url||null,p_live_url:t.live_url||null});return s.ok?(await p(),{ok:!0,message:"تمت إضافة المحاضرة"}):{ok:!1,error:s.error}}}),exam:()=>_({title:"اختبار جديد",fields:[{name:"title",label:"عنوان الاختبار",required:!0},{name:"exam_kind",label:"النوع",type:"select",value:"exam",options:[{value:"exam",label:"اختبار"},{value:"assignment",label:"واجب كاختبار"}]},{name:"starts_at",label:"وقت البدء",type:"datetime-local"},{name:"ends_at",label:"وقت الانتهاء",type:"datetime-local"},{name:"duration_min",label:"المدة (دقيقة)",type:"number",min:1},{name:"is_published",label:"الحالة",type:"select",value:"0",options:[{value:"0",label:"مسودة"},{value:"1",label:"منشور"}]},{name:"description",label:"الوصف",type:"textarea",fieldClass:"tt-field-wide"}],submitLabel:"إضافة الاختبار",onSubmit:async t=>{const s=await u("teacher_create_exam",{p_course_id:m,p_title:t.title,p_description:t.description||null,p_exam_kind:t.exam_kind,p_starts_at:h(t.starts_at),p_ends_at:h(t.ends_at),p_duration_min:t.duration_min?Number(t.duration_min):null,p_is_published:t.is_published==="1"});return s.ok?(await p(),{ok:!0,message:"تمت إضافة الاختبار"}):{ok:!1,error:s.error}}}),assignment:()=>_({title:"واجب جديد",fields:[{name:"title",label:"عنوان الواجب",required:!0},{name:"due_at",label:"موعد التسليم",type:"datetime-local"},{name:"max_points",label:"الدرجة القصوى",type:"number",value:10,min:.5,step:.5,required:!0},{name:"description",label:"الوصف",type:"textarea",fieldClass:"tt-field-wide"}],submitLabel:"إضافة الواجب",onSubmit:async t=>{const s=await u("teacher_create_assignment",{p_course_id:m,p_title:t.title,p_description:t.description||null,p_due_at:h(t.due_at),p_max_points:Number(t.max_points)});return s.ok?(await p(),{ok:!0,message:"تمت إضافة الواجب"}):{ok:!1,error:s.error}}}),enroll:()=>_({title:"إضافة طالب",intro:"أدخل بريد الطالب أو رقمه الجامعي أو رمزه على المنصة.",fields:[{name:"identifier",label:"معرّف الطالب",required:!0}],submitLabel:"إضافة إلى المقرر",onSubmit:async t=>{var n;const s=await u("teacher_enroll_student",{p_course_id:m,p_identifier:t.identifier});return s.ok?(await p(),{ok:!0,message:`تمت إضافة ${((n=s.data)==null?void 0:n.name)||"الطالب"}`}):{ok:!1,error:s.error}}})}}function x(e){document.querySelectorAll(".tdc-tab").forEach(t=>{const s=t.dataset.tab===e;t.classList.toggle("tdc-active",s),t.setAttribute("aria-selected",String(s))}),document.querySelectorAll(".tdc-pane").forEach(t=>{t.hidden=t.dataset.pane!==e})}async function p(){const e=await u("teacher_course_detail",{p_course_id:m});if(!e.ok){l("#tdcHero").innerHTML=o("تعذّر تحميل المقرر",e.error||"تحقّق من الاتصال ثم أعد المحاولة.","courses");return}const t=e.data||{};f.course=t.course||{},f.data=t;const s=t.stats||{};l("#tdcHero").innerHTML=P(f.course,s),l("#tdcHero").style.setProperty("--tdc-color",S(f.course.color)),l("#tdcTabs").hidden=!1,l("#tdcPanes").hidden=!1,document.querySelectorAll("[data-tab-count]").forEach(n=>{n.textContent=r(s[n.dataset.tabCount]??0)}),l("#tdcActivity").innerHTML=(t.activity||[]).length?(t.activity||[]).slice(0,10).map(R).join(""):o("لا نشاط بعد","ستظهر أحداث المقرر هنا فور تسجيل الطلاب أو إضافة المحتوى.","history"),l("#tdcPendingCount").textContent=`${r(s.pending)} بانتظار التصحيح`,l("#tdcSubmissions").innerHTML=(t.submissions||[]).length?(t.submissions||[]).map(D).join(""):o("لا تسليمات بعد","ستظهر تسليمات الطلاب هنا فور وصولها.","file"),T(t.students||[]),I(t.gradebook||[]),l("#tdcLectures").innerHTML=(t.lectures||[]).length?(t.lectures||[]).map(G).join(""):o("لا محاضرات بعد","أضف محاضرتك الأولى من زر «محاضرة جديدة».","lectures"),l("#tdcExams").innerHTML=(t.exams||[]).length?(t.exams||[]).map(F).join(""):o("لا اختبارات بعد","أضف اختبارك الأول من زر «اختبار جديد».","exams"),l("#tdcAssignments").innerHTML=(t.assignments||[]).length?(t.assignments||[]).map(O).join(""):o("لا واجبات بعد","أضف واجبك الأول من زر «واجب جديد».","assignments")}C({portal:"teacher",title:"تفاصيل المقرر",render:async({content:e})=>{if(!Number.isFinite(m)||m<=0){l("#tdcHero").innerHTML=o("مقرر غير محدد","افتح المقرر من صفحة مقرراتي.","courses");return}l("#tdcHero").innerHTML=H("hero",1);const t=U();e.addEventListener("click",s=>{const n=s.target.closest(".tdc-tab");if(n){x(n.dataset.tab);return}const b=s.target.closest("[data-goto]");if(b){x(b.dataset.goto);return}const c=s.target.closest("[data-grade]");if(c){K(c.dataset.grade,c.dataset.name,c.dataset.title,c.dataset.max,c.dataset.points,c.dataset.feedback);return}const $=s.target.closest("[data-attendance]");if($){const v=Number($.dataset.attendance);$.dataset.open==="1"?u("teacher_set_attendance",{p_lecture_id:v,p_open:!1}).then(g=>{g.ok?(w("تم إغلاق باب الحضور"),p()):w(g.error,"error")}):_({title:"فتح باب الحضور",intro:"سيظهر رمز الحضور للطلاب المسجلين في المقرر.",fields:[{name:"code",label:"رمز الحضور",required:!0,placeholder:"مثال: 4821"}],submitLabel:"فتح الحضور",onSubmit:async g=>{const k=await u("teacher_set_attendance",{p_lecture_id:v,p_open:!0,p_code:g.code});return k.ok?(await p(),{ok:!0,message:"تم فتح باب الحضور"}):{ok:!1,error:k.error}}})}}),e.addEventListener("click",s=>{s.target.closest("#tdcEdit")&&t.edit()}),l("#tdcEnroll").addEventListener("click",t.enroll),l("#tdcAddLecture").addEventListener("click",t.lecture),l("#tdcAddExam").addEventListener("click",t.exam),l("#tdcAddAssignment").addEventListener("click",t.assignment),l("#tdcStudentSearch").addEventListener("input",()=>{var s;return T(((s=f.data)==null?void 0:s.students)||[])}),await p()}});

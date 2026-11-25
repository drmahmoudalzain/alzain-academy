import"./modulepreload-polyfill-B5Qt9EMX.js";import{b as v,s as l,c as o,i as p,e as s,f as b,r as g}from"./portal-uUs1xKsy.js";import{c as f}from"./api-CE-Y1P0n.js";import{p as h}from"./auth-DJQIbBRA.js";import{$ as a,e as m,o as x,s as L,i as y}from"./common-CEuVcXlT.js";import"https://esm.sh/@supabase/supabase-js@2";function u(t,n,e,i,r=""){return`<div class="td-stat ${r}">
    <span class="td-stat-icon">${p(i)}</span>
    <span class="td-stat-label">${s(t)}</span>
    <span class="td-stat-value">${s(o(n))}<small>${s(e)}</small></span>
  </div>`}function C(t){const n=L(t.color),e=`${h("pages/teacher/course.html")}?id=${encodeURIComponent(t.id)}`;return`<a class="td-course" style="--td-color:${n}" href="${s(e)}">
    <span class="td-course-mark">${s(y(t.code))}</span>
    <span class="td-course-body">
      <span class="td-course-title">${s(t.title||"مقرر")} <span class="td-badge">${s(t.code||"—")}</span></span>
      <span class="td-course-sub">${o(t.students)} طالب · ${o(t.lectures)} محاضرة · ${o(t.exams)} اختبار${t.pending?` · ${o(t.pending)} بانتظار التصحيح`:""}</span>
    </span>
    <span class="td-course-arrow">${p("chevron")}</span>
  </a>`}function T(t){const n=[t.course_code,t.course_title].filter(Boolean).join(" — ");return`<div class="td-item">
    <span class="td-item-icon">${p("file")}</span>
    <span class="td-item-body">
      <span class="td-item-title">${s(t.student_name||"طالب")} — ${s(t.assignment_title||"واجب")}</span>
      <span class="td-item-sub">${s(n)} · ${s(b(t.submitted_at))}${t.submitted_at?` · ${s(g(t.submitted_at))}`:""}</span>
    </span>
    <button class="tt-btn tt-btn-ghost" type="button" data-grade="${s(t.id)}"
      data-name="${s(t.student_name||"الطالب")}" data-title="${s(t.assignment_title||"الواجب")}"
      data-max="${s(t.max_points??10)}">تصحيح</button>
  </div>`}function H(t){const n=t.kind==="exam";return`<div class="td-item">
    <span class="td-item-icon">${p(n?"exams":"lectures")}</span>
    <span class="td-item-body">
      <span class="td-item-title">${s(t.title||(n?"اختبار":"محاضرة"))} <span class="td-badge ${n?"td-exam":""}">${n?"اختبار":"محاضرة"}</span></span>
      <span class="td-item-sub">${s([t.course_code,t.course_title].filter(Boolean).join(" — "))}</span>
    </span>
    <span class="td-item-time">${s(b(t.at))}<br />${s(g(t.at))}</span>
  </div>`}function M(t){a("tdIntro").textContent="تعذّر تحميل بيانات لوحة التحكم.",a("tdStats").innerHTML="",a("tdCourses").innerHTML=m("لا يمكن عرض المقررات",t,"courses"),a("tdSubmissions").innerHTML="",a("tdSchedule").innerHTML="",a("tdPendingCount").textContent="—"}async function S(t,n,e,i){x({title:"تصحيح تسليم",intro:`${n} — ${e}`,fields:[{name:"points",label:`الدرجة (من ${i})`,type:"number",min:0,max:Number(i)||0,step:"0.5",value:"",required:!0,placeholder:"0"},{name:"feedback",label:"ملاحظات للطالب",type:"textarea",value:"",placeholder:"اختياري"}],submitLabel:"حفظ الدرجة",onSubmit:async r=>{const d=await f("teacher_grade_submission",{p_submission_id:Number(t),p_points:Number(r.points),p_feedback:r.feedback||null});return d.ok?{ok:!0,message:"تم حفظ الدرجة"}:{ok:!1,error:d.error}}})}v({portal:"teacher",title:"لوحة التحكم",render:async({content:t})=>{a("tdAllCourses").href=h("pages/teacher/courses.html"),a("tdStats").innerHTML=l("stats",4),a("tdCourses").innerHTML=l("cards",2),a("tdSubmissions").innerHTML=l("rows",2),a("tdSchedule").innerHTML=l("rows",2),t.addEventListener("click",_=>{const c=_.target.closest("[data-grade]");c&&S(c.dataset.grade,c.dataset.name,c.dataset.title,c.dataset.max)});const n=await f("teacher_dashboard");if(!n.ok){M(n.error||"تحقّق من الاتصال ثم أعد المحاولة.");return}const e=n.data||{},i=Number(e.pending_grading||0),r=e.courses||[],d=e.submissions||[],$=e.schedule||[];a("tdIntro").textContent=i>0?`لديك ${o(i)} تسليماً بانتظار التصحيح، و${o(e.today_lectures)} محاضرة اليوم، و${o(e.upcoming_exams)} اختباراً خلال 24 ساعة.`:`لا تسليمات بانتظار التصحيح حالياً. لديك ${o(e.active_courses)} مقررات نشطة و${o(e.today_lectures)} محاضرة اليوم.`,a("tdStats").innerHTML=u("مقررات نشطة",e.active_courses,"مقرر","courses")+u("طلاب مسجلون",e.students,"طالب","users")+u("محاضرات",e.lectures,"محاضرة","lectures")+u("بانتظار التصحيح",i,"تسليم","assignments","td-stat-urgent"),a("tdPendingCount").textContent=o(i),a("tdCourses").innerHTML=r.length?`<div class="td-course-list">${r.map(C).join("")}</div>`:m("لا توجد مقررات بعد","ستظهر مقرراتك هنا فور إنشائها من صفحة مقرراتي.","courses"),a("tdSubmissions").innerHTML=d.length?`<div class="td-item-list">${d.map(T).join("")}</div>`:m("كل شيء مُصحَّح","لا توجد تسليمات بانتظار التصحيح حالياً.","checks"),a("tdSchedule").innerHTML=$.length?`<div class="td-item-list">${$.map(H).join("")}</div>`:m("لا مواعيد قادمة","لا توجد محاضرات أو اختبارات مجدولة خلال الأسبوع القادم.","calendar")}});

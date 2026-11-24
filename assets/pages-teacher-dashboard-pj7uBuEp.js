import"./modulepreload-polyfill-B5Qt9EMX.js";import{b as h,c as o,i as m,e as s,f as $,r as b}from"./portal-eUwZL1O8.js";import{c as g}from"./api-Cx-w9ZQ2.js";import{p as f}from"./auth-BGBkidcA.js";import{$ as n,e as u,o as v,s as x,i as y}from"./common-Fo2juhks.js";import"https://esm.sh/@supabase/supabase-js@2";function l(t,a,e,i,r=""){return`<div class="td-stat ${r}">
    <span class="td-stat-icon">${m(i)}</span>
    <span class="td-stat-label">${s(t)}</span>
    <span class="td-stat-value">${s(o(a))}<small>${s(e)}</small></span>
  </div>`}function C(t){const a=x(t.color),e=`${f("pages/teacher/course.html")}?id=${encodeURIComponent(t.id)}`;return`<a class="td-course" style="--td-color:${a}" href="${s(e)}">
    <span class="td-course-mark">${s(y(t.code))}</span>
    <span class="td-course-body">
      <span class="td-course-title">${s(t.title||"مقرر")} <span class="td-badge">${s(t.code||"—")}</span></span>
      <span class="td-course-sub">${o(t.students)} طالب · ${o(t.lectures)} محاضرة · ${o(t.exams)} اختبار${t.pending?` · ${o(t.pending)} بانتظار التصحيح`:""}</span>
    </span>
    <span class="td-course-arrow">${m("chevron")}</span>
  </a>`}function L(t){const a=[t.course_code,t.course_title].filter(Boolean).join(" — ");return`<div class="td-item">
    <span class="td-item-icon">${m("file")}</span>
    <span class="td-item-body">
      <span class="td-item-title">${s(t.student_name||"طالب")} — ${s(t.assignment_title||"واجب")}</span>
      <span class="td-item-sub">${s(a)} · ${s($(t.submitted_at))}${t.submitted_at?` · ${s(b(t.submitted_at))}`:""}</span>
    </span>
    <button class="tt-btn tt-btn-ghost" type="button" data-grade="${s(t.id)}"
      data-name="${s(t.student_name||"الطالب")}" data-title="${s(t.assignment_title||"الواجب")}"
      data-max="${s(t.max_points??10)}">تصحيح</button>
  </div>`}function T(t){const a=t.kind==="exam";return`<div class="td-item">
    <span class="td-item-icon">${m(a?"exams":"lectures")}</span>
    <span class="td-item-body">
      <span class="td-item-title">${s(t.title||(a?"اختبار":"محاضرة"))} <span class="td-badge ${a?"td-exam":""}">${a?"اختبار":"محاضرة"}</span></span>
      <span class="td-item-sub">${s([t.course_code,t.course_title].filter(Boolean).join(" — "))}</span>
    </span>
    <span class="td-item-time">${s($(t.at))}<br />${s(b(t.at))}</span>
  </div>`}function H(t){n("tdIntro").textContent="تعذّر تحميل بيانات لوحة التحكم.",n("tdStats").innerHTML="",n("tdCourses").innerHTML=u("لا يمكن عرض المقررات",t,"courses"),n("tdSubmissions").innerHTML="",n("tdSchedule").innerHTML="",n("tdPendingCount").textContent="—"}async function M(t,a,e,i){v({title:"تصحيح تسليم",intro:`${a} — ${e}`,fields:[{name:"points",label:`الدرجة (من ${i})`,type:"number",min:0,max:Number(i)||0,step:"0.5",value:"",required:!0,placeholder:"0"},{name:"feedback",label:"ملاحظات للطالب",type:"textarea",value:"",placeholder:"اختياري"}],submitLabel:"حفظ الدرجة",onSubmit:async r=>{const d=await g("teacher_grade_submission",{p_submission_id:Number(t),p_points:Number(r.points),p_feedback:r.feedback||null});return d.ok?{ok:!0,message:"تم حفظ الدرجة"}:{ok:!1,error:d.error}}})}h({portal:"teacher",title:"لوحة التحكم",render:async({content:t})=>{n("tdAllCourses").href=f("pages/teacher/courses.html"),t.addEventListener("click",_=>{const c=_.target.closest("[data-grade]");c&&M(c.dataset.grade,c.dataset.name,c.dataset.title,c.dataset.max)});const a=await g("teacher_dashboard");if(!a.ok){H(a.error||"تحقّق من الاتصال ثم أعد المحاولة.");return}const e=a.data||{},i=Number(e.pending_grading||0),r=e.courses||[],d=e.submissions||[],p=e.schedule||[];n("tdIntro").textContent=i>0?`لديك ${o(i)} تسليماً بانتظار التصحيح، و${o(e.today_lectures)} محاضرة اليوم، و${o(e.upcoming_exams)} اختباراً خلال 24 ساعة.`:`لا تسليمات بانتظار التصحيح حالياً. لديك ${o(e.active_courses)} مقررات نشطة و${o(e.today_lectures)} محاضرة اليوم.`,n("tdStats").innerHTML=l("مقررات نشطة",e.active_courses,"مقرر","courses")+l("طلاب مسجلون",e.students,"طالب","users")+l("محاضرات",e.lectures,"محاضرة","lectures")+l("بانتظار التصحيح",i,"تسليم","assignments","td-stat-urgent"),n("tdPendingCount").textContent=o(i),n("tdCourses").innerHTML=r.length?`<div class="td-course-list">${r.map(C).join("")}</div>`:u("لا توجد مقررات بعد","ستظهر مقرراتك هنا فور إنشائها من صفحة مقرراتي.","courses"),n("tdSubmissions").innerHTML=d.length?`<div class="td-item-list">${d.map(L).join("")}</div>`:u("كل شيء مُصحَّح","لا توجد تسليمات بانتظار التصحيح حالياً.","checks"),n("tdSchedule").innerHTML=p.length?`<div class="td-item-list">${p.map(T).join("")}</div>`:u("لا مواعيد قادمة","لا توجد محاضرات أو اختبارات مجدولة خلال الأسبوع القادم.","calendar")}});

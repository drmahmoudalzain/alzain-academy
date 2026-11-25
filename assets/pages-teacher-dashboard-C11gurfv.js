import"./modulepreload-polyfill-B5Qt9EMX.js";import{b as f,s as d,c as o,i as u,e,f as $,r as b}from"./portal-B6d55adY.js";import{c as g}from"./api-BSIHGEHC.js";import{d as h}from"./auth-BaBTqA0k.js";import{$ as t,e as l,s as v,i as _}from"./common-CnKkGyia.js";import"https://esm.sh/@supabase/supabase-js@2";function c(s,a,n,i,r=""){return`<div class="td-stat ${r}">
    <span class="td-stat-icon">${u(i)}</span>
    <span class="td-stat-label">${e(s)}</span>
    <span class="td-stat-value">${e(o(a))}<small>${e(n)}</small></span>
  </div>`}function C(s){const a=v(s.color),n=`${h("pages/teacher/course.html")}?id=${encodeURIComponent(s.id)}`;return`<a class="td-course" style="--td-color:${a}" href="${e(n)}">
    <span class="td-course-mark">${e(_(s.code))}</span>
    <span class="td-course-body">
      <span class="td-course-title">${e(s.title||"مقرر")} <span class="td-badge">${e(s.code||"—")}</span></span>
      <span class="td-course-sub">${o(s.students)} طالب · ${o(s.lectures)} محاضرة · ${o(s.exams)} اختبار${s.pending?` · ${o(s.pending)} بانتظار التصحيح`:""}</span>
    </span>
    <span class="td-course-arrow">${u("chevron")}</span>
  </a>`}function T(s){const a=[s.course_code,s.course_title].filter(Boolean).join(" — ");return`<div class="td-item">
    <span class="td-item-icon">${u("file")}</span>
    <span class="td-item-body">
      <span class="td-item-title">${e(s.student_name||"طالب")} — ${e(s.assignment_title||"واجب")}</span>
      <span class="td-item-sub">${e(a)} · ${e($(s.submitted_at))}${s.submitted_at?` · ${e(b(s.submitted_at))}`:""}</span>
    </span>
    <span class="td-badge">للإدارة</span>
  </div>`}function H(s){const a=s.kind==="exam";return`<div class="td-item">
    <span class="td-item-icon">${u(a?"exams":"lectures")}</span>
    <span class="td-item-body">
      <span class="td-item-title">${e(s.title||(a?"اختبار":"محاضرة"))} <span class="td-badge ${a?"td-exam":""}">${a?"اختبار":"محاضرة"}</span></span>
      <span class="td-item-sub">${e([s.course_code,s.course_title].filter(Boolean).join(" — "))}</span>
    </span>
    <span class="td-item-time">${e($(s.at))}<br />${e(b(s.at))}</span>
  </div>`}function L(s){t("tdIntro").textContent="تعذّر تحميل بيانات لوحة التحكم.",t("tdStats").innerHTML="",t("tdCourses").innerHTML=l("لا يمكن عرض المقررات",s,"courses"),t("tdSubmissions").innerHTML="",t("tdSchedule").innerHTML="",t("tdPendingCount").textContent="—"}f({portal:"teacher",title:"لوحة التحكم",render:async({content:s})=>{t("tdAllCourses").href=h("pages/teacher/courses.html"),t("tdStats").innerHTML=d("stats",4),t("tdCourses").innerHTML=d("cards",2),t("tdSubmissions").innerHTML=d("rows",2),t("tdSchedule").innerHTML=d("rows",2);const a=await g("teacher_dashboard");if(!a.ok){L(a.error||"تحقّق من الاتصال ثم أعد المحاولة.");return}const n=a.data||{},i=Number(n.pending_grading||0),r=n.courses||[],p=n.submissions||[],m=n.schedule||[];t("tdIntro").textContent=i>0?`لديك ${o(i)} تسليماً بانتظار التصحيح، و${o(n.today_lectures)} محاضرة اليوم، و${o(n.upcoming_exams)} اختباراً خلال 24 ساعة.`:`لا تسليمات بانتظار التصحيح حالياً. لديك ${o(n.active_courses)} مقررات نشطة و${o(n.today_lectures)} محاضرة اليوم.`,t("tdStats").innerHTML=c("مقررات نشطة",n.active_courses,"مقرر","courses")+c("طلاب مسجلون",n.students,"طالب","users")+c("محاضرات",n.lectures,"محاضرة","lectures")+c("بانتظار التصحيح",i,"تسليم","assignments","td-stat-urgent"),t("tdPendingCount").textContent=o(i),t("tdCourses").innerHTML=r.length?`<div class="td-course-list">${r.map(C).join("")}</div>`:l("لا توجد مقررات بعد","تُنشأ المقررات من بوابة الإدارة.","courses"),t("tdSubmissions").innerHTML=p.length?`<div class="td-item-list">${p.map(T).join("")}</div>`:l("كل شيء مُصحَّح","لا توجد تسليمات بانتظار التصحيح حالياً.","checks"),t("tdSchedule").innerHTML=m.length?`<div class="td-item-list">${m.map(H).join("")}</div>`:l("لا مواعيد قادمة","لا توجد محاضرات أو اختبارات مجدولة خلال الأسبوع القادم.","calendar")}});

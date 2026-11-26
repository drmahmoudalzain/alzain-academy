import"./modulepreload-polyfill-B5Qt9EMX.js";import{b as h,i as n,s as u,a as o,e as i,c as m}from"./portal-CirgJEFP.js";import{c as $}from"./api-rUQmnFmR.js";import{p as g}from"./base-CLcZMpw2.js";import{$ as c,e as p,s as S}from"./common-PnjW3H2x.js";import"./identity-rules-DVz3p2Gs.js";import"https://esm.sh/@supabase/supabase-js@2";import"./first-visit-BDQ6DJqx.js";const a={courses:[],filter:"all",level:"all",sort:"code",query:""};function d(t,s,e,r,f=""){return`<div class="tc-stat ${f}">
    <span class="tc-stat-icon">${n(r)}</span>
    <span><span class="tc-stat-label">${i(t)}</span><span class="tc-stat-value">${i(o(s))}<small>${i(e)}</small></span></span>
  </div>`}function L(t){const s=S(t.color),e=`${g("pages/teacher/course.html")}?id=${encodeURIComponent(t.id)}`;return`<article class="tc-card" style="--tc-color:${s}">
    <div class="tc-card-body">
      <div class="tc-card-top">
        <span class="tc-code">${i(t.code||"—")}</span>
        <span class="tc-status ${t.archived?"tc-off":""}">${t.archived?"مؤرشف":"نشط"}</span>
      </div>
      <h2>${i(t.title||"مقرر")}</h2>
      ${t.description?`<p>${i(t.description)}</p>`:""}
      <div class="tc-meta">
        <span>${n("users")}${o(t.students)} طالب</span>
        <span>${n("lectures")}${o(t.lectures)} محاضرة</span>
        <span>${n("exams")}${o(t.exams)} اختبار</span>
        <span>${n("file")}${o(t.assignments)} واجب</span>
        <span>${n("calendar")}${i(m(t.created_at))}</span>
      </div>
    </div>
    <div class="tc-card-actions">
      <a class="tt-btn tt-btn-ghost" href="${i(e)}">${n("details")}فتح المقرر</a>
    </div>
  </article>`}function y(t){c("tcStats").innerHTML=d("إجمالي المقررات",t.total,"مقرر","courses")+d("مقررات نشطة",t.active,"مقرر","check")+d("إجمالي الطلاب",t.students,"طالب","users","tc-students")+d("مقررات مؤرشفة",t.archived,"مقرر","archive","tc-archived")}function v(t){const s={all:t.total,active:t.active,archived:t.archived};document.querySelectorAll("[data-count]").forEach(e=>{e.textContent=o(s[e.dataset.count])}),document.querySelectorAll(".tc-tab").forEach(e=>{const r=e.dataset.filter===a.filter;e.classList.toggle("tc-active",r),e.setAttribute("aria-selected",String(r))})}function l(){const t=a.query.trim().toLowerCase(),s=a.courses.filter(e=>a.filter==="all"||(a.filter==="active"?!e.archived:!!e.archived)).filter(e=>a.level==="all"||String(e.level??"")===a.level).filter(e=>!t||[e.title,e.code,e.description].some(r=>String(r||"").toLowerCase().includes(t))).sort((e,r)=>a.sort==="students"?Number(r.students)-Number(e.students):a.sort==="recent"?String(r.created_at||"").localeCompare(String(e.created_at||"")):String(e.code||"").localeCompare(String(r.code||"")));if(!s.length){c("tcGrid").innerHTML=p(a.courses.length?"لا مقررات مطابقة":"لا توجد مقررات بعد",a.courses.length?"جرّب تغيير التصفية أو كلمة البحث.":"تُنشأ المقررات من بوابة الإدارة.","courses");return}c("tcGrid").innerHTML=s.map(L).join("")}async function b(){const t=await $("teacher_courses");if(!t.ok){c("tcStats").innerHTML="",c("tcGrid").innerHTML=p("تعذّر تحميل المقررات",t.error||"تحقّق من الاتصال ثم أعد المحاولة.","courses");return}const s=t.data||{};a.courses=s.courses||[],y(s),v(s),l(),["tcLevel","tcSort","tcSearch"].forEach(e=>{c(e).disabled=!1})}h({portal:"teacher",title:"مقرراتي",render:async({content:t})=>{c("tcSearch").closest(".tc-search").querySelector(".tc-search-icon").innerHTML=n("search"),c("tcStats").innerHTML=u("stats",4),c("tcGrid").innerHTML=u("cards",2),t.addEventListener("click",s=>{const e=s.target.closest(".tc-tab");if(e){a.filter=e.dataset.filter,v({total:a.courses.length,active:a.courses.filter(r=>!r.archived).length,archived:a.courses.filter(r=>!!r.archived).length}),l();return}}),c("tcLevel").addEventListener("change",s=>{a.level=s.target.value,l()}),c("tcSort").addEventListener("change",s=>{a.sort=s.target.value,l()}),c("tcSearch").addEventListener("input",s=>{a.query=s.target.value,l()}),await b()}});

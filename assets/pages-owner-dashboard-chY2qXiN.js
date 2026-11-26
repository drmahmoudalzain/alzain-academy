import{p}from"./base-CCmrW03f.js";import{b as k,a as u,e as a,i as d,r as H,f as S}from"./portal-SoFHdmLY.js";import{b as v}from"./auth-39CNNLuZ.js";import"https://esm.sh/@supabase/supabase-js@2";const l=s=>document.getElementById(s),T=[{key:"students",label:"إجمالي الطلاب",ico:"users",href:"pages/owner/students.html"},{key:"courses",label:"المقررات النشطة",ico:"courses",href:"pages/owner/courses.html"},{key:"lectures",label:"المحاضرات",ico:"lectures",href:"pages/owner/lectures.html"},{key:"assessments",label:"الاختبارات والواجبات",ico:"exams",href:"pages/owner/report.html"}],A=[{label:"إضافة مستخدم",ico:"plus",href:"pages/owner/users.html?new=1"},{label:"إنشاء مقرر",ico:"courses",href:"pages/owner/courses.html?new=1"},{label:"التقرير الشامل",ico:"grades",href:"pages/owner/report.html"},{label:"دليل المستخدم",ico:"file",href:"guide.html"}];function f(s,e){return Array.from({length:e},()=>`<div class="od-skeleton od-skeleton-${s}" aria-hidden="true"></div>`).join("")}async function c(s,e=[]){let n=v.from(s).select("id",{count:"exact",head:!0});for(const t of e)t.op==="in"?n=n.in(t.column,t.value):n=n.eq(t.column,t.value);const{count:m,error:r}=await n;if(r)throw r;return Number(m||0)}async function x(){const{data:s,error:e}=await v.from("notifications").select("id, title, body, created_at").order("created_at",{ascending:!1}).limit(4);if(e)throw e;return Array.isArray(s)?s:[]}function N(s,e){const n=e===null?"—":u(e),m=`${s.label}: ${e===null?"بيانات غير متاحة":n}`;return`<a class="od-stat" href="${a(p(s.href))}" aria-label="${a(m)}">
    <span class="od-stat-icon">${d(s.ico)}</span>
    <span class="od-stat-value">${a(n)}</span>
    <span class="od-stat-label">${a(s.label)}</span>
  </a>`}function b(s,e,n){return`<div class="od-mini">
    <span class="od-mini-icon">${d(n)}</span>
    <span class="od-mini-body">
      <span class="od-mini-value">${a(e===null?"—":u(e))}</span>
      <span class="od-mini-label">${a(s)}</span>
    </span>
  </div>`}function L(s){return`<a class="od-action" href="${a(p(s.href))}">
    <span class="od-action-icon">${d(s.ico)}</span>
    <span class="od-action-label">${a(s.label)}</span>
  </a>`}function M(s){const e=p("pages/notifications.html"),n=s.created_at?`${H(s.created_at)} · ${S(s.created_at)}`:"بدون تاريخ";return`<a class="od-activity" href="${a(e)}">
    <span class="od-activity-icon">${d("bell")}</span>
    <span class="od-activity-body">
      <span class="od-activity-title">${a(s.title||"إشعار")}</span>
      ${s.body?`<span class="od-activity-text">${a(s.body)}</span>`:""}
      <span class="od-activity-time">${d("clock")}<span>${a(n)}</span></span>
    </span>
  </a>`}function $(s,e,n){return`<div class="od-empty" role="status">
    <span class="od-empty-icon">${d(n)}</span>
    <h3>${a(s)}</h3>
    <p>${a(e)}</p>
  </div>`}k({portal:"owner",title:"لوحة التحكم",render:async({profile:s})=>{l("odAllNotifications").href=p("pages/notifications.html"),l("odGreeting").textContent=`أهلاً بك، ${String((s==null?void 0:s.name)||"").trim().split(/\s+/)[0]||"أستاذي"}`,l("odStats").innerHTML=f("stat",4),l("odSecondary").innerHTML=f("mini",2),l("odActivity").innerHTML=f("row",3),l("odActions").innerHTML=A.map(L).join("");const e={students:c("users",[{column:"role",value:"student"}]),activeStudents:c("users",[{column:"role",value:"student"},{column:"is_active",value:!0}]),courses:c("courses",[{column:"archived",value:!1}]),lectures:c("lectures"),exams:c("exams"),assignments:c("assignments"),teachers:c("users",[{column:"role",value:"teacher"}]),assistants:c("users",[{column:"role",value:"assistant"}]),notifications:x()},n=Object.keys(e),m=await Promise.allSettled(n.map(i=>e[i])),r=Object.fromEntries(n.map((i,w)=>[i,m[w]])),t=i=>r[i].status==="fulfilled"?r[i].value:null,o={students:t("students"),courses:t("courses"),lectures:t("lectures"),assessments:t("exams")===null||t("assignments")===null?null:Number(t("exams"))+Number(t("assignments"))},g=t("teachers")===null||t("assistants")===null?null:Number(t("teachers"))+Number(t("assistants"));l("odStats").innerHTML=T.map(i=>N(i,o[i.key])).join(""),l("odSecondary").innerHTML=b("الطلاب النشطون",t("activeStudents"),"checks")+b("الأساتذة والمساعدون",g,"users");const h=[o.students===null?null:`${u(o.students)} طالباً`,o.courses===null?null:`${u(o.courses)} مقرراً نشطاً`,o.lectures===null?null:`${u(o.lectures)} محاضرة`,o.assessments===null?null:`${u(o.assessments)} اختباراً وواجباً`].filter(Boolean);if(l("odIntro").textContent=h.length?`نظرة عامة على البوابات الأربع: ${h.join(" · ")}.`:"تعذّر تحميل الإحصاءات من قاعدة البيانات. تحقّق من الاتصال ثم أعد المحاولة.",r.notifications.status!=="fulfilled"){l("odActivity").innerHTML=$("تعذّر تحميل النشاطات","لم نتمكن من قراءة الإشعارات الآن.","bell");return}const y=r.notifications.value||[];l("odActivity").innerHTML=y.length?y.map(M).join(""):$("لا توجد نشاطات حديثة","ستظهر هنا آخر الإشعارات المسجلة في المنصة.","bell")}});

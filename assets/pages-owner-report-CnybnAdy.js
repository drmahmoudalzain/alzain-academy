import"./modulepreload-polyfill-B5Qt9EMX.js";import{b as k,i as g,e as o,a as _}from"./portal-DWIJxEh3.js";import{e as t}from"./identity-rules-DVz3p2Gs.js";import"./base-CLcZMpw2.js";import"./first-visit-BDQ6DJqx.js";import"https://esm.sh/@supabase/supabase-js@2";const n=l=>document.getElementById(l);k({portal:"owner",title:"التقرير الشامل",render:async()=>{var u,m,h,p,v,b,f,x,$;n("orStats").innerHTML='<div class="od-skeleton od-skeleton-stat"></div>'.repeat(6),n("orTable").innerHTML='<div class="od-skeleton od-skeleton-row" aria-hidden="true"></div>'.repeat(4);const l={students:t.from("users").select("id",{count:"exact",head:!0}).eq("role","student"),teachers:t.from("users").select("id",{count:"exact",head:!0}).eq("role","teacher"),assistants:t.from("users").select("id",{count:"exact",head:!0}).eq("role","assistant"),courses:t.from("courses").select("id",{count:"exact",head:!0}).eq("archived",!1),lectures:t.from("lectures").select("id",{count:"exact",head:!0}),exams:t.from("exams").select("id",{count:"exact",head:!0}),assignments:t.from("assignments").select("id",{count:"exact",head:!0}),submissions:t.from("submissions").select("id",{count:"exact",head:!0}),coursesList:t.from("courses").select("id, title, code, teacher_id, archived").order("title")},c=Object.keys(l),i=await Promise.allSettled(c.map(e=>l[e])),s=e=>i[c.indexOf(e)].status==="fulfilled"?i[c.indexOf(e)].value:null,w=[{label:"الطلاب",value:(u=s("students"))==null?void 0:u.count},{label:"الأساتذة",value:(m=s("teachers"))==null?void 0:m.count},{label:"المساعدون",value:(h=s("assistants"))==null?void 0:h.count},{label:"المقررات النشطة",value:(p=s("courses"))==null?void 0:p.count},{label:"المحاضرات",value:(v=s("lectures"))==null?void 0:v.count},{label:"الاختبارات",value:(b=s("exams"))==null?void 0:b.count},{label:"الواجبات",value:(f=s("assignments"))==null?void 0:f.count},{label:"التسليمات",value:(x=s("submissions"))==null?void 0:x.count}];n("orStats").innerHTML=w.map(e=>`
      <div class="od-mini">
        <span class="od-mini-icon">${g("grades")}</span>
        <span class="od-mini-body">
          <span class="od-mini-value">${o(e.value==null?"—":_(e.value))}</span>
          <span class="od-mini-label">${o(e.label)}</span>
        </span>
      </div>
    `).join("");const d=(($=s("coursesList"))==null?void 0:$.data)||[];if(!d.length){n("orTable").innerHTML=`<div class="od-empty" role="status"><span class="od-empty-icon">${g("courses")}</span><h3>لا توجد مقررات</h3></div>`;return}const{data:y}=await t.from("enrollments").select("course_id, status"),r=new Map;for(const e of y||[]){r.has(e.course_id)||r.set(e.course_id,{active:0,total:0});const a=r.get(e.course_id);a.total++,e.status==="active"&&a.active++}const{data:M}=await t.from("users").select("id, name").eq("role","teacher"),T=new Map((M||[]).map(e=>[e.id,e.name])),L=d.map(e=>{const a=r.get(e.id)||{active:0,total:0};return`<tr>
        <td>${o(e.code||"—")}</td>
        <td>${o(e.title||"—")}</td>
        <td>${o(T.get(e.teacher_id)||"—")}</td>
        <td>${a.active}/${a.total}</td>
        <td>${e.archived?"أرشيف":"نشط"}</td>
      </tr>`}).join("");n("orTable").innerHTML=`<div class="od-table-wrap"><table class="od-table">
      <thead><tr><th>الرمز</th><th>المقرر</th><th>الأستاذ</th><th>تسجيلات (نشط/إجمالي)</th><th>الحالة</th></tr></thead>
      <tbody>${L}</tbody>
    </table></div>`}});

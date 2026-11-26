import"./modulepreload-polyfill-B5Qt9EMX.js";import{b as _,e as a,f as b}from"./portal-CxwtNPRX.js";import{e as h}from"./identity-rules-Cp64wFaG.js";import{$ as f,e as r}from"./common-CcrOvvFD.js";import"./base-CLcZMpw2.js";import"./first-visit-BDQ6DJqx.js";import"https://esm.sh/@supabase/supabase-js@2";_({portal:"teacher",title:"محاضراتي",render:async({profile:s})=>{const d=s==null?void 0:s.id,e=f("tlTable");if(e.innerHTML='<div class="td-skeleton td-skeleton-row"></div>'.repeat(5),!d){e.innerHTML=r("تعذّر تحديد المستخدم","","lectures");return}const{data:i}=await h.from("courses").select("id, title, code").eq("teacher_id",d),n=(i||[]).map(t=>t.id);if(!n.length){e.innerHTML=r("لا توجد مقررات","لا توجد محاضرات.","lectures");return}const m=new Map((i||[]).map(t=>[t.id,t])),{data:o,error:c}=await h.from("lectures").select("id, course_id, title, lecture_type, scheduled_at, duration_min, status").in("course_id",n).order("scheduled_at",{ascending:!1});if(c){e.innerHTML=r("تعذّر تحميل المحاضرات",c.message||"","lectures");return}const u=Array.isArray(o)?o:[];if(!u.length){e.innerHTML=r("لا توجد محاضرات","لا توجد محاضرات.","lectures");return}const p=u.map(t=>{var l;return`<tr>
      <td>${a(t.title||"—")}</td>
      <td>${a(((l=m.get(t.course_id))==null?void 0:l.title)||"—")}</td>
      <td>${a(t.lecture_type||"—")}</td>
      <td>${t.scheduled_at?b(t.scheduled_at):"—"}</td>
      <td>${t.duration_min||"—"} د</td>
      <td>${t.status||"—"}</td>
    </tr>`}).join("");e.innerHTML=`<div class="td-table-wrap"><table class="td-table">
      <thead><tr><th>العنوان</th><th>المقرر</th><th>النوع</th><th>الموعد</th><th>المدة</th><th>الحالة</th></tr></thead>
      <tbody>${p}</tbody>
    </table></div>`}});

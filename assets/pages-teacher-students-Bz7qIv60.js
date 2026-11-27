import"./modulepreload-polyfill-B5Qt9EMX.js";import{b as M,e as s,a as $}from"./portal-75pk5vcp.js";import{e as o}from"./identity-rules-Cp64wFaG.js";import{$ as n,e as a}from"./common-3QF9HtBB.js";import"./base-CLcZMpw2.js";import"./first-visit-BDQ6DJqx.js";import"https://esm.sh/@supabase/supabase-js@2";M({portal:"teacher",title:"طلابي",render:async({profile:r})=>{const c=r==null?void 0:r.id,e=n("tsTable");if(e.innerHTML='<div class="td-skeleton td-skeleton-row"></div>'.repeat(5),!c){e.innerHTML=a("تعذّر تحديد المستخدم","","users");return}const{data:u}=await o.from("courses").select("id, title, code").eq("teacher_id",c),m=(u||[]).map(t=>t.id);if(!m.length){e.innerHTML=a("لا توجد مقررات","لا يوجد طلاب.","users"),n("tsCount").textContent="0";return}const _=new Map((u||[]).map(t=>[t.id,t])),{data:l,error:h}=await o.from("enrollments").select("course_id, student_id, status").in("course_id",m);if(h){e.innerHTML=a("تعذّر تحميل الطلاب",h.message||"","users"),n("tsCount").textContent="—";return}const d=[...new Set((l||[]).map(t=>t.student_id))],{data:v}=await o.from("users").select("id, name, email, university_id, is_active, track, level").in("id",d.length?d:[0]),w=new Map((v||[]).map(t=>[t.id,t])),p=(l||[]).map(t=>{const i=w.get(t.student_id)||{},b=_.get(t.course_id)||{};return`<tr>
        <td>${s(i.name||"—")}</td>
        <td>${s(i.email||"—")}</td>
        <td>${s(i.university_id||"—")}</td>
        <td>${s(b.code||"—")} — ${s(b.title||"—")}</td>
        <td>${t.status==="active"?"نشط":t.status||"—"}</td>
      </tr>`}).join("");e.innerHTML=p?`<div class="td-table-wrap"><table class="td-table">
          <thead><tr><th>الاسم</th><th>البريد</th><th>الرقم الجامعي</th><th>المقرر</th><th>الحالة</th></tr></thead>
          <tbody>${p}</tbody>
        </table></div>`:a("لا يوجد طلاب","لا يوجد طلاب مسجّلون.","users"),n("tsCount").textContent=`${$(d.length)}`}});

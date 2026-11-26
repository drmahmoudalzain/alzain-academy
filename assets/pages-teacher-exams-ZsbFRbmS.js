import"./modulepreload-polyfill-B5Qt9EMX.js";import{b,e as h,f as l}from"./portal-CxwtNPRX.js";import{e as u}from"./identity-rules-Cp64wFaG.js";import{$,e as s}from"./common-CcrOvvFD.js";import"./base-CLcZMpw2.js";import"./first-visit-BDQ6DJqx.js";import"https://esm.sh/@supabase/supabase-js@2";b({portal:"teacher",title:"اختباراتي",render:async({profile:a})=>{const r=a==null?void 0:a.id,e=$("teTable");if(e.innerHTML='<div class="td-skeleton td-skeleton-row"></div>'.repeat(5),!r){e.innerHTML=s("تعذّر تحديد المستخدم","","exams");return}const{data:d}=await u.from("courses").select("id, title, code").eq("teacher_id",r),i=(d||[]).map(t=>t.id);if(!i.length){e.innerHTML=s("لا توجد مقررات","لا توجد اختبارات.","exams");return}const _=new Map((d||[]).map(t=>[t.id,t])),{data:n,error:o}=await u.from("exams").select("id, course_id, title, exam_kind, starts_at, ends_at, duration_min, is_published").in("course_id",i).order("starts_at",{ascending:!1});if(o){e.innerHTML=s("تعذّر تحميل الاختبارات",o.message||"","exams");return}const m=Array.isArray(n)?n:[];if(!m.length){e.innerHTML=s("لا توجد اختبارات","لا توجد اختبارات.","exams");return}const p=m.map(t=>{var c;return`<tr>
      <td>${h(t.title||"—")}</td>
      <td>${h(((c=_.get(t.course_id))==null?void 0:c.title)||"—")}</td>
      <td>${t.exam_kind==="assignment"?"واجب":"اختبار"}</td>
      <td>${t.starts_at?l(t.starts_at):"—"}</td>
      <td>${t.ends_at?l(t.ends_at):"—"}</td>
      <td>${t.duration_min||"—"} د</td>
      <td>${t.is_published?"منشور":"مسودة"}</td>
    </tr>`}).join("");e.innerHTML=`<div class="td-table-wrap"><table class="td-table">
      <thead><tr><th>العنوان</th><th>المقرر</th><th>النوع</th><th>البداية</th><th>النهاية</th><th>المدة</th><th>الحالة</th></tr></thead>
      <tbody>${p}</tbody>
    </table></div>`}});

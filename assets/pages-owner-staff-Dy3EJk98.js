import"./base-CCmrW03f.js";import{b,i as c,e as o,a as n}from"./portal-DVAgBO-i.js";import{a as l}from"./auth-BSie1sbi.js";import"https://esm.sh/@supabase/supabase-js@2";const e=a=>document.getElementById(a);b({portal:"owner",title:"الموظفون",render:async()=>{e("osTable").innerHTML='<div class="od-skeleton od-skeleton-row" aria-hidden="true"></div>'.repeat(5);const{data:a,error:d}=await l.from("users").select("id, name, email, role, is_active, created_at").in("role",["teacher","assistant"]).order("role").order("name");if(d){e("osTable").innerHTML=`<div class="od-empty" role="status"><span class="od-empty-icon">${c("users")}</span><h3>تعذّر تحميل الموظفين</h3><p>${o(d.message||"")}</p></div>`,e("osCount").textContent="—";return}const r=Array.isArray(a)?a:[],{data:h}=await l.from("courses").select("id, teacher_id, title, archived"),s=new Map;for(const t of h||[])s.has(t.teacher_id)||s.set(t.teacher_id,[]),s.get(t.teacher_id).push(t);if(!r.length){e("osTable").innerHTML=`<div class="od-empty" role="status"><span class="od-empty-icon">${c("users")}</span><h3>لا يوجد موظفون</h3><p>لم يُعثر على أساتذة أو مساعدين.</p></div>`,e("osCount").textContent="0";return}const p=r.map(t=>{const i=s.get(t.id)||[],m=i.filter(u=>!u.archived).length;return`<tr>
        <td>${o(t.name||"—")}</td>
        <td>${o(t.email||"—")}</td>
        <td>${t.role==="teacher"?"أستاذ":"مساعد"}</td>
        <td>${t.is_active?"✅":"⛔"}</td>
        <td>${n(i.length)} (${n(m)} نشط)</td>
        <td>${t.created_at?new Date(t.created_at).toLocaleDateString("ar"):"—"}</td>
      </tr>`}).join("");e("osTable").innerHTML=`<div class="od-table-wrap"><table class="od-table">
      <thead><tr><th>الاسم</th><th>البريد</th><th>الدور</th><th>الحالة</th><th>المقررات</th><th>تاريخ الإنشاء</th></tr></thead>
      <tbody>${p}</tbody>
    </table></div>`,e("osCount").textContent=`${n(r.length)}`}});

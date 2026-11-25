import"./base-CCmrW03f.js";import{b as u,i as d,a as l,e as n,f}from"./portal-ByCz9Nvk.js";import{a as m}from"./auth-DXIz8ObO.js";import"https://esm.sh/@supabase/supabase-js@2";const a=t=>document.getElementById(t);let i=[];async function c(){a("ouTable").innerHTML='<div class="od-skeleton od-skeleton-row" aria-hidden="true"></div>'.repeat(6);const{data:t,error:s}=await m.from("users").select("id, name, email, role, is_active, university_id, platform_id, must_change_password, created_at").order("created_at",{ascending:!1});if(s){a("ouTable").innerHTML=`<div class="od-empty" role="status"><span class="od-empty-icon">${d("users")}</span><h3>تعذّر تحميل المستخدمين</h3><p>${n(s.message||"خطأ غير معروف")}</p></div>`,a("ouCount").textContent="—";return}i=Array.isArray(t)?t:[],h()}function p(t){return t==="teacher"?"أستاذ":t==="assistant"?"مساعد":t==="student"?"طالب":t||"—"}function v(t){return t.length?`<div class="od-table-wrap"><table class="od-table">
    <thead><tr><th>الاسم</th><th>البريد</th><th>الدور</th><th>الرقم الجامعي</th><th>الحالة</th><th>تغيير كلمة المرور</th><th>تاريخ الإنشاء</th></tr></thead>
    <tbody>${t.map(e=>`
    <tr>
      <td>${n(e.name||"—")}</td>
      <td>${n(e.email||"—")}</td>
      <td>${n(p(e.role))}</td>
      <td>${n(e.university_id||"—")}</td>
      <td>${e.is_active?"✅ نشط":"⛔ معطل"}</td>
      <td>${n(e.must_change_password?"نعم":"لا")}</td>
      <td>${e.created_at?f(e.created_at):"—"}</td>
    </tr>
  `).join("")}</tbody>
  </table></div>`:`<div class="od-empty" role="status"><span class="od-empty-icon">${d("users")}</span><h3>لا توجد نتائج</h3><p>جرّب تغيير التصفية أو البحث.</p></div>`}function h(){const t=a("ouRole").value,s=a("ouSearch").value.trim().toLowerCase(),e=a("ouActiveOnly").checked,o=i.filter(r=>!(t!=="all"&&r.role!==t||e&&!r.is_active||s&&!`${r.name||""} ${r.email||""} ${r.university_id||""} ${r.platform_id||""}`.toLowerCase().includes(s)));a("ouTable").innerHTML=v(o),a("ouCount").textContent=`${l(o.length)} / ${l(i.length)}`}u({portal:"owner",title:"المستخدمون",render:async()=>{a("ouRefresh")&&(a("ouRefresh").innerHTML=`${d("refresh")} تحديث`),["ouRole","ouSearch","ouActiveOnly"].forEach(s=>{const e=a(s);if(!e)return;const o=e.tagName==="INPUT"&&e.type==="checkbox"||e.tagName==="SELECT"?"change":"input";e.addEventListener(o,h)});const t=a("ouRefresh");t&&t.addEventListener("click",async()=>{t.classList.add("is-loading"),t.disabled=!0,await c(),t.classList.remove("is-loading"),t.disabled=!1}),await c()}});

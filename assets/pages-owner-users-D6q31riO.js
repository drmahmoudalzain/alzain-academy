import"./base-CCmrW03f.js";import{b as h,i as c,e as o,a as l,f as m}from"./portal-ByCz9Nvk.js";import{a as u}from"./auth-DXIz8ObO.js";import"https://esm.sh/@supabase/supabase-js@2";const r=t=>document.getElementById(t);let d=[];function p(t){return t==="teacher"?"أستاذ":t==="assistant"?"مساعد":t==="student"?"طالب":t||"—"}function f(t){return t.length?`<div class="od-table-wrap"><table class="od-table">
    <thead><tr><th>الاسم</th><th>البريد</th><th>الدور</th><th>الرقم الجامعي</th><th>الحالة</th><th>تغيير كلمة المرور</th><th>تاريخ الإنشاء</th></tr></thead>
    <tbody>${t.map(e=>`
    <tr>
      <td>${o(e.name||"—")}</td>
      <td>${o(e.email||"—")}</td>
      <td>${o(p(e.role))}</td>
      <td>${o(e.university_id||"—")}</td>
      <td>${e.is_active?"✅ نشط":"⛔ معطل"}</td>
      <td>${o(e.must_change_password?"نعم":"لا")}</td>
      <td>${e.created_at?m(e.created_at):"—"}</td>
    </tr>
  `).join("")}</tbody>
  </table></div>`:`<div class="od-empty" role="status"><span class="od-empty-icon">${c("users")}</span><h3>لا توجد نتائج</h3><p>جرّب تغيير التصفية أو البحث.</p></div>`}function i(){const t=r("ouRole").value,s=r("ouSearch").value.trim().toLowerCase(),e=r("ouActiveOnly").checked,a=d.filter(n=>!(t!=="all"&&n.role!==t||e&&!n.is_active||s&&!`${n.name||""} ${n.email||""} ${n.university_id||""} ${n.platform_id||""}`.toLowerCase().includes(s)));r("ouTable").innerHTML=f(a),r("ouCount").textContent=`${l(a.length)} / ${l(d.length)}`}h({portal:"owner",title:"المستخدمون",render:async()=>{r("ouTable").innerHTML='<div class="od-skeleton od-skeleton-row" aria-hidden="true"></div>'.repeat(6);const{data:t,error:s}=await u.from("users").select("id, name, email, role, is_active, university_id, platform_id, must_change_password, created_at").order("created_at",{ascending:!1});if(s){r("ouTable").innerHTML=`<div class="od-empty" role="status"><span class="od-empty-icon">${c("users")}</span><h3>تعذّر تحميل المستخدمين</h3><p>${o(s.message||"خطأ غير معروف")}</p></div>`,r("ouCount").textContent="—";return}d=Array.isArray(t)?t:[],["ouRole","ouSearch","ouActiveOnly"].forEach(e=>{const a=r(e);a&&a.addEventListener(a.tagName==="INPUT"&&a.type==="checkbox"?"change":"input",i),a&&a.tagName==="SELECT"&&a.addEventListener("change",i)}),i()}});

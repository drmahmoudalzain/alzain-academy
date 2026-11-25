import"./base-CCmrW03f.js";import{b as i,i as o,e as a,a as l}from"./portal-ByCz9Nvk.js";import{a as c}from"./auth-DXIz8ObO.js";import"https://esm.sh/@supabase/supabase-js@2";const t=s=>document.getElementById(s);i({portal:"assistant",title:"الطلاب",render:async()=>{t("asTable").innerHTML='<div class="od-skeleton od-skeleton-row" aria-hidden="true"></div>'.repeat(5);const{data:s,error:r}=await c.from("users").select("id, name, email, university_id, is_active, track, level").eq("role","student").order("name");if(r){t("asTable").innerHTML=`<div class="od-empty" role="status"><span class="od-empty-icon">${o("users")}</span><h3>تعذّر تحميل الطلاب</h3><p>${a(r.message||"")}</p></div>`,t("asCount").textContent="—";return}const n=Array.isArray(s)?s:[];if(!n.length){t("asTable").innerHTML=`<div class="od-empty" role="status"><span class="od-empty-icon">${o("users")}</span><h3>لا يوجد طلاب</h3></div>`,t("asCount").textContent="0";return}const d=n.map(e=>`<tr>
      <td>${a(e.name||"—")}</td>
      <td>${a(e.email||"—")}</td>
      <td>${a(e.university_id||"—")}</td>
      <td>${a(e.track||"—")}</td>
      <td>${e.level||"—"}</td>
      <td>${e.is_active?"✅":"⛔"}</td>
    </tr>`).join("");t("asTable").innerHTML=`<div class="od-table-wrap"><table class="od-table">
      <thead><tr><th>الاسم</th><th>البريد</th><th>الرقم الجامعي</th><th>المسار</th><th>المستوى</th><th>الحالة</th></tr></thead>
      <tbody>${d}</tbody>
    </table></div>`,t("asCount").textContent=`${l(n.length)}`}});

import"./modulepreload-polyfill-B5Qt9EMX.js";import{b as d,i as o,e as s,a as l}from"./portal-CirgJEFP.js";import{e as m}from"./identity-rules-DVz3p2Gs.js";import"./base-CLcZMpw2.js";import"./first-visit-BDQ6DJqx.js";import"https://esm.sh/@supabase/supabase-js@2";const t=a=>document.getElementById(a);d({portal:"assistant",title:"الطلاب",render:async()=>{t("asTable").innerHTML='<div class="od-skeleton od-skeleton-row" aria-hidden="true"></div>'.repeat(5);const{data:a,error:n}=await m.from("users").select("id, name, email, university_id, is_active, track, level").eq("role","student").order("name");if(n){t("asTable").innerHTML=`<div class="od-empty" role="status"><span class="od-empty-icon">${o("users")}</span><h3>تعذّر تحميل الطلاب</h3><p>${s(n.message||"")}</p></div>`,t("asCount").textContent="—";return}const r=Array.isArray(a)?a:[];if(!r.length){t("asTable").innerHTML=`<div class="od-empty" role="status"><span class="od-empty-icon">${o("users")}</span><h3>لا يوجد طلاب</h3></div>`,t("asCount").textContent="0";return}const i=r.map(e=>`<tr>
      <td>${s(e.name||"—")}</td>
      <td>${s(e.email||"—")}</td>
      <td>${s(e.university_id||"—")}</td>
      <td>${s(e.track||"—")}</td>
      <td>${e.level||"—"}</td>
      <td>${e.is_active?"✅":"⛔"}</td>
    </tr>`).join("");t("asTable").innerHTML=`<div class="od-table-wrap"><table class="od-table">
      <thead><tr><th>الاسم</th><th>البريد</th><th>الرقم الجامعي</th><th>المسار</th><th>المستوى</th><th>الحالة</th></tr></thead>
      <tbody>${i}</tbody>
    </table></div>`,t("asCount").textContent=`${l(r.length)}`}});

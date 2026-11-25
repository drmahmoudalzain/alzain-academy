import { boot } from "../../lib/portal.js";
import { supabase } from "../../lib/supabase.js";
import { esc, fmtNum } from "../../lib/fmt.js";
import { icon } from "../../lib/icons.js";

const $ = (id) => document.getElementById(id);

boot({
  portal: "assistant",
  title: "الطلاب",
  render: async () => {
    $("asTable").innerHTML = `<div class="od-skeleton od-skeleton-row" aria-hidden="true"></div>`.repeat(5);
    const { data, error } = await supabase.from("users").select("id, name, email, university_id, is_active, track, level").eq("role", "student").order("name");
    if (error) {
      $("asTable").innerHTML = `<div class="od-empty" role="status"><span class="od-empty-icon">${icon("users")}</span><h3>تعذّر تحميل الطلاب</h3><p>${esc(error.message || "")}</p></div>`;
      $("asCount").textContent = "—";
      return;
    }
    const list = Array.isArray(data) ? data : [];
    if (!list.length) {
      $("asTable").innerHTML = `<div class="od-empty" role="status"><span class="od-empty-icon">${icon("users")}</span><h3>لا يوجد طلاب</h3></div>`;
      $("asCount").textContent = "0";
      return;
    }
    const rows = list.map((u) => `<tr>
      <td>${esc(u.name || "—")}</td>
      <td>${esc(u.email || "—")}</td>
      <td>${esc(u.university_id || "—")}</td>
      <td>${esc(u.track || "—")}</td>
      <td>${u.level || "—"}</td>
      <td>${u.is_active ? "✅" : "⛔"}</td>
    </tr>`).join("");
    $("asTable").innerHTML = `<div class="od-table-wrap"><table class="od-table">
      <thead><tr><th>الاسم</th><th>البريد</th><th>الرقم الجامعي</th><th>المسار</th><th>المستوى</th><th>الحالة</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
    $("asCount").textContent = `${fmtNum(list.length)}`;
  },
});
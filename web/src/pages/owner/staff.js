import { boot } from "../../lib/portal.js";
import { supabase } from "../../lib/supabase.js";
import { esc, fmtDateTime, fmtNum } from "../../lib/fmt.js";
import { icon } from "../../lib/icons.js";

const $ = (id) => document.getElementById(id);

boot({
  portal: "owner",
  title: "الموظفون",
  render: async () => {
    $("osTable").innerHTML = `<div class="od-skeleton od-skeleton-row" aria-hidden="true"></div>`.repeat(5);
    const { data: users, error: uErr } = await supabase
      .from("users")
      .select("id, name, email, role, is_active, created_at")
      .in("role", ["teacher", "assistant"])
      .order("role").order("name");
    if (uErr) {
      $("osTable").innerHTML = `<div class="od-empty" role="status"><span class="od-empty-icon">${icon("users")}</span><h3>تعذّر تحميل الموظفين</h3><p>${esc(uErr.message || "")}</p></div>`;
      $("osCount").textContent = "—";
      return;
    }
    const list = Array.isArray(users) ? users : [];
    // fetch course counts per teacher
    const { data: courses } = await supabase.from("courses").select("id, teacher_id, title, archived");
    const courseMap = new Map();
    for (const c of (courses || [])) {
      if (!courseMap.has(c.teacher_id)) courseMap.set(c.teacher_id, []);
      courseMap.get(c.teacher_id).push(c);
    }
    if (!list.length) {
      $("osTable").innerHTML = `<div class="od-empty" role="status"><span class="od-empty-icon">${icon("users")}</span><h3>لا يوجد موظفون</h3><p>لم يُعثر على أساتذة أو مساعدين.</p></div>`;
      $("osCount").textContent = "0";
      return;
    }
    const rows = list.map((u) => {
      const cs = courseMap.get(u.id) || [];
      const active = cs.filter((c) => !c.archived).length;
      return `<tr>
        <td>${esc(u.name || "—")}</td>
        <td>${esc(u.email || "—")}</td>
        <td>${u.role === "teacher" ? "أستاذ" : "مساعد"}</td>
        <td>${u.is_active ? "✅" : "⛔"}</td>
        <td>${fmtNum(cs.length)} (${fmtNum(active)} نشط)</td>
        <td>${u.created_at ? new Date(u.created_at).toLocaleDateString("ar") : "—"}</td>
      </tr>`;
    }).join("");
    $("osTable").innerHTML = `<div class="od-table-wrap"><table class="od-table">
      <thead><tr><th>الاسم</th><th>البريد</th><th>الدور</th><th>الحالة</th><th>المقررات</th><th>تاريخ الإنشاء</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
    $("osCount").textContent = `${fmtNum(list.length)}`;
  },
});
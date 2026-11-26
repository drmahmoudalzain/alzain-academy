import { boot } from "../../lib/portal.js";
import { supabase } from "../../lib/supabase.js";
import { esc, fmtNum } from "../../lib/fmt.js";
import { icon } from "../../lib/icons.js";
import { $, emptyState } from "./common.js";

boot({
  portal: "teacher",
  title: "طلابي",
  render: async ({ profile }) => {
    const uid = profile?.id;
    const table = $("tsTable");
    table.innerHTML = `<div class="td-skeleton td-skeleton-row"></div>`.repeat(5);
    if (!uid) { table.innerHTML = emptyState("تعذّر تحديد المستخدم", "", "users"); return; }
    const { data: courses } = await supabase.from("courses").select("id, title, code").eq("teacher_id", uid);
    const courseIds = (courses || []).map((c) => c.id);
    if (!courseIds.length) { table.innerHTML = emptyState("لا توجد مقررات", "لا يوجد طلاب.", "users"); $("tsCount").textContent = "0"; return; }
    const courseMap = new Map((courses || []).map((c) => [c.id, c]));
    const { data: enrs, error } = await supabase.from("enrollments").select("course_id, student_id, status").in("course_id", courseIds);
    if (error) { table.innerHTML = emptyState("تعذّر تحميل الطلاب", error.message || "", "users"); $("tsCount").textContent = "—"; return; }
    const studentIds = [...new Set((enrs || []).map((e) => e.student_id))];
    const { data: users } = await supabase.from("users").select("id, name, email, university_id, is_active, track, level").in("id", studentIds.length ? studentIds : [0]);
    const uMap = new Map((users || []).map((u) => [u.id, u]));
    const rows = (enrs || []).map((e) => {
      const u = uMap.get(e.student_id) || {};
      const c = courseMap.get(e.course_id) || {};
      return `<tr>
        <td>${esc(u.name || "—")}</td>
        <td>${esc(u.email || "—")}</td>
        <td>${esc(u.university_id || "—")}</td>
        <td>${esc(c.code || "—")} — ${esc(c.title || "—")}</td>
        <td>${e.status === "active" ? "نشط" : (e.status || "—")}</td>
      </tr>`;
    }).join("");
    table.innerHTML = rows
      ? `<div class="td-table-wrap"><table class="td-table">
          <thead><tr><th>الاسم</th><th>البريد</th><th>الرقم الجامعي</th><th>المقرر</th><th>الحالة</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`
      : emptyState("لا يوجد طلاب", "لا يوجد طلاب مسجّلون.", "users");
    $("tsCount").textContent = `${fmtNum(studentIds.length)}`;
  },
});
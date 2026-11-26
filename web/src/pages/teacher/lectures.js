import { boot } from "../../lib/portal.js";
import { supabase } from "../../lib/supabase.js";
import { esc, fmtDateTime, fmtNum } from "../../lib/fmt.js";
import { icon } from "../../lib/icons.js";
import { $, emptyState } from "./common.js";

boot({
  portal: "teacher",
  title: "محاضراتي",
  render: async ({ profile }) => {
    const uid = profile?.id;
    const table = $("tlTable");
    table.innerHTML = `<div class="td-skeleton td-skeleton-row"></div>`.repeat(5);
    if (!uid) { table.innerHTML = emptyState("تعذّر تحديد المستخدم", "", "lectures"); return; }
    const { data: courses } = await supabase.from("courses").select("id, title, code").eq("teacher_id", uid);
    const courseIds = (courses || []).map((c) => c.id);
    if (!courseIds.length) { table.innerHTML = emptyState("لا توجد مقررات", "لا توجد محاضرات.", "lectures"); return; }
    const courseMap = new Map((courses || []).map((c) => [c.id, c]));
    const { data, error } = await supabase.from("lectures").select("id, course_id, title, lecture_type, scheduled_at, duration_min, status").in("course_id", courseIds).order("scheduled_at", { ascending: false });
    if (error) { table.innerHTML = emptyState("تعذّر تحميل المحاضرات", error.message || "", "lectures"); return; }
    const list = Array.isArray(data) ? data : [];
    if (!list.length) { table.innerHTML = emptyState("لا توجد محاضرات", "لا توجد محاضرات.", "lectures"); return; }
    const rows = list.map((l) => `<tr>
      <td>${esc(l.title || "—")}</td>
      <td>${esc(courseMap.get(l.course_id)?.title || "—")}</td>
      <td>${esc(l.lecture_type || "—")}</td>
      <td>${l.scheduled_at ? fmtDateTime(l.scheduled_at) : "—"}</td>
      <td>${l.duration_min || "—"} د</td>
      <td>${l.status || "—"}</td>
    </tr>`).join("");
    table.innerHTML = `<div class="td-table-wrap"><table class="td-table">
      <thead><tr><th>العنوان</th><th>المقرر</th><th>النوع</th><th>الموعد</th><th>المدة</th><th>الحالة</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  },
});
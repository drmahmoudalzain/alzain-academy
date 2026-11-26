import { boot } from "../../lib/portal.js";
import { supabase } from "../../lib/supabase.js";
import { esc, fmtDateTime, fmtNum } from "../../lib/fmt.js";
import { icon } from "../../lib/icons.js";
import { $, emptyState } from "./common.js";

boot({
  portal: "teacher",
  title: "اختباراتي",
  render: async ({ profile }) => {
    const uid = profile?.id;
    const table = $("teTable");
    table.innerHTML = `<div class="td-skeleton td-skeleton-row"></div>`.repeat(5);
    if (!uid) { table.innerHTML = emptyState("تعذّر تحديد المستخدم", "", "exams"); return; }
    const { data: courses } = await supabase.from("courses").select("id, title, code").eq("teacher_id", uid);
    const courseIds = (courses || []).map((c) => c.id);
    if (!courseIds.length) { table.innerHTML = emptyState("لا توجد مقررات", "لا توجد اختبارات.", "exams"); return; }
    const courseMap = new Map((courses || []).map((c) => [c.id, c]));
    const { data, error } = await supabase.from("exams").select("id, course_id, title, exam_kind, starts_at, ends_at, duration_min, is_published").in("course_id", courseIds).order("starts_at", { ascending: false });
    if (error) { table.innerHTML = emptyState("تعذّر تحميل الاختبارات", error.message || "", "exams"); return; }
    const list = Array.isArray(data) ? data : [];
    if (!list.length) { table.innerHTML = emptyState("لا توجد اختبارات", "لا توجد اختبارات.", "exams"); return; }
    const rows = list.map((e) => `<tr>
      <td>${esc(e.title || "—")}</td>
      <td>${esc(courseMap.get(e.course_id)?.title || "—")}</td>
      <td>${e.exam_kind === "assignment" ? "واجب" : "اختبار"}</td>
      <td>${e.starts_at ? fmtDateTime(e.starts_at) : "—"}</td>
      <td>${e.ends_at ? fmtDateTime(e.ends_at) : "—"}</td>
      <td>${e.duration_min || "—"} د</td>
      <td>${e.is_published ? "منشور" : "مسودة"}</td>
    </tr>`).join("");
    table.innerHTML = `<div class="td-table-wrap"><table class="td-table">
      <thead><tr><th>العنوان</th><th>المقرر</th><th>النوع</th><th>البداية</th><th>النهاية</th><th>المدة</th><th>الحالة</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  },
});
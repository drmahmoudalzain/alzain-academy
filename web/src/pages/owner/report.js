import { boot } from "../../lib/portal.js";
import { supabase } from "../../lib/supabase.js";
import { esc, fmtNum } from "../../lib/fmt.js";
import { icon } from "../../lib/icons.js";

const $ = (id) => document.getElementById(id);

boot({
  portal: "owner",
  title: "التقرير الشامل",
  render: async () => {
    $("orStats").innerHTML = `<div class="od-skeleton od-skeleton-stat"></div>`.repeat(6);
    $("orTable").innerHTML = `<div class="od-skeleton od-skeleton-row" aria-hidden="true"></div>`.repeat(4);

    const tasks = {
      students: supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "student"),
      teachers: supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "teacher"),
      assistants: supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "assistant"),
      courses: supabase.from("courses").select("id", { count: "exact", head: true }).eq("archived", false),
      lectures: supabase.from("lectures").select("id", { count: "exact", head: true }),
      exams: supabase.from("exams").select("id", { count: "exact", head: true }),
      assignments: supabase.from("assignments").select("id", { count: "exact", head: true }),
      submissions: supabase.from("submissions").select("id", { count: "exact", head: true }),
      coursesList: supabase.from("courses").select("id, title, code, teacher_id, archived").order("title"),
    };
    const keys = Object.keys(tasks);
    const settled = await Promise.allSettled(keys.map((k) => tasks[k]));
    const val = (k) => (settled[keys.indexOf(k)].status === "fulfilled" ? settled[keys.indexOf(k)].value : null);

    const stats = [
      { label: "الطلاب", value: val("students")?.count },
      { label: "الأساتذة", value: val("teachers")?.count },
      { label: "المساعدون", value: val("assistants")?.count },
      { label: "المقررات النشطة", value: val("courses")?.count },
      { label: "المحاضرات", value: val("lectures")?.count },
      { label: "الاختبارات", value: val("exams")?.count },
      { label: "الواجبات", value: val("assignments")?.count },
      { label: "التسليمات", value: val("submissions")?.count },
    ];
    $("orStats").innerHTML = stats.map((s) => `
      <div class="od-mini">
        <span class="od-mini-icon">${icon("grades")}</span>
        <span class="od-mini-body">
          <span class="od-mini-value">${esc(s.value == null ? "—" : fmtNum(s.value))}</span>
          <span class="od-mini-label">${esc(s.label)}</span>
        </span>
      </div>
    `).join("");

    const courses = val("coursesList")?.data || [];
    if (!courses.length) {
      $("orTable").innerHTML = `<div class="od-empty" role="status"><span class="od-empty-icon">${icon("courses")}</span><h3>لا توجد مقررات</h3></div>`;
      return;
    }
    // enrollments per course
    const { data: enrs } = await supabase.from("enrollments").select("course_id, status");
    const enrMap = new Map();
    for (const e of (enrs || [])) {
      if (!enrMap.has(e.course_id)) enrMap.set(e.course_id, { active: 0, total: 0 });
      const o = enrMap.get(e.course_id);
      o.total++;
      if (e.status === "active") o.active++;
    }
    const { data: teachers } = await supabase.from("users").select("id, name").eq("role", "teacher");
    const tMap = new Map((teachers || []).map((t) => [t.id, t.name]));
    const rows = courses.map((c) => {
      const o = enrMap.get(c.id) || { active: 0, total: 0 };
      return `<tr>
        <td>${esc(c.code || "—")}</td>
        <td>${esc(c.title || "—")}</td>
        <td>${esc(tMap.get(c.teacher_id) || "—")}</td>
        <td>${o.active}/${o.total}</td>
        <td>${c.archived ? "أرشيف" : "نشط"}</td>
      </tr>`;
    }).join("");
    $("orTable").innerHTML = `<div class="od-table-wrap"><table class="od-table">
      <thead><tr><th>الرمز</th><th>المقرر</th><th>الأستاذ</th><th>تسجيلات (نشط/إجمالي)</th><th>الحالة</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  },
});
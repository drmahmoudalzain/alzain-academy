import { boot } from "../../lib/portal.js";
import { supabase } from "../../lib/supabase.js";
import { esc, fmtNum } from "../../lib/fmt.js";
import { icon } from "../../lib/icons.js";
import { p } from "../../lib/base.js";

const $ = (id) => document.getElementById(id);

boot({
  portal: "student",
  title: "مقرراتي",
  render: async ({ profile }) => {
    const uid = profile?.id;
    const grid = $("scGrid");
    grid.innerHTML = `<div class="lcs-skeleton lcs-skeleton-card"></div>`.repeat(3);
    if (!uid) {
      grid.innerHTML = `<div class="lcs-empty" role="status"><h3>تعذّر تحديد المستخدم</h3></div>`;
      return;
    }
    const { data: enrs, error: e1 } = await supabase
      .from("enrollments")
      .select("course_id, status, created_at")
      .eq("student_id", uid);
    if (e1) {
      grid.innerHTML = `<div class="lcs-empty" role="status"><h3>تعذّر تحميل المقررات</h3><p>${esc(e1.message || "")}</p></div>`;
      return;
    }
    const ids = (enrs || []).map((e) => e.course_id);
    if (!ids.length) {
      grid.innerHTML = `<div class="lcs-empty" role="status"><h3>لا توجد مقررات مسجّلة</h3></div>`;
      return;
    }
    const { data: courses, error: e2 } = await supabase
      .from("courses")
      .select("id, title, code, color, track, level, teacher_id, archived")
      .in("id", ids);
    if (e2) {
      grid.innerHTML = `<div class="lcs-empty" role="status"><h3>تعذّر تحميل المقررات</h3><p>${esc(e2.message || "")}</p></div>`;
      return;
    }
    const { data: teachers } = await supabase.from("users").select("id, name").eq("role", "teacher");
    const tMap = new Map((teachers || []).map((t) => [t.id, t.name]));
    const enrMap = new Map((enrs || []).map((e) => [e.course_id, e]));
    const cards = (courses || []).map((c) => {
      const enr = enrMap.get(c.id);
      return `<article class="lcs-card">
        <div class="lcs-card-head">
          <span class="lcs-card-code">${esc(c.code || "—")}</span>
          <span class="lcs-card-status">${enr?.status === "active" ? "نشط" : (enr?.status || "—")}</span>
        </div>
        <h3>${esc(c.title || "—")}</h3>
        <p class="lcs-card-sub">${esc(tMap.get(c.teacher_id) || "—")} · ${esc(c.track || "—")} · مستوى ${c.level || "—"}</p>
        <div class="lcs-card-actions">
          <a class="lcs-btn" href="${esc(p(`pages/student/lectures.html`))}">${icon("lectures")} المحاضرات</a>
          <a class="lcs-btn" href="${esc(p(`pages/student/exams.html`))}">${icon("exams")} الاختبارات</a>
        </div>
      </article>`;
    }).join("");
    grid.innerHTML = cards || `<div class="lcs-empty" role="status"><h3>لا توجد مقررات</h3></div>`;
  },
});
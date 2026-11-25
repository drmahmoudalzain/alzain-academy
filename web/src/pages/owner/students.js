import { boot } from "../../lib/portal.js";
import { supabase } from "../../lib/supabase.js";
import { call } from "../../lib/api.js";
import { esc, fmtNum } from "../../lib/fmt.js";
import { icon } from "../../lib/icons.js";

const $ = (id) => document.getElementById(id);

boot({
  portal: "owner",
  title: "الطلاب",
  render: async () => {
    if ($("ostSubmitBtn")) $("ostSubmitBtn").innerHTML = `<span class="od-btn-spinner"></span>${icon("check")} تسجيل`;
    // load courses for enroll form
    const { data: courses } = await supabase.from("courses").select("id, title, code").order("title");
    const courseOpts = (courses || []).map((c) => `<option value="${c.id}">${esc(c.code || "")} — ${esc(c.title || "")}</option>`).join("");
    $("ostCourse").innerHTML = courseOpts || `<option value="">لا يوجد</option>`;

    // load students
    $("ostTable").innerHTML = `<div class="od-skeleton od-skeleton-row" aria-hidden="true"></div>`.repeat(5);
    const { data: users, error } = await supabase.from("users").select("id, name, email, university_id, platform_id, is_active, track, level, created_at").eq("role", "student").order("name");
    if (error) {
      $("ostTable").innerHTML = `<div class="od-empty" role="status"><span class="od-empty-icon">${icon("users")}</span><h3>تعذّر تحميل الطلاب</h3><p>${esc(error.message || "")}</p></div>`;
      $("ostCount").textContent = "—";
      return;
    }
    const list = Array.isArray(users) ? users : [];
    if (!list.length) {
      $("ostTable").innerHTML = `<div class="od-empty" role="status"><span class="od-empty-icon">${icon("users")}</span><h3>لا يوجد طلاب</h3></div>`;
      $("ostCount").textContent = "0";
      return;
    }
    // enrollments count per student
    const { data: enrs } = await supabase.from("enrollments").select("student_id, status");
    const enrMap = new Map();
    for (const e of (enrs || [])) {
      if (!enrMap.has(e.student_id)) enrMap.set(e.student_id, { active: 0, total: 0 });
      const o = enrMap.get(e.student_id);
      o.total++;
      if (e.status === "active") o.active++;
    }
    const rows = list.map((u) => {
      const o = enrMap.get(u.id) || { active: 0, total: 0 };
      return `<tr>
        <td>${esc(u.name || "—")}</td>
        <td>${esc(u.email || "—")}</td>
        <td>${esc(u.university_id || "—")}</td>
        <td>${esc(u.track || "—")}</td>
        <td>${u.level || "—"}</td>
        <td>${u.is_active ? "✅" : "⛔"}</td>
        <td>${o.active}/${o.total}</td>
      </tr>`;
    }).join("");
    $("ostTable").innerHTML = `<div class="od-table-wrap"><table class="od-table">
      <thead><tr><th>الاسم</th><th>البريد</th><th>الرقم الجامعي</th><th>المسار</th><th>المستوى</th><th>الحالة</th><th>تسجيلات</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
    $("ostCount").textContent = `${fmtNum(list.length)}`;

    $("ostEnrollForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      const msg = $("ostEnrollMsg");
      const btn = document.querySelector("#ostEnrollForm button[type=submit]") || $("ostSubmitBtn");
      msg.textContent = "جارٍ التسجيل...";
      msg.className = "od-inline-msg";
      if (btn) { btn.classList.add("is-loading"); btn.disabled = true; }
      const res = await call("management_enroll_student", {
        p_course_id: Number(f.elements.course_id.value),
        p_identifier: f.elements.identifier.value,
      });
      if (btn) { btn.classList.remove("is-loading"); btn.disabled = false; }
      if (res?.ok) {
        msg.textContent = `تم تسجيل: ${res.data?.name || ""}`;
        msg.className = "od-inline-msg is-success";
        f.reset();
      } else {
        msg.textContent = res?.error || "فشل.";
        msg.className = "od-inline-msg is-error";
      }
    });
  },
});
import { boot } from "../../lib/portal.js";
import { supabase } from "../../lib/supabase.js";
import { esc, fmtDateTime, fmtNum } from "../../lib/fmt.js";
import { icon } from "../../lib/icons.js";
import { p } from "../../lib/base.js";

const $ = (id) => document.getElementById(id);

let allUsers = [];

async function loadUsers() {
  $("ouTable").innerHTML = `<div class="od-skeleton od-skeleton-row" aria-hidden="true"></div>`.repeat(6);
  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, role, is_active, university_id, platform_id, must_change_password, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    $("ouTable").innerHTML = `<div class="od-empty" role="status"><span class="od-empty-icon">${icon("users")}</span><h3>تعذّر تحميل المستخدمين</h3><p>${esc(error.message || "خطأ غير معروف")}</p></div>`;
    $("ouCount").textContent = "—";
    return;
  }
  allUsers = Array.isArray(data) ? data : [];
  applyFilters();
}

function roleLabel(role) {
  return role === "teacher" ? "أستاذ" : role === "assistant" ? "مساعد" : role === "student" ? "طالب" : role || "—";
}

function renderTable(users) {
  if (!users.length) {
    return `<div class="od-empty" role="status"><span class="od-empty-icon">${icon("users")}</span><h3>لا توجد نتائج</h3><p>جرّب تغيير التصفية أو البحث.</p></div>`;
  }
  const rows = users.map((u) => `
    <tr>
      <td>${esc(u.name || "—")}</td>
      <td>${esc(u.email || "—")}</td>
      <td>${esc(roleLabel(u.role))}</td>
      <td>${esc(u.university_id || "—")}</td>
      <td>${u.is_active ? "✅ نشط" : "⛔ معطل"}</td>
      <td>${esc(u.must_change_password ? "نعم" : "لا")}</td>
      <td>${u.created_at ? fmtDateTime(u.created_at) : "—"}</td>
    </tr>
  `).join("");
  return `<div class="od-table-wrap"><table class="od-table">
    <thead><tr><th>الاسم</th><th>البريد</th><th>الدور</th><th>الرقم الجامعي</th><th>الحالة</th><th>تغيير كلمة المرور</th><th>تاريخ الإنشاء</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function applyFilters() {
  const role = $("ouRole").value;
  const q = $("ouSearch").value.trim().toLowerCase();
  const activeOnly = $("ouActiveOnly").checked;
  const filtered = allUsers.filter((u) => {
    if (role !== "all" && u.role !== role) return false;
    if (activeOnly && !u.is_active) return false;
    if (q) {
      const hay = `${u.name || ""} ${u.email || ""} ${u.university_id || ""} ${u.platform_id || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  $("ouTable").innerHTML = renderTable(filtered);
  $("ouCount").textContent = `${fmtNum(filtered.length)} / ${fmtNum(allUsers.length)}`;
}

boot({
  portal: "owner",
  title: "المستخدمون",
  render: async () => {
    if ($("ouRefresh")) $("ouRefresh").innerHTML = `${icon("refresh")} تحديث`;
    ["ouRole", "ouSearch", "ouActiveOnly"].forEach((id) => {
      const el = $(id);
      if (!el) return;
      const evt = (el.tagName === "INPUT" && el.type === "checkbox") ? "change" : (el.tagName === "SELECT" ? "change" : "input");
      el.addEventListener(evt, applyFilters);
    });
    const refreshBtn = $("ouRefresh");
    if (refreshBtn) refreshBtn.addEventListener("click", async () => {
      refreshBtn.classList.add("is-loading");
      refreshBtn.disabled = true;
      await loadUsers();
      refreshBtn.classList.remove("is-loading");
      refreshBtn.disabled = false;
    });
    await loadUsers();
  },
});
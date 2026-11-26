import { boot } from "../../lib/portal.js";
import { supabase } from "../../lib/supabase.js";
import { esc, fmtDateTime, fmtNum } from "../../lib/fmt.js";
import { icon } from "../../lib/icons.js";
import { p } from "../../lib/base.js";
import { invokeOwnerAdmin, generateTemporaryPassword } from "../../lib/owner-admin.js";

const $ = (id) => document.getElementById(id);

let allUsers = [];
let editingId = null;
let busy = false;
let suspendedOnly = false;

async function callRpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message || "تعذّر تنفيذ العملية");
  if (data && typeof data === "object" && "ok" in data && data.ok !== true) {
    throw new Error(data.error || "تعذّر تنفيذ العملية");
  }
  return data;
}

function showMessage(id, text, kind = "") {
  const el = $(id);
  if (!el) return;
  el.className = `od-inline-msg${kind ? ` od-inline-msg--${kind}` : ""}`;
  el.textContent = text;
  el.hidden = !text;
}

function showNotice(text, kind = "") {
  showMessage("ouNotice", text, kind);
}

function setBusy(button, state) {
  if (!button) return;
  button.disabled = state;
  button.classList.toggle("is-loading", state);
}

function roleLabel(role) {
  return role === "teacher" ? "أستاذ" : role === "assistant" ? "مساعد" : role === "student" ? "طالب" : role || "—";
}

function syncFormFields(role, track = null) {
  const student = role === "student";
  const bachelor = student && (track === "bachelor_m" || track === "bachelor_f");
  const trackField = $("ouTrackField");
  if (trackField) trackField.hidden = !student;
  const levelField = $("ouLevelField");
  if (levelField) levelField.hidden = !bachelor;
  const universityField = $("ouUniversityField");
  if (universityField) universityField.hidden = !student;
  const genderField = $("ouGenderField");
  if (genderField) genderField.hidden = !student;
  const position = $("ouPositionField");
  if (position) position.hidden = student;
}

function openForm(user = null) {
  const panel = $("ouFormPanel");
  if (!panel) return;
  editingId = user?.id ?? null;
  $("ouForm").reset();
  $("ouUserId").value = editingId ?? "";
  $("ouTemporaryField").hidden = true;
  $("ouTemporaryPassword").value = "";
  $("ouFormTitle").textContent = editingId ? "تعديل مستخدم" : "إضافة مستخدم جديد";
  showMessage("ouFormMsg", "");

  const role = user?.role || "student";
  const track = user?.track || "";
  $("ouFormRole").value = role;
  if (user) {
    $("ouName").value = user.name || "";
    $("ouEmail").value = user.email || "";
    $("ouPhone").value = user.phone || "";
    $("ouTrack").value = track;
    $("ouLevel").value = user.level ? String(user.level) : "";
    $("ouUniversityId").value = user.university_id || "";
    $("ouGender").value = user.gender || "";
    $("ouPosition").value = user.position || "";
    $("ouPlatformId").value = user.platform_id || "";
    $("ouMustChange").checked = Boolean(user.must_change_password);
  } else {
    $("ouPlatformId").value = "";
    $("ouMustChange").checked = true;
  }
  syncFormFields(role, track);
  panel.hidden = false;
  $("ouName").focus();
}

function closeForm() {
  const panel = $("ouFormPanel");
  if (panel) panel.hidden = true;
  editingId = null;
}

function readForm() {
  const role = $("ouFormRole").value;
  const student = role === "student";
  const track = student ? $("ouTrack").value : null;
  const bachelor = track === "bachelor_m" || track === "bachelor_f";
  const level = $("ouLevel").value;
  return {
    userId: $("ouUserId").value ? Number($("ouUserId").value) : null,
    name: $("ouName").value.trim(),
    email: $("ouEmail").value.trim() || null,
    phone: $("ouPhone").value.trim() || null,
    role,
    track,
    level: student && bachelor && level ? Number(level) : null,
    universityId: student ? ($("ouUniversityId").value.trim() || null) : null,
    gender: student ? ($("ouGender").value || null) : null,
    position: student ? null : ($("ouPosition").value.trim() || null),
    platformId: $("ouPlatformId").value.trim().toUpperCase(),
    mustChangePassword: $("ouMustChange").checked,
  };
}

async function createUser(values) {
  const { data: platformId, error: allocationError } = await supabase.rpc(
    "management_allocate_platform_id",
    { p_role: values.role, p_track: values.track },
  );
  if (allocationError) throw new Error(allocationError.message || "تعذّر حجز رمز المنصة");
  if (!platformId) throw new Error("تعذّر حجز رمز المنصة لهذا الدور والمسار");

  const password = generateTemporaryPassword();
  const result = await invokeOwnerAdmin({
    op: "create",
    password: password,
    platform_id: platformId,
    name: values.name,
    email: values.email,
    phone: values.phone,
    role: values.role,
    track: values.track,
    level: values.level,
    university_id: values.universityId,
    gender: values.gender,
    position: values.position,
  });
  if (!result.ok) throw new Error(result.error || "تعذّر إنشاء الحساب");

  $("ouTemporaryPassword").value = password;
  $("ouTemporaryField").hidden = false;
  showMessage(
    "ouFormMsg",
    `تم إنشاء الحساب برمز الدخول ${platformId}. كلمة المرور المؤقتة: ${password} — انسخها الآن، فهي لا تُعرض مرة أخرى.`,
    "success",
  );
  await loadUsers();
}

async function updateUser(values) {
  const before = allUsers.find((user) => user.id === values.userId) || {};
  const platformId = values.platformId || before.platform_id || "";
  const saved = await callRpc("management_update_user", {
    p_user_id: values.userId,
    p_name: values.name,
    p_email: values.email,
    p_phone: values.phone,
    p_university_id: values.universityId,
    p_platform_id: platformId,
    p_role: values.role,
    p_track: values.track,
    p_level: values.level,
    p_gender: values.gender,
    p_position: values.position,
  });
  if (!saved?.ok) throw new Error(saved?.error || "تعذّر حفظ التعديلات");

  const identityChanged = before.role !== values.role
    || String(before.platform_id || "").toUpperCase() !== platformId.toUpperCase();
  if (identityChanged) {
    const synced = await invokeOwnerAdmin({
      op: "sync_auth_identity",
      user_id: values.userId,
      role: values.role,
      platform_id: platformId,
    });
    if (!synced.ok) {
      showMessage("ouFormMsg", `حُفظت التعديلات، لكن تعذّر مزامنة هوية الدخول: ${synced.error || ""}`, "error");
    }
  }

  await callRpc("management_flag_password_change", {
    p_user_id: values.userId,
    p_value: values.mustChangePassword,
  });
  await loadUsers();
  if (!identityChanged || $("ouFormMsg").hidden) {
    showMessage("ouFormMsg", "تم حفظ التعديلات.", "success");
  }
}

async function toggleUser(button, user) {
  const active = !user.is_active;
  const question = active
    ? `سيُفعّل حساب ${user.name}. متابعة؟`
    : `سيُعطّل حساب ${user.name} وتُقطع جميع جلسات دخوله فوراً. متابعة؟`;
  if (!window.confirm(question)) return;

  setBusy(button, true);
  try {
    const changed = await callRpc("management_set_user_active", {
      p_user_id: user.id,
      p_active: active,
    });
    if (!changed?.ok) throw new Error(changed?.error || "تعذّر تغيير حالة الحساب");

    const result = await invokeOwnerAdmin({ op: "set_active", user_id: user.id, active: active });
    if (!result.ok) {
      await callRpc("management_set_user_active", { p_user_id: user.id, p_active: !active });
      throw new Error(result.error || "تعذّر مزامنة جلسات الدخول");
    }
    showNotice(active ? "تم تفعيل الحساب." : "تم تعطيل الحساب وقطع جلساته.", "success");
    await loadUsers();
  } catch (error) {
    showNotice(error?.message || String(error), "error");
  } finally {
    setBusy(button, false);
  }
}

async function resetPassword(button, user, op) {
  const password = generateTemporaryPassword();
  const action = op === "ensure_auth" ? "إنشاء حساب الدخول" : "إعادة تعيين كلمة المرور";
  if (!window.confirm(`${action} لـ ${user.name}؟ ستظهر كلمة المرور المؤقتة مرة واحدة فقط.`)) return;

  setBusy(button, true);
  try {
    const result = await invokeOwnerAdmin({ op: op, user_id: user.id, password: password });
    if (!result.ok) throw new Error(result.error || `تعذّر ${action}`);
    showNotice(`${action} لـ ${user.name}. كلمة المرور المؤقتة: ${password} — انسخها الآن.`, "success");
    await loadUsers();
  } catch (error) {
    showNotice(error?.message || String(error), "error");
  } finally {
    setBusy(button, false);
  }
}

async function deleteUser(button, user) {
  setBusy(button, true);
  try {
    const preflight = await callRpc("management_preflight_delete_user", { p_user_id: user.id });
    const info = preflight?.data || {};
    const counts = info.counts || {};
    const blockers = Array.isArray(info.blockers) ? info.blockers : [];
    const summary = [
      ["التسجيلات", counts.enrollments],
      ["الدرجات", counts.grades],
      ["الحضور", counts.attendance],
      ["النقاط", counts.points],
      ["الإشعارات", counts.notifications],
      ["المقررات المسندة", counts.courses],
      ["المؤلفات", counts.publications],
    ].map(([label, value]) => `${label}: ${fmtNum(value ?? 0)}`).join(" · ");

    const question = `حذف ${user.name} نهائياً؟ لا يمكن التراجع.\n\n${summary}`
      + (blockers.length ? `\n\nيمنع الحذف: ${blockers.join("، ")}` : "");
    if (!window.confirm(question)) return;
    if (blockers.length) {
      showNotice(blockers.join("، "), "error");
      return;
    }

    const result = await invokeOwnerAdmin({ op: "delete_user", user_id: user.id });
    if (!result.ok) {
      if (result.code === "retry_finalize" && result.data?.auth_id) {
        const retry = await supabase.rpc("management_delete_user_finalize", {
          p_user_id: user.id,
          p_expected_auth_id: result.data.auth_id,
        });
        if (!retry.error && retry.data?.ok) {
          showNotice("تم حذف المستخدم نهائياً.", "success");
          await loadUsers();
          return;
        }
      }
      throw new Error(result.error || "تعذّر حذف المستخدم");
    }
    showNotice("تم حذف المستخدم نهائياً.", "success");
    await loadUsers();
  } catch (error) {
    showNotice(error?.message || String(error), "error");
  } finally {
    setBusy(button, false);
  }
}

function showTableError(message) {
  $("ouTable").innerHTML = `<div class="od-empty" role="status"><span class="od-empty-icon">${icon("users")}</span><h3>تعذّر تحميل المستخدمين</h3><p>${esc(message || "خطأ غير معروف")}</p></div>`;
  $("ouCount").textContent = "—";
}

async function loadUsers() {
  const table = $("ouTable");
  table.innerHTML = `<div class="od-skeleton od-skeleton-row" aria-hidden="true"></div>`.repeat(6);
  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, name, email, phone, role, is_active, university_id, platform_id, auth_id, track, level, gender, position, must_change_password, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      showTableError(error.message);
      return;
    }
    allUsers = Array.isArray(data) ? data : [];
  } catch (error) {
    showTableError(error?.message || String(error));
    return;
  }
  applyFilters();
}

function renderTable(users) {
  if (!users.length) {
    return `<div class="od-empty" role="status"><span class="od-empty-icon">${icon("users")}</span><h3>لا توجد نتائج</h3><p>جرّب تغيير التصفية أو البحث.</p></div>`;
  }
  const rows = users.map((user) => `
    <tr>
      <td>${esc(user.name || "—")}<br /><span class="od-link" dir="ltr">${esc(user.platform_id || "—")}</span></td>
      <td dir="ltr">${esc(user.email || "—")}</td>
      <td>${esc(roleLabel(user.role))}</td>
      <td dir="ltr">${esc(user.university_id || "—")}</td>
      <td>${user.is_active ? "✅ نشط" : "⛔ معطل"}</td>
      <td>${esc(user.must_change_password ? "نعم" : "لا")}</td>
      <td>${user.created_at ? fmtDateTime(user.created_at) : "—"}</td>
      <td>
        <div class="od-btn-group">
          <button type="button" class="od-btn od-btn--small od-btn--ghost" data-action="edit" data-id="${user.id}" aria-label="تعديل ${esc(user.name || "")}">${icon("edit")} تعديل</button>
          <button type="button" class="od-btn od-btn--small od-btn--ghost" data-action="toggle" data-id="${user.id}">${icon(user.is_active ? "eyeOff" : "eye")} ${user.is_active ? "تعطيل" : "تفعيل"}</button>
          ${user.auth_id ? "" : `<button type="button" class="od-btn od-btn--small od-btn--ghost" data-action="ensure" data-id="${user.id}">${icon("shield")} إنشاء دخول</button>`}
          <button type="button" class="od-btn od-btn--small od-btn--ghost" data-action="reset" data-id="${user.id}">${icon("key")} كلمة مرور</button>
          <button type="button" class="od-btn od-btn--small od-btn--danger" data-action="delete" data-id="${user.id}">${icon("trash")} حذف</button>
        </div>
      </td>
    </tr>
  `).join("");
  return `<div class="od-table-wrap"><table class="od-table">
    <thead><tr><th>الاسم والرمز</th><th>البريد</th><th>الدور</th><th>الرقم الجامعي</th><th>الحالة</th><th>تغيير كلمة المرور</th><th>تاريخ الإنشاء</th><th>إجراءات</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function applyFilters() {
  const role = $("ouRole").value;
  const q = $("ouSearch").value.trim().toLowerCase();
  const activeOnly = $("ouActiveOnly").checked;
  if (activeOnly) suspendedOnly = false;
  const filtered = allUsers.filter((user) => {
    if (role !== "all" && user.role !== role) return false;
    if (activeOnly && !user.is_active) return false;
    if (suspendedOnly && user.is_active) return false;
    if (q) {
      const hay = `${user.name || ""} ${user.email || ""} ${user.university_id || ""} ${user.platform_id || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  $("ouTable").innerHTML = renderTable(filtered);
  $("ouCount").textContent = `${fmtNum(filtered.length)} / ${fmtNum(allUsers.length)}`;
}

function bindActions() {
  const newBtn = $("ouNewBtn");
  if (newBtn) newBtn.addEventListener("click", () => openForm());

  const cancelBtn = $("ouCancelBtn");
  if (cancelBtn) cancelBtn.addEventListener("click", closeForm);

  $("ouFormRole").addEventListener("change", (event) => syncFormFields(event.target.value, $("ouTrack").value));
  const trackSelect = $("ouTrack");
  if (trackSelect) trackSelect.addEventListener("change", () => syncFormFields($("ouFormRole").value, trackSelect.value));

  $("ouForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    const values = readForm();
    if (!values.name) {
      showMessage("ouFormMsg", "الاسم مطلوب.", "error");
      return;
    }
    if (values.role === "student" && !values.track) {
      showMessage("ouFormMsg", "اختر مسار الطالب.", "error");
      return;
    }
    busy = true;
    setBusy($("ouSaveBtn"), true);
    try {
      if (values.userId) await updateUser(values);
      else await createUser(values);
    } catch (error) {
      showMessage("ouFormMsg", error?.message || String(error), "error");
    } finally {
      busy = false;
      setBusy($("ouSaveBtn"), false);
    }
  });

  $("ouTable").addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button || button.disabled) return;
    const user = allUsers.find((item) => item.id === Number(button.dataset.id));
    if (!user) return;

    switch (button.dataset.action) {
      case "edit":
        openForm(user);
        break;
      case "toggle":
        await toggleUser(button, user);
        break;
      case "reset":
        await resetPassword(button, user, "reset_password");
        break;
      case "ensure":
        await resetPassword(button, user, "ensure_auth");
        break;
      case "delete":
        await deleteUser(button, user);
        break;
      default:
        break;
    }
  });
}

boot({
  portal: "owner",
  title: "المستخدمون",
  render: async () => {
    if ($("ouRefresh")) $("ouRefresh").innerHTML = `<span class="od-btn-spinner"></span> ${icon("refresh")} تحديث`;
    ["ouRole", "ouSearch", "ouActiveOnly"].forEach((id) => {
      const el = $(id);
      if (!el) return;
      const evt = (el.tagName === "INPUT" && el.type === "checkbox") ? "change" : (el.tagName === "SELECT" ? "change" : "input");
      el.addEventListener(evt, applyFilters);
    });
    const suspendedBtn = $("ouSuspendedOnly");
    if (suspendedBtn) suspendedBtn.addEventListener("click", () => {
      suspendedOnly = !suspendedOnly;
      const activeOnly = $("ouActiveOnly");
      if (activeOnly) activeOnly.checked = false;
      suspendedBtn.classList.toggle("is-active", suspendedOnly);
      suspendedBtn.textContent = suspendedOnly ? "عرض الكل" : "موقوفون فقط";
      applyFilters();
    });

    const refreshBtn = $("ouRefresh");
    if (refreshBtn) refreshBtn.addEventListener("click", async () => {
      refreshBtn.classList.add("is-loading");
      refreshBtn.disabled = true;
      await loadUsers();
      refreshBtn.classList.remove("is-loading");
      refreshBtn.disabled = false;
    });
    bindActions();
    await loadUsers();
    if (new URLSearchParams(location.search).get("new") === "1") openForm();
  },
});

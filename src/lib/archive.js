import { db } from "./supabase.js";
import { PORTALS } from "./portals.js";

/**
 * تسجيل محاولة دخول مرفوضة في archived_records باسم login_denied
 * (البريد/المعرّف، الدور، البوابة، IP، الوقت).
 */
export async function archiveDeniedLogin({ user, portal, identifier, ip }) {
  const portalInfo = PORTALS[portal];
  const label = `محاولة دخول مرفوضة — ${portalInfo?.label ?? portal}`;
  const data = {
    identifier: identifier ?? null,
    email: user?.email ?? null,
    university_id: user?.university_id ?? null,
    role: user?.role ?? null,
    is_staff: user?.is_staff ?? null,
    portal,
    portal_label: portalInfo?.label ?? portal,
    ip: ip ?? null,
    at: new Date().toISOString(),
  };

  const { error } = await db.from("archived_records").insert({
    table_name: "login_denied",
    record_id: user?.id ?? null,
    label,
    data,
    archived_by: null,
  });

  if (error) console.error("تعذر أرشفة محاولة الدخول المرفوضة:", error.message);
}

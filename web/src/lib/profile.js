// ملف احتياطي مشتق من بيانات Auth عند تعذّر قراءة جدول users.
// يُعاد مباشرة ولا يُخزَّن في الكاش: خطأ قاعدة بيانات عابر لا يجب أن يثبّت هوية لمدة دقائق.
export function profileFromMetadata(user) {
  const md = user?.user_metadata || {};
  const am = user?.app_metadata || {};
  return {
    id: am.academy_user_id ?? null,
    role: am.role || "student",
    name: md.full_name || user?.email || "مستخدم",
    email: md.contact_email || null,
    phone: md.phone || null,
    platform_id: md.platform_id || null,
    university_id: null,
    track: null,
    level: null,
    gender: null,
    position: null,
    is_staff: am.role === "teacher" || am.role === "assistant",
    must_change_password: false,
  };
}

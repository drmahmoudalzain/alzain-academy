// خريطة صلاحيات الأدوار. تُضاف الصلاحيات هنا أولاً، ثم تُستدعى من البوابات والمسارات.
// الهدف: توسيع صلاحيات المساعد لاحقاً لا يتطلب إعادة تصميم الدور أو تعديل عدة ملفات.

export const ROLE_PERMISSIONS = {
  // الابتدائية: عرض بيانات الطلاب وتصديرها فقط. لا تعديل، لا إنشاء حسابات، لا كلمات مرور.
  assistant: new Set(["students.view", "students.export"]),
};

export function roleCan(role, permission) {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

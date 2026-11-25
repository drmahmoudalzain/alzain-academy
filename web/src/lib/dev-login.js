// أزواج بيانات الدخول المحلية للتطوير فقط. لا تُقرأ إلا من import.meta.env.DEV.
const ROLES = [
  { key: "student", prefix: "VITE_DEV_STUDENT" },
  { key: "teacher", prefix: "VITE_DEV_TEACHER" },
  { key: "assistant", prefix: "VITE_DEV_ASSISTANT" },
];

export function devLogins(env) {
  if (!env || env.DEV !== true) return [];
  return ROLES.map((role) => ({
    key: role.key,
    id: env[`${role.prefix}_ID`] || "",
    password: env[`${role.prefix}_PASSWORD`] || "",
  })).filter((entry) => entry.id && entry.password);
}

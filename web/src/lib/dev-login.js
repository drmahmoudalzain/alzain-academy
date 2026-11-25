// أزواج بيانات الدخول للتطوير. تُفعّل في خادم Vite (DEV) أو في بناء
// development صريح (MODE) يُنشر كنسخة تجريبية؛ بناء الإنتاج لا يراها أبداً.
const ROLES = [
  { key: "owner", prefix: "VITE_DEV_OWNER" },
  { key: "student", prefix: "VITE_DEV_STUDENT" },
  { key: "teacher", prefix: "VITE_DEV_TEACHER" },
  { key: "teacher2", prefix: "VITE_DEV_TEACHER2" },
];

export function devLogins(env) {
  if (!env) return [];
  if (env.DEV !== true && env.MODE !== "development") return [];
  return ROLES.map((role) => ({
    key: role.key,
    id: env[`${role.prefix}_ID`] || "",
    password: env[`${role.prefix}_PASSWORD`] || "",
  })).filter((entry) => entry.id && entry.password);
}

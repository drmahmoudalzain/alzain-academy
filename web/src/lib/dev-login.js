// أزواج بيانات الدخول للتطوير فقط. تُفعّل في خادم Vite (DEV) أو في بناء
// development صريح (MODE) يُنشر كنسخة تجريبية؛ بناء الإنتاج لا يراها أبداً.
const ROLES = [
  { key: "student", prefix: "VITE_DEV_STUDENT" },
  { key: "teacher", prefix: "VITE_DEV_TEACHER" },
  { key: "assistant", prefix: "VITE_DEV_ASSISTANT" },
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

// تعريف قوائم التنقل لكل بوابة. تُستخدم في تخطيط البوابة الموحّد.
import { assessmentOf } from "./tracks.js";

/** قائمة التنقل لطالب مع إخفاء أداة التقييم غير المناسبة لمساره. */
export function studentNavigationFor(user) {
  const tool = assessmentOf(user?.track);
  return NAVIGATION.student.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.href === "/student/exams") return tool === "exam";
      if (item.href === "/student/assignments") return tool === "assignment";
      return true;
    }),
  }));
}

export function navigationFor(portalKey, user) {
  if (portalKey === "student") return studentNavigationFor(user);
  return NAVIGATION[portalKey] ?? [];
}

export const NAVIGATION = {
  student: [
    {
      section: "الرئيسية",
      items: [
        { label: "لوحة التحكم", href: "/student", icon: "home" },
        { label: "مقرراتي", href: "/student/courses", icon: "courses" },
        { label: "المحاضرات", href: "/student/lectures", icon: "lectures" },
        { label: "الاختبارات", href: "/student/exams", icon: "exams", badgeKey: "exams" },
        { label: "الواجبات", href: "/student/assignments", icon: "assignments", badgeKey: "assignments" },
      ],
    },
    {
      section: "التحصيل",
      items: [
        { label: "درجاتي", href: "/student/grades", icon: "grades" },
        { label: "نقاطي", href: "/student/points", icon: "points" },
      ],
    },
    {
      section: "التواصل",
      items: [
        { label: "المنتدى", href: "/forum", icon: "forum" },
      ],
    },
    {
      section: "المكتبة والدعم",
      items: [
        { label: "المكتبة", href: "/library", icon: "library" },
        { label: "المساعد الذكي", href: "/assistant", icon: "assistant" },
        { label: "الإشعارات", href: "/notifications", icon: "bell" },
      ],
    },
    {
      section: "الحساب",
      items: [
        { label: "حسابي", href: "/account", icon: "user" },
        { label: "تسجيل الخروج", href: "/logout", icon: "logout", method: "post" },
      ],
    },
  ],
  teacher: [
    {
      section: "الرئيسية",
      items: [
        { label: "لوحة التحكم", href: "/teacher", icon: "home" },
        { label: "مقرراتي", href: "/teacher/courses", icon: "courses" },
        { label: "المحاضرات", href: "/teacher/lectures", icon: "lectures" },
        { label: "الطلاب", href: "/teacher/students", icon: "users" },
        { label: "الاختبارات", href: "/teacher/exams", icon: "exams" },
        { label: "الواجبات", href: "/teacher/assignments", icon: "assignments" },
      ],
    },
    {
      section: "التواصل",
      items: [
        { label: "المنتدى", href: "/forum", icon: "forum" },
      ],
    },
    {
      section: "المكتبة والدعم",
      items: [
        { label: "المكتبة", href: "/library", icon: "library" },
        { label: "المساعد الذكي", href: "/assistant", icon: "assistant" },
        { label: "الإشعارات", href: "/notifications", icon: "bell" },
      ],
    },
    {
      section: "الحساب",
      items: [
        { label: "حسابي", href: "/account", icon: "user" },
        { label: "تسجيل الخروج", href: "/logout", icon: "logout", method: "post" },
      ],
    },
  ],
  owner: [
    {
      section: "الإدارة",
      items: [
        { label: "لوحة التحكم", href: "/owner", icon: "home" },
        { label: "المستخدمون", href: "/owner/users", icon: "users" },
        { label: "الموظفون", href: "/owner/staff", icon: "user" },
        { label: "المقررات", href: "/owner/courses", icon: "courses" },
        { label: "الطلاب", href: "/owner/students", icon: "users" },
        { label: "المنتدى", href: "/forum", icon: "forum" },
        { label: "الإشعارات", href: "/notifications", icon: "bell" },
        { label: "التقارير", href: "/owner/report/html", icon: "grades" },
        { label: "الأرشيف", href: "/owner/archive", icon: "archive" },
        { label: "الإعدادات", href: "/owner/settings", icon: "settings" },
      ],
    },
    {
      section: "الحساب",
      items: [
        { label: "حسابي", href: "/account", icon: "user" },
        { label: "تسجيل الخروج", href: "/logout", icon: "logout", method: "post" },
      ],
    },
  ],
};

// تعريف قوائم التنقل لكل بوابة (نسخة العميل من src/lib/navigation.js).
// تُفلتر حسب مسار الطالب (اختبار أم واجب) عند البناء.

export const NAVIGATION = {
  student: [
    { section: "الرئيسية", items: [
      { label: "لوحة التحكم", href: "pages/student/dashboard.html", icon: "home" },
      { label: "مقرراتي", href: "pages/student/courses.html", icon: "courses" },
      { label: "المحاضرات", href: "pages/student/lectures.html", icon: "lectures" },
      { label: "الاختبارات", href: "pages/student/exams.html", icon: "exams" },
      { label: "الواجبات", href: "pages/student/assignments.html", icon: "assignments" },
    ] },
    { section: "التحصيل", items: [
      { label: "درجاتي", href: "pages/student/grades.html", icon: "grades" },
      { label: "نقاطي", href: "pages/student/points.html", icon: "points" },
    ] },
    { section: "التواصل", items: [
      { label: "المنتدى", href: "forum.html", icon: "forum" },
    ] },
    { section: "المكتبة والدعم", items: [
      { label: "الإشعارات", href: "pages/notifications.html", icon: "bell" },
      { label: "دليل المستخدم", href: "guide.html", icon: "file" },
    ] },
    { section: "الحساب", items: [
      { label: "حسابي", href: "pages/account.html", icon: "user" },
    ] },
  ],
  teacher: [
    { section: "الرئيسية", items: [
      { label: "لوحة التحكم", href: "pages/teacher/dashboard.html", icon: "home" },
      { label: "مقرراتي", href: "pages/teacher/courses.html", icon: "courses" },
      { label: "المحاضرات", href: "pages/teacher/lectures.html", icon: "lectures" },
      { label: "الطلاب", href: "pages/teacher/students.html", icon: "users" },
      { label: "الاختبارات", href: "pages/teacher/exams.html", icon: "exams" },
    ] },
    { section: "المكتبة والدعم", items: [
      { label: "الإشعارات", href: "pages/notifications.html", icon: "bell" },
      { label: "دليل المستخدم", href: "guide.html", icon: "file" },
    ] },
    { section: "الحساب", items: [
      { label: "حسابي", href: "pages/account.html", icon: "user" },
    ] },
  ],
  assistant: [
    { section: "المتابعة", items: [
      { label: "لوحة التحكم", href: "pages/assistant/dashboard.html", icon: "home" },
      { label: "الطلاب", href: "pages/assistant/students.html", icon: "users" },
      { label: "دليل المستخدم", href: "guide.html", icon: "file" },
    ] },
    { section: "الحساب", items: [
      { label: "حسابي", href: "pages/account.html", icon: "user" },
    ] },
  ],
  owner: [
    { section: "الإدارة", items: [
      { label: "لوحة التحكم", href: "pages/owner/dashboard.html", icon: "home" },
      { label: "المستخدمون", href: "pages/owner/users.html", icon: "users" },
      { label: "الموظفون", href: "pages/owner/staff.html", icon: "user" },
      { label: "المقررات", href: "pages/owner/courses.html", icon: "courses" },
      { label: "المحاضرات", href: "pages/owner/lectures.html", icon: "lectures" },
      { label: "الطلاب", href: "pages/owner/students.html", icon: "users" },
      { label: "الإشعارات", href: "pages/notifications.html", icon: "bell" },
      { label: "التقارير", href: "pages/owner/report.html", icon: "grades" },
      { label: "الأرشيف", href: "pages/owner/archive.html", icon: "archive" },
      { label: "الإعدادات", href: "pages/owner/settings.html", icon: "settings" },
      { label: "دليل المستخدم", href: "guide.html", icon: "file" },
    ] },
    { section: "الحساب", items: [
      { label: "حسابي", href: "pages/account.html", icon: "user" },
    ] },
  ],
};

export function navFor(portalKey, profile) {
  let nav = NAVIGATION[portalKey] || [];
  if (portalKey === "student") {
    const tool = assessmentOf(profile?.track);
    nav = nav.map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.href.endsWith("/exams.html")) return tool === "exam";
        if (item.href.endsWith("/assignments.html")) return tool === "assignment";
        return true;
      }),
    }));
  }
  return nav;
}

function assessmentOf(track) {
  // يقابل src/lib/tracks.js: مسارات الواجبات تُخفى عن مسارات الاختبارات والعكس.
  const examTracks = ["bachelor", "bachelor_m", "equiv", "external"];
  return track && examTracks.includes(track) ? "exam" : "assignment";
}

// تعريف مسارات الطلاب ونظام التقييم المعتمد لكل مسار.
// لإضافة قسم جديد مستقبلاً: أضف سطراً في TRACK_PROFILES فقط (أوزان الحضور والاختبارات والواجبات).
// ملاحظة: التمييز مبني على مسار الطالب (users.track) بصرف النظر عن مسار المقرر.

export const TRACK_PROFILES = {
  bachelor: {
    key: "bachelor",
    label: "مسار البكالوريوس",
    attendance: 30,
    exams: 70,
    assignments: 0,
    tool: "exam",
  },
  equiv: {
    key: "equiv",
    label: "قسم المعادلة",
    attendance: 30,
    exams: 0,
    assignments: 70,
    tool: "assignment",
  },
};

export const DEFAULT_TRACK = "bachelor";

export function getProfile(track) {
  return TRACK_PROFILES[track] ?? TRACK_PROFILES[DEFAULT_TRACK];
}

/** أداة التقييم المناسبة للمسار: 'exam' أو 'assignment'. */
export function assessmentOf(track) {
  return getProfile(track).tool;
}

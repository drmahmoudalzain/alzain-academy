// تعريف مسارات الطلاب ونظام التقييم المعتمد لكل مسار.
// نظامان: المنفصلة (بكالوريوس — طلاب لوحدهم وطالبات لوحدهن) والمختلطة (المعادلة ومن الخارج والدراسات العليا).

export const TRACK_PROFILES = {
  bachelor_m: {
    key: "bachelor_m",
    label: "مسار الطلاب",
    short: "بكالوريوس — طلاب",
    system: "separate",
    systemLabel: "المنفصلة",
    attendance: 30,
    exams: 70,
    assignments: 0,
    tool: "exam",
  },
  bachelor_f: {
    key: "bachelor_f",
    label: "مسار الطالبات",
    short: "بكالوريوس — طالبات",
    system: "separate",
    systemLabel: "المنفصلة",
    attendance: 30,
    exams: 70,
    assignments: 0,
    tool: "exam",
  },
  equiv: {
    key: "equiv",
    label: "قسم المعادلة",
    short: "المعادلة",
    system: "mixed",
    systemLabel: "المختلطة",
    attendance: 30,
    exams: 0,
    assignments: 70,
    tool: "assignment",
  },
  external: {
    key: "external",
    label: "قسم طلاب من الخارج",
    short: "طلاب من الخارج",
    system: "mixed",
    systemLabel: "المختلطة",
    attendance: 30,
    exams: 0,
    assignments: 70,
    tool: "assignment",
  },
  grad: {
    key: "grad",
    label: "قسم الدراسات العليا",
    short: "الدراسات العليا",
    system: "mixed",
    systemLabel: "المختلطة",
    attendance: 30,
    exams: 0,
    assignments: 70,
    tool: "assignment",
  },
};

export const TRACK_KEYS = Object.keys(TRACK_PROFILES);
export const DEFAULT_TRACK = "bachelor_m";

export function getProfile(track) {
  return TRACK_PROFILES[track] ?? TRACK_PROFILES[DEFAULT_TRACK];
}

/** أداة التقييم المناسبة للمسار: 'exam' أو 'assignment'. */
export function assessmentOf(track) {
  return getProfile(track).tool;
}

/** نظام الدراسة: 'separate' (منفصلة/مختلطة). */
export function isSeparateTrack(track) {
  return getProfile(track).system === "separate";
}

/** هل المسار مختلط (طلاب وطالبات معاً)؟ */
export function isMixedTrack(track) {
  return getProfile(track).system === "mixed";
}

/** ترتيب ثابت للأقسام للتقارير. */
export function trackRank(track) {
  return TRACK_KEYS.indexOf(getProfile(track).key);
}

/** التحقق من صحة قيمة المسار مع قيمة افتراضية. */
export function parseTrackKey(value, fallback = DEFAULT_TRACK) {
  const raw = String(value ?? "").trim();
  return TRACK_KEYS.includes(raw) ? raw : fallback;
}

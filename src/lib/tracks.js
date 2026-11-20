// تعريف مسارات الطلاب ونظام التقييم المعتمد لكل مسار.
// نظامان: المنفصلة (بكالوريوس — طلاب لوحدهم وطالبات لوحدهن) والمختلطة (المعادلة ومن الخارج والدراسات العليا).

export const TRACK_PROFILES = {
  // المقرر الأصلي المشترك: يُسجَّل فيه الطلاب والطالبات معاً (محاضرة إلكترونية جامعة).
  bachelor: {
    key: "bachelor",
    label: "بكالوريوس — مشترك",
    short: "بكالوريوس (الأصل)",
    system: "mixed",
    systemLabel: "المختلطة",
    attendance: 100,
    interaction: 100,
    exams: 100,
    assignments: 0,
    tool: "exam",
  },
  bachelor_m: {
    key: "bachelor_m",
    label: "مسار الطلاب",
    short: "بكالوريوس — طلاب",
    system: "separate",
    systemLabel: "المنفصلة",
    attendance: 100,
    interaction: 100,
    exams: 100,
    assignments: 0,
    tool: "exam",
  },
  bachelor_f: {
    key: "bachelor_f",
    label: "مسار الطالبات",
    short: "بكالوريوس — طالبات",
    system: "separate",
    systemLabel: "المنفصلة",
    attendance: 100,
    interaction: 100,
    exams: 100,
    assignments: 0,
    tool: "exam",
  },
  equiv: {
    key: "equiv",
    label: "قسم المعادلة",
    short: "المعادلة",
    system: "mixed",
    systemLabel: "المختلطة",
    attendance: 0,
    interaction: 0,
    exams: 0,
    assignments: 300,
    tool: "assignment",
  },
  external: {
    key: "external",
    label: "قسم طلاب من الخارج",
    short: "طلاب من الخارج",
    system: "mixed",
    systemLabel: "المختلطة",
    attendance: 0,
    interaction: 0,
    exams: 0,
    assignments: 300,
    tool: "assignment",
  },
  grad: {
    key: "grad",
    label: "قسم الدراسات العليا",
    short: "الدراسات العليا",
    system: "mixed",
    systemLabel: "المختلطة",
    attendance: 0,
    interaction: 0,
    exams: 0,
    assignments: 300,
    tool: "assignment",
  },
};

export const TRACK_KEYS = Object.keys(TRACK_PROFILES);
export const DEFAULT_TRACK = "bachelor_m";

// «bachelor» مسار المقرر الأصلي المشترك فقط، ولا يجوز أن يكون مسار حساب طالب.
export const STUDENT_TRACK_KEYS = TRACK_KEYS.filter((key) => key !== "bachelor");

/** مسار طالب صالح: يستبعد «bachelor» ويعيد الافتراضي عند أي قيمة غير مسموحة. */
export function parseStudentTrack(value, fallback = DEFAULT_TRACK) {
  const raw = String(value ?? "").trim();
  if (STUDENT_TRACK_KEYS.includes(raw)) return raw;
  // القيمة الاحتياطية نفسها قد تكون غير صالحة (مثل حساب قديم على «bachelor»).
  return STUDENT_TRACK_KEYS.includes(fallback) ? fallback : DEFAULT_TRACK;
}

/**
 * حلّ ما يكتبه المستخدم في عمود «المسار/النوع» إلى مفتاح مسار معروف.
 * يقبل المفاتيح والرموز والأسماء العربية والإنجليزية (طلاب/طالبات، ذكر/أنثى...).
 * يُرجع null عند عدم التعرف، ليُبلَّغ عن السطر بدل إسناد رمز خاطئ.
 */
const TRACK_ALIASES = new Map();
function addAliases(track, aliases) {
  for (const value of aliases) {
    const key = String(value).normalize("NFKC").toLowerCase().replace(/[\s_\-ـ]+/g, "");
    if (key) TRACK_ALIASES.set(key, track);
  }
}
addAliases("bachelor", ["bachelor", "bkb", "بكالوريوس", "بكالوريوس مشترك", "المقرر الأصلي", "الأصل"]);
addAliases("bachelor_m", ["bachelor_m", "bachelorm", "bm", "BM", "مسار الطلاب", "بكالوريوس طلاب", "بكالوريوس — طلاب", "الطلاب", "طالب", "طلاب", "ذكر", "male", "m"]);
addAliases("bachelor_f", ["bachelor_f", "bachelorf", "bf", "BF", "مسار الطالبات", "بكالوريوس طالبات", "بكالوريوس — طالبات", "الطالبات", "طالبة", "طالبات", "أنثى", "female", "f"]);
addAliases("equiv", ["equiv", "eq", "EQ", "قسم المعادلة", "المعادلة", "معادلة"]);
addAliases("external", ["external", "ex", "EX", "قسم طلاب من الخارج", "طلاب من الخارج", "من الخارج", "الخارج"]);
addAliases("grad", ["grad", "pg", "PG", "قسم الدراسات العليا", "الدراسات العليا", "دراسات عليا", "ماجستير", "دكتوراه"]);

export function resolveTrackAlias(value) {
  if (value == null) return null;
  const key = String(value).normalize("NFKC").toLowerCase().replace(/[\s_\-ـ]+/g, "");
  return TRACK_ALIASES.get(key) ?? null;
}

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

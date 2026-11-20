import { db } from "./supabase.js";
import { getProfile } from "./tracks.js";

const EMPTY = { data: [], error: null, count: 0 };

function idsOf(rows, key = "id") {
  return [...new Set(rows.map((row) => row[key]).filter((value) => value != null))];
}

/** المقررات التي سجّل فيها الطالب، مع اسم الأستاذ. */
export async function getEnrolledCourses(studentId) {
  const { data, error } = await db
    .from("enrollments")
    .select("course_id, courses(id, title, code, color, level, track, teacher_id, description, archived, parent_course_id, attendance_weight, exams_weight, assignments_weight)")
    .eq("student_id", studentId)
    .eq("status", "active");

  if (error) throw error;

  const courses = (data ?? [])
    .map((row) => row.courses)
    .filter((course) => course && !course.archived);

  const teacherIds = idsOf(courses, "teacher_id");
  let teachers = [];
  if (teacherIds.length) {
    const res = await db.from("users").select("id, name, position, email").in("id", teacherIds);
    if (res.error) throw res.error;
    teachers = res.data ?? [];
  }

  const byId = new Map(teachers.map((teacher) => [teacher.id, teacher]));
  return courses.map((course) => ({
    ...course,
    teacherName: byId.get(course.teacher_id)?.name ?? "أستاذ المقرر",
    teacherPosition: byId.get(course.teacher_id)?.position ?? "عضو هيئة التدريس",
    teacherEmail: byId.get(course.teacher_id)?.email ?? null,
  }));
}

export async function getLectures(courseIds) {
  if (!courseIds.length) return [];
  const { data, error } = await db
    .from("lectures")
    .select("id, course_id, title, description, youtube_url, live_url, scheduled_at, duration_min, attendance_code, attendance_open, lecture_type, recording_note, status")
    .in("course_id", courseIds)
    .order("scheduled_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getAttendanceLectureIds(studentId) {
  const { data, error } = await db
    .from("attendance")
    .select("lecture_id, created_at, method")
    .eq("student_id", studentId);
  if (error) throw error;
  return data ?? [];
}

export async function getAttendanceSummary(studentId, courseIds) {
  const [lectures, attendance] = await Promise.all([
    getLectures(courseIds),
    getAttendanceLectureIds(studentId),
  ]);
  const attended = new Set(attendance.map((row) => row.lecture_id));
  const now = Date.now();
  const past = lectures.filter((lecture) => lecture.scheduled_at && new Date(lecture.scheduled_at).getTime() <= now);
  const attendedCount = past.filter((lecture) => attended.has(lecture.id)).length;
  const upcoming = lectures.filter((lecture) => !lecture.scheduled_at || new Date(lecture.scheduled_at).getTime() > now);
  return {
    lectures,
    attended,
    total: lectures.length,
    pastTotal: past.length,
    attendedCount,
    missedCount: Math.max(0, past.length - attendedCount),
    upcomingCount: upcoming.length,
    attendanceRate: past.length ? Math.round((attendedCount / past.length) * 100) : 0,
  };
}

export async function getPoints(studentId) {
  const { data, error } = await db
    .from("points_ledger")
    .select("id, points, source_type, source_id, source_detail, created_at, course_id, courses(title, code, color)")
    .eq("user_id", studentId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;

  const rows = data ?? [];
  const total = rows.reduce((sum, row) => sum + (row.points ?? 0), 0);
  const byType = { attendance: 0, interaction: 0, assignment: 0 };
  for (const row of rows) {
    if (row.source_type in byType) byType[row.source_type] += row.points ?? 0;
  }

  const weekAgo = Date.now() - 7 * 86400000;
  const weekPoints = rows
    .filter((row) => new Date(row.created_at).getTime() >= weekAgo)
    .reduce((sum, row) => sum + (row.points ?? 0), 0);

  return { rows, total, byType, weekPoints };
}

export async function getExamsWithAttempts(studentId, courseIds) {
  if (!courseIds.length) return [];
  const { data, error } = await db
    .from("exams")
    .select("id, course_id, title, description, starts_at, ends_at, duration_min, is_published, exam_kind, courses(id, title, code, color)")
    .in("course_id", courseIds)
    .eq("is_published", true)
    .eq("exam_kind", "exam")
    .order("starts_at", { ascending: true });
  if (error) throw error;

  const exams = data ?? [];
  const examIds = idsOf(exams);
  let attempts = [];
  let questionCounts = [];

  if (examIds.length) {
    const [attemptRes, questionRes] = await Promise.all([
      db.from("exam_attempts").select("id, exam_id, student_id, started_at, submitted_at, score, status, graded_at").eq("student_id", studentId).in("exam_id", examIds),
      db.from("exam_questions").select("exam_id, points").in("exam_id", examIds),
    ]);
    if (attemptRes.error) throw attemptRes.error;
    if (questionRes.error) throw questionRes.error;
    attempts = attemptRes.data ?? [];
    questionCounts = questionRes.data ?? [];
  }

  const attemptByExam = new Map(attempts.map((attempt) => [attempt.exam_id, attempt]));
  const totals = new Map();
  const counts = new Map();
  for (const question of questionCounts) {
    totals.set(question.exam_id, (totals.get(question.exam_id) ?? 0) + Number(question.points ?? 0));
    counts.set(question.exam_id, (counts.get(question.exam_id) ?? 0) + 1);
  }

  return exams.map((exam) => {
    const attempt = attemptByExam.get(exam.id) ?? null;
    const now = Date.now();
    const starts = exam.starts_at ? new Date(exam.starts_at).getTime() : null;
    const ends = exam.ends_at ? new Date(exam.ends_at).getTime() : null;
    let status = "upcoming";
    if (attempt && ["submitted", "graded"].includes(attempt.status)) status = "finished";
    else if (starts && starts > now) status = "upcoming";
    else if (ends && ends < now) status = "closed";
    else status = "open";

    return {
      ...exam,
      attempt,
      status,
      questionCount: counts.get(exam.id) ?? 0,
      totalPoints: totals.get(exam.id) ?? 0,
    };
  });
}

export async function getAssignmentsWithSubmissions(studentId, courseIds) {
  if (!courseIds.length) return [];
  const { data, error } = await db
    .from("assignments")
    .select("id, course_id, title, description, due_at, max_points, created_at, courses(id, title, code, color)")
    .in("course_id", courseIds)
    .order("due_at", { ascending: true, nullsFirst: false });
  if (error) throw error;

  const assignments = data ?? [];
  const assignmentIds = idsOf(assignments);
  let submissions = [];

  if (assignmentIds.length) {
    const res = await db
      .from("submissions")
      .select("id, assignment_id, text, submitted_at, points, feedback, graded_at")
      .eq("student_id", studentId)
      .in("assignment_id", assignmentIds);
    if (res.error) throw res.error;
    submissions = res.data ?? [];
  }

  const byId = new Map(submissions.map((submission) => [submission.assignment_id, submission]));
  return assignments.map((assignment) => {
    const submission = byId.get(assignment.id) ?? null;
    const due = assignment.due_at ? new Date(assignment.due_at).getTime() : null;
    let status = "pending";
    if (submission) status = submission.graded_at ? "graded" : "submitted";
    else if (due && due < Date.now()) status = "late";
    return { ...assignment, submission, status };
  });
}

export async function getNotifications(studentId, courseIds) {
  const { data, error } = await db
    .from("notifications")
    .select("id, audience, course_id, user_id, title, body, link, created_at")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;

  return (data ?? [])
    .filter((item) => {
      if (item.audience === "all") return true;
      if (item.audience === "user") return item.user_id === studentId;
      if (item.audience === "course") return courseIds.includes(item.course_id);
      return false;
    })
    .slice(0, 5);
}

/**
 * معرّفات «عائلة المقرر»: المقرر الأصل + فرعاه (أو الأصل + فرعاه عند إعطاء فرع).
 * تُستخدم لجمع نقاط المحاضرة المشتركة ونقاط المحاضرات الخاصة في درجة مادّة واحدة.
 */
export async function getCourseFamilyIds(course) {
  const id = Number(course?.id);
  if (!id) return [];
  let parentId = course.parent_course_id;
  if (parentId === undefined) {
    const row = await db.from("courses").select("parent_course_id").eq("id", id).maybeSingle();
    if (row.error) throw row.error;
    parentId = row.data?.parent_course_id ?? null;
  }
  const target = Number(parentId) || id;
  const res = await db
    .from("courses")
    .select("id, parent_course_id")
    .or(`id.eq.${target},parent_course_id.eq.${target}`);
  if (res.error) throw res.error;
  const ids = (res.data ?? []).map((row) => Number(row.id)).filter(Boolean);
  if (!ids.includes(id)) ids.push(id);
  return [...new Set(ids)];
}

/** إرجاع مقرر واحد لكل مادة (الأصل إن وُجد، وإلا الفرع) حتى لا تتكرر الدرجة في العرض. */
export function dedupeSubjects(courses) {
  const byKey = new Map();
  for (const course of courses ?? []) {
    const key = course.parent_course_id ?? course.id;
    const existing = byKey.get(key);
    if (!existing || (existing.parent_course_id && !course.parent_course_id)) byKey.set(key, course);
  }
  return [...byKey.values()];
}

/** درجة واحدة لكل مادة، تجمع ما تحصّل في المقرر الأصل وفروعه. */
export async function getSubjectGrades(courses, studentId) {
  return Promise.all(dedupeSubjects(courses).map((course) => getCourseGrade(course, studentId)));
}

/**
 * نسخة مجمّعة من الدرجات لعدّاد كبير من الطلاب: استعلامات قليلة بدل استعلام لكل طالب.
 * المدخل: [{ studentId, courses: [...] }] — والمخرج: Map(studentId -> grades[]).
 */
export async function getSubjectGradesBulk(studentCourses) {
  const entries = [];
  for (const item of studentCourses ?? []) {
    for (const course of dedupeSubjects(item.courses)) entries.push({ studentId: item.studentId, course });
  }
  const result = new Map();
  if (!entries.length) return result;

  const allCoursesRes = await db.from("courses").select("id, parent_course_id");
  if (allCoursesRes.error) throw allCoursesRes.error;
  const courseRows = allCoursesRes.data ?? [];
  const parents = new Map(courseRows.map((row) => [Number(row.id), Number(row.parent_course_id) || null]));
  const familyCache = new Map();
  const familyIdsOf = (course) => {
    const id = Number(course.id);
    if (familyCache.has(id)) return familyCache.get(id);
    const parentId = course.parent_course_id !== undefined
      ? Number(course.parent_course_id) || null
      : parents.get(id) ?? null;
    const target = parentId || id;
    const ids = [target, ...courseRows.filter((row) => Number(row.parent_course_id) === target).map((row) => Number(row.id))];
    const unique = [...new Set(ids)];
    familyCache.set(id, unique);
    return unique;
  };
  for (const entry of entries) entry.familyIds = familyIdsOf(entry.course);

  const studentIds = [...new Set(entries.map((entry) => entry.studentId))];
  const familyIds = [...new Set(entries.flatMap((entry) => entry.familyIds))];
  const [usersRes, lecturesRes, attendanceRes, examsRes, assignmentsRes, presenceRes, interactionRes] = await Promise.all([
    db.from("users").select("id, track").in("id", studentIds),
    db.from("lectures").select("id, course_id, lecture_type, scheduled_at").in("course_id", familyIds),
    db.from("attendance").select("student_id, lecture_id").in("student_id", studentIds),
    db.from("exams").select("id, course_id, lecture_id, exam_kind").in("course_id", familyIds).eq("is_published", true),
    db.from("assignments").select("id, course_id, max_points").in("course_id", familyIds),
    db.from("lecture_presence").select("student_id, lecture_id, total_seconds").in("student_id", studentIds),
    db.from("points_ledger").select("user_id, source_id, points").eq("source_type", "interaction").in("user_id", studentIds),
  ]);
  for (const res of [usersRes, lecturesRes, attendanceRes, examsRes, assignmentsRes, presenceRes, interactionRes]) {
    if (res.error) throw res.error;
  }

  const examIds = idsOf(examsRes.data ?? []);
  const assignmentIds = idsOf(assignmentsRes.data ?? []);
  const allLectureIds = idsOf(lecturesRes.data ?? []);
  const [questionsRes, attemptsRes, submissionsRes, lectureQuestionsRes] = await Promise.all([
    examIds.length ? db.from("exam_questions").select("exam_id, points").in("exam_id", examIds) : Promise.resolve(EMPTY),
    examIds.length
      ? db.from("exam_attempts").select("student_id, exam_id, score, status").in("student_id", studentIds).in("exam_id", examIds)
      : Promise.resolve(EMPTY),
    assignmentIds.length
      ? db.from("submissions").select("student_id, assignment_id, points, graded_at").in("student_id", studentIds).in("assignment_id", assignmentIds)
      : Promise.resolve(EMPTY),
    allLectureIds.length
      ? db.from("questions").select("id, lecture_id").in("lecture_id", allLectureIds)
      : Promise.resolve(EMPTY),
  ]);
  for (const res of [questionsRes, attemptsRes, submissionsRes, lectureQuestionsRes]) {
    if (res.error) throw res.error;
  }

  const groupBy = (rows, key) => {
    const map = new Map();
    for (const row of rows ?? []) {
      if (!map.has(row[key])) map.set(row[key], []);
      map.get(row[key]).push(row);
    }
    return map;
  };
  const tracks = new Map((usersRes.data ?? []).map((row) => [row.id, row.track]));
  const attendanceByStudent = groupBy(attendanceRes.data, "student_id");
  const presenceByStudent = groupBy(presenceRes.data, "student_id");
  const interactionsByStudent = groupBy(interactionRes.data, "user_id");
  const attemptsByStudent = groupBy(attemptsRes.data, "student_id");
  const submissionsByStudent = groupBy(submissionsRes.data, "student_id");

  for (const entry of entries) {
    const idSet = new Set(entry.familyIds);
    const lectures = (lecturesRes.data ?? []).filter((row) => idSet.has(row.course_id));
    const lectureSet = new Set(lectures.map((row) => Number(row.id)));
    const questions = (lectureQuestionsRes.data ?? []).filter((row) => lectureSet.has(Number(row.lecture_id)));
    const exams = (examsRes.data ?? []).filter((row) => idSet.has(row.course_id));
    const assignments = (assignmentsRes.data ?? []).filter((row) => idSet.has(row.course_id));
    const examSet = new Set(exams.map((row) => row.id));
    const assignmentSet = new Set(assignments.map((row) => row.id));
    const grade = await getCourseGrade(entry.course, entry.studentId, {
      familyIds: entry.familyIds,
      track: tracks.get(entry.studentId),
      lectures,
      attendance: attendanceByStudent.get(entry.studentId) ?? [],
      exams,
      assignments,
      presence: presenceByStudent.get(entry.studentId) ?? [],
      interactions: interactionsByStudent.get(entry.studentId) ?? [],
      questions,
      questionPoints: (questionsRes.data ?? []).filter((row) => examSet.has(row.exam_id)),
      attempts: (attemptsByStudent.get(entry.studentId) ?? []).filter((row) => examSet.has(row.exam_id)),
      submissions: (submissionsByStudent.get(entry.studentId) ?? []).filter((row) => assignmentSet.has(row.assignment_id)),
    });
    if (!result.has(entry.studentId)) result.set(entry.studentId, []);
    result.get(entry.studentId).push(grade);
  }
  return result;
}

/**
 * درجة مادّة واحدة بنظام الـ300 نقطة:
 * - بكالوريوس: المحاضرة المباشرة/الإلكترونية = 10 حضور + 10 تفاعل + 10 اختبار،
 *   والمسجّلة = 30 نقطة اختبار فقط. تُحتسب أول 10 محاضرات فقط، فما زاد لا نقاط له.
 * - بقية المسارات: الواجبات وحدها بسقف 300 نقطة.
 * سقف كل مكوّن يُشتقّ من نوع المحاضرات فعلياً، فيبقى مجموع السقوف 300 دائماً.
 */
export async function getCourseGrade(course, studentId, preloaded = null) {
  const familyIds = preloaded?.familyIds ?? await getCourseFamilyIds(course);
  const gradeCourseIds = familyIds.length ? familyIds : [Number(course.id)];
  const track = preloaded
    ? preloaded.track
    : (await db.from("users").select("track").eq("id", studentId).maybeSingle()).data?.track;
  const examTrack = getProfile(track).tool === "exam";

  const [lecturesRes, attendanceRes, examsRes, assignmentsRes, presenceRes, interactionRes] = preloaded
    ? [
        { data: preloaded.lectures ?? [] },
        { data: preloaded.attendance ?? [] },
        { data: preloaded.exams ?? [] },
        { data: preloaded.assignments ?? [] },
        { data: preloaded.presence ?? [] },
        { data: preloaded.interactions ?? [] },
      ]
    : await Promise.all([
        db.from("lectures").select("id, lecture_type, scheduled_at").in("course_id", gradeCourseIds).order("scheduled_at", { ascending: true }),
        db.from("attendance").select("lecture_id").eq("student_id", studentId),
        db.from("exams").select("id, lecture_id, exam_kind").in("course_id", gradeCourseIds).eq("is_published", true),
        db.from("assignments").select("id, max_points").in("course_id", gradeCourseIds),
        db.from("lecture_presence").select("lecture_id, total_seconds").eq("student_id", studentId),
        db.from("points_ledger").select("source_id, points").eq("user_id", studentId).eq("source_type", "interaction"),
      ]);

  for (const res of [lecturesRes, attendanceRes, examsRes, assignmentsRes, presenceRes, interactionRes]) {
    if (res?.error) throw res.error;
  }

  const allLectures = (lecturesRes.data ?? []).slice().sort((a, b) => {
    const ta = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
    const tb = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
    return ta - tb || Number(a.id) - Number(b.id);
  });
  const lectures = allLectures.slice(0, 10);
  const lectureIds = new Set(lectures.map((lecture) => Number(lecture.id)));
  const liveIds = new Set(lectures.filter((lecture) => lecture.lecture_type !== "recorded").map((lecture) => Number(lecture.id)));
  const recordedIds = new Set(lectures.filter((lecture) => lecture.lecture_type === "recorded").map((lecture) => Number(lecture.id)));

  // أسئلة المحاضرة: نحتاج ربط سجل النقاط بالمحاضرة لمعرفة سقف العشر نقاط لكل محاضرة.
  let questionRows = preloaded?.questions ?? [];
  if (!preloaded && lectureIds.size) {
    const qRes = await db.from("questions").select("id, lecture_id").in("lecture_id", [...lectureIds]);
    if (qRes.error) throw qRes.error;
    questionRows = qRes.data ?? [];
  }
  const questionLecture = new Map((questionRows ?? []).map((row) => [Number(row.id), Number(row.lecture_id)]));

  // 1) الحضور: رمز المحاضرة شرط، ثم نقطة عن كل 10 دقائق تواجد، بحد أقصى 10 للمحاضرة.
  const presenceByLecture = new Map((presenceRes.data ?? []).map((row) => [Number(row.lecture_id), Number(row.total_seconds ?? 0)]));
  const attendedIds = new Set((attendanceRes.data ?? []).map((row) => Number(row.lecture_id)));
  let attendanceEarned = 0;
  let attended = 0;
  for (const id of liveIds) {
    if (!attendedIds.has(id)) continue;
    attended += 1;
    const seconds = presenceByLecture.get(id) ?? 0;
    attendanceEarned += Math.min(10, Math.floor(seconds / 600));
  }

  // 2) التفاعل: نقطة لكل إجابة صحيحة، بحد أقصى 10 للمحاضرة، وفي المباشرة/الإلكترونية فقط.
  const interactionByLecture = new Map();
  for (const row of interactionRes.data ?? []) {
    const lectureId = questionLecture.get(Number(row.source_id));
    if (!lectureId || !liveIds.has(lectureId)) continue;
    interactionByLecture.set(lectureId, (interactionByLecture.get(lectureId) ?? 0) + Number(row.points ?? 0));
  }
  let interactionEarned = 0;
  for (const id of liveIds) interactionEarned += Math.min(10, interactionByLecture.get(id) ?? 0);

  // 3) الاختبارات: يُقسَّم سقف المحاضرة (10 أو 30) على مجموع نقاط أسئلتها بالتناسب.
  const exams = (examsRes.data ?? []).filter((exam) => exam.exam_kind !== "assignment");
  const examIds = exams.map((exam) => Number(exam.id));
  let questionPoints = preloaded?.questionPoints ?? [];
  let attempts = preloaded?.attempts ?? [];
  if (!preloaded && examIds.length) {
    const [questionsRes, attemptsRes] = await Promise.all([
      db.from("exam_questions").select("exam_id, points").in("exam_id", examIds),
      db.from("exam_attempts").select("exam_id, score, status").eq("student_id", studentId).in("exam_id", examIds),
    ]);
    if (questionsRes.error) throw questionsRes.error;
    if (attemptsRes.error) throw attemptsRes.error;
    questionPoints = questionsRes.data ?? [];
    attempts = attemptsRes.data ?? [];
  }
  const possibleByExam = new Map();
  for (const row of questionPoints ?? []) {
    possibleByExam.set(Number(row.exam_id), (possibleByExam.get(Number(row.exam_id)) ?? 0) + Number(row.points ?? 0));
  }
  const scoreByExam = new Map();
  for (const attempt of attempts ?? []) {
    if (!["submitted", "graded"].includes(attempt.status)) continue;
    const id = Number(attempt.exam_id);
    scoreByExam.set(id, Math.max(scoreByExam.get(id) ?? 0, Number(attempt.score ?? 0)));
  }
  const examBuckets = new Map();
  let totalExamPossible = 0;
  let totalExamScore = 0;
  for (const exam of exams) {
    const id = Number(exam.id);
    const lectureId = Number(exam.lecture_id) || null;
    // الاختبار يُحتسب فقط حين يكون مرتبطاً بإحدى أول 10 محاضرات؛ نوع المحاضرة يحدد سقفه.
    if (!lectureId || !lectureIds.has(lectureId)) continue;
    const bucket = examBuckets.get(lectureId) ?? { possible: 0, score: 0, recorded: recordedIds.has(lectureId) };
    bucket.possible += possibleByExam.get(id) ?? 0;
    bucket.score += scoreByExam.get(id) ?? 0;
    examBuckets.set(lectureId, bucket);
    totalExamPossible += possibleByExam.get(id) ?? 0;
    totalExamScore += scoreByExam.get(id) ?? 0;
  }
  let examsEarned = 0;
  for (const bucket of examBuckets.values()) {
    if (!bucket.possible) continue;
    const cap = bucket.recorded ? 30 : 10;
    examsEarned += Math.min(cap, Math.max(0, (bucket.score / bucket.possible) * cap));
  }

  // 4) الواجبات: للمسارات غير البكالوريوس وحدها.
  const assignments = assignmentsRes.data ?? [];
  const assignmentIds = assignments.map((assignment) => Number(assignment.id));
  let submissions = preloaded?.submissions ?? [];
  if (!preloaded && assignmentIds.length) {
    const res = await db
      .from("submissions")
      .select("assignment_id, points, graded_at")
      .eq("student_id", studentId)
      .in("assignment_id", assignmentIds);
    if (res.error) throw res.error;
    submissions = res.data ?? [];
  }
  const totalAssignmentPoints = assignments.reduce((sum, row) => sum + Number(row.max_points ?? 0), 0);
  const assignmentScore = (submissions ?? [])
    .filter((row) => row.graded_at)
    .reduce((sum, row) => sum + Number(row.points ?? 0), 0);
  const assignmentsRatio = totalAssignmentPoints ? Math.min(1, assignmentScore / totalAssignmentPoints) : 0;

  const attendanceWeight = examTrack ? liveIds.size * 10 : 0;
  const interactionWeight = examTrack ? liveIds.size * 10 : 0;
  const examsWeight = examTrack ? liveIds.size * 10 + recordedIds.size * 30 : 0;
  const assignmentsWeight = examTrack ? 0 : 300;
  const total = examTrack
    ? Math.min(300, attendanceEarned + interactionEarned + examsEarned)
    : Math.min(300, assignmentsRatio * 300);

  const round1 = (value) => Math.round(value * 10) / 10;
  const ratioOf = (earned, weight) => (weight ? Math.min(100, Math.round((earned / weight) * 100)) : 0);

  return {
    course,
    scale: 300,
    attendance: {
      weight: attendanceWeight,
      ratio: ratioOf(attendanceEarned, attendanceWeight),
      earned: round1(attendanceEarned),
      attended,
      total: liveIds.size,
    },
    interaction: {
      weight: interactionWeight,
      ratio: ratioOf(interactionEarned, interactionWeight),
      earned: round1(interactionEarned),
    },
    exams: {
      weight: examsWeight,
      ratio: ratioOf(examsEarned, examsWeight),
      earned: round1(examsEarned),
      score: round1(totalExamScore),
      total: totalExamPossible,
    },
    assignments: {
      weight: assignmentsWeight,
      ratio: ratioOf(assignmentsRatio * 300, assignmentsWeight),
      earned: round1(assignmentsRatio * 300),
      score: round1(assignmentScore),
      total: totalAssignmentPoints,
    },
    total: round1(total),
    percent: Math.round(total / 3),
    letter: letterGrade(total / 3),
  };
}

export function letterGrade(score) {
  if (score >= 90) return "A";
  if (score >= 85) return "A-";
  if (score >= 80) return "B+";
  if (score >= 75) return "B";
  if (score >= 70) return "C+";
  if (score >= 65) return "C";
  if (score >= 60) return "D";
  return "F";
}

export function gradeLabel(score) {
  if (score >= 90) return { text: "ممتاز", tone: "excellent" };
  if (score >= 80) return { text: "جيد جداً", tone: "verygood" };
  if (score >= 70) return { text: "جيد", tone: "good" };
  if (score >= 60) return { text: "مقبول", tone: "pass" };
  return { text: "ضعيف", tone: "weak" };
}

/** التحقق من تسجيل الطالب في المقرر. */
export async function isEnrolled(studentId, courseId) {
  const { data, error } = await db
    .from("enrollments")
    .select("course_id")
    .eq("student_id", studentId)
    .eq("course_id", courseId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function getLectureForStudent(lectureId, studentId) {
  const { data, error } = await db
    .from("lectures")
    .select("*, courses(id, title, code, color, level, track, teacher_id)")
    .eq("id", lectureId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (!(await isEnrolled(studentId, data.course_id))) return null;
  return data;
}

export async function getExamForStudent(examId, studentId) {
  const { data, error } = await db
    .from("exams")
    .select("*, courses(id, title, code, color, teacher_id)")
    .eq("id", examId)
    .maybeSingle();
  if (error) throw error;
  if (!data || !data.is_published) return null;
  if (!(await isEnrolled(studentId, data.course_id))) return null;
  return data;
}

export async function getAssignmentForStudent(assignmentId, studentId) {
  const { data, error } = await db
    .from("assignments")
    .select("*, courses(id, title, code, color, teacher_id)")
    .eq("id", assignmentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (!(await isEnrolled(studentId, data.course_id))) return null;
  return data;
}

export { EMPTY };

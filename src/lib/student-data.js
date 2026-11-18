import { db } from "./supabase.js";

const EMPTY = { data: [], error: null, count: 0 };

function idsOf(rows, key = "id") {
  return [...new Set(rows.map((row) => row[key]).filter((value) => value != null))];
}

/** المقررات التي سجّل فيها الطالب، مع اسم الأستاذ. */
export async function getEnrolledCourses(studentId) {
  const { data, error } = await db
    .from("enrollments")
    .select("course_id, courses(id, title, code, color, level, track, teacher_id, description, archived, attendance_weight, exams_weight, assignments_weight)")
    .eq("student_id", studentId);

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

/** حساب مكوّنات الدرجة لمقرر واحد. */
export async function getCourseGrade(course, studentId) {
  const courseId = course.id;
  const attendanceWeight = Number(course.attendance_weight ?? 10);
  const examsWeight = Number(course.exams_weight ?? 60);
  const assignmentsWeight = Number(course.assignments_weight ?? 30);

  const [lecturesRes, attendanceRes, examsRes, assignmentsRes] = await Promise.all([
    db.from("lectures").select("id").eq("course_id", courseId),
    db.from("attendance").select("lecture_id").eq("student_id", studentId),
    db.from("exams").select("id").eq("course_id", courseId).eq("is_published", true),
    db.from("assignments").select("id, max_points").eq("course_id", courseId),
  ]);

  if (lecturesRes.error) throw lecturesRes.error;
  if (attendanceRes.error) throw attendanceRes.error;
  if (examsRes.error) throw examsRes.error;
  if (assignmentsRes.error) throw assignmentsRes.error;

  const lectures = lecturesRes.data ?? [];
  const examIds = (examsRes.data ?? []).map((exam) => exam.id);
  const assignments = assignmentsRes.data ?? [];
  const assignmentIds = assignments.map((assignment) => assignment.id);

  let questionPoints = [];
  let attempts = [];
  let submissions = [];

  if (examIds.length) {
    const [questionsRes, attemptsRes] = await Promise.all([
      db.from("exam_questions").select("exam_id, points").in("exam_id", examIds),
      db.from("exam_attempts").select("exam_id, score, status").eq("student_id", studentId).in("exam_id", examIds),
    ]);
    if (questionsRes.error) throw questionsRes.error;
    if (attemptsRes.error) throw attemptsRes.error;
    questionPoints = questionsRes.data ?? [];
    attempts = attemptsRes.data ?? [];
  }

  if (assignmentIds.length) {
    const res = await db
      .from("submissions")
      .select("assignment_id, points, graded_at")
      .eq("student_id", studentId)
      .in("assignment_id", assignmentIds);
    if (res.error) throw res.error;
    submissions = res.data ?? [];
  }

  const lectureIds = new Set(lectures.map((lecture) => lecture.id));
  const attended = (attendanceRes.data ?? []).filter((row) => lectureIds.has(row.lecture_id)).length;
  const attendanceRatio = lectures.length ? Math.min(1, attended / lectures.length) : 0;

  const totalExamPoints = questionPoints.reduce((sum, row) => sum + Number(row.points ?? 0), 0);
  const examIdsSet = new Set(examIds);
  const examScore = attempts
    .filter((attempt) => examIdsSet.has(attempt.exam_id) && ["submitted", "graded"].includes(attempt.status))
    .reduce((sum, attempt) => sum + Number(attempt.score ?? 0), 0);
  const examsRatio = totalExamPoints ? Math.min(1, examScore / totalExamPoints) : 0;

  const totalAssignmentPoints = assignments.reduce((sum, row) => sum + Number(row.max_points ?? 0), 0);
  const assignmentScore = submissions
    .filter((row) => row.graded_at)
    .reduce((sum, row) => sum + Number(row.points ?? 0), 0);
  const assignmentsRatio = totalAssignmentPoints ? Math.min(1, assignmentScore / totalAssignmentPoints) : 0;

  const attendanceEarned = (attendanceRatio * attendanceWeight);
  const examsEarned = (examsRatio * examsWeight);
  const assignmentsEarned = (assignmentsRatio * assignmentsWeight);
  const total = attendanceEarned + examsEarned + assignmentsEarned;

  return {
    course,
    attendance: {
      weight: attendanceWeight,
      ratio: Math.round(attendanceRatio * 100),
      earned: Math.round(attendanceEarned * 10) / 10,
      attended,
      total: lectures.length,
    },
    exams: {
      weight: examsWeight,
      ratio: Math.round(examsRatio * 100),
      earned: Math.round(examsEarned * 10) / 10,
      score: Math.round(examScore * 10) / 10,
      total: totalExamPoints,
    },
    assignments: {
      weight: assignmentsWeight,
      ratio: Math.round(assignmentsRatio * 100),
      earned: Math.round(assignmentsEarned * 10) / 10,
      score: Math.round(assignmentScore * 10) / 10,
      total: totalAssignmentPoints,
    },
    total: Math.round(total * 10) / 10,
    letter: letterGrade(total),
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

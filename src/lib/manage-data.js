import { db } from "./supabase.js";

/** مقررات الأستاذ (أو كل المقررات للمالك) مع إحصاءات سريعة. */
export async function getManagedCourses({ teacherId = null, allTeachers = false } = {}) {
  let builder = db
    .from("courses")
    .select("id, title, code, description, color, level, track, archived, attendance_weight, exams_weight, assignments_weight, created_at, teacher_id, users!courses_teacher_id_fkey(id, name)")
    .order("created_at", { ascending: false });

  if (!allTeachers) builder = builder.eq("teacher_id", teacherId);

  const { data, error } = await builder;
  if (error) throw error;
  const courses = data ?? [];
  const ids = courses.map((course) => course.id);

  if (!ids.length) return courses.map((course) => ({ ...course, studentCount: 0, lectureCount: 0, examCount: 0, assignmentCount: 0 }));

  const [enrollRes, lectureRes, examRes, assignmentRes] = await Promise.all([
    db.from("enrollments").select("course_id, student_id").in("course_id", ids),
    db.from("lectures").select("course_id").in("course_id", ids),
    db.from("exams").select("course_id").in("course_id", ids),
    db.from("assignments").select("course_id").in("course_id", ids),
  ]);
  if (enrollRes.error) throw enrollRes.error;
  if (lectureRes.error) throw lectureRes.error;
  if (examRes.error) throw examRes.error;
  if (assignmentRes.error) throw assignmentRes.error;

  const students = new Map();
  for (const row of enrollRes.data ?? []) {
    if (!students.has(row.course_id)) students.set(row.course_id, new Set());
    students.get(row.course_id).add(row.student_id);
  }
  const lectures = new Map();
  for (const row of lectureRes.data ?? []) lectures.set(row.course_id, (lectures.get(row.course_id) ?? 0) + 1);
  const exams = new Map();
  for (const row of examRes.data ?? []) exams.set(row.course_id, (exams.get(row.course_id) ?? 0) + 1);
  const assignments = new Map();
  for (const row of assignmentRes.data ?? []) assignments.set(row.course_id, (assignments.get(row.course_id) ?? 0) + 1);

  return courses.map((course) => ({
    ...course,
    teacherName: course.users?.name ?? "أستاذ",
    studentCount: students.get(course.id)?.size ?? 0,
    lectureCount: lectures.get(course.id) ?? 0,
    examCount: exams.get(course.id) ?? 0,
    assignmentCount: assignments.get(course.id) ?? 0,
  }));
}

/** التحقق من صلاحية إدارة المقرر: للأستاذ مقرراته فقط، وللمالك كل المقررات. */
export async function canManageCourse(user, isOwner, courseId) {
  const { data, error } = await db
    .from("courses")
    .select("id, teacher_id, title, code, color, level, track, archived, attendance_weight, exams_weight, assignments_weight, description")
    .eq("id", courseId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (!isOwner && data.teacher_id !== user?.id) return null;
  return data;
}

export async function getCourseStudents(courseId) {
  const { data, error } = await db
    .from("enrollments")
    .select("student_id, users!enrollments_student_id_fkey(id, name, university_id, platform_id, track, level, is_active, last_login)")
    .eq("course_id", courseId)
    .order("student_id");
  if (error) throw error;
  return (data ?? []).map((row) => row.users).filter(Boolean);
}

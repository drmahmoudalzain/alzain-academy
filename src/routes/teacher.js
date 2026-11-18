import express from "express";
import { db } from "../lib/supabase.js";
import { renderPage } from "../lib/render.js";
import { requirePortal } from "../middleware/auth.js";

const router = express.Router();

function teacherPage(res, view, locals) {
  return renderPage(res, view, {
    layout: "portal",
    portal: res.locals.portal,
    ...locals,
  });
}

async function teacherCourses(teacherId) {
  const { data, error } = await db
    .from("courses")
    .select("id, title, code, description, color, level, track, archived, attendance_weight, exams_weight, assignments_weight, created_at")
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const courses = data ?? [];
  const ids = courses.map((c) => c.id);
  if (!ids.length) return courses.map((course) => ({ ...course, studentCount: 0, lectureCount: 0, examCount: 0 }));

  const [enrollRes, lectureRes, examRes] = await Promise.all([
    db.from("enrollments").select("course_id, student_id").in("course_id", ids),
    db.from("lectures").select("course_id").in("course_id", ids),
    db.from("exams").select("course_id").in("course_id", ids),
  ]);
  if (enrollRes.error) throw enrollRes.error;
  if (lectureRes.error) throw lectureRes.error;
  if (examRes.error) throw examRes.error;

  const students = new Map();
  for (const row of enrollRes.data ?? []) {
    if (!students.has(row.course_id)) students.set(row.course_id, new Set());
    students.get(row.course_id).add(row.student_id);
  }
  const lectures = new Map();
  for (const row of lectureRes.data ?? []) lectures.set(row.course_id, (lectures.get(row.course_id) ?? 0) + 1);
  const exams = new Map();
  for (const row of examRes.data ?? []) exams.set(row.course_id, (exams.get(row.course_id) ?? 0) + 1);

  return courses.map((course) => ({
    ...course,
    studentCount: students.get(course.id)?.size ?? 0,
    lectureCount: lectures.get(course.id) ?? 0,
    examCount: exams.get(course.id) ?? 0,
  }));
}

router.get("/", requirePortal("teacher"), async (req, res, next) => {
  try {
    const teacherId = req.user.id;
    const courses = await teacherCourses(teacherId);
    const ids = courses.map((course) => course.id);

    let examCount = 0;
    let lectureCount = 0;
    let studentCount = 0;
    for (const course of courses) {
      examCount += course.examCount;
      lectureCount += course.lectureCount;
      studentCount += course.studentCount;
    }

    const recentLectures = ids.length
      ? await db
          .from("lectures")
          .select("id, title, scheduled_at, lecture_type, attendance_open, courses(title, code)")
          .in("course_id", ids)
          .order("scheduled_at", { ascending: false })
          .limit(5)
      : { data: [], error: null };
    if (recentLectures.error) throw recentLectures.error;

    return teacherPage(res, "teacher/dashboard", {
      title: "لوحة التحكم",
      pageTitle: "لوحة الأستاذ",
      stats: { courses: courses.length, students: studentCount, lectures: lectureCount, exams: examCount },
      courses: courses.slice(0, 5),
      lectures: recentLectures.data ?? [],
    });
  } catch (error) {
    next(error);
  }
});

router.get("/courses", requirePortal("teacher"), async (req, res, next) => {
  try {
    const courses = await teacherCourses(req.user.id);
    return teacherPage(res, "teacher/courses", {
      title: "مقرراتي",
      pageTitle: "مقرراتي",
      courses,
      searchAction: "/teacher/courses",
      searchPlaceholder: "ابحث عن مقرر...",
      searchValue: req.query.q ?? "",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/lectures", requirePortal("teacher"), async (req, res, next) => {
  try {
    const courses = await teacherCourses(req.user.id);
    const ids = courses.map((course) => course.id);
    const map = new Map(courses.map((course) => [course.id, course]));
    const type = String(req.query.type ?? "all");
    const query = String(req.query.q ?? "").trim().toLowerCase();

    let lectures = [];
    if (ids.length) {
      const { data, error } = await db
        .from("lectures")
        .select("id, course_id, title, scheduled_at, lecture_type, attendance_open, attendance_code, status, duration_min")
        .in("course_id", ids)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      lectures = data ?? [];
    }

    lectures = lectures
      .map((lecture) => ({ ...lecture, course: map.get(lecture.course_id) }))
      .filter((lecture) => type === "all" || lecture.lecture_type === type)
      .filter((lecture) => {
        if (!query) return true;
        return `${lecture.title} ${lecture.course?.title ?? ""} ${lecture.course?.code ?? ""}`
          .toLowerCase()
          .includes(query);
      });

    // عدد الحضور لكل محاضرة
    const lectureIds = lectures.map((lecture) => lecture.id);
    const attendanceCount = new Map();
    if (lectureIds.length) {
      const { data, error } = await db.from("attendance").select("lecture_id").in("lecture_id", lectureIds);
      if (error) throw error;
      for (const row of data ?? []) attendanceCount.set(row.lecture_id, (attendanceCount.get(row.lecture_id) ?? 0) + 1);
    }
    lectures = lectures.map((lecture) => ({ ...lecture, attendanceCount: attendanceCount.get(lecture.id) ?? 0 }));

    return teacherPage(res, "teacher/lectures", {
      title: "المحاضرات",
      pageTitle: "المحاضرات",
      lectures,
      type,
      searchAction: "/teacher/lectures",
      searchPlaceholder: "ابحث عن محاضرة...",
      searchValue: req.query.q ?? "",
    });
  } catch (error) {
    next(error);
  }
});

export default router;

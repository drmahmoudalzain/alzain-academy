import express from "express";
import { db } from "../lib/supabase.js";
import { renderPage } from "../lib/render.js";
import { requirePortal } from "../middleware/auth.js";
import { createManagementRouter } from "../lib/management.js";

const router = express.Router();

// لوحة التحكم
router.get("/", requirePortal("teacher"), async (req, res, next) => {
  try {
    const teacherId = req.user.id;

    const coursesRes = await db
      .from("courses")
      .select("id, title, code, level, track, archived, created_at")
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false });

    if (coursesRes.error) throw coursesRes.error;
    const courses = coursesRes.data ?? [];
    const courseIds = courses.map((course) => course.id);

    const emptyIn = { data: [], error: null };
    const [enrollRes, lectureRes, examRes] = await Promise.all([
      courseIds.length
        ? db.from("enrollments").select("student_id", { count: "exact" }).in("course_id", courseIds)
        : emptyIn,
      courseIds.length
        ? db.from("lectures").select("id, title, scheduled_at, lecture_type, attendance_open, courses(title, code)").in("course_id", courseIds).order("scheduled_at", { ascending: false }).limit(6)
        : { data: [], error: null },
      courseIds.length
        ? db.from("exams").select("id, title, starts_at, is_published").in("course_id", courseIds)
        : emptyIn,
    ]);

    if (enrollRes.error) throw enrollRes.error;
    if (lectureRes.error) throw lectureRes.error;
    if (examRes.error) throw examRes.error;

    const students = new Set((enrollRes.data ?? []).map((row) => row.student_id)).size;

    return renderPage(res, "teacher/dashboard", {
      layout: "portal",
      portal: res.locals.portal,
      title: "لوحة التحكم",
      pageTitle: "لوحة الأستاذ",
      stats: {
        courses: courses.length,
        students,
        lectures: lectureRes.data?.length ?? 0,
        exams: examRes.data?.length ?? 0,
      },
      courses: courses.slice(0, 5),
      lectures: lectureRes.data ?? [],
    });
  } catch (error) {
    next(error);
  }
});

// مسارات الإدارة المشتركة (مقررات/محاضرات/اختبارات/واجبات)
router.use("/", createManagementRouter({ portalKey: "teacher", basePath: "/teacher", isOwner: false }));

export default router;

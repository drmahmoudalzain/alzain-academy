import express from "express";
import { db } from "../lib/supabase.js";
import { renderPage } from "../lib/render.js";
import { requirePortal } from "../middleware/auth.js";

const router = express.Router();

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
        ? db.from("lectures").select("id, title, scheduled_at", { count: "exact" }).in("course_id", courseIds)
        : emptyIn,
      courseIds.length
        ? db.from("exams").select("id, title, starts_at", { count: "exact" }).in("course_id", courseIds)
        : emptyIn,
    ]);

    if (enrollRes.error) throw enrollRes.error;
    if (lectureRes.error) throw lectureRes.error;
    if (examRes.error) throw examRes.error;

    const students = new Set((enrollRes.data ?? []).map((row) => row.student_id)).size;

    return renderPage(res, "teacher/dashboard", {
      title: "لوحة الأستاذ",
      portal: res.locals.portal,
      stats: {
        courses: courses.length,
        students,
        lectures: lectureRes.count ?? lectureRes.data?.length ?? 0,
        exams: examRes.count ?? examRes.data?.length ?? 0,
      },
      courses: courses.slice(0, 5),
    });
  } catch (error) {
    next(error);
  }
});

export default router;

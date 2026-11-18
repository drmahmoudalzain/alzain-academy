import express from "express";
import { db } from "../lib/supabase.js";
import { renderPage } from "../lib/render.js";
import { requirePortal } from "../middleware/auth.js";

const router = express.Router();

router.get("/", requirePortal("student"), async (req, res, next) => {
  try {
    const studentId = req.user.id;

    const enrollRes = await db
      .from("enrollments")
      .select("course_id, courses(id, title, code, color, level, track)")
      .eq("student_id", studentId);

    if (enrollRes.error) throw enrollRes.error;

    const courses = (enrollRes.data ?? []).map((row) => row.courses).filter(Boolean);
    const courseIds = courses.map((course) => course.id);

    const empty = { data: [], error: null };
    const [pointsRes, lectureRes] = await Promise.all([
      db.from("points_ledger").select("points").eq("user_id", studentId),
      courseIds.length
        ? db
            .from("lectures")
            .select("id, title, scheduled_at")
            .in("course_id", courseIds)
            .order("scheduled_at", { ascending: true, nullsFirst: false })
            .limit(5)
        : empty,
    ]);

    if (pointsRes.error) throw pointsRes.error;
    if (lectureRes.error) throw lectureRes.error;

    const points = (pointsRes.data ?? []).reduce((sum, row) => sum + (row.points ?? 0), 0);

    return renderPage(res, "student/dashboard", {
      title: "لوحة الطالب",
      portal: res.locals.portal,
      stats: { courses: courses.length, points, lectures: lectureRes.data?.length ?? 0 },
      courses,
      lectures: lectureRes.data ?? [],
    });
  } catch (error) {
    next(error);
  }
});

export default router;

import express from "express";
import { db } from "../lib/supabase.js";
import { renderPage } from "../lib/render.js";
import { requirePortal } from "../middleware/auth.js";
import { createStudentsRouter } from "../lib/students.js";

const router = express.Router();

router.get("/", requirePortal("assistant"), async (req, res, next) => {
  try {
    const [studentsRes, coursesRes] = await Promise.all([
      db.from("users").select("*", { count: "exact", head: true }).eq("role", "student"),
      db.from("courses").select("*", { count: "exact", head: true }).eq("archived", false),
    ]);
    if (studentsRes.error) throw studentsRes.error;
    if (coursesRes.error) throw coursesRes.error;

    return renderPage(res, "assistant/dashboard", {
      layout: "portal",
      portal: res.locals.portal,
      title: "لوحة التحكم",
      pageTitle: "بوابة المساعد الإداري",
      stats: { students: studentsRes.count ?? 0, courses: coursesRes.count ?? 0 },
    });
  } catch (error) {
    next(error);
  }
});

router.use(
  "/students",
  createStudentsRouter({
    portalKey: "assistant",
    basePath: "/assistant/students",
    isOwner: true,
    readOnly: true,
  })
);

export default router;

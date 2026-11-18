import express from "express";
import { db } from "../lib/supabase.js";
import { renderPage } from "../lib/render.js";
import { requirePortal } from "../middleware/auth.js";

const router = express.Router();

async function count(table, apply = (q) => q) {
  const { count: total, error } = await apply(
    db.from(table).select("*", { count: "exact", head: true })
  );
  if (error) throw error;
  return total ?? 0;
}

router.get("/", requirePortal("owner"), async (req, res, next) => {
  try {
    const [teachers, students, courses, lectures, exams, archived, denied] = await Promise.all([
      count("users", (q) => q.eq("role", "teacher")),
      count("users", (q) => q.eq("role", "student")),
      count("courses"),
      count("lectures"),
      count("exams"),
      count("archived_records"),
      db
        .from("archived_records")
        .select("id, label, data, archived_at")
        .eq("table_name", "login_denied")
        .order("archived_at", { ascending: false })
        .limit(5),
    ]);

    if (denied.error) throw denied.error;

    return renderPage(res, "owner/dashboard", {
      title: "لوحة المالك",
      portal: res.locals.portal,
      stats: { teachers, students, courses, lectures, exams, archived },
      denied: denied.data ?? [],
    });
  } catch (error) {
    next(error);
  }
});

export default router;

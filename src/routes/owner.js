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

function ownerPage(res, view, locals) {
  return renderPage(res, view, {
    layout: "portal",
    portal: res.locals.portal,
    ...locals,
  });
}

router.get("/", requirePortal("owner"), async (req, res, next) => {
  try {
    const [teachers, students, courses, lectures, exams, archived, deniedRes] = await Promise.all([
      count("users", (q) => q.eq("role", "teacher")),
      count("users", (q) => q.eq("role", "student")),
      count("courses"),
      count("lectures"),
      count("exams"),
      count("archived_records"),
      db
        .from("archived_records")
        .select("id, label, data, archived_at, archived_by")
        .eq("table_name", "login_denied")
        .order("archived_at", { ascending: false })
        .limit(6),
    ]);

    if (deniedRes.error) throw deniedRes.error;

    return ownerPage(res, "owner/dashboard", {
      title: "لوحة التحكم",
      pageTitle: "لوحة المالك",
      stats: { teachers, students, courses, lectures, exams, archived },
      denied: deniedRes.data ?? [],
    });
  } catch (error) {
    next(error);
  }
});

// ---------- المستخدمون ----------
router.get("/users", requirePortal("owner"), async (req, res, next) => {
  try {
    const query = String(req.query.q ?? "").trim().toLowerCase();
    const role = String(req.query.role ?? "all");

    let builder = db
      .from("users")
      .select("id, role, name, email, university_id, position, track, level, is_active, last_login, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (role === "teacher" || role === "student") builder = builder.eq("role", role);
    const { data, error } = await builder;
    if (error) throw error;

    const users = (data ?? []).filter((user) => {
      if (!query) return true;
      return [user.name, user.email, user.university_id, user.position].some((value) =>
        String(value ?? "").toLowerCase().includes(query)
      );
    });

    return ownerPage(res, "owner/users", {
      title: "المستخدمون",
      pageTitle: "المستخدمون",
      users,
      role,
      searchQuery: req.query.q ?? "",
      searchAction: "/owner/users",
      searchPlaceholder: "ابحث باسم أو بريد أو رقم...",
      searchValue: req.query.q ?? "",
    });
  } catch (error) {
    next(error);
  }
});

// ---------- الأرشيف ----------
router.get("/archive", requirePortal("owner"), async (req, res, next) => {
  try {
    const query = String(req.query.q ?? "").trim().toLowerCase();
    const type = String(req.query.type ?? "all");

    let builder = db
      .from("archived_records")
      .select("id, table_name, record_id, label, data, archived_at")
      .order("archived_at", { ascending: false })
      .limit(100);

    if (type !== "all") builder = builder.eq("table_name", type);
    const { data, error } = await builder;
    if (error) throw error;

    const records = (data ?? []).filter((record) => {
      if (!query) return true;
      const hay = `${record.label ?? ""} ${JSON.stringify(record.data ?? {})}`.toLowerCase();
      return hay.includes(query);
    });

    return ownerPage(res, "owner/archive", {
      title: "الأرشيف",
      pageTitle: "الأرشيف",
      records,
      type,
      searchQuery: req.query.q ?? "",
      searchAction: "/owner/archive",
      searchPlaceholder: "ابحث في الأرشيف...",
      searchValue: req.query.q ?? "",
    });
  } catch (error) {
    next(error);
  }
});

export default router;

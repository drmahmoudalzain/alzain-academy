import express from "express";
import crypto from "node:crypto";
import { db } from "../lib/supabase.js";
import { renderPage } from "../lib/render.js";
import { requirePortal } from "../middleware/auth.js";
import { createManagementRouter } from "../lib/management.js";
import { setSetting } from "../lib/settings.js";
import { hashPassword } from "../lib/password.js";
import { getCourseGrade } from "../lib/student-data.js";
import { createStudentsRouter } from "../lib/students.js";

const router = express.Router();

const ownerPage = (res, view, locals) =>
  renderPage(res, view, { layout: "portal", portal: res.locals.portal, ...locals });

async function count(table, apply = (q) => q) {
  const { count: total, error } = await apply(
    db.from(table).select("*", { count: "exact", head: true })
  );
  if (error) throw error;
  return total ?? 0;
}

// ---------- لوحة التحكم ----------
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
        .select("id, label, data, archived_at")
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
      .select("id, role, name, email, university_id, position, track, level, is_active, last_login, created_at, is_staff")
      .order("created_at", { ascending: false })
      .limit(300);

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
      searchAction: "/owner/users",
      searchPlaceholder: "ابحث باسم أو بريد أو رقم...",
      searchValue: req.query.q ?? "",
    });
  } catch (error) {
    next(error);
  }
});

// ---------- إنشاء مستخدم ---------- 
function generateTempPassword() {
  return crypto.randomBytes(9).toString("base64url");
}

router.get("/users/new", requirePortal("owner"), async (req, res, next) => {
  try {
    return ownerPage(res, "owner/users-new", {
      title: "إضافة مستخدم",
      pageTitle: "إضافة مستخدم",
      error: null,
      role: req.query.role === "teacher" ? "teacher" : "student",
    });
  } catch (error) {
    next(error);
  }
});

router.post("/users", requirePortal("owner"), async (req, res, next) => {
  const role = req.body.role === "teacher" ? "teacher" : "student";
  const fail = (message) =>
    ownerPage(res.status(422), "owner/users-new", {
      title: "إضافة مستخدم",
      pageTitle: "إضافة مستخدم",
      error: message,
      role,
    });

  try {
    const name = String(req.body.name ?? "").trim();
    const universityId = String(req.body.university_id ?? "").trim() || null;
    const email = String(req.body.email ?? "").trim().toLowerCase() || null;
    const position = String(req.body.position ?? "").trim() || null;
    const track = req.body.track === "equiv" ? "equiv" : "bachelor";
    const level = Math.min(4, Math.max(1, Number(req.body.level ?? 1)));

    if (name.length < 3) return fail("الاسم قصير جداً.");
    if (role === "student" && !universityId) return fail("الرقم الجامعي مطلوب لطالب جديد.");
    if (!universityId && !email) return fail("أدخل الرقم الجامعي أو البريد الإلكتروني.");

    if (universityId) {
      const clash = await db.from("users").select("id").eq("university_id", universityId).maybeSingle();
      if (clash.error) throw clash.error;
      if (clash.data) return fail("الرقم الجامعي مستخدم في حساب آخر.");
    }
    if (email) {
      const clash = await db.from("users").select("id").eq("email", email).maybeSingle();
      if (clash.error) throw clash.error;
      if (clash.data) return fail("البريد الإلكتروني مستخدم في حساب آخر.");
    }

    const tempPassword = generateTempPassword();
    const created = await db.from("users").insert({
      role,
      name,
      email,
      university_id: universityId,
      position,
      track,
      level: role === "student" ? level : null,
      password_hash: hashPassword(tempPassword),
      must_change_password: true,
      is_active: true,
      is_staff: role === "teacher",
    }).select("id, name, role, email, university_id").maybeSingle();
    if (created.error) throw created.error;

    const vault = await db.from("credentials_vault").upsert({
      user_id: created.data.id,
      password_plain: tempPassword,
      updated_at: new Date().toISOString(),
    });
    if (vault.error) console.error("تعذر حفظ كلمة المرور المؤقتة في الخزنة:", vault.error.message);

    return ownerPage(res, "owner/users-created", {
      title: "تم إنشاء الحساب",
      pageTitle: "تم إنشاء الحساب",
      newUser: created.data,
      tempPassword,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/users/:id/toggle", requirePortal("owner"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { data, error } = await db.from("users").select("id, is_active").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).render("error", { title: "غير موجود", code: 404, message: "المستخدم غير موجود." });
    if (id === 1) return res.redirect("/owner/users");

    const updated = await db.from("users").update({ is_active: !data.is_active }).eq("id", id);
    if (updated.error) throw updated.error;
    return res.redirect("/owner/users");
  } catch (error) {
    next(error);
  }
});

router.post("/users/:id/reset-password", requirePortal("owner"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { data, error } = await db.from("users").select("id, name").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).render("error", { title: "غير موجود", code: 404, message: "المستخدم غير موجود." });

    const tempPassword = generateTempPassword();
    const updated = await db.from("users").update({ password_hash: hashPassword(tempPassword), must_change_password: true }).eq("id", id);
    if (updated.error) throw updated.error;

    // إبطال الجلسات الحالية للمستخدم
    await db.from("sessions").delete().eq("user_id", id);

    await db.from("credentials_vault").upsert({
      user_id: id,
      password_plain: tempPassword,
      updated_at: new Date().toISOString(),
    });

    return ownerPage(res, "owner/users-created", {
      title: "إعادة تعيين كلمة المرور",
      pageTitle: "إعادة تعيين كلمة المرور",
      newUser: { name: data.name, role: "student", email: null, university_id: null },
      tempPassword,
      resetExisting: true,
    });
  } catch (error) {
    next(error);
  }
});

// ---------- خزنة كلمات المرور المؤقتة ----------
router.get("/vault", requirePortal("owner"), async (req, res, next) => {
  try {
    const { data, error } = await db
      .from("credentials_vault")
      .select("user_id, password_plain, updated_at, users!credentials_vault_user_id_fkey(id, name, role, university_id, email)")
      .order("updated_at", { ascending: false });
    if (error) throw error;

    return ownerPage(res, "owner/vault", {
      title: "خزنة كلمات المرور",
      pageTitle: "خزنة كلمات المرور",
      entries: (data ?? []).map((row) => ({ ...row, user: row.users })),
    });
  } catch (error) {
    next(error);
  }
});

// إدارة الطلاب (المالك يرى الجميع)
router.use("/students", createStudentsRouter({ portalKey: "owner", basePath: "/owner/students", isOwner: true }));

// ---------- الموظفون (قائمة الأساتذة) ----------
router.get("/staff", requirePortal("owner"), async (req, res, next) => {
  try {
    const query = String(req.query.q ?? "").trim().toLowerCase();

    const [staffRes, courseCountsRes] = await Promise.all([
      db.from("users").select("id, name, email, position, is_staff, is_active, last_login, created_at").eq("role", "teacher").order("id"),
      db.from("courses").select("teacher_id"),
    ]);
    if (staffRes.error) throw staffRes.error;
    if (courseCountsRes.error) throw courseCountsRes.error;

    const counts = new Map();
    for (const row of courseCountsRes.data ?? []) {
      counts.set(row.teacher_id, (counts.get(row.teacher_id) ?? 0) + 1);
    }

    const staff = (staffRes.data ?? [])
      .filter((user) => {
        if (!query) return true;
        return [user.name, user.email, user.position].some((value) =>
          String(value ?? "").toLowerCase().includes(query)
        );
      })
      .map((user) => ({ ...user, courseCount: counts.get(user.id) ?? 0 }));

    return ownerPage(res, "owner/staff", {
      title: "الموظفون",
      pageTitle: "الموظفون",
      staff,
      searchAction: "/owner/staff",
      searchPlaceholder: "ابحث باسم أو بريد...",
      searchValue: req.query.q ?? "",
    });
  } catch (error) {
    next(error);
  }
});

router.post("/staff/:id/toggle-staff", requirePortal("owner"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { data, error } = await db.from("users").select("id, is_staff, role").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data || data.role !== "teacher") {
      return res.status(404).render("error", { title: "غير موجود", code: 404, message: "الأستاذ غير موجود." });
    }
    const updated = await db.from("users").update({ is_staff: !data.is_staff }).eq("id", id);
    if (updated.error) throw updated.error;
    return res.redirect("/owner/staff");
  } catch (error) {
    next(error);
  }
});

// ---------- المقررات (كل المقررات) ----------
router.use("/", createManagementRouter({ portalKey: "owner", basePath: "/owner", isOwner: true }));

// ---------- الإعدادات ----------
router.get("/settings", requirePortal("owner"), async (req, res, next) => {
  try {
    const { data, error } = await db.from("settings").select("key, value");
    if (error) throw error;
    const settings = Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));
    return ownerPage(res, "owner/settings", {
      title: "الإعدادات",
      pageTitle: "الإعدادات",
      settings,
      saved: req.query.saved === "1",
    });
  } catch (error) {
    next(error);
  }
});

router.post("/settings", requirePortal("owner"), async (req, res, next) => {
  try {
    const textKeys = ["platform_name", "platform_tagline", "watermark_text", "watermark_latin", "ai_provider", "ai_model", "ai_api_key"];
    const flagKeys = ["owner_all_gates", "allow_student_register"];

    for (const key of textKeys) {
      if (req.body[key] !== undefined) await setSetting(key, String(req.body[key] ?? ""));
    }
    for (const key of flagKeys) {
      await setSetting(key, req.body[key] === "on" ? "1" : "0");
    }

    return res.redirect("/owner/settings?saved=1");
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
      searchAction: "/owner/archive",
      searchPlaceholder: "ابحث في الأرشيف...",
      searchValue: req.query.q ?? "",
    });
  } catch (error) {
    next(error);
  }
});

// ---------- التقرير الشامل ----------
async function buildStudentReport() {
  const { data, error } = await db
    .from("users")
    .select("id, name, university_id, track, level")
    .eq("role", "student")
    .eq("is_active", true)
    .order("id");
  if (error) throw error;
  const students = data ?? [];

  const report = [];
  for (const student of students) {
    const enrollRes = await db.from("enrollments").select("course_id, courses(id, title, code, attendance_weight, exams_weight, assignments_weight)").eq("student_id", student.id);
    const courses = (enrollRes.data ?? []).map((row) => row.courses).filter(Boolean);
    const grades = await Promise.all(courses.map((course) => getCourseGrade(course, student.id)));
    const attendanceCount = grades.reduce((sum, grade) => sum + grade.attendance.attended, 0);
    const totalLectures = grades.reduce((sum, grade) => sum + grade.attendance.total, 0);
    const pointsRes = await db.from("points_ledger").select("points").eq("user_id", student.id);
    const points = (pointsRes.data ?? []).reduce((sum, row) => sum + (row.points ?? 0), 0);
    const average = grades.length ? grades.reduce((sum, grade) => sum + grade.total, 0) / grades.length : 0;

    report.push({
      id: student.id,
      name: student.name,
      code: student.university_id ?? "—",
      courses: courses.length,
      average: Math.round(average * 10) / 10,
      attendanceRate: totalLectures ? Math.round((attendanceCount / totalLectures) * 100) : 0,
      points,
    });
  }
  return report;
}

router.get("/report/html", requirePortal("owner"), async (req, res, next) => {
  try {
    const students = await buildStudentReport();
    return ownerPage(res, "owner/report", {
      title: "التقرير الشامل",
      pageTitle: "التقرير الشامل",
      students,
      generatedAt: new Date(),
      printable: true,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/report/csv", requirePortal("owner"), async (req, res, next) => {
  try {
    const students = await buildStudentReport();
    const header = "الاسم,الرقم الجامعي,المقررات,متوسط الدرجات,نسبة الحضور,النقاط\n";
    const rows = students.map((student) =>
      [student.name, student.code, student.courses, student.average, student.attendanceRate, student.points].join(",")
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="alzain-report.csv"`);
    res.send("\uFEFF" + header + rows.join("\n"));
  } catch (error) {
    next(error);
  }
});

export default router;

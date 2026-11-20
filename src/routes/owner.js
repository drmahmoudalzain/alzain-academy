import express from "express";
import multer from "multer";
import { db } from "../lib/supabase.js";
import { renderPage } from "../lib/render.js";
import { requirePortal } from "../middleware/auth.js";
import { createManagementRouter } from "../lib/management.js";
import { setSetting } from "../lib/settings.js";
import { hashPassword } from "../lib/password.js";
import { getSubjectGradesBulk } from "../lib/student-data.js";
import { parseStudentTrack, TRACK_PROFILES, STUDENT_TRACK_KEYS, resolveTrackAlias, getProfile } from "../lib/tracks.js";
import { createStudentsRouter } from "../lib/students.js";
import { isFounder } from "../lib/portals.js";
import { provisionUser, generateTempPassword } from "../lib/platformCode.js";
import { extractRosterFromFile } from "../lib/excelNames.js";

const router = express.Router();

const ownerPage = (res, view, locals) =>
  renderPage(res, view, { layout: "portal", portal: res.locals.portal, ...locals });

// المستوى رقم صحيح بين 1 و4، وأي قيمة غير صالحة تُستبدل بالافتراضي بدل NaN.
function parseLevel(value, fallback = 1) {
  const number = Number(value);
  return Number.isInteger(number) ? Math.min(4, Math.max(1, number)) : fallback;
}

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
      .select("id, role, name, email, university_id, platform_id, position, track, level, is_active, last_login, created_at, is_staff")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (role === "teacher" || role === "student" || role === "assistant") builder = builder.eq("role", role);
    const { data, error } = await builder;
    if (error) throw error;

    const users = (data ?? []).filter((user) => {
      if (!query) return true;
      return [user.name, user.email, user.university_id, user.platform_id, user.position].some((value) =>
        String(value ?? "").toLowerCase().includes(query)
      );
    });

    return ownerPage(res, "owner/users", {
      title: "المستخدمون",
      pageTitle: "المستخدمون",
      users,
      role,
      searchAction: "/owner/users",
      searchPlaceholder: "ابحث باسم أو رمز أو رقم جامعي...",
      searchValue: req.query.q ?? "",
    });
  } catch (error) {
    next(error);
  }
});

// ---------- إنشاء مستخدم ----------
router.get("/users/new", requirePortal("owner"), async (req, res, next) => {
  try {
    return ownerPage(res, "owner/users-new", {
      title: "إضافة مستخدم",
      pageTitle: "إضافة مستخدم",
      error: null,
      role: ["teacher", "assistant"].includes(req.query.role) ? req.query.role : "student",
    });
  } catch (error) {
    next(error);
  }
});

router.post("/users", requirePortal("owner"), async (req, res, next) => {
  const role = ["teacher", "assistant"].includes(req.body.role) ? req.body.role : "student";
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
    const track = parseStudentTrack(req.body.track);
    const level = parseLevel(req.body.level);

    if (name.length < 3) return fail("الاسم قصير جداً.");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail("صيغة البريد الإلكتروني غير صحيحة.");

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

    let provisioned;
    try {
      provisioned = await provisionUser({
        role,
        name,
        track: role === "student" ? track : null,
        level: role === "student" ? level : null,
        universityId,
        email,
        position,
      });
    } catch (error) {
      const message = String(error?.message ?? error);
      if (message.includes("university_id")) return fail("الرقم الجامعي مستخدم في حساب آخر.");
      if (message.includes("email")) return fail("البريد الإلكتروني مستخدم في حساب آخر.");
      throw error;
    }

    return ownerPage(res, "owner/users-created", {
      title: "تم إنشاء الحساب",
      pageTitle: "تم إنشاء الحساب",
      newUser: provisioned.user,
      tempPassword: provisioned.password,
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
    if (await isFounder({ id })) return res.redirect("/owner/users");

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
    const { data, error } = await db.from("users").select("id, name, role, platform_id, email, university_id").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).render("error", { title: "غير موجود", code: 404, message: "المستخدم غير موجود." });

    const tempPassword = generateTempPassword();
    const updated = await db.from("users").update({ password_hash: hashPassword(tempPassword), must_change_password: true, failed_attempts: 0, locked_until: null }).eq("id", id);
    if (updated.error) throw updated.error;

    // إبطال الجلسات الحالية للمستخدم
    await db.from("sessions").delete().eq("user_id", id);

    // سجل تدقيق: من أعاد التوليد ولمن ومتى
    await db.from("archived_records").insert({
      table_name: "password_reset",
      record_id: id,
      label: `إعادة توليد كلمة المرور — ${data.name}`,
      data: { target_user_id: id, target_name: data.name, platform_id: data.platform_id ?? null, reset_by: req.user?.id ?? null, reset_by_name: req.user?.name ?? null, at: new Date().toISOString() },
      archived_by: req.user?.id ?? null,
    });

    return ownerPage(res, "owner/users-created", {
      title: "إعادة تعيين كلمة المرور",
      pageTitle: "إعادة تعيين كلمة المرور",
      newUser: data,
      tempPassword,
      resetExisting: true,
    });
  } catch (error) {
    next(error);
  }
});

// ================= استيراد دفعات (CSV) =================
// كل سطر: الاسم الرباعي، المسار، الرقم الجامعي (اختياري) — الفواصل أو الجدولة أو الفاصلة المنقوطة
router.get("/users/import", requirePortal("owner"), async (req, res, next) => {
  try {
    return ownerPage(res, "owner/users-import", {
      title: "استيراد دفعات",
      pageTitle: "استيراد دفعات",
      error: null,
      results: null,
      failures: [],
      input: "",
    });
  } catch (error) {
    next(error);
  }
});

router.post("/users/import", requirePortal("owner"), async (req, res, next) => {
  const raw = String(req.body.batch ?? "");
  const fail = (message) =>
    ownerPage(res.status(422), "owner/users-import", {
      title: "استيراد دفعات",
      pageTitle: "استيراد دفعات",
      error: message,
      results: null,
      failures: [],
      input: raw,
    });

  try {
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));

    if (lines.length === 0) return fail("الصق سطوراً تحتوي بيانات الطلاب (الاسم، المسار، [رقم جامعي]).");
    if (lines.length > 300) return fail("الحد الأقصى 300 سطر في الدفعة الواحدة.");

    const results = [];
    const failures = [];

    for (const [index, line] of lines.entries()) {
      const parts = line.split(/[,;\t|]/).map((part) => part.trim()).filter(Boolean);
      const name = parts[0] ?? "";
      const trackInput = String(parts[1] ?? "").trim();
      // يقبل المفتاح الإنجليزي أو الاسم العربي (طلاب/طالبات/معادلة/خارج/دراسات عليا).
      const trackRaw = trackInput ? resolveTrackAlias(trackInput) : "bachelor_m";
      const universityId = parts[2] || null;

      if (name.length < 3) {
        failures.push({ line: index + 1, text: line, reason: "الاسم قصير جداً" });
        continue;
      }
      if (!trackRaw) {
        failures.push({
          line: index + 1,
          text: line,
          reason: `مسار غير معروف «${trackInput}» — اكتب: طلاب، طالبات، معادلة، خارج، دراسات عليا`,
        });
        continue;
      }
      if (trackRaw === "bachelor") {
        failures.push({
          line: index + 1,
          text: line,
          reason: "«بكالوريوس» مسار المقرر الأصلي وليس مسار حساب طالب — حدد «طلاب» أو «طالبات».",
        });
        continue;
      }

      try {
        const { user, password, platformId } = await provisionUser({
          role: "student",
          name,
          track: trackRaw,
          level: 1,
          universityId,
          email: null,
          position: null,
        });
        results.push({ name, platformId, password, track: TRACK_PROFILES[trackRaw].label, trackKey: trackRaw, level: 1 });
      } catch (error) {
        const message = String(error?.message ?? error);
        failures.push({ line: index + 1, text: line, reason: message.includes("university_id") ? "الرقم الجامعي مكرر" : "تعذر الإنشاء" });
      }
    }

    // سجل تدقيق للاستيراد
    if (results.length) {
      await db.from("archived_records").insert({
        table_name: "bulk_import",
        record_id: null,
        label: `استيراد دفعة — ${results.length} حساباً`,
        data: { created: results.length, failed: failures.length, by: req.user?.id ?? null, by_name: req.user?.name ?? null, at: new Date().toISOString() },
        archived_by: req.user?.id ?? null,
      });
    }

    return ownerPage(res, "owner/users-import", {
      title: "نتيجة الاستيراد",
      pageTitle: "استيراد دفعات",
      error: null,
      results,
      failures,
      input: raw,
    });
  } catch (error) {
    next(error);
  }
});

// ================= تسجيل دفعة من ملف إكسل (أسماء فقط) =================
const rosterUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (/\.(xlsx|xlsm|csv)$/i.test(file.originalname ?? "")) return cb(null, true);
    cb(new Error("صيغة الملف غير مدعومة — استخدم xlsx أو xlsm أو csv."));
  },
});

function renderImportPage(res, { status = 200, error = null, results = null, failures = [], input = "" } = {}) {
  return ownerPage(res.status(status), "owner/users-import", {
    title: results ? "نتيجة الاستيراد" : "استيراد دفعات",
    pageTitle: "استيراد دفعات",
    error,
    results,
    failures,
    input,
  });
}

const uploadRoster = (req, res, next) =>
  rosterUpload.single("roster")(req, res, (error) => {
    if (error) return renderImportPage(res, { status: 422, error: error.message });
    next();
  });

router.post("/users/import-excel", requirePortal("owner"), uploadRoster, async (req, res, next) => {
  const trackRaw = String(req.body.track ?? "").toLowerCase();
  const level = parseLevel(req.body.level);
  const fail = (message) => renderImportPage(res, { status: 422, error: message });

  try {
    if (!STUDENT_TRACK_KEYS.includes(trackRaw)) return fail("اختر مساراً صحيحاً للدفعة (طلاب/طالبات/معادلة/خارج/دراسات عليا).");

    const rows = await extractRosterFromFile(req.file);
    if (!rows.length) return fail("لم يتم العثور على أسماء في العمود الأول من الملف.");
    if (rows.length > 300) return fail("الحد الأقصى 300 اسم في الدفعة الواحدة.");

    const results = [];
    const failures = [];
    const tracksUsed = {};

    for (const [index, row] of rows.entries()) {
      const line = index + 1;
      const { name, trackRaw: cellTrack, levelRaw } = row;
      if (name.length < 3) {
        failures.push({ line, text: name, reason: "الاسم قصير جداً" });
        continue;
      }

      // عمود المسار اختياري: إن وُجد حُلّ إلى مفتاح مسار، وإلا استُخدم مسار الدفعة الافتراضي.
      let track = trackRaw;
      if (cellTrack) {
        track = resolveTrackAlias(cellTrack);
        if (!track) {
          failures.push({ line, text: name, reason: `مسار غير معروف «${cellTrack}»` });
          continue;
        }
        if (track === "bachelor") {
          failures.push({ line, text: name, reason: "«بكالوريوس» مسار المقرر الأصلي وليس مسار حساب طالب — حدد «طلاب» أو «طالبات»." });
          continue;
        }
      }

      let studentLevel = level;
      if (levelRaw) {
        const parsed = Number(levelRaw);
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 4) {
          failures.push({ line, text: name, reason: `مستوى غير صالح «${levelRaw}» (1–4)` });
          continue;
        }
        studentLevel = parsed;
      }

      try {
        const { user, password, platformId } = await provisionUser({
          role: "student",
          name,
          track,
          level: studentLevel,
          universityId: null,
          email: null,
          position: null,
        });
        results.push({
          name: user.name,
          platformId,
          password,
          track: TRACK_PROFILES[track].label,
          trackKey: track,
          level: studentLevel,
        });
        tracksUsed[track] = (tracksUsed[track] ?? 0) + 1;
      } catch (error) {
        failures.push({ line, text: name, reason: String(error?.message ?? error).slice(0, 120) });
      }
    }

    if (results.length) {
      const summary = Object.entries(tracksUsed)
        .map(([key, count]) => `${TRACK_PROFILES[key].label} (${key}): ${count}`)
        .join("، ");
      await db.from("archived_records").insert({
        table_name: "bulk_import",
        record_id: null,
        label: `تسجيل دفعة إكسل — ${results.length} حساباً (${summary})`,
        data: {
          source: "excel",
          default_track: trackRaw,
          default_level: level,
          tracks: tracksUsed,
          shared_tracks: Object.keys(tracksUsed).length > 1,
          created: results.length,
          failed: failures.length,
          file_name: req.file?.originalname ?? null,
          by: req.user?.id ?? null,
          by_name: req.user?.name ?? null,
          at: new Date().toISOString(),
        },
        archived_by: req.user?.id ?? null,
      });
    }

    return renderImportPage(res, { results, failures });
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
const csvCell = (value) => {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text.trimStart())) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

const SECTION_ORDER = ["bachelor", "bachelor_m", "bachelor_f", "equiv", "external", "grad"];

const TRACK_META = {
  bachelor: { label: "بكالوريوس — مشترك", title: "قسم البكالوريوس — المقرر الأصلي (مشترك)" },
  bachelor_m: { label: "مسار الطلاب", title: "قسم مسار الطلاب — نظام الدراسة المنفصلة" },
  bachelor_f: { label: "مسار الطالبات", title: "قسم مسار الطالبات — نظام الدراسة المنفصلة" },
  equiv: { label: "قسم المعادلة", title: "قسم المعادلة — نظام الدراسة المشتركة" },
  external: { label: "طلاب من الخارج", title: "قسم طلاب من الخارج — نظام الدراسة المشتركة" },
  grad: { label: "الدراسات العليا", title: "قسم الدراسات العليا — نظام الدراسة المشتركة" },
};

async function buildStudentReport() {
  const { data, error } = await db
    .from("users")
    .select("id, name, university_id, platform_id, track, level")
    .eq("role", "student")
    .eq("is_active", true)
    .order("track")
    .order("id");
  if (error) throw error;
  const students = data ?? [];

  const studentIds = students.map((student) => student.id);
  if (!studentIds.length) return [];

  // كل البيانات تُجلب دفعة واحدة، ثم تُحسب الدرجات محلياً بدل مئات الاستعلامات.
  const [enrollRes, pointsRes] = await Promise.all([
    db.from("enrollments")
      .select("student_id, status, courses(id, title, code, parent_course_id, archived)")
      .in("student_id", studentIds)
      .eq("status", "active"),
    db.from("points_ledger").select("user_id, points").in("user_id", studentIds),
  ]);
  if (enrollRes.error) throw enrollRes.error;
  if (pointsRes.error) throw pointsRes.error;

  const coursesByStudent = new Map(studentIds.map((id) => [id, []]));
  for (const row of enrollRes.data ?? []) {
    if (!row.courses || row.courses.archived) continue;
    coursesByStudent.get(row.student_id)?.push(row.courses);
  }
  const pointsByStudent = new Map();
  for (const row of pointsRes.data ?? []) {
    pointsByStudent.set(row.user_id, (pointsByStudent.get(row.user_id) ?? 0) + Number(row.points ?? 0));
  }

  const gradesByStudent = await getSubjectGradesBulk(
    students.map((student) => ({ studentId: student.id, courses: coursesByStudent.get(student.id) ?? [] }))
  );

  return students.map((student) => {
    const grades = gradesByStudent.get(student.id) ?? [];
    const attendanceCount = grades.reduce((sum, grade) => sum + grade.attendance.attended, 0);
    const totalLectures = grades.reduce((sum, grade) => sum + grade.attendance.total, 0);
    const average = grades.length ? grades.reduce((sum, grade) => sum + grade.percent, 0) / grades.length : 0;
    return {
      id: student.id,
      name: student.name,
      code: student.platform_id ?? student.university_id ?? "—",
      track: student.track ?? "bachelor_m",
      level: student.level ?? "—",
      trackLabel: TRACK_META[student.track]?.label ?? getProfile(student.track).label,
      courses: grades.length,
      average: Math.round(average * 10) / 10,
      attendanceRate: totalLectures ? Math.round((attendanceCount / totalLectures) * 100) : 0,
      points: pointsByStudent.get(student.id) ?? 0,
    };
  });
}

function reportSections(students) {
  const byTrack = new Map();
  for (const student of students) {
    const key = student.track;
    if (!byTrack.has(key)) byTrack.set(key, []);
    byTrack.get(key).push(student);
  }
  // أي مسار غير معروف في الترتيب الثابت يظهر في قسم مستقل بدل أن يختفي من التقرير.
  const keys = [...SECTION_ORDER, ...[...byTrack.keys()].filter((key) => !SECTION_ORDER.includes(key))];
  return keys
    .filter((key) => (byTrack.get(key) ?? []).length)
    .map((key) => ({
      track: key,
      title: TRACK_META[key]?.title ?? "قسم غير محدد",
      short: TRACK_META[key]?.label ?? key,
      rows: byTrack.get(key),
    }));
}

router.get("/report/html", requirePortal("owner"), async (req, res, next) => {
  try {
    const students = await buildStudentReport();
    const sections = reportSections(students);
    return ownerPage(res, "owner/report", {
      title: "التقرير الشامل",
      pageTitle: "التقرير الشامل",
      students,
      sections,
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
    const sections = reportSections(students);
    const lines = [
      '\uFEFF"التقرير الشامل — أكاديمية آل الزين"',
      `"تاريخ الإصدار","${new Date().toLocaleString("ar", { numberingSystem: "latn" })}"`,
      "",
    ];

    for (const section of sections) {
      lines.push(`"${section.title}"`);
      lines.push("الاسم,الرقم الجامعي,القسم,المستوى,المقررات,متوسط الدرجات,نسبة الحضور,النقاط");
      for (const student of section.rows) {
        lines.push(
          [student.name, student.code, student.trackLabel, student.level, student.courses, student.average, student.attendanceRate, student.points]
            .map(csvCell)
            .join(",")
        );
      }
      lines.push("");
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="alzain-report.csv"`);
    res.send(lines.join("\n"));
  } catch (error) {
    next(error);
  }
});

export default router;

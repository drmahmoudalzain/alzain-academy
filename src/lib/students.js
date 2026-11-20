import express from "express";
import { db } from "./supabase.js";
import { renderPage } from "./render.js";
import { requirePortal } from "../middleware/auth.js";
import { getSubjectGrades } from "./student-data.js";
import { parseStudentTrack } from "./tracks.js";
import { hashPassword } from "./password.js";
import { generateTempPassword } from "./platformCode.js";

// تبويبات فلترة الطلاب. «bachelor» يضم الأصل والطلاب والطالبات؛ والباقي مسارات منفصلة.
const TRACK_FILTER_KEYS = ["all", "bachelor", "bachelor_m", "bachelor_f", "equiv", "external", "grad"];
const BACHELOR_TRACK_KEYS = new Set(["bachelor", "bachelor_m", "bachelor_f"]);

function normalizeTrackFilter(value) {
  const track = String(value ?? "").trim();
  return TRACK_FILTER_KEYS.includes(track) ? track : "all";
}

function matchesTrackFilter(student, track) {
  if (track === "all") return true;
  if (track === "bachelor") return BACHELOR_TRACK_KEYS.has(student.track);
  return student.track === track;
}

function countTrackFilters(students) {
  const counts = {
    all: students.length,
    bachelor: 0,
    bachelor_m: 0,
    bachelor_f: 0,
    equiv: 0,
    external: 0,
    grad: 0,
  };
  for (const student of students) {
    if (BACHELOR_TRACK_KEYS.has(student.track)) counts.bachelor += 1;
    if (Object.prototype.hasOwnProperty.call(counts, student.track)) counts[student.track] += 1;
  }
  return counts;
}

// المستويات تظهر داخل مسارات البكالوريوس فقط؛ القيمة «all» تعني كل المستويات.
function normalizeLevelFilter(value) {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "all") return "all";
  const level = Number(raw);
  return Number.isInteger(level) && level >= 1 && level <= 4 ? level : "all";
}

function matchesLevelFilter(student, level) {
  return level === "all" || Number(student.level) === level;
}

function countLevelFilters(students) {
  const counts = { all: students.length, 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const student of students) {
    const level = Number(student.level);
    if (Object.prototype.hasOwnProperty.call(counts, level)) counts[level] += 1;
  }
  return counts;
}

/**
 * إدارة الطلاب — مشتركة بين بوابتي المالك والأستاذ.
 * الأستاذ يرى فقط الطلاب المسجّلين في مقرراته، والمالك يرى الجميع.
 */
export function createStudentsRouter({ portalKey, basePath, isOwner }) {
  const router = express.Router();
  const guard = requirePortal(portalKey);
  const isOwnerMode = Boolean(isOwner);

  const page = (res, view, locals) =>
    renderPage(res, view, { layout: "portal", portal: res.locals.portal, basePath, ...locals });

  // الطلاب المسموح أن يراهم المستخدم الحالي (المالك يرى الجميع، الأستاذ يرى طلاب مقرراته)
  async function visibleStudentIds(user) {
    if (isOwnerMode) {
      const { data, error } = await db.from("users").select("id").eq("role", "student");
      if (error) throw error;
      return (data ?? []).map((row) => row.id);
    }
    const coursesRes = await db.from("courses").select("id").eq("teacher_id", user.id);
    if (coursesRes.error) throw coursesRes.error;
    const ids = (coursesRes.data ?? []).map((row) => row.id);
    if (!ids.length) return [];
    const enrollRes = await db.from("enrollments").select("student_id").in("course_id", ids);
    if (enrollRes.error) throw enrollRes.error;
    return [...new Set((enrollRes.data ?? []).map((row) => row.student_id))];
  }

  // ---------- القائمة ----------
  router.get("/", guard, async (req, res, next) => {
    try {
      const searchValue = req.query.q ?? "";
      const query = String(searchValue).trim().toLowerCase();
      const track = normalizeTrackFilter(req.query.track);
      const bachelorSelected = BACHELOR_TRACK_KEYS.has(track);
      // المستوى يعمل داخل البكالوريوس فقط، ويُهمل في بقية المسارات حتى لو جاء في الرابط.
      const level = bachelorSelected ? normalizeLevelFilter(req.query.level) : "all";

      // الفلتر محفوظ في الرابط؛ روابط التبويبات تحفظ كلمة البحث الحالية أيضاً.
      const tabHref = (value) => {
        const params = new URLSearchParams();
        params.set("track", value);
        if (BACHELOR_TRACK_KEYS.has(value) && level !== "all") params.set("level", String(level));
        if (query) params.set("q", query);
        return `${basePath}?${params.toString()}`;
      };

      const levelHref = (value) => {
        const params = new URLSearchParams();
        params.set("track", track);
        if (value !== "all") params.set("level", String(value));
        if (query) params.set("q", query);
        return `${basePath}?${params.toString()}`;
      };

      const listLocals = ({ students, allStudents, totalVisible }) => {
        const bachelorStudents = allStudents.filter((student) => BACHELOR_TRACK_KEYS.has(student.track));
        const scopedBachelor = bachelorStudents.filter((student) => matchesLevelFilter(student, level));
        return {
          title: "الطلاب",
          pageTitle: "الطلاب",
          students,
          searchAction: basePath,
          searchPlaceholder: "ابحث باسم أو رقم...",
          searchValue,
          searchTrack: track,
          searchLevel: level,
          track,
          trackCounts: countTrackFilters(allStudents),
          level,
          levelCounts: countLevelFilters(bachelorStudents),
          bachelorGenderCounts: countTrackFilters(scopedBachelor),
          tabHref,
          levelHref,
          totalVisible,
          pageCss: "/css/views/students.css",
        };
      };

      const ids = await visibleStudentIds(req.user);
      if (!ids.length) {
        return page(res, "manage/students", listLocals({ students: [], allStudents: [], totalVisible: 0 }));
      }

      const { data, error } = await db
        .from("users")
        .select("id, name, university_id, platform_id, email, track, level, is_active, gender, last_login")
        .in("id", ids)
        .order("id");
      if (error) throw error;

      const allStudents = data ?? [];

      // عدد المقررات لكل طالب (ضمن مقررات الرؤية)
      const enrollRes = await db.from("enrollments").select("student_id").in("student_id", ids);
      const courseCount = new Map();
      for (const row of enrollRes.data ?? []) {
        courseCount.set(row.student_id, (courseCount.get(row.student_id) ?? 0) + 1);
      }

      const students = allStudents
        .filter((student) => matchesTrackFilter(student, track))
        .filter((student) => matchesLevelFilter(student, level))
        .filter((student) => {
          if (!query) return true;
          return [student.name, student.university_id, student.platform_id, student.email].some((value) =>
            String(value ?? "").toLowerCase().includes(query)
          );
        })
        .map((student) => ({ ...student, courseCount: courseCount.get(student.id) ?? 0 }));

      return page(res, "manage/students", listLocals({ students, allStudents, totalVisible: allStudents.length }));
    } catch (error) {
      next(error);
    }
  });

  // ---------- التفاصيل ----------
  router.get("/:id", guard, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).render("error", { title: "طلب غير صالح", code: 400, message: "معرّف غير صحيح." });
      }

      // السماح فقط بالطلاب ضمن رؤية المستخدم الحالي
      const allowed = await visibleStudentIds(req.user);
      if (!allowed.includes(id)) {
        return res.status(403).render("error", { title: "غير مسموح", code: 403, message: "لا تملك صلاحية عرض هذا الطالب." });
      }

      const { data: student, error } = await db
        .from("users")
        .select("id, name, email, phone, university_id, platform_id, track, level, gender, is_active, must_change_password, created_at, last_login")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!student) {
        return res.status(404).render("error", { title: "غير موجود", code: 404, message: "الطالب غير موجود." });
      }

      const enrollRes = await db
        .from("enrollments")
        .select("course_id, courses(id, title, code, color, level, track, teacher_id, parent_course_id, attendance_weight, exams_weight, assignments_weight)")
        .eq("student_id", id);
      if (enrollRes.error) throw enrollRes.error;
      const courses = (enrollRes.data ?? []).map((row) => row.courses).filter(Boolean);

      const grades = await getSubjectGrades(courses, id);
      const pointsRes = await db.from("points_ledger").select("points, source_type").eq("user_id", id);
      if (pointsRes.error) throw pointsRes.error;
      const points = (pointsRes.data ?? []).reduce((sum, row) => sum + (row.points ?? 0), 0);

      return page(res, "manage/student-detail", {
        title: student.name,
        pageTitle: "بيانات الطالب",
        student,
        courses: grades,
        points,
        isStaffOwner: isOwnerMode,
        canResetPassword: isOwnerMode,
      });
    } catch (error) {
      next(error);
    }
  });

  // ---------- التعديل ----------
  router.get("/:id/edit", guard, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const allowed = await visibleStudentIds(req.user);
      if (!allowed.includes(id)) {
        return res.status(403).render("error", { title: "غير مسموح", code: 403, message: "لا تملك صلاحية تعديل هذا الطالب." });
      }

      const { data: student, error } = await db
        .from("users")
        .select("id, name, email, phone, university_id, platform_id, track, level, gender, is_active")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!student) {
        return res.status(404).render("error", { title: "غير موجود", code: 404, message: "الطالب غير موجود." });
      }

      return page(res, "manage/student-edit", {
        title: "تعديل بيانات الطالب",
        pageTitle: "تعديل بيانات الطالب",
        student,
        error: null,
        saved: req.query.saved === "1",
        isStaffOwner: isOwnerMode,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:id", guard, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const allowed = await visibleStudentIds(req.user);
      if (!allowed.includes(id)) {
        return res.status(403).render("error", { title: "غير مسموح", code: 403, message: "لا تملك صلاحية تعديل هذا الطالب." });
      }

      const { data: current, error: currentError } = await db
        .from("users")
        .select("id, track, level, gender")
        .eq("id", id)
        .maybeSingle();
      if (currentError) throw currentError;
      if (!current) {
        return res.status(404).render("error", { title: "غير موجود", code: 404, message: "الطالب غير موجود." });
      }

      const name = String(req.body.name ?? "").trim();
      const email = String(req.body.email ?? "").trim().toLowerCase() || null;
      const phone = String(req.body.phone ?? "").trim() || null;
      const universityId = String(req.body.university_id ?? "").trim() || null;

      // القسم والمستوى والجنس بيانات أكاديمية مركزية: يعدّلها المالك فقط.
      const track = isOwnerMode ? parseStudentTrack(req.body.track, current.track ?? undefined) : current.track;
      const levelNumber = Number(req.body.level);
      const level = isOwnerMode
        ? (Number.isInteger(levelNumber) ? Math.min(4, Math.max(1, levelNumber)) : current.level ?? 1)
        : current.level;
      const gender = isOwnerMode
        ? (["M", "F"].includes(req.body.gender) ? req.body.gender : null)
        : current.gender;
      const isActive = req.body.is_active === "on";
      const update = { name, email, phone, university_id: universityId, track, level, gender };
      // الإيقاف العام للحساب من صلاحية المالك؛ الأستاذ يوقف الطالب داخل مقرره فقط.
      if (isOwnerMode) update.is_active = isActive;

      if (name.length < 3) {
        const student = (
          await db.from("users").select("id, name, email, phone, university_id, platform_id, track, level, gender, is_active").eq("id", id).maybeSingle()
        ).data;
        return page(res.status(422), "manage/student-edit", {
          title: "تعديل بيانات الطالب",
          pageTitle: "تعديل بيانات الطالب",
          student,
          error: "الاسم قصير جداً.",
          saved: false,
          isStaffOwner: isOwnerMode,
        });
      }

      // فحص تعارض البريد والرقم الجامعي
      if (universityId) {
        const clash = await db.from("users").select("id").eq("university_id", universityId).neq("id", id).maybeSingle();
        if (clash.error) throw clash.error;
        if (clash.data) {
          return page(res.status(422), "manage/student-edit", {
            title: "تعديل بيانات الطالب",
            pageTitle: "تعديل بيانات الطالب",
            student: { id, name, email, phone, university_id: universityId, track, level, gender, is_active: isActive },
            error: "الرقم الجامعي مستخدم في حساب آخر.",
            saved: false,
            isStaffOwner: isOwnerMode,
          });
        }
      }
      if (email) {
        const clash = await db.from("users").select("id").eq("email", email).neq("id", id).maybeSingle();
        if (clash.error) throw clash.error;
        if (clash.data) {
          return page(res.status(422), "manage/student-edit", {
            title: "تعديل بيانات الطالب",
            pageTitle: "تعديل بيانات الطالب",
            student: { id, name, email, phone, university_id: universityId, track, level, gender, is_active: isActive },
            error: "البريد مستخدم في حساب آخر.",
            saved: false,
            isStaffOwner: isOwnerMode,
          });
        }
      }

      const updated = await db
        .from("users")
        .update(update)
        .eq("id", id);
      if (updated.error) throw updated.error;

      return res.redirect(`${basePath}/${id}?saved=1`);
    } catch (error) {
      next(error);
    }
  });

  // ---------- إعادة تعيين كلمة المرور (المالك فقط) ----------
  router.post("/:id/reset-password", guard, async (req, res, next) => {
    try {
      if (!isOwnerMode) {
        return res.status(403).render("error", { title: "غير مسموح", code: 403, message: "إعادة تعيين كلمة المرور للمالك فقط." });
      }

      const id = Number(req.params.id);
      const { data: student, error } = await db.from("users").select("id, name, platform_id, university_id, email").eq("id", id).eq("role", "student").maybeSingle();
      if (error) throw error;
      if (!student) {
        return res.status(404).render("error", { title: "غير موجود", code: 404, message: "الطالب غير موجود." });
      }

      const tempPassword = generateTempPassword();
      const updated = await db
        .from("users")
        .update({ password_hash: hashPassword(tempPassword), must_change_password: true, failed_attempts: 0, locked_until: null })
        .eq("id", id);
      if (updated.error) throw updated.error;

      await db.from("sessions").delete().eq("user_id", id);
      await db.from("archived_records").insert({
        table_name: "password_reset",
        record_id: id,
        label: `إعادة توليد كلمة المرور — ${student.name}`,
        data: { target_user_id: id, target_name: student.name, platform_id: student.platform_id ?? null, reset_by: req.user?.id ?? null, reset_by_name: req.user?.name ?? null, at: new Date().toISOString() },
        archived_by: req.user?.id ?? null,
      });

      return page(res, "owner/users-created", {
        title: "إعادة تعيين كلمة المرور",
        pageTitle: "إعادة تعيين كلمة المرور",
        newUser: student,
        tempPassword,
        resetExisting: true,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

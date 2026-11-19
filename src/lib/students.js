import express from "express";
import { db } from "./supabase.js";
import { renderPage } from "./render.js";
import { requirePortal } from "../middleware/auth.js";
import { getCourseGrade } from "./student-data.js";
import { parseTrackKey } from "./tracks.js";
import { hashPassword } from "./password.js";
import crypto from "node:crypto";

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
      const query = String(req.query.q ?? "").trim().toLowerCase();
      const ids = await visibleStudentIds(req.user);
      if (!ids.length) {
        return page(res, "manage/students", { title: "الطلاب", pageTitle: "الطلاب", students: [], searchValue: req.query.q ?? "" });
      }

      const { data, error } = await db
        .from("users")
        .select("id, name, university_id, email, track, level, is_active, gender, last_login")
        .in("id", ids)
        .order("id");
      if (error) throw error;

      const studentIds = ids;
      // عدد المقررات لكل طالب (ضمن مقررات الرؤية)
      const enrollRes = await db.from("enrollments").select("student_id").in("student_id", studentIds);
      const courseCount = new Map();
      for (const row of enrollRes.data ?? []) {
        courseCount.set(row.student_id, (courseCount.get(row.student_id) ?? 0) + 1);
      }

      const students = (data ?? [])
        .filter((student) => {
          if (!query) return true;
          return [student.name, student.university_id, student.email].some((value) =>
            String(value ?? "").toLowerCase().includes(query)
          );
        })
        .map((student) => ({ ...student, courseCount: courseCount.get(student.id) ?? 0 }));

      return page(res, "manage/students", {
        title: "الطلاب",
        pageTitle: "الطلاب",
        students,
        searchAction: basePath,
        searchPlaceholder: "ابحث باسم أو رقم...",
        searchValue: req.query.q ?? "",
        totalVisible: ids.length,
      });
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
        .select("id, name, email, phone, university_id, track, level, gender, is_active, must_change_password, created_at, last_login")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!student) {
        return res.status(404).render("error", { title: "غير موجود", code: 404, message: "الطالب غير موجود." });
      }

      const enrollRes = await db
        .from("enrollments")
        .select("course_id, courses(id, title, code, color, level, track, teacher_id, attendance_weight, exams_weight, assignments_weight)")
        .eq("student_id", id);
      if (enrollRes.error) throw enrollRes.error;
      const courses = (enrollRes.data ?? []).map((row) => row.courses).filter(Boolean);

      const grades = await Promise.all(courses.map((course) => getCourseGrade(course, id)));
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
        .select("id, name, email, phone, university_id, track, level, gender, is_active")
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

      const name = String(req.body.name ?? "").trim();
      const email = String(req.body.email ?? "").trim().toLowerCase() || null;
      const phone = String(req.body.phone ?? "").trim() || null;
      const universityId = String(req.body.university_id ?? "").trim() || null;
      const track = parseTrackKey(req.body.track);
      const level = Math.min(4, Math.max(1, Number(req.body.level ?? 1)));
      const gender = ["M", "F"].includes(req.body.gender) ? req.body.gender : null;
      const isActive = req.body.is_active === "on";

      if (name.length < 3) {
        const student = (
          await db.from("users").select("id, name, email, phone, university_id, track, level, gender, is_active").eq("id", id).maybeSingle()
        ).data;
        return page(res.status(422), "manage/student-edit", {
          title: "تعديل بيانات الطالب",
          pageTitle: "تعديل بيانات الطالب",
          student,
          error: "الاسم قصير جداً.",
          saved: false,
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
          });
        }
      }

      const updated = await db
        .from("users")
        .update({ name, email, phone, university_id: universityId, track, level, gender, is_active: isActive })
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
      const { data: student, error } = await db.from("users").select("id, name").eq("id", id).eq("role", "student").maybeSingle();
      if (error) throw error;
      if (!student) {
        return res.status(404).render("error", { title: "غير موجود", code: 404, message: "الطالب غير موجود." });
      }

      const tempPassword = crypto.randomBytes(9).toString("base64url");
      const updated = await db
        .from("users")
        .update({ password_hash: hashPassword(tempPassword), must_change_password: true })
        .eq("id", id);
      if (updated.error) throw updated.error;

      await db.from("sessions").delete().eq("user_id", id);
      await db.from("credentials_vault").upsert({
        user_id: id,
        password_plain: tempPassword,
        updated_at: new Date().toISOString(),
      });

      return page(res, "owner/users-created", {
        title: "إعادة تعيين كلمة المرور",
        pageTitle: "إعادة تعيين كلمة المرور",
        newUser: { name: student.name, role: "student", email: null, university_id: null },
        tempPassword,
        resetExisting: true,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

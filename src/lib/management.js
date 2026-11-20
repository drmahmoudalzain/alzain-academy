import express from "express";
import crypto from "node:crypto";
import { db } from "./supabase.js";
import { renderPage } from "./render.js";
import { requirePortal } from "../middleware/auth.js";
import {
  canManageCourse,
  getManagedCourses,
  getCourseStudents,
} from "./manage-data.js";
import { getSubjectGradesBulk } from "./student-data.js";
import { aiStatus } from "./ai.js";
import { getProfile, parseTrackKey } from "./tracks.js";
import { provisionUser } from "./platformCode.js";

/**
 * نطاق الطلاب المسموح تسجيلهم في مقرر: مستوى المقرر + مسار الطالب.
 * المقرر الأصل (bachelor) يقبل الفرعين معاً، والفرع يقبل جنسه فقط.
 * هذا القيد يمنع تسجيل طلاب مستوى آخر في مقرر ليس لمستواهم.
 */
export function getEnrollmentScope(course) {
  const level = course?.level ? String(course.level) : null;
  const track = String(course?.track ?? "");
  const tracks =
    track === "bachelor_m" ? ["bachelor_m"]
      : track === "bachelor_f" ? ["bachelor_f"]
        : track === "bachelor" ? ["bachelor_m", "bachelor_f"]
          : track ? [track] : [];
  return {
    level,
    tracks,
    isBachelor: ["bachelor", "bachelor_m", "bachelor_f"].includes(track),
  };
}

export function studentMatchesScope(student, scope) {
  if (!scope) return true;
  if (scope.level && String(student?.level ?? "") !== scope.level) return false;
  if (scope.tracks.length && !scope.tracks.includes(String(student?.track ?? ""))) return false;
  return true;
}

/**
 * مولّد مسارات الإدارة المشترك — يعمل في بوابة الأستاذ (مقرراته فقط)
 * أو في بوابة المالك (كل المقررات) بحسب `isOwner`.
 */
export function createManagementRouter({ portalKey, basePath, isOwner }) {
  const router = express.Router();
  const guard = requirePortal(portalKey);
  const isOwnerMode = Boolean(isOwner);

  // كل :id رقمي
  router.param("id", (req, res, next, value) => {
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0) {
      return res.status(400).render("error", { title: "طلب غير صالح", code: 400, message: "معرّف رقمي غير صحيح." });
    }
    next();
  });

  const toInt = (value) => {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : null;
  };

  const managePage = (res, view, locals) =>
    renderPage(res, view, {
      layout: "portal",
      portal: res.locals.portal,
      basePath,
      isOwner: isOwnerMode,
      ...locals,
    });

  const canManageFlag = () => isOwnerMode;

  const ownerOnly = (res) =>
    res.status(403).render("error", {
      title: "غير مسموح",
      code: 403,
      message: "هذه العملية من صلاحية المالك وحده.",
    });

  // الواجبات وتوليدها من صلاحية المالك وحده؛ الأستاذ يبقى له المحاضرات والاختبارات والأسئلة فقط.
  router.use("/assignments", (req, res, next) => (isOwnerMode ? next() : ownerOnly(res)));
  router.use("/ai/generate-assignment", (req, res, next) => (isOwnerMode ? next() : ownerOnly(res)));

  const notify = (createdBy, userId, title, body, link) =>
    db.from("notifications").insert({
      audience: "user",
      user_id: userId,
      title,
      body,
      link: link ?? null,
      created_by: createdBy ?? null,
    });

  const ownCourses = async (user) => {
    const courses = await getManagedCourses(
      isOwnerMode ? { allTeachers: true } : { teacherId: user.id }
    );
    return courses;
  };

  /** المقررات الأصلية الصالحة لأن تكون أماً لفروع (ليست فرعاً هي نفسها). */
  const parentCourses = async () => {
    const { data, error } = await db
      .from("courses")
      .select("id, title, code")
      .is("parent_course_id", null)
      .order("title");
    if (error) throw error;
    return data ?? [];
  };

  /** محاضرات المقررات المتاحة، لربط الاختبار بالمحاضرة التي تلتها. */
  const lecturesOf = async (courses) => {
    const ids = courses.map((course) => course.id);
    if (!ids.length) return [];
    const { data, error } = await db
      .from("lectures")
      .select("id, title, course_id, lecture_type, scheduled_at")
      .in("course_id", ids)
      .order("scheduled_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  };

  const courseOr403 = async (req, res, courseId) => {
    const course = await canManageCourse(req.user, isOwnerMode, Number(courseId));
    if (!course) return null;
    return course;
  };

  // ---------- المقررات ----------
  router.get("/courses", guard, async (req, res, next) => {
    try {
      const courses = await ownCourses(req.user);
      return managePage(res, "manage/courses", {
        title: "المقررات",
        pageTitle: isOwnerMode ? "كل المقررات" : "مقرراتي",
        courses,
        searchAction: `${basePath}/courses`,
        searchPlaceholder: "ابحث عن مقرر...",
        searchValue: req.query.q ?? "",
        query: req.query,
      });
    } catch (error) { next(error); }
  });

  router.get("/courses/new", guard, async (req, res, next) => {
    try {
      if (!isOwnerMode) return ownerOnly(res);
      let teachers = [];
      if (isOwnerMode) {
        const { data, error } = await db.from("users").select("id, name").eq("role", "teacher").order("name");
        if (error) throw error;
        teachers = data ?? [];
      }
      return managePage(res, "manage/course-new", {
        title: "إضافة مقرر",
        pageTitle: "إضافة مقرر",
        teachers,
        parents: await parentCourses(),
        parentId: null,
        error: null,
      });
    } catch (error) { next(error); }
  });

  router.post("/courses", guard, async (req, res, next) => {
    try {
      if (!isOwnerMode) return ownerOnly(res);
      const title = String(req.body.title ?? "").trim();
      const code = String(req.body.code ?? "").trim().toUpperCase();
      const description = String(req.body.description ?? "").trim() || null;
      const track = parseTrackKey(req.body.track);
      const level = Math.min(4, Math.max(1, Number(req.body.level ?? 1)));
      const color = String(req.body.color ?? "#123A63");
      const teacherId = isOwnerMode ? Number(req.body.teacher_id) : req.user.id;
      const parentId = toInt(req.body.parent_course_id);

      const fail = async (message) => {
        const teachers = isOwnerMode
          ? (await db.from("users").select("id, name").eq("role", "teacher").order("name")).data ?? []
          : [];
        return managePage(res.status(422), "manage/course-new", {
          title: "إضافة مقرر",
          pageTitle: "إضافة مقرر",
          teachers,
          parents: await parentCourses(),
          parentId,
          error: message,
        });
      };

      if (title.length < 3) return await fail("اسم المقرر قصير جداً.");
      if (!/^[A-Z0-9-]{3,12}$/.test(code)) return await fail("رمز المقرر غير صالح (أحرف وأرقام، 3-12 خانة).");
      if (isOwnerMode && !teacherId) return await fail("اختر الأستاذ المسؤول.");

      const clash = await db.from("courses").select("id").eq("code", code).maybeSingle();
      if (clash.error) throw clash.error;
      if (clash.data) return await fail("رمز المقرر مستخدم مسبقاً.");

      if (parentId) {
        const parent = await db.from("courses").select("id").eq("id", parentId).is("parent_course_id", null).maybeSingle();
        if (parent.error) throw parent.error;
        if (!parent.data) return await fail("المقرر الأصل المحدد غير صالح.");
      }

      const created = await db.from("courses").insert({
        teacher_id: teacherId,
        title,
        code,
        description,
        color,
        level,
        track,
        parent_course_id: parentId,
      }).select("id").maybeSingle();
      if (created.error) throw created.error;

      return res.redirect(`${basePath}/courses/${created.data.id}`);
    } catch (error) { next(error); }
  });

  router.get("/courses/:id", guard, async (req, res, next) => {
    try {
      const course = await courseOr403(req, res, req.params.id);
      if (!course) return res.status(404).render("error", { title: "غير موجود", code: 404, message: "المقرر غير موجود أو لا تملك صلاحية إدارته." });

      const students = await getCourseStudents(course.id);
      const [lecturesRes, examsRes, assignmentsRes] = await Promise.all([
        db.from("lectures").select("id, title, scheduled_at, lecture_type, attendance_open").eq("course_id", course.id).order("scheduled_at", { ascending: false }).limit(6),
        db.from("exams").select("id, title, starts_at, is_published").eq("course_id", course.id).order("starts_at", { ascending: false }).limit(6),
        db.from("assignments").select("id, title, due_at").eq("course_id", course.id).order("due_at", { ascending: false }).limit(6),
      ]);
      if (lecturesRes.error) throw lecturesRes.error;
      if (examsRes.error) throw examsRes.error;
      if (assignmentsRes.error) throw assignmentsRes.error;

      // تقدير مبدئي: نسبة حضور كل طالب
      const attendanceByStudent = new Map();
      const lectureIds = (lecturesRes.data ?? []).map((lecture) => lecture.id);
      if (lectureIds.length) {
        const attendanceRes = await db.from("attendance").select("student_id, lecture_id").in("lecture_id", lectureIds);
        if (attendanceRes.error) throw attendanceRes.error;
        for (const row of attendanceRes.data ?? []) {
          attendanceByStudent.set(row.student_id, (attendanceByStudent.get(row.student_id) ?? 0) + 1);
        }
      }

      return managePage(res, "manage/course-detail", {
        title: course.title,
        pageTitle: course.title,
        course,
        students: students.map((student) => ({
          ...student,
          attendanceCount: attendanceByStudent.get(student.id) ?? 0,
        })),
        lectureCount: lecturesRes.data?.length ?? 0,
        lectures: lecturesRes.data ?? [],
        exams: examsRes.data ?? [],
        assignments: assignmentsRes.data ?? [],
        notice: req.query.enrolled !== undefined
          ? `تم تسجيل ${Number(req.query.enrolled) || 0} طالباً وتخطي ${Number(req.query.skipped) || 0} تسجيل مكرر.`
          : req.query.statusSaved ? "تم تحديث حالة التسجيل في هذا المقرر."
          : req.query.branches === 'created' ? "تم إنشاء فرعي الطلاب والطالبات."
          : req.query.branches === 'exists' ? "فرعا المقرر موجودان مسبقاً."
          : null,
      });
    } catch (error) { next(error); }
  });

  /** المقررات التي يصح تسجيل طلاب هذا المقرر فيها: نفس المستوى ومسار متوافق. */
  const compatibleCourses = (course, allCourses) => {
    const scope = getEnrollmentScope(course);
    return allCourses.filter((item) => {
      const itemScope = getEnrollmentScope(item);
      if (scope.level && itemScope.level && itemScope.level !== scope.level) return false;
      return itemScope.tracks.some((track) => scope.tracks.includes(track));
    });
  };

  /**
   * توسيع التسجيل إلى «عائلة المقرر»: المقرر المختار + الأصل + فرع الطالب فقط،
   * مع قيد المستوى والمسار في الوضع الاعتيادي. زر الطوارئ (enforceScope:false)
   * يتخطى قيد المستوى/المسار، لكنه لا يضيف فرع الجنس الآخر حين يُختار فرع بعينه.
   */
  const enrollmentTargets = (selectedIds, students, allCourses, options = {}) => {
    const enforceScope = options.enforceScope !== false;
    const byId = new Map(allCourses.map((course) => [Number(course.id), course]));
    const targets = new Set();
    for (const rawId of selectedIds) {
      const selected = byId.get(Number(rawId));
      if (!selected) continue;
      const selectedScope = getEnrollmentScope(selected);
      const parent = selected.parent_course_id ? byId.get(Number(selected.parent_course_id)) : selected;
      const parentScope = parent ? getEnrollmentScope(parent) : null;
      const isBachelor = Boolean(parentScope?.isBachelor);
      for (const student of students) {
        if (enforceScope && !studentMatchesScope(student, selectedScope)) continue;
        targets.add(`${selected.id}:${student.id}`);
        if (parent && parent.id !== selected.id && (!enforceScope || studentMatchesScope(student, parentScope))) {
          targets.add(`${parent.id}:${student.id}`);
        }
        if (!isBachelor || !parent) continue;
        // الطوارئ مع فرع محدد: يُضاف الفرع المختار وأصله فقط.
        if (!enforceScope && selected.parent_course_id) continue;
        const branchTrack = student.track === "bachelor_m" ? "bachelor_m" : student.track === "bachelor_f" ? "bachelor_f" : null;
        if (!branchTrack) continue;
        const branch = allCourses.find(
          (course) => Number(course.parent_course_id) === Number(parent.id) && course.track === branchTrack
        );
        if (branch && (!enforceScope || studentMatchesScope(student, getEnrollmentScope(branch)))) {
          targets.add(`${branch.id}:${student.id}`);
        }
      }
    }
    return [...targets].map((entry) => {
      const [course_id, student_id] = entry.split(":").map(Number);
      return { course_id, student_id };
    });
  };

  /** حلّ نطاق العرض والتسجيل لمقرر مع احترام القيود حتى لو غيّر المستخدم الروابط. */
  const resolveFilters = (course, query = {}) => {
    const scope = getEnrollmentScope(course);
    const requestedTrack = String(query.track ?? "");
    const trackFilter =
      scope.tracks.includes(requestedTrack) || (requestedTrack === "all" && scope.tracks.length > 1)
        ? requestedTrack
        : (scope.tracks.length === 1 ? scope.tracks[0] : "all");
    const levelFilter = scope.level ?? (String(query.level ?? "") || "all");
    const q = String(query.q ?? "").trim().toLowerCase();
    return { scope, trackFilter, levelFilter, q };
  };

  const enrollLocals = (course, allCourses, filters, extra = {}) => ({
    course,
    courses: compatibleCourses(course, allCourses),
    studentTracks: filters.scope.tracks,
    fixedLevel: filters.scope.level,
    trackFilter: filters.trackFilter,
    levelFilter: filters.levelFilter,
    q: filters.q,
    ...extra,
  });

  // ---------- تسجيل الطلاب في المقرر (مستوى المقرر ومساره قيدان ملزمان) ----------
  router.get("/courses/:id/enroll", guard, async (req, res, next) => {
    try {
      if (!isOwnerMode) return ownerOnly(res);
      const course = await courseOr403(req, res, req.params.id);
      if (!course) return res.status(404).render("error", { title: "غير موجود", code: 404, message: "المقرر غير موجود أو لا تملك صلاحية إدارته." });

      const [studentsRes, courses] = await Promise.all([
        db.from("users").select("id, name, platform_id, university_id, track, level, is_active").eq("role", "student").order("name"),
        ownCourses(req.user),
      ]);
      if (studentsRes.error) throw studentsRes.error;

      const filters = resolveFilters(course, req.query);
      let students = (studentsRes.data ?? []).filter(
        (student) => student.is_active && studentMatchesScope(student, filters.scope)
      );
      if (filters.trackFilter !== "all") students = students.filter((student) => student.track === filters.trackFilter);
      if (filters.levelFilter !== "all") students = students.filter((student) => String(student.level) === filters.levelFilter);
      if (filters.q) {
        students = students.filter((student) =>
          [student.name, student.platform_id, student.university_id].some((value) =>
            String(value ?? "").toLowerCase().includes(filters.q)
          )
        );
      }

      const enrolled = await getCourseStudents(course.id);
      const enrolledIds = new Set(enrolled.map((student) => student.id));

      return managePage(res, "manage/enroll", enrollLocals(course, courses, filters, {
        title: `تسجيل الطلاب — ${course.title}`,
        pageTitle: "تسجيل الطلاب في المقرر",
        students,
        enrolledIds,
        error: req.query.error === "notfound" ? "لم يتم العثور على طالب بهذا الرمز."
          : req.query.error === "code" ? "صيغة الرمز غير صحيحة." : null,
      }));
    } catch (error) { next(error); }
  });

  router.post("/courses/:id/enroll", guard, async (req, res, next) => {
    try {
      if (!isOwnerMode) return ownerOnly(res);
      const course = await courseOr403(req, res, req.params.id);
      if (!course) return res.status(403).render("error", { title: "غير مسموح", code: 403, message: "لا تملك صلاحية إدارة هذا المقرر." });

      const list = (value) => (Array.isArray(value) ? value : value ? [value] : []);
      let studentIds = [...new Set(list(req.body.student_ids).map(toInt).filter(Boolean))];
      const courseIds = [...new Set(list(req.body.course_ids).map(toInt).filter(Boolean))];
      const allCourses = await ownCourses(req.user);
      const filters = resolveFilters(course, {
        track: req.body.track_filter,
        level: req.body.level_filter,
        q: req.body.q_filter,
      });

      // تسجيل دفعة واحدة: مستوى المقرر ومساره قيدان إلزاميان قبل أي تصفية أخرى.
      if (req.body.bulk_all === "1") {
        const allRes = await db
          .from("users")
          .select("id, name, platform_id, university_id, track, level")
          .eq("role", "student")
          .eq("is_active", true);
        if (allRes.error) throw allRes.error;
        let rows = (allRes.data ?? []).filter((row) => studentMatchesScope(row, filters.scope));
        if (filters.trackFilter !== "all") rows = rows.filter((row) => row.track === filters.trackFilter);
        if (filters.levelFilter !== "all") rows = rows.filter((row) => String(row.level) === filters.levelFilter);
        if (filters.q) rows = rows.filter((row) => [row.name, row.platform_id, row.university_id].some((value) => String(value ?? "").toLowerCase().includes(filters.q)));
        studentIds = rows.map((row) => row.id);
      }

      const fail = (message) => managePage(res.status(422), "manage/enroll", enrollLocals(course, allCourses, filters, {
        title: "تسجيل الطلاب", pageTitle: "تسجيل الطلاب في المقرر",
        students: [], enrolledIds: new Set(), error: message,
      }));

      if (!studentIds.length) return fail("لا يوجد طلاب مطابقون لمستوى هذا المقرر ومساره.");
      if (!courseIds.length) return fail("اختر مقرراً واحداً على الأقل.");

      const allowedIds = new Set(compatibleCourses(course, allCourses).map((item) => item.id));
      if (courseIds.some((id) => !allowedIds.has(id))) {
        return res.status(403).render("error", { title: "غير مسموح", code: 403, message: "أحد المقررات المحددة ليس لمستوى هذا المقرر أو ليس من مقرراتك." });
      }

      const studentsRes = await db
        .from("users")
        .select("id, name, platform_id, track, level")
        .in("id", studentIds)
        .eq("role", "student")
        .eq("is_active", true);
      if (studentsRes.error) throw studentsRes.error;
      const validStudents = (studentsRes.data ?? []).filter((student) => studentMatchesScope(student, filters.scope));
      if (!validStudents.length) return fail("لم يتم العثور على طلاب نشطين في مستوى هذا المقرر ومساره.");

      const courseRows = allCourses.filter((item) => courseIds.includes(item.id));
      const targets = enrollmentTargets(courseIds, validStudents, allCourses);
      const targetCourseIds = [...new Set(targets.map((pair) => pair.course_id))];
      const key = (courseId, studentId) => `${courseId}:${studentId}`;

      const existingRes = await db.from("enrollments").select("course_id, student_id, status").in("course_id", targetCourseIds);
      if (existingRes.error) throw existingRes.error;
      const existing = new Set((existingRes.data ?? []).map((row) => key(row.course_id, row.student_id)));

      const pairs = targets.filter((pair) => !existing.has(key(pair.course_id, pair.student_id)))
        .map((pair) => ({ ...pair, status: "active" }));

      if (targets.length) {
        if (pairs.length) {
          const inserted = await db.from("enrollments").upsert(pairs, {
            onConflict: "course_id,student_id",
            ignoreDuplicates: true,
          });
          if (inserted.error) throw inserted.error;
        }
        // إعادة تنشيط أي تسجيل موقوف سابقاً في العائلة نفسها.
        const reactivated = await db.from("enrollments")
          .update({ status: "active" })
          .in("course_id", targetCourseIds)
          .in("student_id", validStudents.map((student) => student.id));
        if (reactivated.error) throw reactivated.error;

        const courseNames = courseRows.map((item) => `${item.title} (${item.code})`).join("، ");
        const link = courseIds.length === 1 ? `/student/courses/${courseIds[0]}` : "/student/courses";
        const notifications = validStudents.map((student) => ({
          audience: "user",
          user_id: student.id,
          title: "تم تسجيلك في مقرر جديد",
          body: `تم تسجيلك في: ${courseNames}. يمكنك الوصول إليه من بوابة الطلاب.`,
          link,
          created_by: req.user?.id ?? null,
        }));
        const notice = await db.from("notifications").insert(notifications);
        if (notice.error) console.error("تعذر إرسال إشعار التسجيل:", notice.error.message);

        await db.from("archived_records").insert({
          table_name: "enrollment",
          record_id: null,
          label: `تسجيل ${pairs.length} طالباً في ${courseIds.length} مقرراً`,
          data: { by: req.user?.id ?? null, by_name: req.user?.name ?? null, course_ids: courseIds, student_ids: validStudents.map((s) => s.id), at: new Date().toISOString() },
          archived_by: req.user?.id ?? null,
        });
      }

      return res.redirect(`${basePath}/courses/${course.id}?enrolled=${pairs.length}&skipped=${targets.length - pairs.length}`);
    } catch (error) { next(error); }
  });

  /** زر الطوارئ: إضافة طالب بعينه إلى أي مقرر أصلي أو فرعي برمزه المنصّي أو الجامعي. */
  router.post("/courses/:id/enroll/by-code", guard, async (req, res, next) => {
    try {
      if (!isOwnerMode) return ownerOnly(res);
      const course = await courseOr403(req, res, req.params.id);
      if (!course) return res.status(403).render("error", { title: "غير مسموح", code: 403, message: "لا تملك صلاحية هذا المقرر." });

      const code = String(req.body.student_code ?? "").trim();
      if (!/^[A-Za-z0-9-]{3,24}$/.test(code)) {
        return res.redirect(`${basePath}/courses/${course.id}/enroll?error=code`);
      }
      const found = await db
        .from("users")
        .select("id, name, platform_id, university_id, track")
        .eq("role", "student")
        .or(`platform_id.eq.${code},university_id.eq.${code}`)
        .maybeSingle();
      if (found.error) throw found.error;
      if (!found.data) return res.redirect(`${basePath}/courses/${course.id}/enroll?error=notfound`);

      // زر الطوارئ يظل استثناءً مقصوداً: يضيف أي طالب بأي مستوى إلى المقرر المحدد.
      const targets = enrollmentTargets([course.id], [found.data], await ownCourses(req.user), { enforceScope: false });
      const added = await db.from("enrollments").upsert(
        targets.map((target) => ({ ...target, status: "active" })),
        { onConflict: "course_id,student_id", ignoreDuplicates: true }
      );
      if (added.error) throw added.error;
      const reactivated = await db.from("enrollments")
        .update({ status: "active" })
        .in("course_id", targets.map((target) => target.course_id))
        .eq("student_id", found.data.id);
      if (reactivated.error) throw reactivated.error;
      const notice = await notify(
        req.user?.id,
        found.data.id,
        "تم تسجيلك في مقرر جديد",
        `تمت إضافتك إلى ${course.title} (${course.code}) بطلب من المالك.`,
        `/student/courses/${course.id}`
      );
      if (notice.error) console.error("تعذر إرسال إشعار التسجيل:", notice.error.message);
      return res.redirect(`${basePath}/courses/${course.id}?enrolled=${targets.length}&skipped=0`);
    } catch (error) { next(error); }
  });

  /**
   * إنشاء حساب طالب فاته الكشف وتسجيله في المقرر من نفس الشاشة.
   * مقصور على المالك: الأستاذ يزيد تسجيل طلاب موجودين فقط، ولا ينشئ حسابات.
   */
  router.post("/courses/:id/enroll/quick-create", guard, async (req, res, next) => {
    try {
      if (!isOwnerMode) {
        return res.status(403).render("error", { title: "غير مسموح", code: 403, message: "إنشاء الحسابات من صلاحية المالك وحده." });
      }
      const course = await courseOr403(req, res, req.params.id);
      if (!course) return res.status(403).render("error", { title: "غير مسموح", code: 403, message: "لا تملك صلاحية إدارة هذا المقرر." });

      const name = String(req.body.name ?? "").trim();
      const filters = resolveFilters(course, req.body);
      const track = String(req.body.track ?? "").trim();
      const level = filters.scope.level
        ? Number(filters.scope.level)
        : Math.min(4, Math.max(1, Number(req.body.level ?? 1)));
      const universityId = String(req.body.university_id ?? "").trim() || null;
      const email = String(req.body.email ?? "").trim().toLowerCase() || null;
      const allCourses = await ownCourses(req.user);

      const fail = (message) => managePage(res.status(422), "manage/enroll", enrollLocals(course, allCourses, filters, {
        title: `تسجيل الطلاب — ${course.title}`,
        pageTitle: "تسجيل الطلاب في المقرر",
        students: [],
        enrolledIds: new Set(),
        error: message,
      }));

      if (name.length < 3) return fail("الاسم قصير جداً.");
      if (!filters.scope.tracks.includes(track)) return fail("اختر مسار الطالب أو الطالبة بما يوافق هذا المقرر.");
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail("صيغة البريد الإلكتروني غير صحيحة.");

      for (const [field, value, message] of [
        ["university_id", universityId, "الرقم الجامعي مستخدم في حساب آخر."],
        ["email", email, "البريد الإلكتروني مستخدم في حساب آخر."],
      ]) {
        if (!value) continue;
        const clash = await db.from("users").select("id").eq(field, value).maybeSingle();
        if (clash.error) throw clash.error;
        if (clash.data) return fail(message);
      }

      let provisioned;
      try {
        provisioned = await provisionUser({ role: "student", name, track, level, universityId, email, position: null });
      } catch (error) {
        const message = String(error?.message ?? error);
        if (message.includes("university_id")) return fail("الرقم الجامعي مستخدم في حساب آخر.");
        if (message.includes("email")) return fail("البريد الإلكتروني مستخدم في حساب آخر.");
        throw error;
      }

      const { user, password, platformId } = provisioned;

      const enrollment = await db.from("enrollments").upsert(
        { course_id: course.id, student_id: user.id, status: "active" },
        { onConflict: "course_id,student_id", ignoreDuplicates: true }
      );
      if (enrollment.error) throw enrollment.error;

      const notice = await notify(
        req.user?.id,
        user.id,
        "تم تسجيلك في مقرر جديد",
        `تم تسجيلك في: ${course.title} (${course.code}). يمكنك الوصول إليه من بوابة الطلاب.`,
        `/student/courses/${course.id}`
      );
      if (notice.error) console.error("تعذر إرسال إشعار التسجيل:", notice.error.message);

      await db.from("archived_records").insert({
        table_name: "quick_enroll",
        record_id: user.id,
        label: `إنشاء طالب وتسجيله — ${name} في ${course.title}`,
        data: {
          platform_id: platformId, course_id: course.id, course_code: course.code,
          student_id: user.id, by: req.user?.id ?? null, by_name: req.user?.name ?? null,
          at: new Date().toISOString(),
        },
        archived_by: req.user?.id ?? null,
      });

      return managePage(res, "owner/users-created", {
        title: "تم إنشاء الطالب وتسجيله",
        pageTitle: "تم إنشاء الطالب وتسجيله",
        newUser: user,
        tempPassword: password,
        backUrl: `${basePath}/courses/${course.id}`,
        backLabel: "العودة إلى المقرر",
        enrolledNow: course.title,
      });
    } catch (error) { next(error); }
  });

  router.post("/courses/:id/enroll/:studentId/status", guard, async (req, res, next) => {
    try {
      const course = await courseOr403(req, res, req.params.id);
      if (!course) return res.status(403).render("error", { title: "غير مسموح", code: 403, message: "لا تملك صلاحية إدارة هذا المقرر." });

      const studentId = Number(req.params.studentId);
      const status = req.body.status === "suspended" ? "suspended" : "active";
      const current = await db
        .from("enrollments")
        .select("course_id, student_id, status, users!enrollments_student_id_fkey(id, name)")
        .eq("course_id", course.id)
        .eq("student_id", studentId)
        .maybeSingle();
      if (current.error) throw current.error;
      if (!current.data) return res.status(404).render("error", { title: "غير موجود", code: 404, message: "الطالب غير مسجل في هذا المقرر." });

      const updated = await db.from("enrollments").update({ status }).eq("course_id", course.id).eq("student_id", studentId);
      if (updated.error) throw updated.error;

      const studentName = current.data.users?.name ?? "الطالب";
      const notice = await notify(
        req.user?.id,
        studentId,
        status === "suspended" ? "توقيف تسجيلك في مقرر" : "إعادة تفعيل تسجيلك في مقرر",
        status === "suspended"
          ? `تم توقيف تسجيلك في مقرر ${course.title} (${course.code}) بناءً على تعليمات الأستاذ المسؤول. باقي مقرراتك تعمل بشكل طبيعي.`
          : `تمت إعادة تفعيل تسجيلك في مقرر ${course.title} (${course.code}). يمكنك متابعة العمل فيه.`,
        `/student/courses/${course.id}`
      );
      if (notice.error) console.error("تعذر إرسال إشعار تغيير الحالة:", notice.error.message);

      await db.from("archived_records").insert({
        table_name: "enrollment_status",
        record_id: studentId,
        label: `${status === "suspended" ? "توقيف" : "إعادة تنشيط"} — ${studentName} في ${course.title}`,
        data: { course_id: course.id, student_id: studentId, status, by: req.user?.id ?? null, by_name: req.user?.name ?? null, at: new Date().toISOString() },
        archived_by: req.user?.id ?? null,
      });

      return res.redirect(`${basePath}/courses/${course.id}?statusSaved=1`);
    } catch (error) { next(error); }
  });

  // ---------- تعديل المقرر ----------
  router.get("/courses/:id/edit", guard, async (req, res, next) => {
    try {
      if (!isOwnerMode) return ownerOnly(res);
      const course = await courseOr403(req, res, req.params.id);
      if (!course) {
        return res.status(404).render("error", { title: "غير موجود", code: 404, message: "المقرر غير موجود أو لا تملك صلاحية إدارته." });
      }
      let teachers = [];
      if (isOwnerMode) {
        const { data, error } = await db.from("users").select("id, name").eq("role", "teacher").order("name");
        if (error) throw error;
        teachers = data ?? [];
      }
      return managePage(res, "manage/course-edit", {
        title: "تعديل المقرر",
        pageTitle: "تعديل المقرر",
        course,
        teachers,
        parents: (await parentCourses()).filter((item) => item.id !== course.id),
        parentId: course.parent_course_id ?? null,
        error: null,
      });
    } catch (error) { next(error); }
  });

  router.post("/courses/:id/edit", guard, async (req, res, next) => {
    try {
      if (!isOwnerMode) return ownerOnly(res);
      const course = await courseOr403(req, res, req.params.id);
      if (!course) {
        return res.status(404).render("error", { title: "غير موجود", code: 404, message: "لا صلاحية." });
      }

      const title = String(req.body.title ?? "").trim();
      const code = String(req.body.code ?? "").trim().toUpperCase();
      const description = String(req.body.description ?? "").trim() || null;
      const track = parseTrackKey(req.body.track);
      const level = Math.min(4, Math.max(1, Number(req.body.level ?? 1)));
      const color = String(req.body.color ?? "#123A63");
      const teacherId = isOwnerMode ? Number(req.body.teacher_id) : course.teacher_id;
      const parentId = toInt(req.body.parent_course_id);

      const fail = async (message) => {
        const teachers = isOwnerMode
          ? (await db.from("users").select("id, name").eq("role", "teacher").order("name")).data ?? []
          : [];
        return managePage(res.status(422), "manage/course-edit", {
          title: "تعديل المقرر",
          pageTitle: "تعديل المقرر",
          course,
          teachers,
          parents: (await parentCourses()).filter((item) => item.id !== course.id && item.id !== parentId),
          parentId,
          error: message,
        });
      };

      if (title.length < 3) return fail("اسم المقرر قصير جداً.");
      if (!/^[A-Z0-9-]{3,12}$/.test(code)) return fail("رمز المقرر غير صالح.");
      if (isOwnerMode && !teacherId) return fail("اختر الأستاذ المسؤول.");

      const clash = await db.from("courses").select("id").eq("code", code).neq("id", course.id).maybeSingle();
      if (clash.error) throw clash.error;
      if (clash.data) return fail("رمز المقرر مستخدم في مقرر آخر.");

      if (parentId && parentId !== course.id) {
        const parent = await db.from("courses").select("id").eq("id", parentId).is("parent_course_id", null).maybeSingle();
        if (parent.error) throw parent.error;
        if (!parent.data) return fail("المقرر الأصل المحدد غير صالح.");
      }
      const finalParentId = parentId === course.id ? course.parent_course_id : parentId;

      const updated = await db
        .from("courses")
        .update({
          title,
          code,
          description,
          track,
          level,
          color,
          parent_course_id: finalParentId,
          teacher_id: teacherId,
        })
        .eq("id", course.id);
      if (updated.error) throw updated.error;

      return res.redirect(`${basePath}/courses/${course.id}`);
    } catch (error) { next(error); }
  });

  // ---------- تعديل المحاضرة ----------
  router.get("/lectures/:id/edit", guard, async (req, res, next) => {
    try {
      const { data: lecture, error } = await db
        .from("lectures")
        .select("*, courses(id, title, code, teacher_id)")
        .eq("id", Number(req.params.id))
        .maybeSingle();
      if (error) throw error;
      if (!lecture) {
        return res.status(404).render("error", { title: "غير موجود", code: 404, message: "المحاضرة غير موجودة." });
      }
      if (!canManageFlag(req.user) && lecture.courses?.teacher_id !== req.user.id) {
        return res.status(403).render("error", { title: "غير مسموح", code: 403, message: "لا تملك صلاحية تعديل هذه المحاضرة." });
      }
      const courses = await ownCourses(req.user);
      return managePage(res, "manage/lecture-edit", {
        title: "تعديل المحاضرة",
        pageTitle: "تعديل المحاضرة",
        lecture,
        courses,
        selectedCourse: lecture.course_id,
        error: null,
      });
    } catch (error) { next(error); }
  });

  router.post("/lectures/:id/edit", guard, async (req, res, next) => {
    try {
      const { data: lecture, error } = await db
        .from("lectures")
        .select("id, course_id, courses(teacher_id)")
        .eq("id", Number(req.params.id))
        .maybeSingle();
      if (error) throw error;
      if (!lecture) {
        return res.status(404).render("error", { title: "غير موجود", code: 404, message: "المحاضرة غير موجودة." });
      }
      if (!canManageFlag(req.user) && lecture.courses?.teacher_id !== req.user.id) {
        return res.status(403).render("error", { title: "غير مسموح", code: 403, message: "لا صلاحية." });
      }

      const title = String(req.body.title ?? "").trim();
      const courseId = toInt(req.body.course_id);
      const newCourse = courseId ? await courseOr403(req, res, courseId) : null;
      const broadcastMode = ["internal", "youtube", "meet"].includes(req.body.broadcast_mode) ? req.body.broadcast_mode : "internal";
      const broadcastMedia = ["audio", "video", "both"].includes(req.body.broadcast_media) ? req.body.broadcast_media : "both";

      if (title.length < 3) {
        const courses = await ownCourses(req.user);
        return managePage(res.status(422), "manage/lecture-edit", {
          title: "تعديل المحاضرة",
          pageTitle: "تعديل المحاضرة",
          lecture,
          courses,
          selectedCourse: lecture.course_id,
          error: "عنوان المحاضرة قصير جداً.",
        });
      }

      const updated = await db
        .from("lectures")
        .update({
          title,
          course_id: newCourse ? newCourse.id : lecture.course_id,
          description: String(req.body.description ?? "").trim() || null,
          scheduled_at: String(req.body.scheduled_at ?? "").trim() ? new Date(String(req.body.scheduled_at)).toISOString() : null,
          duration_min: Math.max(15, Number(req.body.duration_min ?? 120)),
          lecture_type: ["direct", "online", "recorded"].includes(req.body.lecture_type) ? req.body.lecture_type : "direct",
          youtube_url: String(req.body.youtube_url ?? "").trim() || null,
          live_url: String(req.body.live_url ?? "").trim() || null,
          broadcast_mode: broadcastMode,
          broadcast_media: broadcastMedia,
        })
        .eq("id", lecture.id);
      if (updated.error) throw updated.error;

      return res.redirect(`${basePath}/lectures/${lecture.id}`);
    } catch (error) { next(error); }
  });

  // ---------- تعديل الاختبار ----------
  router.get("/exams/:id/edit", guard, async (req, res, next) => {
    try {
      const { data: exam, error } = await db
        .from("exams")
        .select("*, courses(id, title, code, teacher_id)")
        .eq("id", Number(req.params.id))
        .maybeSingle();
      if (error) throw error;
      if (!exam) {
        return res.status(404).render("error", { title: "غير موجود", code: 404, message: "الاختبار غير موجود." });
      }
      if (!canManageFlag(req.user) && exam.courses?.teacher_id !== req.user.id) {
        return res.status(403).render("error", { title: "غير مسموح", code: 403, message: "لا تملك صلاحية تعديل هذا الاختبار." });
      }

      const questionsRes = await db
        .from("exam_questions")
        .select("id, type, text, options, points, position, correct_index, correct_indices")
        .eq("exam_id", exam.id)
        .order("position");
      if (questionsRes.error) throw questionsRes.error;

      const courses = await ownCourses(req.user);
      return managePage(res, "manage/exam-edit", {
        title: "تعديل الاختبار",
        pageTitle: "تعديل الاختبار",
        exam,
        course: exam.courses,
        courses,
        selectedCourse: exam.course_id,
        lectures: await lecturesOf(courses),
        selectedLecture: exam.lecture_id ?? null,
        questions: questionsRes.data ?? [],
        error: null,
      });
    } catch (error) { next(error); }
  });

  router.post("/exams/:id/edit", guard, async (req, res, next) => {
    try {
      const { data: exam, error } = await db
        .from("exams")
        .select("*, courses(teacher_id)")
        .eq("id", Number(req.params.id))
        .maybeSingle();
      if (error) throw error;
      if (!exam) {
        return res.status(404).render("error", { title: "غير موجود", code: 404, message: "الاختبار غير موجود." });
      }
      if (!canManageFlag(req.user) && exam.courses?.teacher_id !== req.user.id) {
        return res.status(403).render("error", { title: "غير مسموح", code: 403, message: "لا صلاحية." });
      }

      const title = String(req.body.title ?? "").trim();
      const courseId = toInt(req.body.course_id);
      const newCourse = courseId ? await courseOr403(req, res, courseId) : null;
      const lectureId = toInt(req.body.lecture_id);
      const startsAt = String(req.body.starts_at ?? "").trim();
      const endsAt = String(req.body.ends_at ?? "").trim();
      const duration = Math.max(5, Number(req.body.duration_min ?? 60));
      const published = req.body.is_published === "on";

      const renderError = async (message) => {
        const courses = await ownCourses(req.user);
        const questionsRes = await db.from("exam_questions").select("id, type, text, options, points, position, correct_index, correct_indices").eq("exam_id", exam.id).order("position");
        if (questionsRes.error) throw questionsRes.error;
        return managePage(res.status(422), "manage/exam-edit", {
          title: "تعديل الاختبار",
          pageTitle: "تعديل الاختبار",
          exam,
          course: exam.courses ?? null,
          courses,
          selectedCourse: courseId || exam.course_id,
          lectures: await lecturesOf(courses),
          selectedLecture: lectureId || exam.lecture_id || null,
          questions: questionsRes.data ?? [],
          error: message,
        });
      };

      if (title.length < 3) return renderError("عنوان الاختبار قصير جداً.");
      if (!lectureId) return renderError("اختر المحاضرة المرتبطة بالاختبار.");

      const lectureRes = await db.from("lectures").select("id, course_id").eq("id", lectureId).maybeSingle();
      if (lectureRes.error) throw lectureRes.error;
      const targetCourseId = newCourse ? newCourse.id : exam.course_id;
      if (!lectureRes.data || lectureRes.data.course_id !== targetCourseId) {
        return renderError("المحاضرة المختارة غير صالحة لهذا المقرر.");
      }
      const validLectureId = lectureId;

      const updated = await db
        .from("exams")
        .update({
          title,
          description: String(req.body.description ?? "").trim() || null,
          course_id: newCourse ? newCourse.id : exam.course_id,
          lecture_id: validLectureId,
          starts_at: startsAt ? new Date(startsAt).toISOString() : null,
          ends_at: endsAt ? new Date(endsAt).toISOString() : null,
          duration_min: duration,
          is_published: published,
        })
        .eq("id", exam.id);
      if (updated.error) throw updated.error;

      return res.redirect(`${basePath}/exams/${exam.id}`);
    } catch (error) { next(error); }
  });

  router.post("/exams/:id/questions", guard, async (req, res, next) => {
    try {
      const { data: exam, error } = await db
        .from("exams")
        .select("id, courses(teacher_id)")
        .eq("id", Number(req.params.id))
        .maybeSingle();
      if (error) throw error;
      if (!exam) return res.status(404).render("error", { title: "غير موجود", code: 404, message: "الاختبار غير موجود." });
      if (!canManageFlag(req.user) && exam.courses?.teacher_id !== req.user.id) return res.status(403).render("error", { title: "غير مسموح", code: 403, message: "لا صلاحية." });

      const type = ["mcq", "multi", "truefalse", "essay"].includes(req.body.type) ? req.body.type : "mcq";
      const text = String(req.body.text ?? "").trim();
      const points = Math.max(1, Number(req.body.points ?? 1));
      const optionsRaw = String(req.body.options ?? "").trim();
      const options = type === "essay" ? null : optionsRaw.split("\n").map((line) => line.trim()).filter(Boolean);
      const correctRaw = String(req.body.correct ?? "").trim();
      let correctIndex = null;
      let correctIndices = null;
      if (type === "multi") {
        correctIndices = correctRaw ? correctRaw.split(",").map((part) => Number(part.trim())).filter((value) => Number.isInteger(value)) : [];
      } else {
        const single = Number(correctRaw);
        correctIndex = Number.isInteger(single) && correctRaw !== "" ? single : null;
      }

      if (text.length < 3) return res.redirect(`${basePath}/exams/${exam.id}/edit?error=text`);

      const positionRes = await db.from("exam_questions").select("position").eq("exam_id", exam.id).order("position", { ascending: false }).limit(1).maybeSingle();
      const position = (positionRes.data?.position ?? 0) + 1;

      const inserted = await db.from("exam_questions").insert({
        exam_id: exam.id,
        type,
        text,
        options: type === "truefalse" ? ["خطأ", "صح"] : options,
        correct_index: type === "multi" ? null : correctIndex,
        correct_indices: correctIndices,
        points,
        position,
      });
      if (inserted.error) throw inserted.error;

      return res.redirect(`${basePath}/exams/${exam.id}/edit`);
    } catch (error) { next(error); }
  });

  router.post("/exams/:id/questions/:qid/delete", guard, async (req, res, next) => {
    try {
      const examId = Number(req.params.id);
      const qid = Number(req.params.qid);
      if (!Number.isInteger(qid)) return res.status(400).render("error", { title: "طلب غير صالح", code: 400, message: "معرّف السؤال غير صحيح." });

      const { data: exam, error } = await db.from("exams").select("id, courses(teacher_id)").eq("id", examId).maybeSingle();
      if (error) throw error;
      if (!exam) return res.status(404).render("error", { title: "غير موجود", code: 404, message: "الاختبار غير موجود." });
      if (!canManageFlag(req.user) && exam.courses?.teacher_id !== req.user.id) return res.status(403).render("error", { title: "غير مسموح", code: 403, message: "لا صلاحية." });

      const deleted = await db.from("exam_questions").delete().eq("id", qid).eq("exam_id", examId);
      if (deleted.error) throw deleted.error;
      return res.redirect(`${basePath}/exams/${exam.id}/edit`);
    } catch (error) { next(error); }
  });

  // ---------- تعديل الواجب ----------
  router.get("/assignments/:id/edit", guard, async (req, res, next) => {
    try {
      const { data: assignment, error } = await db
        .from("assignments")
        .select("*, courses(id, title, code, teacher_id)")
        .eq("id", Number(req.params.id))
        .maybeSingle();
      if (error) throw error;
      if (!assignment) {
        return res.status(404).render("error", { title: "غير موجود", code: 404, message: "الواجب غير موجود." });
      }
      if (!canManageFlag(req.user) && assignment.courses?.teacher_id !== req.user.id) {
        return res.status(403).render("error", { title: "غير مسموح", code: 403, message: "لا تملك صلاحية تعديل هذا الواجب." });
      }
      const courses = await ownCourses(req.user);
      return managePage(res, "manage/assignment-edit", {
        title: "تعديل الواجب",
        pageTitle: "تعديل الواجب",
        assignment,
        courses,
        selectedCourse: assignment.course_id,
        error: null,
      });
    } catch (error) { next(error); }
  });

  router.post("/assignments/:id/edit", guard, async (req, res, next) => {
    try {
      const { data: assignment, error } = await db
        .from("assignments")
        .select("id, course_id, courses(teacher_id)")
        .eq("id", Number(req.params.id))
        .maybeSingle();
      if (error) throw error;
      if (!assignment) {
        return res.status(404).render("error", { title: "غير موجود", code: 404, message: "الواجب غير موجود." });
      }
      if (!canManageFlag(req.user) && assignment.courses?.teacher_id !== req.user.id) {
        return res.status(403).render("error", { title: "غير مسموح", code: 403, message: "لا صلاحية." });
      }

      const title = String(req.body.title ?? "").trim();
      const courseId = toInt(req.body.course_id);
      const newCourse = courseId ? await courseOr403(req, res, courseId) : null;
      const maxPoints = Math.max(1, Number(req.body.max_points ?? 10));
      const due = String(req.body.due_at ?? "").trim();

      if (title.length < 3) {
        const courses = await ownCourses(req.user);
        return managePage(res.status(422), "manage/assignment-edit", {
          title: "تعديل الواجب",
          pageTitle: "تعديل الواجب",
          assignment,
          courses,
          selectedCourse: assignment.course_id,
          error: "عنوان الواجب قصير جداً.",
        });
      }

      const updated = await db
        .from("assignments")
        .update({
          title,
          course_id: newCourse ? newCourse.id : assignment.course_id,
          description: String(req.body.description ?? "").trim() || null,
          due_at: due ? new Date(due).toISOString() : null,
          max_points: maxPoints,
        })
        .eq("id", assignment.id);
      if (updated.error) throw updated.error;

      return res.redirect(`${basePath}/assignments/${assignment.id}`);
    } catch (error) { next(error); }
  });

  // ---------- سجل الدرجات ----------
  router.get("/courses/:id/gradebook", guard, async (req, res, next) => {
    try {
      const course = await courseOr403(req, res, req.params.id);
      if (!course) {
        return res.status(404).render("error", { title: "غير موجود", code: 404, message: "المقرر غير موجود أو لا تملك صلاحية إدارته." });
      }

      const students = await getCourseStudents(course.id);
      const gradesByStudent = await getSubjectGradesBulk(
        students.map((student) => ({ studentId: student.id, courses: [course] }))
      );

      const rows = students.map((student) => ({
        student,
        grade: (gradesByStudent.get(student.id) ?? [])[0],
      })).filter((row) => row.grade).sort((a, b) => b.grade.total - a.grade.total);

      const average = rows.length ? rows.reduce((sum, row) => sum + row.grade.percent, 0) / rows.length : 0;
      const isBachelor = getProfile(course.track).tool === "exam";
      const weights = rows.length
        ? {
            attendance: rows[0].grade.attendance.weight,
            interaction: rows[0].grade.interaction.weight,
            exams: rows[0].grade.exams.weight,
            assignments: rows[0].grade.assignments.weight,
          }
        : {
            attendance: isBachelor ? 100 : 0,
            interaction: isBachelor ? 100 : 0,
            exams: isBachelor ? 100 : 0,
            assignments: isBachelor ? 0 : 300,
          };

      return managePage(res, "manage/gradebook", {
        title: `سجل الدرجات — ${course.title}`,
        pageTitle: "سجل الدرجات",
        course,
        rows,
        average: Math.round(average * 10) / 10,
        isBachelor,
        weights,
      });
    } catch (error) { next(error); }
  });

  router.post("/courses/:id/archive", guard, async (req, res, next) => {
    try {
      if (!isOwnerMode) return ownerOnly(res);
      const course = await courseOr403(req, res, req.params.id);
      if (!course) return res.status(404).render("error", { title: "غير موجود", code: 404, message: "لا صلاحية." });
      const updated = await db.from("courses").update({ archived: !course.archived }).eq("id", course.id);
      if (updated.error) throw updated.error;
      return res.redirect(`${basePath}/courses/${course.id}`);
    } catch (error) { next(error); }
  });

  /** حذف المقرر نهائياً مع فروعه وكل ما يتفرّع عنه (حذف متسلسل في قاعدة البيانات). */
  router.post("/courses/:id/delete", guard, async (req, res, next) => {
    try {
      if (!isOwnerMode) return ownerOnly(res);
      const course = await courseOr403(req, res, req.params.id);
      if (!course) return res.status(404).render("error", { title: "غير موجود", code: 404, message: "لا صلاحية." });
      const removed = await db.from("courses").delete().eq("id", course.id);
      if (removed.error) throw removed.error;
      await db.from("archived_records").insert({
        table_name: "course",
        record_id: course.id,
        label: `حذف المقرر: ${course.title} (${course.code})`,
        data: { by: req.user?.id ?? null, by_name: req.user?.name ?? null, at: new Date().toISOString() },
        archived_by: req.user?.id ?? null,
      });
      return res.redirect(`${basePath}/courses?deleted=1`);
    } catch (error) { next(error); }
  });

  /** إنشاء فرعي الطلاب والطالبات لمقرر أصلي بضغطة زر. */
  router.post("/courses/:id/branches", guard, async (req, res, next) => {
    try {
      if (!isOwnerMode) return ownerOnly(res);
      const course = await courseOr403(req, res, req.params.id);
      if (!course) return res.status(404).render("error", { title: "غير موجود", code: 404, message: "لا صلاحية." });
      if (course.parent_course_id) {
        return res.status(422).render("error", { title: "غير صالح", code: 422, message: "الفروع تُنشأ من المقرر الأصل فقط." });
      }
      const existing = await db.from("courses").select("id").eq("parent_course_id", course.id);
      if (existing.error) throw existing.error;
      if (existing.data?.length) return res.redirect(`${basePath}/courses/${course.id}?branches=exists`);

      const branches = [
        { title: `${course.title} — طلاب`, code: `${course.code}-M`, track: "bachelor_m" },
        { title: `${course.title} — طالبات`, code: `${course.code}-F`, track: "bachelor_f" },
      ];
      const inserted = await db.from("courses").insert(branches.map((branch) => ({
        teacher_id: course.teacher_id,
        title: branch.title,
        code: branch.code,
        description: course.description,
        color: course.color,
        level: course.level,
        track: branch.track,
        parent_course_id: course.id,
        attendance_weight: course.attendance_weight,
        exams_weight: course.exams_weight,
        assignments_weight: course.assignments_weight,
      })));
      if (inserted.error) throw inserted.error;
      return res.redirect(`${basePath}/courses/${course.id}?branches=created`);
    } catch (error) { next(error); }
  });

  // ---------- المحاضرات ----------
  router.get("/lectures", guard, async (req, res, next) => {
    try {
      const courses = await ownCourses(req.user);
      const ids = courses.map((course) => course.id);
      const map = new Map(courses.map((course) => [course.id, course]));
      const type = String(req.query.type ?? "all");
      const query = String(req.query.q ?? "").trim().toLowerCase();

      let lectures = [];
      if (ids.length) {
        const { data, error } = await db
          .from("lectures")
          .select("id, course_id, title, scheduled_at, lecture_type, attendance_open, attendance_code, status, duration_min")
          .in("course_id", ids)
          .order("scheduled_at", { ascending: false });
        if (error) throw error;
        lectures = data ?? [];
      }

      const lectureIds = lectures.map((lecture) => lecture.id);
      const attendanceCount = new Map();
      if (lectureIds.length) {
        const { data, error } = await db.from("attendance").select("lecture_id").in("lecture_id", lectureIds);
        if (error) throw error;
        for (const row of data ?? []) attendanceCount.set(row.lecture_id, (attendanceCount.get(row.lecture_id) ?? 0) + 1);
      }

      lectures = lectures
        .map((lecture) => ({ ...lecture, course: map.get(lecture.course_id), attendanceCount: attendanceCount.get(lecture.id) ?? 0 }))
        .filter((lecture) => type === "all" || lecture.lecture_type === type)
        .filter((lecture) => {
          if (!query) return true;
          return `${lecture.title} ${lecture.course?.title ?? ""} ${lecture.course?.code ?? ""}`.toLowerCase().includes(query);
        });

      return managePage(res, "manage/lectures", {
        title: "المحاضرات",
        pageTitle: "المحاضرات",
        lectures,
        type,
        searchAction: `${basePath}/lectures`,
        searchPlaceholder: "ابحث عن محاضرة...",
        searchValue: req.query.q ?? "",
        courses,
      });
    } catch (error) { next(error); }
  });

  router.get("/lectures/new", guard, async (req, res, next) => {
    try {
      const courses = await ownCourses(req.user);
      const selected = Number(req.query.course ?? courses[0]?.id ?? 0);
      return managePage(res, "manage/lecture-new", {
        title: "إضافة محاضرة",
        pageTitle: "إضافة محاضرة",
        courses,
        selectedCourse: selected,
        error: null,
      });
    } catch (error) { next(error); }
  });

  router.post("/lectures", guard, async (req, res, next) => {
    try {
      const courseId = toInt(req.body.course_id);
      if (!courseId) return res.status(400).render("error", { title: "طلب غير صالح", code: 400, message: "معرّف المقرر غير صحيح." });
      const course = await courseOr403(req, res, courseId);
      if (!course) return res.status(403).render("error", { title: "غير مسموح", code: 403, message: "لا تملك صلاحية إدارة هذا المقرر." });

      const title = String(req.body.title ?? "").trim();
      const description = String(req.body.description ?? "").trim() || null;
      const scheduled = String(req.body.scheduled_at ?? "").trim();
      const duration = Math.max(15, Number(req.body.duration_min ?? 120));
      const lectureType = ["direct", "online", "recorded"].includes(req.body.lecture_type) ? req.body.lecture_type : "direct";
      const youtube = String(req.body.youtube_url ?? "").trim() || null;
      const live = String(req.body.live_url ?? "").trim() || null;
      const attendanceOpen = req.body.attendance_open === "on";
      const broadcastMode = ["internal", "youtube", "meet"].includes(req.body.broadcast_mode) ? req.body.broadcast_mode : "internal";
      const broadcastMedia = ["audio", "video", "both"].includes(req.body.broadcast_media) ? req.body.broadcast_media : "both";
      const code = attendanceOpen ? String(Math.floor(100000 + Math.random() * 900000)) : null;

      if (title.length < 3) {
        const courses = await ownCourses(req.user);
        return managePage(res.status(422), "manage/lecture-new", {
          title: "إضافة محاضرة",
          pageTitle: "إضافة محاضرة",
          courses,
          selectedCourse: courseId,
          error: "عنوان المحاضرة قصير جداً.",
        });
      }

      const created = await db.from("lectures").insert({
        course_id: course.id,
        title,
        description,
        youtube_url: youtube,
        live_url: live,
        scheduled_at: scheduled ? new Date(scheduled).toISOString() : null,
        duration_min: duration,
        attendance_code: code,
        attendance_open: attendanceOpen,
        lecture_type: lectureType,
        broadcast_mode: broadcastMode,
        broadcast_media: broadcastMedia,
      }).select("id").maybeSingle();
      if (created.error) throw created.error;

      return res.redirect(`${basePath}/lectures/${created.data.id}`);
    } catch (error) { next(error); }
  });

  router.get("/lectures/:id", guard, async (req, res, next) => {
    try {
      const { data: lecture, error } = await db
        .from("lectures")
        .select("*, courses(id, title, code, teacher_id)")
        .eq("id", Number(req.params.id))
        .maybeSingle();
      if (error) throw error;
      if (!lecture) return res.status(404).render("error", { title: "غير موجود", code: 404, message: "المحاضرة غير موجودة." });

      if (!canManageFlag(req.user) && lecture.courses?.teacher_id !== req.user.id) {
        return res.status(403).render("error", { title: "غير مسموح", code: 403, message: "لا تملك صلاحية إدارة هذه المحاضرة." });
      }

      const [attendanceRes, questionsRes] = await Promise.all([
        db.from("attendance").select("student_id, created_at, method, users!attendance_student_id_fkey(id, name, university_id, platform_id)").eq("lecture_id", lecture.id).order("created_at"),
        db.from("questions").select("id, text, type, options, correct_index, correct_indices, is_open, created_at").eq("lecture_id", lecture.id).order("created_at"),
      ]);
      if (attendanceRes.error) throw attendanceRes.error;
      if (questionsRes.error) throw questionsRes.error;

      return managePage(res, "manage/lecture-manage", {
        title: lecture.title,
        pageTitle: "إدارة المحاضرة",
        lecture,
        course: lecture.courses,
        attendance: (attendanceRes.data ?? []).map((row) => ({ ...row, user: row.users })),
        questions: questionsRes.data ?? [],
      });
    } catch (error) { next(error); }
  });

  // ---------- تبديل البث أثناء المحاضرة ----------
  router.post("/lectures/:id/broadcast", guard, async (req, res, next) => {
    try {
      const { data: lecture, error } = await db
        .from("lectures")
        .select("id, broadcast_mode, broadcast_media, courses(teacher_id)")
        .eq("id", Number(req.params.id))
        .maybeSingle();
      if (error) throw error;
      if (!lecture) return res.status(404).render("error", { title: "غير موجود", code: 404, message: "المحاضرة غير موجودة." });
      if (!canManageFlag(req.user) && lecture.courses?.teacher_id !== req.user.id) {
        return res.status(403).render("error", { title: "غير مسموح", code: 403, message: "لا صلاحية." });
      }

      const mode = ["internal", "youtube", "meet"].includes(req.body.mode) ? req.body.mode : lecture.broadcast_mode ?? "internal";
      const media = ["audio", "video", "both"].includes(req.body.media) ? req.body.media : lecture.broadcast_media ?? "both";

      const updated = await db.from("lectures").update({ broadcast_mode: mode, broadcast_media: media }).eq("id", lecture.id);
      if (updated.error) throw updated.error;
      return res.redirect(`${basePath}/lectures/${lecture.id}`);
    } catch (error) { next(error); }
  });

  router.post("/lectures/:id/toggle-attendance", guard, async (req, res, next) => {
    try {
      const { data: lecture, error } = await db.from("lectures").select("id, course_id, attendance_open, attendance_code, courses(teacher_id)").eq("id", Number(req.params.id)).maybeSingle();
      if (error) throw error;
      if (!lecture) return res.status(404).render("error", { title: "غير موجود", code: 404, message: "غير موجودة." });
      if (!canManageFlag(req.user) && lecture.courses?.teacher_id !== req.user.id) return res.status(403).render("error", { title: "غير مسموح", code: 403, message: "لا صلاحية." });

      const open = !lecture.attendance_open;
      const code = open ? String(Math.floor(100000 + Math.random() * 900000)) : null;
      const updated = await db.from("lectures").update({ attendance_open: open, attendance_code: code }).eq("id", lecture.id);
      if (updated.error) throw updated.error;
      return res.redirect(`${basePath}/lectures/${lecture.id}`);
    } catch (error) { next(error); }
  });

  router.post("/lectures/:id/questions", guard, async (req, res, next) => {
    try {
      const { data: lecture, error } = await db.from("lectures").select("id, courses(teacher_id)").eq("id", Number(req.params.id)).maybeSingle();
      if (error) throw error;
      if (!lecture) return res.status(404).render("error", { title: "غير موجود", code: 404, message: "غير موجودة." });
      if (!canManageFlag(req.user) && lecture.courses?.teacher_id !== req.user.id) return res.status(403).render("error", { title: "غير مسموح", code: 403, message: "لا صلاحية." });

      const text = String(req.body.text ?? "").trim();
      const type = ["mcq", "multi", "poll", "truefalse", "discussion"].includes(req.body.type) ? req.body.type : "mcq";
      const optionsRaw = String(req.body.options ?? "").trim();
      const options = optionsRaw ? optionsRaw.split("\n").map((line) => line.trim()).filter(Boolean) : null;
      const correctRaw = String(req.body.correct_indices ?? "").trim();
      let correctIndex = null;
      let correctIndices = null;
      if (type === "multi") {
        correctIndices = correctRaw
          ? correctRaw.split(",").map((part) => Number(part.trim())).filter((value) => Number.isInteger(value))
          : null;
      } else {
        const single = Number(correctRaw);
        correctIndex = Number.isInteger(single) && correctRaw !== "" ? single : null;
      }

      if (text.length < 3) {
        return res.redirect(`${basePath}/lectures/${lecture.id}?error=question_text`);
      }

      const inserted = await db.from("questions").insert({
        lecture_id: lecture.id,
        text,
        type,
        options,
        correct_index: type === "multi" ? null : correctIndex,
        correct_indices: correctIndices,
      });
      if (inserted.error) throw inserted.error;
      return res.redirect(`${basePath}/lectures/${lecture.id}`);
    } catch (error) { next(error); }
  });

  // ---------- الاختبارات ----------
  router.get("/exams", guard, async (req, res, next) => {
    try {
      const courses = await ownCourses(req.user);
      const ids = courses.map((course) => course.id);
      const map = new Map(courses.map((course) => [course.id, course]));

      let exams = [];
      if (ids.length) {
        const { data, error } = await db
          .from("exams")
          .select("id, course_id, title, description, starts_at, ends_at, duration_min, is_published, exam_kind, created_at")
          .in("course_id", ids)
          .eq("exam_kind", "exam")
          .order("starts_at", { ascending: false });
        if (error) throw error;
        exams = (data ?? []).map((exam) => ({ ...exam, course: map.get(exam.course_id) }));
      }

      const examIds = exams.map((exam) => exam.id);
      const attemptsCount = new Map();
      const questionsCount = new Map();
      if (examIds.length) {
        const [attemptsRes, questionsRes] = await Promise.all([
          db.from("exam_attempts").select("exam_id").in("exam_id", examIds),
          db.from("exam_questions").select("exam_id").in("exam_id", examIds),
        ]);
        if (attemptsRes.error) throw attemptsRes.error;
        if (questionsRes.error) throw questionsRes.error;
        for (const row of attemptsRes.data ?? []) attemptsCount.set(row.exam_id, (attemptsCount.get(row.exam_id) ?? 0) + 1);
        for (const row of questionsRes.data ?? []) questionsCount.set(row.exam_id, (questionsCount.get(row.exam_id) ?? 0) + 1);
      }
      exams = exams.map((exam) => ({ ...exam, attemptsCount: attemptsCount.get(exam.id) ?? 0, questionsCount: questionsCount.get(exam.id) ?? 0 }));

      return managePage(res, "manage/exams", {
        title: "الاختبارات",
        pageTitle: "الاختبارات",
        exams,
        courses,
        searchAction: `${basePath}/exams`,
        searchPlaceholder: "ابحث عن اختبار...",
        searchValue: req.query.q ?? "",
      });
    } catch (error) { next(error); }
  });

  // ---------- توليد الأسئلة/الواجب بالمساعد الذكي ----------
  router.post("/ai/generate-exam-questions", guard, async (req, res, next) => {
    try {
      const courseId = toInt(req.body.course_id);
      if (!courseId) return res.status(400).json({ ok: false, error: "معرّف المقرر غير صحيح." });
      const course = await courseOr403(req, res, courseId);
      if (!course) return res.status(403).json({ ok: false, error: "لا تملك صلاحية هذا المقرر." });

      const topic = String(req.body.topic ?? "").trim() || course.title;
      const count = Math.max(1, Math.min(12, Number(req.body.count) || 5));

      const { generateExamQuestions } = await import("./ai.js");
      const result = await generateExamQuestions(topic, count);
      return res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/ai/generate-assignment", guard, async (req, res, next) => {
    try {
      const courseId = toInt(req.body.course_id);
      if (!courseId) return res.status(400).json({ ok: false, error: "معرّف المقرر غير صحيح." });
      const course = await courseOr403(req, res, courseId);
      if (!course) return res.status(403).json({ ok: false, error: "لا تملك صلاحية هذا المقرر." });

      const topic = String(req.body.topic ?? "").trim() || course.title;

      const { generateAssignment } = await import("./ai.js");
      const result = await generateAssignment(topic);
      return res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/exams/new", guard, async (req, res, next) => {
    try {
      const courses = await ownCourses(req.user);
      const selected = Number(req.query.course ?? courses[0]?.id ?? 0);
      const ai = await aiStatus();
      return managePage(res, "manage/exam-new", {
        title: "إضافة اختبار",
        pageTitle: "إضافة اختبار",
        courses,
        selectedCourse: selected,
        lectures: await lecturesOf(courses),
        selectedLecture: Number(req.query.lecture ?? 0) || null,
        ai,
      });
    } catch (error) { next(error); }
  });

  router.post("/exams", guard, async (req, res, next) => {
    try {
      const courseId = toInt(req.body.course_id);
      if (!courseId) return res.status(400).render("error", { title: "طلب غير صالح", code: 400, message: "معرّف المقرر غير صحيح." });
      const course = await courseOr403(req, res, courseId);
      if (!course) return res.status(403).render("error", { title: "غير مسموح", code: 403, message: "لا تملك صلاحية هذا المقرر." });

      const title = String(req.body.title ?? "").trim();
      const description = String(req.body.description ?? "").trim() || null;
      const lectureId = toInt(req.body.lecture_id);
      const startsAt = String(req.body.starts_at ?? "").trim();
      const endsAt = String(req.body.ends_at ?? "").trim();
      const duration = Math.max(5, Number(req.body.duration_min ?? 60));
      const published = req.body.is_published === "on";

      const renderError = async (message) => {
        const courses = await ownCourses(req.user);
        return managePage(res.status(422), "manage/exam-new", {
          title: "إضافة اختبار",
          pageTitle: "إضافة اختبار",
          courses,
          selectedCourse: courseId,
          lectures: await lecturesOf(courses),
          selectedLecture: lectureId,
          error: message,
          ai: await aiStatus(),
        });
      };

      if (title.length < 3) return renderError("عنوان الاختبار قصير جداً.");
      if (!lectureId) return renderError("اختر المحاضرة المرتبطة بالاختبار.");

      const lectureRes = await db.from("lectures").select("id, course_id").eq("id", lectureId).maybeSingle();
      if (lectureRes.error) throw lectureRes.error;
      if (!lectureRes.data || lectureRes.data.course_id !== course.id) {
        return renderError("المحاضرة المختارة غير صالحة لهذا المقرر.");
      }
      const validLectureId = lectureId;

      const created = await db.from("exams").insert({
        course_id: course.id,
        lecture_id: validLectureId,
        title,
        description,
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        duration_min: duration,
        is_published: published,
        exam_kind: "exam",
      }).select("id").maybeSingle();
      if (created.error) throw created.error;

      // الأسئلة المرسلة كمصفوفة JSON
      let questions = [];
      try {
        questions = JSON.parse(String(req.body.questions ?? "[]"));
      } catch {
        questions = [];
      }

      if (Array.isArray(questions) && questions.length) {
        const rows = [];
        questions.forEach((question, index) => {
          const type = ["mcq", "multi", "truefalse", "essay"].includes(question.type) ? question.type : "mcq";
          const text = String(question.text ?? "").trim();
          if (!text) return;
          const points = Math.max(1, Number(question.points ?? 1));
          const options = Array.isArray(question.options) ? question.options.map((value) => String(value).trim()).filter(Boolean) : null;
          const correctIndex = question.correct_index != null && question.correct_index !== "" ? Number(question.correct_index) : null;
          const correctIndices = Array.isArray(question.correct_indices) ? question.correct_indices.map(Number) : null;
          rows.push({
            exam_id: created.data.id,
            type,
            text,
            options: type === "essay" || type === "truefalse" ? (type === "truefalse" ? ["خطأ", "صح"] : null) : options,
            correct_index: type === "multi" ? null : correctIndex,
            correct_indices: correctIndices,
            points,
            position: index + 1,
          });
        });
        if (rows.length) {
          const inserted = await db.from("exam_questions").insert(rows);
          if (inserted.error) throw inserted.error;
        }
      }

      return res.redirect(`${basePath}/exams/${created.data.id}`);
    } catch (error) { next(error); }
  });

  router.get("/exams/:id", guard, async (req, res, next) => {
    try {
      const { data: exam, error } = await db
        .from("exams")
        .select("*, courses(id, title, code, teacher_id)")
        .eq("id", Number(req.params.id))
        .maybeSingle();
      if (error) throw error;
      if (!exam) return res.status(404).render("error", { title: "غير موجود", code: 404, message: "الاختبار غير موجود." });
      if (!canManageFlag(req.user) && exam.courses?.teacher_id !== req.user.id) {
        return res.status(403).render("error", { title: "غير مسموح", code: 403, message: "لا تملك صلاحية هذا الاختبار." });
      }

      const [questionsRes, attemptsRes] = await Promise.all([
        db.from("exam_questions").select("id, type, text, options, points, correct_index, correct_indices, position").eq("exam_id", exam.id).order("position"),
        db.from("exam_attempts").select("id, student_id, started_at, submitted_at, score, status, users!exam_attempts_student_id_fkey(id, name, university_id, platform_id)").eq("exam_id", exam.id).order("submitted_at", { ascending: false }),
      ]);
      if (questionsRes.error) throw questionsRes.error;
      if (attemptsRes.error) throw attemptsRes.error;

      const questions = questionsRes.data ?? [];
      const attempts = attemptsRes.data ?? [];

      // إجابات المقالية لكل محاولة لتصحيحها
      let essayAnswers = [];
      const essayIds = questions.filter((question) => question.type === "essay").map((question) => question.id);
      if (essayIds.length && attempts.length) {
        const answerRes = await db
          .from("exam_answers")
          .select("id, attempt_id, question_id, text, points, feedback")
          .in("question_id", essayIds);
        if (answerRes.error) throw answerRes.error;
        essayAnswers = answerRes.data ?? [];
      }

      const essayByAttempt = new Map();
      for (const answer of essayAnswers) {
        if (!essayByAttempt.has(answer.attempt_id)) essayByAttempt.set(answer.attempt_id, []);
        essayByAttempt.get(answer.attempt_id).push(answer);
      }

      const questionMap = new Map(questions.map((question) => [question.id, question]));

      return managePage(res, "manage/exam-manage", {
        title: exam.title,
        pageTitle: "إدارة الاختبار",
        exam,
        course: exam.courses,
        questions,
        essayIds,
        attempts: attempts.map((attempt) => ({
          ...attempt,
          user: attempt.users,
          essayAnswers: (essayByAttempt.get(attempt.id) ?? []).map((answer) => ({
            ...answer,
            question: questionMap.get(answer.question_id),
          })),
        })),
      });
    } catch (error) { next(error); }
  });

  router.post("/exams/:id/grade-essay", guard, async (req, res, next) => {
    try {
      const { data: exam, error } = await db.from("exams").select("id, courses(teacher_id)").eq("id", Number(req.params.id)).maybeSingle();
      if (error) throw error;
      if (!exam) return res.status(404).render("error", { title: "غير موجود", code: 404, message: "الاختبار غير موجود." });
      if (!canManageFlag(req.user) && exam.courses?.teacher_id !== req.user.id) return res.status(403).render("error", { title: "غير مسموح", code: 403, message: "لا صلاحية." });

      const answers = Array.isArray(req.body.answers) ? req.body.answers : [req.body.answers];
      const points = Array.isArray(req.body.points) ? req.body.points : [req.body.points];
      const feedback = Array.isArray(req.body.feedback) ? req.body.feedback : [req.body.feedback];

      // نجمع النقاط لكل محاولة ثم نحدّثها دفعة واحدة
      const touched = new Set();
      for (let i = 0; i < answers.length; i += 1) {
        const answerId = Number(answers[i]);
        const value = Math.max(0, Number(points[i] ?? 0));
        if (!Number.isInteger(answerId)) continue;
        const updated = await db.from("exam_answers").update({ points: value, feedback: String(feedback[i] ?? "").trim() || null }).eq("id", answerId);
        if (updated.error) throw updated.error;
        const { data: answerRow } = await db.from("exam_answers").select("attempt_id").eq("id", answerId).maybeSingle();
        if (answerRow?.attempt_id) touched.add(answerRow.attempt_id);
      }

      for (const attemptId of touched) {
        const answersRes = await db.from("exam_answers").select("points").eq("attempt_id", attemptId);
        if (answersRes.error) throw answersRes.error;
        const total = (answersRes.data ?? []).reduce((sum, row) => sum + Number(row.points ?? 0), 0);
        const updated = await db.from("exam_attempts").update({
          score: total,
          status: "graded",
          graded_at: new Date().toISOString(),
        }).eq("id", attemptId);
        if (updated.error) throw updated.error;
      }

      return res.redirect(`${basePath}/exams/${exam.id}`);
    } catch (error) { next(error); }
  });

  // ---------- الواجبات ----------
  router.get("/assignments", guard, async (req, res, next) => {
    try {
      const courses = await ownCourses(req.user);
      const ids = courses.map((course) => course.id);
      const map = new Map(courses.map((course) => [course.id, course]));

      let assignments = [];
      if (ids.length) {
        const { data, error } = await db
          .from("assignments")
          .select("id, course_id, title, description, due_at, max_points, created_at")
          .in("course_id", ids)
          .order("due_at", { ascending: false });
        if (error) throw error;
        assignments = (data ?? []).map((assignment) => ({ ...assignment, course: map.get(assignment.course_id) }));
      }

      const assignmentIds = assignments.map((assignment) => assignment.id);
      const submissionsCount = new Map();
      if (assignmentIds.length) {
        const { data, error } = await db.from("submissions").select("assignment_id").in("assignment_id", assignmentIds);
        if (error) throw error;
        for (const row of data ?? []) submissionsCount.set(row.assignment_id, (submissionsCount.get(row.assignment_id) ?? 0) + 1);
      }
      assignments = assignments.map((assignment) => ({ ...assignment, submissionsCount: submissionsCount.get(assignment.id) ?? 0 }));

      return managePage(res, "manage/assignments", {
        title: "الواجبات",
        pageTitle: "الواجبات",
        assignments,
        courses,
      });
    } catch (error) { next(error); }
  });

  router.get("/assignments/new", guard, async (req, res, next) => {
    try {
      const courses = await ownCourses(req.user);
      const selected = Number(req.query.course ?? courses[0]?.id ?? 0);
      const ai = await aiStatus();
      return managePage(res, "manage/assignment-new", {
        title: "إضافة واجب",
        pageTitle: "إضافة واجب",
        courses,
        selectedCourse: selected,
        ai,
      });
    } catch (error) { next(error); }
  });

  router.post("/assignments", guard, async (req, res, next) => {
    try {
      const courseId = toInt(req.body.course_id);
      if (!courseId) return res.status(400).render("error", { title: "طلب غير صالح", code: 400, message: "معرّف المقرر غير صحيح." });
      const course = await courseOr403(req, res, courseId);
      if (!course) return res.status(403).render("error", { title: "غير مسموح", code: 403, message: "لا صلاحية." });

      const title = String(req.body.title ?? "").trim();
      const description = String(req.body.description ?? "").trim() || null;
      const due = String(req.body.due_at ?? "").trim();
      const maxPoints = Math.max(1, Number(req.body.max_points ?? 10));

      if (title.length < 3) {
        const courses = await ownCourses(req.user);
        return managePage(res.status(422), "manage/assignment-new", {
          title: "إضافة واجب",
          pageTitle: "إضافة واجب",
          courses,
          selectedCourse: courseId,
          error: "عنوان الواجب قصير جداً.",
        });
      }

      const created = await db.from("assignments").insert({
        course_id: course.id,
        title,
        description,
        due_at: due ? new Date(due).toISOString() : null,
        max_points: maxPoints,
      }).select("id").maybeSingle();
      if (created.error) throw created.error;

      return res.redirect(`${basePath}/assignments/${created.data.id}`);
    } catch (error) { next(error); }
  });

  router.get("/assignments/:id", guard, async (req, res, next) => {
    try {
      const { data: assignment, error } = await db
        .from("assignments")
        .select("*, courses(id, title, code, teacher_id)")
        .eq("id", Number(req.params.id))
        .maybeSingle();
      if (error) throw error;
      if (!assignment) return res.status(404).render("error", { title: "غير موجود", code: 404, message: "الواجب غير موجود." });
      if (!canManageFlag(req.user) && assignment.courses?.teacher_id !== req.user.id) {
        return res.status(403).render("error", { title: "غير مسموح", code: 403, message: "لا صلاحية." });
      }

      const submissionsRes = await db
        .from("submissions")
        .select("id, student_id, text, submitted_at, points, feedback, graded_at, users!submissions_student_id_fkey(id, name, university_id, platform_id)")
        .eq("assignment_id", assignment.id)
        .order("submitted_at", { ascending: false });
      if (submissionsRes.error) throw submissionsRes.error;

      return managePage(res, "manage/assignment-grade", {
        title: assignment.title,
        pageTitle: "تصحيح الواجب",
        assignment,
        course: assignment.courses,
        submissions: (submissionsRes.data ?? []).map((submission) => ({ ...submission, user: submission.users })),
      });
    } catch (error) { next(error); }
  });

  router.post("/assignments/:id/grade", guard, async (req, res, next) => {
    try {
      const { data: assignment, error } = await db
        .from("assignments")
        .select("id, max_points, courses(teacher_id, id, title, code)")
        .eq("id", Number(req.params.id))
        .maybeSingle();
      if (error) throw error;
      if (!assignment) return res.status(404).render("error", { title: "غير موجود", code: 404, message: "الواجب غير موجود." });
      if (!canManageFlag(req.user) && assignment.courses?.teacher_id !== req.user.id) return res.status(403).render("error", { title: "غير مسموح", code: 403, message: "لا صلاحية." });

      const submissionIds = Array.isArray(req.body.submission_id) ? req.body.submission_id : [req.body.submission_id];
      const points = Array.isArray(req.body.points) ? req.body.points : [req.body.points];
      const feedbacks = Array.isArray(req.body.feedback) ? req.body.feedback : [req.body.feedback];

      for (let i = 0; i < submissionIds.length; i += 1) {
        const submissionId = Number(submissionIds[i]);
        if (!Number.isInteger(submissionId)) continue;
        const value = Math.max(0, Math.min(Number(assignment.max_points), Number(points[i] ?? 0)));
        const updated = await db
          .from("submissions")
          .update({ points: value, feedback: String(feedbacks[i] ?? "").trim() || null, graded_at: new Date().toISOString() })
          .eq("id", submissionId);
        if (updated.error) throw updated.error;

        const { data: submission } = await db.from("submissions").select("student_id").eq("id", submissionId).maybeSingle();
        if (submission) {
          const award = await db.from("points_ledger").insert({
            user_id: submission.student_id,
            course_id: assignment.courses.id,
            source_type: "assignment",
            source_id: submissionId,
            source_detail: `تصحيح واجب: ${assignment.courses.title}`,
            points: 5,
          });
          if (award.error && award.error.code !== "23505") throw award.error;
        }
      }

      return res.redirect(`${basePath}/assignments/${assignment.id}`);
    } catch (error) { next(error); }
  });

  return router;
}

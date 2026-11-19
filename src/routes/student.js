import express from "express";
import { db } from "../lib/supabase.js";
import { renderPage } from "../lib/render.js";
import { requirePortal } from "../middleware/auth.js";
import {
  getAssignmentsWithSubmissions,
  getAssignmentForStudent,
  getAttendanceLectureIds,
  getAttendanceSummary,
  getCourseGrade,
  getEnrolledCourses,
  getExamForStudent,
  getExamsWithAttempts,
  getLectureForStudent,
  getLectures,
  getNotifications,
  getPoints,
  gradeLabel,
  isEnrolled,
} from "../lib/student-data.js";
import { formatDate, formatPercent, isPast, sameDay } from "../lib/format.js";
import { assessmentOf } from "../lib/tracks.js";

const router = express.Router();

// يمنع الوصول لصفحة أداة تقييم غير مناسبة لمسار الطالب (الاختبارات للبكالوريوس، الواجبات للمعادلة).
const requireAssessment = (kind) => (req, res, next) => {
  if (assessmentOf(req.user?.track) === kind) return next();
  return res.redirect("/student");
};

const FLASH = {
  attendance_ok: { tone: "success", text: "تم تسجيل حضورك بنجاح واحتساب نقاط المحاضرة." },
  attendance_already: { tone: "info", text: "حضورك مسجّل مسبقاً لهذه المحاضرة." },
  attendance_closed: { tone: "warning", text: "تسجيل الحضور بالرمز غير متاح حالياً لهذه المحاضرة." },
  attendance_wrong: { tone: "error", text: "رمز الحضور غير صحيح. تحقق من الرمز وأعد المحاولة." },
  submitted: { tone: "success", text: "تم تسليم إجابتك بنجاح." },
  already_submitted: { tone: "info", text: "سبق أن سلّمت هذا الواجب." },
  past_due: { tone: "error", text: "انتهى موعد التسليم، لم يعد بالإمكان إرسال الواجب." },
  exam_submitted: { tone: "success", text: "تم تسليم الاختبار واحتساب درجتك." },
  answer_ok: { tone: "success", text: "تم تسجيل إجابتك." },
  answer_short: { tone: "warning", text: "الرد قصير جداً — اكتب رأيك بشكل أوضح." },
  topic_ok: { tone: "success", text: "نُشِر موضوعك للنقاش العام." },
  topic_short: { tone: "warning", text: "الموضوع قصير جداً — اكتب المزيد." },
};

function flashFrom(query) {
  const key = String(query.flash ?? "");
  const base = FLASH[key];
  if (!base) return null;
  if (key === "attendance_wrong" && query.code) return { ...base, text: base.text };
  return base;
}

function portalPage(res, view, locals) {
  return renderPage(res, view, {
    layout: "portal",
    portal: res.locals.portal,
    layoutData: res.locals,
    ...locals,
  });
}

async function loadBadges(studentId, courseIds, tool = "exam") {
  const [exams, assignments] = await Promise.all([
    tool === "exam" ? getExamsWithAttempts(studentId, courseIds) : Promise.resolve([]),
    tool === "assignment" ? getAssignmentsWithSubmissions(studentId, courseIds) : Promise.resolve([]),
  ]);
  return {
    exams: exams.filter((exam) => !exam.attempt || exam.attempt.status === "in_progress").length,
    assignments: assignments.filter((item) => item.status === "pending" || item.status === "late").length,
  };
}

async function courseContext(studentId) {
  const courses = await getEnrolledCourses(studentId);
  const courseIds = courses.map((course) => course.id);
  return { courses, courseIds };
}

function courseMap(courses) {
  return new Map(courses.map((course) => [course.id, course]));
}

// ---------- لوحة التحكم ----------
router.get("/", requirePortal("student"), async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const tool = assessmentOf(req.user?.track);
    const { courses, courseIds } = await courseContext(studentId);

    const [attendance, points, exams, assignments, notifications, badges] = await Promise.all([
      getAttendanceSummary(studentId, courseIds),
      getPoints(studentId),
      tool === "exam" ? getExamsWithAttempts(studentId, courseIds) : Promise.resolve([]),
      tool === "assignment" ? getAssignmentsWithSubmissions(studentId, courseIds) : Promise.resolve([]),
      getNotifications(studentId, courseIds),
      loadBadges(studentId, courseIds, tool),
    ]);

    const now = Date.now();
    const upcomingLectures = attendance.lectures
      .filter((lecture) => !lecture.scheduled_at || new Date(lecture.scheduled_at).getTime() >= now)
      .sort((a, b) => new Date(a.scheduled_at ?? 0) - new Date(b.scheduled_at ?? 0))
      .slice(0, 4);
    const upcomingExams = exams
      .filter((exam) => exam.status === "open" || exam.status === "upcoming")
      .slice(0, 3);
    const pendingAssignments = assignments.filter((item) => item.status === "pending" || item.status === "late");
    const todayLectures = attendance.lectures.filter((lecture) => sameDay(lecture.scheduled_at, new Date()));

    const teachers = new Map(courses.map((course) => [course.id, course]));

    // نسبة الحضور لكل مقرر (لمؤشر التقدم في بطاقة المقرر)
    for (const course of courses) {
      const courseLectures = attendance.lectures.filter((lecture) => lecture.course_id === course.id);
      const past = courseLectures.filter((lecture) => lecture.scheduled_at && new Date(lecture.scheduled_at).getTime() <= now);
      const attendedCount = courseLectures.filter((lecture) => attendance.attended.has(lecture.id)).length;
      course.progress = past.length ? Math.round((attendedCount / past.length) * 100) : 0;
    }

    res.locals.navBadges = badges;
    return portalPage(res, "student/dashboard", {
      title: "لوحة التحكم",
      pageTitle: "لوحة التحكم",
      pageCss: null,
      searchAction: "/student/lectures",
      searchPlaceholder: "ابحث عن محاضرة...",
      stats: {
        courses: courses.length,
        attendanceRate: attendance.attendanceRate,
        points: points.total,
        upcomingExams: upcomingExams.length,
        pendingAssignments: pendingAssignments.length,
      },
      assessment: tool,
      courses: courses.slice(0, 4),
      upcomingLectures: upcomingLectures.map((lecture) => ({ ...lecture, course: teachers.get(lecture.course_id) })),
      todayCount: todayLectures.length,
      exams: upcomingExams,
      assignments: pendingAssignments.slice(0, 3),
      points,
      notifications,
      attendance,
    });
  } catch (error) {
    next(error);
  }
});

// ---------- المحاضرات ----------
router.get("/lectures", requirePortal("student"), async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const { courses, courseIds } = await courseContext(studentId);
    const [attendance, badges] = await Promise.all([
      getAttendanceSummary(studentId, courseIds),
      loadBadges(studentId, courseIds),
    ]);

    const map = courseMap(courses);
    const now = Date.now();
    const type = String(req.query.type ?? "all");
    const query = String(req.query.q ?? "").trim().toLowerCase();

    const lectures = attendance.lectures
      .map((lecture) => {
        const course = map.get(lecture.course_id);
        const attended = attendance.attended.has(lecture.id);
        const scheduled = lecture.scheduled_at ? new Date(lecture.scheduled_at).getTime() : null;
        const isLive = scheduled && Math.abs(now - scheduled) < (lecture.duration_min ?? 120) * 60000 && scheduled <= now;
        let state = "upcoming";
        if (attended) state = "attended";
        else if (isLive) state = "live";
        else if (scheduled && scheduled + (lecture.duration_min ?? 120) * 60000 < now) state = "finished";
        return { ...lecture, course, attended, state, isLive };
      })
      .filter((lecture) => type === "all" || lecture.lecture_type === type)
      .filter((lecture) => {
        if (!query) return true;
        return `${lecture.title} ${lecture.course?.title ?? ""} ${lecture.course?.code ?? ""}`.toLowerCase().includes(query);
      })
      .sort((a, b) => new Date(b.scheduled_at ?? 0) - new Date(a.scheduled_at ?? 0));

    const counts = {
      all: attendance.lectures.length,
      direct: attendance.lectures.filter((lecture) => lecture.lecture_type === "direct").length,
      online: attendance.lectures.filter((lecture) => lecture.lecture_type === "online").length,
      recorded: attendance.lectures.filter((lecture) => lecture.lecture_type === "recorded").length,
    };

    res.locals.navBadges = badges;
    return portalPage(res, "student/lectures", {
      title: "المحاضرات",
      pageTitle: "المحاضرات",
      pageCss: "/css/views/student-lectures.css",
      searchAction: "/student/lectures",
      searchPlaceholder: "ابحث عن محاضرة...",
      searchValue: req.query.q ?? "",
      lectures,
      counts,
      activeType: type,
      attendance,
      courses,
    });
  } catch (error) {
    next(error);
  }
});

// ---------- تفاصيل محاضرة ----------
router.get("/lectures/:id", requirePortal("student"), async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const lecture = await getLectureForStudent(Number(req.params.id), studentId);
    if (!lecture) {
      return renderPage(res.status(404), "error", {
        title: "المحاضرة غير موجودة",
        layout: "base",
        styles: ["/css/views/home.css"],
        bodyClass: "site-page",
        code: 404,
        message: "المحاضرة التي تبحث عنها غير موجودة أو لا تملك صلاحية الوصول إليها.",
      });
    }

    const course = lecture.courses;
    const [teacherRes, attendanceRes, presenceRes, presenceCountRes, filesRes, questionsRes, answersRes, relatedRes] =
      await Promise.all([
        course?.teacher_id
          ? db.from("users").select("id, name, position, email").eq("id", course.teacher_id).maybeSingle()
          : { data: null, error: null },
        db.from("attendance").select("id, created_at, method, code_used").eq("lecture_id", lecture.id).eq("student_id", studentId).maybeSingle(),
        db.from("lecture_presence").select("total_seconds, last_heartbeat_at").eq("lecture_id", lecture.id).eq("student_id", studentId).maybeSingle(),
        db.from("lecture_presence").select("student_id", { count: "exact", head: true }).eq("lecture_id", lecture.id),
        db.from("files").select("id, filename, original_name, mime, size, kind, created_at").eq("lecture_id", lecture.id).order("created_at"),
        db.from("questions").select("id, text, type, options, correct_index, correct_indices, is_open, created_at").eq("lecture_id", lecture.id).order("created_at"),
        db.from("question_answers").select("question_id, choice_index, choice_indices, text").eq("student_id", studentId),
        db.from("lectures").select("id, title, scheduled_at, duration_min, lecture_type").eq("course_id", lecture.course_id).neq("id", lecture.id).order("scheduled_at", { ascending: false }).limit(3),
        db.from("lectures").select("id").eq("course_id", lecture.course_id),
      ]);

    for (const result of [teacherRes, attendanceRes, presenceRes, presenceCountRes, filesRes, questionsRes, answersRes, relatedRes]) {
      if (result.error) throw result.error;
    }

    const answerMap = new Map((answersRes.data ?? []).map((answer) => [answer.question_id, answer]));

    // تطبيع خيارات الأسئلة ومواقعها
    const questions = (questionsRes.data ?? []).map((question) => ({
      ...question,
      options: Array.isArray(question.options) ? question.options : [],
      answer: answerMap.get(question.id) ?? null,
    }));

    // ردود أسئلة النقاش (تُعرض للجميع)
    const discussionIds = questions.filter((question) => question.type === "discussion").map((question) => question.id);
    const repliesByQuestion = new Map();
    if (discussionIds.length) {
      const repliesRes = await db
        .from("question_answers")
        .select("id, question_id, student_id, text, created_at, users!question_answers_student_id_fkey(name, university_id, platform_id)")
        .in("question_id", discussionIds)
        .not("text", "is", null)
        .order("created_at");
      if (repliesRes.error) throw repliesRes.error;
      for (const reply of repliesRes.data ?? []) {
        const entry = {
          id: reply.id,
          name: reply.users?.name ?? "طالب",
          text: reply.text,
          created_at: reply.created_at,
          isMe: reply.student_id === studentId,
        };
        if (!repliesByQuestion.has(reply.question_id)) repliesByQuestion.set(reply.question_id, []);
        repliesByQuestion.get(reply.question_id).push(entry);
      }
    }
    for (const question of questions) {
      if (question.type === "discussion") question.replies = repliesByQuestion.get(question.id) ?? [];
    }

    // تطبيع رابط يوتيوب إلى رابط تضمين
    const youtubeEmbed = (() => {
      const url = String(lecture.youtube_url ?? "").trim();
      if (!url) return null;
      const watch = url.match(/[?&]v=([\w-]{6,})/);
      const short = url.match(/youtu\.be\/([\w-]{6,})/);
      const embed = url.match(/youtube\.com\/embed\/([\w-]{6,})/);
      const id = watch?.[1] ?? short?.[1] ?? embed?.[1];
      return id ? `https://www.youtube.com/embed/${id}?rel=0` : url;
    })();

    const { courses } = await courseContext(studentId);
    const badges = await loadBadges(studentId, courses.map((item) => item.id));
    res.locals.navBadges = badges;

    const attendance = attendanceRes.data ?? null;
    const presenceSeconds = presenceRes.data?.total_seconds ?? 0;
    const totalMinutes = Math.max(1, lecture.duration_min ?? 120);

    return portalPage(res, "student/lecture", {
      title: lecture.title,
      pageTitle: "تفاصيل المحاضرة",
      pageCss: "/css/views/student-lecture.css",
      pageScripts: ["/js/lecture.js"],
      bodyAttrs: `data-lecture-id="${lecture.id}" data-duration-minutes="${lecture.duration_min ?? 120}" data-presence-seconds="${presenceSeconds}"`,
      lecture: { ...lecture, course, youtubeEmbed },
      teacher: teacherRes.data ?? null,
      attendance,
      presenceMinutes: Math.floor(presenceSeconds / 60),
      presenceCount: presenceCountRes.count ?? 0,
      presencePercent: Math.min(100, Math.round((presenceSeconds / 60 / totalMinutes) * 100)),
      files: filesRes.data ?? [],
      questions,
      related: relatedRes.data ?? [],
      flash: flashFrom(req.query),
      isLive: lecture.scheduled_at ? isPast(lecture.scheduled_at) : false,
    });
  } catch (error) {
    next(error);
  }
});

// ---------- تسجيل الحضور برمز ----------
router.post("/lectures/:id/attendance", requirePortal("student"), async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const lecture = await getLectureForStudent(Number(req.params.id), studentId);
    if (!lecture) return res.status(404).render("error", {});

    const code = String(req.body.code ?? "").trim();
    const existing = await db
      .from("attendance")
      .select("id")
      .eq("lecture_id", lecture.id)
      .eq("student_id", studentId)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return res.redirect(`/student/lectures/${lecture.id}?flash=attendance_already`);

    if (!lecture.attendance_open || !lecture.attendance_code) {
      return res.redirect(`/student/lectures/${lecture.id}?flash=attendance_closed`);
    }
    if (code !== String(lecture.attendance_code).trim()) {
      return res.redirect(`/student/lectures/${lecture.id}?flash=attendance_wrong`);
    }

    const inserted = await db.from("attendance").insert({
      lecture_id: lecture.id,
      student_id: studentId,
      method: "code",
      code_used: code,
    });
    if (inserted.error) throw inserted.error;

    const points = await db.from("points_ledger").insert({
      user_id: studentId,
      course_id: lecture.course_id,
      source_type: "attendance",
      source_id: lecture.id,
      source_detail: "تسجيل الحضور برمز المحاضرة",
      points: 10,
    });
    if (points.error && points.error.code !== "23505") throw points.error;

    return res.redirect(`/student/lectures/${lecture.id}?flash=attendance_ok`);
  } catch (error) {
    next(error);
  }
});

// ---------- نبضة الحضور ----------
router.post("/lectures/:id/heartbeat", requirePortal("student"), async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const lecture = await getLectureForStudent(Number(req.params.id), studentId);
    if (!lecture) return res.status(404).json({ ok: false });

    const current = await db
      .from("lecture_presence")
      .select("total_seconds")
      .eq("lecture_id", lecture.id)
      .eq("student_id", studentId)
      .maybeSingle();
    if (current.error) throw current.error;

    const total = Math.min((lecture.duration_min ?? 120) * 60, (current.data?.total_seconds ?? 0) + 30);
    const saved = await db.from("lecture_presence").upsert(
      {
        lecture_id: lecture.id,
        student_id: studentId,
        total_seconds: total,
        last_heartbeat_at: new Date().toISOString(),
      },
      { onConflict: "lecture_id,student_id" }
    );
    if (saved.error) throw saved.error;

    return res.json({ ok: true, minutes: Math.floor(total / 60) });
  } catch (error) {
    next(error);
  }
});

// ---------- إجابة أسئلة المحاضرة التفاعلية ----------
router.post("/lectures/:id/questions/:questionId/answer", requirePortal("student"), async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const lectureId = Number(req.params.id);
    const questionId = Number(req.params.questionId);
    const lecture = await getLectureForStudent(lectureId, studentId);
    if (!lecture) return res.status(404).render("error", {});

    const questionRes = await db
      .from("questions")
      .select("id, type, correct_index, correct_indices, is_open")
      .eq("id", questionId)
      .eq("lecture_id", lectureId)
      .maybeSingle();
    if (questionRes.error) throw questionRes.error;
    const question = questionRes.data;
    if (!question) return res.redirect(`/student/lectures/${lectureId}`);

    // نقاش عام: نص حر بلا نقاط وبلا تصحيح
    if (question.type === "discussion") {
      const text = String(req.body.answer_text ?? "").trim();
      if (text.length < 2) return res.redirect(`/student/lectures/${lectureId}?flash=answer_short`);
      const reply = await db.from("question_answers").insert({
        question_id: questionId,
        student_id: studentId,
        text,
      });
      if (reply.error) throw reply.error;
      return res.redirect(`/student/lectures/${lectureId}?flash=answer_ok`);
    }

    const existing = await db
      .from("question_answers")
      .select("id")
      .eq("question_id", questionId)
      .eq("student_id", studentId)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return res.redirect(`/student/lectures/${lectureId}?flash=answer_ok`);

    let choiceIndex = null;
    let choiceIndices = null;
    if (question.type === "multi") {
      const raw = req.body.choice_indices;
      const values = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
      choiceIndices = values.map(Number).filter((value) => Number.isInteger(value));
    } else {
      choiceIndex = req.body.choice_index === "" || req.body.choice_index == null ? null : Number(req.body.choice_index);
    }

    const saved = await db.from("question_answers").insert({
      question_id: questionId,
      student_id: studentId,
      choice_index: choiceIndex,
      choice_indices: choiceIndices,
    });
    if (saved.error) throw saved.error;

    // نقاط التفاعل: احسب الإجابة الصحيحة بحسب النوع
    let correct = false;
    if (question.type === "poll") correct = true;
    else if (question.type === "multi") {
      const expected = Array.isArray(question.correct_indices) ? question.correct_indices.map(Number) : [];
      correct =
        expected.length === (choiceIndices ?? []).length &&
        expected.every((value) => (choiceIndices ?? []).includes(value));
    } else {
      correct = choiceIndex != null && choiceIndex === Number(question.correct_index);
    }
    if (correct) {
      const award = await db.from("points_ledger").insert({
        user_id: studentId,
        course_id: lecture.course_id,
        source_type: "interaction",
        source_id: questionId,
        source_detail: "إجابة صحيحة في جلسة المحاضرة",
        points: 1,
      });
      if (award.error && award.error.code !== "23505") throw award.error;
    }

    return res.redirect(`/student/lectures/${lectureId}?flash=answer_ok`);
  } catch (error) {
    next(error);
  }
});

// ---------- إتاحة موضوع للنقاش العام (بلا نقاط) ----------
router.post("/lectures/:id/questions/discuss", requirePortal("student"), async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const lectureId = Number(req.params.id);
    const lecture = await getLectureForStudent(lectureId, studentId);
    if (!lecture) return res.status(404).render("error", { title: "غير موجود", code: 404, message: "المحاضرة غير موجودة أو لا تملك صلاحية الوصول إليها." });

    const topic = String(req.body.topic ?? "").trim();
    if (topic.length < 5) {
      return res.redirect(`/student/lectures/${lectureId}?flash=topic_short`);
    }

    const created = await db.from("questions").insert({
      lecture_id: lectureId,
      text: topic,
      type: "discussion",
      is_open: true,
    }).select("id").maybeSingle();
    if (created.error) throw created.error;

    return res.redirect(`/student/lectures/${lectureId}?flash=topic_ok`);
  } catch (error) {
    next(error);
  }
});

// يجمع إجابات الاختبار من الطلب ويحسب النتيجة الموضوعية.
function collectExamAnswers(questions, body, attemptId, mode) {
  let score = 0;
  let hasEssay = false;
  const rows = [];

  for (const question of questions) {
    const raw = body[`q_${question.id}`];
    let choiceIndex = null;
    let choiceIndices = null;
    let text = null;
    let points = null;

    if (question.type === "multi") {
      const values = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
      choiceIndices = values.map(Number).filter((value) => Number.isInteger(value));
      if (mode === "submit") {
        const expected = Array.isArray(question.correct_indices) ? question.correct_indices.map(Number) : [];
        const correct =
          expected.length === choiceIndices.length && expected.every((value) => choiceIndices.includes(value));
        points = correct ? Number(question.points ?? 0) : 0;
        score += points;
      }
    } else if (question.type === "essay") {
      text = String(raw ?? "").trim() || null;
      hasEssay = true;
    } else if (question.type === "truefalse") {
      choiceIndex = raw === "true" ? 1 : raw === "false" ? 0 : null;
      if (mode === "submit") {
        const expected = Number(question.correct_index ?? (question.correct_index === 0 ? 0 : 1));
        const correct = choiceIndex != null && choiceIndex === expected;
        points = correct ? Number(question.points ?? 0) : 0;
        score += points;
      }
    } else {
      choiceIndex = raw != null && raw !== "" ? Number(raw) : null;
      if (mode === "submit") {
        const correct = choiceIndex != null && choiceIndex === Number(question.correct_index);
        points = correct ? Number(question.points ?? 0) : 0;
        score += points;
      }
    }

    rows.push({
      attempt_id: attemptId,
      question_id: question.id,
      choice_index: choiceIndex,
      choice_indices: choiceIndices,
      text,
      points,
    });
  }

  return { rows, score, hasEssay };
}

// ---------- الاختبارات ----------
router.get("/exams", requirePortal("student"), requireAssessment("exam"), async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const { courses, courseIds } = await courseContext(studentId);
    const [exams, badges] = await Promise.all([
      getExamsWithAttempts(studentId, courseIds),
      loadBadges(studentId, courseIds),
    ]);

    const map = courseMap(courses);
    const decorated = exams.map((exam) => ({
      ...exam,
      course: map.get(exam.course_id),
      percent: exam.attempt?.score != null && exam.totalPoints ? Math.round((Number(exam.attempt.score) / exam.totalPoints) * 100) : null,
    }));

    res.locals.navBadges = badges;
    return portalPage(res, "student/exams", {
      title: "الاختبارات",
      pageTitle: "الاختبارات",
      pageCss: "/css/views/student-lectures.css",
      exams: decorated,
      counts: {
        all: decorated.length,
        open: decorated.filter((exam) => exam.status === "open").length,
        upcoming: decorated.filter((exam) => exam.status === "upcoming").length,
        finished: decorated.filter((exam) => exam.status === "finished").length,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/exams/:id", requirePortal("student"), requireAssessment("exam"), async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const exam = await getExamForStudent(Number(req.params.id), studentId);
    if (!exam) {
      return renderPage(res.status(404), "error", {
        title: "الاختبار غير موجود",
        layout: "base",
        styles: ["/css/views/home.css"],
        bodyClass: "site-page",
        code: 404,
        message: "الاختبار غير موجود أو لا تملك صلاحية الوصول إليه.",
      });
    }

    const [attemptRes, questionsRes] = await Promise.all([
      db.from("exam_attempts").select("id, started_at, submitted_at, score, status, graded_at").eq("exam_id", exam.id).eq("student_id", studentId).maybeSingle(),
      db.from("exam_questions").select("id, type, text, options, points, position, correct_index, correct_indices").eq("exam_id", exam.id).order("position"),
    ]);
    if (attemptRes.error) throw attemptRes.error;
    if (questionsRes.error) throw questionsRes.error;

    const questions = questionsRes.data ?? [];
    const attempt = attemptRes.data ?? null;
    const totalPoints = questions.reduce((sum, question) => sum + Number(question.points ?? 0), 0);

    if (attempt && ["submitted", "graded"].includes(attempt.status)) {
      const answersRes = await db
        .from("exam_answers")
        .select("question_id, choice_index, choice_indices, text, points, feedback")
        .eq("attempt_id", attempt.id);
      if (answersRes.error) throw answersRes.error;
      const answerMap = new Map((answersRes.data ?? []).map((answer) => [answer.question_id, answer]));

      return portalPage(res, "student/exam-result", {
        title: `نتيجة ${exam.title}`,
        pageTitle: "نتيجة الاختبار",
        pageCss: "/css/views/grades.css",
        exam,
        attempt,
        totalPoints,
        percent: totalPoints ? Math.round((Number(attempt.score ?? 0) / totalPoints) * 100) : 0,
        grade: gradeLabel(totalPoints ? (Number(attempt.score ?? 0) / totalPoints) * 100 : 0),
        questions: questions.map((question) => ({ ...question, answer: answerMap.get(question.id) ?? null })),
      });
    }

    if (!attempt) {
      const now = Date.now();
      const starts = exam.starts_at ? new Date(exam.starts_at).getTime() : null;
      const ends = exam.ends_at ? new Date(exam.ends_at).getTime() : null;
      const status = starts && starts > now ? "upcoming" : ends && ends < now ? "closed" : "open";
      return portalPage(res, "student/exam-info", {
        title: exam.title,
        pageTitle: "الاختبار",
        pageCss: "/css/views/student-exam.css",
        exam,
        totalPoints,
        questionCount: questions.length,
        status,
        flash: flashFrom(req.query),
      });
    }

    // محاولة جارية: حساب الوقت المتبقي.
    const startedAt = new Date(attempt.started_at).getTime();
    const duration = Number(exam.duration_min ?? 60);
    const endsAt = exam.ends_at ? new Date(exam.ends_at).getTime() : null;
    const remainingSeconds = Math.max(
      0,
      Math.min(endsAt ? Math.floor((endsAt - Date.now()) / 1000) : Infinity, Math.floor((startedAt + duration * 60000 - Date.now()) / 1000))
    );

    const answersRes = await db
      .from("exam_answers")
      .select("question_id, choice_index, choice_indices, text")
      .eq("attempt_id", attempt.id);
    if (answersRes.error) throw answersRes.error;

    const map = new Map((answersRes.data ?? []).map((answer) => [answer.question_id, answer]));

    return portalPage(res, "student/exam", {
      title: exam.title,
      pageTitle: "الاختبار",
      layout: "base",
      bodyClass: "exam-page",
      styles: ["/css/views/student-exam.css", "/css/portal-theme.css"],
      scripts: ["/js/exam.js"],
      exam,
      attempt,
      bodyAttrs: `data-remaining-seconds="${remainingSeconds}"`,
      questions: questions.map((question) => ({
        ...question,
        options: Array.isArray(question.options) ? question.options : [],
        answer: map.get(question.id) ?? null,
      })),
      totalPoints,
      remainingSeconds,
    });
  } catch (error) {
    next(error);
  }
});

// ---------- حفظ تلقائي للإجابات أثناء الاختبار ----------
router.post("/exams/:id/autosave", requirePortal("student"), requireAssessment("exam"), async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const examId = Number(req.params.id);
    const exam = await getExamForStudent(examId, studentId);
    if (!exam) return res.status(404).json({ ok: false });

    const attemptRes = await db
      .from("exam_attempts")
      .select("id, status")
      .eq("exam_id", examId)
      .eq("student_id", studentId)
      .maybeSingle();
    if (attemptRes.error) throw attemptRes.error;
    if (!attemptRes.data || attemptRes.data.status !== "in_progress") {
      return res.json({ ok: false, reason: "not_in_progress" });
    }

    const questionsRes = await db
      .from("exam_questions")
      .select("id, type, points")
      .eq("exam_id", examId);
    if (questionsRes.error) throw questionsRes.error;

    const { rows } = collectExamAnswers(questionsRes.data ?? [], req.body, attemptRes.data.id, "autosave");
    // لا نكتب نقاطاً في الحفظ التلقائي — تُحتسب عند التسليم
    const cleanRows = rows.map((row) => ({ ...row, points: null }));
    if (cleanRows.length) {
      const saved = await db.from("exam_answers").upsert(cleanRows, { onConflict: "attempt_id,question_id" });
      if (saved.error) throw saved.error;
    }
    return res.json({ ok: true, at: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

router.post("/exams/:id/start", requirePortal("student"), requireAssessment("exam"), async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const exam = await getExamForStudent(Number(req.params.id), studentId);
    if (!exam) return res.redirect("/student/exams");

    const now = Date.now();
    const starts = exam.starts_at ? new Date(exam.starts_at).getTime() : null;
    const ends = exam.ends_at ? new Date(exam.ends_at).getTime() : null;
    if ((starts && starts > now) || (ends && ends < now)) {
      return res.redirect(`/student/exams/${exam.id}`);
    }

    const existing = await db
      .from("exam_attempts")
      .select("id, status")
      .eq("exam_id", exam.id)
      .eq("student_id", studentId)
      .maybeSingle();
    if (existing.error) throw existing.error;

    if (!existing.data) {
      const created = await db.from("exam_attempts").insert({
        exam_id: exam.id,
        student_id: studentId,
        started_at: new Date().toISOString(),
        status: "in_progress",
      });
      if (created.error && created.error.code !== "23505") throw created.error;
    }

    return res.redirect(`/student/exams/${exam.id}`);
  } catch (error) {
    next(error);
  }
});

router.post("/exams/:id/submit", requirePortal("student"), requireAssessment("exam"), async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const examId = Number(req.params.id);
    const exam = await getExamForStudent(examId, studentId);
    if (!exam) return res.redirect("/student/exams");

    const attemptRes = await db
      .from("exam_attempts")
      .select("id, status, started_at")
      .eq("exam_id", examId)
      .eq("student_id", studentId)
      .maybeSingle();
    if (attemptRes.error) throw attemptRes.error;
    if (!attemptRes.data) return res.redirect(`/student/exams/${examId}`);
    if (["submitted", "graded"].includes(attemptRes.data.status)) {
      return res.redirect(`/student/exams/${examId}`);
    }

    const questionsRes = await db
      .from("exam_questions")
      .select("id, type, points, correct_index, correct_indices")
      .eq("exam_id", examId);
    if (questionsRes.error) throw questionsRes.error;

    const questions = questionsRes.data ?? [];
    const attemptId = attemptRes.data.id;
    const { rows, score, hasEssay } = collectExamAnswers(questions, req.body, attemptId, "submit");

    if (rows.length) {
      const saved = await db.from("exam_answers").upsert(rows, { onConflict: "attempt_id,question_id" });
      if (saved.error) throw saved.error;
    }

    const updated = await db
      .from("exam_attempts")
      .update({
        submitted_at: new Date().toISOString(),
        score,
        status: hasEssay ? "submitted" : "graded",
        graded_at: hasEssay ? null : new Date().toISOString(),
      })
      .eq("id", attemptId);
    if (updated.error) throw updated.error;

    // نقاط التفاعل للإجابات الصحيحة.
    for (const row of rows) {
      if (row.points && row.points > 0) {
        const award = await db.from("points_ledger").insert({
          user_id: studentId,
          course_id: exam.course_id,
          source_type: "interaction",
          source_id: row.question_id,
          source_detail: `إجابة صحيحة في ${exam.title}`,
          points: 1,
        });
        if (award.error && award.error.code !== "23505") throw award.error;
      }
    }

    return res.redirect(`/student/exams/${examId}?flash=exam_submitted`);
  } catch (error) {
    next(error);
  }
});

// ---------- الواجبات ----------
router.get("/assignments", requirePortal("student"), requireAssessment("assignment"), async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const { courses, courseIds } = await courseContext(studentId);
    const [assignments, badges] = await Promise.all([
      getAssignmentsWithSubmissions(studentId, courseIds),
      loadBadges(studentId, courseIds),
    ]);

    const map = courseMap(courses);
    const decorated = assignments.map((assignment) => ({
      ...assignment,
      course: map.get(assignment.course_id),
      remaining: assignment.due_at ? new Date(assignment.due_at).getTime() - Date.now() : null,
    }));

    res.locals.navBadges = badges;
    return portalPage(res, "student/assignments", {
      title: "الواجبات",
      pageTitle: "الواجبات",
      pageCss: "/css/views/assignments.css",
      assignments: decorated,
      counts: {
        all: decorated.length,
        pending: decorated.filter((item) => item.status === "pending").length,
        submitted: decorated.filter((item) => item.status === "submitted").length,
        graded: decorated.filter((item) => item.status === "graded").length,
        late: decorated.filter((item) => item.status === "late").length,
      },
      flash: flashFrom(req.query),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/assignments/:id", requirePortal("student"), requireAssessment("assignment"), async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const assignment = await getAssignmentForStudent(Number(req.params.id), studentId);
    if (!assignment) {
      return renderPage(res.status(404), "error", {
        title: "الواجب غير موجود",
        layout: "base",
        styles: ["/css/views/home.css"],
        bodyClass: "site-page",
        code: 404,
        message: "الواجب غير موجود أو لا تملك صلاحية الوصول إليه.",
      });
    }

    const submissionRes = await db
      .from("submissions")
      .select("id, text, submitted_at, points, feedback, graded_at")
      .eq("assignment_id", assignment.id)
      .eq("student_id", studentId)
      .maybeSingle();
    if (submissionRes.error) throw submissionRes.error;

    const { courses, courseIds } = await courseContext(studentId);
    const badges = await loadBadges(studentId, courseIds);
    res.locals.navBadges = badges;

    return portalPage(res, "student/assignment", {
      title: assignment.title,
      pageTitle: "تفاصيل الواجب",
      pageCss: "/css/views/assignments.css",
      assignment: { ...assignment, course: assignment.courses },
      submission: submissionRes.data ?? null,
      pastDue: assignment.due_at ? new Date(assignment.due_at).getTime() < Date.now() : false,
      flash: flashFrom(req.query),
      course: courses.find((course) => course.id === assignment.course_id) ?? assignment.courses,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/assignments/:id/submit", requirePortal("student"), requireAssessment("assignment"), async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const assignment = await getAssignmentForStudent(Number(req.params.id), studentId);
    if (!assignment) return res.redirect("/student/assignments");

    const existing = await db
      .from("submissions")
      .select("id")
      .eq("assignment_id", assignment.id)
      .eq("student_id", studentId)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return res.redirect(`/student/assignments/${assignment.id}?flash=already_submitted`);

    if (assignment.due_at && new Date(assignment.due_at).getTime() < Date.now()) {
      return res.redirect(`/student/assignments/${assignment.id}?flash=past_due`);
    }

    const text = String(req.body.text ?? "").trim();
    if (text.length < 10) {
      return res.redirect(`/student/assignments/${assignment.id}`);
    }

    const created = await db.from("submissions").insert({
      assignment_id: assignment.id,
      student_id: studentId,
      text,
      submitted_at: new Date().toISOString(),
    });
    if (created.error) throw created.error;

    return res.redirect(`/student/assignments?flash=submitted`);
  } catch (error) {
    next(error);
  }
});

// ---------- الدرجات ----------
router.get("/grades", requirePortal("student"), async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const { courses, courseIds } = await courseContext(studentId);
    const [grades, points, attendance, badges] = await Promise.all([
      Promise.all(courses.map((course) => getCourseGrade(course, studentId))),
      getPoints(studentId),
      getAttendanceSummary(studentId, courseIds),
      loadBadges(studentId, courseIds),
    ]);

    const average = grades.length
      ? grades.reduce((sum, grade) => sum + grade.total, 0) / grades.length
      : 0;
    const gpa = Math.max(0, Math.min(4, (average / 100) * 4));

    res.locals.navBadges = badges;
    return portalPage(res, "student/grades", {
      title: "الدرجات",
      pageTitle: "درجاتي",
      pageCss: "/css/views/grades.css",
      grades,
      gradeLabel,
      average: Math.round(average * 10) / 10,
      gpa: gpa.toFixed(2),
      attendanceRate: attendance.attendanceRate,
      points: points.total,
      coursesCount: courses.length,
      flash: flashFrom(req.query),
    });
  } catch (error) {
    next(error);
  }
});

// ---------- النقاط ----------
router.get("/points", requirePortal("student"), async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const { courses, courseIds } = await courseContext(studentId);
    const [points, badges] = await Promise.all([getPoints(studentId), loadBadges(studentId, courseIds)]);

    // لوحة الشرف: مجموع نقاط كل طالب.
    const ledgerRes = await db.from("points_ledger").select("user_id, points");
    if (ledgerRes.error) throw ledgerRes.error;
    const totals = new Map();
    for (const row of ledgerRes.data ?? []) {
      totals.set(row.user_id, (totals.get(row.user_id) ?? 0) + (row.points ?? 0));
    }
    const ids = [...totals.keys()];
    let names = [];
    if (ids.length) {
      const usersRes = await db.from("users").select("id, name, role").in("id", ids).eq("role", "student");
      if (usersRes.error) throw usersRes.error;
      names = usersRes.data ?? [];
    }
    const leaderboard = names
      .map((user) => ({ ...user, total: totals.get(user.id) ?? 0 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .map((user, index) => ({ ...user, rank: index + 1, isMe: user.id === studentId }));

    // نقاط آخر سبعة أيام.
    const days = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - offset);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const total = points.rows
        .filter((row) => {
          const at = new Date(row.created_at).getTime();
          return at >= start.getTime() && at < end.getTime();
        })
        .reduce((sum, row) => sum + (row.points ?? 0), 0);
      days.push({
        label: new Intl.DateTimeFormat("ar", { calendar: "gregory", numberingSystem: "latn", weekday: "short" }).format(start),
        date: formatDate(start),
        total,
      });
    }
    const maxDay = Math.max(1, ...days.map((day) => day.total));
    const weekly = days.map((day) => ({ ...day, height: Math.round((day.total / maxDay) * 100) }));

    res.locals.navBadges = badges;
    return portalPage(res, "student/points", {
      title: "النقاط",
      pageTitle: "نقاطي",
      pageCss: "/css/views/points.css",
      points,
      courses,
      leaderboard,
      weekly,
      myRank: leaderboard.find((row) => row.isMe)?.rank ?? null,
      flash: flashFrom(req.query),
    });
  } catch (error) {
    next(error);
  }
});

// ---------- مقرراتي ----------
router.get("/courses", requirePortal("student"), async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const { courses, courseIds } = await courseContext(studentId);
    const [attendance, badges] = await Promise.all([
      getAttendanceSummary(studentId, courseIds),
      loadBadges(studentId, courseIds),
    ]);

    for (const course of courses) {
      const courseLectures = attendance.lectures.filter((lecture) => lecture.course_id === course.id);
      const past = courseLectures.filter((lecture) => lecture.scheduled_at && new Date(lecture.scheduled_at).getTime() <= Date.now());
      const attendedCount = courseLectures.filter((lecture) => attendance.attended.has(lecture.id)).length;
      course.progress = past.length ? Math.round((attendedCount / past.length) * 100) : 0;
      course.totalLectures = courseLectures.length;
    }

    res.locals.navBadges = badges;
    return portalPage(res, "student/courses", {
      title: "مقرراتي",
      pageTitle: "مقرراتي",
      courses,
      attendance,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/courses/:id", requirePortal("student"), async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const courseId = Number(req.params.id);
    if (!(await isEnrolled(studentId, courseId))) {
      return renderPage(res.status(404), "error", {
        title: "المقرر غير موجود",
        layout: "base",
        styles: ["/css/views/home.css"],
        bodyClass: "site-page",
        code: 404,
        message: "المقرر غير موجود أو لا تملك صلاحية الوصول إليه.",
      });
    }

    const { data: course, error } = await db
      .from("courses")
      .select("*")
      .eq("id", courseId)
      .maybeSingle();
    if (error) throw error;

    const [teacherRes, lecturesRes, grade, badges] = await Promise.all([
      db.from("users").select("id, name, position, email").eq("id", course.teacher_id).maybeSingle(),
      db.from("lectures").select("id, title, lecture_type, scheduled_at, duration_min, attendance_open").eq("course_id", courseId).order("scheduled_at", { ascending: false }),
      getCourseGrade(course, studentId),
      courseContext(studentId).then(({ courseIds }) => loadBadges(studentId, courseIds)),
    ]);
    if (teacherRes.error) throw teacherRes.error;
    if (lecturesRes.error) throw lecturesRes.error;

    res.locals.navBadges = badges;
    return portalPage(res, "student/course", {
      title: course.title,
      pageTitle: "تفاصيل المقرر",
      course,
      gradeLabel,
      teacher: teacherRes.data ?? null,
      lectures: lecturesRes.data ?? [],
      grade,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

import express from "express";
import { db } from "./supabase.js";
import { renderPage } from "./render.js";
import { requireAuth } from "../middleware/auth.js";
import { PORTALS, primaryPortal, isFounder } from "./portals.js";

/** إشعاراتي: عرض + تعليم كمقروء + إرسال (للأساتذة والمالك). */
export function createNotificationsRouter() {
  const router = express.Router();
  router.use(requireAuth);

  async function applicableCourseIds(user) {
    if (await isFounder(user)) {
      const { data, error } = await db.from("courses").select("id");
      if (error) throw error;
      return (data ?? []).map((course) => course.id);
    }
    if (user.role === "teacher") {
      const { data, error } = await db.from("courses").select("id").eq("teacher_id", user.id);
      if (error) throw error;
      return (data ?? []).map((course) => course.id);
    }
    const { data, error } = await db.from("enrollments").select("course_id").eq("student_id", user.id).eq("status", "active");
    if (error) throw error;
    return (data ?? []).map((row) => row.course_id);
  }

  async function applicableNotifications(user) {
    const courseIds = await applicableCourseIds(user);
    const { data, error } = await db
      .from("notifications")
      .select("id, audience, course_id, user_id, title, body, link, created_at, created_by")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;

    const applicable = (data ?? []).filter((item) => {
      if (item.audience === "all") return true;
      if (item.audience === "user") return item.user_id === user.id;
      if (item.audience === "course") return courseIds.includes(item.course_id);
      return false;
    });

    const ids = applicable.map((item) => item.id);
    let readIds = new Set();
    if (ids.length) {
      const reads = await db.from("notification_reads").select("notification_id").eq("user_id", user.id).in("notification_id", ids);
      if (reads.error) throw reads.error;
      readIds = new Set((reads.data ?? []).map((row) => row.notification_id));
    }

    return { applicable, readIds };
  }

  router.get("/", async (req, res, next) => {
    try {
      const { applicable, readIds } = await applicableNotifications(req.user);
      const portalKey = await primaryPortal(req.user);
      const canSend = req.user.role === "teacher" || (await isFounder(req.user));

      let sendCourses = [];
      if (canSend) {
        const builder = (await isFounder(req.user))
          ? db.from("courses").select("id, title, code").order("code")
          : db.from("courses").select("id, title, code").eq("teacher_id", req.user.id).order("code");
        const { data, error: coursesError } = await builder;
        if (coursesError) throw coursesError;
        sendCourses = data ?? [];
      }

      const items = applicable.map((item) => ({
        ...item,
        isRead: readIds.has(item.id),
      }));

      return renderPage(res, "notifications/index", {
        layout: "portal",
        portal: PORTALS[portalKey],
        title: "الإشعارات",
        pageTitle: "الإشعارات",
        items,
        unreadCount: items.filter((item) => !item.isRead).length,
        canSend,
        sendCourses,
        basePath: portalKey === "owner" ? "/owner" : portalKey === "teacher" ? "/teacher" : "/student",
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/read-all", async (req, res, next) => {
    try {
      const { applicable, readIds } = await applicableNotifications(req.user);
      const rows = applicable
        .filter((item) => !readIds.has(item.id))
        .map((item) => ({ notification_id: item.id, user_id: req.user.id }));
      if (rows.length) {
        const { error } = await db.from("notification_reads").upsert(rows, { onConflict: "notification_id,user_id", ignoreDuplicates: true });
        if (error) throw error;
      }
      return res.redirect("/notifications");
    } catch (error) {
      next(error);
    }
  });

  router.post("/send", async (req, res, next) => {
    try {
      const isOwner = await isFounder(req.user);
      if (req.user.role !== "teacher" && !isOwner) {
        return res.redirect("/notifications");
      }

      const title = String(req.body.title ?? "").trim();
      const body = String(req.body.body ?? "").trim() || null;
      const link = String(req.body.link ?? "").trim() || null;
      const audience = ["all", "course"].includes(req.body.audience) ? req.body.audience : "all";
      const courseId = audience === "course" ? (Number.isInteger(Number(req.body.course_id)) ? Number(req.body.course_id) : null) : null;

      if (title.length < 3) return res.redirect("/notifications?error=title");

      // للأستاذ: يُقيّد بمقرراته فقط؛ للمالك: أي مقرر
      if (audience === "course" && !isOwner) {
        const { data, error } = await db.from("courses").select("id").eq("id", courseId).eq("teacher_id", req.user.id).maybeSingle();
        if (error) throw error;
        if (!data) return res.redirect("/notifications?error=course");
      }

      const created = await db.from("notifications").insert({
        audience,
        course_id: courseId,
        title,
        body,
        link,
        created_by: req.user.id,
      });
      if (created.error) throw created.error;

      return res.redirect("/notifications?sent=1");
    } catch (error) {
      next(error);
    }
  });

  return router;
}

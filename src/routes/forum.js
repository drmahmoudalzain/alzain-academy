import express from "express";
import { db } from "../lib/supabase.js";
import { renderPage } from "../lib/render.js";
import { requireAuth } from "../middleware/auth.js";
import { PORTALS, primaryPortal } from "../lib/portals.js";
import { listRoomsFor, getAccessibleRoom } from "../lib/forum.js";

const router = express.Router();
router.use(requireAuth);

// ---------- صفحة المنتدى ----------
router.get("/", async (req, res, next) => {
  try {
    const portalKey = await primaryPortal(req.user);
    const rooms = await listRoomsFor(req.user);

    const requested = Number(req.query.room ?? 0);
    const activeRoom =
      (requested ? rooms.find((room) => room.id === requested) : null) ?? rooms[0] ?? null;

    let accessibleActive = null;
    if (activeRoom) {
      accessibleActive =
        activeRoom.kind === "general" || (await getAccessibleRoom(req.user, activeRoom.id))
          ? activeRoom
          : null;
    }

    return renderPage(res, "forum/index", {
      layout: "portal",
      portal: PORTALS[portalKey],
      title: "المنتدى",
      pageTitle: "المنتدى",
      pageCss: "/css/views/forum.css",
      rooms,
      activeRoom: accessibleActive,
      currentUser: { id: req.user.id, name: req.user.name },
    });
  } catch (error) {
    next(error);
  }
});

// ---------- رسائل الغرفة (لـ JS) ----------
router.get("/messages", async (req, res, next) => {
  try {
    const roomId = Number(req.query.room);
    const room = await getAccessibleRoom(req.user, roomId);
    if (!room) return res.status(403).json({ ok: false, error: "لا تملك صلاحية الدخول إلى هذه الغرفة." });

    const before = Number(req.query.before ?? 0);
    let query = db
      .from("chat_messages")
      .select("id, user_id, author_name, body, created_at")
      .eq("room_id", roomId)
      .order("id", { ascending: false })
      .limit(50);
    if (before > 0) query = query.lt("id", before);

    const { data, error } = await query;
    if (error) throw error;

    const messages = (data ?? []).reverse().map((message) => ({
      id: message.id,
      userId: message.user_id,
      name: message.author_name ?? "مجهول",
      body: message.body,
      createdAt: message.created_at,
      isMe: message.user_id === req.user.id,
    }));

    return res.json({ ok: true, roomId, messages, room: { id: room.id, name: room.name } });
  } catch (error) {
    next(error);
  }
});

// ---------- إرسال رسالة بدون JS (احتياطي) ----------
router.post("/messages", async (req, res, next) => {
  try {
    const roomId = Number(req.body.room_id);
    if (!Number.isInteger(roomId)) return res.redirect("/forum");
    const body = String(req.body.body ?? "").trim();

    const room = await getAccessibleRoom(req.user, roomId);
    if (!room) return res.status(403).redirect("/forum");

    if (body.length >= 1 && body.length <= 1000) {
      const { error } = await db.from("chat_messages").insert({
        room_id: roomId,
        user_id: req.user.id,
        author_name: req.user.name,
        body,
      });
      if (error) throw error;
    }

    return res.redirect(`/forum?room=${roomId}`);
  } catch (error) {
    next(error);
  }
});

export default router;

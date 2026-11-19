import { WebSocketServer } from "ws";
import { db } from "./supabase.js";
import { SESSION_COOKIE, hashToken, parseCookies } from "./session.js";
import { canAccessRoom } from "./forum.js";

/**
 * خادم WebSocket للمنتدى — يُركَّب على نفس http server.
 * الرسائل: join / leave / msg / signal (للصوت والفيديو).
 */
export function attachChatServer(server) {
  const wss = new WebSocketServer({ server, path: "/ws/chat" });

  // خريطة الغرف: roomId -> Set<WebSocket>
  const rooms = new Map();
  // خريطة المقابس: ws -> user
  const socketUser = new Map();

  const roomSockets = (roomId) => rooms.get(roomId) ?? new Set();

  const roomPresence = (roomId) => {
    const seen = new Map();
    for (const socket of roomSockets(roomId)) {
      const user = socketUser.get(socket);
      if (user && !seen.has(user.id)) seen.set(user.id, { id: user.id, name: user.name });
    }
    return [...seen.values()];
  };

  const broadcastRoom = (roomId, payload) => {
    const raw = JSON.stringify(payload);
    for (const socket of roomSockets(roomId)) {
      if (socket.readyState === socket.OPEN) socket.send(raw);
    }
  };

  const broadcastPresence = (roomId) => {
    broadcastRoom(roomId, { t: "users", roomId, users: roomPresence(roomId) });
  };

  const subscribe = (ws, roomId) => {
    if (!rooms.has(roomId)) rooms.set(roomId, new Set());
    rooms.get(roomId).add(ws);
  };

  const unsubscribe = (ws, roomId) => {
    const set = rooms.get(roomId);
    if (!set) return;
    set.delete(ws);
    if (set.size === 0) rooms.delete(roomId);
    broadcastPresence(roomId);
  };

  wss.on("connection", (ws, req) => {
    // مصادقة غير متزامنة — لكن نلتقط الرسائل الواردة فوراً ونصفّفها حتى تكتمل المصادقة
    const jar = parseCookies(req.headers.cookie);
    const token = jar[SESSION_COOKIE];

    const inbox = [];
    ws.on("message", (raw) => inbox.push(raw));

    if (!token) return ws.close(4401, "unauthorized");

    const tokenHash = hashToken(token);
    const userReady = (async () => {
      const { data, error } = await db
        .from("sessions")
        .select("token_hash, expires_at, users(*)")
        .eq("token_hash", tokenHash)
        .maybeSingle();

      if (error || !data?.users || new Date(data.expires_at) <= new Date()) return null;
      const user = Array.isArray(data.users) ? data.users[0] : data.users;
      return user;
    })();

    // معالجة الرسائل بعد اكتمال المصادقة (أو رفضها)
    userReady.then((user) => {
      if (!user) return ws.close(4401, "unauthorized");

      const subscribed = new Set();
      ws.isAlive = true;
      const send = (payload) => {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
      };

      socketUser.set(ws, { id: user.id, name: user.name, role: user.role });
      ws.on("pong", () => { ws.isAlive = true; });

      const processMessage = async (raw) => {
        try {
          await handleMessage(raw);
        } catch (error) {
          console.error("خطأ في معالج رسائل الدردشة:", error);
          send({ t: "error", error: "خطأ داخلي في خادم الدردشة" });
        }
      };

      // استبدال ملتقط الرسائل المؤقت بالمعالج الحقيقي
      ws.removeAllListeners("message");
      ws.on("message", (raw) => { processMessage(raw); });

      // نفّذ ما وصل أثناء انتظار المصادقة
      (async () => {
        for (const raw of inbox.splice(0)) await processMessage(raw);
      })();

      ws.on("close", () => {
        for (const roomId of [...subscribed]) unsubscribe(ws, roomId);
        socketUser.delete(ws);
      });

    async function handleMessage(raw) {
      let msg;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return send({ t: "error", error: "صيغة رسالة غير صالحة" });
      }

      const type = msg?.t;

      // ---------- الانضمام ----------
      if (type === "join") {
        const roomId = Number(msg.roomId);
        if (!Number.isInteger(roomId) || roomId <= 0) return send({ t: "error", error: "غرفة غير صالحة" });

        const room = await db
          .from("chat_rooms")
          .select("id, name, kind, course_id")
          .eq("id", roomId)
          .maybeSingle();
        if (room.error) return send({ t: "error", error: "تعذر جلب الغرفة" });
        if (!room.data) return send({ t: "error", error: "الغرفة غير موجودة" });
        if (!(await canAccessRoom({ ...user, role: user.role }, room.data))) {
          return send({ t: "error", error: "لا تملك صلاحية الدخول إلى هذه الغرفة" });
        }

        subscribe(ws, roomId);
        subscribed.add(roomId);

        // أرسل آخر 50 رسالة (بالترتيب الزمني) + قائمة المتصلين
        const history = await db
          .from("chat_messages")
          .select("id, user_id, author_name, body, created_at")
          .eq("room_id", roomId)
          .order("id", { ascending: false })
          .limit(50);
        const messages = (history.data ?? []).reverse().map((m) => ({
          id: m.id, userId: m.user_id, name: m.author_name ?? "مجهول", body: m.body, createdAt: m.created_at, isMe: m.user_id === user.id,
        }));

        send({ t: "joined", roomId, users: roomPresence(roomId), messages });
        broadcastRoom(roomId, { t: "users", roomId, users: roomPresence(roomId) });
        return;
      }

      // ---------- مغادرة ----------
      if (type === "leave") {
        const roomId = Number(msg.roomId);
        if (!subscribed.has(roomId)) return;
        unsubscribe(ws, roomId);
        subscribed.delete(roomId);
        return;
      }

      // ---------- رسالة ----------
      if (type === "msg") {
        const roomId = Number(msg.roomId);
        const text = String(msg.text ?? "").trim();

        if (!subscribed.has(roomId)) return send({ t: "error", error: "لست في هذه الغرفة" });
        if (text.length < 1 || text.length > 1000) return send({ t: "error", error: "الرسالة قصيرة جداً أو طويلة جداً" });

        const inserted = await db
          .from("chat_messages")
          .insert({ room_id: roomId, user_id: user.id, author_name: user.name, body: text })
          .select("id, created_at")
          .maybeSingle();
        if (inserted.error) return send({ t: "error", error: "تعذر حفظ الرسالة" });

        broadcastRoom(roomId, {
          t: "msg",
          roomId,
          message: {
            id: inserted.data.id,
            userId: user.id,
            name: user.name,
            body: text,
            createdAt: inserted.data.created_at,
            isMe: false,
          },
        });
        return;
      }

      // ---------- إشارة WebRTC (صوت/فيديو) ----------
      if (type === "signal") {
        const roomId = Number(msg.roomId);
        const to = Number(msg.to);
        if (!subscribed.has(roomId)) return;

        // to = -1 تعني بث الإشارة لكل أفراد الغرفة (عدا المرسل)
        const payload = JSON.stringify({
          t: "signal",
          roomId,
          from: user.id,
          fromName: user.name,
          signal: msg.signal,
        });

        if (to === -1) {
          for (const socket of roomSockets(roomId)) {
            const target = socketUser.get(socket);
            if (target && target.id !== user.id && socket.readyState === socket.OPEN) socket.send(payload);
          }
          return;
        }

        if (!Number.isInteger(to)) return;
        for (const socket of roomSockets(roomId)) {
          const target = socketUser.get(socket);
          if (target?.id === to && socket.readyState === socket.OPEN) socket.send(payload);
        }
        return;
      }

      // ---------- طلب حالة المكالمات ----------
      if (type === "call-state") {
        const roomId = Number(msg.roomId);
        if (subscribed.has(roomId)) {
          send({ t: "call-state", roomId, users: roomPresence(roomId) });
        }
        return;
      }
    }

      ws.on("error", () => { /* يُعالج عبر close */ });
    });
  });

  // Ping keepalive
  const interval = setInterval(() => {
    for (const ws of socketUser.keys()) {
      if (ws.isAlive === false) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30000);
  interval.unref();

  return wss;
}

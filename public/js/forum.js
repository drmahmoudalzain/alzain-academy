// المنتدى — دردشة لحظية (WebSocket) + صوت وفيديو (WebRTC)
(function () {
  "use strict";

  const cfg = window.FORUM_CONFIG || {};
  const activeRoomId = cfg.activeRoomId;
  const CURRENT_USER_ID = cfg.currentUserId;
  const CURRENT_USER_NAME = cfg.currentUserName;

  const $ = (sel, scope = document) => scope.querySelector(sel);
  const $$ = (sel, scope = document) => [...scope.querySelectorAll(sel)];

  const messagesEl = $("#messagesList");
  const inputEl = $("#messageInput");
  const countEl = $("#charCount");
  const composer = $("#composerForm");
  const presenceEl = $("#presenceCount");
  const messageCountEl = $("#messageCount");
  const emptyEl = $("#messagesEmpty");
  const activeRoomNameEl = $("#activeRoomName");

  if (!activeRoomId) return;

  // ==================================================
  // WebSocket
  // ==================================================
  let ws = null;
  let joined = false;
  const pending = [];

  function wsConnect() {
    const proto = location.protocol === "https:" ? "wss://" : "ws://";
    ws = new WebSocket(proto + location.host + "/ws/chat");

    ws.addEventListener("open", () => {
      send({ t: "join", roomId: activeRoomId });
    });

    ws.addEventListener("message", (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      handleSocketMessage(msg);
    });

    ws.addEventListener("close", () => {
      joined = false;
      // إعادة الاتصال بعد 3 ثوانٍ
      window.setTimeout(wsConnect, 3000);
    });
  }

  function send(obj) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
      return true;
    }
    return false;
  }

  // ==================================================
  // عرض الرسائل
  // ==================================================
  let lastDay = null;
  let maxMessageId = 0;
  const rendered = new Set();

  function dayLabel(date) {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(Date.now() - 86400000);
    const same = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (same(d, today)) return "اليوم";
    if (same(d, yesterday)) return "أمس";
    return new Intl.DateTimeFormat("ar", { calendar: "gregory", numberingSystem: "latn", day: "numeric", month: "long", year: "numeric" }).format(d);
  }

  function formatTime(date) {
    return new Intl.DateTimeFormat("ar", { calendar: "gregory", numberingSystem: "latn", hour: "2-digit", minute: "2-digit" }).format(new Date(date));
  }

  function dayKeyOf(date) {
    return new Date(date).toDateString();
  }

  function scrollToBottom(force) {
    if (!messagesEl) return;
    const nearBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 120;
    if (force || nearBottom) messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function ensureDaySeparator(date) {
    const key = dayKeyOf(date);
    if (key === lastDay) return;
    lastDay = key;
    const sep = document.createElement("div");
    sep.className = "forum-day-sep";
    sep.textContent = dayLabel(date);
    messagesEl.appendChild(sep);
  }

  function appendMessage(msg, scroll) {
    if (!messagesEl) return;
    if (msg.id && rendered.has(msg.id)) return;
    if (msg.id) rendered.add(msg.id);
    if (msg.id && msg.id > maxMessageId) maxMessageId = msg.id;

    emptyEl && (emptyEl.hidden = true);
    ensureDaySeparator(msg.createdAt || new Date());

    const article = document.createElement("article");
    article.className = "forum-msg" + (msg.userId === CURRENT_USER_ID || msg.isMe ? " mine" : "");

    const avatar = document.createElement("div");
    avatar.className = "forum-msg-avatar";
    avatar.textContent = (msg.name || "؟").trim().charAt(0);

    const bubble = document.createElement("div");
    bubble.className = "forum-msg-bubble";

    const meta = document.createElement("div");
    meta.className = "forum-msg-meta";
    const nameSpan = document.createElement("span");
    nameSpan.className = "forum-msg-name";
    nameSpan.textContent = msg.name || "مجهول";
    const time = document.createElement("time");
    time.className = "forum-msg-time";
    time.textContent = formatTime(msg.createdAt || new Date());
    meta.append(nameSpan, time);

    const text = document.createElement("div");
    text.className = "forum-msg-text";
    text.textContent = msg.body;

    bubble.append(meta, text);
    article.append(avatar, bubble);
    messagesEl.appendChild(article);
    if (messageCountEl && maxMessageId) messageCountEl.textContent = String(rendered.size);
    scrollToBottom(scroll);
  }

  function handleSocketMessage(msg) {
    switch (msg.t) {
      case "joined": {
        joined = true;
        // امسح وعرض التاريخ
        if (messagesEl) {
          messagesEl.querySelectorAll(".forum-msg, .forum-day-sep").forEach((el) => el.remove());
          emptyEl && (emptyEl.hidden = true);
        }
        lastDay = null;
        rendered.clear();
        maxMessageId = 0;
        for (const m of msg.messages || []) appendMessage(m, true);
        updatePresence(msg.users || []);
        if (!(msg.messages || []).length && emptyEl) emptyEl.hidden = false;
        return;
      }
      case "msg": {
        appendMessage(msg.message, false);
        return;
      }
      case "users": {
        if (msg.roomId === activeRoomId) updatePresence(msg.users || []);
        return;
      }
      case "signal": {
        handleSignal(msg.from, msg.signal);
        return;
      }
      case "error": {
        console.warn("[forum]", msg.error);
        return;
      }
      default:
        return;
    }
  }

  function updatePresence(users) {
    if (presenceEl) presenceEl.textContent = String(users.length);
    // خزّن قائمة المتصلين لاستخدامها عند بدء المكالمة
    window.FORUM_PRESENCE = users;
  }

  // ==================================================
  // صندوق الكتابة
  // ==================================================
  if (inputEl) {
    inputEl.addEventListener("input", () => {
      countEl.textContent = String(inputEl.value.length);
      inputEl.style.height = "auto";
      inputEl.style.height = Math.min(160, inputEl.scrollHeight) + "px";
    });

    inputEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        if (inputEl.value.trim()) composer.requestSubmit();
      }
    });
  }

  if (composer) {
    composer.addEventListener("submit", (event) => {
      const body = (inputEl.value || "").trim();
      if (!body) {
        event.preventDefault();
        return;
      }
      // الإرسال عبر WebSocket (أسرع) — مع منع إرسال POS التكراري
      if (send({ t: "msg", roomId: activeRoomId, text: body })) {
        event.preventDefault();
        inputEl.value = "";
        countEl.textContent = "0";
        inputEl.style.height = "auto";
      }
      // وإلا سيسقط للإجراء الافتراضي (POST)
    });
  }

  // ==================================================
  // WebRTC: صوت وفيديو (Mesh)
  // ==================================================
  const RTC_CONFIG = { iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }] };

  const callOverlay = $("#callOverlay");
  const videoGrid = $("#videoGrid");
  const callRoomNameEl = $("#callRoomName");
  const callCountEl = $("#callCount");
  const callLeaveBtn = $("#callLeaveBtn");
  const toggleMicBtn = $("#toggleMicBtn");
  const toggleCamBtn = $("#toggleCamBtn");
  const voiceCallBtn = $("#voiceCallBtn");
  const videoCallBtn = $("#videoCallBtn");

  let localStream = null;
  let inCall = false;
  let callType = null; // 'voice' | 'video'
  const peers = new Map(); // userId -> { pc, tile, remoteStream }

  function createTile(userId, name, isLocal) {
    const tile = document.createElement("div");
    tile.className = "video-tile" + (isLocal ? " local" : "");
    tile.dataset.userId = String(userId);

    const placeholder = document.createElement("div");
    placeholder.className = "video-tile-placeholder";
    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = (name || "؟").trim().charAt(0);
    const label = document.createElement("div");
    label.textContent = isLocal ? "أنت" : name;
    placeholder.append(avatar, label);
    tile.appendChild(placeholder);

    const video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true;
    if (isLocal) video.muted = true;
    tile.appendChild(video);

    const nameTag = document.createElement("span");
    nameTag.className = "video-tile-name";
    nameTag.textContent = isLocal ? CURRENT_USER_NAME + " (أنت)" : name;
    tile.appendChild(nameTag);

    videoGrid.appendChild(tile);
    return { tile, video, placeholder };
  }

  function removeTile(userId) {
    const peer = peers.get(userId);
    if (peer?.tile?.parentNode) peer.tile.remove();
    peers.delete(userId);
    if (callCountEl) callCountEl.textContent = String(peers.size + 1);
  }

  async function startCall(type) {
    if (inCall) return;
    callType = type;
    const wantVideo = type === "video";

    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: wantVideo ? { width: { ideal: 640 }, height: { ideal: 360 } } : false,
      });
    } catch (error) {
      alert("تعذر الوصول إلى الميكروفون/الكاميرا: " + (error?.message || "صلاحية مرفوضة"));
      return;
    }

    inCall = true;
    callOverlay.hidden = false;
    callRoomNameEl.textContent = activeRoomNameEl ? activeRoomNameEl.textContent : "مكالمة المنتدى";
    videoGrid.innerHTML = "";
    peers.clear();

    const local = createTile(CURRENT_USER_ID, CURRENT_USER_NAME, true);
    local.video.srcObject = localStream;
    updateCallCount();

    toggleMicBtn.setAttribute("aria-pressed", "true");
    toggleCamBtn.setAttribute("aria-pressed", String(wantVideo));
    toggleCamBtn.style.display = wantVideo ? "grid" : "none";

    // أخبر بقية أعضاء الغرفة ببدء المكالمة (ليبثق إشعار عندهم)
    send({ t: "signal", roomId: activeRoomId, to: -1, signal: { kind: "call-invite", callType: type, fromName: CURRENT_USER_NAME } });
  }

  function updateCallCount() {
    if (callCountEl) callCountEl.textContent = String(peers.size + 1);
  }

  async function joinPeer(userId, name) {
    if (!localStream) return;
    if (peers.has(userId)) return;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    const remoteStream = new MediaStream();
    const tile = createTile(userId, name, false);
    tile.video.srcObject = remoteStream;

    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => remoteStream.addTrack(track));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        send({ t: "signal", roomId: activeRoomId, to: userId, signal: { kind: "ice", candidate: event.candidate } });
      }
    };

    pc.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) removeTile(userId);
    };

    peers.set(userId, { pc, tile, remoteStream });
    updateCallCount();

    // المبادر ينشئ offer
    if (CURRENT_USER_ID < userId) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send({ t: "signal", roomId: activeRoomId, to: userId, signal: { kind: "offer", sdp: pc.localDescription } });
    }
  }

  async function handleSignal(from, signal) {
    if (!signal || typeof signal !== "object") return;

    if (signal.kind === "call-invite") {
      // إشعار بمكالمة واردة — اطلب الانضمام من المستخدم
      if (inCall) return; // مشارك بالفعل
      const accept = window.confirm(`مكالمة ${signal.callType === "video" ? "فيديو" : "صوتية"} بدأها ${signal.fromName || "عضو"} — هل تريد الانضمام؟`);
      if (!accept) return;
      await startCall(signal.callType === "video" ? "video" : "voice");
      return;
    }

    if (signal.kind === "offer" || signal.kind === "answer" || signal.kind === "ice") {
      // هذه إشارات WebRTC — تحتاج أن تكون في مكالمة وتملك وسائط
      if (!localStream) {
        // انضم تلقائياً بالميكروفون فقط عند وجود offer
        if (signal.kind === "offer") await startCall("voice");
        if (!localStream) return;
      }
      let peer = peers.get(from);
      if (signal.kind === "offer") {
        const name = (window.FORUM_PRESENCE || []).find((u) => u.id === from)?.name || "عضو";
        await joinPeer(from, name);
        peer = peers.get(from);
        await peer.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answer);
        send({ t: "signal", roomId: activeRoomId, to: from, signal: { kind: "answer", sdp: peer.pc.localDescription } });
      } else if (signal.kind === "answer" && peer) {
        await peer.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      } else if (signal.kind === "ice" && peer) {
        try {
          await peer.pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch {
          // قد تفشل المرشحات — طبيعي
        }
      }
    }
  }

  function leaveCall() {
    if (!inCall) return;
    inCall = false;

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      localStream = null;
    }
    for (const [userId, peer] of [...peers]) {
      try { peer.pc.close(); } catch { /* ignore */ }
      removeTile(userId);
    }
    peers.clear();
    callOverlay.hidden = true;

    // أخبر الغرفة بمغادرة المكالمة
    send({ t: "signal", roomId: activeRoomId, to: -1, signal: { kind: "call-leave", from: CURRENT_USER_ID } });
    toggleMicBtn.setAttribute("aria-pressed", "true");
    toggleCamBtn.setAttribute("aria-pressed", "true");
  }

  // أزرار التحكم
  voiceCallBtn?.addEventListener("click", () => startCall("voice"));
  videoCallBtn?.addEventListener("click", () => startCall("video"));
  callLeaveBtn?.addEventListener("click", leaveCall);

  toggleMicBtn?.addEventListener("click", () => {
    if (!localStream) return;
    const track = localStream.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    toggleMicBtn.setAttribute("aria-pressed", String(track.enabled));
  });

  toggleCamBtn?.addEventListener("click", () => {
    if (!localStream) return;
    const track = localStream.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    toggleCamBtn.setAttribute("aria-pressed", String(track.enabled));
  });

  // ==================================================
  // الاتصال
  // ==================================================
  wsConnect();
})();

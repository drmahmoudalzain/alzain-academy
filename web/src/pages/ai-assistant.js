import { boot } from "../lib/portal.js";
import { supabase } from "../lib/supabase.js";
import { call } from "../lib/api.js";
import { esc, fmtDateTime } from "../lib/fmt.js";
import { icon } from "../lib/icons.js";

const MAX_CHARS = 8000;

boot({
  portals: ["student", "teacher", "assistant", "owner"],
  title: "المساعد الذكي",
  render: async ({ profile, content }) => {
    content.classList.add("ai-content");

    const $ = (id) => document.getElementById(id);
    const el = {
      status: $("aiStatus"),
      warning: $("aiWarning"),
      overlay: $("aiOverlay"),
      sidebar: $("aiSidebar"),
      historyBtn: $("historyBtn"),
      modelBadge: $("aiModelBadge"),
      history: $("aiHistory"),
      suggestions: $("aiSuggestions"),
      quick: $("aiQuick"),
      newChat: $("newChatBtn"),
      clear: $("clearHistoryBtn"),
      log: $("chatLog"),
      welcome: $("welcomeState"),
      form: $("chatForm"),
      input: $("chatInput"),
      send: $("sendBtn"),
      count: $("charCount"),
      toasts: $("aiToasts"),
    };

    document.querySelectorAll("[data-icon]").forEach((node) => {
      node.innerHTML = icon(node.dataset.icon);
    });

    const state = {
      activeId: null,
      messages: [],
      sending: false,
      typing: null,
      // ai_public_settings() لا يعرف Secret البيئة؛ ai-chat هو المصدر النهائي.
      settings: { model: "", enabled: false },
      configured: true,
    };

    const toast = (message, type = "info") => {
      const node = document.createElement("div");
      node.className = `ai-toast ${type}`;
      node.innerHTML = `${icon(type === "success" ? "check" : type === "danger" ? "close" : "sparkles")}<span>${esc(message)}</span>`;
      el.toasts.appendChild(node);
      setTimeout(() => {
        node.classList.add("hide");
        setTimeout(() => node.remove(), 300);
      }, 2800);
    };

    const errText = (e) => String(e?.message || e?.error || e || "حدث خطأ غير متوقع");
    const scrollDown = () => {
      el.log.scrollTop = el.log.scrollHeight;
    };

    /* -------------------------------------------------- */
    /* درج المحادثات                                       */
    /* -------------------------------------------------- */
    const closeDrawer = () => {
      el.sidebar.classList.remove("open");
      el.overlay.hidden = true;
      el.historyBtn.setAttribute("aria-expanded", "false");
    };
    el.historyBtn.addEventListener("click", () => {
      const open = !el.sidebar.classList.contains("open");
      el.sidebar.classList.toggle("open", open);
      el.overlay.hidden = !open;
      el.historyBtn.setAttribute("aria-expanded", String(open));
    });
    el.overlay.addEventListener("click", closeDrawer);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDrawer();
    });

    /* -------------------------------------------------- */
    /* عرض الرسائل                                         */
    /* -------------------------------------------------- */
    const inline = (text) =>
      esc(text)
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/`([^`]+)`/g, "<code>$1</code>");

    const renderText = (text) =>
      String(text || "")
        .trim()
        .split(/\n\s*\n/)
        .filter(Boolean)
        .map((block) => {
          const lines = block.split("\n");
          if (lines.every((line) => /^\s*[-•*]\s+/.test(line))) {
            return `<ul>${lines
              .map((line) => `<li>${inline(line.replace(/^\s*[-•*]\s+/, ""))}</li>`)
              .join("")}</ul>`;
          }
          return `<p>${lines.map(inline).join("<br>")}</p>`;
        })
        .join("");

    const normalize = (msg) => ({
      ...msg,
      role: msg.role === "assistant" ? "ai" : msg.role,
    });

    const makeMessage = (msg) => {
      const isUser = msg.role === "user";
      const wrap = document.createElement("div");
      wrap.className = `ai-message ${isUser ? "user" : "ai"}`;
      const avatar = isUser
        ? esc((profile?.name || "ط").trim().charAt(0))
        : icon("sparkles");
      const name = isUser ? profile?.name || "أنت" : "المساعد القانوني";
      wrap.innerHTML = `
        <div class="ai-msg-avatar">${avatar}</div>
        <div class="ai-msg-body">
          <div class="ai-msg-meta"><strong>${esc(name)}</strong><span>${esc(fmtDateTime(msg.created_at))}</span></div>
          <div class="ai-msg-bubble">${renderText(msg.content)}</div>
          ${isUser ? "" : '<div class="ai-msg-actions"></div>'}
        </div>`;
      if (!isUser) {
        const copy = document.createElement("button");
        copy.type = "button";
        copy.className = "ai-msg-action";
        copy.innerHTML = `${icon("copy")} نسخ`;
        copy.addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText(String(msg.content || ""));
            toast("تم نسخ الإجابة", "success");
          } catch {
            toast("تعذّر نسخ الإجابة من هذا المتصفح", "warning");
          }
        });
        wrap.querySelector(".ai-msg-actions").appendChild(copy);
      }
      return wrap;
    };

    const markLastAssistant = () => {
      el.log.querySelectorAll(".ai-msg-action.regenerate").forEach((b) => b.remove());
      const last = [...el.log.querySelectorAll(".ai-message.ai")].pop();
      if (!last || state.messages[state.messages.length - 1]?.role !== "ai") return;
      const actions = last.querySelector(".ai-msg-actions");
      if (!actions) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ai-msg-action regenerate";
      btn.innerHTML = `${icon("refresh")} إعادة التوليد`;
      btn.addEventListener("click", regenerate);
      actions.appendChild(btn);
    };

    const appendMessage = (msg) => {
      const row = normalize(msg);
      state.messages.push(row);
      el.welcome.hidden = true;
      el.log.appendChild(makeMessage(row));
      markLastAssistant();
      scrollDown();
    };

    const appendNotice = (text) => {
      const node = document.createElement("div");
      node.className = "ai-notice";
      node.innerHTML = `${icon("close")}<span>${esc(text)}</span>`;
      el.log.appendChild(node);
      scrollDown();
    };

    const showTyping = () => {
      if (state.typing) return;
      const node = document.createElement("div");
      node.className = "ai-typing";
      node.setAttribute("role", "status");
      node.setAttribute("aria-label", "المساعد يكتب إجابة");
      node.innerHTML = "<i></i><i></i><i></i>";
      el.log.appendChild(node);
      state.typing = node;
      scrollDown();
    };

    const hideTyping = () => {
      state.typing?.remove();
      state.typing = null;
    };

    const renderMessages = (rows) => {
      state.messages = rows.map(normalize);
      el.log.innerHTML = "";
      if (!state.messages.length) {
        el.welcome.hidden = false;
        return;
      }
      el.welcome.hidden = true;
      state.messages.forEach((m) => el.log.appendChild(makeMessage(m)));
      markLastAssistant();
      scrollDown();
    };

    /* -------------------------------------------------- */
    /* سجل المحادثات                                       */
    /* -------------------------------------------------- */
    const renderHistory = async () => {
      const res = await call("ai_conversations");
      if (!res.ok) {
        el.history.innerHTML = `<div class="ai-history-empty">تعذّر تحميل المحادثات السابقة.</div>`;
        return;
      }
      const rows = Array.isArray(res.data) ? res.data : [];
      if (!rows.length) {
        el.history.innerHTML = `<div class="ai-history-empty">لا توجد محادثات سابقة. ابدأ محادثة جديدة من الأسفل.</div>`;
        return;
      }
      el.history.innerHTML = rows
        .map(
          (c) => `<div class="ai-history-item${c.id === state.activeId ? " active" : ""}" data-id="${esc(c.id)}">
            <button type="button" class="ai-history-open" title="${esc(c.last_message || "")}">
              ${icon("history")}<span>${esc(c.title || "محادثة")}</span>
            </button>
            <button type="button" class="ai-history-del" aria-label="حذف المحادثة">${icon("trash")}</button>
          </div>`
        )
        .join("");
    };

    el.history.addEventListener("click", async (e) => {
      const item = e.target.closest(".ai-history-item");
      if (!item) return;
      const id = Number(item.dataset.id);
      if (e.target.closest(".ai-history-del")) {
        const res = await call("ai_delete_conversation", { p_conversation_id: id });
        if (!res.ok) {
          toast(errText(res), "danger");
          return;
        }
        if (state.activeId === id) newChat();
        await renderHistory();
        toast("تم حذف المحادثة", "success");
        return;
      }
      if (state.sending) return;
      const res = await call("ai_conversation_messages", { p_conversation_id: id });
      if (!res.ok || !(Array.isArray(res.data) ? res.data.length : 0)) {
        toast(errText(res) || "تعذّر فتح المحادثة", "danger");
        return;
      }
      state.activeId = id;
      renderMessages(res.data);
      await renderHistory();
      closeDrawer();
    });

    const newChat = () => {
      state.activeId = null;
      state.messages = [];
      el.log.innerHTML = "";
      el.welcome.hidden = false;
      renderHistory();
      closeDrawer();
      el.input.focus();
    };
    el.newChat.addEventListener("click", newChat);

    const clearOriginal = el.clear.innerHTML;
    let confirmingClear = false;
    let clearTimer = null;
    const resetClear = () => {
      confirmingClear = false;
      clearTimeout(clearTimer);
      el.clear.classList.remove("confirm");
      el.clear.innerHTML = clearOriginal;
    };
    el.clear.addEventListener("click", async () => {
      if (!confirmingClear) {
        confirmingClear = true;
        el.clear.classList.add("confirm");
        el.clear.textContent = "اضغط مرة أخرى لتأكيد الحذف";
        clearTimer = setTimeout(resetClear, 4000);
        return;
      }
      resetClear();
      const res = await call("ai_clear_history");
      if (!res.ok) {
        toast(errText(res), "danger");
        return;
      }
      newChat();
      toast("تم حذف كل المحادثات", "success");
    });

    /* -------------------------------------------------- */
    /* الإدخال                                             */
    /* -------------------------------------------------- */
    const updateCount = () => {
      el.count.textContent = `${el.input.value.length} / ${MAX_CHARS}`;
    };
    const autoSize = () => {
      el.input.style.height = "auto";
      el.input.style.height = `${Math.min(el.input.scrollHeight, 150)}px`;
    };
    const setPrompt = (text) => {
      el.input.value = text;
      updateCount();
      autoSize();
      closeDrawer();
      el.input.focus();
    };

    document.querySelectorAll("[data-prompt]").forEach((btn) => {
      btn.addEventListener("click", () => setPrompt(btn.dataset.prompt));
    });
    el.input.addEventListener("input", () => {
      updateCount();
      autoSize();
    });
    el.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        el.form.requestSubmit();
      }
    });

    const disableComposer = () => {
      el.send.disabled = true;
      el.input.placeholder = "المساعد غير مُفعّل بعد";
    };

    /* -------------------------------------------------- */
    /* استدعاء المساعد                                     */
    /* -------------------------------------------------- */
    const askAI = async () => {
      if (!state.configured) {
        appendNotice("المساعد غير مُفعّل بعد. تواصل مع الإدارة لإضافة مفتاح الخدمة.");
        return;
      }
      showTyping();
      try {
        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;
        if (!token) throw new Error("انتهت جلستك، سجّل الدخول من جديد.");

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ conversationId: state.activeId }),
          }
        );
        const body = await res.json().catch(() => ({}));
        hideTyping();

        if (!res.ok || body.ok !== true) {
          appendNotice(body?.message || "تعذّر الحصول على إجابة. حاول مرة أخرى.");
          if (body?.error === "ai_not_configured") {
            state.configured = false;
            el.status.textContent = "غير مُفعّل";
            el.status.classList.add("off");
            el.warning.hidden = false;
            disableComposer();
          }
          return;
        }
        state.configured = true;
        el.status.textContent = "مفعّل";
        el.status.classList.remove("off");
        el.warning.hidden = true;
        appendMessage(body.message);
      } catch (err) {
        hideTyping();
        appendNotice(errText(err));
        toast(errText(err), "danger");
      } finally {
        markLastAssistant();
        scrollDown();
        await renderHistory();
      }
    };

    el.form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (state.sending) return;
      const text = el.input.value.trim();
      if (!text) return;

      state.sending = true;
      el.send.disabled = true;
      el.welcome.hidden = true;
      try {
        if (!state.activeId) {
          const created = await call("ai_create_conversation", {
            p_title: text.slice(0, 60),
          });
          if (!created.ok) throw new Error(created.error);
          state.activeId = Number(created.data);
          await renderHistory();
        }
        const added = await call("ai_append_user_message", {
          p_conversation_id: state.activeId,
          p_content: text,
        });
        if (!added.ok) throw new Error(added.error);
        const row = Array.isArray(added.data) ? added.data[0] : added.data;
        appendMessage(row);
        el.input.value = "";
        updateCount();
        autoSize();
        await askAI();
      } catch (err) {
        appendNotice(errText(err));
        toast(errText(err), "danger");
      } finally {
        state.sending = false;
        el.send.disabled = !state.configured;
        el.input.focus();
      }
    });

    async function regenerate() {
      if (state.sending || !state.activeId) return;
      const last = state.messages[state.messages.length - 1];
      if (!last || last.role !== "ai") return;

      const res = await call("ai_delete_last_assistant_message", {
        p_conversation_id: state.activeId,
      });
      if (!res.ok) {
        toast(errText(res), "danger");
        return;
      }
      state.messages.pop();
      const nodes = el.log.querySelectorAll(".ai-message.ai");
      nodes[nodes.length - 1]?.remove();

      state.sending = true;
      el.send.disabled = true;
      try {
        await askAI();
      } finally {
        state.sending = false;
        el.send.disabled = !state.configured;
      }
    }

    /* -------------------------------------------------- */
    /* التحميل                                             */
    /* -------------------------------------------------- */
    try {
      const res = await call("ai_public_settings");
      const settings = Array.isArray(res.data) ? res.data[0] : res.data;
      state.settings = {
        model: settings?.model || "gemini",
        enabled: settings?.enabled === true,
      };
      el.modelBadge.textContent = state.settings.model;
      el.status.textContent = state.settings.enabled ? "مفعّل" : "غير مُفعّل";
      el.status.classList.toggle("off", !state.settings.enabled);
      el.warning.hidden = state.settings.enabled;
      await renderHistory();
      updateCount();
    } catch (err) {
      el.status.textContent = "تعذّر التحميل";
      el.status.classList.add("off");
      toast(errText(err), "danger");
    }
  },
});

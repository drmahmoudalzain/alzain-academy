import express from "express";
import { db } from "./supabase.js";
import { renderPage } from "./render.js";
import { requireAuth } from "../middleware/auth.js";
import { PORTALS, primaryPortal } from "./portals.js";
import { getSettings } from "./settings.js";

/** المساعد الذكي — واجهة محادثة قانونية مع Gemini عند تفعيل المفتاح في الإعدادات. */
export function createAssistantRouter() {
  const router = express.Router();
  router.use(requireAuth);

  async function loadHistory(userId) {
    const { data, error } = await db
      .from("ai_messages")
      .select("id, role, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) throw error;
    return (data ?? []).reverse();
  }

  router.get("/", async (req, res, next) => {
    try {
      const settings = await getSettings();
      const portalKey = await primaryPortal(req.user);
      const history = await loadHistory(req.user.id);
      return renderPage(res, "assistant/index", {
        layout: "portal",
        portal: PORTALS[portalKey],
        title: "المساعد الذكي",
        pageTitle: "المساعد الذكي",
        history,
        assistantReady: Boolean(settings.ai_api_key),
        model: settings.ai_model || "gemini-2.5-flash",
        provider: settings.ai_provider || "gemini",
        error: null,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      const settings = await getSettings();
      const portalKey = await primaryPortal(req.user);
      const prompt = String(req.body.message ?? "").trim();

      if (!prompt) return res.redirect("/assistant");

      // خزّن رسالة المستخدم
      const inserted = await db.from("ai_messages").insert({
        user_id: req.user.id,
        role: "user",
        content: prompt,
      });
      if (inserted.error) throw inserted.error;

      let reply;
      if (!settings.ai_api_key) {
        reply = "المساعد الذكي غير مُفعّل حالياً. يمكن للمالك تفعيله من صفحة الإعدادات بإدخال مفتاح Gemini (Google AI) — وبعدها ستتمكن من طرح أي سؤال قانوني عليّ بشكل فوري.";
      } else {
        const systemInstruction = [
          "أنت مساعد قانوني أكاديمي في «أكاديمية آل الزين للعلوم القانونية والعدلية».",
          "أجب باللغة العربية بأسلوب أكاديمي دقيق ومختصر.",
          "التزم بتخصصات الأكاديمية: القانون العام، القانون الخاص، القانون الدولي، الفقه الإسلامي.",
          "إن كانت المعلومة غير مؤكدة، صرّح بذلك بدلاً من جزافية الجواب.",
          "لا تقدم رأياً قانونياً نهائياً عن قضية فردية ولا تُنوب القاضي أو الأستاذ.",
        ].join("\n");

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          settings.ai_model || "gemini-2.5-flash"
        )}:generateContent?key=${encodeURIComponent(settings.ai_api_key)}`;

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents: [{ role: "user", parts: [{ text: prompt }] }],
          }),
        });

        if (!response.ok) {
          const detail = await response.text();
          console.error("Gemini error:", response.status, detail.slice(0, 300));
          reply = "تعذر الاتصال بالمساعد الذكي مؤقتاً. حاول مرة أخرى، وإن تكرر الخطأ راجع إعدادات المالك.";
        } else {
          const data = await response.json();
          reply =
            data?.candidates?.[0]?.content?.parts?.map((part) => part.text).join("\n") ??
            "لم أتمكن من توليد إجابة. حاول إعادة صياغة سؤالك.";
        }
      }

      // خزّن رد المساعد
      const saved = await db.from("ai_messages").insert({
        user_id: req.user.id,
        role: "assistant",
        content: reply,
      });
      if (saved.error) throw saved.error;

      return res.redirect("/assistant");
    } catch (error) {
      next(error);
    }
  });

  return router;
}

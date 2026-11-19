import http from "node:http";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./src/lib/env.js";
import { attachUser, loadSettings } from "./src/middleware/auth.js";
import { renderPage } from "./src/lib/render.js";
import { attachChatServer } from "./src/lib/chat-ws.js";
import authRouter from "./src/routes/auth.js";
import ownerRouter from "./src/routes/owner.js";
import teacherRouter from "./src/routes/teacher.js";
import studentRouter from "./src/routes/student.js";
import forumRouter from "./src/routes/forum.js";
import { createNotificationsRouter } from "./src/lib/notifications.js";
import { createAssistantRouter } from "./src/lib/assistant.js";
import { createLibraryRouter } from "./src/lib/library.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  next();
});

app.use(express.urlencoded({ extended: false, limit: "100kb" }));

// حماية أساسية من CSRF: رفض الطلبات المعدِّلة القادمة من أصل مختلف.
app.use((req, res, next) => {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();

  const origin = req.get("origin");
  if (!origin) return next();

  try {
    if (new URL(origin).host !== req.get("host")) {
      return res.status(403).type("text/plain").send("طلب غير موثوق: أصل مختلف.");
    }
  } catch {
    return res.status(403).type("text/plain").send("طلب غير موثوق.");
  }

  next();
});

app.use(
  express.static(path.join(__dirname, "public"), {
    maxAge: env.NODE_ENV === "production" ? "7d" : 0,
  })
);

app.use(attachUser);
app.use(loadSettings);

app.use("/", authRouter);
app.use("/owner", ownerRouter);
app.use("/teacher", teacherRouter);
app.use("/student", studentRouter);
app.use("/forum", forumRouter);
app.use("/notifications", createNotificationsRouter());
app.use("/assistant", createAssistantRouter());
app.use("/library", createLibraryRouter());

app.use((req, res) => {
  res.status(404);
  renderPage(res, "error", {
    title: "الصفحة غير موجودة",
    layout: "auth",
    code: 404,
    message: "الصفحة التي تبحث عنها غير موجودة أو تم نقلها.",
  }).catch((error) => {
    console.error(error);
    res.type("text/plain").send("404 — الصفحة غير موجودة");
  });
});

app.use((error, req, res, _next) => {
  console.error("خطأ غير متوقع:", error);
  if (res.headersSent) return;
  if (String(error?.message ?? "").includes("invalid input syntax for type bigint")) {
    return renderPage(res.status(400), "error", {
      title: "طلب غير صالح",
      layout: "auth",
      code: 400,
      message: "معرّف رقمي غير صحيح في الطلب.",
    }).catch(() => res.type("text/plain").send("400 — طلب غير صالح"));
  }
  res.status(500);
  renderPage(res, "error", {
    title: "خطأ في الخادم",
    layout: "auth",
    code: 500,
    message: "حدث خطأ غير متوقع. حاول مرة أخرى، وإن تكرر الخطأ راجع إدارة المنصة.",
  }).catch(() => {
    res.type("text/plain").send("500 — خطأ في الخادم");
  });
});

const httpServer = http.createServer(app);
attachChatServer(httpServer);

httpServer.listen(env.PORT, () => {
  console.log(`✅ منصة آل الزين تعمل على http://localhost:${env.PORT}`);
});

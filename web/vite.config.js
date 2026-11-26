import { defineConfig, loadEnv } from "vite";
import { resolve, relative } from "node:path";
import { readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

// يكتشف كل صفحات HTML (الجذر + مجلد pages) تلقائياً، فلا حاجة لتسجيل كل صفحة يدوياً.
function htmlInputs(root) {
  const input = {};
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name.startsWith(".") || ["node_modules", "dist", "public"].includes(name)) continue;
      const full = resolve(dir, name);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (name.endsWith(".html")) {
        const key = relative(root, full)
          .replace(/\\/g, "/")
          .replace(/\.html$/, "")
          .replace(/\//g, "-") || "index";
        input[key || "index"] = full;
      }
    }
  };
  walk(root);
  return input;
}

const ANON_KEY_ERROR = "VITE_SUPABASE_ANON_KEY missing or invalid: only the public anon key is allowed";

// فحص الحمولة فقط: لا توقيع ولا مفتاح سري في المتصفح. أي JWT بدور غير anon يُرفض،
// حتى لو لم يبدأ بـ sb_secret_، فلا يُضمَّن مفتاح service_role في الحزمة.
export function assertPublicAnonKey(anonKey) {
  if (!anonKey || /YOUR-|example/i.test(anonKey) || anonKey.startsWith("sb_secret_")) {
    throw new Error(ANON_KEY_ERROR);
  }
  const parts = String(anonKey).split(".");
  if (parts.length !== 3 || !/^[A-Za-z0-9_-]+$/.test(parts[1])) {
    throw new Error(ANON_KEY_ERROR);
  }
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (payload?.role !== "anon") throw new Error(ANON_KEY_ERROR);
  } catch {
    throw new Error(ANON_KEY_ERROR);
  }
  return anonKey;
}

// البناء يفشل صراحةً إن غابت القيم العامة؛ لا وجود لوضع معاينة صامت في النسخة المنشورة.
export function buildConfig(env) {
  const url = env.VITE_SUPABASE_URL;

  if (!url || !/^https:\/\/.+\.supabase\.co\/?$/.test(url) || /YOUR-|example/i.test(url)) {
    throw new Error("VITE_SUPABASE_URL missing or invalid: a valid Supabase project URL is required to build");
  }
  const anonKey = assertPublicAnonKey(env.VITE_SUPABASE_ANON_KEY);

  return {
    base: "/alzain-academy/",
    publicDir: "public",
    build: {
      outDir: "dist",
      rollupOptions: {
        input: htmlInputs(rootDir),
      },
    },
    server: { port: 5173, open: true },
  };
}

export default defineConfig(({ mode }) => buildConfig(loadEnv(mode, rootDir, "VITE_")));

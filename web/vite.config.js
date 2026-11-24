import { defineConfig } from "vite";
import { resolve, relative } from "node:path";
import { readdirSync, statSync } from "node:fs";

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

export default defineConfig({
  base: "/alzain-academy/",
  publicDir: "public",
  build: {
    outDir: "dist",
    rollupOptions: {
      input: htmlInputs(__dirname),
    },
  },
  server: { port: 5173, open: true },
});

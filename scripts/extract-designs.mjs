import fs from "node:fs";
import path from "node:path";

const designDir = "design";
const outViews = "public/views";
const outCss = "public/css/views";
const outJs = "public/js/views";

for (const d of [outViews, outCss, outJs]) fs.mkdirSync(d, { recursive: true });

const files = fs.readdirSync(designDir).filter((f) => f.endsWith(".html"));

for (const f of files) {
  const name = f.replace(/\.html$/, "");
  const src = fs.readFileSync(path.join(designDir, f), "utf8");

  // Extract <style>...</style> (first occurrence; designs have one)
  const styleMatch = src.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const css = styleMatch ? styleMatch[1].trim() : "";
  fs.writeFileSync(path.join(outCss, name + ".css"), css, "utf8");

  // Extract <body>...</body>
  const bodyMatch = src.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1].trim() : "";
  fs.writeFileSync(path.join(outViews, name + ".html"), body, "utf8");

  // Extract <script>...</script> (all; concatenate)
  const scripts = [...src.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1].trim())
    .filter(Boolean)
    .join("\n\n");
  fs.writeFileSync(path.join(outJs, name + ".js"), scripts, "utf8");

  console.log(`extracted: ${name} (css=${css.length}, body=${body.length}, js=${scripts.length})`);
}

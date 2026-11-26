import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { assertPublicAnonKey } from "../vite.config.js";

const webDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(webDir, "dist");
const env = loadEnv("production", webDir, "VITE_");
const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;
const failures = [];

if (!url || !anonKey) {
  failures.push("public Supabase config is missing from the build environment");
} else {
  try {
    assertPublicAnonKey(anonKey);
  } catch {
    failures.push("the configured key is not the public anon key (non-anon role)");
  }
}

function jsFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = resolve(dir, name);
    return statSync(full).isDirectory() ? jsFiles(full) : name.endsWith(".js") ? [full] : [];
  });
}

let scanned = 0;
let withUrl = 0;
if (!failures.length) {
  for (const file of jsFiles(distDir)) {
    scanned += 1;
    const source = readFileSync(file, "utf8");
    if (source.includes(url)) withUrl += 1;
    if (source.includes("الاتصال بقاعدة البيانات غير مهيأ")) {
      failures.push(`preview-only login fallback found in ${file}`);
    }
    if (source.includes("Supabase غير مهيأ")) {
      failures.push(`preview-only client fallback found in ${file}`);
    }
  }
  if (withUrl === 0) failures.push("no built asset contains the configured Supabase URL");
}

if (failures.length) {
  console.error(`deploy config check FAILED (${failures.length}):`);
  for (const failure of failures.slice(0, 10)) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(`deploy config OK: ${scanned} assets scanned, ${withUrl} contain the configured endpoint.`);

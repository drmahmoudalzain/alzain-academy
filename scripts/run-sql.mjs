// تنفيذ ملف SQL على مشروع Supabase عبر Management API
// الاستخدام: node scripts/run-sql.mjs <path/to/file.sql>
import fs from "node:fs";

const env = Object.fromEntries(
  fs
    .readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const ref = env.SUPABASE_PROJECT_REF;
const token = env.SUPABASE_ACCESS_TOKEN;
const file = process.argv[2];

if (!ref || !token) throw new Error("SUPABASE_PROJECT_REF / SUPABASE_ACCESS_TOKEN مفقودان في .env");
if (!file) throw new Error("مرّر مسار ملف SQL: node scripts/run-sql.mjs <file.sql>");

const sql = fs.readFileSync(file, "utf8");

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: sql }),
});

const text = await res.text();
console.log("HTTP", res.status);
console.log(text.slice(0, 6000));
process.exit(res.ok ? 0 : 1);

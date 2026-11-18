import fs from "node:fs";
import path from "node:path";

const dir = "public/views";
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".html"));

const replacements = [
  [/href="\/login\?role=owner"/g, 'href="#/login/owner"'],
  [/href="\/login\?role=teacher"/g, 'href="#/login/teacher"'],
  [/href="\/login\?role=student"/g, 'href="#/login/student"'],
  [/href="\/"/g, 'href="#/"'],
];

for (const f of files) {
  const p = path.join(dir, f);
  let s = fs.readFileSync(p, "utf8");
  for (const [re, to] of replacements) s = s.replace(re, to);
  fs.writeFileSync(p, s, "utf8");
  console.log("rewrote:", f);
}

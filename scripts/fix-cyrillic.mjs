import fs from "node:fs";
const p = "public/js/app.js";
let s = fs.readFileSync(p, "utf8");
// Replace Cyrillic impostors with Arabic
s = s.replace(/Зин/g, "الزين");
s = s.replace(/акадимия/g, "أكاديمية");
s = s.replace(/Акадимия/g, "أكاديمية");
fs.writeFileSync(p, s, "utf8");
console.log("done");
// verify
const left = s.match(/[А-яЁё]/g);
console.log("remaining cyrillic:", left ? left.join("") : "none");

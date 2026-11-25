import { boot } from "../../lib/portal.js";
import { supabase } from "../../lib/supabase.js";
import { esc, fmtNum } from "../../lib/fmt.js";
import { icon } from "../../lib/icons.js";

const $ = (id) => document.getElementById(id);

boot({
  portal: "owner",
  title: "الأرشيف",
  render: async () => {
    // archived courses
    $("oaCourses").innerHTML = `<div class="od-skeleton od-skeleton-row" aria-hidden="true"></div>`.repeat(3);
    const { data: courses, error } = await supabase.from("courses").select("id, title, code, teacher_id, archived").eq("archived", true).order("title");
    if (error || !courses?.length) {
      $("oaCourses").innerHTML = `<div class="od-empty" role="status"><span class="od-empty-icon">${icon("archive")}</span><h3>لا توجد مقررات مؤرشفة</h3></div>`;
    } else {
      const { data: teachers } = await supabase.from("users").select("id, name").eq("role", "teacher");
      const tMap = new Map((teachers || []).map((t) => [t.id, t.name]));
      const rows = courses.map((c) => `<tr><td>${esc(c.code || "—")}</td><td>${esc(c.title || "—")}</td><td>${esc(tMap.get(c.teacher_id) || "—")}</td></tr>`).join("");
      $("oaCourses").innerHTML = `<div class="od-table-wrap"><table class="od-table"><thead><tr><th>الرمز</th><th>المقرر</th><th>الأستاذ</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }

    // archived_records (owner-only read)
    $("oaRecords").innerHTML = `<div class="od-skeleton od-skeleton-row" aria-hidden="true"></div>`.repeat(3);
    const { data: recs, error: rErr } = await supabase.from("archived_records").select("*").order("id", { ascending: false }).limit(50);
    if (rErr || !recs?.length) {
      $("oaRecords").innerHTML = `<div class="od-empty" role="status"><span class="od-empty-icon">${icon("archive")}</span><h3>${rErr ? "تعذّر تحميل السجلات" : "لا توجد سجلات"}</h3><p>${rErr ? esc(rErr.message || "") : ""}</p></div>`;
      return;
    }
    // generic render: show keys
    const keys = Object.keys(recs[0]);
    const header = keys.map((k) => `<th>${esc(k)}</th>`).join("");
    const rows = recs.map((r) => `<tr>${keys.map((k) => `<td>${esc(String(r[k] ?? "—"))}</td>`).join("")}</tr>`).join("");
    $("oaRecords").innerHTML = `<div class="od-table-wrap"><table class="od-table"><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></div>`;
  },
});
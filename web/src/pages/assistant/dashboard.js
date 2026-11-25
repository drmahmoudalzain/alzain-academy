import { boot } from "../../lib/portal.js";
import { supabase } from "../../lib/supabase.js";
import { esc, fmtNum, fmtDateTime, rel } from "../../lib/fmt.js";
import { icon } from "../../lib/icons.js";
import { p } from "../../lib/base.js";

const $ = (id) => document.getElementById(id);

boot({
  portal: "assistant",
  title: "لوحة المساعد",
  render: async ({ profile }) => {
    $("adTitle").textContent && ($("adTitle").textContent = `أهلاً، ${String(profile?.name || "").trim().split(/\s+/)[0] || "مساعد"}`);
    $("adStats").innerHTML = `<div class="od-skeleton od-skeleton-stat"></div>`.repeat(4);
    $("adActivity").innerHTML = `<div class="od-skeleton od-skeleton-row" aria-hidden="true"></div>`.repeat(3);

    const tasks = {
      sections: supabase.from("library_sections").select("id", { count: "exact", head: true }),
      items: supabase.from("library_items").select("id", { count: "exact", head: true }),
      notifications: supabase.from("notifications").select("id, title, body, created_at").order("created_at", { ascending: false }).limit(5),
    };
    const keys = Object.keys(tasks);
    const settled = await Promise.allSettled(keys.map((k) => tasks[k]));
    const val = (k) => (settled[keys.indexOf(k)].status === "fulfilled" ? settled[keys.indexOf(k)].value : null);

    const stats = [
      { label: "أقسام المكتبة", value: val("sections")?.count },
      { label: "عناصر المكتبة", value: val("items")?.count },
    ];
    $("adStats").innerHTML = stats.map((s) => `
      <div class="od-mini">
        <span class="od-mini-icon">${icon("file")}</span>
        <span class="od-mini-body">
          <span class="od-mini-value">${esc(s.value == null ? "—" : fmtNum(s.value))}</span>
          <span class="od-mini-label">${esc(s.label)}</span>
        </span>
      </div>
    `).join("");

    const notes = val("notifications")?.data || [];
    $("adActivity").innerHTML = notes.length
      ? notes.map((n) => `<div class="od-activity"><span class="od-activity-icon">${icon("bell")}</span><span class="od-activity-body"><span class="od-activity-title">${esc(n.title || "إشعار")}</span>${n.body ? `<span class="od-activity-text">${esc(n.body)}</span>` : ""}<span class="od-activity-time">${esc(n.created_at ? fmtDateTime(n.created_at) : "")}</span></span></div>`).join("")
      : `<div class="od-empty" role="status"><span class="od-empty-icon">${icon("bell")}</span><h3>لا توجد إشعارات</h3></div>`;
  },
});
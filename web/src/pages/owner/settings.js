import { boot } from "../../lib/portal.js";
import { supabase } from "../../lib/supabase.js";
import { esc } from "../../lib/fmt.js";
import { icon } from "../../lib/icons.js";

const $ = (id) => document.getElementById(id);

boot({
  portal: "owner",
  title: "الإعدادات",
  render: async () => {
    $("osetTable").innerHTML = `<div class="od-skeleton od-skeleton-row" aria-hidden="true"></div>`.repeat(3);
    const { data, error } = await supabase.from("settings_public").select("*");
    if (error || !data?.length) {
      $("osetTable").innerHTML = `<div class="od-empty" role="status"><span class="od-empty-icon">${icon("settings")}</span><h3>${error ? "تعذّر تحميل الإعدادات" : "لا توجد إعدادات"}</h3><p>${error ? esc(error.message || "") : ""}</p></div>`;
      return;
    }
    const keys = Object.keys(data[0]);
    const header = keys.map((k) => `<th>${esc(k)}</th>`).join("");
    const rows = data.map((r) => `<tr>${keys.map((k) => `<td>${esc(String(r[k] ?? "—"))}</td>`).join("")}</tr>`).join("");
    $("osetTable").innerHTML = `<div class="od-table-wrap"><table class="od-table"><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></div>`;
  },
});
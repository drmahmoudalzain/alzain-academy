// أدوات مشتركة لصفحات بوابة الأستاذ (نوافذ، إشعارات، حالات فراغ).
// البادئة tt- لا تتعارض مع بادئات الصفحات td- / tc- / tdc-.
import { esc } from "../../lib/fmt.js";
import { icon } from "../../lib/icons.js";

// يقبل المعرّف مع أو بدون بادئة "#" (صفحة التفاصيل تستخدم الصيغة المألوفة).
export const $ = (id) => document.getElementById(String(id).replace(/^#/, ""));

export function safeColor(value, fallback = "#123A63") {
  return /^#[0-9a-fA-F]{6}$/.test(String(value || "")) ? value : fallback;
}

export function initial(name) {
  return String(name || "?").trim().charAt(0) || "?";
}

export function toast(message, tone = "success") {
  let box = $("ttToasts");
  if (!box) {
    box = document.createElement("div");
    box.id = "ttToasts";
    box.className = "tt-toasts";
    box.setAttribute("role", "status");
    document.body.appendChild(box);
  }
  const node = document.createElement("div");
  node.className = `tt-toast tt-${tone}`;
  node.innerHTML = `${icon(tone === "error" ? "close" : "check")}<span>${esc(message)}</span>`;
  box.appendChild(node);
  setTimeout(() => node.remove(), 4200);
}

export function emptyState(title, text, ico = "file") {
  return `<div class="tt-empty" role="status">
    <span class="tt-empty-icon">${icon(ico)}</span>
    <h3>${esc(title)}</h3>
    <p>${esc(text)}</p>
  </div>`;
}

export function skeleton(count = 3, kind = "card") {
  return Array.from({ length: count }, () => `<div class="tt-skeleton tt-skeleton-${kind}"></div>`).join("");
}

function fieldHtml(f) {
  const id = `ttf_${f.name}`;
  const value = f.value === null || f.value === undefined ? "" : String(f.value);
  const common = `id="${esc(id)}" name="${esc(f.name)}"${f.required ? " required" : ""}${f.dir ? ` dir="${esc(f.dir)}"` : ""}`;
  let control;
  if (f.type === "textarea") {
    control = `<textarea class="tt-input" rows="${f.rows || 3}" ${common} placeholder="${esc(f.placeholder || "")}">${esc(value)}</textarea>`;
  } else if (f.type === "select") {
    control = `<select class="tt-input" ${common}>${(f.options || [])
      .map((o) => `<option value="${esc(o.value)}"${String(o.value) === value ? " selected" : ""}>${esc(o.label)}</option>`)
      .join("")}</select>`;
  } else if (f.type === "color") {
    const colors = f.options || ["#123A63", "#166E3F", "#B5870F", "#8B5CF6", "#C73838", "#0B7C8C"];
    control = `<div class="tt-colors" ${common.replace(/^id="[^"]+"\s*/, "")} data-color-input="${esc(f.name)}">${colors
      .map((c) => `<button type="button" class="tt-color${safeColor(c) === safeColor(value) ? " selected" : ""}" data-color="${esc(c)}" style="background:${safeColor(c)}" aria-label="${esc(c)}"></button>`)
      .join("")}<input type="hidden" name="${esc(f.name)}" value="${esc(safeColor(value))}" /></div>`;
  } else {
    const step = f.step ? ` step="${esc(f.step)}"` : "";
    const min = f.min !== undefined ? ` min="${esc(f.min)}"` : "";
    const max = f.max !== undefined ? ` max="${esc(f.max)}"` : "";
    control = `<input class="tt-input" type="${esc(f.type || "text")}" value="${esc(value)}" ${common}${step}${min}${max} placeholder="${esc(f.placeholder || "")}" />`;
  }
  return `<div class="tt-field${f.fieldClass ? ` ${esc(f.fieldClass)}` : ""}"><label class="tt-label" for="${esc(id)}">${esc(f.label)}</label>${control}${f.hint ? `<small class="tt-hint">${esc(f.hint)}</small>` : ""}</div>`;
}

// نافذة نموذج موحّدة. onSubmit(values) تُعيد {ok:true} أو {ok:false, error}.
export function openForm({ title, intro = "", fields = [], submitLabel = "حفظ", onSubmit }) {
  $("ttDialog")?.remove();
  const overlay = document.createElement("div");
  overlay.className = "tt-overlay";
  overlay.id = "ttDialog";
  overlay.innerHTML = `<div class="tt-dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="tt-dialog-head">
      <h2>${esc(title)}</h2>
      <button class="tt-icon-btn" type="button" data-close aria-label="إغلاق">${icon("close")}</button>
    </div>
    ${intro ? `<p class="tt-dialog-intro">${esc(intro)}</p>` : ""}
    <form class="tt-form" novalidate>
      <div class="tt-fields">${fields.map(fieldHtml).join("")}</div>
      <p class="tt-error" data-error hidden></p>
      <div class="tt-actions">
        <button class="tt-btn tt-btn-secondary" type="button" data-close>إلغاء</button>
        <button class="tt-btn tt-btn-primary" type="submit">${esc(submitLabel)}</button>
      </div>
    </form>
  </div>`;
  document.body.appendChild(overlay);
  document.body.classList.add("tt-dialog-open");

  const close = () => {
    overlay.remove();
    document.body.classList.remove("tt-dialog-open");
  };
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.closest("[data-close]")) close();
  });
  document.addEventListener("keydown", function escKey(e) {
    if (e.key === "Escape") {
      close();
      document.removeEventListener("keydown", escKey);
    }
  });

  overlay.querySelectorAll("[data-color-input]").forEach((group) => {
    group.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-color]");
      if (!btn) return;
      group.querySelectorAll("[data-color]").forEach((b) => b.classList.toggle("selected", b === btn));
      group.querySelector("input[type=hidden]").value = btn.dataset.color;
    });
  });

  overlay.querySelector("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const values = {};
    new FormData(e.currentTarget).forEach((v, k) => { values[k] = String(v).trim(); });
    const missing = fields.find((f) => f.required && !values[f.name]);
    const error = overlay.querySelector("[data-error]");
    if (missing) {
      error.textContent = `يرجى تعبئة حقل: ${missing.label}`;
      error.hidden = false;
      return;
    }
    const submit = overlay.querySelector("button[type=submit]");
    submit.disabled = true;
    error.hidden = true;
    try {
      const res = await onSubmit(values);
      if (res && res.ok === false) {
        error.textContent = res.error || "تعذّر الحفظ";
        error.hidden = false;
      } else {
        close();
        toast(res?.message || "تم الحفظ بنجاح");
      }
    } catch (err) {
      error.textContent = String(err?.message || err);
      error.hidden = false;
    } finally {
      submit.disabled = false;
    }
  });

  overlay.querySelector("input, select, textarea")?.focus();
}

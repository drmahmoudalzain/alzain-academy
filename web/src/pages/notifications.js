import { boot } from "../lib/portal.js";
import { supabase } from "../lib/supabase.js";
import { p } from "../lib/base.js";
import { esc, fmtDate } from "../lib/fmt.js";
import { icon } from "../lib/icons.js";

const PAGE_SIZE = 15;
const PAGE_STEP = 10;

// أنواع الإشعارات — تطابق قيد notifications_type_check في قاعدة البيانات.
const TYPE_META = {
  announcement: { label: "إعلان", tab: "الإعلانات", icon: "bell" },
  course: { label: "مقرر", tab: "المقررات", icon: "book" },
  exam: { label: "اختبار", tab: "الاختبارات", icon: "exams" },
  assignment: { label: "واجب", tab: "الواجبات", icon: "assignments" },
  message: { label: "رسالة", tab: "الرسائل", icon: "forum" },
  grade: { label: "نتيجة", tab: "النتائج", icon: "grades" },
  system: { label: "نظام", tab: "النظام", icon: "settings" },
};
const TYPE_ORDER = ["announcement", "course", "exam", "assignment", "message", "grade", "system"];

const GROUPS = [
  { id: "today", title: "اليوم", icon: "calendar" },
  { id: "yesterday", title: "أمس", icon: "clock" },
  { id: "week", title: "هذا الأسبوع", icon: "calendar" },
  { id: "older", title: "أقدم", icon: "clock" },
];

/* ------------------------------------------------------------------ */
/* أدوات التاريخ                                                       */
/* ------------------------------------------------------------------ */
const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

function groupOf(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "older";
  const diff = Math.round((dayStart(new Date()) - dayStart(d)) / 86400000);
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff < 7) return "week";
  return "older";
}

// صيغة العدد العربية: مفرد / مثنى / جمع قلة / تمييز مفرد.
function arCount(n, one, two, few, many) {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return `${n} ${few}`;
  return `${n} ${many}`;
}

function relTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${arCount(mins, "دقيقة", "دقيقتين", "دقائق", "دقيقة")}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${arCount(hours, "ساعة", "ساعتين", "ساعات", "ساعة")}`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `منذ ${arCount(days, "يوم", "يومين", "أيام", "يوم")}`;
  return fmtDate(iso);
}

boot({
  portals: ["student", "teacher", "assistant", "owner"],
  title: "الإشعارات",
  render: async ({ profile }) => {
    const $ = (id) => document.getElementById(id);
    const el = {
      pill: $("unreadPill"),
      pillCount: $("unreadPillCount"),
      stats: $("notifStats"),
      statTotal: $("statTotal"),
      statUnread: $("statUnread"),
      statCourses: $("statCourses"),
      statSystem: $("statSystem"),
      tabs: $("notifTabs"),
      time: $("timeFilter"),
      list: $("notifList"),
      loadWrap: $("loadMoreWrap"),
      loadBtn: $("loadMoreBtn"),
      summary: $("toolbarSummary"),
      markAll: $("markAllReadBtn"),
      toolbarMarkRead: $("toolbarMarkRead"),
      reload: $("reloadBtn"),
      toasts: $("notifToasts"),
    };

    const state = {
      items: [],
      filter: "all",
      time: "all",
      shown: PAGE_SIZE,
      loading: true,
      error: null,
    };

    /* ------------------------------ أدوات ------------------------------ */
    const toast = (message, type = "info") => {
      const node = document.createElement("div");
      node.className = `notif-toast ${type}`;
      node.innerHTML = `${icon(type === "success" ? "check" : type === "danger" ? "close" : "bell")}<span>${esc(message)}</span>`;
      el.toasts.appendChild(node);
      setTimeout(() => {
        node.classList.add("hide");
        setTimeout(() => node.remove(), 300);
      }, 2600);
    };

    // الروابط القديمة (مسارات Express مثل /student/courses/18) لا تُعرض كزر
    // حتى تتوفر صفحاتها في الواجهة الجديدة. نقبل الروابط الخارجية وصفحات MPA.
    const resolveLink = (link) => {
      const raw = String(link || "").trim();
      if (!raw) return null;
      if (/^https?:\/\//i.test(raw)) return raw;
      if (/^(pages\/|guide\.html|index\.html|login\.html)/.test(raw)) return p(raw);
      return null;
    };

    /* ------------------------------ الإحصاءات ------------------------------ */
    const countBy = (pred) => state.items.filter(pred).length;

    const typeCounts = () => {
      const map = new Map();
      state.items.forEach((n) => map.set(n.type, (map.get(n.type) || 0) + 1));
      return map;
    };

    const renderStats = () => {
      const total = state.items.length;
      const unread = countBy((n) => !n.is_read);
      el.statTotal.innerHTML = `${total} <small>إشعار</small>`;
      el.statUnread.innerHTML = `${unread} <small>إشعار</small>`;
      el.statCourses.innerHTML = `${countBy((n) => n.type === "course")} <small>إشعار</small>`;
      el.statSystem.innerHTML = `${countBy((n) => n.type === "system")} <small>إشعار</small>`;

      el.pill.hidden = unread === 0;
      el.pillCount.textContent = String(unread);

      el.summary.innerHTML =
        unread > 0
          ? `لديك <strong>${unread} ${unread === 1 ? "إشعار" : "إشعارات"}</strong> غير مقروءة`
          : "كل الإشعارات مقروءة";

      el.markAll.disabled = unread === 0;
      el.toolbarMarkRead.hidden = unread === 0;
    };

    /* ------------------------------ التبويبات ------------------------------ */
    const tabList = () => {
      const total = state.items.length;
      const unread = countBy((n) => !n.is_read);
      const starred = countBy((n) => n.is_starred);
      const counts = typeCounts();

      const tabs = [
        { id: "all", label: "الكل", count: total },
        { id: "unread", label: "غير مقروءة", count: unread, dot: true },
      ];
      if (starred) tabs.push({ id: "starred", label: "المميّزة", count: starred, star: true });
      TYPE_ORDER.forEach((type) => {
        if (!counts.get(type)) return;
        tabs.push({ id: type, label: TYPE_META[type].tab, count: counts.get(type) });
      });
      return tabs;
    };

    const renderTabs = () => {
      const tabs = tabList();
      if (!tabs.some((t) => t.id === state.filter)) {
        state.filter = "all";
        state.shown = PAGE_SIZE;
      }
      el.tabs.innerHTML = tabs
        .map(
          (t) => `<button class="notif-tab${state.filter === t.id ? " active" : ""}" type="button"
                    role="tab" data-filter="${esc(t.id)}" aria-selected="${state.filter === t.id}">
            ${t.dot ? `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"/></svg>` : ""}
            ${t.star ? icon("star") : ""}
            ${esc(t.label)}
            <span class="tab-count">${t.count}</span>
          </button>`
        )
        .join("");
    };

    /* ------------------------------ التصفية ------------------------------ */
    const inTime = (iso) => {
      if (state.time === "all") return true;
      const t = new Date(iso).getTime();
      if (Number.isNaN(t)) return false;
      if (state.time === "today") return groupOf(iso) === "today";
      if (state.time === "week") return Date.now() - t < 7 * 86400000;
      if (state.time === "month") return Date.now() - t < 30 * 86400000;
      return true;
    };

    const filtered = () =>
      state.items.filter((n) => {
        if (state.filter === "unread" && n.is_read) return false;
        if (state.filter === "starred" && !n.is_starred) return false;
        if (state.filter !== "all" && state.filter !== "unread" && state.filter !== "starred" && n.type !== state.filter) return false;
        return inTime(n.created_at);
      });

    /* ------------------------------ العرض ------------------------------ */
    const itemHtml = (n) => {
      const meta = TYPE_META[n.type] || TYPE_META.system;
      const unread = !n.is_read;
      const link = resolveLink(n.link);
      return `<article class="notif-item${unread ? " unread" : ""}" data-id="${n.id}" tabindex="0"
                  role="button" aria-label="${esc(n.title)}${unread ? " — غير مقروء" : ""}">
        <div class="notif-icon ${esc(n.type)}">
          ${icon(meta.icon)}
          ${unread ? '<span class="unread-dot" aria-hidden="true"></span>' : ""}
        </div>
        <div class="notif-body">
          <div class="notif-header-row">
            <span class="notif-type-tag ${esc(n.type)}">${esc(meta.label)}</span>
          </div>
          <h3 class="notif-title">${esc(n.title)}</h3>
          ${n.body ? `<p class="notif-text">${esc(n.body)}</p>` : ""}
          <div class="notif-footer">
            <span class="notif-time">${icon("clock")}${esc(relTime(n.created_at))}</span>
            ${n.creator_name ? `<span class="notif-from">${icon("user")}من <strong>${esc(n.creator_name)}</strong></span>` : ""}
            ${n.course_title ? `<span class="notif-course">${icon("book")}${esc(n.course_title)}</span>` : ""}
            ${link ? `<a class="notif-action-btn" href="${esc(link)}" data-open>${icon("arrow")}عرض</a>` : ""}
          </div>
        </div>
        <div class="notif-item-actions">
          <button class="notif-icon-btn${n.is_starred ? " starred" : ""}" type="button" data-act="star"
                  aria-label="${n.is_starred ? "إزالة التمييز" : "تمييز الإشعار"}" aria-pressed="${n.is_starred}">
            ${icon("star")}
          </button>
          <button class="notif-icon-btn" type="button" data-act="dismiss" aria-label="إخفاء الإشعار">
            ${icon("trash")}
          </button>
        </div>
      </article>`;
    };

    const emptyHtml = () => {
      if (state.items.length === 0) {
        return `<div class="notif-empty">
          <div class="notif-empty-icon">${icon("bell")}</div>
          <h3>لا توجد إشعارات بعد</h3>
          <p>ستظهر هنا إشعارات الأكاديمية والمقررات والاختبارات فور صدورها.</p>
        </div>`;
      }
      return `<div class="notif-empty">
        <div class="notif-empty-icon">${icon("bell")}</div>
        <h3>لا توجد إشعارات مطابقة</h3>
        <p>لم نجد إشعارات تطابق الفلتر الحالي. جرّب تغيير النوع أو الفترة الزمنية.</p>
        <div class="notif-empty-actions">
          <button class="notif-btn notif-btn-secondary notif-btn-sm" type="button" data-reset>عرض كل الإشعارات</button>
        </div>
      </div>`;
    };

    const errorHtml = () => `<div class="notif-empty">
      <div class="notif-empty-icon">${icon("close")}</div>
      <h3>تعذّر تحميل الإشعارات</h3>
      <p>حدث خطأ أثناء الاتصال. تحقّق من الشبكة ثم أعد المحاولة.</p>
      <div class="notif-empty-actions">
        <button class="notif-btn notif-btn-secondary notif-btn-sm" type="button" data-retry>إعادة المحاولة</button>
      </div>
    </div>`;

    const renderList = () => {
      if (state.loading) {
        el.list.innerHTML = '<div class="notif-skeleton"></div><div class="notif-skeleton"></div><div class="notif-skeleton"></div>';
        el.loadWrap.hidden = true;
        return;
      }
      if (state.error) {
        el.list.innerHTML = errorHtml();
        el.loadWrap.hidden = true;
        return;
      }

      const list = filtered();
      if (list.length === 0) {
        el.list.innerHTML = emptyHtml();
        el.loadWrap.hidden = true;
        return;
      }

      const visible = list.slice(0, state.shown);
      const grouped = new Map(GROUPS.map((g) => [g.id, []]));
      visible.forEach((n) => grouped.get(groupOf(n.created_at))?.push(n));

      el.list.innerHTML = GROUPS.filter((g) => grouped.get(g.id).length)
        .map(
          (g) => `<div class="notif-group">
            <div class="notif-group-header">
              <div class="notif-group-title">${icon(g.icon)}${esc(g.title)}</div>
              <span class="notif-group-count">${grouped.get(g.id).length} ${grouped.get(g.id).length === 1 ? "إشعار" : "إشعارات"}</span>
            </div>
            ${grouped.get(g.id).map(itemHtml).join("")}
          </div>`
        )
        .join("");

      el.loadWrap.hidden = list.length <= state.shown;
    };

    const renderAll = () => {
      renderStats();
      renderTabs();
      renderList();
    };

    /* ------------------------------ البيانات ------------------------------ */
    async function load({ silent = false } = {}) {
      if (!silent) {
        state.loading = true;
        state.error = null;
        renderList();
        renderStats();
      }

      const { data, error } = await supabase.rpc("my_notifications");

      state.loading = false;
      if (error) {
        state.error = error;
        console.error("[notifications]", error);
        renderList();
        return;
      }

      state.items = (data || []).map((n) => ({
        ...n,
        is_read: Boolean(n.is_read),
        is_starred: Boolean(n.is_starred),
      }));
      state.error = null;
      state.shown = Math.max(state.shown, PAGE_SIZE);
      renderAll();
    }

    /* ------------------------------ العمليات ------------------------------ */
    const upsertState = (n, patch) =>
      supabase.from("notification_reads").upsert(
        {
          notification_id: n.id,
          user_id: profile.id,
          read_at: n.is_read ? new Date().toISOString() : null,
          starred: Boolean(n.is_starred),
          dismissed_at: null,
          ...patch,
        },
        { onConflict: "notification_id,user_id" }
      );

    async function markRead(n) {
      if (n.is_read) return;
      n.is_read = true;
      renderAll();
      const { error } = await upsertState(n, { read_at: new Date().toISOString() });
      if (error) {
        n.is_read = false;
        renderAll();
        toast("تعذّر تحديث حالة القراءة", "danger");
      }
    }

    async function markAllRead() {
      const unread = state.items.filter((n) => !n.is_read);
      if (!unread.length) return;
      const now = new Date().toISOString();
      unread.forEach((n) => {
        n.is_read = true;
      });
      renderAll();

      const { error } = await supabase.from("notification_reads").upsert(
        unread.map((n) => ({
          notification_id: n.id,
          user_id: profile.id,
          read_at: now,
          starred: Boolean(n.is_starred),
        })),
        { onConflict: "notification_id,user_id" }
      );

      if (error) {
        unread.forEach((n) => {
          n.is_read = false;
        });
        renderAll();
        toast("تعذّر تعليم الإشعارات كمقروءة", "danger");
        return;
      }
      toast("تم تعليم كل الإشعارات كمقروءة", "success");
    }

    async function toggleStar(n) {
      const next = !n.is_starred;
      n.is_starred = next;
      renderAll();
      const { error } = await upsertState(n, { starred: next });
      if (error) {
        n.is_starred = !next;
        renderAll();
        toast("تعذّر تحديث التمييز", "danger");
        return;
      }
      toast(next ? "تم تمييز الإشعار" : "تمت إزالة التمييز", next ? "success" : "warning");
    }

    async function dismiss(n) {
      const before = { ...n };
      state.items = state.items.filter((x) => x.id !== n.id);
      renderAll();
      const { error } = await upsertState(n, { dismissed_at: new Date().toISOString() });
      if (error) {
        state.items.push(before);
        state.items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        renderAll();
        toast("تعذّر إخفاء الإشعار", "danger");
        return;
      }
      toast("تم إخفاء الإشعار", "warning");
    }

    const findItem = (id) => state.items.find((n) => Number(n.id) === Number(id));

    /* ------------------------------ الأحداث ------------------------------ */
    el.tabs.addEventListener("click", (e) => {
      const btn = e.target.closest(".notif-tab");
      if (!btn) return;
      state.filter = btn.dataset.filter;
      state.shown = PAGE_SIZE;
      renderTabs();
      renderList();
    });

    el.time.addEventListener("change", (e) => {
      state.time = e.target.value;
      state.shown = PAGE_SIZE;
      renderList();
    });

    el.stats.addEventListener("click", (e) => {
      const card = e.target.closest("[data-jump]");
      if (!card) return;
      state.filter = card.dataset.jump;
      state.shown = PAGE_SIZE;
      renderTabs();
      renderList();
    });

    el.list.addEventListener("click", (e) => {
      const retry = e.target.closest("[data-retry]");
      if (retry) {
        load();
        return;
      }
      const reset = e.target.closest("[data-reset]");
      if (reset) {
        state.filter = "all";
        state.time = "all";
        el.time.value = "all";
        state.shown = PAGE_SIZE;
        renderAll();
        return;
      }

      const item = e.target.closest(".notif-item");
      if (!item) return;
      const n = findItem(item.dataset.id);
      if (!n) return;

      const star = e.target.closest('[data-act="star"]');
      if (star) return toggleStar(n);

      const del = e.target.closest('[data-act="dismiss"]');
      if (del) return dismiss(n);

      // زر «عرض» يتكفّل بالانتقال، ونكتفي بتعليم الإشعار كمقروء.
      markRead(n);
    });

    el.list.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const item = e.target.closest(".notif-item");
      if (!item || e.target !== item) return;
      e.preventDefault();
      const n = findItem(item.dataset.id);
      if (n) markRead(n);
    });

    el.markAll.addEventListener("click", markAllRead);
    el.toolbarMarkRead.addEventListener("click", markAllRead);
    el.reload.addEventListener("click", async () => {
      el.reload.disabled = true;
      await load({ silent: true });
      el.reload.disabled = false;
      toast(state.error ? "تعذّر تحديث الإشعارات" : "تم تحديث الإشعارات", state.error ? "danger" : "success");
    });
    el.loadBtn.addEventListener("click", () => {
      state.shown += PAGE_STEP;
      renderList();
    });

    await load();
  },
});

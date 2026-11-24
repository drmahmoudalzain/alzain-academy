import { boot } from "../lib/portal.js";
import { supabase } from "../lib/supabase.js";
import { p } from "../lib/base.js";
import { esc } from "../lib/fmt.js";
import { icon } from "../lib/icons.js";

const PAGE_SIZE = 12;

const KINDS = {
  book: { label: "كتاب", badge: "book", icon: "book" },
  paper: { label: "بحث", badge: "paper", icon: "paper" },
  media: { label: "وسائط", badge: "media", icon: "video" },
};

boot({
  portals: ["student", "teacher", "assistant", "owner"],
  title: "المكتبة القانونية",
  render: async ({ profile, portal }) => {
    const el = {
      stats: document.getElementById("libStats"),
      tabs: document.getElementById("libTabs"),
      search: document.getElementById("libSearch"),
      sort: document.getElementById("libSort"),
      grid: document.getElementById("libGrid"),
      loadWrap: document.getElementById("libLoadMoreWrap"),
      loadBtn: document.getElementById("libLoadMore"),
      favBtn: document.getElementById("libFavoritesBtn"),
      favCount: document.getElementById("libFavCount"),
      manage: document.getElementById("libManageLink"),
      toasts: document.getElementById("libToasts"),
      modal: document.getElementById("libModal"),
      modalClose: document.getElementById("libModalClose"),
      modalCoverIcon: document.getElementById("libModalCoverIcon"),
      modalCoverTitle: document.getElementById("libModalCoverTitle"),
      modalCoverType: document.getElementById("libModalCoverType"),
      modalTitle: document.getElementById("libModalTitle"),
      modalAuthor: document.getElementById("libModalAuthor"),
      modalYear: document.getElementById("libModalYear"),
      modalSection: document.getElementById("libModalSection"),
      modalSize: document.getElementById("libModalSize"),
      modalAbstract: document.getElementById("libModalAbstract"),
      researchBadge: document.getElementById("libResearchBadge"),
      researchData: document.getElementById("libResearchData"),
      rResearcher: document.getElementById("libResearcher"),
      rJournal: document.getElementById("libJournal"),
      rYear: document.getElementById("libRYear"),
      rDoi: document.getElementById("libDoi"),
      previewBtn: document.getElementById("libPreviewBtn"),
      favModalBtn: document.getElementById("libFavBtn"),
      favModalText: document.getElementById("libFavBtnText"),
      viewer: document.getElementById("libViewer"),
      frame: document.getElementById("libViewerFrame"),
    };

    if (portal === "owner" || portal === "assistant") {
      el.manage.hidden = false;
      el.manage.href = p("pages/library-manage.html");
    }

    const emptyState = (title, text) => `<div class="lib-empty">
      ${icon("library")}
      <h3>${esc(title)}</h3>
      <p>${esc(text)}</p>
    </div>`;

    el.grid.innerHTML = Array.from({ length: 6 }, () => '<div class="lib-skeleton"></div>').join("");

    const state = {
      sections: [],
      items: [],
      favs: new Set(),
      active: "all",
      search: "",
      sort: "recent",
      favoritesOnly: false,
      visible: PAGE_SIZE,
      current: null,
    };

    const [sectionsRes, itemsRes, favsRes] = await Promise.all([
      supabase.from("library_sections").select("id, name, icon, position").order("position"),
      supabase
        .from("library_items")
        .select("id, section_id, title, description, abstract, kind, researcher, journal, publish_year, doi, filename, original_name, mime, size, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("library_favorites").select("item_id"),
    ]);

    if (itemsRes.error) {
      el.grid.innerHTML = emptyState("تعذّر تحميل المكتبة", itemsRes.error.message);
      return;
    }

    state.sections = sectionsRes.data || [];
    state.items = itemsRes.data || [];
    state.favs = new Set((favsRes.data || []).map((r) => Number(r.item_id)));
    state.sectionMap = new Map(state.sections.map((s) => [Number(s.id), s]));

    const kindOf = (item) => {
      if (item.kind === "paper" || item.kind === "research") return KINDS.paper;
      if (item.kind === "media" || item.kind === "video") return KINDS.media;
      return KINDS.book;
    };

    const sectionName = (item) => state.sectionMap.get(Number(item.section_id))?.name || "—";

    /* ---------- الإحصاءات ---------- */
    const renderStats = () => {
      const count = (pred) => state.items.filter(pred).length;
      const cards = [
        { cls: "books", icon: "book", label: "كتب ومراجع", value: count((i) => kindOf(i) === KINDS.book), unit: "مرجع" },
        { cls: "papers", icon: "paper", label: "بحوث علمية", value: count((i) => kindOf(i) === KINDS.paper), unit: "بحث" },
        { cls: "media", icon: "video", label: "وسائط تعليمية", value: count((i) => kindOf(i) === KINDS.media), unit: "ملف" },
        { cls: "sections", icon: "library", label: "أقسام المكتبة", value: state.sections.length, unit: "قسم" },
      ];
      el.stats.innerHTML = cards
        .map(
          (c) => `<div class="lib-stat ${c.cls}">
            <div class="lib-stat-icon">${icon(c.icon)}</div>
            <div class="lib-stat-body">
              <div class="lib-stat-label">${esc(c.label)}</div>
              <div class="lib-stat-value">${c.value} <small>${esc(c.unit)}</small></div>
            </div>
          </div>`
        )
        .join("");
    };

    /* ---------- التبويبات ---------- */
    const renderTabs = () => {
      const counts = new Map();
      state.items.forEach((i) => counts.set(Number(i.section_id), (counts.get(Number(i.section_id)) || 0) + 1));
      const tabs = [{ id: "all", name: "الكل", icon: null, count: state.items.length }].concat(
        state.sections.map((s) => ({
          id: String(s.id),
          name: s.name,
          icon: s.icon || null,
          count: counts.get(Number(s.id)) || 0,
        }))
      );
      el.tabs.innerHTML = tabs
        .map(
          (t) => `<button type="button" class="lib-tab${state.active === t.id ? " active" : ""}" data-id="${esc(t.id)}" role="tab" aria-selected="${state.active === t.id}">
            ${t.icon ? `<span aria-hidden="true">${esc(t.icon)}</span>` : ""}
            ${esc(t.name)}
            <span class="tab-count">${t.count}</span>
          </button>`
        )
        .join("");
    };

    /* ---------- التصفية ---------- */
    const filtered = () => {
      const q = state.search.trim().toLowerCase();
      let list = state.items.filter((item) => {
        if (state.active !== "all" && String(item.section_id) !== state.active) return false;
        if (state.favoritesOnly && !state.favs.has(Number(item.id))) return false;
        if (!q) return true;
        const hay = [
          item.title,
          item.researcher,
          item.journal,
          item.abstract,
          item.description,
          item.publish_year,
          sectionName(item),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });

      if (state.sort === "title") list = list.slice().sort((a, b) => String(a.title).localeCompare(String(b.title), "ar"));
      else if (state.sort === "year") list = list.slice().sort((a, b) => (Number(b.publish_year) || 0) - (Number(a.publish_year) || 0));
      else list = list.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      return list;
    };

    /* ---------- البطاقات ---------- */
    const fmtSize = (bytes) => {
      const n = Number(bytes);
      if (!n) return "—";
      if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
      return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    };

    const renderGrid = () => {
      const list = filtered();
      const shown = list.slice(0, state.visible);

      if (!list.length) {
        el.grid.innerHTML = emptyState(
          state.items.length ? "لا توجد مراجع مطابقة" : "المكتبة فارغة حالياً",
          state.items.length
            ? "جرّب تغيير القسم أو كلمة البحث."
            : "ستظهر هنا المراجع التي تضيفها إدارة الأكاديمية."
        );
        el.loadWrap.hidden = true;
        return;
      }

      el.grid.innerHTML = shown
        .map((item) => {
          const kind = kindOf(item);
          const fav = state.favs.has(Number(item.id));
          const cover = shortTitle(item.title);
          return `<article class="lib-card" data-id="${item.id}" tabindex="0" role="button" aria-label="معاينة ${esc(item.title)}">
            <div class="lib-cover">
              <span class="lib-badge ${kind.badge}">${icon(kind.icon)}${esc(kind.label)}</span>
              <button class="lib-fav${fav ? " active" : ""}" type="button" data-fav="${item.id}" aria-label="${fav ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}" aria-pressed="${fav}">
                ${icon("heart")}
              </button>
              <div class="lib-cover-content">
                <div class="lib-cover-icon">${icon(kind.icon)}</div>
                <h4>${esc(cover)}</h4>
              </div>
            </div>
            <div class="lib-card-body">
              <h3 class="lib-card-title">${esc(item.title)}</h3>
              <div class="lib-card-meta">
                <span>${esc(item.researcher || "غير محدد")}</span>
                ${item.publish_year ? `<span class="dot"></span><span>${esc(item.publish_year)}</span>` : ""}
              </div>
              <div class="lib-card-footer">
                <span class="lib-format">${icon("file")} ${item.filename ? "PDF" : "نص فقط"}</span>
                <span class="lib-pages">${item.filename ? fmtSize(item.size) : esc(sectionName(item))}</span>
              </div>
            </div>
          </article>`;
        })
        .join("");

      el.loadWrap.hidden = list.length <= state.visible;
    };

    const shortTitle = (title) => {
      const s = String(title || "").split(/[—:-]/)[0].trim();
      return s.length > 34 ? `${s.slice(0, 34)}…` : s || "مرجع";
    };

    /* ---------- المفضلة ---------- */
    const isFav = (id) => state.favs.has(Number(id));

    const setFav = async (id, next) => {
      const itemId = Number(id);
      const wasFav = isFav(itemId);
      if (next === wasFav) return;

      // تحديث تفاؤلي
      if (next) state.favs.add(itemId);
      else state.favs.delete(itemId);
      applyFavUI();
      renderGrid();

      const query = next
        ? supabase.from("library_favorites").insert({ user_id: profile.id, item_id: itemId })
        : supabase.from("library_favorites").delete().eq("user_id", profile.id).eq("item_id", itemId);

      const { error } = await query;
      if (error) {
        if (wasFav) state.favs.add(itemId);
        else state.favs.delete(itemId);
        applyFavUI();
        renderGrid();
        toast("تعذّر تحديث المفضلة", "error");
      } else {
        toast(next ? "أُضيف إلى المفضلة" : "أُزيل من المفضلة", next ? "success" : "warning");
      }
    };

    const applyFavUI = () => {
      el.favBtn.setAttribute("aria-pressed", String(state.favoritesOnly));
      el.favBtn.classList.toggle("btn-primary", state.favoritesOnly);
      el.favBtn.classList.toggle("btn-secondary", !state.favoritesOnly);
      el.favCount.hidden = state.favs.size === 0;
      el.favCount.textContent = `(${state.favs.size})`;
      if (state.current) {
        const on = isFav(state.current.id);
        el.favModalBtn.classList.toggle("btn-primary", on);
        el.favModalBtn.classList.toggle("btn-secondary", !on);
        el.favModalText.textContent = on ? "إزالة من المفضلة" : "حفظ في المفضلة";
      }
    };

    /* ---------- النافذة ---------- */
    const openModal = (item) => {
      state.current = item;
      const kind = kindOf(item);
      el.modalCoverIcon.innerHTML = icon(kind.icon);
      el.modalCoverTitle.textContent = shortTitle(item.title);
      el.modalCoverType.textContent = `${kind.label}${item.filename ? " · PDF" : ""}`;
      el.modalTitle.textContent = item.title;
      el.modalAuthor.textContent = item.researcher || "غير محدد";
      el.modalYear.textContent = item.publish_year ? String(item.publish_year) : "—";
      el.modalSection.textContent = sectionName(item);
      el.modalSize.textContent = item.filename ? fmtSize(item.size) : "لا يوجد ملف مرفق";
      el.modalAbstract.textContent = item.abstract || item.description || "لا توجد نبذة متاحة لهذا المرجع.";

      const research = kind === KINDS.paper || item.journal || item.doi;
      el.researchBadge.hidden = !research;
      el.researchData.hidden = !research;
      if (research) {
        el.rResearcher.textContent = item.researcher || "—";
        el.rJournal.textContent = item.journal || "—";
        el.rYear.textContent = item.publish_year ? String(item.publish_year) : "—";
        el.rDoi.textContent = item.doi || "—";
      }

      el.previewBtn.disabled = !item.filename;
      el.viewer.hidden = true;
      el.frame.removeAttribute("src");
      applyFavUI();

      el.modal.classList.add("open");
      document.body.style.overflow = "hidden";
    };

    const closeModal = () => {
      el.modal.classList.remove("open");
      el.frame.removeAttribute("src");
      el.viewer.hidden = true;
      state.current = null;
      document.body.style.overflow = "";
    };

    const preview = async () => {
      const item = state.current;
      if (!item?.filename) return;
      el.previewBtn.disabled = true;
      el.previewBtn.textContent = "جارٍ تجهيز المعاينة…";
      const { data, error } = await supabase.storage.from("library").createSignedUrl(item.filename, 300);
      el.previewBtn.disabled = false;
      el.previewBtn.innerHTML = `${icon("details")} معاينة داخل المنصة`;
      if (error || !data?.signedUrl) {
        toast("تعذّر تجهيز المعاينة", "error");
        return;
      }
      el.frame.src = data.signedUrl;
      el.viewer.hidden = false;
      el.viewer.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };

    /* ---------- التنبيهات ---------- */
    const toast = (message, type = "info") => {
      const node = document.createElement("div");
      node.className = `lib-toast ${type}`;
      node.innerHTML = `${icon(type === "success" ? "check" : type === "error" ? "close" : "bell")}<span>${esc(message)}</span>`;
      el.toasts.appendChild(node);
      setTimeout(() => {
        node.classList.add("hide");
        setTimeout(() => node.remove(), 320);
      }, 2600);
    };

    /* ---------- الأحداث ---------- */
    el.tabs.addEventListener("click", (e) => {
      const btn = e.target.closest(".lib-tab");
      if (!btn) return;
      state.active = btn.dataset.id;
      state.visible = PAGE_SIZE;
      renderTabs();
      renderGrid();
    });

    let searchTimer;
    el.search.addEventListener("input", (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.search = e.target.value;
        state.visible = PAGE_SIZE;
        renderGrid();
      }, 200);
    });

    el.sort.addEventListener("change", (e) => {
      state.sort = e.target.value;
      state.visible = PAGE_SIZE;
      renderGrid();
    });

    document.querySelectorAll(".lib-view button").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".lib-view button").forEach((b) => {
          b.classList.toggle("active", b === btn);
          b.setAttribute("aria-pressed", String(b === btn));
        });
        el.grid.classList.toggle("list-view", btn.dataset.view === "list");
      });
    });

    el.favBtn.addEventListener("click", () => {
      state.favoritesOnly = !state.favoritesOnly;
      state.visible = PAGE_SIZE;
      applyFavUI();
      renderGrid();
    });

    el.grid.addEventListener("click", (e) => {
      const fav = e.target.closest("[data-fav]");
      if (fav) {
        e.stopPropagation();
        setFav(fav.dataset.fav, !isFav(fav.dataset.fav));
        return;
      }
      const card = e.target.closest(".lib-card");
      if (card) {
        const item = state.items.find((i) => Number(i.id) === Number(card.dataset.id));
        if (item) openModal(item);
      }
    });

    el.grid.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const card = e.target.closest(".lib-card");
      if (!card) return;
      e.preventDefault();
      const item = state.items.find((i) => Number(i.id) === Number(card.dataset.id));
      if (item) openModal(item);
    });

    el.loadBtn.addEventListener("click", () => {
      state.visible += PAGE_SIZE;
      renderGrid();
    });

    el.modalClose.addEventListener("click", closeModal);
    el.modal.addEventListener("click", (e) => {
      if (e.target === el.modal) closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && el.modal.classList.contains("open")) closeModal();
    });
    el.previewBtn.addEventListener("click", preview);
    el.favModalBtn.addEventListener("click", () => {
      if (state.current) setFav(state.current.id, !isFav(state.current.id));
    });

    renderStats();
    renderTabs();
    renderGrid();
    applyFavUI();
  },
});

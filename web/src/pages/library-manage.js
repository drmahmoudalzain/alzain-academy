import { boot } from "../lib/portal.js";
import { supabase } from "../lib/supabase.js";
import { call } from "../lib/api.js";
import { p } from "../lib/base.js";
import { esc } from "../lib/fmt.js";
import { icon } from "../lib/icons.js";
import { onDispose } from "../lib/lifecycle.js";
import {
  RECOMMENDATIONS,
  SCORE_AXES,
  publicationTotal,
  validatePublicationScores,
} from "../lib/publication-review.js";

const KIND_LABEL = { book: "كتاب", paper: "بحث", media: "وسائط" };
const MAX_FILE = 20 * 1024 * 1024;
const AXIS_LABEL = {
  originality: "الأصالة والإضافة",
  methodology: "الإشكالية والمنهجية",
  documentation: "التوثيق والدقة",
  analysis: "التحليل والتطبيق",
  writing: "الصياغة والتنظيم",
};
const RECOMMENDATION_LABEL = {
  accept: "قبول دون تعديل",
  minor: "قبول بتعديلات طفيفة",
  major: "قبول بتعديلات جوهرية (إعادة عرض للمحكّمين)",
  reject: "عدم القبول",
};

boot({
  portals: ["owner", "assistant", "teacher"],
  title: "إدارة المكتبة",
  render: async ({ profile, portal }) => {
    const $ = (id) => document.getElementById(id);
    const els = {
      browse: $("libBrowseLink"),
      addBtn: $("libAddBtn"),
      sectionsBtn: $("libSectionsBtn"),
      search: $("libAdminSearch"),
      sectionFilter: $("libAdminSection"),
      count: $("libAdminCount"),
      body: $("libAdminBody"),
      empty: $("libAdminEmpty"),
      formModal: $("libFormModal"),
      form: $("libItemForm"),
      formTitle: $("libFormTitle"),
      formClose: $("libFormClose"),
      formCancel: $("libFormCancel"),
      formSave: $("libFormSave"),
      fSection: $("fSection"),
      fKind: $("fKind"),
      fTitle: $("fTitle"),
      fResearcher: $("fResearcher"),
      fYear: $("fYear"),
      fJournal: $("fJournal"),
      fDoi: $("fDoi"),
      fAbstract: $("fAbstract"),
      fFile: $("fFile"),
      fFileHint: $("fFileHint"),
      sectionsModal: $("libSectionsModal"),
      sectionsClose: $("libSectionsClose"),
      sectionsList: $("libSectionsList"),
      sectionForm: $("libSectionForm"),
      sectionSave: $("libSectionSave"),
      sName: $("sName"),
      sIcon: $("sIcon"),
      toasts: $("libToasts"),
    };

    els.browse.href = p("pages/library.html");

    const state = { sections: [], items: [], editing: null, search: "", section: "all", busy: false };

    const toast = (message, type = "info") => {
      const node = document.createElement("div");
      node.className = `lib-toast ${type}`;
      node.innerHTML = `${icon(type === "success" ? "check" : type === "error" ? "close" : "bell")}<span>${esc(message)}</span>`;
      els.toasts.appendChild(node);
      setTimeout(() => {
        node.classList.add("hide");
        setTimeout(() => node.remove(), 320);
      }, 2800);
    };

    const sectionName = (id) => state.sections.find((s) => Number(s.id) === Number(id))?.name || "—";

    /* ---------- تحميل البيانات ---------- */
    async function load() {
      const [sectionsRes, itemsRes] = await Promise.all([
        supabase.from("library_sections").select("id, name, icon, position").order("position"),
        supabase
          .from("library_items")
          .select("id, section_id, title, kind, researcher, journal, publish_year, doi, abstract, filename, original_name, mime, size, created_at")
          .order("created_at", { ascending: false }),
      ]);

      if (sectionsRes.error || itemsRes.error) {
        toast(sectionsRes.error?.message || itemsRes.error?.message || "تعذّر تحميل البيانات", "error");
        return;
      }

      state.sections = sectionsRes.data || [];
      state.items = itemsRes.data || [];

      fillSectionOptions();
      renderTable();
      renderSectionsList();
    }

    /* ---------- القوائم ---------- */
    function fillSectionOptions() {
      const options = state.sections
        .map((s) => `<option value="${s.id}">${esc(s.name)}</option>`)
        .join("");

      const currentFilter = els.sectionFilter.value || "all";
      els.sectionFilter.innerHTML = `<option value="all">كل الأقسام</option>${options}`;
      els.sectionFilter.value = state.sections.some((s) => String(s.id) === currentFilter) ? currentFilter : "all";

      const currentForm = els.fSection.value;
      els.fSection.innerHTML = options;
      if (currentForm && state.sections.some((s) => String(s.id) === currentForm)) {
        els.fSection.value = currentForm;
      }
    }

    /* ---------- الجدول ---------- */
    function renderTable() {
      const q = state.search.trim().toLowerCase();
      const list = state.items.filter((item) => {
        if (state.section !== "all" && String(item.section_id) !== state.section) return false;
        if (!q) return true;
        return [item.title, item.researcher, item.journal, item.publish_year].filter(Boolean).join(" ").toLowerCase().includes(q);
      });

      els.count.textContent = `${list.length} مرجع`;
      els.empty.hidden = list.length > 0;
      els.empty.innerHTML = list.length
        ? ""
        : `<div class="lib-empty">
            ${icon("library")}
            <h3>لا توجد مراجع</h3>
            <p>استخدم زر «إضافة مرجع» لإضافة أول مرجع، أو عدّل كلمة البحث.</p>
          </div>`;

      els.body.innerHTML = list
        .map(
          (item) => `<tr>
            <td>
              <strong>${esc(item.title)}</strong>
              ${item.researcher ? `<div style="font-size:.75rem;color:var(--text-muted)">${esc(item.researcher)}</div>` : ""}
            </td>
            <td>${esc(sectionName(item.section_id))}</td>
            <td><span class="lib-chip">${esc(KIND_LABEL[item.kind] || item.kind || "—")}</span></td>
            <td>${item.publish_year ? esc(item.publish_year) : "—"}</td>
            <td>${item.filename ? `<span class="lib-chip ok">مرفق</span>` : `<span class="lib-chip warn">بلا ملف</span>`}</td>
            <td>
              <div class="row-actions">
                <button class="lib-icon-btn" type="button" data-edit="${item.id}" title="تعديل" aria-label="تعديل">
                  ${icon("edit")}
                </button>
                <button class="lib-icon-btn danger" type="button" data-delete="${item.id}" title="حذف" aria-label="حذف">
                  ${icon("trash")}
                </button>
              </div>
            </td>
          </tr>`
        )
        .join("");
    }

    /* ---------- نموذج المرجع ---------- */
    function openForm(item = null) {
      state.editing = item;
      els.form.reset();
      els.formTitle.textContent = item ? "تعديل المرجع" : "إضافة مرجع";
      els.fFileHint.textContent = item?.original_name
        ? `الملف الحالي: ${item.original_name} — اختر ملفاً جديداً لاستبداله.`
        : "الحد الأقصى 20 ميجابايت. الملف للمعاينة فقط.";

      if (item) {
        els.fSection.value = String(item.section_id);
        els.fKind.value = item.kind || "book";
        els.fTitle.value = item.title || "";
        els.fResearcher.value = item.researcher || "";
        els.fYear.value = item.publish_year || "";
        els.fJournal.value = item.journal || "";
        els.fDoi.value = item.doi || "";
        els.fAbstract.value = item.abstract || "";
      }

      els.formModal.classList.add("open");
      document.body.style.overflow = "hidden";
      els.fTitle.focus();
    }

    function closeForm() {
      els.formModal.classList.remove("open");
      document.body.style.overflow = "";
      state.editing = null;
    }

    async function uploadFile(file) {
      const ext = (file.name.split(".").pop() || "pdf").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `items/${crypto.randomUUID()}.${ext || "pdf"}`;
      const { error } = await supabase.storage.from("library").upload(path, file, {
        contentType: file.type || "application/pdf",
        upsert: false,
      });
      if (error) throw new Error(error.message);
      return path;
    }

    async function saveItem(e) {
      e.preventDefault();
      if (state.busy) return;

      const sectionId = Number(els.fSection.value);
      const title = els.fTitle.value.trim();
      if (!sectionId || !title) {
        toast("القسم والعنوان مطلوبان", "warning");
        return;
      }

      const file = els.fFile.files?.[0] || null;
      if (file) {
        if (file.size > MAX_FILE) {
          toast("حجم الملف يتجاوز 20 ميجابايت", "warning");
          return;
        }
        if (file.type && file.type !== "application/pdf") {
          toast("الملف يجب أن يكون PDF", "warning");
          return;
        }
      }

      state.busy = true;
      els.formSave.disabled = true;
      els.formSave.textContent = file ? "جارٍ رفع الملف…" : "جارٍ الحفظ…";

      let newPath = null;
      try {
        if (file) newPath = await uploadFile(file);

        const payload = {
          section_id: sectionId,
          title,
          kind: els.fKind.value,
          researcher: els.fResearcher.value.trim() || null,
          journal: els.fJournal.value.trim() || null,
          publish_year: els.fYear.value ? Number(els.fYear.value) : null,
          doi: els.fDoi.value.trim() || null,
          abstract: els.fAbstract.value.trim() || null,
        };

        if (newPath) {
          payload.filename = newPath;
          payload.original_name = file.name;
          payload.mime = file.type || "application/pdf";
          payload.size = file.size;
        }

        let res;
        if (state.editing) {
          res = await supabase.from("library_items").update(payload).eq("id", state.editing.id);
        } else {
          res = await supabase.from("library_items").insert({ ...payload, created_by: profile.id });
        }

        if (res.error) throw new Error(res.error.message);

        // حذف الملف القديم بعد نجاح الاستبدال
        if (newPath && state.editing?.filename && state.editing.filename !== newPath) {
          await supabase.storage.from("library").remove([state.editing.filename]);
        }

        toast(state.editing ? "تم تحديث المرجع" : "تم إضافة المرجع", "success");
        closeForm();
        await load();
      } catch (err) {
        if (newPath) await supabase.storage.from("library").remove([newPath]);
        toast(err.message || "تعذّر حفظ المرجع", "error");
      } finally {
        state.busy = false;
        els.formSave.disabled = false;
        els.formSave.textContent = "حفظ";
      }
    }

    async function deleteItem(item) {
      if (!confirm(`حذف المرجع «${item.title}»؟ لا يمكن التراجع.`)) return;
      const { error } = await supabase.from("library_items").delete().eq("id", item.id);
      if (error) {
        toast(error.message, "error");
        return;
      }
      if (item.filename) await supabase.storage.from("library").remove([item.filename]);
      toast("تم حذف المرجع", "success");
      await load();
    }

    /* ---------- الأقسام ---------- */
    function renderSectionsList() {
      els.sectionsList.innerHTML = state.sections
        .map((s) => {
          const count = state.items.filter((i) => Number(i.section_id) === Number(s.id)).length;
          return `<div class="lib-section-row">
            <span>${esc(s.icon || "📁")}</span>
            <span class="name">${esc(s.name)}</span>
            <span class="count">${count} مرجع</span>
            <button class="lib-icon-btn danger" type="button" data-del-section="${s.id}" title="حذف القسم" aria-label="حذف القسم"${count ? " disabled" : ""}>
              ${icon("trash")}
            </button>
          </div>`;
        })
        .join("");
    }

    async function addSection(e) {
      e.preventDefault();
      const name = els.sName.value.trim();
      if (!name) return;
      const position = state.sections.reduce((max, s) => Math.max(max, Number(s.position) || 0), 0) + 1;
      const { error } = await supabase.from("library_sections").insert({ name, icon: els.sIcon.value.trim() || null, position });
      if (error) {
        toast(error.message, "error");
        return;
      }
      els.sectionForm.reset();
      toast("تم إضافة القسم", "success");
      await load();
    }

    async function deleteSection(section) {
      const count = state.items.filter((i) => Number(i.section_id) === Number(section.id)).length;
      if (count) {
        toast("لا يمكن حذف قسم يحتوي مراجع. انقل المراجع أولاً.", "warning");
        return;
      }
      if (!confirm(`حذف قسم «${section.name}»؟`)) return;
      const { error } = await supabase.from("library_sections").delete().eq("id", section.id);
      if (error) {
        toast(error.message, "error");
        return;
      }
      toast("تم حذف القسم", "success");
      await load();
    }

    /* ---------- الأحداث ---------- */
    els.addBtn.addEventListener("click", () => openForm());
    els.formClose.addEventListener("click", closeForm);
    els.formCancel.addEventListener("click", closeForm);
    els.formModal.addEventListener("click", (e) => e.target === els.formModal && closeForm());
    els.form.addEventListener("submit", saveItem);

    els.search.addEventListener("input", (e) => {
      state.search = e.target.value;
      renderTable();
    });
    els.sectionFilter.addEventListener("change", (e) => {
      state.section = e.target.value;
      renderTable();
    });

    els.body.addEventListener("click", (e) => {
      const edit = e.target.closest("[data-edit]");
      if (edit) {
        const item = state.items.find((i) => Number(i.id) === Number(edit.dataset.edit));
        if (item) openForm(item);
        return;
      }
      const del = e.target.closest("[data-delete]");
      if (del) {
        const item = state.items.find((i) => Number(i.id) === Number(del.dataset.delete));
        if (item) deleteItem(item);
      }
    });

    els.sectionsBtn.addEventListener("click", () => {
      renderSectionsList();
      els.sectionsModal.classList.add("open");
      document.body.style.overflow = "hidden";
    });
    els.sectionsClose.addEventListener("click", () => {
      els.sectionsModal.classList.remove("open");
      document.body.style.overflow = "";
    });
    els.sectionsModal.addEventListener("click", (e) => {
      if (e.target !== els.sectionsModal) return;
      els.sectionsModal.classList.remove("open");
      document.body.style.overflow = "";
    });
    els.sectionForm.addEventListener("submit", addSection);
    els.sectionsList.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-del-section]");
      if (!btn || btn.disabled) return;
      const section = state.sections.find((s) => Number(s.id) === Number(btn.dataset.delSection));
      if (section) deleteSection(section);
    });

    /* ---------- مراجعة النشر: تعيين المالك وقرار المحكّم ---------- */
    const canAssignReviews = portal === "owner";
    const canReviewPublication = portal === "owner" || portal === "teacher";

    function reviewHost() {
      document.getElementById("libReviewSection")?.remove();
      const host = document.createElement("section");
      host.id = "libReviewSection";
      host.className = "library-page";
      host.innerHTML = `<div data-owner-review></div><div data-reviewer-review></div>`;
      document.getElementById("content").appendChild(host);
      onDispose(() => host.remove());
      return host;
    }

    async function mountOwnerReview(container) {
      const [queueRes, candidatesRes] = await Promise.all([
        call("management_publication_review_queue"),
        call("management_publication_reviewer_candidates"),
      ]);
      if (!queueRes.ok || !candidatesRes.ok) {
        toast(queueRes.error || candidatesRes.error || "تعذّر تحميل طابور المراجعة", "error");
        return;
      }

      const candidates = candidatesRes.data || [];
      const options = (selected) =>
        candidates
          .map(
            (c) =>
              `<option value="${esc(c.id)}"${String(c.id) === String(selected) ? " selected" : ""}>${esc(c.name)} — ${esc(c.academic_rank || c.position || "—")}</option>`,
          )
          .join("");

      container.innerHTML = `<section class="lib-review-panel">
        <h2>تعيين محكّمي النشر</h2>
        <p>تُسجَّل نسخة بلا أسماء أو عناوين أو مراجع تكشف الهوية قبل التعيين. مهلة البت ستة أشهر، ومهلة التعديل شهر واحد.</p>
        <div data-review-queue></div>
      </section>`;

      const queue = container.querySelector("[data-review-queue]");
      const rows = queueRes.data || [];
      queue.innerHTML = rows.length
        ? rows
            .map(
              (row) => `<div class="lib-review-row">
                <div>
                  <strong>${esc(row.title)}</strong>
                  <div>${esc(row.status || "—")} · ${esc(row.decision_deadline_at || "—")} · ${esc(row.final_status || "")}</div>
                </div>
                <form data-anon-form data-pub="${esc(row.id)}">
                  <input type="text" name="file" value="${esc(row.anonymized_file || "")}" placeholder="مسار النسخة المخفية الهوية" required />
                  <button type="submit">حفظ النسخة</button>
                </form>
                <form data-assign-form data-pub="${esc(row.id)}">
                  <select name="reviewer1" required>${options(candidates[0]?.id)}</select>
                  <input type="text" name="rank1" value="${esc(candidates[0]?.academic_rank || "")}" placeholder="الرتبة العلمية" required />
                  <input type="text" name="specialization1" value="${esc(candidates[0]?.specialization || "")}" placeholder="الاختصاص" required />
                  <select name="reviewer2" required>${options(candidates[1]?.id ?? candidates[0]?.id)}</select>
                  <input type="text" name="rank2" value="${esc(candidates[1]?.academic_rank || "")}" placeholder="الرتبة العلمية" required />
                  <input type="text" name="specialization2" value="${esc(candidates[1]?.specialization || "")}" placeholder="الاختصاص" required />
                  <button type="submit">تعيين محكّمين</button>
                </form>
              </div>`,
            )
            .join("")
        : `<p>لا توجد بحوث بانتظار التعيين.</p>`;

      queue.addEventListener("submit", async (e) => {
        e.preventDefault();
        const form = e.target;
        const publicationId = Number(form.dataset.pub);
        try {
          if (form.matches("[data-anon-form]")) {
            const saved = await call("management_set_publication_anonymized_file", {
              p_publication_id: publicationId,
              p_file: form.elements.file.value.trim(),
            });
            if (!saved.ok) throw new Error(saved.error);
            toast("تم حفظ النسخة المخفية", "success");
            await mountOwnerReview(container);
            return;
          }

          if (form.matches("[data-assign-form]")) {
            const pairs = [
              ["reviewer1", "rank1", "specialization1"],
              ["reviewer2", "rank2", "specialization2"],
            ];
            for (const [idKey, rankKey, specializationKey] of pairs) {
              const credential = await call("management_set_publication_reviewer_credentials", {
                p_reviewer_id: Number(form.elements[idKey].value),
                p_academic_rank: form.elements[rankKey].value.trim(),
                p_specialization: form.elements[specializationKey].value.trim(),
              });
              if (!credential.ok) throw new Error(credential.error);
            }
            const assigned = await call("management_assign_publication_reviewers", {
              p_publication_id: publicationId,
              p_reviewer1: Number(form.elements.reviewer1.value),
              p_reviewer2: Number(form.elements.reviewer2.value),
            });
            if (!assigned.ok) throw new Error(assigned.error);
            toast("تم تعيين المحكّمين", "success");
            await mountOwnerReview(container);
          }
        } catch (err) {
          toast(err.message || "تعذّر إكمال الطلب", "error");
        }
      });
    }

    async function mountReviewerReview(container) {
      const assignments = await call("reviewer_publication_assignments");
      if (!assignments.ok) {
        toast(assignments.error || "تعذّر تحميل مهام التحكيم", "error");
        return;
      }

      container.innerHTML = `<section class="lib-review-panel">
        <h2>أوراق مُسندة للمراجعة</h2>
        <p>تظهر الأوراق بلا أسماء أو عناوين تكشف الباحث. التوصية إلزامية، والملاحظات تحريرية سرية.</p>
        <div data-review-packets></div>
      </section>`;

      const list = container.querySelector("[data-review-packets]");
      const rows = assignments.data || [];
      if (!rows.length) {
        list.innerHTML = `<p>لا توجد أوراق مُسندة إليك.</p>`;
        return;
      }

      for (const row of rows) {
        const packetRes = await call("reviewer_publication_blob", {
          p_publication_id: row.publication_id,
        });
        if (!packetRes.ok) {
          toast(packetRes.error || "تعذّر تحميل الحزمة المخفية", "error");
          continue;
        }
        const packet = packetRes.data || {};
        let fileUrl = null;
        if (packet.file) {
          const signed = await supabase.storage.from("library").createSignedUrl(String(packet.file), 300);
          if (!signed.error) fileUrl = signed.data?.signedUrl;
        }

        const card = document.createElement("article");
        card.innerHTML = `<div class="lib-review-row">
          <div>
            <h3>${esc(packet.title || "بحث بلا عنوان")}</h3>
            <p>${esc(packet.abstract_ar || "")}</p>
            <p dir="ltr">${esc(packet.abstract_en || "")}</p>
            ${fileUrl ? `<a href="${esc(fileUrl)}" target="_blank" rel="noopener">ملف البحث المخفي الهوية</a>` : `<span>الملف غير متاح</span>`}
          </div>
          <form data-decision-form data-pub="${esc(row.publication_id)}">
            ${SCORE_AXES.map(
              (axis) =>
                `<label>${esc(AXIS_LABEL[axis])} <input type="number" name="${axis}" min="0" max="10" step="0.5" required /></label>`,
            ).join("")}
            <label>التوصية
              <select name="recommendation" required>
                ${Object.keys(RECOMMENDATIONS)
                  .map((code) => `<option value="${code}">${esc(RECOMMENDATION_LABEL[code])}</option>`)
                  .join("")}
              </select>
            </label>
            <label>ملاحظات تحريرية (سرية)<textarea name="notes"></textarea></label>
            <button type="submit"${row.decided ? " disabled" : ""}>${row.decided ? "تم تسجيل القرار" : "تسجيل القرار"}</button>
          </form>
        </div>`;
        list.appendChild(card);
      }

      list.addEventListener("submit", async (e) => {
        const form = e.target.closest("[data-decision-form]");
        if (!form) return;
        e.preventDefault();
        const scores = {};
        for (const axis of SCORE_AXES) {
          scores[axis] = Number(form.elements[axis].value);
        }
        const invalid = validatePublicationScores(scores);
        if (invalid) {
          toast(invalid, "warning");
          return;
        }
        try {
          const submitted = await call("reviewer_record_publication_decision", {
            p_publication_id: Number(form.dataset.pub),
            p_scores: scores,
            p_recommendation: form.elements.recommendation.value,
            p_notes: form.elements.notes.value.trim() || null,
          });
          if (!submitted.ok) throw new Error(submitted.error);
          toast(submitted.data?.status ? `تم تسجيل القرار: ${submitted.data.status}` : "تم تسجيل القرار", "success");
          await mountReviewerReview(container);
        } catch (err) {
          toast(err.message || "تعذّر تسجيل القرار", "error");
        }
      });
    }

    async function mountReviewPanels() {
      if (!canAssignReviews && !canReviewPublication) return;
      const host = reviewHost();
      if (canAssignReviews) await mountOwnerReview(host.querySelector("[data-owner-review]"));
      if (canReviewPublication) await mountReviewerReview(host.querySelector("[data-reviewer-review]"));
    }

    const onEscape = (e) => {
      if (e.key !== "Escape") return;
      if (els.formModal.classList.contains("open")) closeForm();
      if (els.sectionsModal.classList.contains("open")) {
        els.sectionsModal.classList.remove("open");
        document.body.style.overflow = "";
      }
    };
    document.addEventListener("keydown", onEscape);
    onDispose(() => document.removeEventListener("keydown", onEscape));

    await load();
    await mountReviewPanels();
  },
});

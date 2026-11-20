import express from "express";
import { db } from "./supabase.js";
import { renderPage } from "./render.js";
import { requireAuth } from "../middleware/auth.js";
import { PORTALS, primaryPortal, isFounder } from "./portals.js";

function parsePositiveNumber(value, fallback = 1, min = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, number) : fallback;
}

/** المكتبة والبحوث — للطلاب كقارئي والمالك/الأساتذة كرافعين. */
export function createLibraryRouter() {
  const router = express.Router();
  router.use(requireAuth);

  const isStaff = async (user) => user?.role === "teacher" || (await isFounder(user));

  router.get("/", async (req, res, next) => {
    try {
      const [sectionsRes, itemsRes] = await Promise.all([
        db.from("library_sections").select("id, name, icon, position").order("position"),
        db.from("library_items")
          .select("id, section_id, title, description, filename, original_name, size, kind, researcher, journal, publish_year, created_at")
          .order("created_at", { ascending: false })
          .limit(60),
      ]);
      if (sectionsRes.error) throw sectionsRes.error;
      if (itemsRes.error) throw itemsRes.error;

      const sections = sectionsRes.data ?? [];
      const items = itemsRes.data ?? [];
      const sectionById = new Map(sections.map((section) => [section.id, section]));
      const counts = new Map();
      for (const item of items) counts.set(item.section_id, (counts.get(item.section_id) ?? 0) + 1);

      const portalKey = await primaryPortal(req.user);
      return renderPage(res, "library/index", {
        layout: "portal",
        portal: PORTALS[portalKey],
        title: "المكتبة",
        pageTitle: "المكتبة",
        sections: sections.map((section) => ({ ...section, count: counts.get(section.id) ?? 0 })),
        items: items.map((item) => ({ ...item, sectionName: sectionById.get(item.section_id)?.name ?? '—' })),
        canUpload: await isStaff(req.user),
        basePath: portalKey === "owner" ? "/owner" : portalKey === "teacher" ? "/teacher" : "/student",
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/item/:id", async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).render("error", { title: "طلب غير صالح", code: 400, message: "معرّف غير صحيح." });
      const { data, error } = await db
        .from("library_items")
        .select("*, library_sections(id, name, icon)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return renderPage(res.status(404), "error", {
          title: "غير موجود",
          layout: "base",
          bodyClass: "site-page",
          styles: ["/css/views/home.css"],
          code: 404,
          message: "العنصر غير موجود في المكتبة.",
        });
      }

      const portalKey = await primaryPortal(req.user);
      return renderPage(res, "library/item", {
        layout: "portal",
        portal: PORTALS[portalKey],
        title: data.title,
        pageTitle: "عنصر المكتبة",
        item: data,
        watermark: true,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/new", async (req, res, next) => {
    try {
      if (!(await isStaff(req.user))) return res.redirect("/library");
      const { data, error } = await db.from("library_sections").select("id, name").order("position");
      if (error) throw error;
      const portalKey = await primaryPortal(req.user);
      return renderPage(res, "library/new", {
        layout: "portal",
        portal: PORTALS[portalKey],
        title: "إضافة عنصر",
        pageTitle: "إضافة عنصر",
        sections: data ?? [],
        error: null,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      if (!(await isStaff(req.user))) return res.redirect("/library");
      const title = String(req.body.title ?? "").trim();
      const description = String(req.body.description ?? "").trim() || null;
      const kind = ["book", "research", "video", "link"].includes(req.body.kind) ? req.body.kind : "book";
      const filename = String(req.body.url ?? "").trim() || null;
      const originalName = String(req.body.original_name ?? "").trim() || null;
      const researcher = String(req.body.researcher ?? "").trim() || null;
      const journal = String(req.body.journal ?? "").trim() || null;
      const publishYear = req.body.publish_year ? parsePositiveNumber(req.body.publish_year, null, 1) : null;
      const doi = String(req.body.doi ?? "").trim() || null;
      const abstract = String(req.body.abstract ?? "").trim() || null;
      const sectionIdInput = String(req.body.section_id ?? "").trim();
      const newSection = String(req.body.new_section ?? "").trim();

      if (title.length < 3) {
        const portalKey = await primaryPortal(req.user);
        return renderPage(res.status(422), "library/new", {
          layout: "portal",
          portal: PORTALS[portalKey],
          title: "إضافة عنصر",
          pageTitle: "إضافة عنصر",
          sections: (await db.from("library_sections").select("id, name").order("position")).data ?? [],
          error: "العنوان قصير جداً.",
        });
      }

      let sectionId = Number(sectionIdInput) || null;
      if (newSection) {
        const created = await db.from("library_sections").upsert(
          { name: newSection, icon: "📚", position: 99 },
          { onConflict: "name" }
        ).select("id").maybeSingle();
        if (created.error) throw created.error;
        sectionId = created.data?.id ?? null;
      }
      if (!sectionId) {
        const fallback = await db.from("library_sections").select("id").order("position").limit(1).maybeSingle();
        sectionId = fallback.data?.id ?? null;
      }

      const created = await db.from("library_items").insert({
        section_id: sectionId,
        title,
        description,
        filename,
        original_name: originalName ?? title,
        mime: kind === "video" ? "video/mp4" : null,
        kind,
        researcher,
        journal,
        publish_year: publishYear,
        doi,
        abstract,
        created_by: req.user.id,
      }).select("id").maybeSingle();
      if (created.error) throw created.error;

      return res.redirect(`/library/item/${created.data.id}`);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

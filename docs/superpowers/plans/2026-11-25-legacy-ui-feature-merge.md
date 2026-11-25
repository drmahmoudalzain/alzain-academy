# Legacy Interface Feature Merge Implementation Plan

> **For agentic workers:** Implement task-by-task in this session. Keep the pre-existing worktree changes intact; do not commit unless the user asks.

**Goal:** Replace the minimal public entry page with a fast, polished academy homepage and merge only useful, non-duplicated legacy UI improvements into current student flows while preserving real Supabase behavior and permissions.

**Architecture:** Keep the current static Vite multi-page application and its existing RPC/RLS-backed features. Use old designs as a visual and interaction reference, add isolated static-home assets and small testable helpers, and do not copy legacy mock data or server-only behavior.

**Tech Stack:** HTML, CSS, browser JavaScript modules, Vite, Node.js built-in `node:test`, Supabase RPC/RLS (unchanged).

**Spec:** `docs/superpowers/specs/2026-11-25-legacy-ui-feature-merge-design.md`

## Global Constraints

- “لا تُنقل بيانات أو أسئلة أو أرقام تجريبية من التصاميم القديمة.”
- “لا تُنشئ كتابة جديدة للأستاذ.”
- “لا نشر إلا بعد نجاح البناء، وفحص المسارات والأدوار، ومراجعة التغييرات المحلية التي سيدخلها `dist`.”
- The static GitHub Pages site cannot rely on the Express-only `/api/public-stats` route; do not add hard-coded public counts.
- Keep existing RLS/RPC authorization, exam deadline enforcement, answer autosave, and attendance validation unchanged.
- Do not read, copy, or expose credentials from `.env`; only public client configuration belongs in the client build.

## Review Focus

1. GitHub Pages subpath (`/alzain-academy/`): every public-home link and asset must resolve under Vite’s configured base. **Test:** inspect built HTML and click the home-to-login/guide links on local preview.
2. Supabase/API unavailable: the public homepage and its navigation must still render without an API call. **Test:** browser load with network access to Supabase blocked; page sections remain usable.
3. Mobile/reduced motion: menus, filters, and exam review controls remain usable without overflow or forced animation. **Test:** browser checks at 320, 390, 768, 1024 and 1440px, including reduced-motion emulation.
4. Lecture filtering with missing optional fields or non-Latin search text: filtering must not throw and must match the expected subset. **Test:** `lecture-filters.test.mjs` covers each filter alone, combined filters, empty data, and absent fields.
5. Invalid or stale exam-review session data: only current question IDs may be marked, and malformed storage must not block exam rendering. **Test:** `exam-review.test.mjs` covers malformed JSON, invalid IDs, empty IDs, and valid round trips.

---

## File Structure

- `web/index.html` — public homepage document and page metadata.
- `web/DESIGN.md` — the academy's durable public-home design direction and tokens.
- `web/src/pages/home.js` — small mobile navigation and in-page anchor behavior; no data fetching.
- `web/public/css/public-home.css` — isolated responsive styling for the public home.
- `web/src/lib/lecture-filters.js` — pure filtering logic shared by the lecture page and unit tests.
- `web/src/pages/student/lectures.js` and `web/pages/student/lectures.html` — live lecture filtering and layout toggle.
- `web/src/lib/exam-review.js` — safe, session-scoped review-flag serialization helpers.
- `web/src/pages/student/exam.js` and `web/public/css/views/student-exam.css` — review markers in the live exam UI.
- `web/tests/public-home.test.mjs`, `web/tests/lecture-filters.test.mjs`, `web/tests/exam-review.test.mjs` — focused regression checks.
- `docs/superpowers/specs/2026-11-25-legacy-ui-feature-map.md` — old-to-current page/feature matrix and final disposition.

## Task List

### Task 1: Inventory legacy interfaces and record the merge map

**Files:**
- Create: `docs/superpowers/specs/2026-11-25-legacy-ui-feature-map.md`
- Read only: `design/*.html`, `preview/old-ui/**/*`, `web/pages/**/*`, `web/src/**/*`

**Interfaces:**
- Consumes: the accepted design at `docs/superpowers/specs/2026-11-25-legacy-ui-feature-merge-design.md`.
- Produces: a page-by-page table with legacy source, current route, feature, disposition (`already present`, `carry over`, or `exclude`), and reason.

- [ ] **Step 1: Inventory the legacy and current HTML entry points**
  - Enumerate all HTML files under `design/`, `preview/old-ui/`, and `web/pages/`.
  - Map each legacy screen to its current route where one exists.
- [ ] **Step 2: Classify the legacy behaviors**
  - Mark legacy public counters, answer content, login/demo details, pretend media controls, and “load more” timers as mock-only and excluded.
  - Mark existing real equivalents (unified login, dashboard data, exam navigator/autosave, attendance) as already present.
  - Record the intentionally carried-over gaps: lecture-type filter/list layout toggle and temporary exam review flags.
  - Note that the legacy teacher/owner/student role screens are sign-in designs, not complete role dashboards; the current teacher dashboard remains the real RPC-backed interface.
- [ ] **Step 3: Save and verify the feature matrix**
  - Confirm each enumerated legacy HTML file has a row and no row proposes changing RLS/RPC permissions.

**Acceptance:** The matrix accounts for every old HTML interface, states why each feature is carried over or excluded, and separates visual reference from real functionality.

### Task 2: Build the public homepage

**Files:**
- Modify: `web/index.html`
- Create: `web/DESIGN.md`
- Create: `web/src/pages/home.js`
- Create: `web/public/css/public-home.css`
- Create: `web/tests/public-home.test.mjs`

**Interfaces:**
- Consumes: `p(path)` from `web/src/lib/base.js` for links that must respect `/alzain-academy/`.
- Produces: a static RTL home page with semantic sections, keyboard-accessible mobile navigation, and valid links to login and public guidance.

- [ ] **Step 1: Write Node tests for homepage structure and routing**
  - Assert the page has a skip link, one `h1`, main sections, a named mobile-menu button, and login/guide links.
  - Assert the home script does not fetch `/api/public-stats` or depend on Supabase.
- [ ] **Step 2: Run `node --test web/tests/public-home.test.mjs` and confirm the new assertions fail**
- [ ] **Step 3: Implement the homepage in `web/index.html`, `web/src/pages/home.js`, and `web/public/css/public-home.css`**
  - Adapt the useful sections and portal links from `design/home.html`.
  - Do not copy fixed statistics, dead `href="#"` links, parallax, continuously animated backgrounds, or scroll-reveal dependencies.
  - Use the site base helper for internal links; provide visible keyboard focus and `prefers-reduced-motion` handling.
- [ ] **Step 4: Run `node --test web/tests/public-home.test.mjs` and confirm it passes**

**Acceptance:** The public page is self-contained on static hosting, works with Supabase unavailable, and has no broken internal links or hard-coded metrics.

### Task 3: Add live lecture-type filtering and grid/list view

**Files:**
- Create: `web/src/lib/lecture-filters.js`
- Modify: `web/pages/student/lectures.html`
- Modify: `web/src/pages/student/lectures.js`
- Modify: `web/public/css/views/student-lectures.css`
- Create: `web/tests/lecture-filters.test.mjs`

**Interfaces:**
- Produces: `filterLectures(lectures, filters = {})`, where `filters` accepts `course`, `status`, `type`, and `query`; it returns the matching lecture rows without mutating the input.

- [ ] **Step 1: Write unit tests for `filterLectures`**
  - Cover each filter, combined filters, case-insensitive Arabic/Latin search, absent optional fields, and empty lists.
- [ ] **Step 2: Run `node --test web/tests/lecture-filters.test.mjs` and confirm it fails because the helper is missing**
- [ ] **Step 3: Implement the pure helper and connect the current lecture page**
  - Add a lecture-type filter alongside the current course/status/search filters.
  - Add accessible grid/list buttons with `aria-pressed`; keep the current live data and status badges.
  - Do not add the old fake “load more” timer; the current query already returns its defined live result set.
- [ ] **Step 4: Run `node --test web/tests/lecture-filters.test.mjs`**
- [ ] **Step 5: Manually verify filters and view toggle on the current lecture page, including empty results and mobile widths**

**Acceptance:** Filters compose correctly over Supabase-returned rows, and switching layout does not alter data, navigation, or status semantics.

### Task 4: Carry over exam question review markers safely

**Files:**
- Create: `web/src/lib/exam-review.js`
- Modify: `web/src/pages/student/exam.js`
- Modify: `web/public/css/views/student-exam.css`
- Create: `web/tests/exam-review.test.mjs`

**Interfaces:**
- Produces:
  - `toggleReviewFlag(flags, questionId)` — returns a new `Set` with the ID toggled.
  - `parseReviewFlags(raw, validQuestionIds)` — returns only valid current question IDs; malformed input returns an empty `Set`.
  - `serializeReviewFlags(flags)` — serializes only the flagged question IDs.

- [ ] **Step 1: Write tests for flag toggling, valid round-trip, malformed storage, and stale IDs**
- [ ] **Step 2: Run `node --test web/tests/exam-review.test.mjs` and confirm it fails**
- [ ] **Step 3: Implement the pure helpers and add a keyboard-accessible “mark for review” control to each live question**
  - Scope storage to the current attempt in `sessionStorage`; never persist answers or scores in this helper.
  - Reflect marked state in the existing question navigator with text/accessible state, not color alone.
  - Preserve current server autosave, deadline handling, submit confirmation, and question navigation.
  - Do not add answer-clearing: the current RPC interface has no verified delete/clear operation.
- [ ] **Step 4: Run `node --test web/tests/exam-review.test.mjs`**
- [ ] **Step 5: Manually test toggling, navigation, refresh within an attempt, new-attempt isolation, and submit behavior**

**Acceptance:** Review markers are session-only UI state tied to one attempt; they cannot expose or mutate answer data.

### Task 5: Complete the feature map against all current portals

**Files:**
- Modify: `docs/superpowers/specs/2026-11-25-legacy-ui-feature-map.md`
- Modify: `web/tests/dev-login.test.mjs`
- Read and check only unless the feature map identifies a concrete regression: `web/pages/owner/*`, `web/pages/assistant/*`, `web/pages/teacher/*`, their current source and styles.

- [ ] **Step 1: Verify the current unified login already covers the old role login patterns**
  - Confirm password visibility and current preview buttons remain present and functional.
- [ ] **Step 2: Compare teacher, owner, and assistant legacy screens with current routes**
  - Keep existing RPC/RLS-backed dashboards and existing owner work.
  - Do not invent legacy dashboard features where the old archive contains only login designs or no portal page.
- [ ] **Step 3: Record final dispositions and any intentionally unchanged interfaces in the feature map**
- [ ] **Step 4: Keep login tests aligned with the already-published preview-button behavior**
  - Assert the four `data-preview` controls and password visibility behavior; do not restore credential autofill controls.

**Acceptance:** Every old HTML interface is accounted for; owner/assistant and teacher permissions remain unchanged; no unrelated local dashboard work is overwritten.

### Task 6: Verify, inspect deployment contents, and publish

**Files:**
- No code files unless a verification failure requires a scoped fix.

- [ ] **Step 1: Run focused and existing Node tests**
  - `node --test web/tests/public-home.test.mjs web/tests/lecture-filters.test.mjs web/tests/exam-review.test.mjs`
  - `node --test web/tests/*.test.mjs`
- [ ] **Step 2: Run `npm run build` from `web/`**
- [ ] **Step 3: Manually inspect the built site at 320, 390, 768, 1024, and 1440px**
  - Check public home navigation, login route, the four preview buttons, lecture filtering/layout, exam review markers, and console errors.
  - Use preview mode only for visual portal checks; confirm it shows no real data.
- [ ] **Step 4: Review `git status --short` and the diff for pre-existing owner-dashboard files**
  - Compare the release build against `origin/gh-pages`; preserve source files for features already live there, including the owner dashboard and in-app navigation.
  - Preserve all original working-tree changes.
  - Do not publish unrelated documentation or unfinished source work as part of `dist`; if exclusion is needed, build the release from a clean snapshot plus published baseline sources and this task’s changes without altering the user's working files.
- [ ] **Step 5: Confirm no secrets or real credentials are present in generated output**
- [ ] **Step 6: Run `npm run deploy:pages` from `web/` and confirm `Published`**
- [ ] **Step 7: Verify the public homepage and login page over HTTPS**

**Acceptance:** Tests and production build pass, release contents have been reviewed, and the published pages return the new homepage and working role/login UI.

## Checkpoints

### After Task 2
- [ ] Public home passes its tests and serves at the GitHub Pages project subpath.
- [ ] No API dependency, stale counters, or broken public links.

### After Tasks 3–4
- [ ] Filter helper and exam-review tests pass.
- [ ] Existing live data and permissions still drive both student workflows.

### Before deployment
- [ ] Full test suite and Vite production build pass.
- [ ] All legacy HTML files are accounted for in the feature map.
- [ ] Existing user changes are preserved and excluded from release unless intentionally reviewed.
- [ ] Mobile, console, base-path, and secret checks are complete.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Legacy controls imply actions the current RPC does not support | Data or permissions could be misrepresented | Transfer only verified behaviors; no answer clearing or mock media playback |
| Static host cannot serve Express-only endpoints | Homepage can fail or show stale values | Keep public home static and omit server-only public stats |
| Old files include hard-coded answers and credentials-like examples | Security or academic integrity risk | Keep the old folder read-only; never copy sample answers or credentials |
| Local owner dashboard work is already uncommitted | Accidental overwrite or unintended release | Inspect its diff; preserve it and isolate release contents if needed |
| Session storage can contain malformed or stale flags | Exam UI may fail or mark unrelated questions | Parse defensively and filter against current question IDs |

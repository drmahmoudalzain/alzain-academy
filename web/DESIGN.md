# DESIGN.md: أكاديمية آل الزين

## Context

- Artifact type: public education homepage within a static LMS
- Positioning: academic and formal
- Audience: prospective and current law students, faculty, and academy staff
- Primary action: enter the unified login page; secondary action: read the public user guide
- Adjectives: رصين، واضح، معاصر
- Aesthetic essence: تعليم قانوني واضح
- Reference: the academy's existing navy/gold identity and Arabic RTL interface
- Mode: light content surfaces with a restrained navy hero
- Constraints: static GitHub Pages under `/alzain-academy/`; no server-only endpoints, fabricated metrics, testimonials, or unsupported feature claims
- Dials: ENERGY 2 / RHYTHM 2 / MOTION 1

## Aesthetic

- Direction: academic modern, derived from the existing academy palette
- Defining trait: clear typographic hierarchy and direct paths to login, guide, and study tracks
- Signature move: the established justice-scales mark, used once as the hero's focal visual

## Typography

- Display: Amiri, fallback Georgia and serif; retained from the current academy identity
- Body: Tajawal, fallback Segoe UI, Tahoma, and sans-serif; retained from the current academy identity
- Scale: base 16px, 1.25 ratio; body line-height 1.7; headings scale by section importance
- Font delivery: no blocking third-party font request on the public homepage; system fallbacks render immediately

## Color

- Strategy: existing navy signals the academy identity; gold is a sparse emphasis color, not body text on white
- Distribution: neutral surfaces lead, navy anchors identity, gold marks selected actions and the established symbol
- Palette:
  - bg: `oklch(0.985 0.004 250)` | `#F7F8FA`
  - surface: `oklch(1 0 0)` | `#FFFFFF`
  - fg: `oklch(0.22 0.045 255)` | `#142A43`
  - muted: `oklch(0.48 0.025 255)` | `#59697A`
  - border: `oklch(0.89 0.012 250)` | `#DCE2E9`
  - brand navy: `oklch(0.25 0.065 255)` | `#0B2545`
  - accent gold: `oklch(0.72 0.14 86)` | `#D4A017`
  - accent-fg: `oklch(0.22 0.045 255)` | `#142A43`
  - success: `oklch(0.47 0.12 150)` | `#166E3F`
  - warning: `oklch(0.64 0.14 75)` | `#A86D08`
  - error: `oklch(0.49 0.19 27)` | `#B42318`

## Spacing, radius, shadow

- Spacing base: 4px, scale 4/8/12/16/24/32/48/64
- Radius: 8px controls, 14px major surfaces
- Shadow: avoid default elevation; use a single restrained shadow only for the primary hero mark panel

## Layout and composition

- Grid: editorial split hero with a right-aligned Arabic text column and one existing brand mark; varied content sections below
- Rhythm: compact grouping within controls, generous separation between the hero, tracks, and portal entry
- Density: airy on the public page, balanced on portal and track lists
- Responsive: mobile-first; 320, 390, 768, 1024, and 1440px verification

## Components and states

- Button hierarchy: one navy primary CTA, quiet text/outlined secondary links
- Navigation: real anchors only; a native button controls the mobile menu and exposes `aria-expanded`
- Focus: visible high-contrast focus ring with offset
- States: the public page uses no remote data, so no fake loading/data states

## Motion

- Duration: interaction feedback under 200ms
- Animate only transform and opacity for hover/press feedback
- Reduced motion: disable smooth scrolling and non-essential transitions
- No autoplay, parallax, animated counters, or scroll reveals

## Iconography and imagery

- Reuse the existing justice-scales SVG motif; do not create a new logo or use decorative emoji
- No stock photography or fabricated academy imagery; the page uses the existing mark and typographic structure

## Accessibility

- Arabic `lang` and RTL direction, one `h1`, skip link, semantic landmarks, keyboard-operable navigation
- Text contrast target: WCAG AA; gold is not used as small text on white
- Targets: at least 44px where practical; reduced motion supported

## Slop audit

- Initial direction: no invented counts, claims, testimonials, dead links, decorative orbs, or endless animation
- 2026-11-25: Pass. Lighthouse accessibility, best-practices, and SEO scores were 1.0 each on the local homepage; no failures were reported.
- Responsive check: 320, 390, 768, 1024, and 1440px had no horizontal overflow; reduced-motion rules are present.
- Interaction check: mobile menu opens/closes, Escape returns focus, and internal links resolve under `/alzain-academy/`.
- Network check: the public homepage requested only local page assets and the local Vite HMR socket. No external fonts, Supabase, or Express-only endpoint requests.
- Source-size check: the old static homepage shell, styles, and scripts total 76,930 raw bytes; the new built homepage HTML, styles, page script, and shared base module total 25,103 raw bytes, a 67.4% reduction before compression.
- Performance note: no field Web Vitals or Lighthouse performance score was measured.

## Changelog

- 2026-11-25: Set the public-home direction using the existing academy identity and static-hosting constraints.

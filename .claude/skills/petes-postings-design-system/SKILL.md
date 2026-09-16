---
name: petes-postings-design-system
description: Pete's Postings design system — design tokens, typography, and component specs for the job board UI. Use when building, reviewing, or modifying any client-side UI in web/app — pages, sections, nav, sidebar, job rows, badges, buttons, inputs, search, filters, cards, plan/pricing cards, banners, modals, toggles, chips, empty/loading states, icons, or responsive layouts — or when checking that new UI matches the existing brand (Inter, navy + blue on cream). Triggers on tasks involving globals.css, page.js, pricing/page.js, hero, landing page, dashboard, job list, paywall, notifications panel, or any request to make the site look more consistent, natural, or structured.
license: proprietary
metadata:
  author: petes-postings
  version: "1.0.0"
---

# Pete's Postings Design System

Component specifications and design tokens for the Pete's Postings web app (`web/app`). The site is plain CSS: tokens live as custom properties in `web/app/globals.css`, components are class names on JSX in `page.js` and `pricing/page.js`. There is no Tailwind and no component library. Icons are inline SVG in the Lucide style.

The look in one line: **Inter on cream, navy headings, one blue accent, hairline borders, soft radii, quiet shadows.** Structure comes from consistent spacing, a small type scale, and one way to do each thing.

## When to Apply

Reference these rules when:
- Adding or changing any section, page, or component in `web/app`
- Adding CSS to `globals.css` (reuse an existing class or token before writing a new one)
- Picking a color, font size, radius, shadow, or spacing value
- Building buttons, badges, inputs, cards, banners, modals, toggles, or chips
- Building list rows (the job row is the core data component)
- Reviewing UI for consistency, or when asked to make the site look "cleaner", "more natural", or "more structured"

## Rule Categories by Priority

| Priority | Category | Impact | Files |
|---|---|---|---|
| 1 | Tokens & Color | HIGH | `colors` |
| 2 | Typography | HIGH | `font-headings`, `font-body-meta`, `font-eyebrow` |
| 3 | Layout & Spacing | HIGH | `layout-spacing`, `responsive` |
| 4 | Buttons | HIGH | `button-primary`, `button-pill-toggle` |
| 5 | Tags & Badges | MEDIUM-HIGH | `badge-tag` |
| 6 | Inputs & Search | HIGH | `input-field` |
| 7 | Surfaces | HIGH | `card-surface`, `banner-callout`, `dark-section` |
| 8 | Data List | HIGH | `job-row` |
| 9 | Navigation | MEDIUM-HIGH | `nav-header`, `sidebar` |
| 10 | Overlays & Controls | MEDIUM | `modal`, `toggle-switch` |
| 11 | States | MEDIUM | `state-loading-empty` |
| 12 | Icons | MEDIUM | `icon-inline-svg` |

## Quick Reference

### 1. Tokens & Color (HIGH)
- `colors` — the palette: cream page, white surfaces, navy `#1e293b` for headings and active states, blue `#2563eb` as the single accent, three text greys, hairline border. Semantic families for success (green), attention (amber), danger (red). Blue opacity ladder for tints.

### 2. Typography (HIGH)
- `font-headings` — Inter 800 display scale (hero 2.5rem down to 1.15rem section titles), always navy, negative tracking on the large sizes.
- `font-body-meta` — body and UI text tiers (0.95 to 0.72rem), which grey goes where, line-heights.
- `font-eyebrow` — uppercase micro labels (hero tag, section labels, list headers, plan names): 0.58 to 0.75rem, 600/700, tracked.

### 3. Layout & Spacing (HIGH)
- `layout-spacing` — three container widths (900 marketing / 1100 pricing / 1400 app), section rhythm, the radius scale (6/8/10/12/14/16/20/pill), the shadow scale, transition durations.
- `responsive` — one breakpoint at 768px; what collapses (sidebar to top bar, job rows to cards, grids to one column).

### 4. Buttons (HIGH)
- `button-primary` — filled blue, outlined blue, neutral outline, ghost text. Sizes by context. Hover is `#1d4ed8` for filled, 4% blue tint for outline/ghost.
- `button-pill-toggle` — pill filters and chips (`saved-toggle`, `notif-checkbox`, `demo-chip`, `mobile-pro-pill`): 100px radius or 8px, selected = 6-8% blue tint + blue text.

### 5. Tags & Badges (MEDIUM-HIGH)
- `badge-tag` — job-type badges (Analyst blue / Intern amber / New green), neutral badge, count pills, "Popular" solid tag. 0.58rem uppercase, pill radius.

### 6. Inputs & Search (HIGH)
- `input-field` — text inputs, selects, search with leading icon: white, hairline border, 8px radius, blue focus border + 3px 10% blue ring.

### 7. Surfaces (HIGH)
- `card-surface` — white card on cream: hairline border, 12-16px radius, no shadow by default. The one "featured" treatment (blue 1px ring + soft blue shadow).
- `banner-callout` — inline notices in three tones: blue info (welcome), amber teaser (48h), red error.
- `dark-section` — the navy block (pricing club): white text at 4 opacity steps, frosted inner card.

### 8. Data List (HIGH)
- `job-row` — the jobs list container, uppercase column header, row anatomy (index / title / location / badges / bookmark / arrow), hover with 3px blue left rail, expired state, mobile card layout.

### 9. Navigation (MEDIUM-HIGH)
- `nav-header` — sticky frosted cream bar, 56px, "P" logo tile, text links, outlined sign-in, bell with green dot.
- `sidebar` — 240px white rail, uppercase group headers, 8px rounded items, active = solid navy, counts at 50% opacity, amber teaser count.

### 10. Overlays & Controls (MEDIUM)
- `modal` — 45% scrim with blur, 400/580px white card, 16px radius, deep shadow, icon tile, stacked full-width actions.
- `toggle-switch` — 44×24 switch, grey off / blue on, white knob.

### 11. States (MEDIUM)
- `state-loading-empty` — spinner, skeleton shimmer, empty state copy, fade-in on list mount.

### 12. Icons (MEDIUM)
- `icon-inline-svg` — Lucide-style inline SVG, 24 viewBox, `currentColor`, stroke 2 (2.5 at 13-14px), sizes 13/14/16/28.

## How to Use

1. Before styling anything, open `rules/colors.md` and `rules/layout-spacing.md`. Every value you need is there.
2. Search `globals.css` for an existing class that does the job. Reuse it. Add a modifier class before adding a new base class.
3. If you must add CSS, use the tokens (`var(--navy)`, `var(--forest-blue)`, `var(--border)`, ...) and the scales in these rules. No new hex values without adding them to `colors.md` first.
4. Never use inline `style={{}}` for anything that is not a one-off positional tweak.

Each rule file has: why it matters, an incorrect example, a correct example, a reference table, key rules, and a `Source:` line pointing to the lines in `globals.css` it was drawn from.

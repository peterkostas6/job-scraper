---
title: Responsive Behavior
impact: HIGH
impactDescription: One breakpoint. Layouts collapse in a fixed way; new components must follow it.
tags: responsive, mobile, breakpoint, sidebar, grid, job-row, 768
---

## Responsive Behavior

There is one breakpoint at 768px (plus a 1024px sidebar narrowing). Below it: grids go to one column, the sidebar becomes a sticky top bar, job rows become cards, and side padding drops to 1.25rem (1rem in the app).

**Incorrect (new breakpoint, hiding content, horizontal scroll):**

```css
@media (max-width: 640px) { .my-grid { display: none; } }
.my-table { min-width: 900px; }
```

**Correct (the 768 block, collapse to one column, keep everything reachable):**

```css
@media (max-width: 768px) {
  .my-grid { grid-template-columns: 1fr; }
  .my-row { flex-wrap: wrap; padding: 0.85rem 1rem; }
  .my-row-secondary { width: 100%; }
}
```

### What changes at 768px

| Desktop | Mobile |
|---|---|
| `sidebar` 240px (200px at 1024px) | hidden; `mobile-top-bar` sticky at 56px: full-width `mobile-bank-select` + row of `mobile-pro-pill` |
| `job-row-header` visible | hidden |
| `job-row` single line: index, title, location, badges, bookmark, arrow | wraps: title full width, location + badges inline below, bookmark absolute right, index and arrow hidden, no left rail |
| `filters` always visible | hidden behind `filters-toggle-mobile`; `filters-mobile-open` shows them; search goes full width |
| `features-grid`, `testimonials-grid`, `pricing-cards`, `paywall-plans` 2-3 columns | 1 column (pricing capped at 420px centered) |
| `hero-actions` row | column, centered |
| `welcome-banner` row | column, centered text |
| `footer-inner` space-between | column, left-aligned |
| `pricing-club-inner` 2 columns | 1 column, 2rem 1.5rem padding, 14px radius |
| `inquiry-row` 2 columns | 1 column |
| Side padding 2rem | 1.25rem marketing, 1rem app |
| Hero title 2.5rem | 1.75rem; pricing 1.6rem; about 1.5rem |
| Logo 30px | 26px |

### Key rules

- **Add to the existing `@media (max-width: 768px)` block**, grouped under the matching `/* ---- SECTION ---- */` comment. Do not open a second media query for the same width.
- **Never hide content on mobile**, only chrome (column headers, the row arrow, the index). Everything a user can act on stays reachable.
- **Rows become cards by wrapping**, not by switching to a different component. Keep the same class names so state logic does not fork.
- **Sticky offsets are 56px** (the nav height) for anything that sticks under the nav.
- **Nothing scrolls horizontally.** Truncate with ellipsis on desktop; wrap on mobile.

Source: `web/app/globals.css` lines 2900-3315

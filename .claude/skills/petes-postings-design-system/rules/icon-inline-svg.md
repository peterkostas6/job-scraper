---
title: Inline SVG Icons
impact: MEDIUM
impactDescription: Icons are hand-inlined Lucide-style SVG. Consistent stroke and sizing keep them from looking mismatched.
tags: icon, svg, lucide, stroke, currentColor, size
---

## Inline SVG Icons

There is no icon package. Icons are inline `<svg>` elements in the Lucide style: 24×24 viewBox, `fill="none"`, `stroke="currentColor"`, round caps and joins. Stroke width is 2, or 2.5 for glyphs rendered at 13-14px. Color always comes from the parent's `color`.

**Incorrect (emoji, image file, hardcoded fill, odd viewBox):**

```jsx
<span>🔔</span>
<img src="/icons/bell.png" />
<svg viewBox="0 0 20 20" fill="#2563eb">...</svg>
```

**Correct:**

```jsx
{/* 14px check, thick stroke, inherits green from .hero-benefit svg */}
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
     strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
  <polyline points="20 6 9 17 4 12"/>
</svg>

{/* 16px search, standard stroke */}
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
     strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
</svg>

{/* 28px feature icon, light stroke */}
<div className="feature-icon">
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">...</svg>
</div>
```

### Sizes

| Size | Stroke | Where |
|---|---|---|
| 13px | 2.5 | Nav link glyph, tiny check in lists |
| 14px | 2.5 | Hero benefits, plan features, modal benefits, stars (filled `#f59e0b`, no stroke) |
| 16px | 2 | Search icon, bookmark, arrow, bell, close, sidebar lock |
| 24px | 2 | Modal icon tile |
| 28px | 1.5 | Feature card icons, success icon |

### Color by context

| Context | Color source |
|---|---|
| Feature icon, plan check, modal benefit, bookmark active, arrow hover | `--forest-blue` via parent class |
| Hero benefit check | `#22c55e` via `.hero-benefit svg` |
| Search, lock, close, empty | `--text-muted` |
| Bookmark and arrow at rest | `#ddd` |
| Muted plan feature | `--text-muted` via `.pricing-feature-muted svg` |

### Key rules

- **Never set `fill` or `stroke` to a hex on the SVG.** Set `color` on the parent and use `currentColor`.
- **Match stroke to size**: 2.5 under 16px, 2 at 16-24px, 1.5 at 28px.
- **`flex-shrink: 0` on icons in flex rows** so labels wrap instead of squashing the glyph.
- **Copy paths from Lucide** so the set stays visually one family.
- **The logo is the one exception**: it is an SVG with a navy `rect` and a white text "P". Do not restyle it.

Source: `web/app/page.js` inline SVGs; `web/app/globals.css` lines 222-225, 285-288, 1734-1765, 2667-2689

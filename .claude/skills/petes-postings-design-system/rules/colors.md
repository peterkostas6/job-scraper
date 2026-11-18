---
title: Color Tokens
impact: HIGH
impactDescription: The palette every other rule references. New colors are not allowed without being added here.
tags: color, palette, tokens, navy, cream, coral, 60-30-10, grey, success, amber, danger
---

## Color Tokens (navy / cream / coral, 60-30-10)

Since Nov 2026 the site uses three brand colors in a fixed ratio:

| Share | Color | Hex | Token | Job |
|---|---|---|---|---|
| **60%** | Navy | `#14213D` | `--pp-navy` | The page itself: background, nav, sidebar (`--pp-navy-2` `#1C2C4F` for raised navy), footer. |
| **30%** | Cream | `#F4EDE0` | `--pp-cream` | Every surface that holds content: cards, the job table, Latest roles, pricing plans, quiz answers, modals, inputs, filter panel. Also all text that sits directly on navy. |
| **10%** | Coral | `#FF6B5B` | `--pp-coral` (hover `--pp-coral-hover` `#FF8273`) | ONLY the actions we want people to take: **Browse open roles** and **Get SMS alerts / Set up alerts / Start free trial / Get Pro**. |

The theme lives in the `NAVY / CREAM / CORAL THEME` block near the end of `web/app/globals.css`. It re-points the older tokens, so legacy rules follow along:

| Legacy token | Now means |
|---|---|
| `--cream` | navy page background (name kept for old rules) |
| `--navy`, `--forest-blue`, `--ss-ink` (inside cream surfaces) | navy |
| `--ss-ink` (on the page) | cream |
| `--white` | cream on the page; `#FBF7EF` inside cream surfaces |
| `--text-primary / -secondary / -muted` | cream at 100 / 78 / 60% on the page; navy at 100 / 74 / 60% inside cream surfaces |
| `--border`, `--border-strong` | cream at 12 / 18% on the page; navy at 10 / 16% inside cream surfaces |

**How text color flips:** text tokens default to cream. Every cream surface class (`.ss-card`, `.lb`, `.jobs-list`, `.modal-card`, `.st-option`, `.pp-plan`, ...) resets the same tokens to navy. A new card component must be added to that list (or set the tokens itself), otherwise its text will be cream on cream.

**Incorrect:**

```css
.my-card { background: #fff; color: #1a1a1a; }          /* white is not in the palette */
.my-link { color: var(--pp-coral); }                      /* coral is not for links or decoration */
.my-btn  { background: var(--pp-coral); color: #fff; }    /* white on coral fails contrast (2.9:1) */
```

**Correct:**

```css
.my-card { background: var(--pp-cream); color: var(--pp-navy); }  /* and add it to the cream-surface list */
.my-link { color: var(--pp-cream); text-decoration: underline; }   /* on navy; navy inside cards */
.my-cta  { background: var(--pp-coral); color: var(--pp-navy); }   /* one per view, pointing at browse or alerts */
```

### Contrast (checked)

| Pair | Ratio |
|---|---|
| Cream on navy | 13.7:1 |
| Navy on cream | 13.7:1 |
| Navy on coral | 5.7:1 (button text) |
| Coral on navy | 5.7:1 (the "Browse open roles" text link) |
| White on coral | 2.9:1 — never use |

### Semantic families (unchanged)

| Family | Text | Fill | Where |
|---|---|---|---|
| success (green) | `#16a34a` | `rgba(22,163,74,0.08)` | New badge, live dot, checked marks. Check icons `#22c55e`. |
| attention (amber) | `#92400e` on tint | `rgba(217,119,6,0.07-0.12)` | Intern badge, 48h teaser. |
| danger (red) | `#dc3535` | `rgba(220,53,53,0.06)` | Errors only. Red is not coral; never swap them. |

### Key rules

- **Coral is 10%, and only for the two goals.** If a coral element doesn't lead to browsing roles or signing up for alerts, it should be navy or cream. Secondary buttons are outlines.
- **No blue.** `#2563eb` and its tint ladder are retired. Active states, badges and selected chips use navy on cream, or cream on navy.
- **No pure white surfaces.** Cards are cream; nested inputs inside cards may use `#FBF7EF`.
- **Tints are opacity of navy or cream**, e.g. `rgba(20,33,61,0.08)` for a badge fill on cream, `rgba(244,237,224,0.08)` for a hover on navy. `#EADFCB` is the one darker cream (row hover, tinted stat cards).
- **Logo mark**: three bars, coral top, cream middle, cream at 40% bottom, on navy. Files: `public/logo-mark.svg` (nav), `app/icon1.svg` + `app/icon.png` (tab, navy rounded tile), `app/apple-icon.png` (iPhone, full navy square), `public/logo-square.*` (Google), and inline in `app/opengraph-image.js`. Change them together.

Source: `web/app/globals.css`, block `NAVY / CREAM / CORAL THEME`

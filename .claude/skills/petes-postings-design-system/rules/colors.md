---
title: Color Tokens
impact: HIGH
impactDescription: The palette every other rule references. New colors are not allowed without being added here.
tags: color, palette, tokens, navy, blue, cream, grey, success, amber, danger, tint
---

## Color Tokens

Every color on the site comes from a short list. Brand colors are custom properties in `:root`. Blue tints are the accent at a fixed opacity step, never a second lighter blue. Semantic colors are text / fill / stroke triplets.

**Incorrect (new hex values, Tailwind-style blues, opaque tints):**

```css
.my-card { background: #f5f7ff; border: 1px solid #e0e7ff; color: #3b82f6; }
.my-title { color: #0f172a; }
```

**Correct (tokens and the tint ladder):**

```css
.my-card {
  background: var(--white);
  border: 1px solid var(--border);
  color: var(--text-primary);
}
.my-card-selected {
  background: rgba(37, 99, 235, 0.06);
  border-color: rgba(37, 99, 235, 0.25);
  color: var(--forest-blue);
}
.my-title { color: var(--navy); }
```

### Brand tokens (`:root`)

| Token | Hex | Role |
|---|---|---|
| `--cream` | `#faf8f5` | Page background. Also the nav at 85% and paywall overlays at 92%. |
| `--white` | `#ffffff` | Every card, list, input, sidebar, modal. |
| `--navy` | `#1e293b` | Headings, display numbers, logo tile, active sidebar item, mobile active pill, the dark pricing block. |
| `--forest-blue` | `#2563eb` | The single accent: primary buttons, links, focus, active tab underline, analyst badge, feature icons, bookmark. |
| hover blue | `#1d4ed8` | Filled button hover only. Not a token; write it literally. |
| `--text-primary` | `#1a1a1a` | Body copy, card titles, job titles, input text. |
| `--text-secondary` | `#64748b` | Descriptions, nav links, sidebar items, secondary labels. |
| `--text-muted` | `#94a3b8` | Meta, placeholders, counts, eyebrows, fine print, inactive icons. |
| `--border` | `rgba(0,0,0,0.06)` | Every hairline: cards, inputs, dividers, section tops. |

### Blue tint ladder (accent at opacity)

Always `rgba(37, 99, 235, X)`. Pick the step by role, do not invent a new one.

| Opacity | Used for |
|---|---|
| `0.03` | Job row hover background |
| `0.04` | Ghost/outline button hover, sidebar item hover, welcome banner fill |
| `0.06` | Hero tag fill, selected chip/checkbox fill, modal icon tile, nav bell active |
| `0.07` | "New" time badge fill |
| `0.08` | Analyst badge fill, paywall badge, saved-toggle active |
| `0.10` | Focus ring (3px), mobile upgrade pill |
| `0.12` | Welcome banner stroke, featured plan glow |
| `0.20` | Nav sign-in border, saved-toggle active border |
| `0.25` | Outlined CTA border, selected checkbox border |
| `0.30` | Chip hover border |
| `0.40` | Outlined CTA hover border, phone input focus border |

### Semantic families

| Family | Text | Fill | Stroke | Where |
|---|---|---|---|---|
| success (green) | `#16a34a` | `#dcfce7` or `rgba(22,163,74,0.08)` | none | New badge, live status, notification dots, saved toggle, success icon. Check-mark icons use `#22c55e`. |
| attention (amber) | `#d97706` text, `#92400e` on tinted bg | `rgba(217,119,6,0.07-0.12)` | `rgba(217,119,6,0.2-0.25)` | Intern badge, 48h teaser strip and pill, sidebar teaser count. |
| danger (red) | `#dc3535` | `rgba(220,53,53,0.06)` | `rgba(220,53,53,0.12)` | Error banner, required marks, form errors. |
| rating gold | `#f59e0b` | none | none | Testimonial stars only. |

### Neutral controls

| Hex | Use |
|---|---|
| `#f1f5f9` | Neutral badge fill |
| `#f8fafc` / `#e2e8f0` | Sidebar bank-search field bg / border |
| `#d1d5db` | Toggle off, chip borders in demo |
| `#cbd5e1` | Scrollbar thumb |
| `#ddd` | Inactive bookmark and arrow icons |
| `#fafafa` | Neutral outline button hover bg |
| `#f1f0ee` | Browser-chrome bar in app preview |
| `rgba(0,0,0,0.015)` / `0.04` | List header band / count pill fill |
| `rgba(0,0,0,0.08)` | List header bottom border |
| `rgba(0,0,0,0.12)` / `0.15` | Neutral outline button hover border |

### Key rules

- **One blue.** `#2563eb` and its tints. `#1d4ed8` only on filled-button hover.
- **Headings are navy, body is `#1a1a1a`.** Never navy for paragraphs, never near-black for headings.
- **Tints are opacity, not new hexes.** `rgba(37,99,235,0.06)`, not `#eff6ff`. (Exception: the landing app-preview mock uses `#eff6ff` / `#fffbeb` / `#dcfce7` for its tiny badges. Do not spread that pattern.)
- **Hairline is `var(--border)`.** Heavier borders only on the list header and hover states listed above.
- **`--bg-subtle` is referenced by `.nav-bell:hover` but never defined.** Treat it as `rgba(37,99,235,0.04)` and define it if you touch that rule.

Source: `web/app/globals.css` lines 3-12 and every `rgba(37, 99, 235, ...)` usage

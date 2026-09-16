---
title: Badges & Tags
impact: MEDIUM-HIGH
impactDescription: Badges classify rows and cards at a glance. Colors carry meaning and must not drift.
tags: badge, tag, pill, analyst, intern, new, count, popular, label
---

## Badges & Tags

A badge is a tiny uppercase pill with a tinted fill and no border. Color is semantic: blue for Analyst, amber for Intern, green for New, slate for neutral. The one solid badge is the blue "Popular" tag on a featured plan.

**Incorrect (bordered, title-case, solid color, wrong semantic):**

```jsx
<span style={{ border: "1px solid #2563eb", color: "#2563eb", borderRadius: 4, padding: "2px 8px" }}>Analyst</span>
<span style={{ background: "#16a34a", color: "#fff" }}>Intern</span>
```

**Correct (badge classes):**

```jsx
<div className="job-badges">
  <span className="job-badge badge-analyst">Analyst</span>
  <span className="job-badge badge-intern">Intern</span>
  <span className="job-badge badge-new-time">2h ago</span>
  <span className="job-badge">Full-time</span>
</div>

<span className="new-section-count">12</span>
<span className="sidebar-count-teaser">3 new</span>
<span className="pricing-card-popular-badge">Most popular</span>
```

```css
/* New semantic badge: text color + same color at 8% */
.badge-remote {
  color: #16a34a;
  background: rgba(22, 163, 74, 0.08);
}
```

### Variants

| Variant | Text | Fill | Font | Radius | Classes |
|---|---|---|---|---|---|
| Neutral | `--text-muted` | `#f1f5f9` | 0.58rem 600 upper, 0.5px | 100px | `job-badge` |
| Analyst | `--forest-blue` | blue 8% | same | 100px | `badge-analyst` |
| Intern | `#d97706` | amber 8% | same | 100px | `badge-intern` |
| New / time | `--forest-blue` | blue 7% | same | 100px | `badge-new-time` |
| New (green) | `#16a34a` | `#dcfce7` | 0.6rem 700, 0.03em | 3px | `app-preview-new` (landing mock) |
| Count pill | `--text-muted` | black 4% | 0.72rem 600 | 100px | `new-section-count` |
| Teaser count | `#d97706` | amber 10% | 0.7rem 700 | 20px | `sidebar-count-teaser` |
| Popular (solid) | `#fff` | `--forest-blue` | 0.58rem 700 upper, 1px | 100px, absolute top -10/-12px centered | `paywall-plan-tag`, `pricing-card-popular-badge` |
| Bank label | `--forest-blue` | none | 0.7rem 600 | | `saved-bank-badge` |

### Key rules

- **Padding is 0.2rem 0.55rem** (0.15rem 0.45rem on mobile). `white-space: nowrap`.
- **No border on badges.** The fill is the text color at 7-8% opacity, or a matching light tint.
- **Blue = analyst, amber = intern, green = new/live.** Do not reuse these for other meanings; add a new semantic pair in `colors.md` instead.
- **Badges sit in a `job-badges` flex row with 0.4rem gap**, right-aligned in a row, never stacked on desktop.
- **Solid fill is only for the featured-plan tag.** It floats half outside the card top edge.

Source: `web/app/globals.css` lines 385-394, 980-987, 1374-1388, 1704-1731, 2436-2454, 2594-2608

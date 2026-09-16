---
title: Eyebrow & Micro Labels
impact: HIGH
impactDescription: The uppercase tracked label is the site's signature structural device. It is how sections, groups, and columns announce themselves.
tags: typography, eyebrow, label, uppercase, tracking, mini, header, kicker
---

## Eyebrow & Micro Labels

Small uppercase text with wide tracking marks the start of a section, a sidebar group, a list column, or a plan. It is muted by default and blue only when it sits above a hero.

**Incorrect (title-case, no tracking, too large, wrong color):**

```jsx
<div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#333" }}>Trusted by students at</div>
<th style={{ fontSize: "0.8rem" }}>Location</th>
```

**Correct (existing eyebrow classes):**

```jsx
<div className="banks-strip-label">Tracking postings from</div>
<div className="sidebar-header">Banks</div>
<div className="paywall-includes-label">Every plan includes</div>
<div className="pricing-card-name">Pro</div>
<span className="hero-tag">Land more interviews</span>
```

```css
/* New eyebrow: muted, 0.65-0.72rem, 600, 1-1.5px tracking */
.my-eyebrow {
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--text-muted);
  margin-bottom: 1rem;
}
```

### Variants

| Variant | Size | Weight | Tracking | Color | Fill | Classes |
|---|---|---|---|---|---|---|
| Hero eyebrow pill | 0.72rem | 600 | 1.5px | blue | blue 6%, 100px radius, 0.35×0.9rem pad | `hero-tag` |
| Paywall pill | 0.65rem | 700 | 1.5px | blue | blue 8%, 100px radius | `paywall-badge` |
| Section label | 0.68-0.75rem | 600 | 1.5px or 0.08em | muted | none | `banks-strip-label`, `testimonials-label` |
| Group header | 0.65rem | 600 | 1px | muted | none, 0 0.75rem pad | `sidebar-header`, `paywall-includes-label` |
| Plan name | 0.78rem | 700 | 1px | muted | none | `pricing-card-name` |
| Column header | 0.62rem | 600 | 1px | muted | list header band | `job-row-header` children |
| Dark-surface kicker | 0.65rem | 700 | 1.5px | white 50% | none | `pricing-club-tag` |
| Micro status | 0.6rem | 700 | 0.5px | green | none | `about-bank-status` |

### Key rules

- **Always `text-transform: uppercase`** with tracking between 0.5px and 1.5px (or 0.08em). Never uppercase without tracking.
- **Weight 600 for muted, 700 for colored or tiny (under 0.65rem).**
- **Muted by default.** Blue only for the hero and paywall eyebrow pills. Green only for a live/status word.
- **Pill eyebrows are 100px radius with a 6-8% blue fill.** No border.
- **One eyebrow per section**, sitting 1 to 1.5rem above the heading or the content it labels.

Source: `web/app/globals.css` lines 106-117, 184-191, 705-712, 931-939, 1315-1326, 1623-1632, 2614-2621, 2769-2777

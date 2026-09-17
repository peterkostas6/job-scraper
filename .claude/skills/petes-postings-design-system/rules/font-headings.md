---
title: Heading Typography
impact: HIGH
impactDescription: Headings set the brand voice. Wrong weight or color makes a section look foreign.
tags: typography, heading, display, hero, title, navy, inter
---

## Heading Typography

All headings are Inter, weight 800 (700 at 1.1rem and below), navy, tight line-height, negative tracking on the large sizes. The homepage hero statement is the same Inter 800 in cream on the dark canvas.

**Incorrect (semibold, near-black, loose tracking, made-up size):**

```jsx
<h1 style={{ fontSize: "40px", fontWeight: 600, color: "#111", letterSpacing: 0 }}>
  Every analyst job in one place
</h1>
```

**Correct (existing class, or the scale below):**

```jsx
<h1 className="hero-title">Every analyst job in one place</h1>
<h2 className="bottom-cta-title">Ready to land more interviews?</h2>
<h3 className="notif-title">Notifications</h3>
<h4 className="feature-title">Live from career sites</h4>
```

```css
/* If you must add a heading class, pick a row from the scale */
.my-section-title {
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--navy);
  letter-spacing: -0.3px;
  margin-bottom: 0.3rem;
}
```

### Scale

| Tier | Size | Weight | Tracking | Line-height | Existing classes |
|---|---|---|---|---|---|
| Display | 2.5rem (1.75 mobile) | 800 | -1px | 1.15 | `hero-title` |
| Page title | 2.25rem (1.6 mobile) | 800 | -1px | default | `pricing-hero-title` |
| Page title, small | 2rem (1.5 mobile) | 800 | -0.5px | default | `about-title` |
| Section title | 1.75rem | 800 | -0.5px | default | `pricing-club-title` |
| Section title, small | 1.5rem | 800 | -0.5px | default | `bottom-cta-title`, `paywall-title` |
| Group title | 1.25rem | 800 | 0 | default | `pricing-faq-title` |
| Panel title | 1.15rem | 800 or 700 | -0.3px | default | `modal-title`, `new-postings-page-title`, `notif-title` |
| Sub-panel title | 1.1rem | 700 | 0 | default | `about-heading`, `modal-success-title` |
| Card title | 0.95rem | 700 | 0 | default | `feature-title`, `new-section-title`, `welcome-title`, `new-paywall-title` |
| Display number | 2.25-3rem | 800 | -1 to -2px | 1 | `paywall-plan-amount`, `pricing-card-amount`, `pricing-club-amount` |

### Key rules

- **Navy, always.** `var(--navy)` for every tier above 0.95rem. Card titles at 0.95rem may use `var(--text-primary)` (feature cards do) or navy (section titles do); pick the one the sibling uses.
- **Weight 800 above 1.15rem, 700 at or below.** Never 600 for a heading.
- **Negative tracking scales with size.** -1px at 2.25rem+, -0.5px at 1.5-2rem, -0.3px at 1.15rem, none below.
- **Space after a heading is 0.3 to 1rem**, then the description in `--text-secondary`.
- **Display numbers (prices) are headings**: 800, navy, tight tracking, paired with a muted period label at 0.85-1rem.

Source: `web/app/globals.css` lines 119-126, 247-252, 791-797, 1328-1334, 2152-2158, 2553-2559, 2779-2785

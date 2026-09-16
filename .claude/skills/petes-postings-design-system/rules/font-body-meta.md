---
title: Body & UI Text
impact: HIGH
impactDescription: Most of the interface is 0.75 to 0.95rem text. Wrong size or grey breaks the calm.
tags: typography, body, paragraph, meta, description, grey, line-height
---

## Body & UI Text

Body and interface text live on a tight rem scale. Size picks the tier, color picks the importance: primary near-black for content, secondary slate for descriptions, muted for meta.

**Incorrect (px sizes, default black, no line-height on prose):**

```jsx
<p style={{ fontSize: "16px", color: "#000" }}>
  Browse live analyst and internship postings from eight banks.
</p>
<span style={{ fontSize: "13px", color: "#666" }}>New York, NY</span>
```

**Correct (tier + grey by role):**

```jsx
<p className="hero-desc">Browse live analyst and internship postings from eight banks.</p>
<p className="feature-desc">Pulled straight from career sites, never outdated.</p>
<span className="job-location">New York, NY</span>
<p className="paywall-fine">Cancel anytime.</p>
```

```css
/* New body class: pick a tier, pick a grey */
.my-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.5;
}
```

### Scale

| Tier | Size | Weight | Color | Line-height | Examples |
|---|---|---|---|---|---|
| Lead | 1.05rem (0.92 mobile) | 400 | secondary | 1.7 | `hero-desc`, `about-subtitle` |
| Prose | 0.92rem | 400 | secondary | 1.7-1.75 | `about-text`, `pricing-club-desc`, `pricing-faq-q` (700, primary) |
| Body | 0.88-0.9rem | 400 | secondary | 1.6 | `paywall-desc`, `modal-subtitle`, `bottom-cta-desc` |
| UI default | 0.85rem | 400/500 | primary | 1.4 | `job-title` (500), inputs, `filter-dropdown`, `pricing-feature` (secondary), `sidebar-item` (500, secondary) |
| UI secondary | 0.82rem | 400 | secondary | 1.5-1.6 | `feature-desc`, `notif-desc`, `welcome-desc`, `testimonial-quote` (primary) |
| Small | 0.78rem | 400/500/600 | secondary or muted | 1.5 | `hero-benefit` (500), `testimonial-name` (600, navy), `new-section-desc` (muted) |
| Meta | 0.75rem | 400 | muted | default | `job-location`, `notif-section-desc`, `paywall-plan-billing`, `pricing-card-tagline` |
| Mini | 0.72rem | 400/600 | muted | 1.5-1.6 | `footer-left p`, `paywall-fine`, `pricing-card-fine`, `job-index` (600, tabular) |

### Which grey

| Color | Use it for |
|---|---|
| `--text-primary` `#1a1a1a` | The thing itself: job titles, card titles, input values, quotes, emphasized spans (`<strong>` at 600). |
| `--text-secondary` `#64748b` | What explains the thing: descriptions, nav links, sidebar labels, feature lists. |
| `--text-muted` `#94a3b8` | What annotates the thing: locations, counts, timestamps, placeholders, fine print, eyebrows. |

### Key rules

- **rem, never px** for font-size (the only px values on the site are letter-spacing and borders).
- **Prose gets line-height 1.6-1.75.** UI rows get 1.4. Single-line labels can inherit.
- **Emphasis in prose is `<strong>` at 600 in `--text-primary`**, not bold-700 and not a color change.
- **Numbers that align in a column use `font-variant-numeric: tabular-nums`** (see `job-index`).
- **Max width for reading copy is 520-560px** centered (`hero-desc`, `about-subtitle`).

Source: `web/app/globals.css` lines 128-134, 234-238, 832-841, 1674-1696, 2038-2043

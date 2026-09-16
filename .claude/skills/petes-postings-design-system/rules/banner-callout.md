---
title: Banners & Callouts
impact: HIGH
impactDescription: Inline notices come in three tones. Tone is chosen by meaning, not by mood.
tags: banner, callout, notice, alert, welcome, teaser, error, info, amber
---

## Banners & Callouts

An inline notice is a tinted, hairline-bordered block with an 8-10px radius, sitting above the content it refers to. Blue means information, amber means an upgrade nudge, red means an error.

**Incorrect (solid fill, white text, icon-only meaning):**

```jsx
<div style={{ background: "#2563eb", color: "#fff", padding: 16 }}>Welcome!</div>
<div style={{ background: "#fee2e2", border: "2px solid red" }}>Failed</div>
```

**Correct (the three tones):**

```jsx
{/* Info: welcome */}
<div className="welcome-banner">
  <div>
    <div className="welcome-title">Welcome to Pete's Postings</div>
    <div className="welcome-desc">Pick a bank on the left to start browsing.</div>
  </div>
  <button className="welcome-dismiss">Got it</button>
</div>

{/* Upgrade nudge: amber */}
<div className="recent-teaser-strip">
  <div className="recent-teaser-content"><ClockIcon /> 14 new postings in the last 48 hours</div>
  <button className="recent-teaser-cta">Unlock Recent</button>
</div>

{/* Error */}
<div className="error-banner">Could not load Goldman Sachs. Try again in a minute.</div>
```

### Tones

| Tone | Fill | Border | Text | Radius | Padding | Classes |
|---|---|---|---|---|---|---|
| Info (blue) | blue 4% | blue 12% | title primary 0.95rem 700, desc secondary 0.82rem | 10px | 1.25rem 1.5rem | `welcome-banner` |
| Nudge (amber) | amber 7% | amber 20% | `#92400e` 0.82rem | 8px | 0.65rem 1.1rem | `recent-teaser-strip`, `recent-teaser-cta` |
| Nudge pill (amber) | amber 8% | amber 20% | `#92400e` 0.82rem | 20px | 0.35rem 0.85rem | `hero-48h-teaser` |
| Error (red) | red 6% | red 12% | `#dc3535` 0.88rem | 10px | 1rem 1.25rem | `error-banner` |
| Mobile upgrade bar | blue 4% | bottom blue 10% | blue 0.75rem 600 + blue 10% pill CTA | 0 | 0.6rem 1rem | `mobile-upgrade` |

### Key rules

- **Layout is flex, space-between, align center**, text left and an action right. On mobile the welcome banner stacks and centers.
- **Fill is the tone color at 4-8%, border at 12-20%.** Never a solid fill.
- **Amber text on amber fill is `#92400e`**, not `#d97706` (that is for badges on white).
- **Margin below is 1.25-1.5rem**, so the banner belongs to the content under it.
- **One banner at a time** at the top of a view.

Source: `web/app/globals.css` lines 1081-1175, 1521-1529, 3041-3068

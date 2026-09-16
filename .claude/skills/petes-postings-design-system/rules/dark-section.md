---
title: Dark Section
impact: MEDIUM
impactDescription: The one navy surface. It uses white at fixed opacities, never grey hexes.
tags: dark, navy, section, club, inverted, contrast
---

## Dark Section

The pricing "club" block is the only dark surface. It is `var(--navy)` with a 20px radius and 3rem padding. Text and borders are white at four opacity steps. The inner card is frosted white.

**Incorrect (grey text hexes, black background, white card):**

```jsx
<section style={{ background: "#111", color: "#ccc" }}>
  <div style={{ background: "#fff", color: "#000" }}>$49/mo</div>
</section>
```

**Correct (club classes):**

```jsx
<section className="pricing-club">
  <div className="pricing-club-inner">
    <div className="pricing-club-text">
      <span className="pricing-club-tag">Invite only</span>
      <h2 className="pricing-club-title">Pete's Club</h2>
      <p className="pricing-club-desc">Weekly calls, resume reviews, and referrals.</p>
      <ul className="pricing-club-features">
        <li className="pricing-club-feature"><CheckIcon /> Small cohort</li>
      </ul>
    </div>
    <div className="pricing-club-card">
      <div className="pricing-club-price-display">
        <span className="pricing-club-amount">$49</span>
        <span className="pricing-club-period">/mo</span>
      </div>
      <div className="pricing-club-price-sub">Billed monthly</div>
      <button className="pricing-card-cta pricing-cta-primary">Apply</button>
      <p className="pricing-club-fine">Applications reviewed weekly.</p>
    </div>
  </div>
</section>
```

### White opacity ladder

| Opacity | Use |
|---|---|
| `1` | Title (1.75rem 800), price (3rem 800) |
| `0.75` | Feature list rows (0.85rem) |
| `0.65` | Description (0.92rem, lh 1.7) |
| `0.5` | Kicker, period label, feature icons |
| `0.4` | Price sub-label |
| `0.35` | Fine print |
| `0.12` | Inner card border |
| `0.08` | Inner card fill |

### Key rules

- **Background is `var(--navy)`**, matching the logo tile and the active sidebar item. No other dark.
- **Everything on it is `rgba(255,255,255,X)`.** No grey hexes.
- **The filled blue button still works on navy**; it is the CTA inside the inner card.
- **Layout is a 2-column grid (`1fr auto`), 3rem gap**, collapsing to 1 column with 2rem 1.5rem padding and 14px radius on mobile.
- **Do not add more dark sections.** If a second is needed, reuse these classes.

Source: `web/app/globals.css` lines 2755-2856, 3264-3281

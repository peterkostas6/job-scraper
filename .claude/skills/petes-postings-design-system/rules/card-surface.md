---
title: Cards & Surfaces
impact: HIGH
impactDescription: Cards are flat white on cream. Elevation is rare and means something.
tags: card, surface, container, border, radius, featured, plan, pricing
---

## Cards & Surfaces

A card is white on the cream page with a 1px hairline border and a 12 to 16px radius. It has no shadow. The featured plan gets a 1px blue ring and a soft blue glow. Only the jobs list, the app-preview frame, and modals carry a neutral shadow.

**Incorrect (grey card, drop shadow, thick border, mixed radius):**

```jsx
<div style={{ background: "#f9fafb", border: "2px solid #e5e7eb", borderRadius: 6, boxShadow: "0 4px 12px #0002" }}>
```

**Correct (card classes by context):**

```jsx
{/* Marketing feature */}
<div className="feature-card">
  <div className="feature-icon"><ZapIcon /></div>
  <div className="feature-title">Live from career sites</div>
  <p className="feature-desc">Postings are pulled straight from bank APIs.</p>
</div>

{/* Testimonial */}
<div className="testimonial-card">...</div>

{/* Plan card, with featured variant */}
<div className={`pricing-card${popular ? " pricing-card-popular" : ""}`}>
  {popular && <span className="pricing-card-popular-badge">Most popular</span>}
  <div className="pricing-card-header">
    <div className="pricing-card-name">Pro</div>
    <div className="pricing-card-price">
      <span className="pricing-card-amount">$9</span>
      <span className="pricing-card-period">/mo</span>
    </div>
    <p className="pricing-card-tagline">Billed monthly. Cancel anytime.</p>
  </div>
  <ul className="pricing-card-features">
    <li className="pricing-feature"><CheckIcon /> 48-hour Recent tab</li>
    <li className="pricing-feature pricing-feature-muted"><XIcon /> Club access</li>
  </ul>
  <button className="pricing-card-cta pricing-cta-primary">Upgrade</button>
</div>
```

### Variants

| Card | Radius | Padding | Extra | Classes |
|---|---|---|---|---|
| Feature | 12px | 1.75rem 1.5rem | blue icon, 0.95rem 700 title, 0.82rem desc | `feature-card` |
| Testimonial | 12px | 1.25rem | column, 0.75rem gap, no star rating, 32px avatar circle in blue tint (`--blue-8` fill, `--blue-20` ring, blue initials) | `testimonial-card` |
| Bank tile | 8px | 0.65rem 0.85rem | name + green status word, space-between | `about-bank-card` |
| About feature | 10px | 1rem 1.15rem | strong + span | `about-feature` |
| Plan (paywall) | 14px | 1.5rem 1.25rem | centered, hover border black 10% | `paywall-plan`, `paywall-plan-popular` |
| Plan (pricing) | 16px | 1.75rem 1.5rem | column flex, features `flex: 1` so CTAs align | `pricing-card`, `pricing-card-popular` |
| Preview frame | 12px | 0 | `--border-strong` border, list shadow, chrome bar | `app-preview` |
| List container | 10px | 0 | list shadow, `overflow: hidden` | `jobs-list` (see `job-row`) |

### Featured treatment

```css
.pricing-card-popular {
  border-color: var(--forest-blue);
  box-shadow: 0 0 0 1px var(--forest-blue), 0 8px 32px rgba(37, 99, 235, 0.12);
}
```
Plus the solid `pricing-card-popular-badge` floating at `top: -12px`. Paywall uses `0 4px 20px` at 0.1.

### Key rules

- **White, hairline, no shadow** is the default card. Add `overflow: hidden` only when children bleed (lists, frames).
- **Radius by containment**: tiles 8, feature/testimonial 12, plans 14-16, modal 16, club block 20.
- **Grids**: 3 columns for features and testimonials, 2 for plans (max 780px centered), 4 for bank tiles. All collapse to 1 at 768px.
- **Card hover is a border darkening** (`rgba(0,0,0,0.1)`), not a lift. Only plan cards hover at all.
- **Feature lists inside cards** are `<ul>` with list-style none, 0.55rem gap, blue check icons, muted rows for excluded features.

Source: `web/app/globals.css` lines 208-238, 714-773, 843-901, 1343-1372, 2567-2752

---
title: Layout, Spacing, Radius & Shadow Scales
impact: HIGH
impactDescription: Structure comes from consistent containers, rhythm, and a small set of radii and shadows.
tags: layout, container, spacing, padding, section, radius, shadow, transition, rhythm
---

## Layout, Spacing, Radius & Shadow Scales

The site reads as structured because it uses a few container widths, separates sections with hairlines and vertical padding rather than background bands, and draws every radius and shadow from a short scale.

**Incorrect (arbitrary container, colored section band, random radius and shadow):**

```jsx
<section style={{ maxWidth: 1000, background: "#f0f4ff", padding: "40px 0", borderRadius: 18, boxShadow: "0 2px 10px #0003" }}>
```

**Correct (container class, hairline top, padding from the rhythm, scale values):**

```jsx
<div className="homepage">
  <section className="banks-strip">...</section>   {/* border-top hairline, 2rem 0 3rem */}
  <section className="features-grid">...</section>  {/* 3-col grid, 1.25rem gap, 3.5rem bottom */}
  <section className="bottom-cta">...</section>     {/* border-top hairline, 3rem 0 4rem */}
</div>
```

```css
.my-card {
  border-radius: 12px;                       /* from the radius scale */
  border: 1px solid var(--border);
  box-shadow: none;                          /* cards are flat by default */
  padding: 1.75rem 1.5rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}
```

### Containers

| Class | Max width | Side padding | Use |
|---|---|---|---|
| `homepage` | 900px | 2rem (1.25 mobile) | Landing page column |
| `about-page` | 680px | 2rem | Long-form text |
| `pricing-page` | 1100px | 2rem | Pricing |
| `nav-inner`, `footer-inner`, `app-layout` | 1400px | 2rem (1rem mobile nav) | Chrome and app shell |
| `notif-panel`, `paywall` | 560 / 520px | inherits | In-app panels |
| `content` | fluid | 1.75rem 2rem (1rem mobile) | App main column |

### Vertical rhythm

| Context | Padding |
|---|---|
| Hero | 5rem 0 3.5rem (3rem 0 2.5rem mobile) |
| Marketing section | 3rem 0 2rem, or 2rem 0 3rem for strips |
| Section with hairline top | `border-top: 1px solid var(--border)` + 3rem 0 4rem |
| Bottom of page | 4-5rem |
| In-app panel section | 1.5rem bottom margin + 1.5rem bottom padding + hairline |
| Heading to description | 0.3-0.75rem |
| Description to actions | 1.25-1.5rem |
| Grid gaps | 1rem (dense), 1.25rem (cards), 2rem (logo strip) |
| Inline gaps | 0.3-0.5rem (icon+label), 0.6-0.75rem (controls in a row) |

### Radius scale

| Radius | Use |
|---|---|
| 3-4px | Tiny mock badges, skeleton, URL chip, close button hit area |
| 6px | Small buttons (`nav-signin`, `welcome-dismiss`, `recent-teaser-cta`), `nav-link-active`, small inputs |
| 8px | Standard: buttons, inputs, selects, sidebar items, chips, bank cards, banners (`recent-teaser-strip`), nav bell |
| 10px | Jobs list, welcome banner, error banner, about feature cards, paywall blur |
| 12px | Feature cards, testimonial cards, app preview frame, modal icon tile |
| 14px | Paywall plan cards, club inner card, iOS mock banner |
| 16px | Modal card, pricing cards |
| 20px | Dark club block |
| 100px | Pills: badges, eyebrow pills, toggles, saved-toggle, count pills |
| 50% | Avatars, dots, spinner, knobs |

### Shadow scale

| Name | Value | Use |
|---|---|---|
| none | | Cards, inputs, buttons at rest |
| list | `0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)` | Jobs list container |
| frame | `0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)` | App preview mock |
| featured | `0 0 0 1px var(--forest-blue), 0 4px 20px rgba(37,99,235,0.1)` | Popular plan (pricing page uses `0 8px 32px` at 0.12) |
| modal | `0 24px 80px rgba(0,0,0,0.18)` | Modal card |
| knob | `0 1px 3px rgba(0,0,0,0.15)` | Toggle knob |
| focus | `0 0 0 3px rgba(37,99,235,0.1)` | Input focus ring |

### Motion

| Duration | Use |
|---|---|
| 0.15s | Row hover, sidebar item, chips, bookmark, close buttons |
| 0.2s | Buttons, inputs, nav links, toggles |
| 0.3s | Fade-in on list mount, save-button success |
| 0.55s cubic-bezier(0.4,0,0.2,1) | Demo cursor travel only |

### Key rules

- **Sections separate with a hairline top border and padding**, not with a tinted background band. The only tinted full-width blocks are the dark club section and the welcome/teaser banners inside the app.
- **Center-align marketing sections** (hero, strips, CTA). Left-align app content.
- **Default radius is 8px.** Go up one step per level of containment (row 8 → card 12 → modal 16).
- **Shadow means elevation.** Only the list, the preview frame, featured plans, and modals float. Cards and buttons do not.
- **Transitions name the property.** `transition: background 0.2s`, not `transition: all` (a few legacy rules use `all`; do not add more).

Source: `web/app/globals.css` lines 37-44, 95-104, 178-182, 240-245, 297-306, 1596-1602, 2107-2115, 2578-2592

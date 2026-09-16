---
title: Buttons
impact: HIGH
impactDescription: Four tones, one shape family. Every action on the site is one of these.
tags: button, cta, primary, secondary, outline, ghost, action
---

## Buttons

Buttons are Inter 600, `font-family: inherit`, 6-8px radius, and one of four tones. Filled blue is the primary action. Outlined blue is the secondary action on marketing pages. Neutral outline is the secondary action inside the app. Ghost is a text-only tertiary.

**Incorrect (custom color, default font, heavy shadow, rounded-full):**

```jsx
<button style={{ background: "#3b82f6", borderRadius: 999, padding: "12px 24px", boxShadow: "0 4px 12px #3b82f680", fontWeight: 700 }}>
  Get started
</button>
```

**Correct (existing classes by context):**

```jsx
{/* Marketing hero: filled + outlined pair */}
<div className="hero-actions">
  <button className="hero-cta-primary">Start free</button>
  <button className="hero-cta-secondary">See pricing</button>
</div>

{/* In-app form: filled save */}
<button className="notif-save" disabled={saving}>Save preferences</button>

{/* In-app dismiss: neutral outline */}
<button className="welcome-dismiss">Got it</button>

{/* Plan card: full-width filled or neutral */}
<button className="pricing-card-cta pricing-cta-primary">Upgrade to Pro</button>
<button className="pricing-card-cta pricing-cta-outline">Current plan</button>

{/* Modal: stacked full-width */}
<div className="modal-actions">
  <button className="modal-cta-primary">Sign up</button>
  <button className="modal-cta-secondary">Sign in</button>
</div>

{/* Text link inside copy */}
<button className="paywall-link">Sign in</button>
```

```css
/* New button: copy the tone recipe exactly */
.my-btn {
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.6rem 1.5rem;
  border-radius: 8px;
  border: none;
  background: var(--forest-blue);
  color: #fff;
  cursor: pointer;
  transition: background 0.2s;
}
.my-btn:hover { background: #1d4ed8; }
.my-btn:disabled { opacity: 0.7; cursor: not-allowed; }
```

### Tones

| Tone | Background | Border | Text | Hover | Classes |
|---|---|---|---|---|---|
| Filled blue | `--forest-blue` | none | `#fff` | bg `#1d4ed8` | `hero-cta-primary`, `notif-save`, `modal-cta-primary`, `pricing-cta-primary`, `paywall-plan-cta-primary`, `demo-save-btn` |
| Outlined blue | transparent | `rgba(37,99,235,0.25)` (0.2 for nav) | `--forest-blue` | bg blue 4%, border 0.4 | `hero-cta-secondary`, `nav-signin` |
| Neutral outline | `--white` | `var(--border)` | `--text-primary` (or secondary for dismiss) | border `rgba(0,0,0,0.12-0.15)`, bg `#fafafa` | `welcome-dismiss`, `modal-cta-secondary`, `pricing-cta-outline`, `paywall-plan-cta`, `inquiry-cancel`, `filters-toggle-mobile` |
| Ghost text | none | none | `--text-secondary` | text `--text-primary` | `nav-link`, `modal-dismiss-link` (muted) |
| Link | none | none | `--forest-blue`, underline | none | `paywall-link`, `pricing-fine-link` |
| Amber (teaser only) | amber 12% | amber 25% | `#92400e` | bg amber 20% | `recent-teaser-cta` |

### Sizes

| Size | Font | Padding | Radius | Where |
|---|---|---|---|---|
| Large | 0.92rem | 0.7rem 1.6rem | 8px | Hero CTAs |
| Medium | 0.88-0.9rem | 0.7rem 1rem, full width | 8px | Plan and modal CTAs |
| Default | 0.85rem | 0.6rem 1.5rem (or 0.65rem 1rem full width) | 8px | In-app save, paywall CTA |
| Small | 0.78-0.8rem | 0.4-0.45rem 1rem | 6px | Nav sign-in, dismiss, teaser CTA |
| Nav | 0.8rem, 500 | 0.45rem 0.75rem | 6px on active | Nav links |

### Key rules

- **One filled blue button per view.** Everything else in that view is outline or ghost.
- **Filled hover is `#1d4ed8`**, not opacity, not a darker custom shade.
- **Outline hover adds a 4% blue fill** (blue outline) or `#fafafa` (neutral outline). Text buttons only change text color.
- **Disabled is `opacity: 0.7` + `cursor: not-allowed`** on filled buttons.
- **Press feedback is `transform: scale(0.98)`** on `:active` where used (`paywall-plan-cta`). Optional, never a color change.
- **Always `font-family: inherit`** on `<button>`; browsers reset it otherwise.
- **Full-width buttons live in cards and modals only.** Inline buttons size to content.

Source: `web/app/globals.css` lines 60-92, 142-175, 1158-1175, 1424-1461, 1935-1955, 2196-2258, 2691-2728

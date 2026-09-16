---
title: Modal
impact: MEDIUM
impactDescription: One modal recipe for sign-up prompts, forms, and success states.
tags: modal, dialog, overlay, scrim, form, success
---

## Modal

A fixed scrim at 45% black with a 4px blur centers a white card: 400px (580px wide variant), 16px radius, 2rem 1.75rem 1.75rem padding, deep soft shadow. A muted close button sits top-right. Content is a blue icon tile, a navy title, a secondary subtitle, an optional benefits list, then stacked full-width actions and a muted dismiss link.

**Incorrect (opaque scrim, small radius, side-by-side actions, hard shadow):**

```jsx
<div style={{ background: "#000a" }}>
  <div style={{ borderRadius: 6, boxShadow: "0 0 20px #000" }}>
    <button>Cancel</button><button>OK</button>
  </div>
</div>
```

**Correct (prompt, form, and success):**

```jsx
<div className="modal-overlay" onClick={close}>
  <div className="modal-card" onClick={e => e.stopPropagation()}>
    <button className="modal-close" onClick={close}><XIcon /></button>

    <div className="modal-prompt-icon"><BookmarkIcon size={24} /></div>
    <h3 className="modal-title">Save jobs to your list</h3>
    <p className="modal-subtitle">Create a free account to keep track of roles you like.</p>
    <ul className="modal-benefits">
      <li><CheckIcon /> Bookmark any posting</li>
      <li><CheckIcon /> Get alerts when new roles appear</li>
    </ul>
    <div className="modal-actions">
      <button className="modal-cta-primary">Sign up free</button>
      <button className="modal-cta-secondary">Sign in</button>
    </div>
    <button className="modal-dismiss-link">Maybe later</button>
  </div>
</div>

{/* Wide form variant */}
<div className="modal-card modal-card-wide">
  <form className="inquiry-form">
    <div className="inquiry-row">
      <div className="inquiry-field">...</div>
      <div className="inquiry-field">...</div>
    </div>
    <div className="inquiry-actions">
      <button type="button" className="inquiry-cancel">Cancel</button>
      <button type="submit" className="modal-cta-primary" style={{ width: "auto" }}>Send</button>
    </div>
  </form>
</div>

{/* Success state */}
<div className="modal-success">
  <div className="modal-success-icon"><CheckIcon size={28} /></div>
  <h3 className="modal-success-title">You're in</h3>
  <p className="modal-success-desc">We'll email you within two days.</p>
  <button className="modal-cta-primary">Done</button>
</div>
```

### Spec

| Part | Spec |
|---|---|
| Overlay | fixed inset 0, `rgba(0,0,0,0.45)`, blur 4px, z 200, flex center, 1rem padding |
| Card | white, 16px radius, 400px (580 wide), 2rem 1.75rem 1.75rem (1.75rem 1.25rem 1.5rem mobile), `0 24px 80px rgba(0,0,0,0.18)` |
| Close | absolute 1rem, muted, hover secondary, 4px radius |
| Icon tile | 52×52, 12px radius, blue 6% fill, blue icon, 1.25rem below |
| Title | 1.15rem 800 navy, -0.3px |
| Subtitle | 0.88rem secondary, lh 1.6, 1.25rem below |
| Benefits | list, 0.5rem gap, 0.85rem secondary, blue check icons |
| Actions | column, 0.5rem gap, full-width filled then neutral outline |
| Dismiss | 0.78rem muted text button, centered |
| Success icon | 64px circle, green 8% fill, green icon |
| Form | `inquiry-form` column 0.85rem gap; actions right-aligned with neutral cancel |

### Key rules

- **Actions stack vertically**, primary first. Only form modals put cancel and submit side by side, right-aligned.
- **Click on the scrim closes**; stop propagation on the card.
- **One modal recipe.** Confirmations, prompts, and forms all use `modal-card`.
- **The icon tile is optional** but when present it is blue 6% with a blue glyph, or green for success.

Source: `web/app/globals.css` lines 2095-2372

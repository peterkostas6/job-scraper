---
title: Toggle Switch
impact: MEDIUM
impactDescription: The on/off control for notification settings.
tags: toggle, switch, on, off, settings, notifications
---

## Toggle Switch

A 44×24 pill button. Off is `#d1d5db`, on is blue. A 20px white knob with a soft shadow slides 20px. It sits at the right of a `notif-toggle-row` with a 0.88rem 600 label on the left.

**Incorrect (native checkbox, green on-state, square):**

```jsx
<input type="checkbox" style={{ width: 40, accentColor: "green" }} />
```

**Correct:**

```jsx
<div className="notif-section">
  <div className="notif-section-title">Email alerts</div>
  <div className="notif-section-desc">One digest every 8 hours with matching roles.</div>
  <div className="notif-toggle-row">
    <span className="notif-toggle-label">Enabled</span>
    <button
      className={`notif-toggle${on ? " notif-toggle-on" : ""}`}
      role="switch" aria-checked={on} onClick={() => setOn(!on)}>
      <span className="notif-toggle-knob" />
    </button>
  </div>
</div>
```

### Spec

| Part | Spec |
|---|---|
| Track | 44×24, 100px radius, no border, `#d1d5db` off, `var(--forest-blue)` on, 0.2s |
| Knob | 20px circle, white, top/left 2px, `0 1px 3px rgba(0,0,0,0.15)`, `translateX(20px)` on |
| Label | 0.88rem 600 primary |
| Row | flex space-between, align center |
| Section | title 0.88rem 600, desc 0.75rem muted, 1.5rem bottom margin + padding, hairline bottom (none on last) |

### Key rules

- **On is blue, not green.** Green is reserved for "new" and success badges. (The landing-page demo toggle uses green; that is the mock, not the product.)
- **It is a `<button role="switch">`**, not a styled checkbox.
- **Only the knob moves and only the track recolors.** No label color change.

Source: `web/app/globals.css` lines 1789-1856

---
title: Pill Toggles & Chips
impact: HIGH
impactDescription: Filters and multi-select options share one selected-state recipe. Diverging makes filters look like separate widgets.
tags: chip, pill, toggle, filter, checkbox, radio, selected, segmented
---

## Pill Toggles & Chips

Selectable options are bordered white pills or chips. At rest they are muted; selected they take a 6-8% blue fill, a 20-25% blue border, and blue or primary text. Checkbox and radio inputs are wrapped in a chip and use `accent-color` blue.

**Incorrect (native checkbox beside plain text, solid blue selected state):**

```jsx
<label><input type="checkbox" /> JPMorgan</label>
<button style={{ background: "#2563eb", color: "#fff" }}>Saved</button>
```

**Correct (chip wrappers and the pill toggle):**

```jsx
{/* Multi-select chips */}
<div className="notif-checkboxes">
  <label className="notif-checkbox">
    <input type="checkbox" checked={on} onChange={...} /> JPMorgan
  </label>
</div>

{/* Single-select chips */}
<div className="notif-radio-group">
  <label className="notif-radio"><input type="radio" name="type" /> Analyst</label>
  <label className="notif-radio"><input type="radio" name="type" /> Internship</label>
</div>

{/* Pill toggle with icon */}
<button className={`saved-toggle${showSaved ? " saved-toggle-active" : ""}`}>
  <BookmarkIcon /> Saved
</button>
```

```css
/* Recipe for a new chip */
.my-chip {
  font-size: 0.82rem;
  color: var(--text-secondary);
  padding: 0.4rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--white);
  cursor: pointer;
  transition: all 0.15s;
}
.my-chip:hover { border-color: rgba(37, 99, 235, 0.3); }
.my-chip-selected {
  background: rgba(37, 99, 235, 0.06);
  border-color: rgba(37, 99, 235, 0.25);
  color: var(--text-primary);
}
```

### Variants

| Variant | Radius | Font | Rest | Hover | Selected | Classes |
|---|---|---|---|---|---|---|
| Chip (checkbox/radio) | 8px | 0.82rem, secondary | white, hairline | border blue 30% | blue 6% fill, blue 25% border, primary text | `notif-checkbox`, `notif-radio` (`:has(input:checked)`) |
| Pill toggle | 100px | 0.75rem 500, muted | white, hairline | border blue 30%, text secondary | blue 8% fill, blue 20% border, blue text | `saved-toggle` + `saved-toggle-active` |
| Mobile segment | 100px | 0.72rem 600, secondary | none, hairline | blue 4% fill | solid navy, white text | `mobile-pro-pill` + `-active`; `-locked` = 50% opacity, dashed border |
| Demo chip | 4px | 0.62rem 500, muted | white, `#d1d5db` | | blue border + text, navy 6% fill | `demo-chip` + `demo-chip-on` (landing mock only) |

### Key rules

- **Selected is a tint, not a fill.** The only solid selected state is the mobile segment (navy), which mirrors the sidebar's active item.
- **Chips are 8px, toggles are 100px.** A chip holds a checkbox or radio; a toggle is a standalone button.
- **Native inputs stay visible** inside chips (14×14, `accent-color: var(--forest-blue)`). Do not hide them and fake a check.
- **Hover only touches the border** (blue 30%). Fill changes are reserved for selected.
- **Groups use `flex-wrap` with 0.5rem gap.**

Source: `web/app/globals.css` lines 1273-1298, 1858-1929, 3001-3039

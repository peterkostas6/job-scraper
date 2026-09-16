---
title: Inputs, Selects & Search
impact: HIGH
impactDescription: Every field shares one shape and one focus treatment.
tags: input, select, search, field, form, focus, placeholder, dropdown
---

## Inputs, Selects & Search

Fields are white, hairline-bordered, 8px radius, 0.85rem primary text, muted placeholder. Focus turns the border blue and adds a 3px ring at 10% blue. Search adds a leading muted icon (absolute, 0.75rem from the left) and a trailing clear button. Selects share the input recipe.

**Incorrect (grey fill, default outline, no ring, px sizing):**

```jsx
<input style={{ background: "#f3f4f6", border: "2px solid #ccc", fontSize: 14 }} />
```

**Correct (search, select, and form field):**

```jsx
<div className="filters">
  <div className="search-wrapper">
    <SearchIcon className="search-icon" />
    <input className="search-bar" placeholder="Search roles..." value={q} onChange={...} />
    {q && <button className="search-clear" onClick={() => setQ("")}><XIcon /></button>}
  </div>
  <select className="filter-dropdown">...</select>
</div>

<div className="inquiry-field">
  <label className="inquiry-label">Email <span className="inquiry-required">*</span></label>
  <input className="inquiry-input" type="email" placeholder="you@school.edu" />
  {error && <p className="inquiry-error">{error}</p>}
</div>
```

```css
/* Field recipe */
.my-input {
  font-family: inherit;
  font-size: 0.85rem;
  padding: 0.55rem 0.85rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--white);
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.my-input:focus {
  border-color: var(--forest-blue);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}
.my-input::placeholder { color: var(--text-muted); }
```

### Variants

| Variant | Padding | Extra | Classes |
|---|---|---|---|
| Search | 0.55rem 2.2rem 0.55rem 2.3rem | leading icon, clear button, flex 1 with 200-360px width | `search-wrapper`, `search-icon`, `search-bar`, `search-clear` |
| Select | 0.55rem 0.9rem | same focus ring | `filter-dropdown` |
| Form field | 0.55rem 0.85rem | label above at 0.75rem 600 secondary, error below at 0.8rem red | `inquiry-input`, `inquiry-label`, `inquiry-error` |
| Phone | 0.5rem 0.75rem, max 240px | lighter focus (border blue 40%, no ring) | `notif-phone-input` |
| Sidebar mini search | 0.35rem 0.5rem 0.35rem 1.75rem | `#f8fafc` bg, `#e2e8f0` border, 6px radius, 0.78rem; focus `#93c5fd` border + white bg | `bank-search-input` |
| Mobile select | 0.55rem 2rem 0.55rem 0.75rem | cream bg, custom chevron via data-URI, `appearance: none` | `mobile-bank-select` |

### Key rules

- **`outline: none` and replace it with the ring.** Never leave a field with no visible focus.
- **Focus ring is `0 0 0 3px rgba(37,99,235,0.1)`** plus the blue border. Same on selects.
- **Icons inside fields are absolutely positioned, `pointer-events: none`, `--text-muted`.**
- **Labels sit above** at 0.75rem 600 secondary, 0.3rem gap. Required marks are `#dc3535`.
- **Fields in a row use `filters` (0.6rem gap, wrap).** Two-column form rows use `inquiry-row`.
- **`font-family: inherit` on every input, select, textarea.**

Source: `web/app/globals.css` lines 1028-1048, 1186-1258, 2005-2022, 2306-2347

---
title: App Sidebar
impact: MEDIUM-HIGH
impactDescription: The sidebar is the app's primary navigation. Its active state is the only solid navy control.
tags: sidebar, navigation, app, active, group, count, scroll
---

## App Sidebar

A 240px white rail (200px under 1024px, hidden under 768px), sticky under the nav, with a hairline right border. Groups start with an uppercase muted header. Items are full-width 8px-rounded buttons with a label left and a count or lock right. The active item is solid navy with white text.

**Incorrect (blue active fill, left accent bar, bold labels):**

```jsx
<button style={{ background: "#2563eb", color: "#fff", borderLeft: "4px solid navy", fontWeight: 700 }}>JPMorgan</button>
```

**Correct (sidebar structure):**

```jsx
<aside className="sidebar">
  <div className="sidebar-header">Banks</div>
  <div className="bank-search-wrap">
    <SearchIcon className="bank-search-icon" />
    <input className="bank-search-input" placeholder="Find a bank" />
  </div>
  <div className="banks-scroll">
    {banks.map(b => (
      <button key={b.key} className={`sidebar-item${b.key === active ? " sidebar-item-active" : ""}`}>
        <span><span className="bank-name-full">{b.name}</span><span className="bank-name-short">{b.shortName}</span></span>
        <span className="sidebar-count">{counts[b.key]}</span>
      </button>
    ))}
  </div>
  <div className="sidebar-divider" />
  <div className="sidebar-header">You</div>
  <button className="sidebar-item">
    <span className="sidebar-saved-label"><BookmarkIcon /> Saved</span>
    <span className="sidebar-count">{saved.length}</span>
  </button>
  <button className="sidebar-item">
    <span>Recent</span>
    {isPro ? <span className="sidebar-count sidebar-count-teaser">3 new</span> : <LockIcon className="sidebar-lock" />}
  </button>
</aside>
```

### Spec

| Part | Spec |
|---|---|
| Rail | 240px, white, hairline right, 1.5rem 0.75rem padding, sticky top 56px, height calc(100vh - 56px), scroll y |
| Group header | 0.65rem 600 uppercase 1px muted, 0 0.75rem padding, 0.75rem below |
| Item | full width, flex space-between, 0.65rem 0.75rem, 8px radius, 0.85rem 500 secondary, 0.15rem bottom margin |
| Item hover | blue 4% fill, primary text |
| Item active | `var(--navy)` fill, white text (hover unchanged) |
| Count | 0.7rem 600 at 50% opacity (inherits white on active) |
| Teaser count | amber pill (see `badge-tag`) |
| Lock | muted icon, no shrink |
| Divider | 1px `var(--border)`, 0.75rem vertical margin |
| Scroll area | `banks-scroll`: max 218px, 3px scrollbar, `#cbd5e1` thumb |
| Mini search | see `input-field` |

### Key rules

- **Active is solid navy.** Not blue, not a tint, not a left bar. This mirrors the logo and the mobile active pill.
- **Counts are opacity, not color**, so they read on both white and navy.
- **Locked items show a lock icon in place of the count**, and the click opens the paywall.
- **Only two solid-navy controls exist**: the active sidebar item and the mobile active segment. Do not add more.
- **On mobile the sidebar is replaced by `mobile-top-bar`** (select + pill row), not collapsed into a drawer.

Source: `web/app/globals.css` lines 918-1060, 2902-2905, 2957-3039

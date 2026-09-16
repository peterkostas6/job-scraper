---
title: Loading, Skeleton & Empty States
impact: MEDIUM
impactDescription: Waiting and nothing-found states should look like part of the list, not an interruption.
tags: loading, spinner, skeleton, shimmer, empty, fade-in, state
---

## Loading, Skeleton & Empty States

Loading is either a 32px spinner (blue arc on a hairline ring) centered in 6rem of padding, or skeleton rows shaped like the real job row with a cream shimmer. Empty is two lines of grey text centered in 5rem of padding. Lists fade in on mount.

**Incorrect (text "Loading...", grey box, red empty message):**

```jsx
{loading && <p>Loading...</p>}
{!jobs.length && <div style={{ color: "red" }}>No results!</div>}
```

**Correct:**

```jsx
{/* Spinner */}
{loading && (
  <div className="loading-state">
    <div className="spinner" />
    <p className="results-text">Fetching live postings...</p>
  </div>
)}

{/* Skeleton rows inside the list container */}
<div className="jobs-list">
  {[...Array(6)].map((_, i) => (
    <div key={i} className="job-row skeleton-row">
      <span className="skeleton skeleton-index" />
      <span className="skeleton skeleton-title" />
      <span className="skeleton skeleton-location" />
      <span className="skeleton skeleton-badge" />
    </div>
  ))}
</div>

{/* Empty */}
<div className="empty-state">
  <div className="empty-title">No roles match</div>
  <div className="empty-desc">Try another bank or clear your search.</div>
</div>

{/* Loaded */}
<div className="jobs-list fade-in">...</div>
```

### Spec

| Part | Spec |
|---|---|
| Spinner | 32px, 3px `var(--border)` ring, blue top, 0.8s linear spin |
| Loading wrap | column, centered, 6rem 2rem padding, 1.5rem gap |
| Skeleton | gradient `#f0eeeb` / `#e8e5e1` / `#f0eeeb`, 200% size, 1.5s shimmer, 4px radius |
| Skeleton parts | index 24×14, title flex 1 ×14, location 100×14, badge 72×22 at 100px radius |
| Empty wrap | column, centered, 5rem 2rem, 0.6rem gap |
| Empty title | 0.95rem 600 secondary |
| Empty desc | 0.82rem muted |
| Fade-in | 0.3s ease, opacity 0→1, 6px rise |

### Key rules

- **Skeletons are cream-toned**, not grey, so they match the page.
- **Skeleton rows use the real `job-row` class** so spacing is identical when data lands.
- **Empty states are calm**: secondary title, muted hint, no icon required, no color.
- **Errors use `error-banner`** (see `banner-callout`), never the empty state.

Source: `web/app/globals.css` lines 1531-1611

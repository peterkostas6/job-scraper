---
title: Job List & Row
impact: HIGH
impactDescription: The jobs list is the product. Its anatomy and hover language define how all data lists should look.
tags: list, row, table, job, hover, header, bookmark, expired, data
---

## Job List & Row

The list is a white container with a 10px radius, hairline border, and the quiet list shadow. It opens with an uppercase column header on a faint grey band. Each row is a flex line: index, title (flex 1), centered location, badges, bookmark, arrow. Hover tints the row 3% blue and lights a 3px left rail. Any future data list (saved jobs, recent, admin) uses the same anatomy.

**Incorrect (HTML table with borders, zebra stripes, underlined links):**

```jsx
<table border="1">
  <tr style={{ background: "#eee" }}><td><a href="...">Analyst, IB</a></td></tr>
</table>
```

**Correct (list container, header, rows):**

```jsx
<div className="jobs-list fade-in">
  <div className="job-row-header">
    <span className="job-index">#</span>
    <span className="job-title">Role</span>
    <span className="job-location">Location</span>
    <span className="job-badges">Type</span>
  </div>

  {jobs.map((job, i) => (
    <a key={job.link} href={job.link} target="_blank" rel="noopener noreferrer"
       className={`job-row${job.expired ? " job-row-expired" : ""}`}>
      <span className="job-index">{i + 1}</span>
      <span className="job-title">{job.title}</span>
      <span className="job-location">{job.location}</span>
      <div className="job-badges">
        <span className={`job-badge ${isIntern(job) ? "badge-intern" : "badge-analyst"}`}>
          {isIntern(job) ? "Intern" : "Analyst"}
        </span>
      </div>
      <button className={`job-bookmark${saved ? " job-bookmark-active" : ""}`} onClick={toggleSave}>
        <BookmarkIcon />
      </button>
      <ArrowRightIcon className="job-arrow" />
    </a>
  ))}
</div>
```

### Anatomy

| Part | Spec |
|---|---|
| Container | `jobs-list`: white, 10px radius, hairline, list shadow, `overflow: hidden` |
| Header | `job-row-header`: 0.55rem 1.25rem padding, `rgba(0,0,0,0.015)` band, `rgba(0,0,0,0.08)` bottom border; children 0.62rem 600 uppercase 1px muted |
| Row | `job-row`: flex, 1rem gap, 0.75rem 1.25rem padding, `rgba(0,0,0,0.04)` bottom border (none on last), 3px transparent left border, `color: inherit`, no underline |
| Row hover | bg blue 3%, left border blue, title to navy, arrow blue and `translateX(3px)` |
| Index | 0.72rem 600 muted, tabular numbers, min-width 1.5rem |
| Title | 0.85rem 500 primary, lh 1.4, `flex: 1` |
| Location | 0.75rem muted, 100-180px, centered, ellipsis |
| Badges | flex, 0.4rem gap, no shrink |
| Bookmark | `#ddd` at rest, blue + `scale(1.15)` on hover, blue when active |
| Arrow | `#ddd` at rest |
| Expired | `job-row-expired`: 55% opacity, title line-through at 25% black |
| Grouping label | `new-bank-label`: 0.72rem 600 muted, 80px min (Recent tab) |

### Mobile (768px)

Header hidden. Row wraps with 0.85rem 1rem padding and 2.75rem right padding; title full width at 0.84rem; location inline at 0.72rem; badges 0.54rem; bookmark absolute at right 0.75rem, vertically centered; index and arrow hidden; no left rail.

### Key rules

- **Rows are `<a>` elements** (whole row is the link) with `color: inherit` and `text-decoration: none`.
- **Hover is the 3px blue left rail plus 3% tint.** No zebra striping, no row shadow, no underline.
- **Column header is an eyebrow**, not a bold table header.
- **Dividers between rows are 4% black**, lighter than the hairline. The header bottom is 8%.
- **The list fades in** (`fade-in`: 0.3s, 6px rise) on mount.
- **Lists never have their own page background.** They sit on cream.

Source: `web/app/globals.css` lines 1596-1765, 2456-2463, 3113-3171

---
title: Top Navigation
impact: MEDIUM-HIGH
impactDescription: The nav is on every page. Its height sets the sticky offset for everything else.
tags: nav, header, logo, sticky, frosted, bell, sign-in
---

## Top Navigation

A sticky bar, 56px tall, cream at 85% with a 12px backdrop blur and a hairline bottom. Left is the navy "P" tile. Right is a row of ghost text links, an optional bell, and an outlined blue sign-in (or the Clerk user button when signed in).

**Incorrect (white opaque bar, shadow, bold links, filled sign-in):**

```jsx
<nav style={{ background: "#fff", boxShadow: "0 2px 8px #0002" }}>
  <a style={{ fontWeight: 700 }}>Dashboard</a>
  <button style={{ background: "#2563eb", color: "#fff" }}>Sign in</button>
</nav>
```

**Correct (nav structure):**

```jsx
<nav>
  <div className="nav-inner">
    <span className="logo logo-link" onClick={goHome}>
      <svg className="logo-icon" width="30" height="30" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="var(--navy)"/>
        <text x="16" y="23" textAnchor="middle" fontFamily="inherit" fontWeight="800" fontSize="20" fill="#fff">P</text>
      </svg>
    </span>
    <div className="nav-right">
      <button className="nav-link">Dashboard</button>
      <button className={`nav-link nav-link-new${active ? " nav-link-active" : ""}`}>
        <SparkIcon /> Recent
      </button>
      <button className="nav-link">Pricing</button>
      <button className={`nav-bell${open ? " nav-bell-active" : ""}`}>
        <BellIcon />{hasNew && <span className="nav-bell-dot" />}
      </button>
      <SignInButton><button className="nav-signin">Sign in</button></SignInButton>
    </div>
  </div>
</nav>
```

### Spec

| Part | Spec |
|---|---|
| Bar | sticky top 0, z 100, `rgba(250,248,245,0.85)`, `backdrop-filter: blur(12px)`, hairline bottom |
| Inner | 1400px, 0.85rem 2rem padding (0.75rem 1rem mobile), flex space-between |
| Logo | 30px (26 mobile) navy tile, 8px radius, white "P" 800 |
| Link | 0.8rem 500 secondary, 0.45rem 0.75rem, hover primary, 0.25rem right margin |
| Highlighted link | `nav-link-new`: blue 600 with icon |
| Active link | `nav-link-active`: primary text, blue 6% fill, 6px radius |
| Bell | 34×34, 8px radius, secondary; hover primary + subtle bg; active blue + blue 6%; dot 7px green with 1.5px white ring at top-right 5px |
| Sign-in | outlined blue small button (see `button-primary`) |

### Key rules

- **56px total height.** Sticky children (sidebar, mobile top bar) use `top: 56px`.
- **Frosted cream, never opaque white**, so the page shows through on scroll.
- **Links are ghost buttons**, not anchors with underlines. One is highlighted blue at most.
- **Sign-in is outlined, not filled.** The filled blue button belongs in the hero, not the nav.
- **`.nav-bell:hover` references `--bg-subtle`, which is undefined.** If you touch it, define `--bg-subtle: rgba(37,99,235,0.04)` in `:root`.

Source: `web/app/globals.css` lines 27-92, 1965-2002, 2522-2539

# Sections

Section IDs are the filename prefixes used to group rules.

---

## 1. Tokens & Color (colors)

**Impact:** HIGH
**Description:** One palette, defined as custom properties in `globals.css`. Cream page, white surfaces, navy for headings and active states, one blue accent, three greys for text. Blue tints are always the accent at a fixed opacity step, never a second blue. Semantic colors (green, amber, red) are each a text / fill / stroke triplet.

## 2. Typography (font)

**Impact:** HIGH
**Description:** Inter everywhere, loaded from Google Fonts at 400/500/600/700/800. Display and section headings are 800 in navy with negative tracking. UI text lives in a tight rem scale between 0.72 and 0.95. Uppercase tracked micro labels are the site's signature for eyebrows, list headers, and plan names.

## 3. Layout & Spacing (layout, responsive)

**Impact:** HIGH
**Description:** Three max-widths: 900px marketing column, 1100px pricing, 1400px app shell. Sections separate with 1px hairline top borders and 3 to 5rem of padding, not with background changes. Radii, shadows, and transition durations come from small fixed scales. One breakpoint at 768px.

## 4. Buttons (button)

**Impact:** HIGH
**Description:** Four button tones: filled blue (primary action), outlined blue (secondary on marketing), neutral outline (secondary in app), ghost text (tertiary). All Inter 600, 6 to 8px radius, `font-family: inherit`. Pill toggles and chips are a separate family with 100px or 8px radius and a blue-tint selected state.

## 5. Tags & Badges (badge)

**Impact:** MEDIUM-HIGH
**Description:** Small uppercase pills that classify a row or card. Analyst is blue, Intern is amber, New is green, neutral is slate. Fill is the text color at 8% opacity (or a matching light tint), no border. The solid blue "Popular" tag is the one filled variant.

## 6. Inputs & Search (input)

**Impact:** HIGH
**Description:** White field, hairline border, 8px radius, 0.85rem text. Focus turns the border blue and adds a 3px ring at 10% blue. Search adds a leading muted icon and a trailing clear button. Selects share the input style.

## 7. Surfaces (card, banner, dark)

**Impact:** HIGH
**Description:** Cards are white on cream with a hairline border and 12 to 16px radius; shadow is reserved for the jobs list, the app preview, and featured plans. Banners are tinted callouts in blue, amber, or red. The one dark surface is the navy club block on pricing.

## 8. Data List (job-row)

**Impact:** HIGH
**Description:** The jobs list is the product. White container with 10px radius and a quiet shadow, an uppercase column header on a 1.5% grey band, rows with a 3px transparent left rail that turns blue on hover. On mobile the header hides and rows wrap into cards.

## 9. Navigation (nav, sidebar)

**Impact:** MEDIUM-HIGH
**Description:** Sticky frosted cream top bar with a navy "P" tile logo. App pages add a 240px white sidebar with uppercase group headers and 8px rounded items; the active item is solid navy with white text.

## 10. Overlays & Controls (modal, toggle)

**Impact:** MEDIUM
**Description:** Modals sit on a 45% black scrim with 4px blur, white card at 16px radius and a deep soft shadow, actions stacked full width. The toggle switch is 44×24, grey off and blue on.

## 11. States (state)

**Impact:** MEDIUM
**Description:** Loading is a 32px blue-arc spinner or shimmering skeleton rows shaped like the real row. Empty states are two lines of grey text centered in generous padding. Lists fade in on mount.

## 12. Icons (icon)

**Impact:** MEDIUM
**Description:** Inline SVG in the Lucide style. 24 viewBox, `stroke="currentColor"`, `strokeWidth` 2 (2.5 for 13-14px glyphs), round caps and joins. Color comes from the parent's `color`.

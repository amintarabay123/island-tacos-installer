---
name: Admin sidebar scalloped-tab effect
description: How the active nav item visually merges with the main content area in admin.tsx
---

## The effect
The active sidebar item appears to "become part of" the main content area:
- The sidebar has a distinctly darker bg (`SB_BG = "#0e1020"`) vs the main page bg (`BG = "#16172b"`).
- The active nav item gets `background: BG` and `border-radius: "12px 0 0 12px"` (left-rounded, right edge flush).
- A left orange accent bar (`border-left: 3px solid OR`) marks it as selected.
- Two CSS pseudo-elements (injected via a `<style>` tag — `SIDEBAR_CSS` const at module level) add concave "scallop" corners above and below the active item's right edge, colored `SB_BG`, visually carving away the sidebar bg around the transition point.

## Implementation notes
- `SIDEBAR_CSS` is a template-literal string with `::before` / `::after` rules on `.nav-tab-active`.
- The class `nav-tab-active` is applied to the wrapper element of the active item only.
- The nav container must have `overflow: visible` (NOT `overflow-y: auto`) or the pseudo-elements get clipped. With ~10 items this is fine; add a scroll wrapper above if item count grows.
- `overflow: visible !important` is declared in `.nav-tab-active` as a safeguard against parent styles accidentally overriding it.
- The `<style>` tag is rendered inside the desktop sidebar branch only; it injects once into the document head and is harmless on re-renders.

**Why:** The user's design intent (matching the reference dashboard screenshot) is that the selected page "is part of the main screen", not just highlighted inside the sidebar. The visual trick requires a meaningful color contrast between sidebar and content area — do NOT make them the same color or the scallop disappears.

**How to apply:** When restyling or moving the Sidebar component, preserve the `SB_BG` ≠ `BG` color split and the `SIDEBAR_CSS` injection. If the concave corners stop showing, check: (1) nav container is `overflow: visible`, (2) `SB_BG` and `BG` are different colors, (3) `nav-tab-active` class is on the right element.

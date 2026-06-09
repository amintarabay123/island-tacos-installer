---
name: Receipt PDF logo and layout
description: Where the receipt logo lives, how it's bundled, and what the approved layout looks like.
---

## Logo file

- **Source**: `artifacts/api-server/src/assets/receipt-logo.png`
  Resized from `attached_assets/logopng_1780957500566.png` (7680×4320, the owner-uploaded logo)
  down to 390×195px / ~27KB using Pillow.
- **Bundled to**: `artifacts/api-server/dist/assets/receipt-logo.png`
  `build.mjs` runs `cp(src/assets → dist/assets)` before esbuild. This keeps the logo inside
  the api-server artifact — the two Replit deployment containers don't share a filesystem.
- **Path resolution** in `receipt-pdf.ts` tries candidates in order:
  1. `__dir/assets/receipt-logo.png` (production: `dist/assets/`)
  2. `__dir/../src/assets/receipt-logo.png` (dev/tsx: `src/assets/`)
  3. `cwd/src/assets/receipt-logo.png` (fallback)

**Why:** Previous code pointed at `artifacts/island-tacos/public/` — works in dev (shared monorepo)
but breaks in production where each artifact is an isolated container.

## Approved sample layout (80mm thermal, 227pt wide)

Decoded from `sample-receipt.pdf` PDF stream (commit `366223b`):

| Element | Position | Size |
|---|---|---|
| Logo (centered) | x=48.5, y=10 | 130×65 pt |
| Address "Wickhams Cay 1…" | centered | 7pt |
| Email "orders@…" | centered | 7pt |
| Dashed divider | centered | 7pt |
| "ORDER RECEIPT" | centered | bold 9pt |
| "Order #: IT-XXXX" | x=10 | 7pt |
| Date | x=90, right-aligned | 7pt |
| Customer / Payment | x=10 | 7pt |
| Dashed divider | centered | — |
| Col headers ITEM/QTY/PRICE/TTL | x=10/120/140/177 | bold 7.5pt |
| Item rows: name/qty/price/total | x=10/120/138/173 | 7.5pt |
| Modifier lines (+Extra guac) | x=16, gray | 7pt |
| Dashed divider | — | — |
| TOTAL | bold 8pt | — |
| Dashed divider | — | — |
| Footer "Thank you…" / "Pickup Only…" | centered | 7–7.5pt |

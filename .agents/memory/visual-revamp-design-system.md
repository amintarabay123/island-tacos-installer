---
name: Visual Revamp Design System
description: Approved design direction for Island Tacos full-system visual revamp — palette, component patterns, mockup locations, and canvas state.
---

## Status
- Store (customer ordering page): ✅ Done
- Admin dashboard: ✅ Done
- POS (`pos.tsx`): ✅ Done — full dark revamp applied: IL tokens at module level, ItemCard gradient pop-out art, Numpad, PaymentModal, ReceiptModal, HoldModal, DiscountModal, OpenPriceModal, main wrapper/header/left-panel/cart/mobile-tabs/inline-modals all dark-themed. Typecheck passes clean.
- KDS: 🔲 Not started

## Approved Design Direction: "Indigo Luxe"
Inspired by premium SaaS gaming dashboards (deep navy/indigo, pop-out 3D art, vibrant gradient cards).

### Core Palette
```
bg:       #16172b   — unified surface (sidebar + main share this, no hard edge)
card:     #1e1f38   — card/panel surface
border:   rgba(255,255,255,0.06)
tp:       #e8eaf6   — text primary (lavender-white, NOT pure white)
tm:       #7077a1   — text muted

orange:   #ff6b00   — brand primary accent
og:       rgba(255,107,0,0.35)   — orange glow
purple:   #7c6af7   — secondary accent
pg:       rgba(124,106,247,0.35)
green:    #30d158   — success / ready / open
blue:     #0ea5e9   — info / stats
```

### Key Visual Patterns
1. **Pop-out art** — large emoji floats ABOVE card boundary using `position:absolute; top:-34px` with `overflow:visible` on parent. Two emojis: back one rotated/blurred/70% opacity for depth, front one crisp with `drop-shadow` glow.
2. **Full-bleed gradient cards** — the ENTIRE card body is the gradient, not just a top stripe. Each card has its own colour gradient. Add `linear-gradient(155deg, rgba(255,255,255,0.12) 0%, transparent 50%)` shine overlay + a soft radial orb behind the art.
3. **Seamless sidebar** — sidebar `background: transparent`, same `#16172b` as main. Zero border between them. Icons float on the continuous surface.
4. **Pill buttons** — `border-radius: 20px` for primary CTAs, `border-radius: 12-14px` for secondary.
5. **Glow shadows** — primary buttons always have `box-shadow: 0 4-6px 18-28px <color-glow>`.
6. **Status indicators** — coloured glowing dots (`box-shadow: 0 0 8-10px <color>`) inside small pill badges.

### Per-Item Gradient Map (POS/KDS/Store)
- Steak 🥩   → `linear-gradient(145deg,#ff6b00,#ff3d00,#c0392b)` / glow `rgba(255,107,0,0.5)`
- Salmon 🐟  → `linear-gradient(145deg,#0ea5e9,#0284c7,#1e3a8a)` / glow `rgba(14,165,233,0.5)`
- Shrimp 🍤  → `linear-gradient(145deg,#7c6af7,#5b4cf5,#3730a3)` / glow `rgba(124,106,247,0.5)`
- Chicken 🍗 → `linear-gradient(145deg,#f59e0b,#d97706,#92400e)` / glow `rgba(245,158,11,0.5)`
- Veggie 🥗  → `linear-gradient(145deg,#10b981,#059669,#064e3b)` / glow `rgba(16,185,129,0.5)`
- Fries 🍟   → `linear-gradient(145deg,#fbbf24,#f59e0b,#78350f)` / glow `rgba(251,191,36,0.4)`
- Drinks 🥤  → `linear-gradient(145deg,#f43f5e,#e11d48,#9f1239)` / glow `rgba(244,63,94,0.5)`
- Water 💧   → `linear-gradient(145deg,#38bdf8,#0ea5e9,#0c4a6e)` / glow `rgba(56,189,248,0.5)`

### KDS Status Config
- new:       accent `#ff6b00`, bgTint `rgba(255,107,0,0.06)`,  top bar orange gradient
- preparing: accent `#ffd60a`, bgTint `rgba(255,214,10,0.04)`, top bar yellow gradient
- ready:     accent `#30d158`, bgTint `rgba(48,209,88,0.06)`,  top bar green gradient

## Mockup Files
All in `artifacts/mockup-sandbox/src/components/mockups/metallic/`:
- `MetallicStore.tsx`  — Customer ordering page, real menu, floating food emoji hero
- `MetallicPOS.tsx`    — Staff POS, seamless sidebar, pop-out item grid cards
- `MetallicKDS.tsx`    — Kitchen display, pop-out order emojis, gradient item chips
- `MetallicAdmin.tsx`  — Admin dashboard, pop-out stat cards, chart, donut

## Canvas Shape IDs (as of last session)
- `metal-store`  (100, 100)    1280×820
- `metal-pos`    (1500, 100)   1280×820
- `metal-kds`    (2900, 100)   1280×820
- `metal-admin`  (1500, 1157)  1280×820

## Real Store Data Used in Mockups
- Name: Island Tacos
- Phone: 284-544-8088
- Address: Wickhams Cay 1, Road Town, Tortola, BVI
- Email: orders@islandtacosbvi.com
- Tax: $0 (BVI)
- Currency: USD

## Implementation Order (agreed)
1. Store (customer ordering page) — start here
2. Admin dashboard
3. POS
4. KDS

## Notes
- Old direction-a/b/c mockup files still exist in `mockups/direction-a|b|c/` — safe to delete when cleaning up
- Mockup sandbox auto-registers new `.tsx` files in `.generated/mockup-components.ts` via Vite plugin
- Preview URL pattern: `https://<REPLIT_DEV_DOMAIN>/__mockup/preview/metallic/<ComponentName>`
- Canvas iframe updates require `shapeType: "iframe"` in the `updates` object or they error

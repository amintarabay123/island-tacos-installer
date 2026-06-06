---
name: Netaurant SaaS strategy
description: Relationship between Island Tacos and Netaurant repos; product tiers; payment stack
---

## Decision

Island Tacos (this repo) stays untouched as a production system. The SaaS product is built in the Netaurant repo (github.com/amintarabay123/netaurant). No SaaS work happens here.

**Why:** Island Tacos is live in production. Any SaaS architecture changes (multi-tenancy, Clerk auth) would destabilize it. Island Tacos is the reference implementation — proven features get ported into Netaurant, not the reverse.

## Product tiers (Netaurant)

- **Tier 1 "Netaurant Ordering"** (~$29/mo): Online storefront + Expo RX/KDS app. Works alongside any existing POS. No hardware change.
- **Tier 2 "Netaurant Complete"** (~$79/mo): Everything in Tier 1 + Island Tacos POS engine on a mini PC. Full replacement for restaurants without a POS, or in markets where Square/Toast don't operate.

## Payment stack

- **PlaceToPay** (owned by EVERTEC): card payments worldwide (Visa/MC/Amex from any country), primary online payment processor. Merchant account required; supported in 10+ LATAM/Caribbean countries.
- **ATH Móvil Web** (also EVERTEC): Caribbean mobile wallet, complementary to PlaceToPay.
- Both from same vendor (EVERTEC) — one business relationship covers the entire target market.
- User registered for both via Banco Popular (pending approval as of June 2026).

## Expo KDS bridge

The Netaurant Expo KDS app can serve as the KDS for Island Tacos POS with:
1. A thin `/api/kds/orders` adapter endpoint on the Island Tacos API
2. API token auth swap replacing Clerk in the Expo app for mini PC context

This also replaces the customer display Android APK approach on Sunmi devices.

## Target market

Caribbean + Latin America — markets where large US POS vendors (Square, Toast) don't operate well. PlaceToPay covers this geography natively.

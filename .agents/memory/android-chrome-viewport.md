---
name: Android Chrome viewport height
description: Chrome on Android treats 100vh as full screen height including its own URL bar, clipping content at the bottom. Use 100dvh instead.
---

## Rule
Never use `h-screen` or `min-h-screen` (= `100vh`) on pages that must render correctly in Chrome on Android (Sunmi POS device). Use `h-[100dvh]` and `min-h-[100dvh]` instead.

**Why:** Android Chrome's `100vh` includes the browser's own URL bar height (~56px). Content at the bottom of the page gets clipped behind it. `100dvh` (dynamic viewport height) tracks the actual visible area as the URL bar shows/hides. Supported since Chrome 108.

**How to apply:** Any new page or component that uses a full-screen layout (staff login, KDS, POS, protected-route loader, admin sidebar) must use `dvh` variants. The mini PC's kiosk Chrome has no URL bar, so `dvh` = `vh` there — no regression.

Fixed pages (June 2026): staff-login, admin.tsx (POS), kitchen.tsx (KDS), protected-route, admin-layout.

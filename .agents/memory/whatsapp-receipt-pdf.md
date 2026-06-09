---
name: WhatsApp receipt PDF sizing
description: Lessons from debugging the island_tacos_order_receipt template delivery failures
---

## Rules

1. **Always use `logo.png` (512×512, 108KB) for PDF embedding** — never `logo-wordmark.png` (7680×4320, 2.3MB). The wordmark is a print-resolution asset; embedding it inflates the PDF to ~2MB which causes Meta's document delivery to fail silently.

2. **Use `import.meta.url` for asset paths in the api-server bundle** — `process.cwd()` is unreliable (depends on which directory pnpm starts the process from). The bundle lives at `artifacts/api-server/dist/index.mjs`; the logo is at `../../../artifacts/island-tacos/public/logo.png` relative to `__dirname`.

3. **Production deployment is a separate container** — rebuilding locally or restarting the dev workflow does NOT push changes to `orders.islandtacosbvi.com`. A full redeploy (Publish) is required every time.

4. **WhatsApp 132001 "template not found"** — always verify: (a) correct WABA ID owns the sending phone, (b) language code matches exactly what Meta stored (`en_US` not `en`), (c) component structure (header type, param count) matches the approved template.

**Why:** 11-second PDF generation → Meta silently drops the document after accepting it (returns wamid but no delivery). Confirmed: A4 PDF with no logo worked; 80mm PDF with 2MB logo did not.

5. **Meta caches document URLs permanently** — once Meta fetches a PDF from a URL, they serve their cached copy on all future sends to that same URL, even after the server-side content changes. Always append `?t=${Date.now()}` (or any unique parameter) to the PDF URL when constructing the template header, so every send uses a URL Meta hasn't cached.

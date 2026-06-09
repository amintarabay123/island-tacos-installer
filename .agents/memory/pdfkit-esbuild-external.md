---
name: pdfkit esbuild external
description: pdfkit must be marked external in esbuild or it crashes at runtime looking for AFM font files in dist/
---

# pdfkit + esbuild: must be external

**Rule:** Add `"pdfkit"` to the `external` array in `artifacts/api-server/build.mjs` (already done). Never bundle pdfkit.

**Why:** pdfkit reads AFM font metrics files from the filesystem using a path relative to its own `__dirname`. When esbuild bundles the code, `__dirname` in the bundle resolves to `dist/`, so pdfkit looks for `dist/data/Helvetica.afm` — which doesn't exist. Crash on first `new PDFDocument()`.

**How to apply:** If any new PDF library is added that reads its own data files at runtime (afm files, font files, etc.), mark it external in `build.mjs` for the same reason.

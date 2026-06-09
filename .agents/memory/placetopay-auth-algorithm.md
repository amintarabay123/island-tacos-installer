---
name: Placetopay tranKey algorithm
description: Correct tranKey signing algorithm for checkout-test.placetopay.com (confirmed Jun 2026)
---

## The rule

`tranKey = Base64( SHA-256( rawNonce || seedUTF8 || secretKeyUTF8 ) )`

- `rawNonce` = 16 random bytes (`crypto.randomBytes(16)`)
- `nonce` field in request body = `rawNonce.toString("base64")`
- `seed` = `new Date().toISOString()` (UTC ISO-8601)
- Secret key is concatenated **raw** (UTF-8 bytes) — **no SHA-1 pre-hashing**

**Why:** Exhaustively tested 8 algorithm variants against the live test endpoint.
Only `SHA-256(rawNonce || seed || secretRaw)` returned `status: OK`. All SHA-1
variants (raw and hex) returned error 102. The Placetopay official PHP SDK docs
describe SHA-1 pre-hashing but that algorithm does NOT match these credentials.

**How to apply:** Any future change to `buildAuth()` in
`artifacts/api-server/src/lib/placetopay.ts` must keep this exact form.
If credentials are ever rotated and auth starts failing again, re-run the
8-variant test script to verify the algorithm hasn't changed server-side.

## Error codes

- `101` = Login not found on that endpoint (wrong regional server)
- `102` = Login found, tranKey signature wrong (wrong algorithm or wrong secret)

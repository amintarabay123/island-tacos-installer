#!/usr/bin/env bash
# Anonymous-auth matrix for the Island Tacos API server.
#
# Why this exists:
#   The api-server has a long history of routes that LOOK gated in the source
#   ("guarded below" comments) but at runtime are wide open because the router
#   was mounted before the guard middleware. A real curl-based matrix is the
#   only thing that catches this — typecheck and lint can't.
#
# What it does:
#   For every interesting route, hits it as an anonymous client and asserts the
#   response status code matches the expected gate posture:
#     - PUBLIC routes must answer 200 (storefront / customer display poll / health)
#     - STAFF/ADMIN routes must answer 401 or 403 (never 200, never 5xx)
#     - M2M routes (X-Sync-Secret) must answer 401 without the secret and 200 with it
#
# Usage:
#   API_BASE=http://localhost:80 SYNC_SECRET=xxx bash scripts/src/anon-auth-matrix.sh
#
#   API_BASE defaults to http://localhost:80 (the dev shared proxy).
#   SYNC_SECRET is optional; if unset, the "with secret" check is skipped.
#
# Exit code: 0 on full pass, 1 if ANY case fails.

set -uo pipefail

API_BASE="${API_BASE:-http://localhost:80}"
SYNC_SECRET="${SYNC_SECRET:-}"

pass=0
fail=0
failures=()

# check METHOD PATH EXPECTED_CODES [EXTRA_CURL_ARGS...]
#   EXPECTED_CODES is pipe-separated, e.g. "401|403"
check() {
  local method="$1"; shift
  local path="$1"; shift
  local expected="$1"; shift
  local extra=("$@")

  local code
  if [ "$method" = "GET" ]; then
    code=$(curl -sS -m 5 -o /dev/null -w "%{http_code}" "${extra[@]}" "${API_BASE}${path}" 2>/dev/null || echo "000")
  else
    code=$(curl -sS -m 5 -o /dev/null -w "%{http_code}" -X "$method" \
      -H "Content-Type: application/json" -d '{}' "${extra[@]}" \
      "${API_BASE}${path}" 2>/dev/null || echo "000")
  fi

  if echo "$expected" | tr '|' '\n' | grep -qx "$code"; then
    pass=$((pass + 1))
    printf "  \033[32mPASS\033[0m  %-6s %-45s -> %s\n" "$method" "$path" "$code"
  else
    fail=$((fail + 1))
    failures+=("$method $path  got=$code  want=$expected")
    printf "  \033[31mFAIL\033[0m  %-6s %-45s -> %s (want %s)\n" "$method" "$path" "$code" "$expected"
  fi
}

echo "=== Anon-auth matrix against ${API_BASE} ==="
echo

echo "── PUBLIC (anonymous must succeed) ─────────────────────────────────"
check GET  /api/healthz                                  200
check GET  /api/menu/items                               200
check GET  /api/menu/categories                          200
check GET  /api/menu/popular                             200
check GET  /api/menu/modifiers                           200
check GET  /api/store-settings                           200
check GET  /api/settings                                 200
check GET  /api/display                                  200
check GET  /api/download/customer-display.apk            200
# /customers/lookup is intentionally public (online "My Orders" page).
# If we add OTP, change this to 401|403.
check GET  /api/customers/lookup?phone=12845551234       200\|400\|404

echo
echo "── STAFF-GATED (anonymous must be rejected) ────────────────────────"
check GET    /api/menu/soldout                           401\|403
check POST   /api/menu/items                             401\|403
check PATCH  /api/menu/items/1                           401\|403
check DELETE /api/menu/items/1                           401\|403
check POST   /api/menu/categories                        401\|403
check PATCH  /api/menu/categories/1                      401\|403
check DELETE /api/menu/categories/1                      401\|403
check POST   /api/menu/soldout/item/1                    401\|403
check POST   /api/menu/soldout/modifier-option           401\|403
check POST   /api/orders/1/refund                        401\|403
check POST   /api/orders/1/add-items                     401\|403
check POST   /api/orders/1/items/mark-made                401\|403
check GET    /api/shifts/current                         401\|403
check POST   /api/shifts                                 401\|403
check GET    /api/cash-transactions                      401\|403
check POST   /api/cash-transactions                      401\|403
check POST   /api/upload                                 401\|403
check POST   /api/storage/uploads/request-url            401\|403
check POST   /api/display                                401\|403
check GET    /api/admin/uploaded-images                  401\|403
check POST   /api/print/network                          401\|403
# SSE endpoint — must reject anon BEFORE opening the stream.
# Use a short timeout so a regression (open stream to anon) shows as 000 (timeout) and fails.
check GET    /api/pos/events                             401\|403 -m 3
# Customer PII / staff-only routes (the public one is /customers/lookup, tested above).
check GET    /api/customers                              401\|403
check GET    /api/customers/stats                        401\|403
check GET    /api/customers/1                            401\|403
check DELETE /api/customers/1                            401\|403
check PATCH  /api/customers/1/notes                      401\|403

echo
echo "── ADMIN-GATED (anonymous must be rejected) ────────────────────────"
check PATCH  /api/settings                               401\|403
check PATCH  /api/store-settings                         401\|403
check GET    /api/system/health                          401\|403
check POST   /api/system/repair/api-process              401\|403
check POST   /api/sync/push                              401\|403
check POST   /api/sync/pull                              401\|403
check POST   /api/loyverse/sync                          401\|403
check GET    /api/reports/sales                          401\|403
# Real /api/admin/* route — verifies the admin prefix guard itself, not just
# the uploaded-images bypass.
check GET    /api/admin/stats                            401\|403

echo
echo "── M2M sync (X-Sync-Secret required) ───────────────────────────────"
check GET   /api/sync/export                             401
check POST  /api/sync/receive                            401
check PATCH /api/sync/settings                           401
check POST  /api/sync/soldout/item/1                     401
check POST  /api/sync/soldout/modifier-option            401

if [ -n "$SYNC_SECRET" ]; then
  # With the right secret, these pass auth. Body-validation 4xx is fine —
  # the point is they MUST NOT return 401 (auth-passed proves the gate works).
  check GET   /api/sync/export                           200       -H "X-Sync-Secret: ${SYNC_SECRET}"
  check POST  /api/sync/receive                          400\|200  -H "X-Sync-Secret: ${SYNC_SECRET}"
  check PATCH /api/sync/settings                         400\|200  -H "X-Sync-Secret: ${SYNC_SECRET}"
else
  echo "  (skipping with-secret checks — SYNC_SECRET env not set)"
fi

echo
echo "── Path-normalisation probes ───────────────────────────────────────"
# Past regression: case/trailing-slash variants slipped past gates that did
# strict path equality. Make sure a few high-impact gated routes still reject
# anon when the URL is mutated.
check POST   /api/MENU/items                             401\|403\|404
check POST   /api/menu/items/                            401\|403\|404
check PATCH  /api/SETTINGS                               401\|403\|404
check PATCH  /api/store-settings/                        401\|403\|404

echo
echo "=== Result: ${pass} passed, ${fail} failed ==="
if [ "$fail" -gt 0 ]; then
  echo
  echo "Failures:"
  for f in "${failures[@]}"; do echo "  - $f"; done
  exit 1
fi
exit 0

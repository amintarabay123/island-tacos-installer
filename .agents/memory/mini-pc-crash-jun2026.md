---
name: Mini PC crash after UPDATE — June 2026
description: API server crash-looping after UPDATE.bat; root cause unknown; plan for next session.
---

# UNRESOLVED — act on this at the start of the next session

## Situation
Mini PC ran UPDATE.bat on 2026-06-09 and the API server (PM2 process "island-tacos") immediately
started crash-looping: ~2s uptime, 319+ restarts. The POS and online ordering are down.

## What we know
- PostgreSQL is up (monitor shows it green).
- The crash is in the api-server process itself, not the DB or network.
- The event log only shows "fetch failed" for api-http — no AI diagnosis because OPENAI_API_KEY
  is not in the mini PC's .env.
- The repair button ("Restart Process") was also failing because it used
  `pm2 restart island-tacos --update-env` (fails on "errored" state). Fixed in latest deploy.
- WhatsApp / SMS alert never fired: MONITOR_ALERT_PHONE not set in mini PC .env.
- User cannot RDP or SSH in tonight (no Windows password on hand, PIN rejected by RDP).

## Code changes already deployed (committed, need UPDATE.bat to reach mini PC)
1. monitor.mjs — added port-3002 log-viewer HTTP server (dark HTML page, auto-refresh 10s,
   shows last 120 lines of island-tacos-error.log + 60 lines stdout + last 15 monitor events).
   After UPDATE, user can open http://100.127.143.98:3002/ to see crash logs without SSH/RDP.
2. monitor.mjs + system.ts — repair command changed to
   `pm2 restart local-install/ecosystem.config.cjs --update-env` (works from errored state).
3. UPDATE.ps1 — adds Windows Firewall rule for port 3002.
4. downloads.ts — MONITOR_ALERT_PHONE + MONITOR_ALERT_WA_PHONE added to pre-filled .env template.

## Plan for tomorrow morning (user goes to shop)
1. Log in physically with Windows PIN.
2. Open Command Prompt → run: `pm2 logs island-tacos --lines 60`
3. Paste output here — that's the actual crash error; fix will be fast once we see it.
4. Run UPDATE.bat to get the deployed fixes (log viewer on :3002, fixed repair cmd).
5. Add to C:\IslandTacos\.env:
   ```
   MONITOR_ALERT_PHONE=+1284XXXXXXX   ← owner's number in E.164
   OPENAI_API_KEY=<same key as cloud>
   ```
6. After crash is fixed: `pm2 restart local-install/ecosystem.config.cjs --update-env`

## Other context
- WhatsApp receipt template `purchase_receipt_3` is still "in review" at Meta.
  When approved: rewrite sendOrderReceiptWhatsApp() in whatsapp.ts to generate PDF
  per-order (pdfkit), upload to object storage, send with document header component.
- WA_TEMPLATE_REMINDER env var is set; WA_TEMPLATE_RECEIPT falls back to 'island_tacos_order_receipt'.

/**
 * System health + repair routes — local mini PC only.
 *
 * GET  /api/system/health        — reads current status and last 20 events from
 *                                  local-install/monitor.db (SQLite), written by
 *                                  local-install/monitor.mjs.
 *                                  Returns { available: false } on cloud (DB absent).
 *
 * POST /api/system/repair/:service — triggers a PM2 restart for recoverable services.
 *                                    Only meaningful on the mini PC; fails gracefully on cloud.
 *
 * Auth is enforced in routes/index.ts:
 *   GET  /api/system/health       → staff
 *   POST /api/system/repair/*     → admin
 */

import { Router } from "express";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const router = Router();
const execAsync = promisify(exec);

// node:sqlite is a Node.js 24 built-in (experimental). No @types/node entry yet,
// so we load it via createRequire and cast. The API server never calls this on
// cloud (where monitor.db won't exist), so the "experimental" risk is low.
const _require = createRequire(import.meta.url);

type SqliteStmt<R = Record<string, unknown>> = {
  all(...params: unknown[]): R[];
};
type SqliteDb = {
  prepare<R = Record<string, unknown>>(sql: string): SqliteStmt<R>;
};

function openMonitorDb(dbPath: string): SqliteDb | null {
  if (!existsSync(dbPath)) return null;
  try {
    const { DatabaseSync } = _require("node:sqlite") as { DatabaseSync: new (path: string) => SqliteDb };
    return new DatabaseSync(dbPath);
  } catch {
    return null;
  }
}

// Resolve monitor.db relative to the project root (process.cwd()).
// PM2 sets cwd to the project root, so this works on both mini PC and cloud.
const MONITOR_DB = join(process.cwd(), "local-install", "monitor.db");

type ServiceRow = {
  service_id: string;
  label: string;
  ok: number;         // SQLite stores booleans as 0/1
  fail_count: number;
  last_check_at: string;
  error: string | null;
  details: string | null;
  updated_at: number;
};

type EventRow = {
  id: string;
  ts: string;
  type: string;
  service: string | null;
  message: string;
  detail: string | null;
  diagnosis: string | null;
  fail_count: number | null;
  created_at: number;
};

// GET /api/system/health
router.get("/system/health", (req, res): void => {
  const db = openMonitorDb(MONITOR_DB);
  if (!db) {
    res.json({ available: false, reason: "Monitor not running on this host (monitor.db not found)" });
    return;
  }

  let statusRows: ServiceRow[] = [];
  let eventRows: EventRow[]    = [];

  try {
    statusRows = db.prepare<ServiceRow>("SELECT * FROM monitor_status ORDER BY service_id").all();
    eventRows  = db.prepare<EventRow>("SELECT * FROM monitor_events ORDER BY created_at DESC LIMIT 20").all();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.warn({ err: msg }, "[system/health] SQLite query failed");
    res.json({ available: false, reason: `SQLite error: ${msg}` });
    return;
  }

  // Normalise SQLite rows to the shape the frontend expects
  const services: Record<string, {
    id: string; label: string; ok: boolean; failCount: number;
    lastCheckAt: string; error?: string; details?: string;
  }> = {};

  for (const row of statusRows) {
    services[row.service_id] = {
      id:          row.service_id,
      label:       row.label,
      ok:          row.ok === 1,
      failCount:   row.fail_count,
      lastCheckAt: row.last_check_at,
      ...(row.error   ? { error:   row.error   } : {}),
      ...(row.details ? { details: row.details } : {}),
    };
  }

  const events = eventRows.map(row => ({
    id:        row.id,
    ts:        row.ts,
    type:      row.type,
    service:   row.service   ?? undefined,
    message:   row.message,
    detail:    row.detail    ?? undefined,
    diagnosis: row.diagnosis ?? undefined,
    failCount: row.fail_count ?? undefined,
  }));

  const svcList = Object.values(services);
  const allOk   = svcList.length > 0 && svcList.every(s => s.ok);

  res.json({
    available: true,
    overall:   allOk ? "ok" : "degraded",
    updatedAt: svcList.length > 0 ? svcList[0]!.lastCheckAt : new Date().toISOString(),
    services,
    events,
  });
});

const REPAIRABLE = new Set(["api-process", "api-http"]);

// POST /api/system/repair/:service
router.post("/system/repair/:service", async (req, res): Promise<void> => {
  const serviceId = req.params["service"] ?? "";

  if (!REPAIRABLE.has(serviceId)) {
    res.status(400).json({
      ok: false,
      error: `'${serviceId}' is not auto-repairable. Repairable: ${[...REPAIRABLE].join(", ")}`,
    });
    return;
  }

  req.log.info({ serviceId }, "[system/repair] manual repair triggered");

  try {
    await execAsync("pm2 restart island-tacos --update-env", { timeout: 15_000 });
    req.log.info("[system/repair] PM2 restart completed");
    res.json({ ok: true, message: "PM2 restart initiated for island-tacos" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.warn({ err: msg }, "[system/repair] PM2 restart failed (expected on cloud)");
    const isCloud = /not found|not recognized|command not found|ENOENT/i.test(msg);
    res.status(503).json({
      ok: false,
      error: isCloud
        ? "PM2 not available on this host (repair only works on the shop mini PC)"
        : msg,
    });
  }
});

export default router;

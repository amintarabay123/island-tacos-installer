/**
 * System health + repair routes — local mini PC only.
 *
 * GET  /api/system/health        — reads current status and last 20 events from
 *                                  local-install/monitor.db (SQLite, written by
 *                                  local-install/monitor.mjs).
 *                                  Returns { available: false } on cloud (DB absent).
 *
 * POST /api/system/repair/:service — triggers a PM2 or pg_ctl restart for
 *                                    recoverable services (api-process, api-http,
 *                                    postgres). Cloud returns 503 with a clear message.
 *
 * Auth is enforced in routes/index.ts:
 *   GET  /api/system/health       → requireStaffAuth
 *   POST /api/system/repair/*     → requireAdminAuth
 */

import { Router } from "express";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { platform } from "node:os";

const router    = Router();
const execAsync = promisify(exec);
const OS        = platform();

// node:sqlite is a Node.js 24 built-in (experimental). We load it via
// createRequire so we can catch if it's unavailable and fall through gracefully.
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

type MetaRow    = { key: string; value: string };
type ServiceRow = {
  service_id:    string;
  label:         string;
  ok:            number;   // SQLite 0 | 1
  fail_count:    number;
  last_check_at: string;
  error:         string | null;
  details:       string | null;
  updated_at:    number;
};
type EventRow = {
  id:        string;
  ts:        string;
  type:      string;
  service:   string | null;
  message:   string;
  detail:    string | null;
  diagnosis: string | null;
  fail_count: number | null;
  created_at: number;
};

// GET /api/system/health
router.get("/system/health", (req, res): void => {
  const db = openMonitorDb(MONITOR_DB);
  if (!db) {
    res.json({
      available: false,
      reason: "Monitor not running on this host (monitor.db not found)",
    });
    return;
  }

  let metaRows:    MetaRow[]    = [];
  let statusRows:  ServiceRow[] = [];
  let eventRows:   EventRow[]   = [];

  try {
    metaRows   = db.prepare<MetaRow>   ("SELECT key, value FROM monitor_meta").all();
    statusRows = db.prepare<ServiceRow>("SELECT * FROM monitor_status ORDER BY service_id").all();
    eventRows  = db.prepare<EventRow>  ("SELECT * FROM monitor_events ORDER BY created_at DESC LIMIT 20").all();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.warn({ err: msg }, "[system/health] SQLite query failed");
    res.json({ available: false, reason: `SQLite error: ${msg}` });
    return;
  }

  // Build meta map (pid, pollCount, platform, nodeVersion)
  const meta: Record<string, string> = {};
  for (const row of metaRows) meta[row.key] = row.value;

  // Normalise SQLite rows → frontend shape
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

  // Detect if the monitor process itself has gone silent.
  // monitor_meta.updated_at is a Unix ms timestamp written every poll cycle (every 30 s).
  // If the freshest row is older than 2 minutes we consider the monitor stale.
  const STALE_MS = 2 * 60 * 1000;
  let monitorStale = false;
  try {
    const freshRow = db
      .prepare<{ ts: number }>("SELECT MAX(updated_at) AS ts FROM monitor_meta")
      .all()[0];
    if (freshRow && typeof freshRow.ts === "number") {
      monitorStale = Date.now() - freshRow.ts > STALE_MS;
    }
  } catch { /* non-fatal */ }

  res.json({
    available:    true,
    overall:      allOk ? "ok" : "degraded",
    updatedAt:    svcList.length > 0 ? svcList[0]!.lastCheckAt : new Date().toISOString(),
    pollCount:    parseInt(meta["pollCount"] ?? "0", 10),
    pid:          parseInt(meta["pid"]       ?? "0", 10),
    platform:     meta["platform"]    ?? OS,
    monitorStale,
    services,
    events,
  });
});

const REPAIRABLE = new Set(["api-process", "api-http", "postgres"]);

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

  let cmd: string;
  let timeout = 15_000;

  if (serviceId === "postgres") {
    if (OS === "win32") {
      cmd = 'powershell -NoProfile -Command "Get-Service -Name \'postgresql*\' | Restart-Service -ErrorAction Stop"';
      timeout = 30_000;
    } else {
      cmd = "systemctl restart postgresql || pg_ctl restart -w";
      timeout = 25_000;
    }
  } else {
    // api-process or api-http — restart ONLY the API app. Using the bare
    // config file restarts every app in it, including the monitor watchdog,
    // which kills it mid-poll and silences alerting (June 2026 incident).
    // startOrRestart + --only re-runs loadEnv() (picks up .env changes) and
    // works even when the process is in "errored" state after max_restarts.
    cmd = "pm2 startOrRestart local-install/ecosystem.config.cjs --only island-tacos --update-env";
  }

  try {
    await execAsync(cmd, { timeout });
    req.log.info({ serviceId, cmd }, "[system/repair] repair command completed");
    res.json({ ok: true, message: `Repair command issued for ${serviceId}` });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.warn({ err: msg, serviceId }, "[system/repair] repair command failed (expected on cloud)");
    const isCloud = /not found|not recognized|command not found|ENOENT|cannot find/i.test(msg);
    res.status(503).json({
      ok: false,
      error: isCloud
        ? `Repair command not available on this host (${serviceId} repair only works on the shop mini PC)`
        : msg,
    });
  }
});

export default router;

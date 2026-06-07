/**
 * System health + repair routes — local mini PC only.
 *
 * GET  /api/system/health        — reads monitor-status.json / monitor-events.json
 *                                  written by local-install/monitor.mjs.
 *                                  Returns { available: false } on cloud (files absent).
 *
 * POST /api/system/repair/:service — triggers a PM2 restart for recoverable services.
 *                                    Only meaningful on the mini PC; fails gracefully on cloud.
 *
 * Auth is enforced in routes/index.ts:
 *   GET  /api/system/health       → staff
 *   POST /api/system/repair/*     → admin
 */

import { Router } from "express";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const router = Router();
const execAsync = promisify(exec);

// Resolve the local-install/ directory relative to the project root (process.cwd()).
// PM2 sets cwd to the project root, so this resolves correctly on both
// the mini PC and the cloud Replit container.
const LOCAL_INSTALL = join(process.cwd(), "local-install");
const STATUS_FILE   = join(LOCAL_INSTALL, "monitor-status.json");
const EVENTS_FILE   = join(LOCAL_INSTALL, "monitor-events.json");

type ServiceSnap = {
  id: string;
  label: string;
  ok: boolean;
  failCount: number;
  lastCheckAt: string;
  error?: string;
  details?: string;
};

type MonitorStatus = {
  updatedAt: string;
  pollCount: number;
  pid: number;
  platform: string;
  services: Record<string, ServiceSnap>;
};

type MonitorEvent = {
  id: string;
  ts: string;
  type: string;
  service?: string;
  message: string;
  detail?: string;
  diagnosis?: string;
  failCount?: number;
};

function readStatus(): MonitorStatus | null {
  if (!existsSync(STATUS_FILE)) return null;
  try { return JSON.parse(readFileSync(STATUS_FILE, "utf-8")) as MonitorStatus; }
  catch { return null; }
}

function readEvents(limit = 100): MonitorEvent[] {
  if (!existsSync(EVENTS_FILE)) return [];
  try {
    const all = JSON.parse(readFileSync(EVENTS_FILE, "utf-8"));
    return Array.isArray(all) ? (all as MonitorEvent[]).slice(0, limit) : [];
  } catch { return []; }
}

// GET /api/system/health
router.get("/system/health", (req, res): void => {
  const status = readStatus();
  if (!status) {
    res.json({ available: false, reason: "Monitor not running on this host" });
    return;
  }

  const services = Object.values(status.services);
  const allOk    = services.length > 0 && services.every(s => s.ok);
  const anyFail  = services.some(s => !s.ok);

  res.json({
    available:  true,
    overall:    allOk ? "ok" : anyFail ? "degraded" : "ok",
    updatedAt:  status.updatedAt,
    pollCount:  status.pollCount,
    pid:        status.pid,
    platform:   status.platform,
    services:   status.services,
    events:     readEvents(100),
  });
});

const REPAIRABLE = new Set(["api-process", "api-http"]);

// POST /api/system/repair/:service
router.post("/system/repair/:service", async (req, res): Promise<void> => {
  const serviceId = req.params["service"] ?? "";

  if (!REPAIRABLE.has(serviceId)) {
    res.status(400).json({ ok: false, error: `'${serviceId}' is not auto-repairable. Repairable: ${[...REPAIRABLE].join(", ")}` });
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
        ? "PM2 not available on this host (cloud environment — repair only works on the shop mini PC)"
        : msg,
    });
  }
});

export default router;

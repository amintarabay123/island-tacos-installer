#!/usr/bin/env node
/**
 * Island Tacos — Monitor & Repair Agent
 *
 * Runs as a PM2 process on the shop mini PC. Every 30 s it:
 *   1. Checks every critical service (API process, HTTP health, Postgres, printer,
 *      SMS gateway, disk space, internet).
 *   2. On the FIRST consecutive failure: attempts an auto-repair (PM2 restart for
 *      recoverable services).
 *   3. On the SECOND consecutive failure: sends an SMS alert + calls OpenAI for a
 *      plain-English diagnosis.
 *   4. Re-escalates every 10 polls (≈5 min) while still failing.
 *
 * Persistence:
 *   local-install/monitor.db — SQLite (node:sqlite built-in) with two tables:
 *     monitor_status  — one row per service, upserted on every poll
 *     monitor_events  — rolling log, newest-first, trimmed to 500 rows
 *
 * These are read by GET /api/system/health in the api-server.
 *
 * Zero external dependencies — only Node.js 24 built-ins.
 */

import { readFileSync, existsSync } from "node:fs";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { createConnection } from "node:net";
import { homedir, platform } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const execAsync  = promisify(exec);

// ── Paths & config ─────────────────────────────────────────────────────────────

const ROOT     = join(__dirname, "..");
const DB_PATH  = join(__dirname, "monitor.db");
const POLL_MS  = 30_000;
const MAX_EVENTS = 500;

// ── .env loader (same logic as ecosystem.config.cjs) ──────────────────────────

function loadDotenv(filePath) {
  if (!existsSync(filePath)) return {};
  const env = {};
  for (const line of readFileSync(filePath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim().replace(/\r/g, "");
    const val = trimmed.slice(idx + 1).trim().replace(/\r/g, "");
    env[key] = val;
  }
  return env;
}

const dotenv  = loadDotenv(join(ROOT, ".env"));
const getEnv  = (k, fallback = "") => process.env[k] ?? dotenv[k] ?? fallback;

const API_PORT      = getEnv("PORT", "3001");
const PRINTER_IP    = getEnv("PRINTER_IP", "");
const PRINTER_PORT  = parseInt(getEnv("PRINTER_PORT", "9100"), 10);
const SMS_GW_URL    = getEnv("SMS_GATEWAY_URL", "");
const SMS_GW_USER   = getEnv("SMS_GATEWAY_USERNAME", "");
const SMS_GW_PASS   = getEnv("SMS_GATEWAY_PASSWORD", "");
const OPENAI_KEY    = getEnv("OPENAI_API_KEY", "");
const ALERT_PHONE   = getEnv("MONITOR_ALERT_PHONE", "");
const SMS_DISABLED  = getEnv("SMS_DISABLED", "") === "true";
const CLOUD_URL     = getEnv("PUBLIC_URL", "https://orders.islandtacosbvi.com");

// ── SQLite bootstrap ───────────────────────────────────────────────────────────

const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS monitor_status (
    service_id    TEXT PRIMARY KEY,
    label         TEXT NOT NULL,
    ok            INTEGER NOT NULL,
    fail_count    INTEGER NOT NULL DEFAULT 0,
    last_check_at TEXT NOT NULL,
    error         TEXT,
    details       TEXT,
    updated_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS monitor_events (
    id         TEXT PRIMARY KEY,
    ts         TEXT NOT NULL,
    type       TEXT NOT NULL,
    service    TEXT,
    message    TEXT NOT NULL,
    detail     TEXT,
    diagnosis  TEXT,
    fail_count INTEGER,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS monitor_events_created_at ON monitor_events (created_at DESC);
`);

// Prepared statements
const upsertStatus = db.prepare(`
  INSERT INTO monitor_status (service_id, label, ok, fail_count, last_check_at, error, details, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (service_id) DO UPDATE SET
    label         = excluded.label,
    ok            = excluded.ok,
    fail_count    = excluded.fail_count,
    last_check_at = excluded.last_check_at,
    error         = excluded.error,
    details       = excluded.details,
    updated_at    = excluded.updated_at
`);

const insertEvent = db.prepare(`
  INSERT INTO monitor_events (id, ts, type, service, message, detail, diagnosis, fail_count, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const trimEvents = db.prepare(`
  DELETE FROM monitor_events
  WHERE id NOT IN (
    SELECT id FROM monitor_events ORDER BY created_at DESC LIMIT ?
  )
`);

// ── Utilities ─────────────────────────────────────────────────────────────────

const nowIso = () => new Date().toISOString();

function log(msg) {
  console.log(`[monitor ${nowIso()}] ${msg}`);
}

/** Append an event to monitor_events and trim to MAX_EVENTS rows. */
function appendEvent(event) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  try {
    insertEvent.run(
      id,
      nowIso(),
      event.type ?? "unknown",
      event.service ?? null,
      event.message ?? "",
      event.detail   ?? null,
      event.diagnosis ?? null,
      event.failCount ?? null,
      Date.now(),
    );
    trimEvents.run(MAX_EVENTS);
  } catch (err) {
    log(`appendEvent error: ${err.message}`);
  }
}

/** Upsert current service state into monitor_status. */
function saveStatus(snap) {
  try {
    upsertStatus.run(
      snap.id,
      snap.label,
      snap.ok ? 1 : 0,
      snap.failCount,
      snap.lastCheckAt,
      snap.error   ?? null,
      snap.details ?? null,
      Date.now(),
    );
  } catch (err) {
    log(`saveStatus error: ${err.message}`);
  }
}

// ── Checkers ──────────────────────────────────────────────────────────────────

/** TCP reachability check. */
function checkTcp(host, port, timeoutMs = 3000) {
  return new Promise(resolve => {
    const socket = createConnection({ host, port });
    const t = setTimeout(() => { socket.destroy(); resolve({ ok: false, error: "TCP timeout" }); }, timeoutMs);
    socket.on("connect", () => { clearTimeout(t); socket.destroy(); resolve({ ok: true }); });
    socket.on("error", err => { clearTimeout(t); resolve({ ok: false, error: err.message }); });
  });
}

/** HTTP/HTTPS health check. */
async function checkHttp(url, method = "GET", timeoutMs = 5000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { method, signal: controller.signal });
    clearTimeout(t);
    return resp.ok ? { ok: true } : { ok: false, error: `HTTP ${resp.status}` };
  } catch (err) {
    clearTimeout(t);
    return { ok: false, error: err.message ?? "fetch failed" };
  }
}

/** PM2 process state check via `pm2 jlist`. */
async function checkPm2() {
  try {
    const { stdout } = await execAsync("pm2 jlist", { timeout: 5000 });
    const list = JSON.parse(stdout.trim());
    const proc = list.find(p => p.name === "island-tacos");
    if (!proc) return { ok: false, error: "island-tacos not in PM2 list" };
    const status = proc.pm2_env?.status ?? "unknown";
    if (status === "online") {
      const uptimeSec = proc.pm2_env?.pm_uptime
        ? Math.floor((Date.now() - proc.pm2_env.pm_uptime) / 1000)
        : 0;
      const restarts = proc.pm2_env?.restart_time ?? 0;
      return { ok: true, details: `online uptime=${uptimeSec}s restarts=${restarts}` };
    }
    return { ok: false, error: `PM2 status=${status}` };
  } catch (err) {
    return { ok: false, error: `pm2 jlist: ${err.message}` };
  }
}

/** Disk space — warn when free < 10% of total. */
async function checkDisk() {
  try {
    if (platform() === "win32") {
      const { stdout } = await execAsync(
        'wmic logicaldisk where "DeviceID=\'C:\'" get FreeSpace,Size /value',
        { timeout: 6000 }
      );
      const free = parseInt(stdout.match(/FreeSpace=(\d+)/)?.[1] ?? "0", 10);
      const size = parseInt(stdout.match(/Size=(\d+)/)?.[1] ?? "1", 10);
      const pct  = size > 0 ? Math.round((free / size) * 100) : 100;
      const gb   = (free / 1e9).toFixed(1);
      if (pct < 10) return { ok: false, error: `C:\\ only ${pct}% free (${gb} GB)` };
      return { ok: true, details: `C:\\ ${pct}% free (${gb} GB)` };
    } else {
      const { stdout } = await execAsync("df -P / | tail -1 | awk '{print $4,$2}'", { timeout: 6000 });
      const [avail, total] = stdout.trim().split(/\s+/).map(Number);
      const pct = total > 0 ? Math.round((avail / total) * 100) : 100;
      if (pct < 10) return { ok: false, error: `/ only ${pct}% free` };
      return { ok: true, details: `/ ${pct}% free` };
    }
  } catch {
    return { ok: true, details: "disk check unavailable" };
  }
}

// ── PM2 log reader ─────────────────────────────────────────────────────────────

async function readPm2Logs(processName = "island-tacos", lines = 50) {
  const logDir = join(homedir(), ".pm2", "logs");
  const readTail = async (filePath) => {
    if (!existsSync(filePath)) return "(not found)";
    try {
      if (platform() === "win32") {
        const { stdout } = await execAsync(
          `powershell -Command "Get-Content '${filePath}' -Tail ${lines} -ErrorAction SilentlyContinue"`,
          { timeout: 5000 }
        );
        return stdout.trim();
      } else {
        const { stdout } = await execAsync(`tail -${lines} "${filePath}"`, { timeout: 5000 });
        return stdout.trim();
      }
    } catch { return "(read error)"; }
  };
  const [out, err] = await Promise.all([
    readTail(join(logDir, `${processName}-out.log`)),
    readTail(join(logDir, `${processName}-error.log`)),
  ]);
  return `--- stdout ---\n${out}\n--- stderr ---\n${err}`;
}

// ── OpenAI diagnosis ───────────────────────────────────────────────────────────

async function callOpenAI(serviceId, errorMsg, logSnippet) {
  if (!OPENAI_KEY) return null;
  const prompt = [
    "You are a systems admin assistant for a restaurant POS (Island Tacos, British Virgin Islands).",
    "A service health check failed twice in a row. Give a 2-3 sentence plain-English diagnosis of",
    "the most likely cause, followed by one concrete actionable fix. Be specific.",
    "",
    `Failed service: ${serviceId}`,
    `Error: ${errorMsg}`,
    "",
    "Recent PM2 logs (truncated):",
    logSnippet.slice(0, 3000),
  ].join("\n");

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 280,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) { log(`OpenAI error: HTTP ${resp.status}`); return null; }
    const data = await resp.json();
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch (err) {
    log(`OpenAI call failed: ${err.message}`);
    return null;
  }
}

// ── SMS alert ─────────────────────────────────────────────────────────────────

async function sendSmsAlert(message) {
  if (SMS_DISABLED)  { log("SMS disabled — skipping alert"); return; }
  if (!SMS_GW_URL || !ALERT_PHONE) {
    log("No SMS_GATEWAY_URL or MONITOR_ALERT_PHONE configured — skipping alert");
    return;
  }
  const url   = `${SMS_GW_URL.replace(/\/+$/, "")}/messages`;
  const creds = Buffer.from(`${SMS_GW_USER}:${SMS_GW_PASS}`).toString("base64");
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Authorization": `Basic ${creds}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: message.slice(0, 160), phoneNumbers: [ALERT_PHONE] }),
      signal: AbortSignal.timeout(8_000),
    });
    log(resp.ok ? `SMS alert sent to ${ALERT_PHONE}` : `SMS alert HTTP ${resp.status}`);
  } catch (err) {
    log(`SMS alert failed: ${err.message}`);
  }
}

// ── Repair & escalation ───────────────────────────────────────────────────────

const REPAIRABLE = new Set(["api-process", "api-http"]);

async function attemptRepair(serviceId) {
  if (!REPAIRABLE.has(serviceId)) return;
  log(`[repair] restarting island-tacos for ${serviceId}`);
  try {
    await execAsync("pm2 restart island-tacos --update-env", { timeout: 15_000 });
    log("[repair] PM2 restart succeeded");
    appendEvent({ type: "repair", service: serviceId, message: "Auto-repair: PM2 restart triggered" });
  } catch (err) {
    log(`[repair] PM2 restart failed: ${err.message}`);
    appendEvent({ type: "repair-failed", service: serviceId, message: `Auto-repair failed: ${err.message}` });
  }
}

async function escalate(serviceId, errorMsg) {
  log(`[escalate] ${serviceId}: ${errorMsg}`);
  appendEvent({
    type: "escalation",
    service: serviceId,
    message: `${serviceId} still failing — manual intervention needed`,
    detail: errorMsg,
  });

  let diagnosis = null;
  try {
    const logs = await readPm2Logs();
    diagnosis = await callOpenAI(serviceId, errorMsg, logs);
  } catch { /* ignore */ }

  if (diagnosis) {
    log(`[ai-diagnosis] ${diagnosis.slice(0, 120)}`);
    appendEvent({ type: "ai-diagnosis", service: serviceId, message: diagnosis });
  }

  const sms = `[IT] ${serviceId} DOWN: ${errorMsg.slice(0, 80)} — check the shop PC`;
  await sendSmsAlert(sms).catch(() => {});
}

// ── Poll state & loop ─────────────────────────────────────────────────────────

const state = {}; // serviceId → { failCount }
let pollCount = 0;

async function poll() {
  pollCount++;
  log(`poll #${pollCount}`);

  const checks = [
    { id: "api-process", label: "API Server Process", run: checkPm2 },
    { id: "api-http",    label: "API HTTP Health",    run: () => checkHttp(`http://127.0.0.1:${API_PORT}/api/healthz`) },
    { id: "postgres",    label: "PostgreSQL",          run: () => checkTcp("127.0.0.1", 5432) },
    { id: "disk",        label: "Disk Space",          run: checkDisk },
    { id: "internet",    label: "Internet (Cloud)",    run: () => checkHttp(`${CLOUD_URL}/api/healthz`, "GET", 8000) },
  ];
  if (PRINTER_IP) {
    checks.push({ id: "printer", label: "Receipt Printer", run: () => checkTcp(PRINTER_IP, PRINTER_PORT) });
  }
  if (SMS_GW_URL) {
    checks.push({ id: "sms-gateway", label: "SMS Gateway", run: () => checkHttp(`${SMS_GW_URL.replace(/\/+$/, "")}/health`, "GET", 3000) });
  }

  const rawResults = await Promise.all(
    checks.map(async ({ id, label, run }) => {
      let result;
      try { result = await run(); }
      catch (err) { result = { ok: false, error: err.message ?? "unknown error" }; }
      return { id, label, ...result };
    })
  );

  for (const { id, label, ok, error, details } of rawResults) {
    if (!state[id]) state[id] = { failCount: 0 };
    const s = state[id];

    if (ok) {
      if (s.failCount > 0) {
        log(`[recovery] ${id} recovered after ${s.failCount} fail(s)`);
        appendEvent({ type: "recovery", service: id, message: `${label} recovered after ${s.failCount} failure(s)` });
        s.failCount = 0;
      }
    } else {
      s.failCount++;
      const err = error ?? "check failed";
      log(`[fail:${s.failCount}] ${id}: ${err}`);
      appendEvent({ type: "fail", service: id, message: err, failCount: s.failCount });

      if (s.failCount === 1) {
        await attemptRepair(id);
      } else if (s.failCount === 2 || (s.failCount > 2 && s.failCount % 10 === 0)) {
        await escalate(id, err);
      }
    }

    saveStatus({
      id, label, ok,
      failCount: s.failCount,
      lastCheckAt: nowIso(),
      error:   ok ? null : (error ?? null),
      details: ok ? (details ?? null) : null,
    });
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

log("Island Tacos Monitor starting…");
appendEvent({ type: "startup", message: "Monitor process started", detail: `PID=${process.pid} platform=${platform()} node=${process.version}` });

poll().catch(err => log(`Initial poll error: ${err.message}`));
setInterval(() => poll().catch(err => log(`Poll error: ${err.message}`)), POLL_MS);

process.on("unhandledRejection", reason => log(`Unhandled rejection: ${reason}`));
process.on("uncaughtException",  err    => log(`Uncaught exception: ${err.message}`));

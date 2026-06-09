#!/usr/bin/env node
/**
 * Island Tacos — Monitor & Repair Agent
 *
 * Runs as a PM2 process on the shop mini PC. Every 30 s it:
 *   1. Checks every critical service (API process, HTTP health, Postgres,
 *      printer TCP, SMS gateway HTTP, disk space, internet).
 *   2. On the 1ST consecutive failure  → attempt auto-repair.
 *   3. On the 2ND consecutive failure  → attempt auto-repair again.
 *   4. On the 3RD consecutive failure  → SMS alert + OpenAI diagnosis.
 *      Re-escalates every 10 polls while still failing.
 *
 * Persistence:
 *   local-install/monitor.db — SQLite (node:sqlite built-in) with tables:
 *     monitor_meta    — pid, pollCount, platform (updated every poll)
 *     monitor_status  — one row per service (upserted on every poll)
 *     monitor_events  — rolling event log, newest-first, trimmed to 500 rows
 *
 * These tables are read by GET /api/system/health in the api-server.
 *
 * Zero external Node.js dependencies — only built-ins + the `pg` module
 * already present in the workspace node_modules for the Postgres probe.
 */

import { readFileSync, existsSync } from "node:fs";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { createConnection } from "node:net";
import { createServer as createHttpServer } from "node:http";
import { homedir, platform as osPlatform } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
// Always hide console windows on Windows — bare exec() briefly flashes a cmd
// window on screen for every shell command the monitor runs.
const _execRaw  = promisify(exec);
const execAsync = (cmd, opts = {}) => _execRaw(cmd, { windowsHide: true, ...opts });

// ── Paths & config ─────────────────────────────────────────────────────────────

const ROOT     = join(__dirname, "..");
const DB_PATH  = join(__dirname, "monitor.db");
const POLL_MS  = 30_000;
const MAX_EVENTS = 500;
const PLATFORM   = osPlatform();

// ── .env loader (mirrors ecosystem.config.cjs) ────────────────────────────────

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

const DATABASE_URL  = getEnv("DATABASE_URL");
const API_PORT      = getEnv("PORT", "3001");
const PRINTER_IP    = getEnv("PRINTER_IP", "");
const PRINTER_PORT  = parseInt(getEnv("PRINTER_PORT", "9100"), 10);
const SMS_GW_URL    = getEnv("SMS_GATEWAY_URL", "");
const SMS_GW_USER   = getEnv("SMS_GATEWAY_USERNAME", "");
const SMS_GW_PASS   = getEnv("SMS_GATEWAY_PASSWORD", "");
const OPENAI_KEY        = getEnv("OPENAI_API_KEY", "");
const ALERT_PHONE       = getEnv("MONITOR_ALERT_PHONE", "");
const SMS_DISABLED      = getEnv("SMS_DISABLED", "") === "true";
const WA_PHONE_ID       = getEnv("META_PHONE_NUMBER_ID", "");
const WA_ACCESS_TOKEN   = getEnv("META_ACCESS_TOKEN", "");
const WA_ENABLED        = getEnv("META_WHATSAPP_ENABLED", "") === "true";
const WA_ALERT_PHONE    = getEnv("MONITOR_ALERT_WA_PHONE", ALERT_PHONE);
const CLOUD_URL     = getEnv("PUBLIC_URL", "https://orders.islandtacosbvi.com");
const PGDATA        = getEnv("PGDATA", "");

// ── SQLite bootstrap ───────────────────────────────────────────────────────────
// node:sqlite (DatabaseSync) requires Node 22.5+.  On older installs we fall
// back to no-op stubs so the monitor still runs — it just won't persist data
// to the health-dashboard DB.  Monitoring, alerts, and auto-repair all work.

const _noopStmt = { run: () => {}, get: () => null, all: () => [] };
let db = { exec: () => {}, prepare: () => _noopStmt };

try {
  const { DatabaseSync } = await import("node:sqlite");
  const _db = new DatabaseSync(DB_PATH);
  _db.exec(`
    CREATE TABLE IF NOT EXISTS monitor_meta (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

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
  db = _db;
} catch {
  console.warn("[monitor] node:sqlite unavailable (Node < 22.5) — health DB disabled, monitoring continues");
}

const upsertMeta = db.prepare(`
  INSERT INTO monitor_meta (key, value, updated_at)
  VALUES (?, ?, ?)
  ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`);

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

function appendEvent(event) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  try {
    insertEvent.run(
      id,
      nowIso(),
      event.type    ?? "unknown",
      event.service  ?? null,
      event.message  ?? "",
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

/**
 * PostgreSQL health check via real SELECT 1 query.
 * Falls back to TCP probe if pg module or DATABASE_URL are unavailable.
 */
async function checkPostgres() {
  // Prefer a real query; fall back to TCP if pg is not loadable
  if (DATABASE_URL) {
    try {
      const pgModule = await import("pg");
      const PgClient = pgModule.default?.Client ?? pgModule.Client;
      const client = new PgClient({
        connectionString: DATABASE_URL,
        connectionTimeoutMillis: 4000,
        query_timeout: 4000,
        statement_timeout: 4000,
      });
      await client.connect();
      await client.query("SELECT 1");
      await client.end();
      return { ok: true, details: "SELECT 1 ok" };
    } catch (err) {
      // If pg module simply isn't installed, fall through to TCP probe
      if (err.code === "ERR_MODULE_NOT_FOUND" || err.code === "ERR_PACKAGE_PATH_NOT_EXPORTED") {
        // fall through to TCP below
      } else {
        return { ok: false, error: err.message ?? "postgres query failed" };
      }
    }
  }
  // Fallback: TCP port probe
  const tcp = await checkTcp("127.0.0.1", 5432);
  return tcp.ok
    ? { ok: true, details: "TCP ok (no DATABASE_URL for query)" }
    : tcp;
}

/** Disk space — warn when free < 10% of total. */
async function checkDisk() {
  try {
    if (PLATFORM === "win32") {
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
      if (PLATFORM === "win32") {
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
    "A service health check has failed twice in a row despite two auto-repair attempts. Give a",
    "2-3 sentence plain-English diagnosis of the most likely cause, followed by one concrete actionable",
    "fix. Be specific.",
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
  if (SMS_DISABLED)  { log("SMS disabled — skipping SMS alert"); return; }
  if (!SMS_GW_URL || !ALERT_PHONE) {
    log("No SMS_GATEWAY_URL or MONITOR_ALERT_PHONE configured — skipping SMS alert");
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

// ── WhatsApp alert (Meta Graph API) ───────────────────────────────────────────

async function sendWhatsAppAlert(message) {
  if (!WA_ENABLED || !WA_PHONE_ID || !WA_ACCESS_TOKEN || !WA_ALERT_PHONE) {
    log("WhatsApp not configured — skipping WA alert");
    return false;
  }
  const to = WA_ALERT_PHONE.replace(/\D/g, "");
  try {
    const resp = await fetch(
      `https://graph.facebook.com/v21.0/${WA_PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${WA_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: message },
        }),
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (resp.ok) {
      log(`WhatsApp alert sent to ${to}`);
      return true;
    }
    const errData = await resp.json().catch(() => ({}));
    log(`WhatsApp alert HTTP ${resp.status}: ${JSON.stringify(errData)}`);
    return false;
  } catch (err) {
    log(`WhatsApp alert failed: ${err.message}`);
    return false;
  }
}

// ── Send alert (WhatsApp preferred, SMS fallback) ─────────────────────────────

async function sendAlert(message) {
  const waSent = await sendWhatsAppAlert(message);
  if (!waSent) await sendSmsAlert(message);
}

// ── Repair ────────────────────────────────────────────────────────────────────

/**
 * Attempt to repair a service. Returns true if the repair command succeeded.
 * Note: success here means the repair command ran without error, NOT that
 * the service is healthy again (the next poll check will verify that).
 */
async function attemptRepair(serviceId) {
  log(`[repair] attempting repair for ${serviceId}`);
  try {
    if (serviceId === "api-process" || serviceId === "api-http") {
      // Use config file path so PM2 re-runs loadEnv() and picks up any .env changes.
      // "pm2 restart island-tacos --update-env" fails when PM2 has marked the
      // process as "errored" after max_restarts; the config-file form always works.
      await execAsync("pm2 restart local-install/ecosystem.config.cjs --update-env", { timeout: 15_000 });
      log("[repair] PM2 restart issued");
      appendEvent({ type: "repair", service: serviceId, message: "Auto-repair: PM2 restart triggered" });
      return true;
    }

    if (serviceId === "postgres") {
      if (PLATFORM === "win32") {
        // Restart whichever postgresql service exists on this machine
        await execAsync(
          'powershell -NoProfile -Command "Get-Service -Name \'postgresql*\' | Restart-Service -ErrorAction Stop"',
          { timeout: 30_000 }
        );
      } else if (PGDATA) {
        await execAsync(`pg_ctl restart -D "${PGDATA}" -w`, { timeout: 30_000 });
      } else {
        // Try systemctl (Linux), then pg_ctl with a common default data dir
        try {
          await execAsync("systemctl restart postgresql", { timeout: 20_000 });
        } catch {
          await execAsync("pg_ctl restart -w", { timeout: 20_000 });
        }
      }
      log("[repair] PostgreSQL restart issued");
      appendEvent({ type: "repair", service: serviceId, message: "Auto-repair: PostgreSQL service restart triggered" });
      return true;
    }

    log(`[repair] ${serviceId} has no auto-repair action`);
    return false;
  } catch (err) {
    log(`[repair] repair command failed for ${serviceId}: ${err.message}`);
    appendEvent({ type: "repair-failed", service: serviceId, message: `Auto-repair failed: ${err.message}` });
    return false;
  }
}

async function escalate(serviceId, errorMsg) {
  log(`[escalate] ${serviceId}: ${errorMsg}`);
  appendEvent({
    type: "escalation",
    service: serviceId,
    message: `${serviceId} still failing after auto-repair — manual intervention required`,
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

  const alertMsg = `[IT] ${serviceId} DOWN: ${errorMsg.slice(0, 80)} — check the shop PC`;
  await sendAlert(alertMsg).catch(() => {});
}

// ── Poll state & loop ─────────────────────────────────────────────────────────

// Per-service state: { failCount, repairCount }
// failCount  — consecutive failed checks (resets on recovery)
// repairCount — repair attempts in the current failure run (resets on recovery)
const state = {};
let pollCount = 0;

async function poll() {
  pollCount++;
  log(`poll #${pollCount}`);

  const checks = [
    { id: "api-process", label: "API Server Process", run: checkPm2 },
    { id: "api-http",    label: "API HTTP Health",    run: () => checkHttp(`http://127.0.0.1:${API_PORT}/api/healthz`) },
    { id: "postgres",    label: "PostgreSQL",          run: checkPostgres },
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
    if (!state[id]) state[id] = { failCount: 0, repairCount: 0 };
    const s = state[id];

    if (ok) {
      if (s.failCount > 0) {
        log(`[recovery] ${id} recovered after ${s.failCount} consecutive fail(s)`);
        appendEvent({
          type: "recovery",
          service: id,
          message: `${label} recovered after ${s.failCount} failure(s) and ${s.repairCount} repair attempt(s)`,
        });
        s.failCount   = 0;
        s.repairCount = 0;
      }
    } else {
      s.failCount++;
      const err = error ?? "check failed";
      log(`[fail:${s.failCount}] ${id}: ${err}`);
      appendEvent({ type: "fail", service: id, message: err, failCount: s.failCount });

      if (s.failCount === 1 || s.failCount === 2) {
        // First two consecutive failures → attempt auto-repair
        s.repairCount++;
        await attemptRepair(id);
      } else if (s.failCount === 3 || (s.failCount > 3 && s.failCount % 10 === 0)) {
        // Still failing after two repair attempts → escalate
        // Also re-escalates every 10 polls (~5 min) so alerts don't go silent
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

  // Upsert monitor meta so the API can report process info
  const now = Date.now();
  for (const [key, value] of [
    ["pid",         String(process.pid)],
    ["pollCount",   String(pollCount)],
    ["platform",    PLATFORM],
    ["nodeVersion", process.version],
  ]) {
    upsertMeta.run(key, value, now);
  }
}

// ── Log-viewer HTTP server (port 3002) ────────────────────────────────────────
// Serves the last N lines of PM2 logs as a self-refreshing HTML page so the
// operator can diagnose a crash-looping API server from any browser on the LAN
// without needing SSH or Remote Desktop access.
// Always up — independent of the API server process.

const LOG_VIEWER_PORT = 3002;

async function getLogLines(processName, logType, lines = 120) {
  const logPath = join(homedir(), ".pm2", "logs", `${processName}-${logType}.log`);
  if (!existsSync(logPath)) return `(${logPath} — not found)`;
  try {
    if (PLATFORM === "win32") {
      const { stdout } = await execAsync(
        `powershell -Command "Get-Content '${logPath}' -Tail ${lines} -ErrorAction SilentlyContinue"`,
        { timeout: 5000 }
      );
      return stdout.trim() || "(empty)";
    } else {
      const { stdout } = await execAsync(`tail -${lines} "${logPath}"`, { timeout: 5000 });
      return stdout.trim() || "(empty)";
    }
  } catch (err) {
    return `(read error: ${err.message})`;
  }
}

function esc(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const logViewerServer = createHttpServer(async (req, res) => {
  if (req.url !== "/" && req.url !== "/logs") {
    res.writeHead(302, { Location: "/" });
    res.end();
    return;
  }
  const [errLog, outLog] = await Promise.all([
    getLogLines("island-tacos", "error", 120),
    getLogLines("island-tacos", "out",   60),
  ]);

  // Pull recent events from SQLite for extra context
  let eventsHtml = "";
  try {
    const rows = db.prepare(`
      SELECT ts, type, service, message, detail, diagnosis
      FROM monitor_events
      ORDER BY created_at DESC
      LIMIT 15
    `).all();
    eventsHtml = rows.map(r =>
      `<tr>
         <td>${esc(r.ts?.slice(11,19) ?? "")}</td>
         <td>${esc(r.type ?? "")}</td>
         <td>${esc(r.service ?? "")}</td>
         <td>${esc(r.message ?? "")}${r.detail ? `<br><small>${esc(r.detail)}</small>` : ""}${r.diagnosis ? `<br><em>${esc(r.diagnosis)}</em>` : ""}</td>
       </tr>`
    ).join("\n");
  } catch { eventsHtml = "<tr><td colspan='4'>(SQLite unavailable)</td></tr>"; }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="10">
  <title>Island Tacos — Monitor Logs</title>
  <style>
    body { font-family: monospace; background: #111; color: #eee; margin: 0; padding: 16px; }
    h2   { color: #f90; margin: 0 0 4px; }
    p    { margin: 0 0 16px; color: #aaa; font-size: 13px; }
    pre  { background: #1a1a1a; border: 1px solid #333; padding: 12px; overflow-x: auto;
           white-space: pre-wrap; word-break: break-word; font-size: 12px; max-height: 40vh; overflow-y: auto; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; margin-bottom: 24px; }
    th, td { border: 1px solid #333; padding: 4px 8px; text-align: left; vertical-align: top; }
    th   { background: #222; color: #f90; }
    .err { color: #f66; }
  </style>
</head>
<body>
  <h2>Island Tacos — Monitor Log Viewer</h2>
  <p>Auto-refreshes every 10 s &nbsp;|&nbsp; ${new Date().toISOString()} &nbsp;|&nbsp; <a href="/" style="color:#88f">Refresh now</a></p>

  <h3 class="err">⚠ island-tacos STDERR (last 120 lines)</h3>
  <pre class="err">${esc(errLog)}</pre>

  <h3>island-tacos STDOUT (last 60 lines)</h3>
  <pre>${esc(outLog)}</pre>

  <h3>Recent monitor events</h3>
  <table>
    <thead><tr><th>Time</th><th>Type</th><th>Service</th><th>Message</th></tr></thead>
    <tbody>${eventsHtml}</tbody>
  </table>
</body>
</html>`;

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
});

logViewerServer.listen(LOG_VIEWER_PORT, "0.0.0.0", () => {
  log(`Log viewer listening on port ${LOG_VIEWER_PORT} — http://localhost:${LOG_VIEWER_PORT}/`);
});

logViewerServer.on("error", (err) => {
  log(`Log viewer server error: ${err.message}`);
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────

log("Island Tacos Monitor starting…");
appendEvent({
  type: "startup",
  message: "Monitor process started",
  detail: `PID=${process.pid} platform=${PLATFORM} node=${process.version}`,
});

poll().catch(err => log(`Initial poll error: ${err.message}`));
setInterval(() => poll().catch(err => log(`Poll error: ${err.message}`)), POLL_MS);

process.on("unhandledRejection", reason => log(`Unhandled rejection: ${reason}`));
process.on("uncaughtException",  err    => log(`Uncaught exception: ${err.message}`));

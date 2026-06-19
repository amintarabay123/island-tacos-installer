import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { setPageMeta } from "@/lib/page-meta";
import { authHeaders } from "@/lib/auth";
import { adminRoutes } from "@/lib/admin-path";
import { useStoreSettings } from "@/lib/use-store-settings";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  Activity, Cpu, HardDrive, Wifi, WifiOff, Server, Printer,
  MessageSquare, Wrench, Info, Download,
} from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── IL Palette ────────────────────────────────────────────────────────────────
const BG    = "#16172b";
const CARD  = "#1e1f38";
const HDR   = "#0e1020";
const BORD  = "rgba(255,255,255,0.06)";
const TP    = "#e8eaf6";
const TM    = "#b0b8d8";
const MU    = "#7077a1";
const PUR   = "#7c6af7";
const OR    = "#ff6b00";
const GRN   = "#30d158";
const RED   = "#ff453a";
const YLW   = "#ffd60a";

const GLOW: React.CSSProperties = {
  background: CARD,
  border: `1px solid ${BORD}`,
  borderRadius: 16,
  boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 4px 24px rgba(0,0,0,0.35), 0 0 20px rgba(124,106,247,0.06)",
};

// ── Types ─────────────────────────────────────────────────────────────────────

type ServiceSnap = {
  id: string;
  label: string;
  ok: boolean;
  failCount: number;
  lastCheckAt: string;
  error?: string;
  details?: string;
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

type HealthPayload = {
  available: false;
  reason?: string;
} | {
  available: true;
  overall: "ok" | "degraded";
  updatedAt: string;
  pollCount: number;
  pid: number;
  platform?: string;
  monitorStale?: boolean;
  services: Record<string, ServiceSnap>;
  events: MonitorEvent[];
};

// ── Service icon map ──────────────────────────────────────────────────────────

function ServiceIcon({ id, size = 16 }: { id: string; size?: number }) {
  const style = { width: size, height: size };
  if (id === "api-process" || id === "api-http") return <Server style={style} />;
  if (id === "postgres")    return <Cpu style={style} />;
  if (id === "disk")        return <HardDrive style={style} />;
  if (id === "internet")    return <Wifi style={style} />;
  if (id === "printer")     return <Printer style={style} />;
  if (id === "sms-gateway") return <MessageSquare style={style} />;
  return <Activity style={style} />;
}

// ── Event type badge label ─────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  startup:       { label: "Boot",      color: "#60a5fa" },
  fail:          { label: "Fail",      color: RED        },
  recovery:      { label: "Recovery",  color: GRN        },
  repair:        { label: "Repair",    color: YLW        },
  "repair-failed": { label: "Repair ✗", color: OR        },
  escalation:    { label: "Escalation", color: "#f97316" },
  "ai-diagnosis":{ label: "AI",        color: PUR        },
};

function relativeTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  if (diff < 60_000)  return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function AdminSystem() {
  const { storeName } = useStoreSettings();
  useEffect(() => { setPageMeta(`🖥️ System Monitor — ${storeName}`, "🖥️"); }, [storeName]);
  const { toast } = useToast();

  const [data, setData]         = useState<HealthPayload | null>(null);
  const [loading, setLoading]   = useState(true);
  const [repairing, setRepairing] = useState<string | null>(null);

  // Update flow: idle → confirm → updating (reconnecting) → done
  const [updateState, setUpdateState] = useState<"idle" | "confirm" | "updating" | "done">("idle");
  const [reconnectSecs, setReconnectSecs] = useState(0);

  const fetchHealth = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${API}/api/system/health`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json() as HealthPayload);
    } catch (e) {
      if (!silent) toast({ title: "Failed to load system health", variant: "destructive" });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  // Auto-refresh every 10 s
  useEffect(() => {
    const id = setInterval(() => fetchHealth(true), 10_000);
    return () => clearInterval(id);
  }, [fetchHealth]);

  const handleRunUpdate = async () => {
    setUpdateState("updating");
    setReconnectSecs(0);
    try {
      const res = await fetch(`${API}/api/admin/run-update`, {
        method: "POST",
        headers: authHeaders(),
      });
      const body = await res.json() as { ok: boolean; error?: string };
      if (!res.ok || !body.ok) {
        toast({ title: body.error ?? "Update failed", variant: "destructive" });
        setUpdateState("idle");
        return;
      }
      // Server will restart — poll until it comes back
      let elapsed = 0;
      const poll = setInterval(async () => {
        elapsed += 2;
        setReconnectSecs(elapsed);
        try {
          const r = await fetch(`${API}/api/healthz`, { cache: "no-store" });
          if (r.ok) {
            clearInterval(poll);
            setUpdateState("done");
            setTimeout(() => window.location.reload(), 1500);
          }
        } catch {
          // still offline, keep polling
        }
      }, 2000);
    } catch {
      toast({ title: "Could not reach the server", variant: "destructive" });
      setUpdateState("idle");
    }
  };

  const handleRepair = async (serviceId: string) => {
    setRepairing(serviceId);
    try {
      const res = await fetch(`${API}/api/system/repair/${serviceId}`, {
        method: "POST",
        headers: authHeaders(),
      });
      const body = await res.json() as { ok: boolean; message?: string; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Repair failed");
      toast({ title: `Repair triggered: ${body.message ?? "PM2 restart sent"}` });
      setTimeout(() => fetchHealth(true), 3000);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Repair failed", variant: "destructive" });
    } finally {
      setRepairing(null);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", background: BG, color: TP, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <Activity style={{ width: 32, height: 32, color: PUR, animation: "spin 1.2s linear infinite" }} />
          <p style={{ color: MU, fontSize: 14 }}>Loading system status…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // ── Unavailable (cloud) ──────────────────────────────────────────────────────

  const unavailable = !data || !data.available;

  const services: ServiceSnap[] = unavailable ? [] : Object.values((data as Extract<HealthPayload, { available: true }>).services);
  const events: MonitorEvent[]  = unavailable ? [] : (data as Extract<HealthPayload, { available: true }>).events;
  const fullData = unavailable ? null : (data as Extract<HealthPayload, { available: true }>);

  const allOk       = services.length > 0 && services.every(s => s.ok);
  const numFailing  = services.filter(s => !s.ok).length;
  const overallStatus = unavailable ? "unknown" : allOk ? "ok" : "degraded";

  return (
    <div style={{ minHeight: "100dvh", background: BG, color: TP, fontFamily: "inherit" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: HDR, borderBottom: `1px solid ${BORD}`, backdropFilter: "blur(12px)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 16px", height: 56, display: "flex", alignItems: "center", gap: 10 }}>
          <Link href={adminRoutes.dashboard}>
            <button style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", color: TM }}>
              <ArrowLeft style={{ width: 16, height: 16 }} />
            </button>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flex: 1 }}>
            <Activity style={{ width: 15, height: 15, color: MU }} />
            <h1 style={{ fontWeight: 700, fontSize: 15, margin: 0, color: TP }}>System Monitor</h1>
            {fullData && (
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", padding: "2px 8px", borderRadius: 999,
                background: overallStatus === "ok" ? "rgba(48,209,88,0.12)" : "rgba(255,68,58,0.12)",
                color: overallStatus === "ok" ? GRN : RED,
                border: `1px solid ${overallStatus === "ok" ? "rgba(48,209,88,0.25)" : "rgba(255,68,58,0.25)"}`,
              }}>
                {overallStatus === "ok" ? "ALL SYSTEMS OK" : `${numFailing} FAILING`}
              </span>
            )}
          </div>
          <button
            onClick={() => fetchHealth()}
            disabled={updateState === "updating"}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: `1px solid ${BORD}`, color: TM, cursor: updateState === "updating" ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600, opacity: updateState === "updating" ? 0.4 : 1 }}
          >
            <RefreshCw style={{ width: 13, height: 13 }} /> Refresh
          </button>

          {/* Update button / confirm / states */}
          {updateState === "idle" && (
            <button
              onClick={() => setUpdateState("confirm")}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "rgba(124,106,247,0.15)", border: `1px solid rgba(124,106,247,0.35)`, color: PUR, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
            >
              <Download style={{ width: 13, height: 13 }} /> Update
            </button>
          )}
          {updateState === "confirm" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: YLW, fontWeight: 600 }}>Run UPDATE.ps1?</span>
              <button
                onClick={handleRunUpdate}
                style={{ padding: "4px 10px", borderRadius: 7, background: PUR, border: "none", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700 }}
              >Yes</button>
              <button
                onClick={() => setUpdateState("idle")}
                style={{ padding: "4px 10px", borderRadius: 7, background: "rgba(255,255,255,0.08)", border: `1px solid ${BORD}`, color: TM, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
              >Cancel</button>
            </div>
          )}
          {updateState === "updating" && (
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 8, background: "rgba(255,214,10,0.08)", border: `1px solid rgba(255,214,10,0.25)` }}>
              <RefreshCw style={{ width: 12, height: 12, color: YLW, animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: 12, color: YLW, fontWeight: 600 }}>
                {reconnectSecs === 0 ? "Starting…" : `Reconnecting… ${reconnectSecs}s`}
              </span>
            </div>
          )}
          {updateState === "done" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 8, background: "rgba(48,209,88,0.1)", border: `1px solid rgba(48,209,88,0.25)` }}>
              <CheckCircle2 style={{ width: 12, height: 12, color: GRN }} />
              <span style={{ fontSize: 12, color: GRN, fontWeight: 600 }}>Back online — reloading</span>
            </div>
          )}
        </div>
      </header>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 16px", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Not available banner */}
        {unavailable && (
          <section style={{ ...GLOW, padding: "32px 28px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: 999, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <WifiOff style={{ width: 24, height: 24, color: MU }} />
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 16, color: TP, marginBottom: 6 }}>Monitor not available on this host</p>
              <p style={{ fontSize: 13, color: MU, maxWidth: 440, lineHeight: 1.6 }}>
                The watchdog runs on the shop mini PC and writes its status locally.
                This page only shows live data when accessed from the mini PC's POS browser.
                On cloud Replit, no status data is present.
              </p>
              {data && "reason" in data && data.reason && (
                <p style={{ fontSize: 12, color: MU, marginTop: 8, fontStyle: "italic" }}>{data.reason}</p>
              )}
            </div>
          </section>
        )}

        {/* Monitor stale warning — shows when the watchdog process itself has gone silent */}
        {fullData?.monitorStale && (
          <div style={{
            display: "flex", alignItems: "center", gap: 12, padding: "14px 18px",
            background: "rgba(255,214,10,0.07)", border: `1px solid rgba(255,214,10,0.25)`,
            borderRadius: 12,
          }}>
            <AlertTriangle style={{ width: 18, height: 18, color: YLW, flexShrink: 0 }} />
            <div>
              <p style={{ fontWeight: 700, fontSize: 13, color: YLW, marginBottom: 2 }}>
                Watchdog process appears offline
              </p>
              <p style={{ fontSize: 12, color: MU, lineHeight: 1.5 }}>
                No poll received in the last 2 minutes. The <code style={{ background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 4 }}>cedar-cafe-monitor</code> PM2 process may have crashed.
                Run <code style={{ background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 4 }}>pm2 start local-install/ecosystem.config.cjs</code> on the shop PC to restart it.
                Service status shown below reflects the last known state.
              </p>
            </div>
          </div>
        )}

        {/* Meta row (poll count, last updated, PID) */}
        {fullData && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {[
              { label: "Poll #", value: String(fullData.pollCount), art: "📡" },
              { label: "Updated", value: relativeTime(fullData.updatedAt), art: "🕐" },
              { label: "Monitor PID", value: String(fullData.pid), art: "🔢" },
              { label: "Platform", value: fullData.platform ?? "—", art: "💻" },
            ].map(c => (
              <div key={c.label} style={{ flex: "1 1 160px", minWidth: 140 }}>
                <div style={{ background: CARD, border: `1px solid ${BORD}`, borderRadius: 12, padding: "12px 14px", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: -4, right: 4, fontSize: 40, opacity: 0.14, pointerEvents: "none" }}>{c.art}</div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: MU, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>{c.label}</p>
                  <p style={{ fontSize: 18, fontWeight: 800, color: TP }}>{c.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Service cards */}
        {services.length > 0 && (
          <section>
            <h2 style={{ fontWeight: 700, fontSize: 13, color: MU, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 12 }}>Services</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
              {services.map(svc => {
                const isRepairable = svc.id === "api-process" || svc.id === "api-http" || svc.id === "postgres";
                const isRepairing  = repairing === svc.id;
                return (
                  <div key={svc.id} style={{
                    background: CARD, borderRadius: 14, padding: "16px 18px",
                    border: `1px solid ${svc.ok ? "rgba(48,209,88,0.15)" : "rgba(255,68,58,0.2)"}`,
                    boxShadow: svc.ok ? "none" : "0 0 0 1px rgba(255,68,58,0.08), 0 4px 16px rgba(255,68,58,0.06)",
                    display: "flex", flexDirection: "column", gap: 10,
                  }}>
                    {/* Top row */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center",
                        background: svc.ok ? "rgba(48,209,88,0.12)" : "rgba(255,68,58,0.12)",
                        color: svc.ok ? GRN : RED,
                        flexShrink: 0,
                      }}>
                        <ServiceIcon id={svc.id} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 700, fontSize: 13, color: TP, marginBottom: 2 }}>{svc.label}</p>
                        <p style={{ fontSize: 11, color: MU }}>{relativeTime(svc.lastCheckAt)}</p>
                      </div>
                      {svc.ok
                        ? <CheckCircle2 style={{ width: 16, height: 16, color: GRN, flexShrink: 0 }} />
                        : <XCircle      style={{ width: 16, height: 16, color: RED, flexShrink: 0 }} />
                      }
                    </div>

                    {/* Status text */}
                    {(svc.error || svc.details) && (
                      <p style={{
                        fontSize: 12, color: svc.ok ? MU : "#ffb3af",
                        background: svc.ok ? "transparent" : "rgba(255,68,58,0.08)",
                        borderRadius: 6, padding: svc.ok ? 0 : "6px 8px",
                        margin: 0,
                      }}>
                        {svc.error ?? svc.details}
                      </p>
                    )}

                    {/* Fail count badge */}
                    {!svc.ok && svc.failCount > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <AlertTriangle style={{ width: 12, height: 12, color: YLW }} />
                        <span style={{ fontSize: 11, color: YLW, fontWeight: 600 }}>{svc.failCount} consecutive failure{svc.failCount !== 1 ? "s" : ""}</span>
                      </div>
                    )}

                    {/* Repair button */}
                    {!svc.ok && isRepairable && (
                      <button
                        onClick={() => handleRepair(svc.id)}
                        disabled={!!repairing}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                          height: 32, borderRadius: 8, border: "none",
                          background: isRepairing ? "rgba(124,106,247,0.2)" : PUR,
                          color: "#fff", cursor: repairing ? "not-allowed" : "pointer",
                          fontSize: 12, fontWeight: 700, opacity: repairing && !isRepairing ? 0.5 : 1,
                          transition: "opacity 0.15s",
                        }}
                      >
                        <Wrench style={{ width: 12, height: 12, animation: isRepairing ? "spin 1s linear infinite" : "none" }} />
                        {isRepairing ? "Restarting…" : svc.id === "postgres" ? "Restart Postgres" : "Restart Process"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Event log */}
        {fullData && (
          <section style={GLOW}>
            <div style={{ padding: "20px 24px 0" }}>
              <h2 style={{ fontWeight: 700, fontSize: 13, color: MU, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 0 }}>
                Event Log
              </h2>
            </div>
            {events.length === 0 ? (
              <div style={{ padding: "32px 24px", textAlign: "center" }}>
                <Info style={{ width: 20, height: 20, color: MU, margin: "0 auto 8px" }} />
                <p style={{ color: MU, fontSize: 13 }}>No events recorded yet.</p>
              </div>
            ) : (
              <div style={{ maxHeight: 480, overflowY: "auto", padding: "12px 24px 20px" }}>
                {events.map(ev => {
                  const badge = EVENT_LABELS[ev.type] ?? { label: ev.type, color: MU };
                  return (
                    <div key={ev.id} style={{
                      display: "flex", gap: 12, paddingTop: 10, paddingBottom: 10,
                      borderBottom: `1px solid ${BORD}`,
                    }}>
                      {/* Badge */}
                      <div style={{ paddingTop: 2, flexShrink: 0 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
                          padding: "2px 7px", borderRadius: 999,
                          background: `${badge.color}22`, color: badge.color,
                          border: `1px solid ${badge.color}44`,
                          textTransform: "uppercase",
                          display: "inline-block", whiteSpace: "nowrap",
                        }}>
                          {badge.label}
                        </span>
                      </div>
                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, color: TP, marginBottom: ev.detail || ev.diagnosis ? 4 : 0, lineHeight: 1.4 }}>
                          {ev.service && <span style={{ color: MU, marginRight: 6 }}>[{ev.service}]</span>}
                          {ev.message}
                        </p>
                        {ev.detail && (
                          <p style={{ fontSize: 11, color: MU, marginBottom: ev.diagnosis ? 4 : 0, fontFamily: "monospace", wordBreak: "break-word" }}>
                            {ev.detail}
                          </p>
                        )}
                        {ev.diagnosis && (
                          <div style={{ background: "rgba(124,106,247,0.08)", border: "1px solid rgba(124,106,247,0.2)", borderRadius: 8, padding: "8px 10px", marginTop: 4 }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: PUR, marginBottom: 3 }}>🤖 AI Diagnosis</p>
                            <p style={{ fontSize: 12, color: TM, lineHeight: 1.5 }}>{ev.diagnosis}</p>
                          </div>
                        )}
                      </div>
                      {/* Time */}
                      <div style={{ flexShrink: 0, paddingTop: 2 }}>
                        <span style={{ fontSize: 11, color: MU, whiteSpace: "nowrap" }}>{relativeTime(ev.ts)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Footer note */}
        <p style={{ fontSize: 11, color: MU, textAlign: "center", paddingBottom: 8 }}>
          Monitor runs locally on the shop mini PC • Refreshes every 10 s • Polls every 30 s
        </p>
      </div>
    </div>
  );
}

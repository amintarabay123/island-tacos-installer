import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { setPageMeta } from "@/lib/page-meta";
import { authHeaders } from "@/lib/auth";
import { adminRoutes } from "@/lib/admin-path";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useStoreSettings } from "@/lib/use-store-settings";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

const BG   = "#0d1612";
const CARD = "#162518";
const HDR  = "#09100d";
const BORD = "rgba(255,255,255,0.06)";
const TP   = "#e8f5ed";
const TM   = "#8cc4a0";
const MU   = "#5a8a6a";
const PUR  = "#10b981";
const GRN  = "#34d399";
const RED  = "#ff453a";
const YLW  = "#ffd60a";
const OR   = "#f59e0b";
const BLU  = "#60a5fa";

const EVENT_META: Record<string, { label: string; color: string }> = {
  APPROVED:        { label: "Approved",        color: GRN  },
  REJECTED:        { label: "Rejected",        color: RED  },
  FAILED:          { label: "Failed",          color: RED  },
  REVERSED:        { label: "Reversed",        color: YLW  },
  SIG_INVALID:     { label: "Bad Signature",   color: OR   },
  ORDER_NOT_FOUND: { label: "Order Not Found", color: OR   },
  ALREADY_PAID:    { label: "Already Paid",    color: BLU  },
  PENDING:         { label: "Pending",         color: MU   },
  ERROR:           { label: "Error",           color: RED  },
  UNKNOWN:         { label: "Unknown",         color: MU   },
};

type PaymentEvent = {
  id:         number;
  requestId:  number | null;
  orderId:    number | null;
  orderRef:   string | null;
  event:      string;
  rawStatus:  string | null;
  sigPresent: boolean;
  sigValid:   boolean | null;
  notes:      string | null;
  createdAt:  string;
};

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000)     return "just now";
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function EventBadge({ event }: { event: string }) {
  const meta = EVENT_META[event] ?? { label: event, color: MU };
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 9999,
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: "0.02em",
      background: `${meta.color}22`,
      color: meta.color,
      border: `1px solid ${meta.color}44`,
    }}>
      {meta.label}
    </span>
  );
}

function SigBadge({ present, valid }: { present: boolean; valid: boolean | null }) {
  if (!present) return <span style={{ color: MU, fontSize: 12 }}>—</span>;
  if (valid === false)
    return <span style={{ color: RED, fontSize: 12, fontWeight: 600 }}>✗ Invalid</span>;
  if (valid === true)
    return <span style={{ color: GRN, fontSize: 12, fontWeight: 600 }}>✓ Valid</span>;
  return <span style={{ color: YLW, fontSize: 12 }}>Present</span>;
}

export default function AdminPaymentEvents() {
  const { storeName } = useStoreSettings();
  useEffect(() => { setPageMeta(`💳 Payment Events — ${storeName}`, "💳"); }, [storeName]);

  const [rows, setRows]       = useState<PaymentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchEvents = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/admin/payment-events`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRows(await res.json() as PaymentEvent[]);
      setLastFetched(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => fetchEvents(true), 15_000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchEvents]);

  const GLOW: React.CSSProperties = {
    background: CARD,
    border: `1px solid ${BORD}`,
    borderRadius: 16,
    boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 4px 24px rgba(0,0,0,0.35)",
  };

  return (
    <div style={{ minHeight: "100dvh", background: BG, color: TP, fontFamily: "system-ui,sans-serif" }}>

      {/* Header */}
      <div style={{ background: HDR, borderBottom: `1px solid ${BORD}`, padding: "16px 24px", display: "flex", alignItems: "center", gap: 16, position: "sticky", top: 0, zIndex: 10 }}>
        <Link href={adminRoutes.dashboard}>
          <button style={{ background: "none", border: "none", color: TM, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: 8 }}>
            <ArrowLeft size={18} /> Back
          </button>
        </Link>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: TP }}>Payment Events</div>
          <div style={{ fontSize: 12, color: MU }}>
            PlaceToPay webhook log · {lastFetched ? `updated ${relTime(lastFetched.toISOString())}` : "loading…"}
          </div>
        </div>
        <button
          onClick={() => setAutoRefresh(v => !v)}
          style={{
            background: autoRefresh ? `${GRN}22` : "rgba(255,255,255,0.05)",
            border: `1px solid ${autoRefresh ? GRN + "44" : BORD}`,
            color: autoRefresh ? GRN : TM,
            borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}
        >
          {autoRefresh ? "● Live" : "Paused"}
        </button>
        <button
          onClick={() => fetchEvents()}
          disabled={loading}
          style={{ background: `${PUR}22`, border: `1px solid ${PUR}44`, color: PUR, borderRadius: 8, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}
        >
          <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>

        {error && (
          <div style={{ ...GLOW, padding: 16, marginBottom: 20, color: RED, textAlign: "center" }}>
            {error}
          </div>
        )}

        {/* Summary badges */}
        {rows.length > 0 && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
            {(["APPROVED","REJECTED","FAILED","REVERSED","SIG_INVALID","ORDER_NOT_FOUND","ERROR"] as const).map(ev => {
              const count = rows.filter(r => r.event === ev).length;
              if (!count) return null;
              const meta = EVENT_META[ev];
              return (
                <div key={ev} style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}33`, borderRadius: 10, padding: "6px 14px", fontSize: 13, fontWeight: 600, color: meta.color }}>
                  {count} {meta.label}
                </div>
              );
            })}
          </div>
        )}

        {/* Table */}
        <div style={GLOW}>
          {loading && rows.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: MU }}>Loading…</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: MU }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>💳</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No events yet</div>
              <div style={{ fontSize: 13, color: MU }}>Events will appear here as soon as PlaceToPay fires a webhook.</div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BORD}` }}>
                    {["Time", "Order", "PTP Request ID", "Event", "Signature", "Notes"].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: MU, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={row.id}
                      style={{
                        borderBottom: i < rows.length - 1 ? `1px solid ${BORD}` : "none",
                        background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                      }}
                    >
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: TP }}>{fmtTime(row.createdAt)}</div>
                        <div style={{ fontSize: 11, color: MU }}>{fmtDate(row.createdAt)}</div>
                      </td>
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        {row.orderRef ? (
                          <a href={`/track?code=${row.orderRef}`} target="_blank" rel="noreferrer"
                            style={{ color: PUR, fontWeight: 600, fontSize: 13, textDecoration: "none" }}>
                            {row.orderRef}
                          </a>
                        ) : (
                          <span style={{ color: MU, fontSize: 13 }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {row.requestId != null ? (
                          <span style={{ fontFamily: "monospace", fontSize: 12, color: TM }}>{row.requestId}</span>
                        ) : (
                          <span style={{ color: MU, fontSize: 13 }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        <EventBadge event={row.event} />
                        {row.rawStatus && row.rawStatus !== row.event && (
                          <div style={{ fontSize: 11, color: MU, marginTop: 3 }}>raw: {row.rawStatus}</div>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        <SigBadge present={row.sigPresent} valid={row.sigValid} />
                      </td>
                      <td style={{ padding: "12px 16px", maxWidth: 260 }}>
                        {row.notes ? (
                          <span style={{ fontSize: 12, color: TM, wordBreak: "break-word" }}>{row.notes}</span>
                        ) : (
                          <span style={{ color: MU, fontSize: 13 }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ marginTop: 12, textAlign: "right", fontSize: 11, color: MU }}>
          {rows.length} event{rows.length !== 1 ? "s" : ""} · auto-refreshes every 15 seconds when live
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

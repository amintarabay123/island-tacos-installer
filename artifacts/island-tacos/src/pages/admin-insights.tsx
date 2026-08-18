import { useState, useEffect } from "react";
import { Link } from "wouter";
import { setPageMeta } from "@/lib/page-meta";
import { authHeaders } from "@/lib/auth";
import { adminRoutes } from "@/lib/admin-path";
import { ArrowLeft, Sparkles, RefreshCw } from "lucide-react";

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

const GLOW: React.CSSProperties = {
  background: CARD,
  border: `1px solid ${BORD}`,
  borderRadius: 16,
  boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 4px 24px rgba(0,0,0,0.35), 0 0 20px rgba(124,106,247,0.06)",
};

type InsightsResponse = {
  generatedAt: string;
  periodDays: number;
  analysis: string;
  stats: {
    totals: {
      revenue: number; paidOrders: number; allOrders: number;
      cancelledOrders: number; cancellationRatePct: number; avgTicket: number; totalDiscounts: number;
    };
    customers: { uniqueWithPhone: number; repeatCount: number; repeatRatePct: number };
  };
};

const fmt = (n: number) => `$${n.toFixed(2)}`;

// ── Tiny markdown renderer (headings / bold / bullets / numbered lists) ──────
function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <strong key={i} style={{ color: TP, fontWeight: 800 }}>{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  );
}

function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (!line.trim()) return;
    if (line.startsWith("## ")) {
      out.push(<h2 key={i} style={{ color: TP, fontSize: 18, fontWeight: 900, marginTop: out.length ? 24 : 0, marginBottom: 10 }}>{line.slice(3)}</h2>);
    } else if (line.startsWith("### ")) {
      out.push(<h3 key={i} style={{ color: TP, fontSize: 15, fontWeight: 800, marginTop: 16, marginBottom: 8 }}>{line.slice(4)}</h3>);
    } else if (/^\s*[-*•]\s+/.test(line)) {
      out.push(
        <div key={i} style={{ display: "flex", gap: 10, marginBottom: 7, paddingLeft: 4 }}>
          <span style={{ color: OR, flexShrink: 0, fontWeight: 900 }}>•</span>
          <span style={{ color: TM, fontSize: 14.5, lineHeight: 1.55 }}>{renderInline(line.replace(/^\s*[-*•]\s+/, ""))}</span>
        </div>
      );
    } else if (/^\s*\d+[.)]\s+/.test(line)) {
      const numMatch = line.match(/^\s*(\d+)[.)]\s+(.*)$/)!;
      out.push(
        <div key={i} style={{ display: "flex", gap: 10, marginBottom: 9, paddingLeft: 4 }}>
          <span style={{ color: OR, flexShrink: 0, fontWeight: 900, fontSize: 14.5 }}>{numMatch[1]}.</span>
          <span style={{ color: TM, fontSize: 14.5, lineHeight: 1.55 }}>{renderInline(numMatch[2])}</span>
        </div>
      );
    } else {
      out.push(<p key={i} style={{ color: TM, fontSize: 14.5, lineHeight: 1.55, marginBottom: 8 }}>{renderInline(line)}</p>);
    }
  });
  return <div>{out}</div>;
}

const PERIODS = [
  { days: 7,  label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 60, label: "Last 60 days" },
  { days: 90, label: "Last 90 days" },
];

export default function AdminInsights() {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InsightsResponse | null>(null);

  useEffect(() => { setPageMeta("AI Insights — Admin", "✨"); }, []);

  const generate = async (d: number) => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`/api/admin/ai-insights`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ days: d }),
      });
      const body = await r.json().catch(() => null);
      if (!r.ok) throw new Error(body?.error || `Request failed (${r.status})`);
      setResult(body as InsightsResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const t = result?.stats.totals;
  const c = result?.stats.customers;

  return (
    <div style={{ minHeight: "100dvh", background: BG, fontFamily: "'Nunito','Segoe UI',sans-serif" }}>
      {/* Header */}
      <div style={{ background: HDR, borderBottom: `1px solid ${BORD}`, padding: "14px 20px", display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 10 }}>
        <Link href={adminRoutes.dashboard} style={{ color: MU, display: "flex", alignItems: "center" }}>
          <ArrowLeft size={20} />
        </Link>
        <Sparkles size={20} color={PUR} />
        <h1 style={{ color: TP, fontSize: 18, fontWeight: 900 }}>AI Business Insights</h1>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px 60px" }}>
        {/* Controls */}
        <div style={{ ...GLOW, padding: 18, marginBottom: 18 }}>
          <p style={{ color: TM, fontSize: 14, lineHeight: 1.5, marginBottom: 14 }}>
            Analyzes your orders, sales, and customer patterns with AI and gives you concrete suggestions to run the business smoother. Pick a period and hit Analyze.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {PERIODS.map(p => (
              <button key={p.days} onClick={() => setDays(p.days)}
                style={{ height: 40, padding: "0 14px", borderRadius: 10, fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  background: days === p.days ? "rgba(124,106,247,0.2)" : "rgba(255,255,255,0.05)",
                  border: days === p.days ? `1px solid ${PUR}` : `1px solid ${BORD}`,
                  color: days === p.days ? "#c4b9ff" : TM }}>
                {p.label}
              </button>
            ))}
            <button onClick={() => generate(days)} disabled={loading}
              style={{ height: 44, padding: "0 22px", borderRadius: 10, fontFamily: "inherit", fontSize: 14, fontWeight: 800, cursor: loading ? "wait" : "pointer",
                background: PUR, border: "none", color: "#fff", marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, opacity: loading ? 0.6 : 1 }}>
              {loading ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {loading ? "Analyzing…" : result ? "Re-analyze" : "Analyze My Business"}
            </button>
          </div>
        </div>

        {loading && (
          <div style={{ ...GLOW, padding: 40, textAlign: "center" }}>
            <p style={{ color: TM, fontSize: 15, fontWeight: 700 }}>Crunching {days} days of orders, sales, and customer data…</p>
            <p style={{ color: MU, fontSize: 13, marginTop: 6 }}>This usually takes 10–20 seconds.</p>
          </div>
        )}

        {error && !loading && (
          <div style={{ ...GLOW, padding: 20, borderLeft: `4px solid ${RED}` }}>
            <p style={{ color: "#ff8a84", fontSize: 14, fontWeight: 700 }}>Couldn't generate insights</p>
            <p style={{ color: TM, fontSize: 13, marginTop: 4 }}>{error}</p>
          </div>
        )}

        {result && !loading && (
          <>
            {/* Quick stat cards */}
            {t && c && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 18 }}>
                {[
                  { label: "Revenue", value: fmt(t.revenue), color: GRN },
                  { label: "Paid Orders", value: String(t.paidOrders), color: TP },
                  { label: "Avg Ticket", value: fmt(t.avgTicket), color: OR },
                  { label: "Repeat Customers", value: `${c.repeatRatePct}%`, color: PUR },
                  { label: "Cancelled", value: `${t.cancellationRatePct}%`, color: t.cancellationRatePct > 5 ? RED : TM },
                ].map(s => (
                  <div key={s.label} style={{ ...GLOW, padding: "14px 16px" }}>
                    <p style={{ color: MU, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em" }}>{s.label}</p>
                    <p style={{ color: s.color, fontSize: 22, fontWeight: 900, marginTop: 2 }}>{s.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* AI analysis */}
            <div style={{ ...GLOW, padding: 24 }}>
              <Markdown text={result.analysis} />
              <p style={{ color: MU, fontSize: 11, marginTop: 20, borderTop: `1px solid ${BORD}`, paddingTop: 10 }}>
                Generated {new Date(result.generatedAt).toLocaleString()} · based on the last {result.periodDays} days · AI-generated, use your judgment.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

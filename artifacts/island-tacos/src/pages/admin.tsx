import { useState, useRef, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { setPageMeta } from "@/lib/page-meta";
import { authHeaders, clearAuthToken } from "@/lib/auth";
import {
  useGetAdminStats,
  useGetRecentOrders,
  useUpdateOrderStatus,
  getGetAdminStatsQueryKey,
  getGetRecentOrdersQueryKey,
  type UpdateOrderStatusBodyStatus,
  type Order,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DateRange } from "react-day-picker";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  ShoppingBag, DollarSign, Clock, CheckCircle2, TrendingUp,
  Settings, Monitor, LogOut, XCircle, BarChart3, Users,
  CloudUpload, CloudDownload, Menu, X, ChefHat, UtensilsCrossed, Store,
  History, LayoutDashboard, CalendarIcon, Activity, PauseCircle, PlayCircle,
  CreditCard, Sparkles,
} from "lucide-react";
import { adminRoutes } from "@/lib/admin-path";
import { useToast } from "@/hooks/use-toast";

// ── Palette ────────────────────────────────────────────────────────────────────
const BG    = "#16172b";
const CARD  = "#1e1f38";
const BORD  = "rgba(255,255,255,0.06)";
const TP    = "#e8eaf6";
const TM    = "#7077a1";
const OR    = "#ff6b00";

const CHART_TOOLTIP_STYLE = {
  background: CARD,
  border: `1px solid ${BORD}`,
  borderRadius: 12,
  color: TP,
  fontSize: 12,
};

// ── Helpers ────────────────────────────────────────────────────────────────────
type DatePreset = "today" | "yesterday" | "last7" | "custom";

function toBVIDateStr(date: Date): string {
  const bvi = new Date(date.getTime() - 4 * 60 * 60 * 1000);
  return bvi.toISOString().slice(0, 10);
}
function bviNDaysAgo(n: number): string {
  return toBVIDateStr(new Date(Date.now() - n * 24 * 60 * 60 * 1000));
}

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  pending: "Pending", confirmed: "Confirmed", preparing: "Preparing",
  ready: "Ready", completed: "Completed", cancelled: "Cancelled",
};

// Inline style objects so Tailwind arbitrary-value JIT doesn't need to compile them
const STATUS_STYLE: Record<string, React.CSSProperties> = {
  pending:   { background: "rgba(255,107,0,0.12)",  color: OR,        border: "1px solid rgba(255,107,0,0.3)"  },
  confirmed: { background: "rgba(14,165,233,0.12)", color: "#0ea5e9", border: "1px solid rgba(14,165,233,0.3)" },
  preparing: { background: "rgba(255,214,10,0.12)", color: "#ffd60a", border: "1px solid rgba(255,214,10,0.3)" },
  ready:     { background: "rgba(48,209,88,0.12)",  color: "#30d158", border: "1px solid rgba(48,209,88,0.3)"  },
  completed: { background: "rgba(255,255,255,0.05)", color: TM,       border: `1px solid ${BORD}`              },
  cancelled: { background: "rgba(239,68,68,0.1)",   color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" },
};

const NEXT_STATUS: Record<string, UpdateOrderStatusBodyStatus> = {
  pending: "confirmed", confirmed: "preparing", preparing: "ready", ready: "completed",
};

const STATUS_DONUT_COLOR: Record<string, string> = {
  pending: "#ff6b00", confirmed: "#0ea5e9", preparing: "#ffd60a",
  ready: "#30d158", cancelled: "#ef4444",
  "completed-online": "#10b981", "completed-phone": "#ec4899", "completed-pos": "#7c6af7",
};

const SOURCE_LABELS: Record<string, string> = { online: "Online", phone: "Phone", pos: "Walk-in" };

function sourceBadge(source: string | null | undefined): { label: string; style: React.CSSProperties } | null {
  if (source === "online") return { label: "🌐 Online",  style: { background: "rgba(14,165,233,0.1)",  color: "#0ea5e9", border: "1px solid rgba(14,165,233,0.2)"  } };
  if (source === "pos")    return { label: "🏪 Walk-in", style: { background: "rgba(139,92,246,0.1)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.2)" } };
  if (source === "phone")  return { label: "📞 Phone",   style: { background: "rgba(255,214,10,0.1)", color: "#ffd60a", border: "1px solid rgba(255,214,10,0.2)" } };
  return null;
}

function paymentBadge(source: string | null | undefined, method: string | null | undefined): { label: string; style: React.CSSProperties } {
  if (source === "online" && method === "card")
    return { label: "💳 PlaceToPay",    style: { background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)" } };
  if (method === "card")
    return { label: "💳 Counter Card",  style: { background: "rgba(14,165,233,0.12)", color: "#0ea5e9", border: "1px solid rgba(14,165,233,0.25)" } };
  if (method === "cash")
    return { label: "💵 Cash",          style: { background: "rgba(48,209,88,0.1)",   color: "#30d158", border: "1px solid rgba(48,209,88,0.25)"  } };
  if (method === "athmovil")
    return { label: "ATH Móvil",        style: { background: "rgba(255,107,0,0.12)",  color: OR,        border: "1px solid rgba(255,107,0,0.25)"  } };
  if (method === "split")
    return { label: "Split",            style: { background: "rgba(255,214,10,0.12)", color: "#ffd60a", border: "1px solid rgba(255,214,10,0.25)" } };
  if (method === "complimentary")
    return { label: "🎁 Comp",          style: { background: "rgba(139,92,246,0.12)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.25)" } };
  return { label: method ?? "—",        style: { background: "rgba(255,255,255,0.05)", color: TM,       border: `1px solid ${BORD}`               } };
}

type RejectState = { orderId: number; reason: string } | null;
type NavItem = {
  label: string; icon: React.ElementType; href?: string;
  action?: () => void; external?: boolean; iconColor?: string;
};
type NavSection = { title: string; items: NavItem[] };

// ── Sidebar ────────────────────────────────────────────────────────────────────
// Sidebar bg is intentionally darker than the main content bg so the active-tab
// "bleed" effect is visible — the active item matches BG (#16172b) and appears
// to merge seamlessly with the main area while the sidebar reads as separate.
const SB_BG = "#0e1020";
const CORNER_R = 14;
const SIDEBAR_CSS = `
.nav-tab-active {
  position: relative;
  overflow: visible !important;
}
.nav-tab-active::before {
  content: '';
  position: absolute;
  top: ${-CORNER_R}px;
  right: 0;
  width: ${CORNER_R}px;
  height: ${CORNER_R}px;
  background: ${SB_BG};
  border-bottom-right-radius: ${CORNER_R}px;
  pointer-events: none;
  z-index: 2;
}
.nav-tab-active::after {
  content: '';
  position: absolute;
  bottom: ${-CORNER_R}px;
  right: 0;
  width: ${CORNER_R}px;
  height: ${CORNER_R}px;
  background: ${SB_BG};
  border-top-right-radius: ${CORNER_R}px;
  pointer-events: none;
  z-index: 2;
}
`;

function Sidebar({ sections, onClose, onLogout, isMobile }: {
  sections: NavSection[]; onClose?: () => void; onLogout: () => void; isMobile?: boolean;
}) {
  const [location] = useLocation();

  // ── Desktop: full labels, scalloped active-tab bleed effect ─────────────────
  if (!isMobile) {
    const navContent = (items: NavItem[]) => items.map((item) => {
      const isActive = item.href ? location === item.href : false;
      const tabContent = (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 14px",
          background: isActive ? BG : "transparent",
          borderRadius: isActive ? "12px 0 0 12px" : 10,
          borderLeft: isActive ? `3px solid ${OR}` : "3px solid transparent",
          color: isActive ? TP : TM,
          transition: "all 0.15s",
          width: "100%",
        }}>
          <item.icon style={{ width: 16, height: 16, flexShrink: 0, color: isActive ? OR : TM }} />
          <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, whiteSpace: "nowrap" }}>{item.label}</span>
        </div>
      );
      const wrapClass = isActive ? "nav-tab-active" : undefined;
      if (item.action) return (
        <button key={item.label} onClick={() => item.action!()} className={wrapClass}
          style={{ display: "block", width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
          onMouseEnter={e => { if (!isActive) (e.currentTarget.firstElementChild as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
          onMouseLeave={e => { if (!isActive) (e.currentTarget.firstElementChild as HTMLElement).style.background = "transparent"; }}
        >{tabContent}</button>
      );
      if (item.external) return (
        <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer"
          className={wrapClass} style={{ display: "block", textDecoration: "none" }}
          onMouseEnter={e => { if (!isActive) (e.currentTarget.firstElementChild as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
          onMouseLeave={e => { if (!isActive) (e.currentTarget.firstElementChild as HTMLElement).style.background = "transparent"; }}
        >{tabContent}</a>
      );
      return (
        <Link key={item.label} href={item.href!}>
          <div className={wrapClass} style={{ cursor: "pointer" }}
            onMouseEnter={e => { if (!isActive) (e.currentTarget.firstElementChild as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
            onMouseLeave={e => { if (!isActive) (e.currentTarget.firstElementChild as HTMLElement).style.background = "transparent"; }}
          >{tabContent}</div>
        </Link>
      );
    });

    return (
      <>
        <style>{SIDEBAR_CSS}</style>
        <div style={{ width: 220, display: "flex", flexDirection: "column", height: "100%", background: SB_BG, flexShrink: 0 }}>
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 18px 16px", borderBottom: `1px solid ${BORD}` }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: "linear-gradient(135deg,#ff6b00,#ff9500)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 17,
              boxShadow: "0 0 0 1px rgba(255,107,0,0.3),0 4px 14px rgba(255,107,0,0.4)",
            }}>🌮</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "-0.01em", color: TP }}>ISLAND TACOS</div>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: TM, marginTop: 1 }}>Admin Panel</div>
            </div>
          </div>

          {/* Nav — overflow:visible so concave corners aren't clipped */}
          <nav style={{ flex: 1, padding: "10px 0", overflow: "visible", display: "flex", flexDirection: "column", gap: 1 }}>
            {sections.map((section, si) => (
              <div key={section.title}>
                {si > 0 && <div style={{ height: 1, background: BORD, margin: "8px 16px" }} />}
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: TM, padding: "4px 18px 4px", marginBottom: 2 }}>
                  {section.title}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {navContent(section.items)}
                </div>
              </div>
            ))}
          </nav>

          {/* Footer */}
          <div style={{ borderTop: `1px solid ${BORD}`, padding: "10px 0", display: "flex", flexDirection: "column", gap: 1 }}>
            <Link href="/">
              <div style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", margin: "0",
                color: TM, cursor: "pointer", borderLeft: "3px solid transparent",
                borderRadius: 10, transition: "all 0.15s",
              }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = TP; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = TM; }}
              ><Store style={{ width: 16, height: 16, flexShrink: 0 }} /><span style={{ fontSize: 13, fontWeight: 500 }}>Online Store</span></div>
            </Link>
            <button onClick={onLogout} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
              background: "none", border: "none", borderLeft: "3px solid transparent",
              borderRadius: 10, cursor: "pointer", color: "#f87171", width: "100%", transition: "all 0.15s",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; e.currentTarget.style.color = "#fca5a5"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#f87171"; }}
            ><LogOut style={{ width: 16, height: 16, flexShrink: 0 }} /><span style={{ fontSize: 13, fontWeight: 500 }}>Sign Out</span></button>
          </div>
        </div>
      </>
    );
  }

  // ── Mobile: full-width drawer with labels ────────────────────────────────────
  return (
    <div className="w-72 flex flex-col h-full" style={{ background: BG, color: TP }}>
      {/* Brand */}
      <div className="flex items-center justify-between px-5 py-5" style={{ borderBottom: `1px solid ${BORD}` }}>
        <div className="flex items-center gap-3">
          <div style={{
            width: 36, height: 36, borderRadius: 11, flexShrink: 0,
            background: "linear-gradient(135deg,#ff6b00,#ff9500)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18,
            boxShadow: "0 0 0 1px rgba(255,107,0,0.3),0 4px 16px rgba(255,107,0,0.4)",
          }}>🌮</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: "-0.02em", color: TP }}>ISLAND TACOS</div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: TM, marginTop: 2 }}>Admin Panel</div>
          </div>
        </div>
        <button onClick={onClose}
          style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", color: TM }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
        ><X className="h-5 w-5" /></button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
        {sections.map((section) => (
          <div key={section.title}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: TM, padding: "0 12px", marginBottom: 6 }}>
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = item.href ? location === item.href : false;
                const activeStyle: React.CSSProperties = { background: "rgba(255,107,0,0.12)", color: OR, border: "1px solid rgba(255,107,0,0.3)", borderRadius: 10 };
                const inactiveStyle: React.CSSProperties = { background: "transparent", color: TM, border: "1px solid transparent", borderRadius: 10 };
                const content = (
                  <>
                    <item.icon className="h-4 w-4 shrink-0" style={{ color: isActive ? OR : TM }} />
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</span>
                  </>
                );
                const baseClass = "flex items-center gap-3 w-full px-3 py-2.5 text-left cursor-pointer transition-all";
                if (item.action) return (
                  <button key={item.label} onClick={() => { item.action!(); onClose?.(); }} className={baseClass} style={isActive ? activeStyle : inactiveStyle}
                    onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = TP; } }}
                    onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = TM; } }}
                  >{content}</button>
                );
                if (item.external) return (
                  <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" onClick={onClose} className={baseClass} style={inactiveStyle}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLElement).style.color = TP; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = TM; }}
                  >{content}</a>
                );
                return (
                  <Link key={item.label} href={item.href!}>
                    <div onClick={onClose} className={baseClass} style={isActive ? activeStyle : inactiveStyle}
                      onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = TP; } }}
                      onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = TM; } }}
                    >{content}</div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-5 pt-4 space-y-0.5" style={{ borderTop: `1px solid ${BORD}` }}>
        <Link href="/">
          <div onClick={onClose} className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium cursor-pointer transition-all"
            style={{ color: TM, border: "1px solid transparent" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = TP; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = TM; }}
          ><Store className="h-4 w-4" style={{ color: TM }} /> Online Store</div>
        </Link>
        <button onClick={() => { onLogout(); onClose?.(); }}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-[10px] text-sm font-medium transition-all"
          style={{ color: "#f87171", border: "1px solid transparent" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; e.currentTarget.style.color = "#fca5a5"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#f87171"; }}
        ><LogOut className="h-4 w-4" /> Sign Out</button>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function Admin() {
  useEffect(() => {
    setPageMeta("Admin — Island Tacos", "⚙️", { iconUrl: "/icon-admin-192.png", manifestUrl: "/manifest-admin.json" });
  }, []);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [waReceiptState, setWaReceiptState] = useState<Record<number, "idle" | "sending" | "ok" | "error">>({});
  const [rejectState, setRejectState] = useState<RejectState>(null);
  const [historyOrder, setHistoryOrder] = useState<Order | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [preset, setPreset] = useState<DatePreset>("today");
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [syncMessage, setSyncMessage] = useState("");
  const [lastSync, setLastSync] = useState<string | null>(() => localStorage.getItem("lastMenuSync"));
  const [importState, setImportState] = useState<"idle" | "importing" | "success" | "error">("idle");
  const [importMessage, setImportMessage] = useState("");
  const [csvState, setCsvState] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [csvMessage, setCsvMessage] = useState("");
  const [pullMenuState, setPullMenuState] = useState<"idle" | "pulling" | "success" | "error">("idle");
  const [pullMenuMessage, setPullMenuMessage] = useState("");
  const [pausedUntil, setPausedUntil] = useState<string | null>(null);
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [pauseLoading, setPauseLoading] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const prevOrderIdsRef = useRef<Set<number>>(new Set());
  const isFirstFetchRef = useRef(true);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include", cache: "no-store", headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => { if (!d.authed) navigate(adminRoutes.login); else if (d.role !== "admin") navigate(adminRoutes.pos); })
      .catch(() => navigate(adminRoutes.login));
  }, [navigate]);

  useEffect(() => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    fetch(`${base}/api/settings`, { credentials: "include", headers: authHeaders() })
      .then(r => r.json())
      .then((d: Record<string, string>) => {
        const val = d.paused_until ?? "";
        setPausedUntil(val && new Date(val) > new Date() ? val : null);
      })
      .catch(() => {});
  }, []);

  const handlePause = async (hours: number) => {
    setPauseLoading(true);
    const until = new Date(Date.now() + hours * 3_600_000).toISOString();
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const r = await fetch(`${base}/api/settings`, {
        method: "PATCH",
        credentials: "include",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ paused_until: until }),
      });
      if (!r.ok) throw new Error("Failed");
      setPausedUntil(until);
      setShowPauseDialog(false);
      toast({ title: "Store paused", description: `Online ordering paused until ${new Date(until).toLocaleDateString("en-US", { timeZone: "America/Puerto_Rico", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.` });
    } catch {
      toast({ title: "Error", description: "Could not pause the store. Try again.", variant: "destructive" });
    } finally {
      setPauseLoading(false);
    }
  };

  const handleResume = async () => {
    setPauseLoading(true);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const r = await fetch(`${base}/api/settings`, {
        method: "PATCH",
        credentials: "include",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ paused_until: "" }),
      });
      if (!r.ok) throw new Error("Failed");
      setPausedUntil(null);
      toast({ title: "Store resumed", description: "Online ordering is back on." });
    } catch {
      toast({ title: "Error", description: "Could not resume the store. Try again.", variant: "destructive" });
    } finally {
      setPauseLoading(false);
    }
  };

  const logout = async () => {
    clearAuthToken();
    await fetch("/api/auth/logout", { method: "POST", credentials: "include", headers: authHeaders() });
    navigate(adminRoutes.login);
  };

  const handleSync = async () => {
    setSyncState("syncing"); setSyncMessage("");
    try {
      const r = await fetch("/api/sync/push", { method: "POST", credentials: "include", headers: authHeaders() });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Sync failed");
      const ts = new Date().toLocaleString();
      setLastSync(ts); localStorage.setItem("lastMenuSync", ts);
      setSyncState("success");
      setSyncMessage(`${data.pushed?.categories ?? 0} categories, ${data.pushed?.items ?? 0} items pushed`);
      setTimeout(() => setSyncState("idle"), 4000);
    } catch (e) { setSyncState("error"); setSyncMessage(String(e)); }
  };

  const handlePullMenuFromCloud = async () => {
    if (pullMenuState === "pulling") return;
    setPullMenuState("pulling"); setPullMenuMessage("");
    try {
      const r = await fetch("/api/sync/pull", { method: "POST", credentials: "include", headers: authHeaders() });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Pull failed");
      setPullMenuState("success");
      setPullMenuMessage(`${data.items ?? 0} items, ${data.modifiers ?? 0} modifiers pulled from cloud`);
      setTimeout(() => setPullMenuState("idle"), 5000);
    } catch (e) { setPullMenuState("error"); setPullMenuMessage(String(e)); }
  };

  const handleLoyverseImport = async () => {
    if (importState === "importing") return;
    setImportState("importing"); setImportMessage("Fetching data from Loyverse… this may take a minute.");
    try {
      const r = await fetch("/api/loyverse/import-history", { method: "POST", credentials: "include", headers: authHeaders() });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Import failed");
      const { customersImported, customersSkipped, ordersImported, ordersSkipped, truncated, errors } = data;
      setImportState("success");
      setImportMessage(
        `Imported ${ordersImported} orders + ${customersImported} customers` +
        (ordersSkipped || customersSkipped ? ` (${ordersSkipped}/${customersSkipped} already existed)` : "") +
        (truncated ? " — receipts limited to last 31 days." : ".") +
        (errors?.length ? ` ${errors.length} error(s): ${errors[0]}` : "")
      );
    } catch (e) { setImportState("error"); setImportMessage(String(e)); }
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setCsvState("uploading"); setCsvMessage("Uploading & importing CSV — please wait…");
    try {
      const form = new FormData(); form.append("file", file);
      const r = await fetch("/api/loyverse/import-csv", { method: "POST", credentials: "include", headers: authHeaders(), body: form });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "CSV import failed");
      const { imported, skipped, errors: errs } = data;
      setCsvState("success");
      setCsvMessage(`Imported ${imported} orders` + (skipped ? ` (${skipped} already existed)` : "") + (errs ? `, ${errs} row error(s)` : "") + ".");
      setTimeout(() => { setCsvState("idle"); setCsvMessage(""); }, 8000);
    } catch (e) { setCsvState("error"); setCsvMessage(String(e)); }
    finally { if (csvInputRef.current) csvInputRef.current.value = ""; }
  };

  const dateParams = useMemo(() => {
    if (preset === "today")     return { startDate: bviNDaysAgo(0), endDate: bviNDaysAgo(0) };
    if (preset === "yesterday") return { startDate: bviNDaysAgo(1), endDate: bviNDaysAgo(1) };
    if (preset === "last7")     return { startDate: bviNDaysAgo(6), endDate: bviNDaysAgo(0) };
    return {
      startDate: customRange?.from ? toBVIDateStr(customRange.from) : undefined,
      endDate: customRange?.to ? toBVIDateStr(customRange.to) : (customRange?.from ? toBVIDateStr(customRange.from) : undefined),
    };
  }, [preset, customRange]);

  const statsQueryKey  = getGetAdminStatsQueryKey(dateParams);
  const ordersQueryKey = getGetRecentOrdersQueryKey({ limit: 50, ...dateParams });

  const { data: stats } = useGetAdminStats(dateParams, { query: { queryKey: statsQueryKey, refetchInterval: 5_000 } });
  const { data: orders, isLoading } = useGetRecentOrders({ limit: 50, ...dateParams }, { query: { queryKey: ordersQueryKey, refetchInterval: 5_000 } });

  useEffect(() => {
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: statsQueryKey });
      queryClient.invalidateQueries({ queryKey: ordersQueryKey });
    };
    window.addEventListener("kds:order-updated", refresh);
    let bc: BroadcastChannel | null = null;
    try { bc = new BroadcastChannel("island_tacos_kds"); bc.onmessage = (e) => { if (e.data?.type === "kds:order-updated") refresh(); }; } catch {}
    return () => { window.removeEventListener("kds:order-updated", refresh); bc?.close(); };
  }, [queryClient]);

  const updateStatus = useUpdateOrderStatus();

  useEffect(() => {
    if (!orders) return;
    const activeIds = new Set(orders.filter((o) => ["pending","confirmed","preparing","ready"].includes(o.status)).map((o) => o.id));
    if (isFirstFetchRef.current) { isFirstFetchRef.current = false; prevOrderIdsRef.current = activeIds; return; }
    const hasNew = [...activeIds].some((id) => !prevOrderIdsRef.current.has(id));
    if (hasNew) toast({ title: "New order received!", description: "Check active orders below." });
    prevOrderIdsRef.current = activeIds;
  }, [orders, toast]);

  const handleStatusChange = (orderId: number, status: UpdateOrderStatusBodyStatus, cancellationReason?: string) => {
    updateStatus.mutate(
      { id: orderId, data: { status, cancellationReason: cancellationReason ?? null } },
      { onSuccess: () => { queryClient.invalidateQueries({ queryKey: statsQueryKey }); queryClient.invalidateQueries({ queryKey: ordersQueryKey }); setRejectState(null); } }
    );
  };
  const handleCancelClick = (orderId: number) => {
    setRejectState(rejectState?.orderId === orderId ? null : { orderId, reason: "" });
  };

  const activeOrders = orders?.filter((o) => ["pending","confirmed","preparing","ready"].includes(o.status)) ?? [];
  const pastOrders   = orders?.filter((o) => ["completed","cancelled"].includes(o.status)) ?? [];

  const isMultiDay = preset === "last7" || (preset === "custom" && customRange?.to && customRange.from && customRange.to.getTime() !== customRange.from.getTime());

  const hourlyData = useMemo(() => {
    if (isMultiDay) {
      const byDate: Record<string, { revenue: number; count: number }> = {};
      (orders ?? []).forEach((o) => {
        const d = toBVIDateStr(new Date(o.createdAt));
        if (!byDate[d]) byDate[d] = { revenue: 0, count: 0 };
        byDate[d].revenue += o.total; byDate[d].count++;
      });
      return Object.entries(byDate).sort(([a],[b]) => a.localeCompare(b))
        .map(([date, d]) => ({ hour: date.slice(5), revenue: parseFloat(d.revenue.toFixed(2)), orders: d.count }));
    }
    const byHour: Record<number, { revenue: number; count: number }> = {};
    for (let h = 10; h <= 20; h++) byHour[h] = { revenue: 0, count: 0 };
    (orders ?? []).forEach((o) => {
      const h = new Date(o.createdAt).getHours();
      if (byHour[h] !== undefined) { byHour[h].revenue += o.total; byHour[h].count++; }
    });
    return Object.entries(byHour).map(([h, d]) => ({
      hour: `${Number(h) % 12 || 12}${Number(h) >= 12 ? "pm" : "am"}`,
      revenue: parseFloat(d.revenue.toFixed(2)), orders: d.count,
    }));
  }, [orders, isMultiDay]);

  const statusDonut = useMemo(() => {
    const statusCount: Record<string, number> = {};
    (orders ?? []).forEach((o) => { if (o.status !== "completed") statusCount[o.status] = (statusCount[o.status] ?? 0) + 1; });
    const entries: { name: string; value: number; color: string; key: string }[] = [];
    for (const s of ["pending","confirmed","preparing","ready","cancelled"]) {
      if (statusCount[s]) entries.push({ key: s, name: STATUS_LABELS[s] ?? s, value: statusCount[s], color: STATUS_DONUT_COLOR[s] ?? "#94a3b8" });
    }
    const cbs = stats?.completedBySource;
    if (cbs) {
      for (const src of ["online","phone","pos"] as const) {
        const count = cbs[src] ?? 0;
        if (count > 0) entries.push({ key: `completed-${src}`, name: `Done · ${SOURCE_LABELS[src]}`, value: count, color: STATUS_DONUT_COLOR[`completed-${src}`] ?? "#10b981" });
      }
    }
    return entries;
  }, [orders, stats]);

  const topItemsData = useMemo(() =>
    (stats?.popularItems ?? []).slice(0, 8).map((i) => ({ name: i.name.length > 14 ? i.name.slice(0,13)+"…" : i.name, count: i.count })),
    [stats]
  );

  const navSections: NavSection[] = [
    {
      title: "Operations",
      items: [
        { label: "Dashboard",       icon: LayoutDashboard, href: adminRoutes.dashboard, iconColor: "text-emerald-400" },
        { label: "POS Terminal",    icon: ShoppingBag, iconColor: "text-amber-400", action: () => navigate(`${adminRoutes.login}?redirect=${encodeURIComponent(adminRoutes.pos)}`) },
        { label: "Kitchen Display", icon: ChefHat, href: adminRoutes.kitchen, iconColor: "text-orange-400" },
        { label: "Customer Display",icon: Monitor, href: adminRoutes.display, external: true, iconColor: "text-blue-400" },
      ],
    },
    {
      title: "Manage",
      items: [
        { label: "Menu Editor",   icon: UtensilsCrossed, href: adminRoutes.menu,      iconColor: "text-green-400" },
        { label: "Modifiers",     icon: Settings,        href: adminRoutes.modifiers,  iconColor: "text-green-500" },
        { label: "Store Settings",icon: Settings,        href: adminRoutes.settings,   iconColor: "text-muted-foreground" },
        { label: "System Monitor",icon: Activity,        href: adminRoutes.system,      iconColor: "text-cyan-400" },
      ],
    },
    {
      title: "Analytics",
      items: [
        { label: "Reports",         icon: BarChart3,  href: adminRoutes.reports,       iconColor: "text-purple-400" },
        { label: "Financials",      icon: History,    href: adminRoutes.financials,    iconColor: "text-emerald-400" },
        { label: "Customers",       icon: Users,      href: adminRoutes.customers,     iconColor: "text-blue-400" },
        { label: "Payment Events",  icon: CreditCard, href: adminRoutes.paymentEvents, iconColor: "text-yellow-400" },
        { label: "AI Insights",     icon: Sparkles,   href: adminRoutes.insights,      iconColor: "text-violet-400" },
      ],
    },
  ];

  // ── Stat card config ───────────────────────────────────────────────────────
  const avgOrder = stats?.todayOrders ? (stats.todayRevenue ?? 0) / stats.todayOrders : 0;
  const popCards = [
    { art: "💰", grad: "linear-gradient(145deg,#ff6b00,#ff3d00,#c0392b)", glow: "rgba(255,107,0,0.55)", label: "Revenue",   value: `$${(stats?.todayRevenue ?? 0).toFixed(2)}`, sub: "today's total" },
    { art: "🧾", grad: "linear-gradient(145deg,#7c6af7,#5b4cf5,#3730a3)", glow: "rgba(124,106,247,0.55)", label: "Orders",    value: String(stats?.todayOrders ?? 0),            sub: `${stats?.pendingOrders ?? 0} still active` },
    { art: "⭐", grad: "linear-gradient(145deg,#10b981,#059669,#064e3b)", glow: "rgba(16,185,129,0.5)", label: "Completed", value: String(stats?.completedOrders ?? 0),        sub: "served today" },
    { art: "📈", grad: "linear-gradient(145deg,#0ea5e9,#0284c7,#1e3a8a)", glow: "rgba(14,165,233,0.5)", label: "Avg Order", value: avgOrder ? `$${avgOrder.toFixed(2)}` : "—",  sub: "per order" },
    { art: "🚫", grad: "linear-gradient(145deg,#ef4444,#dc2626,#7f1d1d)", glow: "rgba(239,68,68,0.4)", label: "Cancelled", value: String(stats?.cancelledOrders ?? 0),         sub: "rejected" },
  ];

  // ── Tool button helper ─────────────────────────────────────────────────────
  type ToolState = "idle" | "syncing" | "success" | "error" | "importing" | "pulling" | "uploading";
  function toolBtnStyle(state: ToolState, idleColor = OR): React.CSSProperties {
    if (state === "success") return { background: "rgba(48,209,88,0.1)", color: "#30d158", border: "1px solid rgba(48,209,88,0.3)", borderRadius: 10, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" };
    if (state === "error")   return { background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" };
    const busy = state !== "idle";
    return { background: `rgba(${idleColor === OR ? "255,107,0" : "124,106,247"},0.1)`, color: idleColor, border: `1px solid rgba(${idleColor === OR ? "255,107,0" : "124,106,247"},0.3)`, borderRadius: 10, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1 };
  }

  return (<>
    <div className="flex overflow-hidden" style={{ height: "100dvh", background: BG, color: TP, fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Desktop Sidebar — transparent, blends into bg */}
      <aside className="hidden lg:flex flex-col shrink-0">
        <Sidebar sections={navSections} onLogout={logout} />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative h-full shadow-2xl">
            <Sidebar sections={navSections} onClose={() => setSidebarOpen(false)} onLogout={logout} isMobile />
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar — floating, no hard border */}
        <header className="shrink-0 flex items-center justify-between px-4 md:px-7" style={{ height: 58 }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg transition-colors"
              style={{ color: TM }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 900, letterSpacing: "-0.04em", color: TP, lineHeight: 1 }}>Dashboard</h1>
              <p style={{ fontSize: 11, color: TM, marginTop: 2 }}>
                {/* TODO(store-settings): replace with useStoreSettings().storeName */}
                Island Tacos — Admin
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Pause / Live pill */}
            {pausedUntil ? (
              <button
                onClick={handleResume}
                disabled={pauseLoading}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 20, padding: "6px 12px", cursor: "pointer" }}
              >
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 8px rgba(239,68,68,0.8)", display: "inline-block" }} />
                <span style={{ fontSize: 11, color: "#f87171", fontWeight: 700 }}>PAUSED</span>
              </button>
            ) : (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(48,209,88,0.1)", border: "1px solid rgba(48,209,88,0.25)", borderRadius: 20, padding: "6px 12px" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#30d158", boxShadow: "0 0 8px rgba(48,209,88,0.8)", display: "inline-block" }} />
                <span style={{ fontSize: 11, color: "#30d158", fontWeight: 700 }}>Live</span>
              </div>
            )}
            {/* Pause button */}
            <button
              onClick={() => pausedUntil ? handleResume() : setShowPauseDialog(true)}
              disabled={pauseLoading}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: pausedUntil ? "rgba(48,209,88,0.1)" : "rgba(239,68,68,0.1)",
                color: pausedUntil ? "#30d158" : "#f87171",
                border: `1px solid ${pausedUntil ? "rgba(48,209,88,0.3)" : "rgba(239,68,68,0.3)"}`,
                borderRadius: 20, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: pauseLoading ? "default" : "pointer", opacity: pauseLoading ? 0.6 : 1,
              }}
            >
              {pausedUntil ? <PlayCircle className="h-3.5 w-3.5" /> : <PauseCircle className="h-3.5 w-3.5" />}
              {pausedUntil ? "Resume" : "Pause"}
            </button>
            {/* POS button */}
            <button
              onClick={() => navigate(`${adminRoutes.login}?redirect=${encodeURIComponent(adminRoutes.pos)}`)}
              style={{ background: "linear-gradient(135deg,#ff6b00,#ff9500)", color: "#fff", border: "none", borderRadius: 20, padding: "8px 18px", fontSize: 12, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 18px rgba(255,107,0,0.4)" }}
            >🧾 POS</button>
          </div>
        </header>

        {/* Pause banner */}
        {pausedUntil && (
          <div style={{ margin: "0 28px 0", padding: "10px 18px", borderRadius: 14, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <PauseCircle style={{ color: "#f87171", flexShrink: 0 }} className="h-4 w-4" />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#f87171" }}>
                Online ordering is paused
              </span>
              <span style={{ fontSize: 12, color: "#fca5a5" }}>
                · resumes {new Date(pausedUntil).toLocaleDateString("en-US", { timeZone: "America/Puerto_Rico", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </span>
            </div>
            <button
              onClick={handleResume}
              disabled={pauseLoading}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(48,209,88,0.12)", color: "#30d158", border: "1px solid rgba(48,209,88,0.3)", borderRadius: 10, padding: "5px 14px", fontSize: 12, fontWeight: 700, cursor: pauseLoading ? "default" : "pointer" }}
            >
              <PlayCircle className="h-3.5 w-3.5" /> Resume Now
            </button>
          </div>
        )}

        {/* Pause dialog */}
        {showPauseDialog && (
          <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
            onClick={() => setShowPauseDialog(false)}>
            <div style={{ background: "#1e1f38", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 22, padding: "28px 28px 24px", width: "min(92vw, 360px)", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <PauseCircle style={{ color: "#f87171" }} className="h-5 w-5" />
                <span style={{ fontSize: 17, fontWeight: 900, color: "#e8eaf6", letterSpacing: "-0.03em" }}>Pause Online Ordering</span>
              </div>
              <p style={{ fontSize: 13, color: "#7077a1", marginBottom: 20, lineHeight: 1.5 }}>
                Customers won't be able to place new online orders during the pause. Walk-in POS is unaffected.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Until tomorrow morning", hours: 24 },
                  { label: "2 days",                 hours: 48 },
                  { label: "3 days",                 hours: 72 },
                  { label: "1 week",                 hours: 168 },
                ].map(opt => (
                  <button
                    key={opt.hours}
                    onClick={() => handlePause(opt.hours)}
                    disabled={pauseLoading}
                    style={{ padding: "11px 16px", borderRadius: 12, background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)", fontSize: 13, fontWeight: 700, cursor: pauseLoading ? "default" : "pointer", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.16)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
                  >
                    <span>{opt.label}</span>
                    <span style={{ fontSize: 11, color: "#fca5a5", fontWeight: 500 }}>
                      until {new Date(Date.now() + opt.hours * 3_600_000).toLocaleDateString("en-US", { timeZone: "America/Puerto_Rico", weekday: "short", month: "short", day: "numeric" })}
                    </span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowPauseDialog(false)}
                style={{ marginTop: 16, width: "100%", padding: "9px", borderRadius: 10, background: "transparent", color: "#7077a1", border: "1px solid rgba(255,255,255,0.07)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >Cancel</button>
            </div>
          </div>
        )}

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto" style={{ padding: "0 28px 32px" }}>

          {/* Date range picker */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {(["today","yesterday","last7","custom"] as DatePreset[]).map((p) => {
              const isActive = preset === p;
              return (
                <button key={p}
                  onClick={() => { setPreset(p); if (p !== "custom") setCalOpen(false); else setCalOpen(true); }}
                  style={{
                    padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
                    background: isActive ? "rgba(255,107,0,0.15)" : "rgba(255,255,255,0.04)",
                    color: isActive ? OR : TM,
                    border: isActive ? "1px solid rgba(255,107,0,0.4)" : `1px solid ${BORD}`,
                  }}
                >
                  {p === "today" ? "Today" : p === "yesterday" ? "Yesterday" : p === "last7" ? "Last 7 Days" : "Custom"}
                </button>
              );
            })}
            {preset === "custom" && (
              <Popover open={calOpen} onOpenChange={setCalOpen}>
                <PopoverTrigger asChild>
                  <button style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer", background: "rgba(255,255,255,0.04)", color: TM, border: `1px solid ${BORD}` }}>
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {customRange?.from
                      ? customRange.to && customRange.to.getTime() !== customRange.from.getTime()
                        ? `${toBVIDateStr(customRange.from)} → ${toBVIDateStr(customRange.to)}`
                        : toBVIDateStr(customRange.from)
                      : "Pick dates…"}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="range" selected={customRange}
                    onSelect={(range) => { setCustomRange(range); if (range?.from && range?.to) setCalOpen(false); }}
                    numberOfMonths={1} disabled={{ after: new Date() }} />
                </PopoverContent>
              </Popover>
            )}
            <span style={{ fontSize: 11, color: TM, marginLeft: 4 }}>
              {preset === "today" ? bviNDaysAgo(0)
                : preset === "yesterday" ? bviNDaysAgo(1)
                : preset === "last7" ? `${bviNDaysAgo(6)} → ${bviNDaysAgo(0)}`
                : dateParams.startDate ? (dateParams.endDate && dateParams.endDate !== dateParams.startDate ? `${dateParams.startDate} → ${dateParams.endDate}` : dateParams.startDate) : ""}
            </span>
          </div>

          {/* ── Stat cards — horizontal scroll on mobile, inline on desktop ── */}
          <div style={{ overflowX: "auto", overflowY: "hidden", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", marginBottom: 20, paddingBottom: 2 }}>
            <div style={{ display: "flex", gap: 14, minWidth: "max-content" }}>
              {popCards.map((fc) => (
                <div key={fc.label} style={{ width: 168, flexShrink: 0 }}>
                  <div style={{ background: fc.grad, borderRadius: 20, padding: "16px 16px 14px", position: "relative", overflow: "hidden", boxShadow: `0 6px 24px ${fc.glow}`, height: 108, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                    {/* Shine */}
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(155deg,rgba(255,255,255,0.14) 0%,transparent 50%)", pointerEvents: "none" }} />
                    {/* Single emoji — large, faded, decorative */}
                    <div style={{ position: "absolute", top: -6, right: 0, fontSize: 62, opacity: 0.22, lineHeight: 1, transform: "rotate(14deg)", pointerEvents: "none", userSelect: "none" }}>
                      {fc.art}
                    </div>
                    {/* Text */}
                    <div style={{ position: "relative", zIndex: 1 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>{fc.label}</div>
                      <div style={{ fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: "-0.05em", lineHeight: 1, marginBottom: 3 }}>{fc.value}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>{fc.sub}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Charts row ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
            {/* Revenue chart — 2 cols */}
            <div className="xl:col-span-2" style={{ background: CARD, border: `1px solid ${BORD}`, borderRadius: 22, padding: "20px 22px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 70, background: "linear-gradient(180deg,rgba(255,255,255,0.03) 0%,transparent 100%)", pointerEvents: "none" }} />
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.03em", color: TP }}>Revenue</div>
                  <div style={{ fontSize: 11, color: TM, marginTop: 2 }}>{isMultiDay ? "Daily breakdown" : "Hourly breakdown"}</div>
                </div>
                <TrendingUp className="h-5 w-5" style={{ color: OR }} />
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={hourlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={OR} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={OR} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11, fill: TM }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: TM }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={{ color: TM }} formatter={(v: number) => [`$${v.toFixed(2)}`, "Revenue"]} />
                  <Area type="monotone" dataKey="revenue" stroke={OR} strokeWidth={2.5} fill="url(#revGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Order mix donut */}
            <div style={{ background: CARD, border: `1px solid ${BORD}`, borderRadius: 22, padding: "20px 22px" }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.03em", color: TP }}>Order Mix</div>
                  <div style={{ fontSize: 11, color: TM, marginTop: 2 }}>By status (recent 50)</div>
                </div>
                <ShoppingBag className="h-5 w-5" style={{ color: "#0ea5e9" }} />
              </div>
              {statusDonut.length === 0 ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: TM, fontSize: 14 }}>No orders yet</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={statusDonut} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                        {statusDonut.map((d) => <Cell key={d.key} fill={d.color} />)}
                      </Pie>
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                    {statusDonut.map((d) => (
                      <span key={d.key} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: TM }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color, display: "inline-block", flexShrink: 0 }} />
                        {d.name} ({d.value})
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Top items bar chart */}
          {topItemsData.length > 0 && (
            <div style={{ background: CARD, border: `1px solid ${BORD}`, borderRadius: 22, padding: "20px 22px", marginBottom: 16 }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.03em", color: TP }}>Top Items</div>
                  <div style={{ fontSize: 11, color: TM, marginTop: 2 }}>Units sold</div>
                </div>
                <TrendingUp className="h-5 w-5" style={{ color: "#7c6af7" }} />
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={topItemsData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: TM }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: TM }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Bar dataKey="count" fill="#7c6af7" radius={[0,4,4,0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Data tools ─────────────────────────────────────────────────── */}
          <div style={{ background: CARD, border: `1px solid ${BORD}`, borderRadius: 22, padding: "20px 22px", marginBottom: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.02em", color: TP, marginBottom: 16 }}>Data Tools</div>

            {/* Menu sync */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4" style={{ borderBottom: `1px solid ${BORD}` }}>
              <div className="flex items-center gap-3">
                <div style={{ background: "rgba(14,165,233,0.12)", borderRadius: 10, padding: 8 }}><CloudUpload className="h-4 w-4" style={{ color: "#0ea5e9" }} /></div>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 13, color: TP }}>Sync Menu to Online Store</p>
                  <p style={{ fontSize: 11, color: TM }}>{lastSync ? `Last synced: ${lastSync}` : "Pushes your menu to the ordering site"}</p>
                  {syncMessage && <p style={{ fontSize: 11, marginTop: 2, color: syncState === "error" ? "#f87171" : "#30d158" }}>{syncMessage}</p>}
                </div>
              </div>
              <button onClick={handleSync} disabled={syncState === "syncing"} style={toolBtnStyle(syncState as ToolState, "#0ea5e9")}>
                <CloudUpload className={`h-3.5 w-3.5 inline mr-1.5 ${syncState === "syncing" ? "animate-pulse" : ""}`} />
                {syncState === "syncing" ? "Syncing…" : syncState === "success" ? "Synced!" : syncState === "error" ? "Retry" : "Sync Now"}
              </button>
            </div>

            {/* Pull from cloud */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 pt-4" style={{ borderBottom: `1px solid ${BORD}` }}>
              <div className="flex items-center gap-3">
                <div style={{ background: "rgba(16,185,129,0.12)", borderRadius: 10, padding: 8 }}><CloudDownload className="h-4 w-4" style={{ color: "#10b981" }} /></div>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 13, color: TP }}>Pull Menu from Cloud</p>
                  <p style={{ fontSize: 11, color: TM }}>Resyncs all items &amp; modifiers from the online store to this device</p>
                  {pullMenuMessage && <p style={{ fontSize: 11, marginTop: 2, color: pullMenuState === "error" ? "#f87171" : "#30d158" }}>{pullMenuMessage}</p>}
                </div>
              </div>
              <button onClick={handlePullMenuFromCloud} disabled={pullMenuState === "pulling"} style={toolBtnStyle(pullMenuState as ToolState, "#10b981")}>
                <CloudDownload className={`h-3.5 w-3.5 inline mr-1.5 ${pullMenuState === "pulling" ? "animate-pulse" : ""}`} />
                {pullMenuState === "pulling" ? "Pulling…" : pullMenuState === "success" ? "Done!" : pullMenuState === "error" ? "Retry" : "Pull Now"}
              </button>
            </div>

            {/* Loyverse import */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 pt-4" style={{ borderBottom: `1px solid ${BORD}` }}>
              <div className="flex items-center gap-3">
                <div style={{ background: "rgba(124,106,247,0.12)", borderRadius: 10, padding: 8 }}><History className="h-4 w-4" style={{ color: "#7c6af7" }} /></div>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 13, color: TP }}>Import from Loyverse API</p>
                  <p style={{ fontSize: 11, color: TM }}>{importState === "importing" ? "Fetching from Loyverse…" : "Imports customers + last 30 days of receipts"}</p>
                  {importMessage && <p style={{ fontSize: 11, marginTop: 2, color: importState === "error" ? "#f87171" : "#30d158" }}>{importMessage}</p>}
                </div>
              </div>
              <button onClick={handleLoyverseImport} disabled={importState === "importing" || importState === "success"} style={toolBtnStyle(importState as ToolState, "#7c6af7")}>
                <History className={`h-3.5 w-3.5 inline mr-1.5 ${importState === "importing" ? "animate-spin" : ""}`} />
                {importState === "importing" ? "Importing…" : importState === "success" ? "Imported!" : importState === "error" ? "Retry" : "Import Now"}
              </button>
            </div>

            {/* CSV upload */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
              <div className="flex items-center gap-3">
                <div style={{ background: "rgba(99,102,241,0.12)", borderRadius: 10, padding: 8 }}><CloudUpload className="h-4 w-4" style={{ color: "#6366f1" }} /></div>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 13, color: TP }}>Upload Loyverse CSV</p>
                  <p style={{ fontSize: 11, color: TM }}>Import full order history from exported CSV</p>
                  {csvMessage && <p style={{ fontSize: 11, marginTop: 2, color: csvState === "error" ? "#f87171" : "#30d158" }}>{csvMessage}</p>}
                </div>
              </div>
              <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCSVUpload} />
              <button onClick={() => csvInputRef.current?.click()} disabled={csvState === "uploading"} style={toolBtnStyle(csvState as ToolState, "#6366f1")}>
                <CloudUpload className={`h-3.5 w-3.5 inline mr-1.5 ${csvState === "uploading" ? "animate-pulse" : ""}`} />
                {csvState === "uploading" ? "Uploading…" : csvState === "success" ? "Imported!" : csvState === "error" ? "Retry" : "Upload CSV"}
              </button>
            </div>
          </div>

          {/* ── Active orders ──────────────────────────────────────────────── */}
          <section className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <h2 style={{ fontSize: 18, fontWeight: 900, letterSpacing: "-0.04em", color: TP }}>Active Orders</h2>
              {activeOrders.length > 0 && (
                <span style={{ fontSize: 11, fontWeight: 800, background: "rgba(255,107,0,0.15)", color: OR, border: "1px solid rgba(255,107,0,0.3)", borderRadius: 20, padding: "2px 10px" }}>
                  {activeOrders.length}
                </span>
              )}
            </div>
            {isLoading ? (
              <p style={{ color: TM }}>Loading orders…</p>
            ) : activeOrders.length === 0 ? (
              <div style={{ background: CARD, border: `1px solid ${BORD}`, borderRadius: 22, padding: "32px 24px", textAlign: "center", color: TM, fontSize: 14 }}>
                No active orders right now.
              </div>
            ) : (
              <div className="space-y-3">
                {activeOrders.map((order) => (
                  <div key={order.id} style={{ background: CARD, border: `1px solid ${BORD}`, borderRadius: 22, padding: "18px 20px" }}>
                    {/* Order header */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 16, color: "#30d158", letterSpacing: "0.02em" }}>{order.confirmationCode}</span>
                          <span style={{ ...STATUS_STYLE[order.status], fontSize: 10, fontWeight: 800, borderRadius: 8, padding: "3px 9px", letterSpacing: "0.04em" }}>
                            {STATUS_LABELS[order.status]}
                          </span>
                          <span style={{ background: "rgba(255,255,255,0.06)", color: TM, fontSize: 10, fontWeight: 600, borderRadius: 8, padding: "3px 9px", textTransform: "capitalize" }}>
                            {order.orderType}
                          </span>
                          {(() => { const s = sourceBadge(order.source); return s ? <span style={{ ...s.style, fontSize: 10, fontWeight: 600, borderRadius: 8, padding: "3px 9px" }}>{s.label}</span> : null; })()}
                          {order.paymentMethod && (() => { const p = paymentBadge(order.source, order.paymentMethod); return <span style={{ ...p.style, fontSize: 10, fontWeight: 600, borderRadius: 8, padding: "3px 9px" }}>{p.label}</span>; })()}
                        </div>
                        <p style={{ fontWeight: 700, fontSize: 14, color: TP }}>{order.customerName}</p>
                        {order.customerPhone ? (
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span style={{ fontSize: 13, color: TM }}>{order.customerPhone}</span>
                            <a href={`tel:${order.customerPhone}`}
                              style={{ fontSize: 11, padding: "2px 10px", borderRadius: 20, background: "rgba(14,165,233,0.12)", color: "#0ea5e9", border: "1px solid rgba(14,165,233,0.25)", fontWeight: 600, textDecoration: "none" }}>
                              📞 Call
                            </a>
                            {/* TODO(store-settings): interpolate store name from getStoreSettings() */}
                            <button
                              onClick={async () => {
                                const st = waReceiptState[order.id];
                                if (st === "sending" || st === "ok") return;
                                setWaReceiptState(prev => ({ ...prev, [order.id]: "sending" }));
                                try {
                                  const r = await fetch(`/api/orders/${order.id}/whatsapp-receipt`, { method: "POST", credentials: "include", headers: authHeaders() });
                                  setWaReceiptState(prev => ({ ...prev, [order.id]: r.ok ? "ok" : "error" }));
                                  setTimeout(() => setWaReceiptState(prev => ({ ...prev, [order.id]: "idle" })), 3000);
                                } catch {
                                  setWaReceiptState(prev => ({ ...prev, [order.id]: "error" }));
                                  setTimeout(() => setWaReceiptState(prev => ({ ...prev, [order.id]: "idle" })), 3000);
                                }
                              }}
                              style={{ fontSize: 11, padding: "2px 10px", borderRadius: 20, background: waReceiptState[order.id] === "ok" ? "rgba(48,209,88,0.25)" : waReceiptState[order.id] === "error" ? "rgba(255,59,48,0.15)" : "rgba(48,209,88,0.12)", color: waReceiptState[order.id] === "error" ? "#ff6961" : "#30d158", border: `1px solid ${waReceiptState[order.id] === "error" ? "rgba(255,59,48,0.35)" : "rgba(48,209,88,0.25)"}`, fontWeight: 600, cursor: waReceiptState[order.id] === "sending" ? "wait" : "pointer" }}>
                              {waReceiptState[order.id] === "sending" ? "Sending…" : waReceiptState[order.id] === "ok" ? "✅ Sent!" : waReceiptState[order.id] === "error" ? "❌ Failed" : "💬 WhatsApp"}
                            </button>
                          </div>
                        ) : (
                          <p style={{ fontSize: 13, color: TM, marginTop: 2 }}>Walk-in</p>
                        )}
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <p style={{ fontSize: 20, fontWeight: 900, color: TP, letterSpacing: "-0.03em" }}>${order.total.toFixed(2)}</p>
                        <p style={{ fontSize: 11, color: TM, marginTop: 2 }}>{new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    </div>

                    {/* Items */}
                    <div style={{ marginBottom: 14 }} className="space-y-1">
                      {order.items?.map((item) => (
                        <div key={item.id} className="flex gap-2" style={{ fontSize: 13 }}>
                          <span style={{ fontWeight: 700, color: TP }}>{item.quantity}×</span>
                          <span style={{ color: TM }}>{item.menuItemName}</span>
                          {item.notes && <span style={{ color: TM, fontStyle: "italic" }}>— {item.notes}</span>}
                        </div>
                      ))}
                      {order.notes && <p style={{ fontSize: 13, color: TM, fontStyle: "italic", marginTop: 4 }}>Note: {order.notes}</p>}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {NEXT_STATUS[order.status] && (
                        <button
                          onClick={() => handleStatusChange(order.id, NEXT_STATUS[order.status])}
                          disabled={updateStatus.isPending}
                          style={{ background: "linear-gradient(135deg,#ff6b00,#ff9500)", color: "#fff", border: "none", borderRadius: 20, padding: "7px 18px", fontSize: 12, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 14px rgba(255,107,0,0.35)", opacity: updateStatus.isPending ? 0.7 : 1 }}
                        >
                          Mark as {STATUS_LABELS[NEXT_STATUS[order.status]]}
                        </button>
                      )}
                      <button
                        onClick={() => handleCancelClick(order.id)}
                        disabled={updateStatus.isPending}
                        style={{
                          background: rejectState?.orderId === order.id ? "rgba(239,68,68,0.05)" : "rgba(239,68,68,0.1)",
                          color: "#f87171", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 20,
                          padding: "7px 18px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                        }}
                      >
                        <XCircle className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
                        {rejectState?.orderId === order.id ? "Never mind" : "Cancel Order"}
                      </button>
                    </div>

                    {/* Cancel confirm */}
                    {rejectState?.orderId === order.id && (
                      <div style={{ marginTop: 12, borderRadius: 14, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.05)", padding: "14px 16px" }} className="space-y-3">
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#f87171" }}>What's the reason?</p>
                        <div className="flex flex-wrap gap-2">
                          {["Out of chicken","Out of steak","Out of shrimp","Out of salmon","Out of burger"].map((opt) => (
                            <button key={opt} type="button"
                              onClick={() => setRejectState({ ...rejectState, reason: rejectState.reason === opt ? "" : opt })}
                              style={{
                                borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer",
                                background: rejectState.reason === opt ? "rgba(239,68,68,0.2)" : "transparent",
                                color: "#f87171", border: "1px solid rgba(239,68,68,0.3)",
                              }}
                            >{opt}</button>
                          ))}
                        </div>
                        <Textarea
                          placeholder="Other reason (optional)"
                          value={["Out of chicken","Out of steak","Out of shrimp","Out of salmon","Out of burger"].includes(rejectState.reason) ? "" : rejectState.reason}
                          onChange={(e) => setRejectState({ ...rejectState, reason: e.target.value })}
                          rows={1} className="text-sm resize-none bg-transparent border-white/10 text-[#e8eaf6] placeholder:text-[#7077a1]"
                        />
                        <button
                          onClick={() => handleStatusChange(order.id, "cancelled", rejectState?.reason || undefined)}
                          disabled={updateStatus.isPending}
                          style={{ background: "rgba(239,68,68,0.2)", color: "#f87171", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 20, padding: "7px 18px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
                        >
                          {updateStatus.isPending ? "Cancelling..." : "Confirm Cancellation"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Past orders ─────────────────────────────────────────────────── */}
          {pastOrders.length > 0 && (
            <section className="pb-6">
              <h2 style={{ fontSize: 18, fontWeight: 900, letterSpacing: "-0.04em", color: TP, marginBottom: 16 }}>Recent History</h2>
              <div style={{ background: CARD, border: `1px solid ${BORD}`, borderRadius: 22, overflow: "hidden" }}>
                <table className="w-full" style={{ fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${BORD}`, background: "rgba(255,255,255,0.03)" }}>
                      <th className="text-left p-3" style={{ fontWeight: 700, color: TM, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>Code</th>
                      <th className="text-left p-3" style={{ fontWeight: 700, color: TM, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>Customer</th>
                      <th className="text-left p-3 hidden md:table-cell" style={{ fontWeight: 700, color: TM, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>Items</th>
                      <th className="text-right p-3" style={{ fontWeight: 700, color: TM, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>Total</th>
                      <th className="text-left p-3 hidden sm:table-cell" style={{ fontWeight: 700, color: TM, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>Via / Paid</th>
                      <th className="text-left p-3" style={{ fontWeight: 700, color: TM, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pastOrders.slice(0, 20).map((order, idx) => (
                      <tr key={order.id} onClick={() => setHistoryOrder(order)} style={{ borderTop: `1px solid rgba(255,255,255,0.03)`, background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)", cursor: "pointer", transition: "background 0.12s" }} onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")} onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)")}>
                        <td className="p-3" style={{ fontFamily: "monospace", fontWeight: 900, color: "#30d158" }}>{order.confirmationCode}</td>
                        <td className="p-3">
                          <div style={{ fontWeight: 600, color: TP }}>{order.customerName}</div>
                          <div style={{ color: TM, fontSize: 11 }}>{new Date(order.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                        </td>
                        <td className="p-3 hidden md:table-cell" style={{ color: TM }}>
                          {order.items?.map((i) => <div key={i.id}>{i.quantity}× {i.menuItemName}{i.notes && <span style={{ fontStyle: "italic", fontSize: 11 }}> — {i.notes}</span>}</div>)}
                        </td>
                        <td className="p-3 text-right" style={{ fontWeight: 800, color: TP }}>${order.total.toFixed(2)}</td>
                        <td className="p-3 hidden sm:table-cell">
                          <div className="flex flex-col gap-1">
                            {(() => { const s = sourceBadge(order.source); return s ? <span style={{ ...s.style, fontSize: 10, fontWeight: 600, borderRadius: 8, padding: "2px 8px", display: "inline-block", width: "fit-content" }}>{s.label}</span> : null; })()}
                            {order.paymentMethod && (() => { const p = paymentBadge(order.source, order.paymentMethod); return <span style={{ ...p.style, fontSize: 10, fontWeight: 600, borderRadius: 8, padding: "2px 8px", display: "inline-block", width: "fit-content" }}>{p.label}</span>; })()}
                          </div>
                        </td>
                        <td className="p-3">
                          <span style={{ ...STATUS_STYLE[order.status], fontSize: 10, fontWeight: 800, borderRadius: 8, padding: "3px 9px", letterSpacing: "0.04em", display: "inline-block" }}>
                            {STATUS_LABELS[order.status]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>

    {/* ── Order detail modal ──────────────────────────────────────────────── */}
    {historyOrder && (() => {
      const o = historyOrder;
      const subtotal = (o.items ?? []).reduce((s, i) => s + i.menuItemPrice * i.quantity, 0);
      const discount = o.discountAmount ?? 0;
      const dt = new Date(o.createdAt);
      return (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 60, display: "flex", justifyContent: "flex-end" }}
          onClick={() => setHistoryOrder(null)}
        >
          <div
            style={{ width: "100%", maxWidth: 480, background: CARD, height: "100%", overflowY: "auto", display: "flex", flexDirection: "column", boxShadow: "-8px 0 48px rgba(0,0,0,0.6)" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: "20px 20px 16px", borderBottom: `1px solid ${BORD}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, position: "sticky", top: 0, background: CARD, zIndex: 1 }}>
              <div>
                <div style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 22, color: "#30d158", letterSpacing: "0.02em" }}>{o.confirmationCode}</div>
                <div style={{ fontSize: 12, color: TM, marginTop: 3 }}>
                  {dt.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} · {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  <span style={{ ...STATUS_STYLE[o.status], fontSize: 10, fontWeight: 800, borderRadius: 8, padding: "3px 9px", letterSpacing: "0.04em" }}>{STATUS_LABELS[o.status]}</span>
                  <span style={{ background: "rgba(255,255,255,0.06)", color: TM, fontSize: 10, fontWeight: 600, borderRadius: 8, padding: "3px 9px", textTransform: "capitalize" }}>{o.orderType}</span>
                  {(() => { const s = sourceBadge(o.source); return s ? <span style={{ ...s.style, fontSize: 10, fontWeight: 600, borderRadius: 8, padding: "3px 9px" }}>{s.label}</span> : null; })()}
                  {o.paymentMethod && (() => { const p = paymentBadge(o.source, o.paymentMethod); return <span style={{ ...p.style, fontSize: 10, fontWeight: 600, borderRadius: 8, padding: "3px 9px" }}>{p.label}</span>; })()}
                </div>
              </div>
              <button onClick={() => setHistoryOrder(null)} style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${BORD}`, borderRadius: 10, padding: "6px 10px", color: TM, cursor: "pointer", fontSize: 16, lineHeight: 1, flexShrink: 0 }}>✕</button>
            </div>

            <div style={{ padding: "20px 20px 32px", display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Customer */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: TM, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Customer</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: TP }}>{o.customerName || "Walk-in"}</div>
                {o.customerPhone && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                    <span style={{ fontSize: 13, color: TM }}>{o.customerPhone}</span>
                    <a href={`tel:${o.customerPhone}`} style={{ fontSize: 11, padding: "2px 10px", borderRadius: 20, background: "rgba(14,165,233,0.12)", color: "#0ea5e9", border: "1px solid rgba(14,165,233,0.25)", fontWeight: 600, textDecoration: "none" }}>📞 Call</a>
                  </div>
                )}
                {o.customerEmail && <div style={{ fontSize: 12, color: TM, marginTop: 4 }}>{o.customerEmail}</div>}
              </div>

              {/* Items */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: TM, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Items</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {(o.items ?? []).map((item) => (
                    <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                          <span style={{ fontWeight: 800, color: OR, fontSize: 13, flexShrink: 0 }}>{item.quantity}×</span>
                          <span style={{ fontWeight: 600, color: TP, fontSize: 14 }}>{item.menuItemName}</span>
                        </div>
                        {(item.modifierSelections ?? []).length > 0 && (
                          <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
                            {(item.modifierSelections ?? []).map((m, i) => (
                              <span key={i} style={{ fontSize: 11, color: TM, paddingLeft: 20 }}>+ {m.name}</span>
                            ))}
                          </div>
                        )}
                        {item.notes && <div style={{ fontSize: 11, color: TM, fontStyle: "italic", marginTop: 2, paddingLeft: 20 }}>{item.notes}</div>}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: TP, flexShrink: 0 }}>${(item.menuItemPrice * item.quantity).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div style={{ borderTop: `1px solid ${BORD}`, paddingTop: 16 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {discount > 0 && (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: TM }}>
                        <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#f87171" }}>
                        <span>Discount</span><span>−${discount.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 17, fontWeight: 900, color: TP }}>
                    <span>Total</span><span>${o.total.toFixed(2)}</span>
                  </div>
                  {o.amountTendered != null && o.amountTendered > 0 && (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: TM }}>
                        <span>Tendered</span><span>${o.amountTendered.toFixed(2)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#30d158" }}>
                        <span>Change</span><span>${(o.amountTendered - o.total).toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Payment */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: TM, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Payment</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {o.paymentMethod && (() => { const p = paymentBadge(o.source, o.paymentMethod); return <span style={{ ...p.style, fontSize: 12, fontWeight: 600, borderRadius: 8, padding: "4px 12px" }}>{p.label}</span>; })()}
                  <span style={{ fontSize: 12, fontWeight: 600, borderRadius: 8, padding: "4px 12px",
                    ...(o.paymentStatus === "paid"     ? { background: "rgba(48,209,88,0.1)",  color: "#30d158", border: "1px solid rgba(48,209,88,0.25)"  } :
                        o.paymentStatus === "refunded" ? { background: "rgba(239,68,68,0.1)",  color: "#f87171", border: "1px solid rgba(239,68,68,0.25)"  } :
                                                         { background: "rgba(255,107,0,0.1)", color: OR,        border: "1px solid rgba(255,107,0,0.25)"  }) }}>
                    {o.paymentStatus === "paid" ? "✓ Paid" : o.paymentStatus === "refunded" ? "Refunded" : "Pending"}
                  </span>
                </div>
              </div>

              {/* Notes */}
              {o.notes && (
                <div style={{ background: "rgba(255,107,0,0.08)", border: "1px solid rgba(255,107,0,0.2)", borderRadius: 12, padding: "10px 14px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: OR, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Order Note</div>
                  <div style={{ fontSize: 13, color: TP }}>{o.notes}</div>
                </div>
              )}

              {/* Cancellation reason */}
              {o.status === "cancelled" && o.cancellationReason && (
                <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "10px 14px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#f87171", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Cancellation Reason</div>
                  <div style={{ fontSize: 13, color: TP }}>{o.cancellationReason}</div>
                </div>
              )}

            </div>
          </div>
        </div>
      );
    })()}
  </>);
}

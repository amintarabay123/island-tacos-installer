import { useState, useEffect, useRef } from "react";
import { Bell, RefreshCw, X, ChevronRight, CheckCircle, AlertTriangle, Clock } from "lucide-react";

// ─── Palette (matches DarkDashboard) ─────────────────────────────────────────
const C = {
  bg:      "#0f1117",
  surface: "#1a1d27",
  card:    "#20232f",
  border:  "#2a2d3a",
  text:    "#e2e8f0",
  muted:   "#6b7280",
  accent:  "#ef4444",
  amber:   "#f59e0b",
  green:   "#22c55e",
  blue:    "#3b82f6",
  orange:  "#f97316",
};

// ─── Sample orders ────────────────────────────────────────────────────────────
type OrderItem = { id: number; name: string; qty: number; mods?: string[]; note?: string };
type Order = {
  id: number;
  code: string;
  customer: string;
  status: "confirmed" | "preparing" | "ready";
  createdMinsAgo: number;
  scheduled?: string;
  items: OrderItem[];
};

const SAMPLE_ORDERS: Order[] = [
  {
    id: 1,
    code: "IT8K3R",
    customer: "Maria Rivera",
    status: "confirmed",
    createdMinsAgo: 2,
    items: [
      { id: 1, name: "Tacos Chicken", qty: 2, mods: ["Extra salsa", "No lettuce"] },
      { id: 2, name: "Side Rice", qty: 1 },
      { id: 3, name: "Soda", qty: 2 },
    ],
  },
  {
    id: 2,
    code: "IT2P9X",
    customer: "Walk-in",
    status: "confirmed",
    createdMinsAgo: 14,
    items: [
      { id: 4, name: "Rice Bowl Salmon", qty: 1, mods: ["No cilantro"], note: "Allergy: dairy" },
      { id: 5, name: "Chips & Guac", qty: 1 },
    ],
  },
  {
    id: 3,
    code: "IT5A1Q",
    customer: "Carlos Ruiz",
    status: "confirmed",
    createdMinsAgo: 1,
    scheduled: "12:30 PM",
    items: [
      { id: 6, name: "Burrito Steak", qty: 1, mods: ["Extra beans", "Pico de gallo"] },
      { id: 7, name: "Burrito Chicken", qty: 1 },
    ],
  },
  {
    id: 4,
    code: "IT7M2B",
    customer: "Sofia Chen",
    status: "preparing",
    createdMinsAgo: 8,
    items: [
      { id: 8, name: "Island Burger", qty: 2, mods: ["Extra cheese"] },
      { id: 9, name: "Tacos Fish", qty: 1 },
      { id: 10, name: "Soda", qty: 2 },
    ],
  },
  {
    id: 5,
    code: "IT3N6F",
    customer: "Walk-in",
    status: "preparing",
    createdMinsAgo: 18,
    items: [
      { id: 11, name: "Quesadilla Chkn", qty: 1, mods: ["Double cheese"], note: "Make it crispy" },
      { id: 12, name: "Rice Bowl Chicken", qty: 1 },
    ],
  },
  {
    id: 6,
    code: "IT9V4L",
    customer: "David Malone",
    status: "ready",
    createdMinsAgo: 26,
    items: [
      { id: 13, name: "Tacos Steak", qty: 3, mods: ["Onions on side"] },
    ],
  },
  {
    id: 7,
    code: "IT1C7W",
    customer: "Aisha Brooks",
    status: "ready",
    createdMinsAgo: 72,
    items: [
      { id: 14, name: "Rice Bowl Steak", qty: 1 },
      { id: 15, name: "Chips & Guac", qty: 1 },
      { id: 16, name: "Water", qty: 1 },
    ],
  },
];

const OVERDUE_MIN = 10;
const UNCOLLECTED_MIN = 60;

const COL_CONFIG = [
  { key: "confirmed" as const,  label: "New Orders",  badge: C.blue,   accent: "#1e3a5f", btnLabel: "Start Cooking",  btnBg: "#1d4ed8", pulse: false },
  { key: "preparing" as const,  label: "Preparing",   badge: C.orange, accent: "#431407", btnLabel: "Mark Ready",     btnBg: "#c2410c", pulse: false },
  { key: "ready"     as const,  label: "Ready",       badge: C.green,  accent: "#14532d", btnLabel: "Done ✓ — Clear", btnBg: "#15803d", pulse: true  },
];

function elapsed(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function ElapsedBadge({ mins, status }: { mins: number; status: string }) {
  const overdue = status === "confirmed" && mins >= OVERDUE_MIN;
  const uncollected = status === "ready" && mins >= UNCOLLECTED_MIN;
  const warn = overdue || uncollected;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${warn ? "animate-pulse" : ""}`}
      style={{
        background: warn ? `${C.accent}33` : "#1f2937",
        color: warn ? C.accent : C.muted,
        border: `1px solid ${warn ? C.accent + "55" : C.border}`,
      }}
    >
      {warn ? <AlertTriangle className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
      {elapsed(mins)}
      {overdue && " OVERDUE"}
      {uncollected && " UNCOLLECTED"}
    </span>
  );
}

// ─── Order Card ───────────────────────────────────────────────────────────────
function OrderCard({
  order,
  col,
  struckItems,
  onStrike,
  onAdvance,
  onClear,
  advancing,
}: {
  order: Order;
  col: typeof COL_CONFIG[number];
  struckItems: Set<number>;
  onStrike: (itemId: number) => void;
  onAdvance: (id: number) => void;
  onClear: (id: number) => void;
  advancing: boolean;
}) {
  const isReady = order.status === "ready";
  const uncollected = isReady && order.createdMinsAgo >= UNCOLLECTED_MIN;

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: C.card,
        border: `1px solid ${uncollected ? C.accent : col.badge + "66"}`,
        boxShadow: uncollected
          ? `0 0 20px ${C.accent}33`
          : `0 0 12px ${col.badge}11`,
      }}
    >
      {/* Card header */}
      <div
        className="px-3 py-2.5 flex items-start justify-between gap-2"
        style={{ background: col.accent + "66", borderBottom: `1px solid ${C.border}` }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-sm font-mono" style={{ color: col.badge }}>
              #{order.code}
            </span>
            {order.scheduled && (
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: `${C.amber}22`, color: C.amber, border: `1px solid ${C.amber}44` }}
              >
                ⏰ {order.scheduled}
              </span>
            )}
          </div>
          <p className="text-xs font-semibold mt-0.5 truncate" style={{ color: C.text }}>
            {order.customer}
          </p>
        </div>
        <ElapsedBadge mins={order.createdMinsAgo} status={order.status} />
      </div>

      {/* Items */}
      <div className="px-3 py-2 flex-1 space-y-2">
        {order.items.map((item) => {
          const struck = struckItems.has(item.id);
          return (
            <button
              key={item.id}
              onClick={() => onStrike(item.id)}
              className="w-full text-left rounded-xl px-2.5 py-2 transition-all active:scale-[0.98]"
              style={{
                background: struck ? "#14532d33" : C.surface,
                border: `1px solid ${struck ? "#16a34a44" : C.border}`,
                opacity: struck ? 0.6 : 1,
              }}
            >
              <div className="flex items-baseline gap-2">
                <span
                  className="text-xs font-black flex-shrink-0"
                  style={{ color: struck ? C.green : col.badge }}
                >
                  {item.qty}×
                </span>
                <span
                  className="text-xs font-semibold flex-1 min-w-0"
                  style={{
                    color: struck ? C.muted : C.text,
                    textDecoration: struck ? "line-through" : "none",
                  }}
                >
                  {item.name}
                </span>
                {struck && (
                  <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.green }} />
                )}
              </div>
              {item.mods && item.mods.length > 0 && !struck && (
                <div className="mt-0.5 space-y-0.5 ml-5">
                  {item.mods.map((m, i) => (
                    <p key={i} className="text-[10px]" style={{ color: C.muted }}>
                      + {m}
                    </p>
                  ))}
                </div>
              )}
              {item.note && !struck && (
                <p className="text-[10px] italic mt-0.5 ml-5" style={{ color: C.amber }}>
                  ⚠ {item.note}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="px-3 pb-3 pt-1 flex gap-2">
        {!isReady && (
          <button
            disabled={advancing}
            onClick={() => onAdvance(order.id)}
            className="flex-1 h-10 rounded-xl text-xs font-black transition-all active:scale-95 disabled:opacity-50"
            style={{ background: col.btnBg, color: "white" }}
          >
            {advancing ? "…" : col.btnLabel}
          </button>
        )}
        {isReady && (
          <>
            <button
              disabled={advancing}
              onClick={() => onClear(order.id)}
              className="flex-1 h-10 rounded-xl text-xs font-black transition-all active:scale-95 disabled:opacity-50"
              style={{ background: col.btnBg, color: "white" }}
            >
              {advancing ? "…" : "Done ✓ — Clear"}
            </button>
            <button
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95"
              style={{ background: "#1f2937", color: C.muted, border: `1px solid ${C.border}` }}
              title="Recall / options"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function KDS() {
  const [orders, setOrders] = useState<Order[]>(SAMPLE_ORDERS);
  const [struckItems, setStruckItems] = useState<Map<number, Set<number>>>(new Map());
  const [advancing, setAdvancing] = useState<Set<number>>(new Set());
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [mobileTab, setMobileTab] = useState<"confirmed" | "preparing" | "ready">("confirmed");
  const [now, setNow] = useState(Date.now());
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const toggleStruck = (orderId: number, itemId: number) => {
    setStruckItems(prev => {
      const next = new Map(prev);
      const set = new Set(next.get(orderId) ?? []);
      set.has(itemId) ? set.delete(itemId) : set.add(itemId);
      next.set(orderId, set);
      return next;
    });
  };

  const unlockAudio = () => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      osc.start(); osc.stop(ctx.currentTime + 0.05);
      ctx.resume();
      setAudioUnlocked(true);
    } catch {}
  };

  const NEXT: Record<string, "preparing" | "ready"> = { confirmed: "preparing", preparing: "ready" };

  const advanceOrder = (id: number) => {
    setAdvancing(s => new Set(s).add(id));
    setTimeout(() => {
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: NEXT[o.status] ?? o.status } : o));
      setAdvancing(s => { const n = new Set(s); n.delete(id); return n; });
    }, 400);
  };

  const clearOrder = (id: number) => {
    setAdvancing(s => new Set(s).add(id));
    setTimeout(() => {
      setOrders(prev => prev.filter(o => o.id !== id));
      setAdvancing(s => { const n = new Set(s); n.delete(id); return n; });
    }, 400);
  };

  const byCol = {
    confirmed: orders.filter(o => o.status === "confirmed"),
    preparing:  orders.filter(o => o.status === "preparing"),
    ready:     orders.filter(o => o.status === "ready"),
  };

  const totalActive = orders.length;
  const hasUncollected = byCol.ready.some(o => o.createdMinsAgo >= UNCOLLECTED_MIN);

  return (
    <div
      className="w-full h-screen flex flex-col overflow-hidden select-none"
      style={{ background: C.bg, fontFamily: "'Inter',sans-serif" }}
    >
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between px-4 h-14 flex-shrink-0 border-b gap-3"
        style={{ background: C.surface, borderColor: C.border }}
      >
        {/* Logo + title */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0"
            style={{ background: C.accent }}
          >
            🍳
          </div>
          <div className="hidden sm:block min-w-0">
            <p className="text-sm font-black leading-none" style={{ color: C.text }}>Island Tacos</p>
            <p className="text-[10px] font-semibold" style={{ color: C.muted }}>Kitchen Display</p>
          </div>
        </div>

        {/* Column counts — desktop */}
        <div className="hidden sm:flex items-center gap-3">
          {COL_CONFIG.map(col => (
            <div key={col.key} className="flex items-center gap-1.5 px-3 py-1 rounded-lg" style={{ background: C.card, border: `1px solid ${C.border}` }}>
              <span className="w-2 h-2 rounded-full" style={{ background: col.badge }} />
              <span className="text-xs font-semibold" style={{ color: C.muted }}>{col.label}</span>
              <span
                className="text-xs font-black px-1.5 py-0.5 rounded-full ml-1"
                style={{ background: col.badge + "33", color: col.badge }}
              >
                {byCol[col.key].length}
              </span>
            </div>
          ))}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Live indicator */}
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium" style={{ color: "#22c55e" }}>Live</span>
          </div>

          {/* Uncollected alert */}
          {hasUncollected && (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold animate-pulse"
              style={{ background: `${C.accent}22`, color: C.accent, border: `1px solid ${C.accent}44` }}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Uncollected!</span>
            </div>
          )}

          {/* Notification / audio unlock */}
          {!audioUnlocked ? (
            <button
              onClick={unlockAudio}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold animate-pulse transition-colors"
              style={{ background: `${C.green}22`, color: C.green, border: `1px solid ${C.green}44` }}
            >
              <Bell className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Enable Alerts</span>
            </button>
          ) : (
            <span className="hidden sm:flex items-center gap-1 text-xs font-medium" style={{ color: C.green }}>
              <Bell className="w-3.5 h-3.5" /> Alerts On
            </span>
          )}

          {/* Refresh */}
          <button
            className="p-2 rounded-lg transition-colors"
            style={{ background: C.card, color: C.muted, border: `1px solid ${C.border}` }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* ── MOBILE TAB BAR ────────────────────────────────────────────────── */}
      <div
        className="flex sm:hidden border-b flex-shrink-0"
        style={{ background: C.surface, borderColor: C.border }}
      >
        {COL_CONFIG.map(col => (
          <button
            key={col.key}
            onClick={() => setMobileTab(col.key)}
            className="flex-1 py-2.5 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
            style={{
              color: mobileTab === col.key ? col.badge : C.muted,
              borderBottom: mobileTab === col.key ? `2px solid ${col.badge}` : "2px solid transparent",
            }}
          >
            {col.label}
            <span
              className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
              style={{ background: col.badge + "33", color: col.badge }}
            >
              {byCol[col.key].length}
            </span>
          </button>
        ))}
      </div>

      {/* ── COLUMNS ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex gap-0">

        {/* Desktop: all 3 columns */}
        {COL_CONFIG.map((col, ci) => (
          <div
            key={col.key}
            className={`flex-1 flex flex-col min-w-0 overflow-hidden ${ci > 0 ? "border-l" : ""}`}
            style={{ borderColor: C.border }}
          >
            {/* Column header */}
            <div
              className="hidden sm:flex items-center justify-between px-4 py-3 flex-shrink-0 border-b"
              style={{ background: C.surface, borderColor: C.border }}
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: col.badge }} />
                <span className="text-xs font-black uppercase tracking-wider" style={{ color: C.text }}>
                  {col.label}
                </span>
              </div>
              <span
                className="text-xs font-black px-2 py-1 rounded-full"
                style={{ background: col.badge + "33", color: col.badge }}
              >
                {byCol[col.key].length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {byCol[col.key].length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 opacity-40">
                  <span className="text-3xl mb-2">✓</span>
                  <span className="text-xs font-semibold" style={{ color: C.muted }}>All clear</span>
                </div>
              ) : (
                byCol[col.key].map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    col={col}
                    struckItems={struckItems.get(order.id) ?? new Set()}
                    onStrike={itemId => toggleStruck(order.id, itemId)}
                    onAdvance={advanceOrder}
                    onClear={clearOrder}
                    advancing={advancing.has(order.id)}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── MOBILE SINGLE COLUMN VIEW ─────────────────────────────────────── */}
      <style>{`
        @media (max-width: 639px) {
          .kds-desktop-cols { display: none !important; }
        }
        @media (min-width: 640px) {
          .kds-mobile-col { display: none !important; }
        }
      `}</style>
    </div>
  );
}

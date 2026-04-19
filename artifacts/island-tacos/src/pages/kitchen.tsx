import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { adminRoutes } from "@/lib/admin-path";

type OrderItem = {
  id: number;
  menuItemName: string;
  quantity: number;
  notes?: string | null;
  subtotal: number;
};

type Order = {
  id: number;
  confirmationCode: string;
  customerName: string;
  orderType: string;
  status: string;
  notes?: string | null;
  total: number;
  createdAt: string;
  items: OrderItem[];
};

const STATUS_ORDER = ["pending", "confirmed", "preparing", "ready"];
const ACTIVE_STATUSES = new Set(["pending", "confirmed", "preparing"]);
const OVERDUE_MS = 10 * 60 * 1000; // 10 minutes

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function elapsed(createdAt: string, now: number): string {
  const diff = Math.floor((now - new Date(createdAt).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function isOverdue(createdAt: string, now: number): boolean {
  return now - new Date(createdAt).getTime() > OVERDUE_MS;
}

function nextStatus(status: string): string | null {
  const idx = STATUS_ORDER.indexOf(status);
  return idx >= 0 && idx < STATUS_ORDER.length - 1 ? STATUS_ORDER[idx + 1] : null;
}

function nextLabel(status: string): string {
  return (
    { pending: "Accept Order", confirmed: "Start Cooking", preparing: "Mark Ready" }[status] ?? "Advance"
  );
}

const COL_CONFIG = [
  {
    key: "pending" as const,
    label: "New",
    badge: "bg-yellow-400 text-yellow-950",
    border: "border-yellow-500",
    bg: "bg-yellow-950/40",
    btn: "bg-yellow-400 hover:bg-yellow-300 text-yellow-950 active:bg-yellow-200",
  },
  {
    key: "confirmed" as const,
    label: "Confirmed",
    badge: "bg-blue-400 text-blue-950",
    border: "border-blue-500",
    bg: "bg-blue-950/40",
    btn: "bg-blue-400 hover:bg-blue-300 text-blue-950 active:bg-blue-200",
  },
  {
    key: "preparing" as const,
    label: "Preparing",
    badge: "bg-orange-400 text-orange-950",
    border: "border-orange-500",
    bg: "bg-orange-950/40",
    btn: "bg-green-400 hover:bg-green-300 text-green-950 active:bg-green-200",
  },
];

type RejectState = { orderId: number; reason: string } | null;

export default function Kitchen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [advancing, setAdvancing] = useState<Set<number>>(new Set());
  const [rejecting, setRejecting] = useState<Set<number>>(new Set());
  const [rejectState, setRejectState] = useState<RejectState>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prevIdsRef = useRef<Set<number>>(new Set());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const now = useNow();
  const [, navigate] = useLocation();

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    navigate(adminRoutes.login);
  };

  const playChime = useCallback(() => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      const notes = [
        { freq: 523.25, t: 0 },
        { freq: 659.25, t: 0.15 },
        { freq: 783.99, t: 0.30 },
        { freq: 1046.5, t: 0.45 },
      ];
      notes.forEach(({ freq, t }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, ctx.currentTime + t);
        gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.65);
        osc.start(ctx.currentTime + t);
        osc.stop(ctx.currentTime + t + 0.7);
      });
    } catch {}
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders");
      if (!res.ok) throw new Error("Failed to fetch");
      const data: Order[] = await res.json();
      const active = data.filter((o) => ACTIVE_STATUSES.has(o.status));
      const newIds = new Set(active.map((o) => o.id));
      if (active.some((o) => !prevIdsRef.current.has(o.id)) && prevIdsRef.current.size > 0) {
        playChime();
      }
      prevIdsRef.current = newIds;
      setOrders(active);
      setLastFetch(new Date());
      setError(null);
    } catch {
      setError("Connection lost — retrying…");
    }
  }, [playChime]);

  useEffect(() => {
    fetchOrders();
    const id = setInterval(fetchOrders, 10_000);
    return () => clearInterval(id);
  }, [fetchOrders]);

  const advance = async (order: Order) => {
    const next = nextStatus(order.status);
    if (!next) return;
    setAdvancing((s) => new Set(s).add(order.id));
    try {
      await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      await fetchOrders();
    } finally {
      setAdvancing((s) => {
        const ns = new Set(s);
        ns.delete(order.id);
        return ns;
      });
    }
  };

  const rejectOrder = async (orderId: number, reason: string) => {
    setRejecting((s) => new Set(s).add(orderId));
    try {
      await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled", cancellationReason: reason || null }),
      });
      setRejectState(null);
      await fetchOrders();
    } finally {
      setRejecting((s) => {
        const ns = new Set(s);
        ns.delete(orderId);
        return ns;
      });
    }
  };

  const byStatus: Record<string, Order[]> = { pending: [], confirmed: [], preparing: [] };
  for (const o of orders) {
    if (byStatus[o.status]) byStatus[o.status].push(o);
  }
  const hasOrders = orders.length > 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col select-none overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold">Island Tacos</span>
          <span className="text-zinc-500 text-sm">· Kitchen Display</span>
        </div>
        <div className="flex items-center gap-4">
          {error ? (
            <span className="text-red-400 text-sm font-medium">{error}</span>
          ) : lastFetch ? (
            <span className="text-zinc-600 text-xs">Refreshes every 10s · {lastFetch.toLocaleTimeString()}</span>
          ) : null}
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${error ? "bg-red-500" : "bg-green-400 animate-pulse"}`} />
            <span className={`text-xs font-medium ${error ? "text-red-400" : "text-green-400"}`}>
              {error ? "Offline" : "Live"}
            </span>
          </div>
          <button
            onClick={logout}
            className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors px-2 py-1 rounded"
          >
            Sign out
          </button>
        </div>
      </header>

      {hasOrders ? (
        <>
          {/* Column labels */}
          <div className="grid grid-cols-3 gap-3 px-4 pt-4 pb-2 shrink-0">
            {COL_CONFIG.map(({ key, label, badge }) => (
              <div key={key} className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${badge}`}>
                  {label}
                </span>
                <span className="text-zinc-500 text-sm">
                  {byStatus[key].length} {byStatus[key].length === 1 ? "order" : "orders"}
                </span>
              </div>
            ))}
          </div>

          {/* Order cards */}
          <div className="grid grid-cols-3 gap-3 px-4 pb-4 flex-1 overflow-y-auto items-start">
            {COL_CONFIG.map(({ key, border, bg, btn }) => (
              <div key={key} className="flex flex-col gap-3">
                {byStatus[key].length === 0 && (
                  <div className="border border-dashed border-zinc-800 rounded-xl flex items-center justify-center h-28">
                    <span className="text-zinc-700 text-sm">No orders</span>
                  </div>
                )}
                {byStatus[key].map((order) => {
                  const overdue = isOverdue(order.createdAt, now);
                  const age = elapsed(order.createdAt, now);
                  const isAdvancing = advancing.has(order.id);
                  const next = nextStatus(order.status);
                  return (
                    <div
                      key={order.id}
                      className={`rounded-xl border-2 ${overdue ? "border-red-500 bg-red-950/50 animate-pulse" : `${border} ${bg}`} p-4 flex flex-col gap-3 transition-colors`}
                    >
                      {/* Order header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-2xl font-black tracking-tight leading-none">
                            {order.confirmationCode}
                          </div>
                          <div className="text-zinc-200 font-semibold text-sm mt-1">{order.customerName}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`text-sm font-bold tabular-nums ${overdue ? "text-red-400" : "text-zinc-400"}`}>
                            {age}
                          </div>
                          <div className="text-xs text-zinc-500 mt-0.5 capitalize">{order.orderType}</div>
                        </div>
                      </div>

                      {/* Items */}
                      <div className="flex flex-col gap-1.5">
                        {order.items.map((item) => (
                          <div key={item.id} className="bg-black/40 rounded-lg px-3 py-2.5">
                            <div className="flex items-baseline gap-2">
                              <span className="text-xl font-black text-white leading-none">{item.quantity}×</span>
                              <span className="text-base font-semibold text-white leading-snug">{item.menuItemName}</span>
                            </div>
                            {item.notes && (
                              <div className="text-yellow-300 text-sm mt-1.5 leading-snug whitespace-pre-line font-medium">
                                {item.notes}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Order-level notes */}
                      {order.notes && (
                        <div className="bg-yellow-900/50 border border-yellow-700/40 rounded-lg px-3 py-2 text-yellow-200 text-sm leading-snug">
                          {order.notes}
                        </div>
                      )}

                      {/* Advance button */}
                      {next && (
                        <button
                          onClick={() => advance(order)}
                          disabled={isAdvancing}
                          className={`w-full rounded-lg py-3 text-sm font-bold transition-all active:scale-95 ${btn} disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                          {isAdvancing ? "Updating…" : nextLabel(order.status)}
                        </button>
                      )}

                      {/* Reject */}
                      {rejectState?.orderId === order.id ? (
                        <div className="rounded-lg border border-red-500/40 bg-red-950/40 p-3 space-y-2">
                          <p className="text-red-300 text-xs font-semibold uppercase tracking-wide">Reject order?</p>
                          <textarea
                            placeholder="Reason (optional)"
                            value={rejectState.reason}
                            onChange={(e) => setRejectState({ ...rejectState, reason: e.target.value })}
                            rows={2}
                            className="w-full bg-black/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 resize-none focus:outline-none focus:border-red-500"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => rejectOrder(order.id, rejectState.reason)}
                              disabled={rejecting.has(order.id)}
                              className="flex-1 rounded-lg py-2 text-sm font-bold bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-40"
                            >
                              {rejecting.has(order.id) ? "Rejecting…" : "Confirm Reject"}
                            </button>
                            <button
                              onClick={() => setRejectState(null)}
                              className="px-4 rounded-lg py-2 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                            >
                              Back
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setRejectState({ orderId: order.id, reason: "" })}
                          disabled={isAdvancing || rejecting.has(order.id)}
                          className="w-full rounded-lg py-2 text-xs font-semibold border border-red-800/60 text-red-400 hover:bg-red-950/50 hover:border-red-600 transition-colors disabled:opacity-30"
                        >
                          Reject Order
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      ) : (
        /* All-clear state */
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="text-6xl font-black text-zinc-800 tracking-tight">All Clear</div>
          <div className="text-zinc-600 text-base">No active orders · refreshing every 10s</div>
        </div>
      )}
    </div>
  );
}

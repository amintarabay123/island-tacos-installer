import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { adminRoutes } from "@/lib/admin-path";

type OrderItem = {
  id: number;
  menuItemName: string;
  quantity: number;
  notes?: string | null;
  subtotal: number;
  modifierSelections?: { name: string; price: number }[] | null;
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

const ACTIVE_STATUSES = new Set(["pending", "confirmed", "preparing", "ready"]);
const OVERDUE_MS = 10 * 60 * 1000;

const NEXT_STATUS: Record<string, string> = {
  pending: "confirmed",
  confirmed: "preparing",
  preparing: "ready",
  ready: "completed",
};

const NEXT_LABEL: Record<string, string> = {
  pending: "Accept Order",
  confirmed: "Start Cooking",
  preparing: "Mark Ready",
  ready: "Done — Handed Off",
};

const STATUS_CARD: Record<string, { border: string; bg: string }> = {
  pending: { border: "border-yellow-500", bg: "bg-yellow-950/40" },
  confirmed: { border: "border-blue-500", bg: "bg-blue-950/40" },
  preparing: { border: "border-orange-500", bg: "bg-orange-950/40" },
  ready: { border: "border-green-500", bg: "bg-green-950/40" },
};

const STATUS_BTN: Record<string, string> = {
  pending: "bg-yellow-400 hover:bg-yellow-300 text-yellow-950 active:bg-yellow-200",
  confirmed: "bg-blue-400 hover:bg-blue-300 text-blue-950 active:bg-blue-200",
  preparing: "bg-green-400 hover:bg-green-300 text-green-950 active:bg-green-200",
  ready: "bg-white hover:bg-zinc-100 text-zinc-950 active:bg-zinc-200",
};

const REJECTION_OPTIONS = [
  "Out of chicken",
  "Out of steak",
  "Out of shrimp",
  "Out of salmon",
  "Out of burger",
];

const COL_CONFIG = [
  {
    key: "new" as const,
    statuses: ["pending", "confirmed"],
    label: "New Orders",
    badge: "bg-yellow-400 text-yellow-950",
    showReject: true,
  },
  {
    key: "preparing" as const,
    statuses: ["preparing"],
    label: "Preparing",
    badge: "bg-orange-400 text-orange-950",
    showReject: false,
  },
  {
    key: "ready" as const,
    statuses: ["ready"],
    label: "Ready",
    badge: "bg-green-400 text-green-950",
    showReject: false,
  },
];

type RejectState = { orderId: number; reason: string } | null;

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

export default function Kitchen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [advancing, setAdvancing] = useState<Set<number>>(new Set());
  const [rejecting, setRejecting] = useState<Set<number>>(new Set());
  const [rejectState, setRejectState] = useState<RejectState>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const prevIdsRef = useRef<Set<number>>(new Set());
  const isFirstFetchRef = useRef(true);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const chimeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const now = useNow();
  const [, navigate] = useLocation();

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    navigate(adminRoutes.login);
  };

  // Must be called from a user-gesture to unlock the AudioContext
  const unlockAudio = useCallback(() => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      audioCtxRef.current.resume().then(() => setAudioUnlocked(true));
    } catch {}
  }, []);

  const playChime = useCallback(() => {
    try {
      if (!audioCtxRef.current) return; // not unlocked yet
      const ctx = audioCtxRef.current;
      ctx.resume(); // ensure not suspended
      const notes = [
        { freq: 523.25, t: 0 },
        { freq: 659.25, t: 0.15 },
        { freq: 783.99, t: 0.30 },
        { freq: 1046.5, t: 0.45 },
        { freq: 783.99, t: 0.65 },
        { freq: 1046.5, t: 0.80 },
      ];
      notes.forEach(({ freq, t }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, ctx.currentTime + t);
        gain.gain.linearRampToValueAtTime(0.9, ctx.currentTime + t + 0.04);
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

      if (isFirstFetchRef.current) {
        // Snapshot existing IDs on load — don't chime for already-present orders
        isFirstFetchRef.current = false;
        prevIdsRef.current = new Set(active.map((o) => o.id));
      } else {
        const newPending = active.filter((o) => o.status === "pending");
        if (newPending.some((o) => !prevIdsRef.current.has(o.id))) {
          playChime();
        }
        prevIdsRef.current = new Set(active.map((o) => o.id));
      }

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

  // Repeat chime every 4s while there are unactioned pending orders
  useEffect(() => {
    const hasPending = orders.some((o) => o.status === "pending");
    if (hasPending && audioUnlocked) {
      if (!chimeIntervalRef.current) {
        chimeIntervalRef.current = setInterval(playChime, 4_000);
      }
    } else {
      if (chimeIntervalRef.current) {
        clearInterval(chimeIntervalRef.current);
        chimeIntervalRef.current = null;
      }
    }
    return () => {
      if (chimeIntervalRef.current) {
        clearInterval(chimeIntervalRef.current);
        chimeIntervalRef.current = null;
      }
    };
  }, [orders, audioUnlocked, playChime]);

  const broadcastUpdate = () => {
    try {
      const bc = new BroadcastChannel("island_tacos_kds");
      bc.postMessage({ type: "kds:order-updated" });
      bc.close();
    } catch {}
    window.dispatchEvent(new CustomEvent("kds:order-updated"));
  };

  const advance = async (order: Order) => {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    setAdvancing((s) => new Set(s).add(order.id));
    try {
      await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      broadcastUpdate();
      await fetchOrders();
    } finally {
      setAdvancing((s) => { const ns = new Set(s); ns.delete(order.id); return ns; });
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
      broadcastUpdate();
      setRejectState(null);
      await fetchOrders();
    } finally {
      setRejecting((s) => { const ns = new Set(s); ns.delete(orderId); return ns; });
    }
  };

  const byCol: Record<string, Order[]> = { new: [], preparing: [], ready: [] };
  for (const o of orders) {
    if (o.status === "pending" || o.status === "confirmed") byCol.new.push(o);
    else if (o.status === "preparing") byCol.preparing.push(o);
    else if (o.status === "ready") byCol.ready.push(o);
  }

  const hasOrders = orders.length > 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col select-none overflow-hidden">
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
          {!audioUnlocked ? (
            <button
              onClick={unlockAudio}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-amber-950 text-xs font-bold transition-colors animate-pulse"
            >
              🔔 Tap to enable sound
            </button>
          ) : (
            <span className="text-zinc-600 text-xs">🔔 Sound on</span>
          )}
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
          <div className="grid grid-cols-3 gap-3 px-4 pt-4 pb-2 shrink-0">
            {COL_CONFIG.map(({ key, label, badge }) => (
              <div key={key} className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${badge}`}>
                  {label}
                </span>
                <span className="text-zinc-500 text-sm">
                  {byCol[key].length} {byCol[key].length === 1 ? "order" : "orders"}
                </span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3 px-4 pb-4 flex-1 overflow-y-auto items-start">
            {COL_CONFIG.map(({ key, showReject }) => (
              <div key={key} className="flex flex-col gap-3">
                {byCol[key].length === 0 && (
                  <div className="border border-dashed border-zinc-800 rounded-xl flex items-center justify-center h-28">
                    <span className="text-zinc-700 text-sm">No orders</span>
                  </div>
                )}
                {byCol[key].map((order) => {
                  const overdue = isOverdue(order.createdAt, now);
                  const age = elapsed(order.createdAt, now);
                  const isAdvancing = advancing.has(order.id);
                  const isRejecting = rejecting.has(order.id);
                  const next = NEXT_STATUS[order.status];
                  const { border, bg } = STATUS_CARD[order.status] ?? STATUS_CARD.pending;
                  const btnClass = STATUS_BTN[order.status];
                  const isRejectOpen = rejectState?.orderId === order.id;

                  return (
                    <div
                      key={order.id}
                      className={`rounded-xl border-2 ${overdue ? "border-red-500 bg-red-950/50 animate-pulse" : `${border} ${bg}`} p-4 flex flex-col gap-3 transition-colors`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-2xl font-black tracking-tight leading-none">
                            {order.confirmationCode}
                          </div>
                          <div className="text-zinc-200 font-semibold text-sm mt-1">{order.customerName}</div>
                          {order.status === "confirmed" && (
                            <div className="text-blue-300 text-xs font-semibold mt-0.5 uppercase tracking-wide">Accepted</div>
                          )}
                          {order.status === "ready" && (
                            <div className="text-green-300 text-xs font-semibold mt-0.5 uppercase tracking-wide">Ready for pickup</div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`text-sm font-bold tabular-nums ${overdue ? "text-red-400" : "text-zinc-400"}`}>
                            {age}
                          </div>
                          <div className="text-xs text-zinc-500 mt-0.5 capitalize">{order.orderType}</div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        {order.items.map((item) => (
                          <div key={item.id} className="bg-black/40 rounded-lg px-3 py-2.5">
                            <div className="flex items-baseline gap-2">
                              <span className="text-xl font-black text-white leading-none">{item.quantity}×</span>
                              <span className="text-base font-semibold text-white leading-snug">{item.menuItemName}</span>
                            </div>
                            {(item.modifierSelections ?? []).length > 0 ? (
                              <div className="text-yellow-300 text-sm mt-1.5 leading-snug font-medium space-y-0.5">
                                {(item.modifierSelections ?? []).map((m, i) => (
                                  <div key={i}>+ {m.name}</div>
                                ))}
                              </div>
                            ) : item.notes ? (
                              <div className="text-yellow-300 text-sm mt-1.5 leading-snug whitespace-pre-line font-medium">
                                {item.notes}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>

                      {order.notes && (
                        <div className="bg-yellow-900/50 border border-yellow-700/40 rounded-lg px-3 py-2 text-yellow-200 text-sm leading-snug">
                          {order.notes}
                        </div>
                      )}

                      {next && !isRejectOpen && (
                        <button
                          onClick={() => advance(order)}
                          disabled={isAdvancing}
                          className={`w-full rounded-lg py-3 text-sm font-bold transition-all active:scale-95 ${btnClass} disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                          {isAdvancing ? "Updating…" : NEXT_LABEL[order.status]}
                        </button>
                      )}

                      {showReject && (
                        isRejectOpen ? (
                          <div className="rounded-lg border border-red-500/40 bg-red-950/40 p-3 space-y-2">
                            <p className="text-red-300 text-xs font-semibold uppercase tracking-wide">Why are you rejecting?</p>
                            <div className="flex flex-wrap gap-1.5">
                              {REJECTION_OPTIONS.map((opt) => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => setRejectState({ ...rejectState!, reason: rejectState!.reason === opt ? "" : opt })}
                                  className={`rounded-full px-2.5 py-1 text-xs font-semibold border transition-colors ${
                                    rejectState?.reason === opt
                                      ? "bg-red-500 text-white border-red-400"
                                      : "border-red-700/60 text-red-300 hover:bg-red-900/50"
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                            <input
                              type="text"
                              placeholder="Other reason (optional)"
                              value={REJECTION_OPTIONS.includes(rejectState?.reason ?? "") ? "" : (rejectState?.reason ?? "")}
                              onChange={(e) => setRejectState({ ...rejectState!, reason: e.target.value })}
                              className="w-full bg-black/50 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => rejectOrder(order.id, rejectState?.reason ?? "")}
                                disabled={isRejecting}
                                className="flex-1 rounded-lg py-2 text-sm font-bold bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-40"
                              >
                                {isRejecting ? "Rejecting…" : "Confirm Reject"}
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
                            disabled={isAdvancing || isRejecting}
                            className="w-full rounded-lg py-2 text-xs font-semibold border border-red-800/60 text-red-400 hover:bg-red-950/50 hover:border-red-600 transition-colors disabled:opacity-30"
                          >
                            Reject Order
                          </button>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="text-6xl font-black text-zinc-800 tracking-tight">All Clear</div>
          <div className="text-zinc-600 text-base">No active orders · refreshing every 10s</div>
        </div>
      )}
    </div>
  );
}

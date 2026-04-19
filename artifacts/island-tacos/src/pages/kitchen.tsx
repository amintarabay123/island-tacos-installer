import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { adminRoutes } from "@/lib/admin-path";
import { authHeaders, clearAuthToken } from "@/lib/auth";
import { setPageMeta } from "@/lib/page-meta";

type OrderItem = {
  id: number;
  menuItemId?: number | null;
  menuItemName: string;
  quantity: number;
  notes?: string | null;
  subtotal: number;
  modifierSelections?: { name: string; price: number }[] | null;
};

type KitchenCategory = { id: number; name: string; sendToKds: boolean };
type KitchenMenuItem = { id: number; categoryId: number };

type Order = {
  id: number;
  confirmationCode: string;
  customerName: string;
  customerPhone?: string | null;
  orderType: string;
  status: string;
  notes?: string | null;
  total: number;
  createdAt: string;
  items: OrderItem[];
};

const ACTIVE_STATUSES = new Set(["confirmed", "preparing", "ready"]);
const OVERDUE_MS = 10 * 60 * 1000;
const UNCOLLECTED_MS = 60 * 60 * 1000; // 1 hour in "ready" state = uncollected alert
const UNCOLLECTED_RECHIME_MS = 15 * 60 * 1000; // re-chime every 15 min

const NEXT_STATUS: Record<string, string> = {
  confirmed: "preparing",
  preparing: "ready",
  ready: "completed",
};

const NEXT_LABEL: Record<string, string> = {
  confirmed: "Start Cooking",
  preparing: "Mark Ready",
  ready: "Done — Handed Off",
};

const STATUS_CARD: Record<string, { border: string; bg: string }> = {
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

const COL_CONFIG = [
  {
    key: "new" as const,
    statuses: ["confirmed"],
    label: "New Orders",
    badge: "bg-blue-400 text-blue-950",
  },
  {
    key: "preparing" as const,
    statuses: ["preparing"],
    label: "Preparing",
    badge: "bg-orange-400 text-orange-950",
  },
  {
    key: "ready" as const,
    statuses: ["ready"],
    label: "Ready",
    badge: "bg-green-400 text-green-950",
  },
];

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
  useEffect(() => { setPageMeta("🍳 Kitchen — Island Tacos", "🍳", "/manifest-kds.json"); }, []);

  const [orders, setOrders] = useState<Order[]>([]);
  const [advancing, setAdvancing] = useState<Set<number>>(new Set());
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );
  const prevIdsRef = useRef<Set<number>>(new Set());
  const isFirstFetchRef = useRef(true);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const chimeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const now = useNow();
  const [, navigate] = useLocation();

  // KDS category filtering
  const [kdsCategories, setKdsCategories] = useState<KitchenCategory[]>([]);
  const [menuItemCategoryMap, setMenuItemCategoryMap] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    // Fetch categories to know which have sendToKds = false
    fetch("/api/menu/categories", { headers: authHeaders() })
      .then(r => r.json())
      .then((cats: KitchenCategory[]) => setKdsCategories(cats))
      .catch(() => {});
    // Fetch menu items to build menuItemId -> categoryId map
    fetch("/api/menu/items", { headers: authHeaders() })
      .then(r => r.json())
      .then((menuItems: KitchenMenuItem[]) => {
        const map = new Map<number, number>();
        for (const mi of menuItems) map.set(mi.id, mi.categoryId);
        setMenuItemCategoryMap(map);
      })
      .catch(() => {});
  }, []);

  // Returns true if an item should appear on the KDS (based on its category's sendToKds flag)
  const isKdsItem = (item: OrderItem): boolean => {
    if (!item.menuItemId) return true; // unknown item — show it to be safe
    const categoryId = menuItemCategoryMap.get(item.menuItemId);
    if (categoryId === undefined) return true; // no category info — show it
    const cat = kdsCategories.find(c => c.id === categoryId);
    return cat ? cat.sendToKds : true; // default to showing
  };

  // Uncollected order tracking: orderId → timestamp when we first saw it as "ready"
  const readyTimestampsRef = useRef<Map<number, number>>(new Map());
  // Tracks when we last chimed for each uncollected order (so we don't spam)
  const lastUncollectedChimeRef = useRef<Map<number, number>>(new Map());
  // Dismissed orders: orderId → timestamp after which alerts resume
  const [dismissedUntil, setDismissedUntil] = useState<Map<number, number>>(new Map());

  const logout = async () => {
    clearAuthToken();
    await fetch("/api/auth/logout", { method: "POST", credentials: "include", headers: authHeaders() });
    navigate(adminRoutes.login);
  };

  // Silently unlock AudioContext on the first click anywhere
  useEffect(() => {
    const unlock = () => {
      try {
        if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
        audioCtxRef.current.resume();
      } catch {}
      document.removeEventListener("click", unlock);
    };
    document.addEventListener("click", unlock, { passive: true });
    return () => document.removeEventListener("click", unlock);
  }, []);

  const requestNotifPermission = async () => {
    if (typeof Notification === "undefined") return;
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
  };

  const sendNotification = useCallback((title: string, body: string) => {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/icon-192.png" });
    }
  }, []);

  const playChime = useCallback(() => {
    try {
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      ctx.resume();
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

  const playUrgentChime = useCallback(() => {
    try {
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      ctx.resume();
      // Three descending tones — urgent / different from the "new order" chime
      const notes = [
        { freq: 880, t: 0 },
        { freq: 660, t: 0.25 },
        { freq: 440, t: 0.5 },
        { freq: 880, t: 0.9 },
        { freq: 660, t: 1.15 },
        { freq: 440, t: 1.4 },
      ];
      notes.forEach(({ freq, t }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "square";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, ctx.currentTime + t);
        gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.5);
        osc.start(ctx.currentTime + t);
        osc.stop(ctx.currentTime + t + 0.55);
      });
    } catch {}
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders");
      if (!res.ok) throw new Error("Failed to fetch");
      const data: Order[] = await res.json();
      const active = data.filter((o) => ACTIVE_STATUSES.has(o.status));

      // Track when each order first enters "ready" state
      const nowMs = Date.now();
      active.forEach((o) => {
        if (o.status === "ready" && !readyTimestampsRef.current.has(o.id)) {
          readyTimestampsRef.current.set(o.id, nowMs);
        }
      });
      // Clean up orders that are no longer active
      for (const id of readyTimestampsRef.current.keys()) {
        if (!active.find((o) => o.id === id)) {
          readyTimestampsRef.current.delete(id);
          lastUncollectedChimeRef.current.delete(id);
        }
      }

      // Check for newly uncollected orders and re-chime for persistent ones
      active.filter((o) => o.status === "ready").forEach((o) => {
        const readySince = readyTimestampsRef.current.get(o.id);
        if (!readySince) return;
        const waitMs = nowMs - readySince;
        if (waitMs < UNCOLLECTED_MS) return; // Not uncollected yet

        const lastChime = lastUncollectedChimeRef.current.get(o.id) ?? 0;
        if (nowMs - lastChime >= UNCOLLECTED_RECHIME_MS) {
          lastUncollectedChimeRef.current.set(o.id, nowMs);
          playUrgentChime();
          sendNotification(
            `⚠️ Uncollected Order!`,
            `Order #${o.confirmationCode} (${o.customerName}) has been waiting over 1 hour — please call customer`
          );
        }
      });

      if (isFirstFetchRef.current) {
        // Snapshot existing IDs on load — don't chime for already-present orders
        isFirstFetchRef.current = false;
        prevIdsRef.current = new Set(active.map((o) => o.id));
        // For already-ready orders on load, assume they've been ready since now
        // so we don't immediately false-alert on restart
        active.filter((o) => o.status === "ready").forEach((o) => {
          if (!readyTimestampsRef.current.has(o.id)) {
            readyTimestampsRef.current.set(o.id, nowMs);
          }
        });
      } else {
        const newConfirmed = active.filter((o) => o.status === "confirmed" && !prevIdsRef.current.has(o.id));
        if (newConfirmed.length > 0) {
          playChime();
          sendNotification(
            `👨‍🍳 New Order${newConfirmed.length > 1 ? "s" : ""} to Cook!`,
            `${newConfirmed.length} order${newConfirmed.length > 1 ? "s" : ""} need${newConfirmed.length === 1 ? "s" : ""} to be started`
          );
        }
        prevIdsRef.current = new Set(active.map((o) => o.id));
      }

      setOrders(active);
      setLastFetch(new Date());
      setError(null);
    } catch {
      setError("Connection lost — retrying…");
    }
  }, [playChime, playUrgentChime, sendNotification]);

  useEffect(() => {
    fetchOrders();
    const id = setInterval(fetchOrders, 10_000);
    return () => clearInterval(id);
  }, [fetchOrders]);

  // Repeat chime every 4s while there are confirmed orders waiting to be cooked
  useEffect(() => {
    const hasPending = orders.some((o) => o.status === "confirmed");
    if (hasPending) {
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
  }, [orders, playChime]);

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

  const [mobileTab, setMobileTab] = useState<"new" | "preparing" | "ready">("new");

  // Filter out orders where ALL items are in non-KDS categories
  const kdsOrders = orders.filter(o => o.items.some(item => isKdsItem(item)));

  const byCol: Record<string, Order[]> = { new: [], preparing: [], ready: [] };
  for (const o of kdsOrders) {
    if (o.status === "confirmed") byCol.new.push(o);
    else if (o.status === "preparing") byCol.preparing.push(o);
    else if (o.status === "ready") byCol.ready.push(o);
  }

  const hasOrders = orders.length > 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col select-none overflow-hidden">
      <header className="flex items-center justify-between px-3 sm:px-5 py-2.5 sm:py-3 bg-zinc-900 border-b border-zinc-800 shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base sm:text-lg font-bold truncate">Island Tacos</span>
          <span className="text-zinc-500 text-sm hidden sm:inline">· Kitchen Display</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {error ? (
            <span className="text-red-400 text-xs font-medium hidden sm:block">{error}</span>
          ) : lastFetch ? (
            <span className="text-zinc-600 text-xs hidden lg:block">Refreshes every 10s · {lastFetch.toLocaleTimeString()}</span>
          ) : null}
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${error ? "bg-red-500" : "bg-green-400 animate-pulse"}`} />
            <span className={`text-xs font-medium hidden sm:inline ${error ? "text-red-400" : "text-green-400"}`}>
              {error ? "Offline" : "Live"}
            </span>
          </div>
          {notifPerm === "granted" ? (
            <span className="text-green-600 text-xs font-medium hidden sm:block">🔔</span>
          ) : notifPerm === "denied" ? (
            <span className="text-red-500 text-xs font-medium hidden sm:block" title="Enable in browser settings">🔕</span>
          ) : (
            <button
              onClick={requestNotifPermission}
              className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-amber-950 text-xs font-bold transition-colors animate-pulse"
            >
              🔔 <span className="hidden sm:inline">Alerts</span>
            </button>
          )}
          <button
            onClick={logout}
            className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors px-2 py-1 rounded"
          >
            <span className="hidden sm:inline">Sign out</span>
            <span className="sm:hidden">✕</span>
          </button>
        </div>
      </header>

      {hasOrders ? (
        <>
          {/* Desktop column headers */}
          <div className="hidden sm:grid grid-cols-3 gap-3 px-4 pt-4 pb-2 shrink-0">
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

          {/* Mobile tabs */}
          <div className="sm:hidden flex border-b border-zinc-800 shrink-0">
            {COL_CONFIG.map(({ key, label, badge }) => (
              <button
                key={key}
                onClick={() => setMobileTab(key as "new" | "preparing" | "ready")}
                className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
                  mobileTab === key
                    ? "border-current text-white"
                    : "border-transparent text-zinc-500"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${badge.includes("blue") ? "bg-blue-400" : badge.includes("orange") ? "bg-orange-400" : "bg-green-400"}`} />
                {label.split(" ")[0]}
                {byCol[key].length > 0 && (
                  <span className="bg-zinc-700 text-zinc-300 rounded-full text-[10px] w-4 h-4 flex items-center justify-center">
                    {byCol[key].length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="sm:grid sm:grid-cols-3 gap-3 px-3 sm:px-4 py-3 sm:pb-4 flex-1 overflow-y-auto items-start">
            {COL_CONFIG.map(({ key }) => (
              <div key={key} className={`flex flex-col gap-3 ${key === mobileTab ? "flex" : "hidden sm:flex"}`}>
                {byCol[key].length === 0 && (
                  <div className="border border-dashed border-zinc-800 rounded-xl flex items-center justify-center h-28">
                    <span className="text-zinc-700 text-sm">No orders</span>
                  </div>
                )}
                {byCol[key].map((order) => {
                  const overdue = isOverdue(order.createdAt, now);
                  const age = elapsed(order.createdAt, now);
                  const isAdvancing = advancing.has(order.id);
                  const next = NEXT_STATUS[order.status];
                  const { border, bg } = STATUS_CARD[order.status] ?? STATUS_CARD.confirmed;
                  const btnClass = STATUS_BTN[order.status];

                  // Uncollected: order has been "ready" for > 1 hour (and not dismissed)
                  const readySince = readyTimestampsRef.current.get(order.id);
                  const dismissedTs = dismissedUntil.get(order.id) ?? 0;
                  const isUncollected = order.status === "ready"
                    && readySince !== undefined
                    && (now - readySince) >= UNCOLLECTED_MS
                    && now > dismissedTs;
                  const uncollectedMins = readySince ? Math.floor((now - readySince) / 60000) : 0;

                  return (
                    <div
                      key={order.id}
                      className={`rounded-xl border-2 ${
                        isUncollected
                          ? "border-red-500 bg-red-950/60 animate-pulse"
                          : overdue
                            ? "border-red-500 bg-red-950/50 animate-pulse"
                            : `${border} ${bg}`
                      } p-4 flex flex-col gap-3 transition-colors`}
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
                        {order.items.filter(isKdsItem).map((item) => (
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

                      {isUncollected && (
                        <div className="bg-red-900/80 border border-red-500 rounded-lg px-3 py-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">⚠️</span>
                            <div>
                              <div className="text-red-200 text-sm font-black leading-tight">
                                ORDER NOT COLLECTED
                              </div>
                              <div className="text-red-300 text-xs">
                                Waiting {uncollectedMins >= 60
                                  ? `${Math.floor(uncollectedMins / 60)}h ${uncollectedMins % 60}m`
                                  : `${uncollectedMins}m`} — please call customer
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => setDismissedUntil(prev => {
                              const next = new Map(prev);
                              next.set(order.id, Date.now() + 30 * 60 * 1000);
                              return next;
                            })}
                            className="w-full text-xs py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/60 border border-red-700/40 text-red-300 font-semibold transition-colors"
                          >
                            Remind me again in 30 min
                          </button>
                        </div>
                      )}


                      {next && (
                        <button
                          onClick={() => advance(order)}
                          disabled={isAdvancing}
                          className={`w-full rounded-lg py-3 text-sm font-bold transition-all active:scale-95 ${btnClass} disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                          {isAdvancing ? "Updating…" : NEXT_LABEL[order.status]}
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
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="text-6xl font-black text-zinc-800 tracking-tight">All Clear</div>
          <div className="text-zinc-600 text-base">No active orders · refreshing every 10s</div>
        </div>
      )}
    </div>
  );
}

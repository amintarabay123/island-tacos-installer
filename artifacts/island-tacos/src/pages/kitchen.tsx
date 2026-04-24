import { useEffect, useState, useRef, useCallback } from "react";
import { RefreshCw } from "lucide-react";
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
  alreadyMade?: boolean | null;
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
  kdsCleared?: boolean | null;
  notes?: string | null;
  total: number;
  createdAt: string;
  scheduledPickupAt?: string | null;
  items: OrderItem[];
};

const ACTIVE_STATUSES = new Set(["confirmed", "preparing", "ready"]);
// KDS shows all orders placed within this window that have not been explicitly
// cleared by kitchen staff, regardless of payment or POS completion status.
const KDS_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const OVERDUE_MS = 10 * 60 * 1000;
const UNCOLLECTED_MS = 60 * 60 * 1000; // 1 hour in "ready" state = uncollected alert
const UNCOLLECTED_RECHIME_MS = 15 * 60 * 1000; // re-chime every 15 min

const NEXT_STATUS: Record<string, string> = {
  confirmed: "preparing",
  preparing: "ready",
};

const NEXT_LABEL: Record<string, string> = {
  confirmed: "Start Cooking",
  preparing: "Mark Ready",
};

const STATUS_CARD: Record<string, { border: string; bg: string }> = {
  confirmed: { border: "border-blue-400", bg: "bg-blue-50" },
  preparing: { border: "border-orange-400", bg: "bg-amber-50" },
  ready: { border: "border-green-500", bg: "bg-green-50" },
};

const STATUS_BTN: Record<string, string> = {
  pending: "bg-yellow-400 hover:bg-yellow-300 text-yellow-950 active:bg-yellow-200",
  confirmed: "bg-blue-400 hover:bg-blue-300 text-blue-950 active:bg-blue-200",
  preparing: "bg-green-400 hover:bg-green-300 text-green-950 active:bg-green-200",
  ready: "bg-white hover:bg-gray-100 text-gray-900 active:bg-gray-200",
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
  useEffect(() => { setPageMeta("Kitchen — Island Tacos", "🍳", { iconUrl: "/icon-kds-192.png", manifestUrl: "/manifest-kds.json" }); }, []);

  const [orders, setOrders] = useState<Order[]>([]);
  const [advancing, setAdvancing] = useState<Set<number>>(new Set());
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Local strikethrough state: Map<orderId, Set<itemId>>
  // Purely visual — lets staff tap an item to mark it done while the order stays open.
  const [struckItems, setStruckItems] = useState<Map<number, Set<number>>>(new Map());
  const toggleStruck = (orderId: number, itemId: number) => {
    setStruckItems(prev => {
      const next = new Map(prev);
      const set = new Set(next.get(orderId) ?? []);
      set.has(itemId) ? set.delete(itemId) : set.add(itemId);
      next.set(orderId, set);
      return next;
    });
  };
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );
  const prevIdsRef = useRef<Set<number>>(new Set());
  const isFirstFetchRef = useRef(true);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const chimeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chimeCountRef = useRef(0); // how many chimes have fired for the current batch
  const now = useNow();
  const [, navigate] = useLocation();

  // KDS category filtering
  const [kdsCategories, setKdsCategories] = useState<KitchenCategory[]>([]);
  const [menuItemCategoryMap, setMenuItemCategoryMap] = useState<Map<number, number>>(new Map());

  // Fetch category + item data — called on mount and refreshed every 60s so
  // admin changes (e.g. toggling KDS off for Drinks) take effect automatically.
  const fetchCategoryData = useCallback(() => {
    fetch("/api/menu/categories", { headers: authHeaders() })
      .then(r => r.json())
      .then((cats: KitchenCategory[]) => setKdsCategories(cats))
      .catch(() => {});
    fetch("/api/menu/items", { headers: authHeaders() })
      .then(r => r.json())
      .then((menuItems: KitchenMenuItem[]) => {
        const map = new Map<number, number>();
        for (const mi of menuItems) map.set(mi.id, mi.categoryId);
        setMenuItemCategoryMap(map);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchCategoryData();
    const id = setInterval(fetchCategoryData, 60_000);
    return () => clearInterval(id);
  }, [fetchCategoryData]);

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
    navigate(`${adminRoutes.login}?redirect=${encodeURIComponent(adminRoutes.kitchen)}`);
  };

  const [audioUnlocked, setAudioUnlocked] = useState(false);

  // iOS requires AudioContext to be CREATED and have audio PLAYED within a user gesture.
  // Just calling resume() is not enough — we must start an oscillator inside the handler.
  const unlockAudio = useCallback(() => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      // Play a silent blip — this is the only way to truly unlock audio on iOS Safari/PWA
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.001, ctx.currentTime); // near-silent
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.05);
      ctx.resume();
      setAudioUnlocked(true);
    } catch {}
  }, []);

  useEffect(() => {
    if (audioUnlocked) return;
    const events = ["click", "touchstart", "touchend", "pointerdown"];
    const handler = () => { unlockAudio(); events.forEach(e => document.removeEventListener(e, handler)); };
    events.forEach(e => document.addEventListener(e, handler, { passive: true }));
    return () => events.forEach(e => document.removeEventListener(e, handler));
  }, [audioUnlocked, unlockAudio]);

  const requestNotifPermission = async () => {
    if (typeof Notification === "undefined") return;
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
  };

  const sendNotification = useCallback((title: string, body: string) => {
    // Only send browser notifications when this tab is in the background
    if (document.visibilityState === "hidden" && typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/icon-192.png" });
    }
  }, []);

  const playChime = useCallback(() => {
    try {
      // Only chime in the active foreground tab
      if (document.visibilityState !== "visible") return;
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      ctx.resume();

      // Dynamics compressor maximizes perceived loudness
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -24;
      comp.knee.value = 6;
      comp.ratio.value = 20;
      comp.attack.value = 0.003;
      comp.release.value = 0.15;
      comp.connect(ctx.destination);

      const notes = [
        { freq: 523.25, t: 0 },
        { freq: 659.25, t: 0.14 },
        { freq: 783.99, t: 0.28 },
        { freq: 1046.5, t: 0.42 },
        { freq: 783.99, t: 0.60 },
        { freq: 1046.5, t: 0.74 },
      ];
      notes.forEach(({ freq, t }) => {
        // Layer square + sine at octave for rich, loud tone
        ["square", "sine"].forEach((type, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(comp);
          osc.type = type as OscillatorType;
          osc.frequency.value = i === 0 ? freq : freq * 2;
          gain.gain.setValueAtTime(0, ctx.currentTime + t);
          gain.gain.linearRampToValueAtTime(i === 0 ? 0.8 : 0.4, ctx.currentTime + t + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.55);
          osc.start(ctx.currentTime + t);
          osc.stop(ctx.currentTime + t + 0.6);
        });
      });
    } catch {}
  }, []);

  const playUrgentChime = useCallback(() => {
    try {
      // Only chime in the active foreground tab
      if (document.visibilityState !== "visible") return;
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      ctx.resume();

      // Dynamics compressor maximizes perceived loudness
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -24;
      comp.knee.value = 6;
      comp.ratio.value = 20;
      comp.attack.value = 0.003;
      comp.release.value = 0.15;
      comp.connect(ctx.destination);

      // Descending tones — urgent / different from the "new order" chime
      const notes = [
        { freq: 880, t: 0 },
        { freq: 660, t: 0.22 },
        { freq: 440, t: 0.44 },
        { freq: 880, t: 0.80 },
        { freq: 660, t: 1.02 },
        { freq: 440, t: 1.24 },
      ];
      notes.forEach(({ freq, t }) => {
        ["square", "sawtooth"].forEach((type, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(comp);
          osc.type = type as OscillatorType;
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0, ctx.currentTime + t);
          gain.gain.linearRampToValueAtTime(i === 0 ? 0.9 : 0.3, ctx.currentTime + t + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.45);
          osc.start(ctx.currentTime + t);
          osc.stop(ctx.currentTime + t + 0.5);
        });
      });
    } catch {}
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders");
      if (!res.ok) throw new Error("Failed to fetch");
      const data: Order[] = await res.json();
      // KDS shows orders that:
      //  • have NOT been explicitly cleared by kitchen staff (kdsCleared = false)
      //  • are not cancelled
      //  • were placed within the last 24 hours (prevents historical orders flooding the board)
      // Notably: payment status and POS "complete" actions do NOT remove from KDS.
      // Only "Done ✓ — Clear" pressed by kitchen staff removes an order here.
      const nowForFilter = Date.now();
      const active = data.filter((o) =>
        !o.kdsCleared &&
        o.status !== "cancelled" &&
        (nowForFilter - new Date(o.createdAt).getTime()) < KDS_WINDOW_MS
      );

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
        const newConfirmed = active.filter((o) =>
          o.status === "confirmed" &&
          !prevIdsRef.current.has(o.id) &&
          o.items.some(item => !item.alreadyMade)
        );
        if (newConfirmed.length > 0) {
          // Restart the 3-chime burst for this new batch
          if (chimeIntervalRef.current) { clearInterval(chimeIntervalRef.current); chimeIntervalRef.current = null; }
          chimeCountRef.current = 1;
          playChime(); // chime #1
          chimeIntervalRef.current = setInterval(() => {
            chimeCountRef.current += 1;
            playChime();
            if (chimeCountRef.current >= 3) {
              clearInterval(chimeIntervalRef.current!);
              chimeIntervalRef.current = null;
            }
          }, 4_000);
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

  // Use recursive setTimeout instead of setInterval so next poll only starts
  // after the previous fetch completes — prevents overlapping in-flight requests
  useEffect(() => {
    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (cancelled) return;
      await fetchOrders();
      if (!cancelled) timerId = setTimeout(tick, 5_000);
    };
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timerId);
    };
  }, [fetchOrders]);

  // Stop the 3-chime burst early if all pending orders are cleared before it finishes.
  useEffect(() => {
    const hasPending = orders.some((o) => o.status === "confirmed" && o.items.some(item => !item.alreadyMade));
    if (!hasPending && chimeIntervalRef.current) {
      clearInterval(chimeIntervalRef.current);
      chimeIntervalRef.current = null;
      chimeCountRef.current = 0;
    }
  }, [orders]);

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      if (chimeIntervalRef.current) {
        clearInterval(chimeIntervalRef.current);
        chimeIntervalRef.current = null;
      }
    };
  }, []);

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

  const clearFromKds = async (order: Order) => {
    setAdvancing((s) => new Set(s).add(order.id));
    try {
      await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kdsCleared: true }),
      });
      broadcastUpdate();
      await fetchOrders();
    } finally {
      setAdvancing((s) => { const ns = new Set(s); ns.delete(order.id); return ns; });
    }
  };

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [recalling, setRecalling] = useState<Set<number>>(new Set());

  const openHistory = async () => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const r = await fetch("/api/orders?kdsCleared=true&limit=50", { credentials: "include", headers: authHeaders() });
      const data: Order[] = await r.json();
      setHistoryOrders(data);
    } catch { /* silent */ } finally { setHistoryLoading(false); }
  };

  const recallOrder = async (order: Order) => {
    setRecalling(s => new Set(s).add(order.id));
    try {
      await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kdsCleared: false }),
      });
      setHistoryOrders(prev => prev.filter(o => o.id !== order.id));
      broadcastUpdate();
      await fetchOrders();
    } finally { setRecalling(s => { const n = new Set(s); n.delete(order.id); return n; }); }
  };

  const [mobileTab, setMobileTab] = useState<"new" | "preparing" | "ready">("new");

  // Filter out orders where ALL items are in non-KDS categories
  const kdsOrders = orders.filter(o => o.items.some(item => isKdsItem(item) && !item.alreadyMade));

  const byCol: Record<string, Order[]> = { new: [], preparing: [], ready: [] };
  for (const o of kdsOrders) {
    if (o.status === "confirmed") byCol.new.push(o);
    else if (o.status === "preparing") byCol.preparing.push(o);
    else {
      // "ready" and "completed" (paid from POS but kitchen hasn't cleared yet)
      // both belong in the Ready column — kitchen staff still needs to hand it off.
      byCol.ready.push(o);
    }
  }
  // Sort each column: soonest scheduled first, then ASAP by creation time
  const sortOrders = (list: Order[]) => list.sort((a, b) => {
    const ta = a.scheduledPickupAt ? new Date(a.scheduledPickupAt).getTime() : new Date(a.createdAt).getTime();
    const tb = b.scheduledPickupAt ? new Date(b.scheduledPickupAt).getTime() : new Date(b.createdAt).getTime();
    return ta - tb;
  });
  sortOrders(byCol.new);
  sortOrders(byCol.preparing);
  sortOrders(byCol.ready);

  const hasOrders = orders.length > 0;

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 flex flex-col select-none overflow-hidden">
      <header className="flex items-center justify-between px-3 sm:px-5 py-2.5 sm:py-3 bg-white border-b border-gray-200 shrink-0 gap-2 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base sm:text-lg font-bold truncate">Island Tacos</span>
          <span className="text-gray-400 text-sm hidden sm:inline">· Kitchen Display</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {error ? (
            <span className="text-red-500 text-xs font-medium hidden sm:block">{error}</span>
          ) : lastFetch ? (
            <span className="text-gray-400 text-xs hidden lg:block">Refreshes every 3s · {lastFetch.toLocaleTimeString()}</span>
          ) : null}
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${error ? "bg-red-500" : "bg-green-500 animate-pulse"}`} />
            <span className={`text-xs font-medium hidden sm:inline ${error ? "text-red-500" : "text-green-600"}`}>
              {error ? "Offline" : "Live"}
            </span>
          </div>
          {(!audioUnlocked || notifPerm === "default") ? (
            <button
              onClick={() => { unlockAudio(); requestNotifPermission(); }}
              className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-gray-900 text-xs font-bold transition-colors animate-pulse"
              title="Tap once to enable order chimes and alerts"
            >
              🔔 <span className="hidden sm:inline">Enable Notifications</span>
            </button>
          ) : (
            <span className="text-green-600 text-xs font-medium hidden sm:flex items-center gap-1">
              🔔 <span>Notifications on</span>
            </span>
          )}
          <button
            onClick={openHistory}
            className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold transition-colors"
          >
            🕐 <span className="hidden sm:inline">History</span>
          </button>
          <button
            onClick={() => window.location.reload()}
            title="Reload Kitchen Display"
            className="text-gray-400 hover:text-gray-700 transition-colors px-2 py-1 rounded"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={logout}
            className="text-gray-400 hover:text-gray-700 text-xs transition-colors px-2 py-1 rounded"
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
                <span className="text-gray-400 text-sm">
                  {byCol[key].length} {byCol[key].length === 1 ? "order" : "orders"}
                </span>
              </div>
            ))}
          </div>

          {/* Mobile tabs */}
          <div className="sm:hidden flex border-b border-gray-200 shrink-0 bg-white">
            {COL_CONFIG.map(({ key, label, badge }) => (
              <button
                key={key}
                onClick={() => setMobileTab(key as "new" | "preparing" | "ready")}
                className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
                  mobileTab === key
                    ? "border-current text-gray-900"
                    : "border-transparent text-gray-400"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${badge.includes("blue") ? "bg-blue-400" : badge.includes("orange") ? "bg-orange-400" : "bg-green-500"}`} />
                {label.split(" ")[0]}
                {byCol[key].length > 0 && (
                  <span className="bg-gray-200 text-gray-600 rounded-full text-[10px] w-4 h-4 flex items-center justify-center">
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
                  <div className="border border-dashed border-gray-200 rounded-xl flex items-center justify-center h-28">
                    <span className="text-gray-600 text-sm">No orders</span>
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
                      className={`rounded-lg border-2 ${
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
                            {order.customerName}
                          </div>
                          <div className="text-gray-500 font-mono text-sm mt-1">#{order.confirmationCode}</div>
                          {order.scheduledPickupAt && (() => {
                            const d = new Date(order.scheduledPickupAt);
                            const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Puerto_Rico" });
                            return (
                              <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded bg-purple-900/60 border border-purple-500/50">
                                <span className="text-purple-200 text-xs font-bold">⏰ Scheduled {timeStr}</span>
                              </div>
                            );
                          })()}
                          {!order.scheduledPickupAt && order.status === "confirmed" && (
                            <div className="text-blue-300 text-xs font-semibold mt-0.5 uppercase tracking-wide">Accepted</div>
                          )}
                          {order.status === "ready" && (
                            <div className="text-green-300 text-xs font-semibold mt-0.5 uppercase tracking-wide">Ready for pickup</div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`text-sm font-bold tabular-nums ${overdue ? "text-red-400" : "text-gray-500"}`}>
                            {age}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5 capitalize">{order.orderType}</div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        {order.items.filter(isKdsItem).map((item) => (
                          item.alreadyMade ? (
                            <div key={item.id} className="bg-gray-200/60 rounded px-3 py-2 opacity-50 flex items-center gap-2">
                              <span className="text-green-400 text-base font-bold shrink-0">✓</span>
                              <div className="flex items-baseline gap-2 line-through decoration-gray-400">
                                <span className="text-lg font-semibold text-gray-400 leading-none">{item.quantity}×</span>
                                <span className="text-base font-medium text-gray-400 leading-snug">{item.menuItemName}</span>
                              </div>
                              <span className="text-xs text-gray-500 ml-auto shrink-0">done</span>
                            </div>
                          ) : (() => {
                            const struck = struckItems.get(order.id)?.has(item.id) ?? false;
                            return (
                              <button
                                key={item.id}
                                onClick={() => toggleStruck(order.id, item.id)}
                                className={`w-full text-left rounded px-3 py-3 border transition-all active:scale-[0.98] ${
                                  struck
                                    ? "bg-gray-100 border-gray-200 opacity-60"
                                    : "bg-white border-gray-200 hover:border-gray-300"
                                }`}
                              >
                                <div className={`flex items-baseline gap-2 ${struck ? "line-through decoration-gray-500 decoration-2" : ""}`}>
                                  <span className={`text-3xl font-black leading-none ${struck ? "text-gray-400" : "text-gray-900"}`}>{item.quantity}×</span>
                                  <span className={`text-xl font-bold leading-snug ${struck ? "text-gray-400" : "text-gray-900"}`}>{item.menuItemName}</span>
                                  {struck && <span className="text-xs text-gray-400 font-normal ml-1 no-underline">done</span>}
                                </div>
                                {!struck && (item.modifierSelections ?? []).length > 0 ? (
                                  <div className="text-amber-600 text-xl mt-2 leading-snug font-semibold space-y-1">
                                    {(item.modifierSelections ?? []).map((m, i) => (
                                      <div key={i}>+ {m.name}</div>
                                    ))}
                                  </div>
                                ) : !struck && item.notes ? (
                                  <div className="text-amber-600 text-xl mt-2 leading-snug whitespace-pre-line font-semibold">
                                    {item.notes}
                                  </div>
                                ) : null}
                              </button>
                            );
                          })()
                        ))}
                      </div>

                      {order.notes && (
                        <div className="bg-yellow-50 border border-yellow-300 rounded px-3 py-2 text-yellow-800 text-base leading-snug">
                          {order.notes}
                        </div>
                      )}

                      {isUncollected && (
                        <div className="bg-red-900/80 border border-red-500 rounded px-2 py-2 space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-base">⚠️</span>
                            <div>
                              <div className="text-red-200 text-xs font-black leading-tight">
                                ORDER NOT COLLECTED
                              </div>
                              <div className="text-red-300 text-[10px]">
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
                            className="w-full text-xs py-1 rounded bg-red-950/60 hover:bg-red-900/60 border border-red-700/40 text-red-300 font-semibold transition-colors"
                          >
                            Remind me again in 30 min
                          </button>
                        </div>
                      )}


                      {next && (
                        <button
                          onClick={() => advance(order)}
                          disabled={isAdvancing}
                          className={`w-full rounded py-3 text-base font-bold transition-all active:scale-95 ${btnClass} disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                          {isAdvancing ? "Updating…" : NEXT_LABEL[order.status]}
                        </button>
                      )}
                      {!next && (
                        <button
                          onClick={() => clearFromKds(order)}
                          disabled={isAdvancing}
                          className="w-full rounded py-2 text-xs font-bold bg-gray-200 hover:bg-gray-300 text-gray-700 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {isAdvancing ? "Clearing…" : "Done ✓ — Clear"}
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
          <div className="text-6xl font-black text-gray-800 tracking-tight">All Clear</div>
          <div className="text-gray-500 text-base">No active orders · refreshing every 10s</div>
        </div>
      )}

      {/* ── History Drawer ── */}
      {historyOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex justify-end" onClick={() => setHistoryOpen(false)}>
          <div className="bg-white w-full max-w-sm h-full flex flex-col shadow-2xl border-l border-gray-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-gray-900 text-lg font-bold">🕐 Order History</h2>
              <button onClick={() => setHistoryOpen(false)} className="text-gray-400 hover:text-gray-900 text-2xl font-bold w-8 h-8 flex items-center justify-center transition-colors">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {historyLoading && <p className="text-gray-400 text-center py-8">Loading…</p>}
              {!historyLoading && historyOrders.length === 0 && (
                <p className="text-gray-400 text-center py-8">No completed orders</p>
              )}
              {!historyLoading && historyOrders.map(o => (
                <div key={o.id} className="bg-gray-100 rounded-xl p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-gray-900 font-bold text-base leading-tight">{o.customerName}</p>
                      <p className="text-gray-400 font-mono text-xs">#{o.confirmationCode}</p>
                    </div>
                    <span className="text-gray-500 text-xs">{new Date(o.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                  </div>
                  <div className="text-gray-500 text-xs">
                    {o.items.map(i => `${i.quantity}× ${i.menuItemName}`).join(" · ")}
                  </div>
                  <button
                    disabled={recalling.has(o.id)}
                    onClick={() => recallOrder(o)}
                    className="w-full h-9 rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-40 text-gray-900 text-xs font-bold transition-colors"
                  >
                    {recalling.has(o.id) ? "Recalling…" : "↩ Recall to Ready"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

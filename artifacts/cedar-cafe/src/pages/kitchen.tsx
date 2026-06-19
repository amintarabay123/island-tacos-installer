import { useEffect, useState, useRef, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { useLocation } from "wouter";
import { adminRoutes } from "@/lib/admin-path";
import { authHeaders, clearAuthToken } from "@/lib/auth";
import { setPageMeta } from "@/lib/page-meta";
import { useStoreSettings } from "@/lib/use-store-settings";

// ── Chalkboard Design System ──────────────────────────────────────────────────
const IL = { bg:"#0c0805", card:"#171009", hdr:"#100c06", bord:"#4a3020", tp:"#F5ECD7", tm:"#C8A882", mu:"#9e8570", or:"#C8A882", pur:"#C8A882", grn:"#3d8f6a", red:"#d4614a" };
const ITEM_GRADS: { grad: string; glow: string }[] = [
  { grad:"linear-gradient(135deg,#C8A882,#a8845e)",   glow:"rgba(200,168,130,0.4)" },
  { grad:"linear-gradient(135deg,#2d6a4f,#1d4d38)",   glow:"rgba(45,106,79,0.4)" },
  { grad:"linear-gradient(135deg,#e8a030,#b87820)",   glow:"rgba(232,160,48,0.4)" },
  { grad:"linear-gradient(135deg,#3d8f6a,#2d6a4f)",   glow:"rgba(61,143,106,0.4)" },
  { grad:"linear-gradient(135deg,#8b6840,#5c3d20)",   glow:"rgba(139,104,64,0.4)" },
  { grad:"linear-gradient(135deg,#d4614a,#a03d2a)",   glow:"rgba(212,97,74,0.4)" },
  { grad:"linear-gradient(135deg,#9e7850,#6b4c2a)",   glow:"rgba(158,120,80,0.4)" },
  { grad:"linear-gradient(135deg,#6b4c2a,#4a3020)",   glow:"rgba(107,76,42,0.4)" },
];
const STATUS_GRAD: Record<string, string> = {
  confirmed: "linear-gradient(135deg,#2d6a4f,#1d4d38)",
  preparing: "linear-gradient(135deg,#e8a030,#b87820)",
  ready:     "linear-gradient(135deg,#3d8f6a,#2d6a4f)",
};
const STATUS_GLOW: Record<string, string> = {
  confirmed: "rgba(45,106,79,0.5)",
  preparing: "rgba(232,160,48,0.5)",
  ready:     "rgba(61,143,106,0.5)",
};

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

type KitchenCategory = { id: number; name: string; sendToKds: boolean; kdsStation?: string | null };
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

// STATUS_CARD replaced by STATUS_GRAD inline styles

// ─── Printer helpers ──────────────────────────────────────────────────────────
type PrinterConfig = { type: string; ip?: string; port?: number; bridgeUrl?: string; localApiUrl?: string };
type PrintLine = { text: string; bold?: boolean; center?: boolean; size?: string; divider?: boolean };

function getKdsPrinterConfig(): PrinterConfig {
  try {
    // Use kdsConfig if present; fall back to printerConfig for devices not yet reconfigured
    const raw = localStorage.getItem("kdsConfig") ?? localStorage.getItem("printerConfig") ?? "{}";
    const saved = JSON.parse(raw);
    return { type: "network", ip: "", port: 9100, ...saved };
  } catch { return { type: "network", ip: "", port: 9100 }; }
}

async function printLines(lines: PrintLine[]): Promise<{ ok: boolean; error?: string }> {
  const cfg = getKdsPrinterConfig();
  if (cfg.type === "bridge") {
    const url = (cfg.bridgeUrl ?? "http://localhost:8765").replace(/\/$/, "");
    try {
      const r = await fetch(`${url}/print`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lines }) });
      return await r.json();
    } catch (e) { return { ok: false, error: `Bridge unreachable: ${String(e)}` }; }
  }
  if (cfg.type === "network" && cfg.ip) {
    try {
      // localApiUrl routes the request to the shop's local API server even when the
      // KDS browser tab is open on the cloud URL (e.g. orders.islandtacosbvi.com).
      const apiBase = cfg.localApiUrl ? cfg.localApiUrl.replace(/\/$/, "") : "";
      const r = await fetch(`${apiBase}/api/print/network`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ ip: cfg.ip, port: cfg.port ?? 9100, lines }),
      });
      return await r.json();
    } catch (e) { return { ok: false, error: String(e) }; }
  }
  return { ok: false, error: "No printer configured. Set up network printer in POS settings." };
}

function buildKitchenTicket(order: { confirmationCode: string; customerName: string; customerPhone?: string | null; createdAt: string; notes?: string | null; items: Array<{ menuItemName: string; quantity: number; notes?: string | null; modifierSelections?: { name: string }[] | null }> }): PrintLine[] {
  const lines: PrintLine[] = [];
  lines.push({ text: "================================", center: true });
  lines.push({ text: `ORDER #${order.confirmationCode}`, bold: true, center: true, size: "large" });
  lines.push({ text: "================================", center: true });
  lines.push({ text: order.customerName || "Walk-in", bold: true, center: true, size: "large" });
  if (order.customerPhone) lines.push({ text: order.customerPhone, center: true });
  const t = new Date(order.createdAt);
  lines.push({ text: t.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Puerto_Rico" }), center: true });
  lines.push({ divider: true, text: "" });
  for (const item of order.items) {
    lines.push({ text: `${item.quantity}x ${item.menuItemName}`, bold: true });
    for (const m of item.modifierSelections ?? []) lines.push({ text: `  + ${m.name}` });
    if (item.notes) lines.push({ text: `  NOTE: ${item.notes}`, bold: true });
  }
  if (order.notes) {
    lines.push({ divider: true, text: "" });
    lines.push({ text: `ORDER NOTE:`, bold: true });
    lines.push({ text: order.notes, bold: true });
  }
  lines.push({ text: "================================", center: true });
  lines.push({ text: "", center: true });
  return lines;
}

// STATUS_BTN replaced by STATUS_GRAD inline styles

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

export default function Kitchen({ station }: { station?: string } = {}) {
  const { storeName } = useStoreSettings();
  useEffect(() => {
    const label = station ? `Kitchen — ${station.charAt(0).toUpperCase() + station.slice(1)}` : "Kitchen Display";
    setPageMeta(label, "🍳", { iconUrl: "/icon-kds-192.png", manifestUrl: "/manifest-kds.json" });
  }, [station]);

  // Sync printer config from server on load — ensures all devices use the same settings
  // configured once from Admin → Reports → Printer Settings.
  useEffect(() => {
    fetch("/api/settings", { credentials: "include", headers: authHeaders() })
      .then(r => r.json())
      .then((data: Record<string, string>) => {
        if (data.printer_config) {
          try {
            const cfg = JSON.parse(data.printer_config) as Record<string, unknown>;
            const current = JSON.parse(localStorage.getItem("printerConfig") ?? "{}") as Record<string, unknown>;
            localStorage.setItem("printerConfig", JSON.stringify({ ...current, ...cfg }));
          } catch { /* ignore */ }
        }
      })
      .catch(() => { /* fallback to localStorage */ });
  }, []);

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

  // Collapse state: orders whose item list is hidden to save space.
  // Staff tap the chevron on any card header to collapse/expand manually.
  const [collapsedOrders, setCollapsedOrders] = useState<Set<number>>(new Set());
  const toggleCollapsed = (orderId: number) => {
    setCollapsedOrders(prev => {
      const next = new Set(prev);
      next.has(orderId) ? next.delete(orderId) : next.add(orderId);
      return next;
    });
  };

  // Print state: set of order IDs currently printing
  const [printing, setPrinting] = useState<Set<number>>(new Set());
  const printTicket = async (order: Order) => {
    setPrinting(s => new Set(s).add(order.id));
    try {
      const result = await printLines(buildKitchenTicket(order));
      if (!result.ok) alert(`Print failed: ${result.error ?? "Unknown error"}`);
    } finally {
      setPrinting(s => { const ns = new Set(s); ns.delete(order.id); return ns; });
    }
  };
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );
  const prevIdsRef = useRef<Set<number>>(new Set());
  // Tracks which order_item IDs were "not yet made KDS items" on the previous
  // fetch. Used to detect ADD-ONS — items appearing on an order we already
  // knew about. New items on a brand-new order are detected by prevIdsRef
  // instead and chime via the normal new-order path.
  const prevNewItemIdsRef = useRef<Set<number>>(new Set());
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

  // Returns true if an item should appear on this KDS station.
  // Rules:
  //   1. Category must have sendToKds=true
  //   2. If a station param is set: category.kds_station must match it
  //      (null/undefined kds_station means "all stations" — always show)
  const isKdsItem = useCallback((item: OrderItem): boolean => {
    if (!item.menuItemId) return true;
    const categoryId = menuItemCategoryMap.get(item.menuItemId);
    if (categoryId === undefined) return true;
    const cat = kdsCategories.find(c => c.id === categoryId);
    if (!cat) return true;
    if (!cat.sendToKds) return false;
    if (station && cat.kdsStation && cat.kdsStation !== station) return false;
    return true;
  }, [kdsCategories, menuItemCategoryMap, station]);

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
    // Only chime in the active foreground tab
    if (document.visibilityState !== "visible") return;
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;

    // resume() is async — wait for the context to be running before scheduling audio.
    // Without this, oscillators scheduled while the context is still suspended are dropped silently.
    ctx.resume().then(() => {
      try {
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
    }).catch(() => {});
  }, []);

  const playUrgentChime = useCallback(() => {
    // Only chime in the active foreground tab
    if (document.visibilityState !== "visible") return;
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;

    ctx.resume().then(() => {
      try {
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
    }).catch(() => {});
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders", { credentials: "include", headers: authHeaders() });
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

      // Build the set of "currently un-made KDS item IDs" for next-fetch diffing.
      const currentNewItemIds = new Set<number>();
      for (const o of active) {
        for (const item of o.items) {
          if (!item.alreadyMade && isKdsItem(item)) currentNewItemIds.add(item.id);
        }
      }

      if (isFirstFetchRef.current) {
        // Snapshot existing IDs on load — don't chime for already-present orders
        isFirstFetchRef.current = false;
        prevIdsRef.current = new Set(active.map((o) => o.id));
        prevNewItemIdsRef.current = currentNewItemIds;
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
          o.items.some(item => !item.alreadyMade && isKdsItem(item))
        );

        // Detect ADD-ON items: un-made KDS items appearing on orders we
        // already knew about. These are the items POS sent through the
        // cancel+create-resumed-ticket path with alreadyMade=false.
        let addonOrderCount = 0;
        for (const o of active) {
          if (!prevIdsRef.current.has(o.id)) continue; // brand-new order — counted above
          const hasNewAddon = o.items.some(item =>
            !item.alreadyMade && isKdsItem(item) && !prevNewItemIdsRef.current.has(item.id)
          );
          if (hasNewAddon) addonOrderCount += 1;
        }

        if (newConfirmed.length > 0 || addonOrderCount > 0) {
          // Restart the 3-chime burst for this new batch (covers both new orders
          // and add-ons — cooks need the same level of attention either way).
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
          const parts: string[] = [];
          if (newConfirmed.length > 0) parts.push(`${newConfirmed.length} new order${newConfirmed.length > 1 ? "s" : ""}`);
          if (addonOrderCount > 0) parts.push(`${addonOrderCount} add-on${addonOrderCount > 1 ? "s" : ""}`);
          sendNotification(
            `👨‍🍳 ${parts.join(" + ")} to cook!`,
            newConfirmed.length > 0 && addonOrderCount > 0
              ? `New tickets and add-on items both need attention`
              : newConfirmed.length > 0
                ? `${newConfirmed.length} order${newConfirmed.length > 1 ? "s" : ""} need${newConfirmed.length === 1 ? "s" : ""} to be started`
                : `Add-on items added to ${addonOrderCount} existing order${addonOrderCount > 1 ? "s" : ""}`
          );
        }
        prevIdsRef.current = new Set(active.map((o) => o.id));
        prevNewItemIdsRef.current = currentNewItemIds;
      }

      setOrders(active);
      setLastFetch(new Date());
      setError(null);
    } catch {
      setError("Connection lost — retrying…");
    }
  }, [playChime, playUrgentChime, sendNotification, isKdsItem]);

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
    // Includes both brand-new confirmed orders AND add-on items on existing
    // orders — both demand the same level of cook attention until handled.
    const hasPending = orders.some((o) => o.items.some(item => !item.alreadyMade && isKdsItem(item)));
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
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status: next }),
      });
      broadcastUpdate();
      await fetchOrders();
    } finally {
      setAdvancing((s) => { const ns = new Set(s); ns.delete(order.id); return ns; });
    }
  };

  // Mark a specific subset of an order's items as alreadyMade=true.
  // Used by the ADD-ON card's "Made ✓" button. The parent order's status is
  // unchanged — only the listed order_items rows flip alreadyMade.
  const markItemsMade = async (orderId: number, itemIds: number[]) => {
    setAdvancing((s) => new Set(s).add(orderId));
    try {
      const res = await fetch(`/api/orders/${orderId}/items/mark-made`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ itemIds }),
      });
      if (!res.ok) {
        // Surface the failure to the cook — silently swallowing it (the original
        // pattern in advance/clearFromKds) caused "Made ✓" to look like it did
        // nothing, leading to repeated taps and confusion.
        const body = await res.json().catch(() => ({})) as { error?: string };
        setError(`Could not mark items made: ${body.error ?? `HTTP ${res.status}`}`);
        return;
      }
      broadcastUpdate();
      await fetchOrders();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Could not mark items made: ${msg}`);
    } finally {
      setAdvancing((s) => { const ns = new Set(s); ns.delete(orderId); return ns; });
    }
  };

  const clearFromKds = async (order: Order) => {
    setAdvancing((s) => new Set(s).add(order.id));
    try {
      await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
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
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ kdsCleared: false }),
      });
      setHistoryOrders(prev => prev.filter(o => o.id !== order.id));
      broadcastUpdate();
      await fetchOrders();
    } finally { setRecalling(s => { const n = new Set(s); n.delete(order.id); return n; }); }
  };

  const [mobileTab, setMobileTab] = useState<"new" | "preparing" | "ready">("new");

  // Show on KDS if EITHER condition holds:
  //
  //   (a) At least one not-yet-made KDS item exists.
  //       This is the normal path: confirmed/new orders and addon cards whose
  //       new items haven't been cooked yet. Also drives the chime.
  //
  //   (b) The order is past the "accepted" stage (preparing / ready / completed)
  //       AND has at least one KDS item.
  //       This handles the addon-flow edge case: after the addon card's "Made ✓"
  //       is pressed, ALL KDS items flip to alreadyMade=true. If the order also
  //       has a non-KDS drink (alreadyMade=false, isKdsItem=false), condition (a)
  //       would be false for every KDS item and the card would vanish — leaving
  //       the cook with no way to press "Ready" or "Complete".
  //       Status-based visibility ensures the card stays in the correct column
  //       (Preparing or Ready) until the cook explicitly advances or clears it.
  //
  // Notes:
  //   - kdsCleared orders are already excluded by the API before reaching here.
  //   - Drinks still never appear on any card; that's enforced by isKdsItem() in
  //     the card renderer and in the isMixed/addon-split logic below.
  //   - The chime and "hasPending" indicator use the raw `orders` array with the
  //     original !alreadyMade && isKdsItem guard — those are unchanged.
  const kdsOrders = orders.filter(o =>
    o.items.some(item => !item.alreadyMade && isKdsItem(item)) ||
    (o.status !== "pending" && o.status !== "confirmed" && o.items.some(isKdsItem))
  );

  // KdsCard: one card on the board. A "full" card renders the whole order
  // (optionally hiding items that have been split out into a separate add-on
  // card). An "addon" card renders ONLY the listed items with a "Made ✓"
  // button — it lives in the "new" column so cooks can't miss it.
  type KdsCard =
    | { kind: "full"; order: Order; hiddenItemIds?: Set<number> }
    | { kind: "addon"; order: Order; items: OrderItem[] };

  const byCol: Record<string, KdsCard[]> = { new: [], preparing: [], ready: [] };
  for (const o of kdsOrders) {
    if (o.status === "pending") continue; // not yet accepted — don't show on KDS

    const targetCol = o.status === "confirmed" ? "new"
      : o.status === "preparing" ? "preparing"
      // "ready" and "completed" (paid from POS but kitchen hasn't cleared yet)
      // both belong in the Ready column — kitchen staff still needs to hand it off.
      : "ready";

    const kdsItems = o.items.filter(isKdsItem);
    const newKdsItems = kdsItems.filter(i => !i.alreadyMade);
    const madeKdsItems = kdsItems.filter(i => i.alreadyMade);

    // Add-on split: any order with BOTH already-made and new KDS items.
    // The primary trigger is POS resume-and-add: the POS cancel+create path
    // produces a brand-new CONFIRMED order containing both the original lines
    // (alreadyMade=true) and the newly added lines (alreadyMade=false). Status
    // does NOT matter — what matters is the mix, because that mix is what was
    // causing cooks to re-make the original items.
    const isMixed = madeKdsItems.length > 0 && newKdsItems.length > 0;

    if (isMixed) {
      const hiddenItemIds = new Set(newKdsItems.map(i => i.id));
      byCol.new.push({ kind: "addon", order: o, items: newKdsItems });
      byCol[targetCol].push({ kind: "full", order: o, hiddenItemIds });
    } else {
      byCol[targetCol].push({ kind: "full", order: o });
    }
  }
  // Sort each column: addon cards first (most urgent), then soonest scheduled,
  // then ASAP by creation time. Within addon cards, oldest order first.
  const cardSortTime = (c: KdsCard): number => {
    const o = c.order;
    return o.scheduledPickupAt ? new Date(o.scheduledPickupAt).getTime() : new Date(o.createdAt).getTime();
  };
  const sortCards = (list: KdsCard[]) => list.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "addon" ? -1 : 1;
    return cardSortTime(a) - cardSortTime(b);
  });
  sortCards(byCol.new);
  sortCards(byCol.preparing);
  sortCards(byCol.ready);

  const hasOrders = orders.length > 0;

  return (
    <div className="flex flex-col select-none overflow-hidden" style={{ minHeight:"100dvh", background:IL.bg, color:IL.tp }}>
      <header style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 16px", background:IL.hdr, borderBottom:`1px solid ${IL.bord}`, flexShrink:0, gap:8 }}>
        <div className="flex items-center gap-2 min-w-0">
          <span style={{ fontSize:17, fontWeight:900, color:IL.tp }} className="truncate">{storeName}</span>
          <span style={{ color:IL.mu, fontSize:13 }} className="hidden sm:inline">· Kitchen Display</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {error ? (
            <span style={{ color:IL.red, fontSize:11, fontWeight:600 }} className="hidden sm:block">{error}</span>
          ) : lastFetch ? (
            <span style={{ color:IL.mu, fontSize:11 }} className="hidden lg:block">Refreshes every 3s · {lastFetch.toLocaleTimeString()}</span>
          ) : null}
          <div className="flex items-center gap-1.5">
            <span style={{ width:8, height:8, borderRadius:"50%", background: error ? IL.red : IL.grn, display:"inline-block", flexShrink:0 }} className={error ? "" : "animate-pulse"} />
            <span style={{ fontSize:12, fontWeight:600, color: error ? IL.red : IL.grn }} className="hidden sm:inline">
              {error ? "Offline" : "Live"}
            </span>
          </div>
          {(!audioUnlocked || notifPerm === "default") ? (
            <button
              onClick={() => { unlockAudio(); requestNotifPermission(); }}
              style={{ position:"relative", overflow:"hidden", display:"flex", alignItems:"center", gap:6, padding:"6px 14px", borderRadius:12, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
                background:"linear-gradient(135deg,#f59e0b,#d97706)", border:"none", color:"#fff", boxShadow:"0 2px 14px rgba(245,158,11,0.55)" }}
              title="Tap once to enable order chimes and alerts"
              className="animate-pulse"
            >
              <div style={{ position:"absolute", inset:0, background:"linear-gradient(155deg,rgba(255,255,255,0.2) 0%,transparent 55%)", pointerEvents:"none" }} />
              🔔 <span className="hidden sm:inline" style={{ position:"relative" }}>Enable Alerts</span>
            </button>
          ) : (
            <span style={{ color:IL.grn, fontSize:12, fontWeight:600 }} className="hidden sm:flex items-center gap-1">
              🔔 <span>On</span>
            </span>
          )}
          <button
            onClick={openHistory}
            style={{ position:"relative", overflow:"hidden", display:"flex", alignItems:"center", gap:6, padding:"6px 14px", borderRadius:12, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
              background:"linear-gradient(135deg,#2d6a4f,#1d4d38)", border:"none", color:"#fff", boxShadow:"0 2px 14px rgba(45,106,79,0.45)" }}
          >
            <div style={{ position:"absolute", inset:0, background:"linear-gradient(155deg,rgba(255,255,255,0.2) 0%,transparent 55%)", pointerEvents:"none" }} />
            🕐 <span className="hidden sm:inline" style={{ position:"relative" }}>History</span>
          </button>
          <button
            onClick={() => window.location.reload()}
            title="Reload Kitchen Display"
            style={{ padding:"6px 10px", borderRadius:10, background:"rgba(255,255,255,0.08)", border:`1px solid ${IL.bord}`, color:IL.mu, cursor:"pointer" }}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={logout}
            style={{ padding:"6px 10px", borderRadius:10, background:"rgba(255,255,255,0.08)", border:`1px solid ${IL.bord}`, color:IL.mu, fontSize:12, cursor:"pointer", fontFamily:"inherit" }}
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
            {COL_CONFIG.map(({ key, label }) => {
              const colGrad = key === "new" ? "linear-gradient(135deg,#2d6a4f,#0284c7)"
                : key === "preparing" ? "linear-gradient(135deg,#C8A882,#a8845e)"
                : "linear-gradient(135deg,#3d8f6a,#059669)";
              const colGlow = key === "new" ? "rgba(45,106,79,0.5)"
                : key === "preparing" ? "rgba(200,168,130,0.5)"
                : "rgba(61,143,106,0.5)";
              return (
                <div key={key} className="flex items-center gap-2">
                  <span style={{ position:"relative", overflow:"hidden", padding:"3px 12px", borderRadius:20, fontSize:11, fontWeight:800, textTransform:"uppercase", letterSpacing:".08em", background:colGrad, color:"#fff", boxShadow:`0 2px 10px ${colGlow}`, display:"inline-block" }}>
                    <span style={{ position:"absolute", inset:0, background:"linear-gradient(155deg,rgba(255,255,255,0.18) 0%,transparent 55%)", pointerEvents:"none" }} />
                    <span style={{ position:"relative" }}>{label}</span>
                  </span>
                  <span style={{ color:IL.mu, fontSize:13 }}>
                    {byCol[key].length} {byCol[key].length === 1 ? "order" : "orders"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Mobile tabs */}
          <div style={{ display:"flex", borderBottom:`1px solid ${IL.bord}`, flexShrink:0, background:IL.hdr }} className="sm:hidden">
            {COL_CONFIG.map(({ key, label }) => {
              const isActive = mobileTab === key;
              const colGrad = key === "new" ? "linear-gradient(135deg,#2d6a4f,#0284c7)"
                : key === "preparing" ? "linear-gradient(135deg,#C8A882,#a8845e)"
                : "linear-gradient(135deg,#3d8f6a,#059669)";
              const dotColor = key === "new" ? "#2d6a4f" : key === "preparing" ? "#C8A882" : "#3d8f6a";
              return (
                <button
                  key={key}
                  onClick={() => setMobileTab(key as "new" | "preparing" | "ready")}
                  style={{ flex:1, padding:"10px 0", fontSize:11, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", gap:6, cursor:"pointer", fontFamily:"inherit",
                    background: isActive ? colGrad : "transparent",
                    color: isActive ? "#fff" : IL.mu, border:"none" }}
                >
                  <span style={{ width:8, height:8, borderRadius:"50%", background:dotColor, display:"inline-block", flexShrink:0 }} />
                  {label.split(" ")[0]}
                  {byCol[key].length > 0 && (
                    <span style={{ background:"rgba(0,0,0,0.3)", color:"rgba(255,255,255,0.8)", borderRadius:20, fontSize:10, width:18, height:18, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, flexShrink:0 }}>
                      {byCol[key].length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="sm:grid sm:grid-cols-3 gap-3 px-3 sm:px-4 py-3 sm:pb-4 flex-1 overflow-y-auto items-start">
            {COL_CONFIG.map(({ key }) => (
              <div key={key} className={`flex flex-col gap-3 ${key === mobileTab ? "flex" : "hidden sm:flex"}`}>
                {byCol[key].length === 0 && (
                  <div style={{ border:`1px dashed ${IL.bord}`, borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center", height:112 }}>
                    <span style={{ color:IL.mu, fontSize:13 }}>No orders</span>
                  </div>
                )}
                {byCol[key].map((card) => {
                  const order = card.order;

                  // ── ADD-ON pseudo-card ──────────────────────────────
                  // Lives in the "new" column. Renders ONLY the items that
                  // were added to an in-progress order. Cooks tap "Made ✓"
                  // when they're done — that flips alreadyMade=true on those
                  // rows and the card disappears.
                  if (card.kind === "addon") {
                    const addonAge = elapsed(order.createdAt, now);
                    const isMarking = advancing.has(order.id);
                    return (
                      <div
                        key={`addon-${order.id}`}
                        style={{ background:IL.card, borderRadius:16, overflow:"hidden", boxShadow:"0 4px 24px rgba(0,0,0,0.45),0 0 0 1px rgba(255,255,255,0.06)" }}
                      >
                        {/* Amber gradient header */}
                        <div style={{ position:"relative", overflow:"hidden", padding:"14px 16px", background:"linear-gradient(135deg,#f59e0b,#d97706)", display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
                          <div style={{ position:"absolute", inset:0, background:"linear-gradient(155deg,rgba(255,255,255,0.2) 0%,transparent 55%)", pointerEvents:"none" }} />
                          <div style={{ position:"relative" }}>
                            <div style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"2px 8px", borderRadius:6, background:"rgba(0,0,0,0.25)", marginBottom:6 }}>
                              <span style={{ fontSize:10, fontWeight:900, textTransform:"uppercase" as const, letterSpacing:".08em", color:"#fff" }}>➕ Add-on</span>
                            </div>
                            <div style={{ fontSize:22, fontWeight:900, color:"#fff", lineHeight:1.1 }}>{order.customerName}</div>
                            <div style={{ color:"rgba(255,255,255,0.75)", fontFamily:"monospace", fontSize:13, marginTop:2 }}>#{order.confirmationCode}</div>
                            <div style={{ color:"rgba(255,255,255,0.7)", fontSize:11, fontWeight:700, marginTop:2, textTransform:"uppercase" as const, letterSpacing:".06em" }}>Added to in-progress order</div>
                          </div>
                          <div style={{ position:"relative", textAlign:"right" as const, flexShrink:0 }}>
                            <div style={{ fontSize:13, fontWeight:700, color:"rgba(255,255,255,0.85)" }}>{addonAge}</div>
                            <div style={{ fontSize:11, color:"rgba(255,255,255,0.65)", marginTop:2, textTransform:"capitalize" as const }}>{order.orderType}</div>
                          </div>
                        </div>

                        {/* Items */}
                        <div style={{ padding:"12px 16px 0", display:"flex", flexDirection:"column" as const, gap:8 }}>
                          {card.items.map((item, itemIdx) => {
                            const struck = struckItems.get(order.id)?.has(item.id) ?? false;
                            const gi = itemIdx % ITEM_GRADS.length;
                            const gd = ITEM_GRADS[gi];
                            return (
                              <button
                                key={item.id}
                                onClick={() => toggleStruck(order.id, item.id)}
                                style={{ position:"relative", overflow:"hidden", width:"100%", textAlign:"left" as const, borderRadius:12, padding:"12px 14px", border:"none",
                                  background:gd.grad, cursor:"pointer", fontFamily:"inherit",
                                  opacity: struck ? 0.35 : 1, boxShadow: struck ? "none" : `0 3px 12px ${gd.glow}` }}
                              >
                                <div style={{ position:"absolute", inset:0, background:"linear-gradient(155deg,rgba(255,255,255,0.18) 0%,transparent 55%)", pointerEvents:"none" }} />
                                <div style={{ position:"relative" }}>
                                  <div className={`flex items-baseline gap-2 ${struck ? "line-through" : ""}`}>
                                    <span style={{ fontSize:28, fontWeight:900, color:"#fff", lineHeight:1 }}>{item.quantity}×</span>
                                    <span style={{ fontSize:20, fontWeight:700, color:"#fff", lineHeight:1.3 }}>{item.menuItemName}</span>
                                    {struck && <span style={{ fontSize:12, color:"rgba(255,255,255,0.7)", fontWeight:500 }}>done</span>}
                                  </div>
                                  {!struck && (item.modifierSelections ?? []).length > 0 && (
                                    <div style={{ color:"rgba(255,255,255,0.9)", fontSize:16, marginTop:8, lineHeight:1.5, fontWeight:600, display:"flex", flexDirection:"column" as const, gap:2 }}>
                                      {(item.modifierSelections ?? []).map((m, i) => (
                                        <div key={i}>+ {m.name}</div>
                                      ))}
                                    </div>
                                  )}
                                  {!struck && item.notes && (
                                    <div style={{ color:"rgba(255,255,255,0.9)", fontSize:16, marginTop:8, lineHeight:1.4, fontWeight:700, whiteSpace:"pre-line" as const }}>
                                      📝 {item.notes}
                                    </div>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {/* Made ✓ button */}
                        <div style={{ padding:16 }}>
                          <button
                            onClick={() => markItemsMade(order.id, card.items.map(i => i.id))}
                            disabled={isMarking}
                            style={{ width:"100%", height:48, borderRadius:12, background:"linear-gradient(135deg,#f59e0b,#d97706)", border:"none", color:"#fff", fontWeight:800, fontSize:15, cursor:"pointer", fontFamily:"inherit", opacity:isMarking?0.5:1, boxShadow:"0 4px 16px rgba(245,158,11,0.5)", position:"relative", overflow:"hidden" }}
                          >
                            <div style={{ position:"absolute", inset:0, background:"linear-gradient(155deg,rgba(255,255,255,0.2) 0%,transparent 55%)", pointerEvents:"none" }} />
                            <span style={{ position:"relative" }}>{isMarking ? "Saving…" : "Made ✓"}</span>
                          </button>
                        </div>
                      </div>
                    );
                  }

                  // ── FULL order card ─────────────────────────────────
                  const hiddenItemIds = card.hiddenItemIds;
                  const overdue = isOverdue(order.createdAt, now);
                  const age = elapsed(order.createdAt, now);
                  const isAdvancing = advancing.has(order.id);
                  const next = NEXT_STATUS[order.status];

                  // Uncollected: order has been "ready" for > 1 hour (and not dismissed)
                  const readySince = readyTimestampsRef.current.get(order.id);
                  const dismissedTs = dismissedUntil.get(order.id) ?? 0;
                  const isUncollected = order.status === "ready"
                    && readySince !== undefined
                    && (now - readySince) >= UNCOLLECTED_MS
                    && now > dismissedTs;
                  const uncollectedMins = readySince ? Math.floor((now - readySince) / 60000) : 0;

                  const isAlert = isUncollected || overdue;
                  const hdrGrad = isAlert ? "linear-gradient(135deg,#d4614a,#a03d2a)" : (STATUS_GRAD[order.status] ?? STATUS_GRAD.confirmed);
                  const cardGlow = isAlert ? "0 0 0 2px #d4614a,0 4px 24px rgba(212,97,74,0.35)"
                    : `0 4px 24px rgba(0,0,0,0.4),0 0 0 1px ${IL.bord}`;

                  // ── Collapsed view ───────────────────────────────────
                  const isCollapsed = collapsedOrders.has(order.id);
                  if (isCollapsed) {
                    const visibleItems = order.items.filter(
                      item => isKdsItem(item) && !(hiddenItemIds && hiddenItemIds.has(item.id))
                    );
                    const totalQty = visibleItems.reduce((s, i) => s + i.quantity, 0);
                    const scheduledStr = order.scheduledPickupAt ? (() => {
                      const msUntil = new Date(order.scheduledPickupAt).getTime() - now;
                      if (msUntil <= 0) return null;
                      const mins = Math.floor(msUntil / 60000);
                      return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
                    })() : null;
                    return (
                      <div key={order.id} style={{ background: isAlert ? "rgba(255,69,58,0.1)" : IL.card, borderRadius:16, overflow:"hidden", boxShadow:cardGlow }} className={isAlert ? "animate-pulse" : ""}>
                        <div style={{ height:3, background:hdrGrad, flexShrink:0 }} />
                        <div
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
                          onClick={() => toggleCollapsed(order.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <span style={{ fontSize:16, fontWeight:900, color:IL.tp }} className="leading-none truncate">{order.customerName}</span>
                              <span style={{ color:IL.mu, fontFamily:"monospace", fontSize:11 }} className="shrink-0">#{order.confirmationCode}</span>
                              <span style={{ fontSize:11, fontWeight:700, background:"rgba(255,255,255,0.08)", color:IL.tm, padding:"2px 8px", borderRadius:20 }} className="shrink-0">
                                {totalQty} item{totalQty !== 1 ? "s" : ""}
                              </span>
                              {scheduledStr && (
                                <span style={{ fontSize:11, fontWeight:800, background:"rgba(139,92,246,0.25)", color:"#c4b5fd", border:"1px solid rgba(139,92,246,0.4)", padding:"2px 8px", borderRadius:20 }} className="shrink-0">
                                  ⏰ {scheduledStr}
                                </span>
                              )}
                              {order.notes && (
                                <span style={{ fontSize:11, color:"#fbbf24", fontStyle:"italic" }} className="truncate max-w-[140px] shrink-0">
                                  "{order.notes.length > 40 ? order.notes.slice(0, 40) + "…" : order.notes}"
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {next && (
                              <button
                                onClick={e => { e.stopPropagation(); void advance(order); }}
                                disabled={isAdvancing}
                                style={{ position:"relative", overflow:"hidden", fontSize:11, fontWeight:800, padding:"6px 12px", borderRadius:10, border:"none", cursor:"pointer", fontFamily:"inherit",
                                  background: STATUS_GRAD[order.status] ?? STATUS_GRAD.confirmed, color:"#fff", opacity:isAdvancing?0.5:1 }}
                              >
                                <div style={{ position:"absolute", inset:0, background:"linear-gradient(155deg,rgba(255,255,255,0.2) 0%,transparent 55%)", pointerEvents:"none" }} />
                                <span style={{ position:"relative" }}>{isAdvancing ? "…" : NEXT_LABEL[order.status]}</span>
                              </button>
                            )}
                            <span style={{ color:IL.mu, fontSize:18 }}>▸</span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={order.id}
                      style={{ background: isAlert ? "rgba(255,69,58,0.08)" : IL.card, borderRadius:16, overflow:"hidden", boxShadow:cardGlow }}
                      className={isAlert ? "animate-pulse" : ""}
                    >
                      {/* Status gradient header */}
                      <div style={{ position:"relative", overflow:"hidden", padding:"14px 16px", background:hdrGrad, display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
                        <div style={{ position:"absolute", inset:0, background:"linear-gradient(155deg,rgba(255,255,255,0.18) 0%,transparent 55%)", pointerEvents:"none" }} />
                        <div style={{ position:"relative" }}>
                          <div style={{ fontSize:22, fontWeight:900, color:"#fff", lineHeight:1.1 }}>
                            {order.customerName}
                          </div>
                          <div style={{ color:"rgba(255,255,255,0.75)", fontFamily:"monospace", fontSize:13, marginTop:2 }}>
                            #{order.confirmationCode}
                          </div>
                          {hiddenItemIds && hiddenItemIds.size > 0 && (
                            <div style={{ display:"inline-flex", alignItems:"center", gap:4, marginTop:4, padding:"2px 8px", borderRadius:6, background:"rgba(0,0,0,0.25)" }}>
                              <span style={{ color:"rgba(255,255,255,0.9)", fontSize:11, fontWeight:700 }}>➕ Add-on in New column</span>
                            </div>
                          )}
                          {order.scheduledPickupAt && (() => {
                            const d = new Date(order.scheduledPickupAt);
                            const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Puerto_Rico" });
                            return (
                              <div style={{ display:"inline-flex", alignItems:"center", gap:4, marginTop:4, padding:"2px 8px", borderRadius:6, background:"rgba(139,92,246,0.4)" }}>
                                <span style={{ color:"#e9d5ff", fontSize:11, fontWeight:700 }}>⏰ Scheduled {timeStr}</span>
                              </div>
                            );
                          })()}
                          {!order.scheduledPickupAt && order.status === "confirmed" && (
                            <div style={{ color:"rgba(255,255,255,0.75)", fontSize:11, fontWeight:700, marginTop:4, textTransform:"uppercase" as const, letterSpacing:".06em" }}>Accepted</div>
                          )}
                          {order.status === "ready" && !isUncollected && (
                            <div style={{ color:"rgba(255,255,255,0.85)", fontSize:11, fontWeight:700, marginTop:4, textTransform:"uppercase" as const, letterSpacing:".06em" }}>Ready for pickup</div>
                          )}
                          {isUncollected && (
                            <div style={{ color:"rgba(255,255,255,0.95)", fontSize:11, fontWeight:900, marginTop:4, textTransform:"uppercase" as const, letterSpacing:".06em" }}>
                              ⚠️ Waiting {uncollectedMins >= 60 ? `${Math.floor(uncollectedMins / 60)}h ${uncollectedMins % 60}m` : `${uncollectedMins}m`} — call customer
                            </div>
                          )}
                        </div>
                        <div style={{ position:"relative", display:"flex", alignItems:"flex-start", gap:8, flexShrink:0 }}>
                          <div style={{ textAlign:"right" as const }}>
                            <div style={{ fontSize:13, fontWeight:700, color: overdue ? "#fca5a5" : "rgba(255,255,255,0.85)" }}>
                              {age}
                            </div>
                            <div style={{ fontSize:11, color:"rgba(255,255,255,0.65)", marginTop:2, textTransform:"capitalize" as const }}>{order.orderType}</div>
                          </div>
                          <button
                            onClick={() => toggleCollapsed(order.id)}
                            style={{ color:"rgba(255,255,255,0.7)", fontSize:18, lineHeight:1, padding:"0 4px 0", paddingTop:2, background:"none", border:"none", cursor:"pointer" }}
                            title="Collapse order"
                          >
                            ▾
                          </button>
                        </div>
                      </div>

                      {/* Item list */}
                      <div style={{ padding:"12px 16px 0", display:"flex", flexDirection:"column" as const, gap:8 }}>
                        {order.items
                          .filter(item => isKdsItem(item) && !(hiddenItemIds && hiddenItemIds.has(item.id)))
                          .map((item, itemIdx) => {
                          if (item.alreadyMade) {
                            return (
                              <div key={item.id} style={{ background:"rgba(45,106,79,0.12)", border:"1px solid rgba(45,106,79,0.25)", borderRadius:10, padding:"10px 14px" }}>
                                <div className="flex items-baseline gap-2">
                                  <span style={{ color:"#38bdf8", fontSize:15, fontWeight:700, flexShrink:0 }}>↻</span>
                                  <div className="flex items-baseline gap-2 flex-1">
                                    <span style={{ fontSize:16, fontWeight:700, color:"#7dd3fc", lineHeight:1 }}>{item.quantity}×</span>
                                    <span style={{ fontSize:14, fontWeight:600, color:"#7dd3fc", lineHeight:1.3 }}>{item.menuItemName}</span>
                                  </div>
                                  <span style={{ fontSize:10, textTransform:"uppercase" as const, letterSpacing:".06em", color:"#38bdf8", fontWeight:700, flexShrink:0 }}>already firing</span>
                                </div>
                                {(item.modifierSelections ?? []).length > 0 && (
                                  <div style={{ marginLeft:24, marginTop:4, display:"flex", flexDirection:"column" as const, gap:2 }}>
                                    {(item.modifierSelections ?? []).map((m, i) => (
                                      <div key={i} style={{ fontSize:13, color:"#38bdf8", fontWeight:500 }}>+ {m.name}</div>
                                    ))}
                                  </div>
                                )}
                                {item.notes && (
                                  <div style={{ marginLeft:24, marginTop:4, fontSize:13, color:"#38bdf8", fontWeight:500 }}>{item.notes}</div>
                                )}
                              </div>
                            );
                          }
                          const struck = struckItems.get(order.id)?.has(item.id) ?? false;
                          const gi = itemIdx % ITEM_GRADS.length;
                          const gd = ITEM_GRADS[gi];
                          return (
                            <button
                              key={item.id}
                              onClick={() => toggleStruck(order.id, item.id)}
                              style={{ position:"relative", overflow:"hidden", width:"100%", textAlign:"left" as const, borderRadius:12, padding:"12px 14px", border:"none",
                                background:gd.grad, cursor:"pointer", fontFamily:"inherit",
                                opacity: struck ? 0.35 : 1, boxShadow: struck ? "none" : `0 3px 12px ${gd.glow}` }}
                            >
                              <div style={{ position:"absolute", inset:0, background:"linear-gradient(155deg,rgba(255,255,255,0.18) 0%,transparent 55%)", pointerEvents:"none" }} />
                              <div style={{ position:"relative" }}>
                                <div className={`flex items-baseline gap-2 ${struck ? "line-through" : ""}`}>
                                  <span style={{ fontSize:28, fontWeight:900, color:"#fff", lineHeight:1 }}>{item.quantity}×</span>
                                  <span style={{ fontSize:20, fontWeight:700, color:"#fff", lineHeight:1.3 }}>{item.menuItemName}</span>
                                  {struck && <span style={{ fontSize:12, color:"rgba(255,255,255,0.7)", fontWeight:500 }}>done</span>}
                                </div>
                                {!struck && (item.modifierSelections ?? []).length > 0 && (
                                  <div style={{ color:"rgba(255,255,255,0.9)", fontSize:16, marginTop:8, lineHeight:1.5, fontWeight:600, display:"flex", flexDirection:"column" as const, gap:2 }}>
                                    {(item.modifierSelections ?? []).map((m, i) => (
                                      <div key={i}>+ {m.name}</div>
                                    ))}
                                  </div>
                                )}
                                {!struck && item.notes && (
                                  <div style={{ color:"rgba(255,255,255,0.9)", fontSize:16, marginTop:8, lineHeight:1.4, fontWeight:700, whiteSpace:"pre-line" as const }}>
                                    📝 {item.notes}
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Order notes */}
                      {order.notes && (
                        <div style={{ margin:"12px 16px 0", background:"rgba(251,191,36,0.12)", border:"1px solid rgba(251,191,36,0.3)", borderRadius:10, padding:"10px 14px", color:"#fbbf24", fontSize:14, lineHeight:1.5 }}>
                          📝 {order.notes}
                        </div>
                      )}

                      {/* Uncollected dismiss */}
                      {isUncollected && (
                        <div style={{ margin:"12px 16px 0", padding:"10px 14px", background:"rgba(255,69,58,0.12)", border:`1px solid ${IL.red}`, borderRadius:10 }}>
                          <button
                            onClick={() => setDismissedUntil(prev => {
                              const next = new Map(prev);
                              next.set(order.id, Date.now() + 30 * 60 * 1000);
                              return next;
                            })}
                            style={{ width:"100%", fontSize:11, padding:"6px", borderRadius:8, background:"rgba(255,69,58,0.2)", border:"1px solid rgba(255,69,58,0.3)", color:"#fca5a5", fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}
                          >
                            Remind me again in 30 min
                          </button>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div style={{ padding:16, display:"flex", flexDirection:"column" as const, gap:8 }}>
                        {next && (
                          <button
                            onClick={() => advance(order)}
                            disabled={isAdvancing}
                            style={{ width:"100%", height:48, borderRadius:12, border:"none", color:"#fff", fontWeight:800, fontSize:15, cursor:"pointer", fontFamily:"inherit",
                              background: STATUS_GRAD[order.status] ?? STATUS_GRAD.confirmed,
                              opacity:isAdvancing?0.5:1, position:"relative", overflow:"hidden",
                              boxShadow: `0 4px 18px ${STATUS_GLOW[order.status] ?? STATUS_GLOW.confirmed}` }}
                          >
                            <div style={{ position:"absolute", inset:0, background:"linear-gradient(155deg,rgba(255,255,255,0.2) 0%,transparent 55%)", pointerEvents:"none" }} />
                            <span style={{ position:"relative" }}>{isAdvancing ? "Updating…" : NEXT_LABEL[order.status]}</span>
                          </button>
                        )}
                        {!next && (
                          <div style={{ display:"flex", gap:8 }}>
                            <button
                              onClick={() => printTicket(order)}
                              disabled={printing.has(order.id)}
                              style={{ flex:1, height:40, borderRadius:12, border:"none", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit",
                                background:"linear-gradient(135deg,#2d6a4f,#0284c7)",
                                opacity:printing.has(order.id)?0.5:1, boxShadow:"0 3px 12px rgba(45,106,79,0.4)", position:"relative", overflow:"hidden" }}
                            >
                              <div style={{ position:"absolute", inset:0, background:"linear-gradient(155deg,rgba(255,255,255,0.18) 0%,transparent 55%)", pointerEvents:"none" }} />
                              <span style={{ position:"relative" }}>{printing.has(order.id) ? "Printing…" : "🖨 Print Ticket"}</span>
                            </button>
                            <button
                              onClick={() => clearFromKds(order)}
                              disabled={isAdvancing}
                              style={{ flex:1, height:40, borderRadius:12, background:"linear-gradient(135deg,#3d8f6a,#059669)", border:"none", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit",
                                opacity:isAdvancing?0.5:1, boxShadow:"0 3px 12px rgba(61,143,106,0.4)", position:"relative", overflow:"hidden" }}
                            >
                              <div style={{ position:"absolute", inset:0, background:"linear-gradient(155deg,rgba(255,255,255,0.18) 0%,transparent 55%)", pointerEvents:"none" }} />
                              <span style={{ position:"relative" }}>{isAdvancing ? "Clearing…" : "Done ✓ — Clear"}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12 }}>
          <div style={{ fontSize:56, fontWeight:900, color:IL.tp, letterSpacing:"-0.03em" }}>All Clear</div>
          <div style={{ color:IL.mu, fontSize:15 }}>No active orders · refreshing every 10s</div>
        </div>
      )}

      {/* ── History Drawer ── */}
      {historyOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex justify-end" onClick={() => setHistoryOpen(false)}>
          <div style={{ background:IL.hdr, width:"100%", maxWidth:384, height:"100%", display:"flex", flexDirection:"column", boxShadow:"0 0 60px rgba(0,0,0,0.7)" }} onClick={e => e.stopPropagation()}>
            <div style={{ position:"relative", overflow:"hidden", padding:"16px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", background:"linear-gradient(135deg,#2d6a4f,#1d4d38)", flexShrink:0 }}>
              <div style={{ position:"absolute", inset:0, background:"linear-gradient(155deg,rgba(255,255,255,0.18) 0%,transparent 55%)", pointerEvents:"none" }} />
              <h2 style={{ color:"#fff", fontSize:18, fontWeight:800, position:"relative" }}>🕐 Order History</h2>
              <button onClick={() => setHistoryOpen(false)} style={{ color:"rgba(255,255,255,0.75)", fontSize:26, background:"none", border:"none", cursor:"pointer", lineHeight:1, fontFamily:"inherit", position:"relative" }}>×</button>
            </div>
            <div style={{ flex:1, overflowY:"auto", padding:16, display:"flex", flexDirection:"column", gap:12 }}>
              {historyLoading && <p style={{ color:IL.mu, textAlign:"center", padding:"32px 0" }}>Loading…</p>}
              {!historyLoading && historyOrders.length === 0 && (
                <p style={{ color:IL.mu, textAlign:"center", padding:"32px 0" }}>No completed orders</p>
              )}
              {!historyLoading && historyOrders.map(o => (
                <div key={o.id} style={{ background:IL.card, borderRadius:14, padding:16, display:"flex", flexDirection:"column", gap:8, border:`1px solid ${IL.bord}` }}>
                  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8 }}>
                    <div>
                      <p style={{ color:IL.tp, fontWeight:700, fontSize:14, lineHeight:1.3 }}>{o.customerName}</p>
                      <p style={{ color:IL.mu, fontFamily:"monospace", fontSize:11, marginTop:2 }}>#{o.confirmationCode}</p>
                    </div>
                    <span style={{ color:IL.mu, fontSize:11 }}>{new Date(o.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                  </div>
                  <div style={{ color:IL.mu, fontSize:11 }}>
                    {o.items.map(i => `${i.quantity}× ${i.menuItemName}`).join(" · ")}
                  </div>
                  <button
                    disabled={recalling.has(o.id)}
                    onClick={() => recallOrder(o)}
                    style={{ width:"100%", height:36, borderRadius:10, border:"none", color:"#fff", fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"inherit",
                      background:"linear-gradient(135deg,#3d8f6a,#059669)",
                      opacity:recalling.has(o.id)?0.5:1, boxShadow:"0 2px 10px rgba(61,143,106,0.4)", position:"relative", overflow:"hidden" }}
                  >
                    <div style={{ position:"absolute", inset:0, background:"linear-gradient(155deg,rgba(255,255,255,0.18) 0%,transparent 55%)", pointerEvents:"none" }} />
                    <span style={{ position:"relative" }}>{recalling.has(o.id) ? "Recalling…" : "↩ Recall to Ready"}</span>
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

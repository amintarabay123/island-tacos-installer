import { useEffect, useState, useRef, useCallback } from "react";

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

function elapsed(createdAt: string): string {
  const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ${m % 60}m ago`;
}

function statusLabel(status: string): string {
  return { pending: "New", confirmed: "Confirmed", preparing: "Preparing", ready: "Ready" }[status] ?? status;
}

function nextStatus(status: string): string | null {
  const idx = STATUS_ORDER.indexOf(status);
  return idx >= 0 && idx < STATUS_ORDER.length - 1 ? STATUS_ORDER[idx + 1] : null;
}

function nextLabel(status: string): string {
  return { pending: "Accept", confirmed: "Start Cooking", preparing: "Mark Ready" }[status] ?? "Advance";
}

function statusColor(status: string) {
  return (
    {
      pending: "border-yellow-400 bg-yellow-950/60",
      confirmed: "border-blue-400 bg-blue-950/60",
      preparing: "border-orange-400 bg-orange-950/60",
      ready: "border-green-400 bg-green-950/60",
    }[status] ?? "border-zinc-600 bg-zinc-900"
  );
}

function statusBadge(status: string) {
  return (
    {
      pending: "bg-yellow-400 text-yellow-950",
      confirmed: "bg-blue-400 text-blue-950",
      preparing: "bg-orange-400 text-orange-950",
      ready: "bg-green-400 text-green-950",
    }[status] ?? "bg-zinc-600 text-white"
  );
}

function buttonColor(status: string) {
  return (
    {
      pending: "bg-yellow-400 hover:bg-yellow-300 text-yellow-950",
      confirmed: "bg-blue-400 hover:bg-blue-300 text-blue-950",
      preparing: "bg-green-400 hover:bg-green-300 text-green-950",
    }[status] ?? "bg-zinc-600 hover:bg-zinc-500 text-white"
  );
}

export default function Kitchen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [advancing, setAdvancing] = useState<Set<number>>(new Set());
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prevIdsRef = useRef<Set<number>>(new Set());
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playChime = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch {}
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders");
      if (!res.ok) throw new Error("Failed to fetch orders");
      const data: Order[] = await res.json();
      const active = data.filter((o) => ACTIVE_STATUSES.has(o.status));

      const newIds = new Set(active.map((o) => o.id));
      const hasNew = active.some((o) => !prevIdsRef.current.has(o.id));
      if (hasNew && prevIdsRef.current.size > 0) {
        playChime();
      }
      prevIdsRef.current = newIds;

      setOrders(active);
      setLastFetch(new Date());
      setError(null);
    } catch {
      setError("Connection error — retrying…");
    }
  }, [playChime]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10_000);
    return () => clearInterval(interval);
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

  const byStatus: Record<string, Order[]> = { pending: [], confirmed: [], preparing: [] };
  for (const o of orders) {
    if (byStatus[o.status]) byStatus[o.status].push(o);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col select-none">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold tracking-tight">Island Tacos</span>
          <span className="text-zinc-500 text-sm font-medium">Kitchen Display</span>
        </div>
        <div className="flex items-center gap-4">
          {error && (
            <span className="text-red-400 text-sm font-medium">{error}</span>
          )}
          {lastFetch && !error && (
            <span className="text-zinc-500 text-xs">Updated {lastFetch.toLocaleTimeString()}</span>
          )}
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-xs font-medium">Live</span>
          </div>
        </div>
      </header>

      {/* Column headers */}
      <div className="grid grid-cols-3 gap-4 px-4 pt-4 pb-2 shrink-0">
        {(["pending", "confirmed", "preparing"] as const).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${statusBadge(s)}`}>
              {statusLabel(s)}
            </span>
            <span className="text-zinc-500 text-sm">{byStatus[s].length} order{byStatus[s].length !== 1 ? "s" : ""}</span>
          </div>
        ))}
      </div>

      {/* Order grid */}
      <div className="grid grid-cols-3 gap-4 px-4 pb-6 flex-1 overflow-y-auto items-start">
        {(["pending", "confirmed", "preparing"] as const).map((col) => (
          <div key={col} className="flex flex-col gap-3">
            {byStatus[col].length === 0 && (
              <div className="border border-dashed border-zinc-800 rounded-xl flex items-center justify-center h-32">
                <span className="text-zinc-600 text-sm">No orders</span>
              </div>
            )}
            {byStatus[col].map((order) => {
              const next = nextStatus(order.status);
              const isAdvancing = advancing.has(order.id);
              return (
                <div
                  key={order.id}
                  className={`rounded-xl border-2 ${statusColor(order.status)} p-4 flex flex-col gap-3`}
                >
                  {/* Order header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-2xl font-black tracking-tight">{order.confirmationCode}</div>
                      <div className="text-zinc-300 font-medium text-sm mt-0.5">{order.customerName}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-zinc-400">{elapsed(order.createdAt)}</div>
                      <div className="text-xs text-zinc-500 mt-0.5 capitalize">{order.orderType}</div>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="flex flex-col gap-2">
                    {order.items.map((item) => (
                      <div key={item.id} className="bg-black/30 rounded-lg px-3 py-2">
                        <div className="flex items-baseline gap-2">
                          <span className="text-lg font-bold text-white leading-tight">{item.quantity}×</span>
                          <span className="text-base font-semibold text-white leading-tight">{item.menuItemName}</span>
                        </div>
                        {item.notes && (
                          <div className="text-yellow-300 text-sm mt-1 leading-snug whitespace-pre-line">
                            {item.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Order-level notes */}
                  {order.notes && (
                    <div className="text-yellow-200 text-sm bg-yellow-900/40 rounded-lg px-3 py-2 leading-snug">
                      {order.notes}
                    </div>
                  )}

                  {/* Advance button */}
                  {next && (
                    <button
                      onClick={() => advance(order)}
                      disabled={isAdvancing}
                      className={`w-full rounded-lg py-2.5 text-sm font-bold transition-all active:scale-95 ${buttonColor(order.status)} disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {isAdvancing ? "Updating…" : nextLabel(order.status)}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {orders.length === 0 && !error && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <div className="text-4xl font-black text-zinc-800">All clear</div>
          <div className="text-zinc-600 text-sm">No active orders right now</div>
        </div>
      )}
    </div>
  );
}

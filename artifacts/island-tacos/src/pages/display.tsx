import { useEffect, useState, useRef } from "react";
import { setPageMeta } from "@/lib/page-meta";

type DisplayItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  modifiers?: string[];
};

type DisplayState = {
  status: "idle" | "active" | "completed";
  items: DisplayItem[];
  subtotal: number;
  tax: number;
  total: number;
  discountAmount?: number;
  paymentMethod?: string;
  orderCode?: string;
  estimatedReadyAt?: string;
  athmovilPublicToken?: string;
  updatedAt: number;
};

const IDLE_TIMEOUT_MS = 90_000;
const RESET_AFTER_COMPLETE_MS = 12_000;
const POLL_MS = 1_500;

function formatPickupTime(eta?: string): string | null {
  if (!eta) return null;
  const d = new Date(eta);
  if (isNaN(d.getTime())) return null;
  const diffMin = Math.round((d.getTime() - Date.now()) / 60000);
  const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (diffMin <= 1) return "Just a moment";
  if (diffMin < 60) return `About ${diffMin} min — ready around ${timeStr}`;
  return `Ready around ${timeStr}`;
}

function formatPaymentMethod(method?: string): string {
  if (!method) return "";
  const map: Record<string, string> = {
    cash: "Cash",
    card: "Card",
    athmovil: "ATH Móvil",
    comp: "Complimentary",
  };
  return map[method] ?? method;
}

// Clock for idle screen
function LiveClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="text-white/40 text-6xl font-thin tabular-nums tracking-widest">
      {time.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
    </div>
  );
}

export default function CustomerDisplay() {
  const [state, setState] = useState<DisplayState>({
    status: "idle",
    items: [],
    subtotal: 0,
    tax: 0,
    total: 0,
    updatedAt: 0,
  });
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setPageMeta("Customer Display — Island Tacos", "🖥️", { iconUrl: "/icon-display-192.png" });
  }, []);

  // Poll the display state
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const r = await fetch("/api/display", { cache: "no-store" });
        if (!r.ok) return;
        const data: DisplayState = await r.json();
        if (!active) return;
        setState(prev => {
          if (data.updatedAt === prev.updatedAt) return prev;
          return data;
        });
      } catch {}
    };
    poll();
    const t = setInterval(poll, POLL_MS);
    return () => { active = false; clearInterval(t); };
  }, []);

  // Auto-reset completed screen back to idle after RESET_AFTER_COMPLETE_MS
  useEffect(() => {
    if (state.status === "completed") {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => {
        setState(s => s.status === "completed" ? { ...s, status: "idle" } : s);
      }, RESET_AFTER_COMPLETE_MS);
    }
    return () => { if (resetTimerRef.current) clearTimeout(resetTimerRef.current); };
  }, [state.status, state.updatedAt]);

  if (state.status === "idle") {
    return <IdleScreen />;
  }

  if (state.status === "completed") {
    return <CompletedScreen state={state} />;
  }

  return <ActiveScreen state={state} />;
}

// ─── Idle Screen ─────────────────────────────────────────────────────────────

function IdleScreen() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-8 select-none overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-yellow-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative flex flex-col items-center gap-6 text-center">
        <div className="text-8xl leading-none">🌮</div>

        <div className="space-y-2">
          <h1 className="text-4xl font-black text-white tracking-tight">
            Island Tacos
          </h1>
          <p className="text-zinc-400 text-lg font-medium">
            Road Town, Tortola · BVI
          </p>
        </div>

        <LiveClock />

        <p className="text-zinc-500 text-sm tracking-widest uppercase font-medium">
          Step up to order
        </p>
      </div>
    </div>
  );
}

// ─── ATH Móvil QR Payment Panel ──────────────────────────────────────────────

function AthMovilQr({
  total,
  orderCode,
}: {
  publicToken: string;
  total: number;
  subtotal: number;
  tax: number;
  orderCode?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-xs">
      {/* QR code card */}
      <img
        src="/athmovil-path-qr.jpg"
        alt="ATH Móvil QR — /islandtaco"
        className="w-56 rounded-2xl shadow-xl"
      />

      {/* Amount to enter */}
      <div className="text-center">
        <p className="text-zinc-500 text-xs uppercase tracking-widest mb-0.5">Scan &amp; enter this amount</p>
        <p className="text-[#F5A623] text-4xl font-black tabular-nums">${total.toFixed(2)}</p>
      </div>

      {/* Order code */}
      {orderCode && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2 text-center">
          <p className="text-zinc-500 text-xs mb-0.5">Note / message field</p>
          <p className="text-white font-mono font-bold text-sm tracking-widest">{orderCode}</p>
        </div>
      )}
    </div>
  );
}

// ─── Active Screen ────────────────────────────────────────────────────────────

function ActiveScreen({ state }: { state: DisplayState }) {
  // Coerce to number defensively — DB-sourced values may arrive as strings
  const n = (v: unknown) => parseFloat(String(v)) || 0;
  const subtotal = n(state.subtotal);
  const tax = n(state.tax);
  const total = n(state.total);
  const discount = n(state.discountAmount ?? 0);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col select-none overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-zinc-800/60 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🌮</span>
          <span className="text-white font-black text-xl tracking-tight">Island Tacos</span>
        </div>
        <div className="text-zinc-500 text-sm font-medium uppercase tracking-widest">Your Order</div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Items list */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-3">
          {state.items.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-zinc-600 text-lg">Adding items…</p>
            </div>
          ) : (
            state.items.map((item, i) => (
              <div key={i} className="flex items-start justify-between gap-4 py-3 border-b border-zinc-800/50 last:border-0">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-orange-400 font-black text-sm">{item.quantity}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-semibold text-lg leading-snug">{item.name}</p>
                    {(item.modifiers ?? []).length > 0 && (
                      <p className="text-yellow-400/80 text-sm mt-0.5">
                        + {item.modifiers!.join(", ")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-white font-semibold text-lg tabular-nums shrink-0">
                  ${(n(item.unitPrice) * item.quantity).toFixed(2)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totals panel */}
        <div className="w-72 shrink-0 flex flex-col border-l border-zinc-800/60 px-6 py-6 gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex justify-between text-zinc-400 text-base">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-green-400 text-base">
                <span>Discount</span>
                <span>−${discount.toFixed(2)}</span>
              </div>
            )}
            {tax > 0 && (
              <div className="flex justify-between text-zinc-400 text-base">
                <span>Tax</span>
                <span>${tax.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-zinc-700 pt-3 flex justify-between text-white font-black text-2xl">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          {state.paymentMethod === "athmovil" && state.athmovilPublicToken ? (
            <AthMovilQr
              publicToken={state.athmovilPublicToken}
              total={total}
              subtotal={subtotal}
              tax={tax}
              orderCode={state.orderCode}
            />
          ) : state.paymentMethod ? (
            <div className="bg-zinc-800/60 rounded-xl px-4 py-3 text-center">
              <p className="text-zinc-500 text-xs uppercase tracking-widest mb-1">Payment</p>
              <p className="text-white font-bold text-lg">{formatPaymentMethod(state.paymentMethod)}</p>
            </div>
          ) : null}

          <div className="text-center">
            <p className="text-zinc-600 text-xs uppercase tracking-widest">Thank you for your order</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Completed Screen ─────────────────────────────────────────────────────────

function CompletedScreen({ state }: { state: DisplayState }) {
  const pickupTime = formatPickupTime(state.estimatedReadyAt);
  const [countdown, setCountdown] = useState(Math.round(RESET_AFTER_COMPLETE_MS / 1000));

  useEffect(() => {
    const t = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-8 select-none text-center px-8">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-green-500/8 rounded-full blur-3xl" />
      </div>

      <div className="relative flex flex-col items-center gap-6">
        {/* Big check */}
        <div className="w-28 h-28 rounded-full bg-green-500/15 border-2 border-green-500/40 flex items-center justify-center">
          <svg className="w-14 h-14 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <div className="space-y-2">
          <h1 className="text-5xl font-black text-white">Thank you!</h1>
          <p className="text-zinc-400 text-xl">Your order has been placed.</p>
        </div>

        {state.orderCode && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl px-8 py-4">
            <p className="text-zinc-500 text-xs uppercase tracking-widest mb-1">Order code</p>
            <p className="text-4xl font-mono font-black text-orange-400 tracking-widest">{state.orderCode}</p>
          </div>
        )}

        {pickupTime && (
          <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-full px-6 py-3">
            <span className="text-amber-400 text-lg">⏱</span>
            <span className="text-amber-300 font-semibold text-lg">{pickupTime}</span>
          </div>
        )}

        <p className="text-zinc-700 text-sm">
          Returning to welcome screen in {countdown}s
        </p>
      </div>
    </div>
  );
}

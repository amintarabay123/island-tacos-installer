import { useEffect, useState, useRef } from "react";
import { RefreshCw } from "lucide-react";
import { setPageMeta } from "@/lib/page-meta";
import { useStoreSettings } from "@/lib/use-store-settings";

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

const RESET_AFTER_COMPLETE_MS = 12_000;

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

function LiveClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ fontSize: 64, fontWeight: 100, color: "rgba(0,0,0,0.25)", letterSpacing: "0.08em", fontVariantNumeric: "tabular-nums" }}>
      {time.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
    </div>
  );
}

// ─── Shared: Right promo panel ────────────────────────────────────────────────
function PromoPanel({ shade = "orange" }: { shade?: "orange" | "green" }) {
  const from = shade === "green" ? "#16a34a" : "#ea580c";
  const to   = shade === "green" ? "#065f46" : "#9a3412";
  return (
    <div style={{
      width: "42%", flexShrink: 0, position: "relative", overflow: "hidden",
      background: `linear-gradient(135deg, ${from}, ${to})`,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    }}>
      {/* Decorative circles */}
      <div style={{ position: "absolute", top: -80, right: -80, width: 280, height: 280, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
      <div style={{ position: "absolute", bottom: -80, left: -80, width: 220, height: 220, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 340, height: 340, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />

      <div style={{ position: "relative", textAlign: "center", padding: "0 40px", color: "#fff" }}>
        <div style={{ fontSize: 72, lineHeight: 1, marginBottom: 20 }}>🌮</div>
        <div style={{ fontSize: 15, fontWeight: 500, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>
          {shade === "green" ? "Come back soon!" : "Fresh & Authentic"}
        </div>
        <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic", fontWeight: 900, fontSize: 54, lineHeight: 1.1, color: "#fff", marginBottom: 16 }}>
          {shade === "green" ? "See you\nnext time!" : "Today's\nMenu"}
        </div>
        <div style={{ width: 60, height: 3, background: "rgba(255,255,255,0.4)", margin: "0 auto 16px" }} />
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>
          {shade === "green" ? "Road Town, Tortola · BVI" : "Made fresh daily in Road Town"}
        </div>
      </div>
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
  const { storeName, address } = useStoreSettings();
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setPageMeta(`Customer Display — ${storeName}`, "🖥️", { iconUrl: "/icon-display-192.png", manifestUrl: "/manifest-display.json" });
  }, [storeName]);

  useEffect(() => {
    // Poll the database-backed endpoint every 1 s.
    // SSE is unreliable through the Replit reverse proxy (buffering), so we use
    // plain HTTP polling which works through every proxy and across server instances.
    let active = true;
    let lastSeen = 0;

    const poll = async () => {
      if (!active) return;
      try {
        const r = await fetch("/api/display", { cache: "no-store" });
        if (!r.ok) return;
        const data = await r.json() as DisplayState;
        if (!active) return;
        if (data.updatedAt !== lastSeen) {
          lastSeen = data.updatedAt;
          setState(data);
        }
      } catch {}
    };

    poll(); // fire immediately on mount
    const interval = setInterval(poll, 1_000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (state.status === "completed") {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => {
        setState(s => s.status === "completed" ? { ...s, status: "idle" } : s);
      }, RESET_AFTER_COMPLETE_MS);
    }
    return () => { if (resetTimerRef.current) clearTimeout(resetTimerRef.current); };
  }, [state.status, state.updatedAt]);

  if (state.status === "idle")      return <IdleScreen />;
  if (state.status === "completed") return <CompletedScreen state={state} />;
  return <ActiveScreen state={state} />;
}

// ─── Idle Screen ─────────────────────────────────────────────────────────────

function IdleScreen() {
  return (
    <div style={{ height: "100vh", display: "flex", overflow: "hidden", userSelect: "none", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* LEFT: Branding */}
      <div style={{ flex: 1, background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: "0 64px" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 80, lineHeight: 1, marginBottom: 20 }}>🌮</div>
          <h1 style={{ fontSize: 52, fontWeight: 900, color: "#111827", margin: 0, lineHeight: 1.1, letterSpacing: "-0.02em" }}>{storeName}</h1>
          <p style={{ fontSize: 18, color: "#9ca3af", margin: "10px 0 0", fontWeight: 500 }}>{address || "Road Town, Tortola · BVI"}</p>
        </div>
        <LiveClock />
        <p style={{ fontSize: 12, color: "#d1d5db", letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 600, margin: 0 }}>
          Step up to order
        </p>
      </div>

      {/* RIGHT: Promo */}
      <PromoPanel shade="orange" />
    </div>
  );
}

// ─── ATH Móvil QR Payment Panel ──────────────────────────────────────────────

function AthMovilQr({ total, orderCode }: { publicToken: string; total: number; subtotal: number; tax: number; orderCode?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, width: "100%", padding: "0 32px" }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
        Pay with ATH Móvil
      </div>
      <img
        src="/athmovil-path-qr.jpg"
        alt="ATH Móvil QR — /islandtaco"
        style={{ width: 200, borderRadius: 20, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}
      />
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 6px" }}>Scan &amp; enter this amount</p>
        <p style={{ fontSize: 48, fontWeight: 900, color: "#F5A623", margin: 0, fontVariantNumeric: "tabular-nums" }}>${total.toFixed(2)}</p>
      </div>
      {orderCode && (
        <div style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 14, padding: "10px 24px", textAlign: "center" }}>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 4px" }}>Note / message field</p>
          <p style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 16, color: "#fff", letterSpacing: "0.15em", margin: 0 }}>{orderCode}</p>
        </div>
      )}
    </div>
  );
}

// ─── Active Screen ────────────────────────────────────────────────────────────

function ActiveScreen({ state }: { state: DisplayState }) {
  const n = (v: unknown) => parseFloat(String(v)) || 0;
  const subtotal = n(state.subtotal);
  const tax = n(state.tax);
  const total = n(state.total);
  const discount = n(state.discountAmount ?? 0);
  const isAth = state.paymentMethod === "athmovil" && state.athmovilPublicToken;

  const rowStyle: React.CSSProperties = {
    display: "flex", alignItems: "flex-start", justifyContent: "space-between",
    padding: "12px 0", borderBottom: "1px solid #f3f4f6", gap: 12,
  };

  return (
    <div style={{ height: "100vh", display: "flex", overflow: "hidden", userSelect: "none", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* LEFT: Receipt */}
      <div style={{ flex: 1, background: "#fff", display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 40px", borderBottom: "1px solid #e5e7eb", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>🌮</span>
            <span style={{ fontWeight: 900, fontSize: 20, color: "#111827", letterSpacing: "-0.01em" }}>{storeName}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: "#374151" }}>Your Order</span>
            {state.orderCode && (
              <span style={{ fontFamily: "monospace", fontSize: 13, color: "#9ca3af" }}>#{state.orderCode}</span>
            )}
            <button
              onClick={() => window.location.reload()}
              title="Reload Display"
              style={{ background: "none", border: "none", cursor: "pointer", color: "#d1d5db", padding: 4, display: "flex" }}
            >
              <RefreshCw style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>

        {/* Column labels */}
        {state.items.length > 0 && (
          <div style={{ display: "flex", padding: "8px 40px 4px", gap: 12, flexShrink: 0, borderBottom: "1px solid #f3f4f6" }}>
            <span style={{ width: 36, fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, flexShrink: 0 }}>Qty</span>
            <span style={{ flex: 1, fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>Item</span>
            <span style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>Price</span>
          </div>
        )}

        {/* Items */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 40px" }}>
          {state.items.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              <p style={{ color: "#9ca3af", fontSize: 18 }}>Adding items…</p>
            </div>
          ) : (
            state.items.map((item, i) => (
              <div key={i} style={rowStyle}>
                <span style={{ width: 36, color: "#6b7280", fontWeight: 700, fontSize: 16, flexShrink: 0, paddingTop: 2 }}>{item.quantity}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 17, fontWeight: 600, color: "#111827", lineHeight: 1.3 }}>{item.name}</p>
                  {(item.modifiers ?? []).length > 0 && (
                    <p style={{ margin: "3px 0 0", fontSize: 13, color: "#9ca3af" }}>{item.modifiers!.join(", ")}</p>
                  )}
                </div>
                <span style={{ fontSize: 17, fontWeight: 600, color: "#111827", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                  ${(n(item.unitPrice) * item.quantity).toFixed(2)}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Totals */}
        <div style={{ borderTop: "2px solid #e5e7eb", padding: "16px 40px 20px", flexShrink: 0, background: "#fafafa" }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "#6b7280", fontSize: 15, marginBottom: 8 }}>
            <span>Subtotal</span><span style={{ fontVariantNumeric: "tabular-nums" }}>${subtotal.toFixed(2)}</span>
          </div>
          {discount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", color: "#16a34a", fontSize: 15, marginBottom: 8 }}>
              <span>Discount</span><span style={{ fontVariantNumeric: "tabular-nums" }}>−${discount.toFixed(2)}</span>
            </div>
          )}
          {tax > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", color: "#6b7280", fontSize: 15, marginBottom: 8 }}>
              <span>Tax</span><span style={{ fontVariantNumeric: "tabular-nums" }}>${tax.toFixed(2)}</span>
            </div>
          )}
          {state.paymentMethod && state.paymentMethod !== "athmovil" && (
            <div style={{ display: "flex", justifyContent: "space-between", color: "#6b7280", fontSize: 15, marginBottom: 8 }}>
              <span>Payment</span><span>{formatPaymentMethod(state.paymentMethod)}</span>
            </div>
          )}
          <div style={{ borderTop: "2px solid #e5e7eb", marginTop: 8, paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: "#111827" }}>Total</span>
            <span style={{ fontSize: 32, fontWeight: 900, color: "#111827", fontVariantNumeric: "tabular-nums" }}>${total.toFixed(2)}</span>
          </div>
          <p style={{ textAlign: "center", fontSize: 12, color: "#d1d5db", marginTop: 12, marginBottom: 0, textTransform: "uppercase", letterSpacing: "0.12em" }}>
            Thank you for your order
          </p>
        </div>
      </div>

      {/* RIGHT: ATH QR or Promo */}
      {isAth ? (
        <div style={{
          width: "42%", flexShrink: 0, background: "linear-gradient(135deg, #1e293b, #0f172a)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <AthMovilQr
            publicToken={state.athmovilPublicToken!}
            total={total}
            subtotal={subtotal}
            tax={tax}
            orderCode={state.orderCode}
          />
        </div>
      ) : (
        <PromoPanel shade="orange" />
      )}
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
    <div style={{ height: "100vh", display: "flex", overflow: "hidden", userSelect: "none", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* LEFT: Confirmation */}
      <div style={{ flex: 1, background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28, padding: "0 64px", textAlign: "center" }}>
        {/* Check circle */}
        <div style={{ width: 100, height: 100, borderRadius: "50%", background: "#f0fdf4", border: "2px solid #86efac", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg style={{ width: 50, height: 50, color: "#16a34a" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <div>
          <h1 style={{ fontSize: 56, fontWeight: 900, color: "#111827", margin: "0 0 8px", letterSpacing: "-0.02em" }}>Thank you!</h1>
          <p style={{ fontSize: 20, color: "#6b7280", margin: 0 }}>Your order has been placed.</p>
        </div>

        {state.orderCode && (
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 20, padding: "16px 48px" }}>
            <p style={{ fontSize: 11, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.15em", margin: "0 0 6px", fontWeight: 600 }}>Order Code</p>
            <p style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 42, color: "#d97706", margin: 0, letterSpacing: "0.12em" }}>{state.orderCode}</p>
          </div>
        )}

        {pickupTime && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 999, padding: "12px 24px" }}>
            <span style={{ fontSize: 20 }}>⏱</span>
            <span style={{ color: "#92400e", fontWeight: 600, fontSize: 17 }}>{pickupTime}</span>
          </div>
        )}

        <p style={{ fontSize: 13, color: "#d1d5db", margin: 0 }}>Returning to welcome screen in {countdown}s</p>
      </div>

      {/* RIGHT: Green promo */}
      <PromoPanel shade="green" />
    </div>
  );
}

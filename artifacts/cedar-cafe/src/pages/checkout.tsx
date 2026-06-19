import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { useCart } from "@/lib/cart-context";
import { Layout } from "@/components/layout";
import { useCreateOrder } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { ShoppingBag, Loader2, XCircle, Clock, CalendarClock } from "lucide-react";
import { saveLastOrder, getCustomer, saveCustomer } from "@/lib/customer-account";
import { AthMovilDirectButton } from "@/components/athmovil-button";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── IL Palette ────────────────────────────────────────────────────────────────
const BG   = "#16172b";
const CARD = "#1e1f38";
const BORD = "rgba(255,255,255,0.06)";
const TP   = "#e8eaf6";
const TM   = "#b0b8d8";
const MU   = "#7077a1";
const OR   = "#ff6b00";
const PUR  = "#7c6af7";

const INP: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8, padding: "10px 14px", fontSize: 14, color: TP, outline: "none",
  width: "100%", boxSizing: "border-box", fontFamily: "inherit",
};
const LBL: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: TM, display: "block", marginBottom: 6 };
const SECTION: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 12 };
const H2: React.CSSProperties = { fontSize: 18, fontWeight: 700, color: TP, margin: 0 };

// Dark overrides for any remaining shadcn components
const DARK_CSS = `
  [data-slot="select-trigger"] {
    background: rgba(255,255,255,0.04) !important;
    border: 1px solid rgba(255,255,255,0.1) !important;
    color: ${TP} !important;
    border-radius: 8px !important;
  }
  [data-slot="select-content"] {
    background: ${CARD} !important;
    border: 1px solid rgba(255,255,255,0.1) !important;
    color: ${TP} !important;
  }
  [data-slot="select-item"]:hover, [data-slot="select-item"][data-highlighted] {
    background: rgba(255,255,255,0.06) !important;
    color: ${TP} !important;
  }
  [data-slot="select-item"] { color: ${TM} !important; }
`;

type AthState = {
  orderId: number;
  code: string;
  total: number;
  phone: string;
  status: "waiting" | "ready" | "cancelled";
};

export default function Checkout() {
  const { items, total, clearCart } = useCart();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [customerName,  setCustomerName]  = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const NAME_RE  = /^[\p{L}\p{M}'\- ]+$/u;
  // Simple structural email check — must have @, a domain, and a TLD.
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [enabledMethods, setEnabledMethods] = useState<string[]>(["cash"]);
  const [athState, setAthState] = useState<AthState | null>(null);
  const [storeOpen, setStoreOpen] = useState(true);
  const [openToday, setOpenToday] = useState(true);
  const [storeOpenTime, setStoreOpenTime] = useState("11:00 AM");
  const [storeCloseOrdersAt, setStoreCloseOrdersAt] = useState("6:45 PM");
  const [rawCloseTime, setRawCloseTime] = useState("19:00");
  const [closedTodayReason, setClosedTodayReason] = useState<string | null>(null);
  const [pickupMode, setPickupMode] = useState<"asap" | "scheduled">("asap");
  const [scheduledTime, setScheduledTime] = useState<string>("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const createOrder = useCreateOrder();

  // Generate available pickup time slots for today (30-min minimum, 15-min increments, before close)
  const pickupSlots = useMemo(() => {
    const bviNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Puerto_Rico" }));
    const minMins = bviNow.getHours() * 60 + bviNow.getMinutes() + 30;
    const firstSlot = Math.ceil(minMins / 15) * 15;
    const [closeH, closeM] = rawCloseTime.split(":").map(Number);
    const maxMins = closeH * 60 + closeM;
    const year = bviNow.getFullYear();
    const month = String(bviNow.getMonth() + 1).padStart(2, "0");
    const day = String(bviNow.getDate()).padStart(2, "0");
    const slots: { label: string; isoStr: string }[] = [];
    for (let mins = firstSlot; mins < maxMins; mins += 15) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      const ampm = h >= 12 ? "PM" : "AM";
      const label = `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
      const isoStr = `${year}-${month}-${day}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00-04:00`;
      slots.push({ label, isoStr });
    }
    return slots;
  }, [rawCloseTime]);

  // Pre-fill from saved profile (shared with track page)
  useEffect(() => {
    const profile = getCustomer();
    if (profile?.name) setCustomerName(profile.name);
    if (profile?.phone) setCustomerPhone(profile.phone);
  }, []);

  // Fetch which payment methods and store hours are enabled in admin settings
  useEffect(() => {
    fetch(`${basePath}/api/settings`)
      .then(r => r.json())
      .then((data: Record<string, string>) => {
        try {
          const methods: string[] = JSON.parse(data.online_payment_methods ?? '["cash"]');
          if (methods.length > 0) {
            setEnabledMethods(methods);
            if (!methods.includes(paymentMethod)) setPaymentMethod(methods[0]);
          }
        } catch { /* keep defaults */ }
        const fmt = (hhmm: string) => {
          const [h, m] = hhmm.split(":").map(Number);
          const ampm = h >= 12 ? "PM" : "AM";
          return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
        };
        setStoreOpen(data.is_open !== "false");
        setOpenToday(data.open_today !== "false");
        setClosedTodayReason(data.closed_today_reason ?? null);
        setStoreOpenTime(fmt(data.open_time ?? "11:00"));
        setStoreCloseOrdersAt(fmt(data.closes_orders_at ?? "18:45"));
        setRawCloseTime(data.close_time ?? "19:00");
      })
      .catch(() => {});
  }, []);

  // Poll for order acceptance when in "waiting" state
  useEffect(() => {
    if (!athState || athState.status !== "waiting") {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    const check = async () => {
      try {
        const res = await fetch(`${basePath}/api/orders/track/${athState.code}`);
        if (!res.ok) return;
        const data = await res.json() as { status?: string };
        if (data.status === "cancelled") {
          setAthState(prev => prev ? { ...prev, status: "cancelled" } : null);
        } else if (data.status && data.status !== "pending") {
          setAthState(prev => prev ? { ...prev, status: "ready" } : null);
        }
      } catch { /* ignore, retry next tick */ }
    };
    pollRef.current = setInterval(check, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [athState]);

  // ATH Móvil waiting state
  if (athState) {
    if (athState.status === "cancelled") {
      return (
        <Layout>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 16px" }}>
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 16, alignItems: "center", maxWidth: 360 }}>
              <div style={{ width: 64, height: 64, borderRadius: 999, background: "rgba(255,69,58,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <XCircle style={{ width: 32, height: 32, color: "#ff453a" }} />
              </div>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: TP }}>Order Cancelled</h2>
                <p style={{ color: MU, fontSize: 14, marginTop: 6 }}>Your order was not accepted. Please try again.</p>
              </div>
              <button
                onClick={() => { setAthState(null); }}
                style={{ padding: "12px 32px", borderRadius: 999, background: `linear-gradient(135deg,${OR},#ff3d00)`, color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", boxShadow: "0 4px 16px rgba(255,107,0,0.4)" }}
              >
                Try Again
              </button>
            </div>
          </div>
        </Layout>
      );
    }
    if (athState.status === "ready") {
      setLocation(`/track?code=${athState.code}`);
      return null;
    }
    // waiting
    return (
      <Layout>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 16px" }}>
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 20, alignItems: "center", maxWidth: 360, width: "100%" }}>
            <div style={{
              background: "linear-gradient(145deg,#7c6af7,#5b4cf5,#3730a3)", borderRadius: 20,
              boxShadow: "0 8px 32px rgba(124,106,247,0.5)", padding: 28, width: "100%",
              position: "relative", overflow: "hidden",
            }}>
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(155deg,rgba(255,255,255,0.18) 0%,transparent 55%)", pointerEvents: "none" }} />
              <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📱</div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "#fff", margin: "0 0 8px" }}>Complete Payment</h2>
                <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, margin: 0 }}>
                  Open your ATH Móvil app and approve the payment of
                </p>
                <p style={{ color: "#fff", fontSize: 28, fontWeight: 900, margin: "8px 0 0", letterSpacing: "-0.02em" }}>${athState.total.toFixed(2)}</p>
              </div>
            </div>
            <AthMovilDirectButton
              orderId={athState.orderId}
              total={athState.total}
              confirmationCode={athState.code}
              customerPhone={athState.phone}
              onCompleted={() => setAthState(prev => prev ? { ...prev, status: "ready" } : null)}
            />
            <button
              onClick={() => setAthState(null)}
              style={{ background: "none", border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 999, color: MU, fontSize: 13, fontWeight: 500, padding: "8px 20px", cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  if (items.length === 0) {
    return (
      <Layout>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 16px" }}>
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: 999, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ShoppingBag style={{ width: 32, height: 32, color: MU }} />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: TP }}>Your cart is empty</h2>
            <p style={{ color: MU, fontSize: 14 }}>Add some items before checking out.</p>
            <button
              onClick={() => setLocation("/")}
              style={{ padding: "12px 32px", borderRadius: 999, background: `linear-gradient(135deg,${OR},#ff3d00)`, color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", boxShadow: "0 4px 16px rgba(255,107,0,0.4)" }}
            >
              Browse Menu
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      toast({ title: "Please enter your name", variant: "destructive" });
      return;
    }
    if (!NAME_RE.test(customerName.trim())) {
      toast({ title: "Name must contain only letters, spaces, or hyphens — no numbers or symbols", variant: "destructive" });
      return;
    }
    if (customerEmail.trim() && !EMAIL_RE.test(customerEmail.trim())) {
      toast({ title: "Please enter a valid email address", variant: "destructive" });
      return;
    }
    if (!customerPhone.trim()) {
      toast({ title: "Please enter your phone number", variant: "destructive" });
      return;
    }
    if (pickupMode === "scheduled" && !scheduledTime) {
      toast({ title: "Please select a pickup time", variant: "destructive" });
      return;
    }

    // Remember for next time (shared with track page)
    saveCustomer({ name: customerName.trim(), phone: customerPhone.trim(), email: customerEmail.trim() });

    createOrder.mutate(
      {
        data: {
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim() || null,
          customerPhone: customerPhone.trim(),
          orderType: "pickup",
          deliveryAddress: null,
          paymentMethod: paymentMethod as "cash" | "card" | "athmovil",
          notes: notes || null,
          scheduledPickupAt: pickupMode === "scheduled" ? scheduledTime : null,
          items: items.map((i) => ({
            menuItemId: i.menuItem.id,
            quantity: i.quantity,
            notes: i.notes || null,
            modifierSelections: i.modifierSelections,
          })),
        },
      },
      {
        onSuccess: async (order) => {
          saveLastOrder(order.confirmationCode);
          clearCart();
          if (paymentMethod === "athmovil") {
            setAthState({
              orderId: order.id,
              code: order.confirmationCode,
              total,
              phone: customerPhone.trim(),
              status: "waiting",
            });
          } else {
            setLocation(`/track?code=${order.confirmationCode}`);
          }
        },
        onError: (err: unknown) => {
          const msg = (err as { data?: { error?: string } })?.data?.error ?? "Failed to place order. Please try again.";
          toast({ title: msg, variant: "destructive" });
        },
      }
    );
  };

  const methodInfo: Record<string, { label: string; description: string; icon: string }> = {
    cash:      { label: "Pay at Counter",  description: "Cash or card — pay when you pick up your order", icon: "$" },
    athmovil:  { label: "ATH Móvil",       description: "Pay now with ATH Móvil before pickup",           icon: "A" },
    card:      { label: "Credit/Debit Card", description: "Pay by card when you pick up your order", icon: "💳" },
  };

  return (
    <Layout>
      <style>{DARK_CSS}</style>
      <div style={{ flex: 1, padding: "32px 0 48px" }}>
        <div style={{ maxWidth: 896, margin: "0 auto", padding: "0 16px" }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: TP, marginBottom: 32 }}>Checkout</h1>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 32 }} className="md:grid-cols-3-checkout">
            <div style={{ display: "contents" }}>
              {/* ── Left: Form (2/3 width on md) ── */}
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 32 }} className="md:col-span-2">

                {/* Contact info */}
                <section style={SECTION}>
                  <h2 style={H2}>Your Info</h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <label htmlFor="name" style={LBL}>Name *</label>
                      <input
                        id="name" type="text" placeholder="First name is fine"
                        value={customerName} onChange={e => setCustomerName(e.target.value)}
                        autoComplete="given-name" required style={INP}
                        onFocus={e => { e.currentTarget.style.borderColor = PUR; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(124,106,247,0.15)`; }}
                        onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none"; }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <label htmlFor="email" style={LBL}>Email <span style={{ color: MU, fontWeight: 400 }}>(optional)</span></label>
                      <input
                        id="email" type="email" placeholder="you@example.com"
                        value={customerEmail} onChange={e => setCustomerEmail(e.target.value)}
                        autoComplete="email" style={INP}
                        onFocus={e => { e.currentTarget.style.borderColor = PUR; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(124,106,247,0.15)`; }}
                        onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none"; }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <label htmlFor="phone" style={LBL}>Phone Number *</label>
                      <input
                        id="phone" type="tel" placeholder="284-000-0000"
                        value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
                        autoComplete="tel" required style={INP}
                        onFocus={e => { e.currentTarget.style.borderColor = PUR; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(124,106,247,0.15)`; }}
                        onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none"; }}
                      />
                      <p style={{ fontSize: 12, color: MU, margin: 0 }}>Use a WhatsApp number to get order updates &amp; track your order via chat.</p>
                    </div>
                  </div>
                </section>

                <div style={{ height: 1, background: BORD }} />

                {/* Pickup Time */}
                <section style={SECTION}>
                  <h2 style={H2}>Pickup Time</h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      { value: "asap",      icon: <Clock style={{ width: 20, height: 20 }} />,        label: "As soon as possible",    desc: "Ready in about 20–30 min" },
                      { value: "scheduled", icon: <CalendarClock style={{ width: 20, height: 20 }} />, label: "Schedule a pickup time", desc: `Choose any time today before ${storeCloseOrdersAt}` },
                    ].map(opt => {
                      const selected = pickupMode === opt.value;
                      return (
                        <button
                          key={opt.value} type="button"
                          onClick={() => setPickupMode(opt.value as "asap" | "scheduled")}
                          style={{
                            width: "100%", display: "flex", alignItems: "center", gap: 16,
                            borderRadius: 14, border: selected ? `2px solid ${PUR}` : "2px solid rgba(255,255,255,0.08)",
                            padding: 16, textAlign: "left",
                            background: selected ? "rgba(124,106,247,0.08)" : "rgba(255,255,255,0.02)",
                            cursor: "pointer", transition: "all 0.15s",
                          }}
                        >
                          <div style={{
                            width: 36, height: 36, borderRadius: 999, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                            background: selected ? "rgba(124,106,247,0.15)" : "rgba(255,255,255,0.06)",
                            color: selected ? PUR : MU,
                          }}>
                            {opt.icon}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 600, color: TP, margin: 0, fontSize: 14 }}>{opt.label}</p>
                            <p style={{ fontSize: 13, color: MU, margin: 0 }}>{opt.desc}</p>
                          </div>
                          <div style={{
                            width: 20, height: 20, borderRadius: 999, border: selected ? `2px solid ${PUR}` : "2px solid rgba(255,255,255,0.2)",
                            flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                            background: selected ? PUR : "transparent", transition: "all 0.15s",
                          }}>
                            {selected && <div style={{ width: 8, height: 8, borderRadius: 999, background: "#fff" }} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {pickupMode === "scheduled" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <label style={LBL}>Select a pickup time</label>
                      {pickupSlots.length === 0 ? (
                        <p style={{ fontSize: 14, color: "#ff453a" }}>No available time slots today — we're closing soon.</p>
                      ) : (
                        <select
                          value={scheduledTime} onChange={e => setScheduledTime(e.target.value)}
                          style={{ ...INP, height: 44 }}
                        >
                          <option value="">Choose a time…</option>
                          {pickupSlots.map(slot => (
                            <option key={slot.isoStr} value={slot.isoStr}>{slot.label}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </section>

                <div style={{ height: 1, background: BORD }} />

                {/* Payment */}
                <section style={SECTION}>
                  <h2 style={H2}>Payment</h2>
                  {enabledMethods.length === 1 && enabledMethods[0] === "cash" ? (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 16,
                      borderRadius: 14, border: `2px solid ${OR}`, padding: 16,
                      background: "rgba(255,107,0,0.08)",
                    }}>
                      <div style={{ width: 36, height: 36, borderRadius: 999, background: "rgba(255,107,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 900, fontSize: 18, color: OR }}>$</div>
                      <div>
                        <p style={{ fontWeight: 600, color: TP, margin: 0, fontSize: 14 }}>Pay at Counter</p>
                        <p style={{ fontSize: 13, color: MU, margin: 0 }}>Cash or card — pay when you pick up your order</p>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {enabledMethods.map(m => {
                        const meta = methodInfo[m] ?? { label: m, description: "", icon: "$" };
                        const selected = paymentMethod === m;
                        return (
                          <button
                            key={m} type="button" onClick={() => setPaymentMethod(m)}
                            style={{
                              width: "100%", display: "flex", alignItems: "center", gap: 16,
                              borderRadius: 14, border: selected ? `2px solid ${OR}` : "2px solid rgba(255,255,255,0.08)",
                              padding: 16, textAlign: "left",
                              background: selected ? "rgba(255,107,0,0.08)" : "rgba(255,255,255,0.02)",
                              cursor: "pointer", transition: "all 0.15s",
                            }}
                          >
                            <div style={{
                              width: 36, height: 36, borderRadius: 999, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                              background: selected ? "rgba(255,107,0,0.15)" : "rgba(255,255,255,0.06)",
                              color: selected ? OR : MU, fontWeight: 900, fontSize: 18,
                            }}>
                              {meta.icon}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontWeight: 600, color: TP, margin: 0, fontSize: 14 }}>{meta.label}</p>
                              <p style={{ fontSize: 13, color: MU, margin: 0 }}>{meta.description}</p>
                            </div>
                            <div style={{
                              width: 20, height: 20, borderRadius: 999, border: selected ? `2px solid ${OR}` : "2px solid rgba(255,255,255,0.2)",
                              flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                              background: selected ? OR : "transparent", transition: "all 0.15s",
                            }}>
                              {selected && <div style={{ width: 8, height: 8, borderRadius: 999, background: "#fff" }} />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>

                <div style={{ height: 1, background: BORD }} />

                {/* Notes */}
                <section style={SECTION}>
                  <label htmlFor="notes" style={{ ...LBL, marginBottom: 0 }}>Order Notes (optional)</label>
                  <textarea
                    id="notes" rows={3}
                    placeholder="Any special instructions for your order..."
                    value={notes} onChange={e => setNotes(e.target.value)}
                    style={{ ...INP, resize: "vertical", minHeight: 80 }}
                    onFocus={e => { e.currentTarget.style.borderColor = PUR; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(124,106,247,0.15)`; }}
                    onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none"; }}
                  />
                </section>

                {!storeOpen && (
                  <div style={{ borderRadius: 14, background: "rgba(255,214,0,0.08)", border: "1px solid rgba(255,214,0,0.2)", padding: "14px 18px", textAlign: "center" }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#ffd60a", margin: 0 }}>
                      {!openToday ? (closedTodayReason ?? "We're closed today") : "Online ordering is closed right now"}
                    </p>
                    <p style={{ fontSize: 12, color: "#b0a060", marginTop: 6 }}>
                      {!openToday
                        ? "We only accept orders on open days — check back then!"
                        : `We're open ${storeOpenTime} – ${storeCloseOrdersAt} AST · Last orders are 15 min before closing`}
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={createOrder.isPending || !storeOpen}
                  style={{
                    width: "100%", height: 56, fontSize: 16, fontWeight: 700, borderRadius: 999, border: "none",
                    background: (!storeOpen || createOrder.isPending) ? "rgba(255,255,255,0.06)" : `linear-gradient(135deg,${OR},#ff3d00)`,
                    boxShadow: (!storeOpen || createOrder.isPending) ? "none" : "0 4px 20px rgba(255,107,0,0.45)",
                    color: (!storeOpen || createOrder.isPending) ? MU : "#fff",
                    cursor: (!storeOpen || createOrder.isPending) ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    transition: "opacity 0.15s",
                  }}
                >
                  {createOrder.isPending ? (
                    <><Loader2 style={{ width: 18, height: 18, animation: "spin 1s linear infinite" }} /> Placing Order…</>
                  ) : (
                    `Place Order — $${total.toFixed(2)}`
                  )}
                </button>
              </form>

              {/* ── Right: Order Summary ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <h2 style={H2}>Order Summary</h2>
                <div style={{
                  background: CARD, borderRadius: 16, border: `1px solid ${BORD}`,
                  padding: 16, display: "flex", flexDirection: "column", gap: 12,
                  boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
                  position: "relative", overflow: "hidden",
                }}>
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(155deg,rgba(255,255,255,0.04) 0%,transparent 55%)", pointerEvents: "none" }} />
                  <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                    {items.map((item, idx) => (
                      <div key={`${item.menuItem.id}-${idx}`} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, gap: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <span style={{ color: TM }}>{item.quantity}x {item.menuItem.name}</span>
                          {(item.modifierSelections ?? []).length > 0 && (
                            <p style={{ fontSize: 12, color: MU, margin: "2px 0 0" }}>{item.modifierSelections!.map(m => m.name).join(", ")}</p>
                          )}
                          {item.notes && <p style={{ fontSize: 12, color: MU, margin: "2px 0 0", fontStyle: "italic" }}>{item.notes}</p>}
                        </div>
                        <span style={{ flexShrink: 0, color: TP, fontWeight: 600 }}>
                          ${((item.menuItem.price + (item.modifierSelections ?? []).reduce((s, m) => s + m.price, 0)) * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                    <div style={{ height: 1, background: BORD }} />
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 18, color: TP }}>
                      <span>Total</span>
                      <span>${total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @media (min-width: 768px) {
          .md\\:grid-cols-3-checkout { grid-template-columns: 1fr; }
          .md\\:grid-cols-3-checkout > div { display: grid; grid-template-columns: 2fr 1fr; gap: 32px; }
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        select option { background: ${CARD}; color: ${TP}; }
      `}</style>
    </Layout>
  );
}

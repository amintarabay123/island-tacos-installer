import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { useCart } from "@/lib/cart-context";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateOrder } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { ShoppingBag, Loader2, XCircle, Clock, CalendarClock } from "lucide-react";
import { saveLastOrder, getCustomer, saveCustomer } from "@/lib/customer-account";
import { AthMovilDirectButton } from "@/components/athmovil-button";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

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

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
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
    check();
    pollRef.current = setInterval(check, 5_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [athState?.status, athState?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  const createOrder = useCreateOrder();

  // ── ATH Móvil screens ──
  if (athState) {
    if (athState.status === "cancelled") {
      return (
        <Layout>
          <div className="flex-1 flex items-center justify-center py-20">
            <div className="text-center space-y-4 max-w-sm mx-auto px-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="h-9 w-9 text-red-500" />
              </div>
              <h1 className="text-2xl font-black">Order not accepted</h1>
              <p className="text-muted-foreground">
                The restaurant couldn't take your order right now. No payment was collected.
              </p>
              <Button onClick={() => setLocation("/")} className="w-full">Back to Menu</Button>
            </div>
          </div>
        </Layout>
      );
    }

    if (athState.status === "waiting") {
      return (
        <Layout>
          <div className="flex-1 flex items-center justify-center py-20">
            <div className="text-center space-y-5 max-w-sm mx-auto px-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center">
                <Loader2 className="h-9 w-9 text-orange-500 animate-spin" />
              </div>
              <h1 className="text-2xl font-black">Order placed!</h1>
              <p className="text-muted-foreground">
                {/* TODO(store-settings): interpolate useStoreSettings().storeName */}
                Waiting for Island Tacos to accept your order before we collect payment.
                <br /><span className="text-sm">This usually takes under a minute.</span>
              </p>
              <p className="text-xs font-mono bg-muted rounded-lg px-3 py-2 inline-block">
                Order #{athState.code}
              </p>
            </div>
          </div>
        </Layout>
      );
    }

    return (
      <Layout>
        <div className="flex-1 py-8 md:py-12">
          <div className="container mx-auto px-4 max-w-md">
            <div className="text-center mb-6">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-3xl mb-3">✅</div>
              <h1 className="text-2xl font-black">Order accepted!</h1>
              <p className="text-muted-foreground mt-1">
                Complete your ATH Móvil payment to confirm — your order is held for <strong>10 minutes</strong>.
              </p>
            </div>
            <AthMovilDirectButton
              orderId={athState.orderId}
              total={athState.total}
              confirmationCode={athState.code}
              customerPhone={athState.phone}
              onCompleted={() => setLocation(`/track?code=${athState!.code}`)}
            />
          </div>
        </div>
      </Layout>
    );
  }

  // Empty cart guard
  if (items.length === 0) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <ShoppingBag className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold">Your cart is empty</h2>
            <p className="text-muted-foreground">Add some items before checking out.</p>
            <Button onClick={() => setLocation("/")}>Browse Menu</Button>
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
    if (!customerPhone.trim()) {
      toast({ title: "Please enter your phone number", variant: "destructive" });
      return;
    }
    if (pickupMode === "scheduled" && !scheduledTime) {
      toast({ title: "Please select a pickup time", variant: "destructive" });
      return;
    }

    // Remember for next time (shared with track page)
    saveCustomer({ name: customerName.trim(), phone: customerPhone.trim(), email: "" });

    createOrder.mutate(
      {
        data: {
          customerName: customerName.trim(),
          customerEmail: "",
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

  return (
    <Layout>
      <div className="flex-1 py-8 md:py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-3xl font-black mb-8">Checkout</h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <form onSubmit={handleSubmit} className="md:col-span-2 space-y-8">

              {/* Contact info */}
              <section className="space-y-4">
                <h2 className="text-xl font-bold">Your Info</h2>
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="First name is fine"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    autoComplete="given-name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="284-000-0000"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    autoComplete="tel"
                    required
                  />
                  <p className="text-xs text-muted-foreground">We'll text this number when your order is ready.</p>
                </div>
              </section>

              <Separator />

              {/* Pickup Time */}
              <section className="space-y-3">
                <h2 className="text-xl font-bold">Pickup Time</h2>
                <div className="space-y-2">
                  {[
                    { value: "asap", icon: <Clock className="h-5 w-5" />, label: "As soon as possible", desc: "Ready in about 20–30 min" },
                    { value: "scheduled", icon: <CalendarClock className="h-5 w-5" />, label: "Schedule a pickup time", desc: `Choose any time today before ${storeCloseOrdersAt}` },
                  ].map(opt => {
                    const selected = pickupMode === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPickupMode(opt.value as "asap" | "scheduled")}
                        className={`w-full flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-colors ${
                          selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                        }`}
                      >
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                          selected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                        }`}>
                          {opt.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold">{opt.label}</p>
                          <p className="text-sm text-muted-foreground">{opt.desc}</p>
                        </div>
                        <div className={`h-5 w-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                          selected ? "border-primary bg-primary" : "border-muted-foreground/40"
                        }`}>
                          {selected && <div className="h-2 w-2 rounded-full bg-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {pickupMode === "scheduled" && (
                  <div className="space-y-2 pt-1">
                    <Label>Select a pickup time</Label>
                    {pickupSlots.length === 0 ? (
                      <p className="text-sm text-destructive">No available time slots today — we're closing soon.</p>
                    ) : (
                      <Select value={scheduledTime} onValueChange={setScheduledTime}>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Choose a time…" />
                        </SelectTrigger>
                        <SelectContent>
                          {pickupSlots.map(slot => (
                            <SelectItem key={slot.isoStr} value={slot.isoStr}>{slot.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
              </section>

              <Separator />

              {/* Payment */}
              <section className="space-y-3">
                <h2 className="text-xl font-bold">Payment</h2>
                {enabledMethods.length === 1 && enabledMethods[0] === "cash" ? (
                  <div className="flex items-center gap-4 rounded-xl border-2 border-primary bg-primary/5 p-4">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-primary font-black text-lg">$</span>
                    </div>
                    <div>
                      <p className="font-semibold">Pay at Counter</p>
                      <p className="text-sm text-muted-foreground">Cash or card — pay when you pick up your order</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {enabledMethods.map(m => {
                      const info: Record<string, { label: string; description: string; icon: string }> = {
                        cash: { label: "Pay at Counter", description: "Cash or card — pay when you pick up your order", icon: "$" },
                        athmovil: { label: "ATH Móvil", description: "Pay now with ATH Móvil before pickup", icon: "A" },
                        card: { label: "Card Online", description: "Pay now by card before pickup", icon: "💳" },
                      };
                      const meta = info[m] ?? { label: m, description: "", icon: "$" };
                      const selected = paymentMethod === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setPaymentMethod(m)}
                          className={`w-full flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-colors ${
                            selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                          }`}
                        >
                          <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 font-black text-lg ${
                            selected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                          }`}>
                            {meta.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold">{meta.label}</p>
                            <p className="text-sm text-muted-foreground">{meta.description}</p>
                          </div>
                          <div className={`h-5 w-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                            selected ? "border-primary bg-primary" : "border-muted-foreground/40"
                          }`}>
                            {selected && <div className="h-2 w-2 rounded-full bg-white" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              <Separator />

              {/* Notes */}
              <section className="space-y-2">
                <Label htmlFor="notes">Order Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Any special instructions for your order..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </section>

              {!storeOpen && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-center">
                  <p className="text-sm font-semibold text-amber-800">
                    {!openToday ? (closedTodayReason ?? "We're closed today") : "Online ordering is closed right now"}
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    {!openToday
                      ? "We only accept orders on open days — check back then!"
                      : `We're open ${storeOpenTime} – ${storeCloseOrdersAt} AST · Last orders are 15 min before closing`}
                  </p>
                </div>
              )}
              <Button
                type="submit"
                className="w-full h-14 text-lg font-bold"
                disabled={createOrder.isPending || !storeOpen}
              >
                {createOrder.isPending ? "Placing Order..." : `Place Order — $${total.toFixed(2)}`}
              </Button>
            </form>

            {/* Order summary */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold">Order Summary</h2>
              <div className="bg-muted/30 rounded-xl border p-4 space-y-3">
                {items.map((item, idx) => (
                  <div key={`${item.menuItem.id}-${idx}`} className="flex justify-between text-sm gap-2">
                    <div className="min-w-0">
                      <span className="text-muted-foreground">{item.quantity}x {item.menuItem.name}</span>
                      {(item.modifierSelections ?? []).length > 0 && (
                        <p className="text-xs text-muted-foreground/70 mt-0.5">{item.modifierSelections!.map(m => m.name).join(", ")}</p>
                      )}
                      {item.notes && <p className="text-xs text-muted-foreground/70 mt-0.5 italic">{item.notes}</p>}
                    </div>
                    <span className="shrink-0">${((item.menuItem.price + (item.modifierSelections ?? []).reduce((s, m) => s + m.price, 0)) * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

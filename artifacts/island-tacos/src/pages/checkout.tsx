import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { useCart } from "@/lib/cart-context";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useCreateOrder } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { ShoppingBag, LogIn, Loader2, XCircle } from "lucide-react";
import { saveLastOrder } from "@/lib/customer-account";
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
  const { user, isLoaded } = useUser();

  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [enabledMethods, setEnabledMethods] = useState<string[]>(["cash"]);
  const [athState, setAthState] = useState<AthState | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pre-fill phone from localStorage if available
  useEffect(() => {
    const stored = localStorage.getItem("island_tacos_phone");
    if (stored) setCustomerPhone(stored);
  }, []);

  // Fetch which payment methods are enabled in admin settings
  useEffect(() => {
    fetch(`${basePath}/api/settings`)
      .then(r => r.json())
      .then((data: { online_payment_methods?: string }) => {
        try {
          const methods: string[] = JSON.parse(data.online_payment_methods ?? '["cash"]');
          if (methods.length > 0) {
            setEnabledMethods(methods);
            if (!methods.includes(paymentMethod)) setPaymentMethod(methods[0]);
          }
        } catch { /* keep defaults */ }
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
          // Accepted by restaurant (confirmed / preparing / ready)
          setAthState(prev => prev ? { ...prev, status: "ready" } : null);
        }
      } catch { /* ignore, retry next tick */ }
    };
    check(); // immediate check
    pollRef.current = setInterval(check, 5_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [athState?.status, athState?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  const createOrder = useCreateOrder();

  // ── ATH Móvil screens — checked BEFORE empty-cart guard (cart is cleared on order place) ──
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

    // status === "ready" — restaurant accepted, show ATH Móvil payment
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

  // Not signed in — show sign-in wall
  if (isLoaded && !user) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center py-20 px-4">
          <div className="w-full max-w-sm text-center space-y-8">
            <div className="space-y-3">
              <div className="mx-auto w-20 h-20 rounded-full bg-orange-50 flex items-center justify-center text-4xl">
                🌮
              </div>
              <h2 className="text-2xl font-black">Sign in to order</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                We need to know who's ordering so we can call your name when your food is ready.
              </p>
            </div>

            <div className="space-y-3">
              <Button
                className="w-full h-12 font-semibold bg-stone-900 hover:bg-stone-800 text-white border border-stone-700"
                onClick={() => setLocation(`${basePath}/sign-in`)}
              >
                <LogIn className="h-4 w-4 mr-2" />
                Sign in with Email
              </Button>
              <p className="text-xs text-muted-foreground">
                Your cart is saved — signing in won't lose your items.
              </p>
            </div>

            <Button variant="ghost" size="sm" onClick={() => setLocation("/")}>
              ← Back to menu
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  // Still loading Clerk
  if (!isLoaded) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  const customerName = user.fullName || user.firstName || user.username || "Customer";
  const customerEmail = user.primaryEmailAddress?.emailAddress ?? "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerPhone) {
      toast({ title: "Please enter your phone number", variant: "destructive" });
      return;
    }
    // Save phone for next time
    localStorage.setItem("island_tacos_phone", customerPhone);

    createOrder.mutate(
      {
        data: {
          customerName,
          customerEmail,
          customerPhone,
          orderType: "pickup",
          deliveryAddress: null,
          paymentMethod: paymentMethod as "cash" | "card" | "athmovil",
          notes: notes || null,
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
            // Show "waiting for acceptance" — payment comes AFTER restaurant accepts
            setAthState({
              orderId: order.id,
              code: order.confirmationCode,
              total,
              phone: customerPhone,
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
              {/* Account info from Clerk */}
              <section className="space-y-4">
                <h2 className="text-xl font-bold">Contact Information</h2>

                {/* Signed-in user pill */}
                <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {user.imageUrl ? (
                      <img src={user.imageUrl} alt="" className="w-8 h-8 rounded-full shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <span className="text-primary font-bold text-sm">{customerName[0]}</span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{customerName}</p>
                      <p className="text-xs text-muted-foreground truncate">{customerEmail}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLocation(`${basePath}/sign-in`)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-2 shrink-0"
                  >
                    Switch
                  </button>
                </div>

                {/* Phone — the only editable field */}
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="284-000-0000"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">We'll call this number if there's an issue with your order.</p>
                </div>
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

              <Button
                type="submit"
                className="w-full h-14 text-lg font-bold"
                disabled={createOrder.isPending}
              >
                {createOrder.isPending ? "Placing Order..." : `Place Order — $${total.toFixed(2)}`}
              </Button>
            </form>

            {/* Order summary */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold">Order Summary</h2>
              <div className="bg-muted/30 rounded-xl border p-4 space-y-3">
                {items.map((item) => (
                  <div key={item.menuItem.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {item.quantity}x {item.menuItem.name}
                    </span>
                    <span>${((item.menuItem.price + (item.modifierSelections ?? []).reduce((s, m) => s + m.price, 0)) * item.quantity).toFixed(2)}</span>
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

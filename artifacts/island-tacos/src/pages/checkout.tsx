import { useState } from "react";
import { useLocation } from "wouter";
import { useCart } from "@/lib/cart-context";
import { Layout } from "@/components/layout";
import { AthMovilInstructions } from "@/components/athmovil-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { useCreateOrder, useInitiatePayment } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, MapPin, ShoppingBag, Info, CheckCircle, XCircle } from "lucide-react";

export default function Checkout() {
  const { items, subtotal, tax, deliveryFee, total, clearCart } = useCart();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [form, setForm] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    orderType: "pickup" as "pickup" | "delivery",
    deliveryAddress: "",
    paymentMethod: "athmovil" as "card" | "athmovil" | "cash",
    notes: "",
  });
  const [step, setStep] = useState<"info" | "payment" | "athmovil-pay" | "pending">("info");
  const [orderId, setOrderId] = useState<number | null>(null);
  const [confirmationCode, setConfirmationCode] = useState<string>("");
  const [athError, setAthError] = useState<string | null>(null);

  const createOrder = useCreateOrder();
  const initiatePayment = useInitiatePayment();

  if (items.length === 0 && step === "info") {
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

  const handleSubmitInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerName || !form.customerEmail || !form.customerPhone) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    if (form.orderType === "delivery" && !form.deliveryAddress) {
      toast({ title: "Please enter a delivery address", variant: "destructive" });
      return;
    }

    createOrder.mutate(
      {
        data: {
          customerName: form.customerName,
          customerEmail: form.customerEmail,
          customerPhone: form.customerPhone,
          orderType: form.orderType,
          deliveryAddress: form.orderType === "delivery" ? form.deliveryAddress : null,
          paymentMethod: form.paymentMethod,
          notes: form.notes || null,
          items: items.map((i) => ({
            menuItemId: i.menuItem.id,
            quantity: i.quantity,
            notes: i.notes || null,
            modifierSelections: i.modifierSelections,
          })),
        },
      },
      {
        onSuccess: (order) => {
          setOrderId(order.id);
          setConfirmationCode(order.confirmationCode);
          if (form.paymentMethod === "cash") {
            clearCart();
            setLocation(`/track?code=${order.confirmationCode}`);
          } else {
            setStep("payment");
            initiatePayment.mutate(
              { data: { orderId: order.id, paymentMethod: form.paymentMethod } },
              {
                onSuccess: (session) => {
                  if (session.redirectUrl) {
                    window.location.href = session.redirectUrl;
                  } else if (session.paymentMethod === "athmovil") {
                    setStep("athmovil-pay");
                  } else {
                    setStep("pending");
                  }
                },
                onError: () => {
                  setStep("pending");
                },
              }
            );
          }
        },
        onError: (err: unknown) => {
          const msg = (err as { data?: { error?: string } })?.data?.error ?? "Failed to place order. Please try again.";
          toast({ title: msg, variant: "destructive" });
        },
      }
    );
  };

  const handlePaymentSent = async () => {
    if (!orderId || !confirmationCode) return;
    setAthError(null);

    // Poll for up to 3 minutes (36 × 5s intervals)
    const maxAttempts = 36;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((r) => setTimeout(r, 5000));
      try {
        const res = await fetch(`/api/orders/${orderId}`);
        if (res.ok) {
          const order = await res.json() as { paymentStatus?: string };
          if (order.paymentStatus === "paid") {
            clearCart();
            setLocation(`/track?code=${confirmationCode}`);
            return;
          }
        }
      } catch {
        // keep polling
      }
    }

    setAthError(
      "We haven't received your payment yet. If you've already sent it, please show this screen to staff — your order code is " +
      confirmationCode
    );
  };

  if (step === "athmovil-pay") {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="max-w-md w-full mx-auto px-4 space-y-6">
            <div className="text-center space-y-2">
              <div className="mx-auto w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
                <div className="w-9 h-6 bg-red-600 rounded flex items-center justify-center">
                  <span className="text-white text-[11px] font-black">ATH</span>
                </div>
              </div>
              <h2 className="text-2xl font-bold">Pay with ATH Movil</h2>
              <p className="text-muted-foreground text-sm">
                Order <span className="font-mono font-bold text-foreground">{confirmationCode}</span>
              </p>
            </div>

            <div className="bg-muted/30 border rounded-xl p-4 space-y-2 text-sm">
              {items.map((item) => (
                <div key={item.menuItem.id} className="flex justify-between">
                  <span className="text-muted-foreground">{item.quantity}x {item.menuItem.name}</span>
                  <span>${(item.menuItem.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>

            {athError ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
                <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Payment Not Detected</p>
                  <p className="text-sm text-red-700 mt-1">{athError}</p>
                </div>
              </div>
            ) : (
              <AthMovilInstructions
                total={total}
                confirmationCode={confirmationCode ?? ""}
                onPaymentSent={handlePaymentSent}
              />
            )}

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                clearCart();
                setLocation("/");
              }}
            >
              Cancel order and return to menu
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  if (step === "pending") {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="max-w-md w-full mx-auto px-4 text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <CreditCard className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">Order Placed!</h2>
            <p className="text-muted-foreground">Your order confirmation code is:</p>
            <div className="bg-muted rounded-xl px-8 py-4">
              <span className="text-3xl font-mono font-black tracking-widest text-primary">{confirmationCode}</span>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left flex gap-3">
              <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Payment Gateway Pending Setup</p>
                <p className="text-sm text-amber-700 mt-1">
                  Card payment gateway is not yet configured. Please pay at pickup or contact us to arrange payment.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                onClick={() => { clearCart(); setLocation(`/track?code=${confirmationCode}`); }}
                className="w-full"
              >
                Track My Order
              </Button>
              <Button variant="outline" onClick={() => { clearCart(); setLocation("/"); }} className="w-full">
                Back to Menu
              </Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex-1 py-8 md:py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-3xl font-black mb-8">Checkout</h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <form onSubmit={handleSubmitInfo} className="md:col-span-2 space-y-8">
              {/* Contact info */}
              <section className="space-y-4">
                <h2 className="text-xl font-bold">Contact Information</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      placeholder="Your name"
                      value={form.customerName}
                      onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="787-000-0000"
                      value={form.customerPhone}
                      onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@email.com"
                    value={form.customerEmail}
                    onChange={(e) => setForm((f) => ({ ...f, customerEmail: e.target.value }))}
                    required
                  />
                </div>
              </section>

              <Separator />

              {/* Order type */}
              <section className="space-y-4">
                <h2 className="text-xl font-bold">Order Type</h2>
                <RadioGroup
                  value={form.orderType}
                  onValueChange={(v) => setForm((f) => ({ ...f, orderType: v as "pickup" | "delivery" }))}
                  className="grid grid-cols-2 gap-4"
                >
                  {(["pickup", "delivery"] as const).map((type) => (
                    <label
                      key={type}
                      htmlFor={type}
                      className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-4 cursor-pointer transition-colors ${
                        form.orderType === type ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <RadioGroupItem value={type} id={type} className="sr-only" />
                      <MapPin className={`h-6 w-6 ${form.orderType === type ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="font-semibold capitalize">{type}</span>
                      <span className="text-xs text-muted-foreground text-center">
                        {type === "pickup" ? "Ready in ~20 min" : "Delivery +$3.00"}
                      </span>
                    </label>
                  ))}
                </RadioGroup>

                {form.orderType === "delivery" && (
                  <div className="space-y-2">
                    <Label htmlFor="address">Delivery Address *</Label>
                    <Input
                      id="address"
                      placeholder="Street address, San Juan, PR"
                      value={form.deliveryAddress}
                      onChange={(e) => setForm((f) => ({ ...f, deliveryAddress: e.target.value }))}
                      required
                    />
                  </div>
                )}
              </section>

              <Separator />

              {/* Payment method */}
              <section className="space-y-4">
                <h2 className="text-xl font-bold">Payment Method</h2>
                <RadioGroup
                  value={form.paymentMethod}
                  onValueChange={(v) => setForm((f) => ({ ...f, paymentMethod: v as "card" | "athmovil" | "cash" }))}
                  className="space-y-3"
                >
                  <label
                    htmlFor="athmovil"
                    className={`flex items-center gap-4 rounded-xl border-2 p-4 cursor-pointer transition-colors ${
                      form.paymentMethod === "athmovil" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <RadioGroupItem value="athmovil" id="athmovil" />
                    <div className="w-9 h-6 bg-red-600 rounded flex items-center justify-center shrink-0">
                      <span className="text-white text-[10px] font-black">ATH</span>
                    </div>
                    <div>
                      <p className="font-semibold">ATH Movil</p>
                      <p className="text-sm text-muted-foreground">Pay instantly with ATH Movil app</p>
                    </div>
                  </label>
                  <label
                    htmlFor="card"
                    className={`flex items-center gap-4 rounded-xl border-2 p-4 cursor-pointer transition-colors ${
                      form.paymentMethod === "card" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <RadioGroupItem value="card" id="card" />
                    <CreditCard className="h-5 w-5 shrink-0" />
                    <div>
                      <p className="font-semibold">Credit / Debit Card</p>
                      <p className="text-sm text-muted-foreground">Visa, Mastercard, Apple Pay — coming soon</p>
                    </div>
                  </label>
                  <label
                    htmlFor="cash"
                    className={`flex items-center gap-4 rounded-xl border-2 p-4 cursor-pointer transition-colors ${
                      form.paymentMethod === "cash" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <RadioGroupItem value="cash" id="cash" />
                    <div className="h-5 w-8 flex items-center justify-center text-green-700 font-black text-sm shrink-0">$</div>
                    <div>
                      <p className="font-semibold">Pay at Pickup</p>
                      <p className="text-sm text-muted-foreground">Cash or card at the restaurant</p>
                    </div>
                  </label>
                </RadioGroup>
              </section>

              <Separator />

              {/* Notes */}
              <section className="space-y-2">
                <Label htmlFor="notes">Order Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Any special instructions for your order..."
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                />
              </section>

              <Button
                type="submit"
                className="w-full h-14 text-lg font-bold"
                disabled={createOrder.isPending || initiatePayment.isPending}
              >
                {createOrder.isPending || initiatePayment.isPending
                  ? "Placing Order..."
                  : `Place Order — $${total.toFixed(2)}`}
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
                    <span>${(item.menuItem.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {form.orderType === "delivery" && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Delivery fee</span>
                    <span>{deliveryFee === 0 ? "FREE" : `$${deliveryFee.toFixed(2)}`}</span>
                  </div>
                )}
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

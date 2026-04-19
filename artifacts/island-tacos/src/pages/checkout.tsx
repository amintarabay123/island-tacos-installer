import { useState } from "react";
import { useLocation } from "wouter";
import { useCart } from "@/lib/cart-context";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useCreateOrder } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { ShoppingBag, UserCircle } from "lucide-react";
import { getCustomer, saveCustomer, saveLastOrder } from "@/lib/customer-account";

export default function Checkout() {
  const { items, total, clearCart } = useCart();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const savedCustomer = getCustomer();
  const [form, setForm] = useState({
    customerName: savedCustomer?.name ?? "",
    customerEmail: savedCustomer?.email ?? "",
    customerPhone: savedCustomer?.phone ?? "",
    notes: "",
  });

  const createOrder = useCreateOrder();

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

  const handleSubmitInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerName || !form.customerEmail || !form.customerPhone) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    createOrder.mutate(
      {
        data: {
          customerName: form.customerName,
          customerEmail: form.customerEmail,
          customerPhone: form.customerPhone,
          orderType: "pickup",
          deliveryAddress: null,
          paymentMethod: "cash",
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
          saveCustomer({ name: form.customerName, phone: form.customerPhone, email: form.customerEmail });
          saveLastOrder(order.confirmationCode);
          clearCart();
          setLocation(`/track?code=${order.confirmationCode}`);
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
            <form onSubmit={handleSubmitInfo} className="md:col-span-2 space-y-8">
              {/* Contact info */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold">Contact Information</h2>
                  {savedCustomer && (
                    <span className="flex items-center gap-1.5 text-xs text-primary font-semibold">
                      <UserCircle className="h-4 w-4" /> Saved
                    </span>
                  )}
                </div>
                {savedCustomer && (
                  <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
                    <UserCircle className="h-5 w-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">Welcome back, {savedCustomer.name.split(" ")[0]}!</p>
                      <p className="text-xs text-muted-foreground truncate">Info pre-filled — edit below if needed</p>
                    </div>
                  </div>
                )}
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

              {/* Payment */}
              <section className="space-y-3">
                <h2 className="text-xl font-bold">Payment</h2>
                <div className="flex items-center gap-4 rounded-xl border-2 border-primary bg-primary/5 p-4">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-primary font-black text-lg">$</span>
                  </div>
                  <div>
                    <p className="font-semibold">Pay at Counter</p>
                    <p className="text-sm text-muted-foreground">Cash or card — pay when you pick up your order</p>
                  </div>
                </div>
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

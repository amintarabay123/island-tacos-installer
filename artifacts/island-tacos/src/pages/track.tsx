import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useTrackOrder, getTrackOrderQueryKey } from "@workspace/api-client-react";
import { CheckCircle2, Clock, ChefHat, Package, XCircle, Search } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const STATUS_STEPS = ["pending", "confirmed", "preparing", "ready", "completed"];

const STATUS_LABELS: Record<string, string> = {
  pending: "Order Received",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready for Pickup",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  pending: Clock,
  confirmed: CheckCircle2,
  preparing: ChefHat,
  ready: Package,
  completed: CheckCircle2,
  cancelled: XCircle,
};

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    confirmed: "bg-blue-100 text-blue-800",
    preparing: "bg-orange-100 text-orange-800",
    ready: "bg-green-100 text-green-800",
    completed: "bg-gray-100 text-gray-800",
    cancelled: "bg-red-100 text-red-800",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${colorMap[status] ?? "bg-gray-100 text-gray-800"}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export default function TrackOrder() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(location.includes("?") ? location.split("?")[1] : "");
  const urlCode = searchParams.get("code") ?? "";

  const [code, setCode] = useState(urlCode);
  const [submitted, setSubmitted] = useState(!!urlCode);

  const queryClient = useQueryClient();
  const trackCode = submitted ? code.toUpperCase() : "";
  const { data: order, isLoading, error } = useTrackOrder(
    trackCode,
    { query: { enabled: submitted && !!code, queryKey: getTrackOrderQueryKey(trackCode) } }
  );

  // Auto-refresh every 30s for active orders
  useEffect(() => {
    if (!submitted || !code) return;
    const terminal = ["completed", "cancelled"];
    if (order && terminal.includes(order.status)) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: getTrackOrderQueryKey(code.toUpperCase()) });
    }, 30000);
    return () => clearInterval(interval);
  }, [submitted, code, order, queryClient]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setSubmitted(true);
  };

  const currentStepIndex = order ? STATUS_STEPS.indexOf(order.status) : -1;

  return (
    <Layout>
      <div className="flex-1 py-8 md:py-12">
        <div className="container mx-auto px-4 max-w-2xl">
          <h1 className="text-3xl font-black mb-2">Track Your Order</h1>
          <p className="text-muted-foreground mb-8">Enter your confirmation code to see your order status.</p>

          <form onSubmit={handleSubmit} className="flex gap-3 mb-8">
            <div className="flex-1 space-y-1">
              <Label htmlFor="code" className="sr-only">Confirmation Code</Label>
              <Input
                id="code"
                placeholder="e.g. ITAB1234"
                value={code}
                onChange={(e) => { setCode(e.target.value.toUpperCase()); setSubmitted(false); }}
                className="font-mono text-lg h-12"
                maxLength={10}
              />
            </div>
            <Button type="submit" className="h-12 px-6" disabled={!code.trim()}>
              <Search className="h-4 w-4 mr-2" />
              Track
            </Button>
          </form>

          {isLoading && (
            <div className="text-center py-12 text-muted-foreground">Looking up your order...</div>
          )}

          {error && submitted && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
              <XCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
              <p className="font-semibold">Order not found</p>
              <p className="text-sm text-muted-foreground mt-1">Double-check your confirmation code and try again.</p>
            </div>
          )}

          {order && (
            <div className="space-y-6">
              <div className="rounded-xl border bg-card p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Confirmation code</p>
                    <p className="text-2xl font-mono font-black text-primary">{order.confirmationCode}</p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>

                {order.status !== "cancelled" && order.status !== "completed" && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between relative">
                      {STATUS_STEPS.slice(0, 4).map((step, idx) => {
                        const Icon = STATUS_ICONS[step];
                        const isActive = STATUS_STEPS.indexOf(order.status) >= idx;
                        return (
                          <div key={step} className="flex flex-col items-center gap-2 z-10">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                              isActive ? "bg-primary border-primary text-primary-foreground" : "bg-muted border-border text-muted-foreground"
                            }`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <span className={`text-[11px] font-medium text-center max-w-[60px] leading-tight ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                              {STATUS_LABELS[step]}
                            </span>
                          </div>
                        );
                      })}
                      <div className="absolute top-5 left-5 right-5 h-0.5 bg-border -z-0">
                        <div
                          className="h-full bg-primary transition-all duration-500"
                          style={{ width: `${Math.max(0, (currentStepIndex / 3) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {order.estimatedReadyAt && (
                  <div className="mt-6 bg-primary/5 rounded-lg p-3 text-center">
                    <p className="text-sm text-muted-foreground">Estimated ready at</p>
                    <p className="font-bold text-primary">
                      {new Date(order.estimatedReadyAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-xl border bg-card p-6 space-y-4">
                <h3 className="font-bold text-lg">Order Details</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Name</p>
                    <p className="font-medium">{order.customerName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Type</p>
                    <p className="font-medium capitalize">{order.orderType}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Payment</p>
                    <p className="font-medium capitalize">{order.paymentMethod} — {order.paymentStatus}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Ordered</p>
                    <p className="font-medium">{new Date(order.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  {order.items?.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{item.quantity}x {item.menuItemName}</span>
                      <span>${item.subtotal.toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>${order.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span>${order.tax.toFixed(2)}</span>
                  </div>
                  {order.deliveryFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Delivery</span>
                      <span>${order.deliveryFee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base pt-1">
                    <span>Total</span>
                    <span>${order.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

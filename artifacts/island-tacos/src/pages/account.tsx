import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp, LogIn, LogOut } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface OrderItem { menuItemName: string; quantity: number; subtotal: number }
interface CustomerOrder {
  id: number; confirmationCode: string; status: string;
  paymentStatus: string; paymentMethod: string; source: string;
  total: number; createdAt: string; notes: string | null; items: OrderItem[];
}
interface CustomerProfile {
  id: number; name: string; email: string | null; phone: string | null;
  visitCount: number; totalSpent: number; createdAt: string; orders: CustomerOrder[];
}

function statusIcon(status: string) {
  switch (status) {
    case "completed": return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case "cancelled": return <XCircle className="w-4 h-4 text-red-400" />;
    case "confirmed": return <Clock className="w-4 h-4 text-blue-500" />;
    default: return <Clock className="w-4 h-4 text-yellow-500" />;
  }
}
function statusLabel(s: string) {
  return { pending: "Pending", confirmed: "Being Prepared", ready: "Ready for Pickup!", completed: "Completed", cancelled: "Cancelled" }[s] ?? s;
}
function statusColor(s: string) {
  return { completed: "bg-green-100 text-green-700", cancelled: "bg-red-100 text-red-700", ready: "bg-emerald-100 text-emerald-700", confirmed: "bg-blue-100 text-blue-700" }[s] ?? "bg-yellow-100 text-yellow-700";
}

export default function AccountPage() {
  const { user, isLoaded } = useUser();
  const { openSignIn, signOut } = useClerk();
  const [, setLocation] = useLocation();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);

  useEffect(() => {
    if (!isLoaded || !user) return;
    const email = user.primaryEmailAddress?.emailAddress;
    if (!email) return;
    setLoading(true);
    fetch(`${API}/api/customers/lookup?email=${encodeURIComponent(email)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => setProfile(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isLoaded, user]);

  if (!isLoaded) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="max-w-sm mx-auto px-4 py-20 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-3xl">🌮</div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">My Account</h1>
            <p className="text-muted-foreground text-sm">Sign in to see your order history and saved info.</p>
          </div>
          <Button className="w-full h-12" onClick={() => openSignIn({ redirectUrl: `${basePath}/account` })}>
            <LogIn className="h-4 w-4 mr-2" /> Sign In
          </Button>
        </div>
      </Layout>
    );
  }

  const displayName = user.fullName || user.firstName || user.username || "You";
  const email = user.primaryEmailAddress?.emailAddress ?? "";

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-12 w-full space-y-6">
        {/* Profile card */}
        <div className="rounded-2xl border bg-card p-6">
          <div className="flex items-start gap-4">
            {user.imageUrl ? (
              <img src={user.imageUrl} alt="" className="w-14 h-14 rounded-full shrink-0 object-cover" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary shrink-0">
                {displayName[0]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold">{displayName}</h2>
              {email && <p className="text-sm text-muted-foreground mt-0.5">{email}</p>}
              {profile && (
                <p className="text-xs text-muted-foreground mt-1">
                  Customer since {new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </p>
              )}
            </div>
            <button
              onClick={() => signOut(() => setLocation("/"))}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>

          {profile && (
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="rounded-xl bg-muted p-3 text-center">
                <p className="text-2xl font-bold">{profile.visitCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Orders Placed</p>
              </div>
              <div className="rounded-xl bg-muted p-3 text-center">
                <p className="text-2xl font-bold">${profile.totalSpent.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Total Spent</p>
              </div>
            </div>
          )}
        </div>

        {/* Order history */}
        <div>
          <h3 className="text-lg font-bold mb-3">Order History</h3>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : !profile || profile.orders.length === 0 ? (
            <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
              <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No orders yet</p>
              <p className="text-sm mt-1">Your orders will appear here after you place one.</p>
              <Button className="mt-4" onClick={() => setLocation("/")}>Browse Menu</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {profile.orders.map(o => (
                <div key={o.id} className="rounded-2xl border bg-card overflow-hidden">
                  <div
                    className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedOrder(expandedOrder === o.id ? null : o.id)}
                  >
                    {statusIcon(o.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold">{o.confirmationCode}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor(o.status)}`}>{statusLabel(o.status)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(o.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        {" · "}{new Date(o.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {" · "}<span className="capitalize">{o.source === "pos" ? "Walk-in" : "Online"}</span>
                      </p>
                    </div>
                    <div className="text-right shrink-0 mr-2">
                      <p className="font-bold">${o.total.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground capitalize">{o.paymentMethod}</p>
                    </div>
                    {expandedOrder === o.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  {expandedOrder === o.id && (
                    <div className="border-t bg-muted/20 px-5 py-4 space-y-2">
                      {o.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{item.quantity}× {item.menuItemName}</span>
                          <span className="font-medium">${item.subtotal.toFixed(2)}</span>
                        </div>
                      ))}
                      {o.notes && <p className="text-xs text-muted-foreground border-t pt-2 mt-2">Note: {o.notes}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

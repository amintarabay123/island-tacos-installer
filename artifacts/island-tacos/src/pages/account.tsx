import { useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Mail, ShoppingBag, Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp, Loader2, ArrowRight, User } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

interface OrderItem {
  menuItemName: string;
  quantity: number;
  subtotal: number;
}

interface CustomerOrder {
  id: number;
  confirmationCode: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  source: string;
  total: number;
  createdAt: string;
  notes: string | null;
  items: OrderItem[];
}

interface CustomerProfile {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  visitCount: number;
  totalSpent: number;
  createdAt: string;
  orders: CustomerOrder[];
}

function statusIcon(status: string) {
  switch (status) {
    case "completed": return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case "cancelled": return <XCircle className="w-4 h-4 text-red-400" />;
    case "confirmed": return <Clock className="w-4 h-4 text-blue-500" />;
    default: return <Clock className="w-4 h-4 text-yellow-500" />;
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "pending": return "Pending";
    case "confirmed": return "Being Prepared";
    case "ready": return "Ready for Pickup!";
    case "completed": return "Completed";
    case "cancelled": return "Cancelled";
    default: return status;
  }
}

function statusColor(status: string) {
  switch (status) {
    case "completed": return "bg-green-100 text-green-700";
    case "cancelled": return "bg-red-100 text-red-700";
    case "ready": return "bg-emerald-100 text-emerald-700";
    case "confirmed": return "bg-blue-100 text-blue-700";
    default: return "bg-yellow-100 text-yellow-700";
  }
}

export default function AccountPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);

  const lookup = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/customers/lookup?email=${encodeURIComponent(trimmed)}`);
      if (res.status === 404) {
        setError("No account found with that email. Orders placed online are automatically saved — make sure to use the same email you ordered with.");
        setProfile(null);
      } else if (!res.ok) {
        setError("Something went wrong. Please try again.");
        setProfile(null);
      } else {
        const data: CustomerProfile = await res.json();
        setProfile(data);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setProfile(null);
    setEmail("");
    setError("");
    setExpandedOrder(null);
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-12 w-full">
        {!profile ? (
          <div className="space-y-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">My Account</h1>
              <p className="text-muted-foreground mt-2">
                Enter your email to view your order history.
              </p>
            </div>

            <div className="rounded-2xl border bg-card p-6 space-y-4">
              <div>
                <label className="text-sm font-semibold block mb-2">Email Address</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && lookup()}
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border bg-background outline-none focus:border-primary"
                    />
                  </div>
                  <Button onClick={lookup} disabled={loading || !email.trim()} className="shrink-0">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ArrowRight className="w-4 h-4 mr-1" /> Look Up</>}
                  </Button>
                </div>
              </div>
              {error && (
                <div className="rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm p-3">
                  {error}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                No password needed. Your account is created automatically the first time you place an online order.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Profile header */}
            <div className="rounded-2xl border bg-card p-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold shrink-0">
                  {profile.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold">{profile.name}</h2>
                  {profile.email && <p className="text-sm text-muted-foreground mt-0.5">{profile.email}</p>}
                  {profile.phone && <p className="text-sm text-muted-foreground">{profile.phone}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    Customer since {new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </p>
                </div>
                <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground underline shrink-0">
                  Sign Out
                </button>
              </div>
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
            </div>

            {/* Order history */}
            <div>
              <h3 className="text-lg font-bold mb-3">Order History</h3>
              {profile.orders.length === 0 ? (
                <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
                  <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">No orders yet</p>
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
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor(o.status)}`}>
                              {statusLabel(o.status)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(o.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            {" · "}
                            {new Date(o.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            {" · "}
                            <span className="capitalize">{o.source === "pos" ? "Walk-in" : "Online"}</span>
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
                          {o.notes && (
                            <p className="text-xs text-muted-foreground border-t pt-2 mt-2">Note: {o.notes}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

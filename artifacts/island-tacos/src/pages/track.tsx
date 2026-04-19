import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { useTrackOrder, getTrackOrderQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, ChefHat, Package, XCircle, ArrowRight, Loader2, UserCircle, History, LogOut, Pencil, Check } from "lucide-react";
import { getCustomer, saveCustomer, clearCustomer, getLastOrder, type CustomerProfile } from "@/lib/customer-account";

function getCode(): string {
  return new URLSearchParams(window.location.search).get("code") ?? "";
}

export default function TrackOrder() {
  const code = getCode().toUpperCase();
  const queryClient = useQueryClient();

  const { data: order, isLoading, error } = useTrackOrder(
    code,
    { query: { enabled: !!code, queryKey: getTrackOrderQueryKey(code) } }
  );

  // Poll every 8s until terminal
  useEffect(() => {
    if (!code) return;
    const terminal = ["completed", "cancelled"];
    if (order && terminal.includes(order.status)) return;
    const id = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: getTrackOrderQueryKey(code) });
    }, 8_000);
    return () => clearInterval(id);
  }, [code, order, queryClient]);

  // No code in URL — show search prompt
  if (!code) {
    return <NoCodeView />;
  }

  if (isLoading) {
    return <FullScreenState icon={<Loader2 className="h-14 w-14 text-primary animate-spin" />} title="Looking up your order…" />;
  }

  if (error || !order) {
    return (
      <FullScreenState
        icon={<XCircle className="h-14 w-14 text-red-500" />}
        title="Order not found"
        subtitle="Double-check your confirmation code."
        action={<TrackLink label="Try again" />}
      />
    );
  }

  const { status, confirmationCode, customerName, cancellationReason, items, total } = order;

  if (status === "cancelled") {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-12 text-center">
        <div className="w-full max-w-sm flex flex-col items-center gap-6">
          <div className="text-xs font-semibold tracking-widest text-muted-foreground uppercase mb-2">Island Tacos</div>

          {/* Icon */}
          <div className="flex items-center justify-center w-24 h-24 rounded-full bg-red-50">
            <XCircle className="h-14 w-14 text-red-500" />
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <h1 className="text-2xl font-black leading-tight text-gray-900">Order Not Accepted</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Sorry {customerName ? customerName.split(" ")[0] + "," : ","} we couldn't accept your order at this time.
            </p>
          </div>

          {/* Reason box — shown prominently if a reason was given */}
          {cancellationReason && (
            <div className="w-full rounded-2xl border-2 border-red-200 bg-red-50 px-5 py-4 text-left">
              <p className="text-xs font-bold uppercase tracking-widest text-red-400 mb-1">Reason</p>
              <p className="text-base font-semibold text-red-800">{cancellationReason}</p>
            </div>
          )}

          {/* Confirmation code */}
          <div className="bg-muted rounded-xl px-5 py-3 w-full">
            <p className="text-xs text-muted-foreground mb-0.5">Order reference</p>
            <p className="text-2xl font-mono font-black text-primary tracking-widest">{confirmationCode}</p>
          </div>

          {/* CTAs */}
          <div className="flex flex-col items-center gap-3 w-full">
            <Link
              href="/"
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity"
            >
              Order Again <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="text-xs text-muted-foreground">We apologize for the inconvenience.</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "confirmed" || status === "preparing" || status === "ready" || status === "completed") {
    const isReady = status === "ready";
    const isDone = status === "completed";
    return (
      <FullScreenState
        icon={
          isReady || isDone
            ? <Package className={`h-14 w-14 ${isDone ? "text-gray-500" : "text-green-500"}`} />
            : <CheckCircle2 className="h-14 w-14 text-green-500" />
        }
        title={
          isDone ? "Order complete — enjoy!" :
          isReady ? "Your order is ready for pickup!" :
          status === "preparing" ? "We're making your food!" :
          "Order confirmed!"
        }
        subtitle={
          isDone ? undefined :
          isReady ? "Head to the counter to pick up your order." :
          status === "preparing" ? `Hang tight, ${customerName.split(" ")[0]}. It'll be ready soon.` :
          `We've got your order, ${customerName.split(" ")[0]}. The kitchen is on it!`
        }
        code={confirmationCode}
        orderSummary={{ items: items ?? [], total }}
        progress={status}
        action={
          (isReady || isDone) ? (
            <div className="flex flex-col items-center gap-3 w-full">
              <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
                Order Again <ArrowRight className="h-4 w-4" />
              </Link>
              <TrackLink label="Track order" code={code} />
            </div>
          ) : (
            <TrackLink label="Track order" code={code} />
          )
        }
      />
    );
  }

  // Pending — waiting for staff to accept
  return (
    <FullScreenState
      icon={<Clock className="h-14 w-14 text-amber-500 animate-pulse" />}
      title="Waiting for confirmation…"
      subtitle="Your order is being reviewed. This usually takes just a minute."
      code={confirmationCode}
      orderSummary={{ items: items ?? [], total }}
      action={<TrackLink label="Refresh status" code={code} />}
    />
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

type ModSel = { name: string; price: number };
type Item = { id: number; menuItemName: string; quantity: number; subtotal: number; notes?: string | null; modifierSelections?: ModSel[] | null };

function FullScreenState({
  icon,
  title,
  subtitle,
  code,
  orderSummary,
  progress,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  code?: string;
  orderSummary?: { items: Item[]; total: number };
  progress?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-12 text-center">
      <div className="w-full max-w-sm flex flex-col items-center gap-6">
        {/* Logo */}
        <div className="text-xs font-semibold tracking-widest text-muted-foreground uppercase mb-2">Island Tacos</div>

        {/* Icon */}
        <div className="flex items-center justify-center w-24 h-24 rounded-full bg-muted">
          {icon}
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h1 className="text-2xl font-black leading-tight">{title}</h1>
          {subtitle && <p className="text-muted-foreground text-sm leading-relaxed">{subtitle}</p>}
        </div>

        {/* Confirmation code */}
        {code && (
          <div className="bg-muted rounded-xl px-5 py-3 w-full">
            <p className="text-xs text-muted-foreground mb-0.5">Confirmation code</p>
            <p className="text-2xl font-mono font-black text-primary tracking-widest">{code}</p>
          </div>
        )}

        {/* Progress bar */}
        {progress && <ProgressSteps status={progress} />}

        {/* Order summary */}
        {orderSummary && orderSummary.items.length > 0 && (
          <div className="w-full rounded-xl border bg-card text-left p-4 space-y-2 text-sm">
            {orderSummary.items.map((item) => (
              <div key={item.id} className="space-y-0.5">
                <div className="flex justify-between text-muted-foreground">
                  <span><span className="font-semibold text-foreground">{item.quantity}×</span> {item.menuItemName}</span>
                  <span>${item.subtotal.toFixed(2)}</span>
                </div>
                {(item.modifierSelections ?? []).map((m, i) => (
                  <p key={i} className="text-xs text-muted-foreground/70 italic pl-5">+ {m.name}</p>
                ))}
                {/* Only show free-text notes when there are no structured modifiers to avoid
                    duplicating info for older orders that stored modifier labels in notes */}
                {item.notes && (item.modifierSelections ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground/70 italic pl-5">{item.notes}</p>
                )}
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between font-bold text-base">
              <span>Total</span>
              <span>${orderSummary.total.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Action */}
        {action && <div className="w-full">{action}</div>}
      </div>
    </div>
  );
}

const STEPS = [
  { key: "confirmed", label: "Confirmed", icon: CheckCircle2 },
  { key: "preparing", label: "Preparing", icon: ChefHat },
  { key: "ready",     label: "Ready",     icon: Package },
];
const STEP_ORDER = ["confirmed", "preparing", "ready", "completed"];

function ProgressSteps({ status }: { status: string }) {
  const currentIdx = STEP_ORDER.indexOf(status);
  return (
    <div className="w-full flex items-center justify-between relative px-1">
      {/* track line */}
      <div className="absolute top-4 left-6 right-6 h-0.5 bg-muted z-0" />
      {STEPS.map((step, i) => {
        const done = currentIdx >= STEP_ORDER.indexOf(step.key);
        const Icon = step.icon;
        return (
          <div key={step.key} className="flex flex-col items-center gap-1.5 z-10">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
              done ? "bg-primary border-primary text-primary-foreground" : "bg-white border-muted text-muted-foreground"
            }`}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <span className={`text-[10px] font-semibold ${done ? "text-primary" : "text-muted-foreground"}`}>{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function TrackLink({ label, code }: { label: string; code?: string }) {
  const href = code ? `/track?code=${code}` : "/track";
  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-border text-sm font-semibold hover:bg-muted transition-colors"
    >
      {label} <ArrowRight className="h-4 w-4" />
    </a>
  );
}

// ─── Customer history (fetched by phone) ───────────────────────────────────

type HistoryOrder = {
  id: number;
  confirmationCode: string;
  status: string;
  total: number;
  createdAt: string;
  items: { name: string; quantity: number }[];
};

function statusLabel(s: string) {
  const map: Record<string, string> = {
    pending: "Pending",
    confirmed: "Confirmed",
    preparing: "Preparing",
    ready: "Ready",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return map[s] ?? s;
}
function statusColor(s: string) {
  if (s === "completed") return "text-green-700 bg-green-50 border-green-200";
  if (s === "cancelled") return "text-red-600 bg-red-50 border-red-200";
  if (s === "ready") return "text-blue-700 bg-blue-50 border-blue-200";
  return "text-amber-700 bg-amber-50 border-amber-200";
}

function CustomerHistorySection({ phone }: { phone: string }) {
  const [orders, setOrders] = useState<HistoryOrder[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!phone) return;
    setLoading(true);
    fetch(`/api/orders?customerPhone=${encodeURIComponent(phone)}`)
      .then((r) => r.json())
      .then((data) => {
        setOrders(
          (data as HistoryOrder[]).map((o) => ({
            id: o.id,
            confirmationCode: o.confirmationCode,
            status: o.status,
            total: o.total,
            createdAt: o.createdAt,
            items: o.items,
          }))
        );
      })
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [phone]);

  if (loading) return (
    <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-sm">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
    </div>
  );

  if (!orders || orders.length === 0) return (
    <div className="py-8 text-center text-muted-foreground text-sm">No orders found.</div>
  );

  return (
    <div className="space-y-3">
      {orders.map((o) => (
        <a
          key={o.id}
          href={`/track?code=${o.confirmationCode}`}
          className="flex items-center gap-3 p-4 rounded-xl border hover:bg-muted/40 transition-colors group"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-sm">{o.confirmationCode}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${statusColor(o.status)}`}>
                {statusLabel(o.status)}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 truncate">
              {o.items?.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
            </div>
            <div className="text-xs text-muted-foreground">
              {new Date(o.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              {" · "}
              <span className="font-semibold text-foreground">${Number(o.total).toFixed(2)}</span>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
        </a>
      ))}
    </div>
  );
}

// ─── Create-account form ────────────────────────────────────────────────────

function CreateAccountForm({ onSave }: { onSave: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full text-sm text-muted-foreground hover:text-foreground border border-dashed rounded-xl px-4 py-3 transition-colors flex items-center justify-center gap-2"
      >
        <UserCircle className="h-4 w-4" /> Save your info for faster checkout
      </button>
    );
  }

  return (
    <div className="border rounded-xl p-4 space-y-3 bg-muted/20">
      <p className="text-sm font-semibold">Save your info</p>
      <p className="text-xs text-muted-foreground">Your info is saved on this device only. No account or password needed.</p>
      <input
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        placeholder="Full Name *"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        placeholder="Phone (e.g. 787-000-0000) *"
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <input
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        placeholder="Email (optional)"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          onClick={() => {
            if (!name.trim() || !phone.trim()) return;
            saveCustomer({ name: name.trim(), phone: phone.trim(), email: email.trim() });
            onSave();
          }}
          className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90"
        >
          Save
        </button>
        <button
          onClick={() => setOpen(false)}
          className="px-4 py-2 rounded-lg border text-sm hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Edit account inline ────────────────────────────────────────────────────

function EditAccountForm({ profile, onSave, onCancel }: { profile: CustomerProfile; onSave: (p: CustomerProfile) => void; onCancel: () => void }) {
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [email, setEmail] = useState(profile.email);

  return (
    <div className="space-y-2 pt-1">
      <input
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Full Name"
      />
      <input
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Phone"
        type="tel"
      />
      <input
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        type="email"
      />
      <div className="flex gap-2">
        <button
          onClick={() => {
            if (!name.trim() || !phone.trim()) return;
            const updated = { name: name.trim(), phone: phone.trim(), email: email.trim() };
            saveCustomer(updated);
            onSave(updated);
          }}
          className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-1 hover:opacity-90"
        >
          <Check className="h-3.5 w-3.5" /> Save
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg border text-sm hover:bg-muted">Cancel</button>
      </div>
    </div>
  );
}

// ─── Main no-code view ──────────────────────────────────────────────────────

function NoCodeView() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [customer, setCustomer] = useState<CustomerProfile | null>(() => getCustomer());
  const [editing, setEditing] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);
  const lastOrder = getLastOrder();

  const refresh = useCallback(() => {
    setCustomer(getCustomer());
    setHistoryKey((k) => k + 1);
  }, []);

  const handleTrack = () => {
    const val = inputRef.current?.value.trim().toUpperCase();
    if (val) window.location.href = `/track?code=${val}`;
  };

  return (
    <div className="min-h-screen bg-white px-4 py-10 flex flex-col items-center gap-8">
      <div className="w-full max-w-sm sm:max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-xs font-semibold tracking-widest text-muted-foreground uppercase mb-2">Island Tacos</div>
          <h1 className="text-2xl font-black">Track Your Order</h1>
        </div>

        {/* Track by code */}
        <div className="space-y-2 mb-6">
          <p className="text-sm text-muted-foreground text-center">Enter your confirmation code:</p>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              placeholder="e.g. ITAB1234"
              defaultValue={lastOrder?.code ?? ""}
              className="flex-1 border rounded-xl px-4 py-2.5 font-mono text-sm uppercase focus:outline-none focus:ring-2 focus:ring-primary"
              onKeyDown={(e) => e.key === "Enter" && handleTrack()}
            />
            <button
              onClick={handleTrack}
              className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90"
            >
              Track
            </button>
          </div>
          {lastOrder && (
            <a
              href={`/track?code=${lastOrder.code}`}
              className="block text-center text-xs text-primary font-semibold hover:underline"
            >
              View last order: {lastOrder.code} →
            </a>
          )}
        </div>

        <hr className="border-muted mb-6" />

        {/* Account section */}
        {customer ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <UserCircle className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold truncate">{customer.name}</p>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => setEditing((e) => !e)}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => { clearCustomer(); setCustomer(null); }}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Sign out"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground truncate">{customer.phone}</p>
                {customer.email && <p className="text-xs text-muted-foreground truncate">{customer.email}</p>}
              </div>
            </div>

            {editing && (
              <EditAccountForm
                profile={customer}
                onSave={(p) => { setCustomer(p); setEditing(false); setHistoryKey((k) => k + 1); }}
                onCancel={() => setEditing(false)}
              />
            )}

            {!editing && (
              <>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <span>Order History</span>
                </div>
                <CustomerHistorySection key={historyKey} phone={customer.phone} />
              </>
            )}
          </div>
        ) : (
          <CreateAccountForm onSave={refresh} />
        )}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { useTrackOrder, getTrackOrderQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, ChefHat, Package, XCircle, ArrowRight, Loader2, UserCircle, History, LogOut, Pencil, Check } from "lucide-react";
import { getCustomer, saveCustomer, clearCustomer, getLastOrder, type CustomerProfile } from "@/lib/customer-account";
import { useStoreSettings } from "@/lib/use-store-settings";

// ── IL Palette ────────────────────────────────────────────────────────────────
const BG   = "#16172b";
const CARD = "#1e1f38";
const BORD = "rgba(255,255,255,0.06)";
const TP   = "#e8eaf6";
const TM   = "#b0b8d8";
const MU   = "#7077a1";
const OR   = "#ff6b00";
const PUR  = "#7c6af7";
const GRN  = "#30d158";

const INP: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8, padding: "10px 14px", fontSize: 14, color: TP, outline: "none",
  width: "100%", boxSizing: "border-box", fontFamily: "inherit",
};

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function getCode(): string {
  return new URLSearchParams(window.location.search).get("code") ?? "";
}

function hasPtpReturn(): boolean {
  return new URLSearchParams(window.location.search).get("ptp") === "1";
}

export default function TrackOrder() {
  const { storeName } = useStoreSettings();
  const code = getCode().toUpperCase();
  const queryClient = useQueryClient();

  const { data: order, isLoading, error } = useTrackOrder(
    code,
    { query: { enabled: !!code, queryKey: getTrackOrderQueryKey(code) } }
  );

  // Placetopay return state — initialised from URL on mount
  const [ptpVerifying, setPtpVerifying] = useState(hasPtpReturn);
  const [ptpFailed,    setPtpFailed]    = useState(false);
  const [ptpSummary,   setPtpSummary]   = useState<{
    reference: string; amount: number; date: string | null; status: string; reason: string | null;
  } | null>(null);

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

  // Verify Placetopay payment when customer returns from hosted checkout
  useEffect(() => {
    if (!ptpVerifying || !code) return;
    let cancelled = false;

    const verify = async () => {
      try {
        const res  = await fetch(`${basePath}/api/payments/placetopay/verify`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ code }),
        });
        const data = await res.json() as {
          status?: string; reference?: string; amount?: number;
          date?: string | null; reason?: string | null;
        };

        if (cancelled) return;

        if (data.status === "APPROVED") {
          // Strip ?ptp=1 from URL so a page refresh doesn't re-verify
          const url = new URL(window.location.href);
          url.searchParams.delete("ptp");
          window.history.replaceState({}, "", url.toString());
          setPtpVerifying(false);
          // Refresh order data so the confirmed status shows
          queryClient.invalidateQueries({ queryKey: getTrackOrderQueryKey(code) });
        } else if (data.status === "REJECTED" || data.status === "FAILED") {
          setPtpSummary({
            reference: data.reference ?? code,
            amount:    data.amount ?? 0,
            date:      data.date ?? null,
            status:    data.status ?? "REJECTED",
            reason:    data.reason ?? null,
          });
          setPtpVerifying(false);
          setPtpFailed(true);
        } else {
          // PENDING — show summary while still polling
          if (data.reference) {
            setPtpSummary({
              reference: data.reference,
              amount:    data.amount ?? 0,
              date:      data.date ?? null,
              status:    "PENDING",
              reason:    data.reason ?? null,
            });
          }
          // Poll again in 3s
          setTimeout(() => { if (!cancelled) void verify(); }, 3000);
        }
      } catch {
        if (!cancelled) {
          setPtpVerifying(false);
          setPtpFailed(true);
        }
      }
    };

    void verify();
    return () => { cancelled = true; };
  }, [ptpVerifying, code, queryClient]);

  // ── Placetopay return screens ─────────────────────────────────────────────
  if (ptpVerifying) {
    return (
      <div style={{ minHeight: "100dvh", background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 16px", textAlign: "center" }}>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          <div style={{ width: 80, height: 80, borderRadius: 999, background: "rgba(124,106,247,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Loader2 style={{ width: 40, height: 40, color: PUR, animation: "spin 1s linear infinite" }} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: TP, margin: "0 0 8px" }}>Verifying your payment…</h1>
            <p style={{ color: MU, fontSize: 14, margin: 0 }}>Just a moment while we confirm with the payment provider.</p>
          </div>
          {/* Show session summary as soon as we have data (PENDING state) */}
          {ptpSummary && <PtpSessionSummary summary={ptpSummary} fallbackCode={code} />}
        </div>
      </div>
    );
  }

  if (ptpFailed) {
    return (
      <div style={{ minHeight: "100dvh", background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 16px", textAlign: "center" }}>
        <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", color: MU, textTransform: "uppercase", marginBottom: -8 }}>{storeName}</div>
          <div style={{ width: 96, height: 96, borderRadius: 999, background: "rgba(255,69,58,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <XCircle style={{ width: 56, height: 56, color: "#ff453a" }} />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: TP, margin: "0 0 8px" }}>Payment not completed</h1>
            <p style={{ color: MU, fontSize: 14, margin: 0, lineHeight: 1.6 }}>Your card payment was not approved. No charge was made.</p>
          </div>
          {/* Session summary — required by PlaceToPay certification */}
          <PtpSessionSummary summary={ptpSummary} fallbackCode={code} />
          <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
            <a
              href="/"
              style={{
                width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "13px 24px", borderRadius: 999, background: `linear-gradient(135deg,${OR},#ff3d00)`,
                color: "#fff", fontSize: 14, fontWeight: 700, textDecoration: "none",
                boxShadow: "0 4px 16px rgba(255,107,0,0.4)",
              }}
            >
              Back to menu
            </a>
          </div>
        </div>
      </div>
    );
  }

  // No code in URL — show search prompt
  if (!code) {
    return <NoCodeView />;
  }

  if (isLoading) {
    return <FullScreenState icon={<Loader2 style={{ width: 56, height: 56, color: PUR, animation: "spin 1s linear infinite" }} />} title="Looking up your order…" />;
  }

  if (error || !order) {
    return (
      <FullScreenState
        icon={<XCircle style={{ width: 56, height: 56, color: "#ff453a" }} />}
        title="Order not found"
        subtitle="Double-check your confirmation code."
        action={<TrackLink label="Try again" />}
      />
    );
  }

  const { status, confirmationCode, customerName, cancellationReason, items, total, estimatedReadyAt, scheduledPickupAt } = order as typeof order & { scheduledPickupAt?: string | null };

  function formatPickupTime(eta: Date | string | null | undefined, isScheduled: boolean): string | null {
    if (!eta) return null;
    const d = new Date(eta);
    if (isNaN(d.getTime())) return null;
    const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Puerto_Rico" });
    if (isScheduled) return `Scheduled for ${timeStr}`;
    const diffMs = d.getTime() - Date.now();
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin <= 1) return "Just a moment";
    if (diffMin < 60) return `About ${diffMin} min — ready around ${timeStr}`;
    return `Ready around ${timeStr}`;
  }

  const pickupTimeLabel = formatPickupTime(estimatedReadyAt, !!scheduledPickupAt);

  if (status === "cancelled") {
    return (
      <div style={{ minHeight: "100dvh", background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 16px", textAlign: "center" }}>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", color: MU, textTransform: "uppercase", marginBottom: -8 }}>{storeName}</div>

          <div style={{ width: 96, height: 96, borderRadius: 999, background: "rgba(255,69,58,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <XCircle style={{ width: 56, height: 56, color: "#ff453a" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: TP, margin: 0 }}>Order Not Accepted</h1>
            <p style={{ color: MU, fontSize: 14, margin: 0, lineHeight: 1.6 }}>
              Sorry {customerName ? customerName.split(" ")[0] + "," : ","} we couldn't accept your order at this time.
            </p>
          </div>

          {cancellationReason && (
            <div style={{ width: "100%", borderRadius: 14, border: "2px solid rgba(255,69,58,0.3)", background: "rgba(255,69,58,0.08)", padding: "16px 20px", textAlign: "left" }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#ff453a", marginBottom: 6 }}>Reason</p>
              <p style={{ fontSize: 15, fontWeight: 600, color: TP }}>{cancellationReason}</p>
            </div>
          )}

          <div style={{ background: CARD, borderRadius: 12, padding: "12px 20px", width: "100%", border: `1px solid ${BORD}` }}>
            <p style={{ fontSize: 12, color: MU, marginBottom: 4 }}>Order reference</p>
            <p style={{ fontSize: 24, fontFamily: "monospace", fontWeight: 900, color: OR, letterSpacing: "0.12em" }}>{confirmationCode}</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: "100%" }}>
            <Link
              href="/"
              style={{
                width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "12px 24px", borderRadius: 999,
                background: `linear-gradient(135deg,${OR},#ff3d00)`, color: "#fff",
                fontSize: 14, fontWeight: 700, textDecoration: "none",
                boxShadow: "0 4px 16px rgba(255,107,0,0.4)",
              }}
            >
              Order Again <ArrowRight style={{ width: 16, height: 16 }} />
            </Link>
            <p style={{ fontSize: 12, color: MU }}>We apologize for the inconvenience.</p>
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
            ? <Package style={{ width: 56, height: 56, color: isDone ? MU : GRN }} />
            : <CheckCircle2 style={{ width: 56, height: 56, color: GRN }} />
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
        pickupTime={(!isReady && !isDone) ? pickupTimeLabel : null}
        code={confirmationCode}
        orderSummary={{ items: items ?? [], total }}
        progress={status}
        action={
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: "100%" }}>
            <Link href="/" style={{
              width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "12px 24px", borderRadius: 999,
              background: `linear-gradient(135deg,${OR},#ff3d00)`, color: "#fff", fontSize: 14, fontWeight: 700,
              textDecoration: "none", boxShadow: "0 4px 16px rgba(255,107,0,0.4)",
            }}>
              {(isReady || isDone) ? "Order Again" : "Back to Menu"} <ArrowRight style={{ width: 16, height: 16 }} />
            </Link>
            <TrackLink label="Track order" code={code} />
          </div>
        }
      />
    );
  }

  // Pending — waiting for staff to accept
  return (
    <FullScreenState
      icon={<Clock style={{ width: 56, height: 56, color: "#ffd60a", animation: "pulse 2s ease-in-out infinite" }} />}
      title="Waiting for confirmation…"
      subtitle="Your order is being reviewed. This usually takes just a minute."
      pickupTime={pickupTimeLabel}
      code={confirmationCode}
      orderSummary={{ items: items ?? [], total }}
      action={
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: "100%" }}>
          <Link href="/" style={{
            width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "12px 24px", borderRadius: 999,
            background: `linear-gradient(135deg,${OR},#ff3d00)`, color: "#fff", fontSize: 14, fontWeight: 700,
            textDecoration: "none", boxShadow: "0 4px 16px rgba(255,107,0,0.4)",
          }}>
            Back to Menu <ArrowRight style={{ width: 16, height: 16 }} />
          </Link>
          <TrackLink label="Refresh status" code={code} />
        </div>
      }
    />
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/**
 * Session summary card — PlaceToPay certification requirement.
 * Shows Reference, Transaction Amount, Date, and Status after returning from checkout.
 */
function PtpSessionSummary({
  summary, fallbackCode,
}: {
  summary: { reference: string; amount: number; date: string | null; status: string; reason: string | null } | null;
  fallbackCode: string;
}) {
  const ref    = summary?.reference ?? fallbackCode;
  const amount = summary?.amount ?? null;
  const status = summary?.status ?? null;
  const reason = summary?.reason ?? null;
  const date   = summary?.date
    ? new Date(summary.date).toLocaleString("en-US", {
        month: "short", day: "numeric", year: "numeric",
        hour: "numeric", minute: "2-digit", timeZone: "America/Puerto_Rico",
      })
    : null;

  const statusColor = (s: string | null) => {
    if (s === "APPROVED") return GRN;
    if (s === "REJECTED" || s === "FAILED") return "#ff453a";
    return "#ffd60a";
  };
  const statusLabel = (s: string | null) => {
    if (!s) return "—";
    const m: Record<string, string> = {
      APPROVED: "Approved", REJECTED: "Rejected", FAILED: "Failed",
      PENDING: "Pending", REVERSED: "Reversed",
    };
    return m[s] ?? s;
  };

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
      <span style={{ fontSize: 13, color: MU, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: TP, fontWeight: 600, textAlign: "right", wordBreak: "break-all" }}>{value}</span>
    </div>
  );

  return (
    <div style={{ width: "100%", borderRadius: 14, border: `1px solid rgba(255,255,255,0.1)`, background: CARD, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10, textAlign: "left" }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: MU, margin: 0 }}>Transaction summary</p>
      <Row label="Reference"  value={<span style={{ fontFamily: "monospace", color: OR }}>{ref}</span>} />
      {amount !== null && <Row label="Amount" value={`$${amount.toFixed(2)} USD`} />}
      {date   && <Row label="Date" value={date} />}
      {status && <Row label="Status" value={<span style={{ color: statusColor(status) }}>{statusLabel(status)}</span>} />}
      {reason && <Row label="Message" value={<span style={{ color: MU, fontWeight: 400 }}>{reason}</span>} />}
    </div>
  );
}

type ModSel = { name: string; price: number };
type Item = { id: number; menuItemName: string; quantity: number; subtotal: number; notes?: string | null; modifierSelections?: ModSel[] | null };

function FullScreenState({
  icon, title, subtitle, code, orderSummary, progress, action, pickupTime,
}: {
  icon: React.ReactNode; title: string; subtitle?: string; code?: string;
  orderSummary?: { items: Item[]; total: number }; progress?: string;
  action?: React.ReactNode; pickupTime?: string | null;
}) {
  return (
    <div style={{ minHeight: "100dvh", background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 16px", textAlign: "center" }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
      `}</style>
      <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>

        {/* Brand */}
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", color: MU, textTransform: "uppercase", marginBottom: -8 }}>{storeName}</div>

        {/* Icon */}
        <div style={{ width: 96, height: 96, borderRadius: 999, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {icon}
        </div>

        {/* Text */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: TP, margin: 0, lineHeight: 1.2 }}>{title}</h1>
          {subtitle && <p style={{ color: MU, fontSize: 14, margin: 0, lineHeight: 1.6 }}>{subtitle}</p>}
        </div>

        {/* Pickup time badge */}
        {pickupTime && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,214,0,0.08)", border: "1px solid rgba(255,214,0,0.2)", borderRadius: 999, padding: "8px 16px" }}>
            <Clock style={{ width: 16, height: 16, color: "#ffd60a", flexShrink: 0 }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#ffd60a" }}>{pickupTime}</span>
          </div>
        )}

        {/* Confirmation code */}
        {code && (
          <div style={{ background: CARD, borderRadius: 12, padding: "12px 20px", width: "100%", border: `1px solid ${BORD}` }}>
            <p style={{ fontSize: 12, color: MU, marginBottom: 4 }}>Confirmation code</p>
            <p style={{ fontSize: 24, fontFamily: "monospace", fontWeight: 900, color: OR, letterSpacing: "0.12em" }}>{code}</p>
          </div>
        )}

        {/* Progress steps */}
        {progress && <ProgressSteps status={progress} />}

        {/* Order summary */}
        {orderSummary && orderSummary.items.length > 0 && (
          <div style={{ width: "100%", borderRadius: 14, border: `1px solid ${BORD}`, background: CARD, textAlign: "left", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            {orderSummary.items.map((item) => (
              <div key={item.id} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: TM, fontSize: 14 }}>
                  <span><span style={{ fontWeight: 600, color: TP }}>{item.quantity}×</span> {item.menuItemName}</span>
                  <span style={{ color: TP }}>${item.subtotal.toFixed(2)}</span>
                </div>
                {(item.modifierSelections ?? []).map((m, i) => (
                  <p key={i} style={{ fontSize: 12, color: MU, margin: 0, paddingLeft: 20, fontStyle: "italic" }}>+ {m.name}</p>
                ))}
                {item.notes && (item.modifierSelections ?? []).length === 0 && (
                  <p style={{ fontSize: 12, color: MU, margin: 0, paddingLeft: 20, fontStyle: "italic" }}>{item.notes}</p>
                )}
              </div>
            ))}
            <div style={{ borderTop: `1px solid ${BORD}`, paddingTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 16, color: TP }}>
              <span>Total</span>
              <span>${orderSummary.total.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Action */}
        {action && <div style={{ width: "100%" }}>{action}</div>}
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
    <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", padding: "0 4px" }}>
      {/* Track line */}
      <div style={{ position: "absolute", top: 16, left: 24, right: 24, height: 2, background: "rgba(255,255,255,0.08)", zIndex: 0 }} />
      {STEPS.map((step, i) => {
        const done = currentIdx >= STEP_ORDER.indexOf(step.key);
        const Icon = step.icon;
        return (
          <div key={step.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, zIndex: 1 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center",
              border: `2px solid ${done ? OR : "rgba(255,255,255,0.12)"}`,
              background: done ? `linear-gradient(135deg,${OR},#ff3d00)` : CARD,
              color: done ? "#fff" : MU,
              boxShadow: done ? `0 0 12px rgba(255,107,0,0.5)` : "none",
              transition: "all 0.3s",
            }}>
              <Icon style={{ width: 14, height: 14 }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 600, color: done ? OR : MU }}>{step.label}</span>
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
      style={{
        display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 999,
        border: `1px solid rgba(255,255,255,0.12)`, fontSize: 14, fontWeight: 600,
        color: TM, textDecoration: "none", background: "rgba(255,255,255,0.04)",
        transition: "all 0.15s",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = TP; }}
      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = TM; }}
    >
      {label} <ArrowRight style={{ width: 16, height: 16 }} />
    </a>
  );
}

// ─── Customer history ─────────────────────────────────────────────────────────

type HistoryOrder = {
  id: number; confirmationCode: string; status: string;
  total: number; createdAt: string;
  items: { menuItemName: string; quantity: number }[];
};

function statusBadgeStyle(s: string): React.CSSProperties {
  if (s === "completed") return { background: "rgba(48,209,88,0.12)", color: GRN, border: "1px solid rgba(48,209,88,0.25)" };
  if (s === "cancelled") return { background: "rgba(255,69,58,0.12)", color: "#ff453a", border: "1px solid rgba(255,69,58,0.25)" };
  if (s === "ready")     return { background: "rgba(14,165,233,0.12)", color: "#0ea5e9", border: "1px solid rgba(14,165,233,0.25)" };
  return { background: "rgba(255,214,0,0.1)", color: "#ffd60a", border: "1px solid rgba(255,214,0,0.25)" };
}

function statusLabel(s: string) {
  const map: Record<string, string> = { pending: "Pending", confirmed: "Confirmed", preparing: "Preparing", ready: "Ready", completed: "Completed", cancelled: "Cancelled" };
  return map[s] ?? s;
}

function CustomerHistorySection({ phone }: { phone: string }) {
  const [orders, setOrders] = useState<HistoryOrder[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!phone) return;
    setLoading(true);
    fetch(`/api/orders?customerPhone=${encodeURIComponent(phone)}`)
      .then(r => r.json())
      .then(data => setOrders((data as HistoryOrder[]).map(o => ({ id: o.id, confirmationCode: o.confirmationCode, status: o.status, total: o.total, createdAt: o.createdAt, items: o.items }))))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [phone]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 0", gap: 8, color: MU, fontSize: 14 }}>
      <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} /> Loading history…
    </div>
  );

  if (!orders || orders.length === 0) return (
    <div style={{ padding: "32px 0", textAlign: "center", color: MU, fontSize: 14 }}>No orders found.</div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {orders.map(o => (
        <a
          key={o.id} href={`/track?code=${o.confirmationCode}`}
          style={{
            display: "flex", alignItems: "center", gap: 12, padding: 16,
            borderRadius: 12, border: `1px solid ${BORD}`, background: "rgba(255,255,255,0.02)",
            textDecoration: "none", transition: "background 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14, color: TP }}>{o.confirmationCode}</span>
              <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, ...statusBadgeStyle(o.status) }}>
                {statusLabel(o.status)}
              </span>
            </div>
            <div style={{ fontSize: 12, color: MU, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {o.items?.map(i => `${i.quantity}x ${i.menuItemName}`).join(", ")}
            </div>
            <div style={{ fontSize: 12, color: MU }}>
              {new Date(o.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              {" · "}
              <span style={{ fontWeight: 600, color: TM }}>${Number(o.total).toFixed(2)}</span>
            </div>
          </div>
          <ArrowRight style={{ width: 16, height: 16, color: MU, flexShrink: 0 }} />
        </a>
      ))}
    </div>
  );
}

// ─── Create account form ──────────────────────────────────────────────────────

function CreateAccountForm({ onSave }: { onSave: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          width: "100%", fontSize: 14, color: MU, border: `1px dashed rgba(255,255,255,0.12)`,
          borderRadius: 12, padding: "12px 16px", background: "transparent", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.15s",
        }}
        onMouseEnter={e => { e.currentTarget.style.color = TM; e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; }}
        onMouseLeave={e => { e.currentTarget.style.color = MU; e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
      >
        <UserCircle style={{ width: 16, height: 16 }} /> Save your info for faster checkout
      </button>
    );
  }

  return (
    <div style={{ border: `1px solid ${BORD}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 10, background: "rgba(255,255,255,0.02)" }}>
      <p style={{ fontWeight: 600, fontSize: 14, color: TP, margin: 0 }}>Save your info</p>
      <p style={{ fontSize: 12, color: MU, margin: 0 }}>Your info is saved on this device only. No account or password needed.</p>
      <input style={INP} placeholder="Full Name *" value={name} onChange={e => setName(e.target.value)} />
      <input style={INP} placeholder="Phone (e.g. 787-000-0000) *" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
      <input style={INP} placeholder="Email (optional)" type="email" value={email} onChange={e => setEmail(e.target.value)} />
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => {
            if (!name.trim() || !phone.trim()) return;
            saveCustomer({ name: name.trim(), phone: phone.trim(), email: email.trim() });
            onSave();
          }}
          style={{ flex: 1, padding: "10px 0", borderRadius: 8, background: `linear-gradient(135deg,${OR},#ff3d00)`, color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}
        >
          Save
        </button>
        <button
          onClick={() => setOpen(false)}
          style={{ padding: "10px 16px", borderRadius: 8, border: `1px solid ${BORD}`, background: "transparent", color: TM, fontSize: 14, cursor: "pointer" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Edit account form ────────────────────────────────────────────────────────

function EditAccountForm({ profile, onSave, onCancel }: { profile: CustomerProfile; onSave: (p: CustomerProfile) => void; onCancel: () => void }) {
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [email, setEmail] = useState(profile.email);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input style={INP} value={name} onChange={e => setName(e.target.value)} placeholder="Full Name" />
      <input style={INP} value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone" type="tel" />
      <input style={INP} value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email" />
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => {
            if (!name.trim() || !phone.trim()) return;
            const updated = { name: name.trim(), phone: phone.trim(), email: email.trim() };
            saveCustomer(updated);
            onSave(updated);
          }}
          style={{ flex: 1, padding: "10px 0", borderRadius: 8, background: `linear-gradient(135deg,${PUR},#5b4cf5)`, color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        >
          <Check style={{ width: 14, height: 14 }} /> Save
        </button>
        <button onClick={onCancel} style={{ padding: "10px 16px", borderRadius: 8, border: `1px solid ${BORD}`, background: "transparent", color: TM, fontSize: 14, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── No-code view (track page without a code in URL) ─────────────────────────

function NoCodeView() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [customer, setCustomer] = useState<CustomerProfile | null>(() => getCustomer());
  const [editing, setEditing] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);
  const lastOrder = getLastOrder();

  const refresh = useCallback(() => {
    setCustomer(getCustomer());
    setHistoryKey(k => k + 1);
  }, []);

  const handleTrack = () => {
    const val = inputRef.current?.value.trim().toUpperCase();
    if (val) window.location.href = `/track?code=${val}`;
  };

  return (
    <div style={{ minHeight: "100dvh", background: BG, color: TP, padding: "40px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 32, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: "100%", maxWidth: 448 }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: MU, textDecoration: "none", marginBottom: 12 }}>
            ← Back to Menu
          </Link>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", color: MU, textTransform: "uppercase", marginBottom: 8 }}>{storeName}</div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: TP, margin: 0 }}>Track Your Order</h1>
        </div>

        {/* Track by code */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
          <p style={{ fontSize: 14, color: MU, textAlign: "center", margin: 0 }}>Enter your confirmation code:</p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              ref={inputRef}
              placeholder="e.g. ITAB1234"
              defaultValue={lastOrder?.code ?? ""}
              style={{ ...INP, flex: 1, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.05em" }}
              onKeyDown={e => e.key === "Enter" && handleTrack()}
            />
            <button
              onClick={handleTrack}
              style={{
                padding: "10px 18px", borderRadius: 10, background: `linear-gradient(135deg,${OR},#ff3d00)`,
                color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer",
                boxShadow: "0 4px 14px rgba(255,107,0,0.4)", flexShrink: 0,
              }}
            >
              Track
            </button>
          </div>
          {lastOrder && (
            <a
              href={`/track?code=${lastOrder.code}`}
              style={{ display: "block", textAlign: "center", fontSize: 13, color: OR, fontWeight: 600, textDecoration: "none" }}
            >
              View last order: {lastOrder.code} →
            </a>
          )}
        </div>

        <div style={{ height: 1, background: BORD, marginBottom: 24 }} />

        {/* Account section */}
        {customer ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 999, background: `rgba(124,106,247,0.12)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <UserCircle style={{ width: 20, height: 20, color: PUR }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <p style={{ fontWeight: 700, color: TP, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{customer.name}</p>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button
                      onClick={() => setEditing(e => !e)} title="Edit"
                      style={{ padding: 6, borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", color: MU, display: "flex", transition: "all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = TM; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = MU; }}
                    >
                      <Pencil style={{ width: 14, height: 14 }} />
                    </button>
                    <button
                      onClick={() => { clearCustomer(); setCustomer(null); }} title="Sign out"
                      style={{ padding: 6, borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", color: MU, display: "flex", transition: "all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,69,58,0.1)"; e.currentTarget.style.color = "#ff453a"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = MU; }}
                    >
                      <LogOut style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: MU, margin: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{customer.phone}</p>
                {customer.email && <p style={{ fontSize: 12, color: MU, margin: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{customer.email}</p>}
              </div>
            </div>

            {editing && (
              <EditAccountForm
                profile={customer}
                onSave={p => { setCustomer(p); setEditing(false); setHistoryKey(k => k + 1); }}
                onCancel={() => setEditing(false)}
              />
            )}

            {!editing && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: TM }}>
                  <History style={{ width: 16, height: 16, color: MU }} />
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

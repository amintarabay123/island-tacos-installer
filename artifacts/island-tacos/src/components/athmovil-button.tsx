import { useState, useEffect, useRef } from "react";
import { CheckCircle, Smartphone, Copy, Check, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── Automatic push-payment button ──────────────────────────────────────────
// Flow: server calls ATH Móvil → push notification to customer's phone →
//       customer taps Approve in app → server polls findPayment → marks paid

interface AthMovilDirectButtonProps {
  orderId: number;
  total: number;
  confirmationCode: string;
  customerPhone: string;
  onCompleted: () => void;
}

type PaymentStatus = "sending" | "waiting" | "completed" | "cancelled" | "error";

export function AthMovilDirectButton({
  orderId,
  total,
  confirmationCode,
  customerPhone,
  onCompleted,
}: AthMovilDirectButtonProps) {
  const [status, setStatus] = useState<PaymentStatus>("sending");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const ecommerceIdRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Step 1: Create session (send push to customer phone)
  useEffect(() => {
    let cancelled = false;
    const createSession = async () => {
      try {
        const res = await fetch(`${basePath}/api/payments/athmovil/create-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        });
        const data = await res.json() as { ecommerceId?: string; error?: string; detail?: string };

        if (cancelled || !mountedRef.current) return;

        if (!res.ok || !data.ecommerceId) {
          setErrorDetail(data.detail ?? data.error ?? "ATH Móvil could not send payment request");
          setStatus("error");
          return;
        }

        ecommerceIdRef.current = data.ecommerceId;
        setStatus("waiting");
        startPolling();
      } catch (err) {
        if (cancelled || !mountedRef.current) return;
        setErrorDetail("Could not reach server");
        setStatus("error");
      }
    };

    createSession();
    return () => { cancelled = true; };
  }, [orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Step 2: Poll for customer approval
  const startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      if (!mountedRef.current) return;
      try {
        const res = await fetch(`${basePath}/api/payments/athmovil/check-status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        });
        const data = await res.json() as { status?: string };
        if (!mountedRef.current) return;

        if (data.status === "COMPLETED") {
          clearInterval(pollRef.current!);
          setStatus("completed");
          setTimeout(() => { if (mountedRef.current) onCompleted(); }, 1500);
        } else if (data.status === "CANCEL") {
          clearInterval(pollRef.current!);
          setStatus("cancelled");
        }
      } catch { /* retry next tick */ }
    }, 5_000);
  };

  const retry = () => {
    setStatus("sending");
    setErrorDetail(null);
  };

  if (status === "sending") {
    return (
      <div className="rounded-xl bg-orange-50 border border-orange-200 p-6 text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto" />
        <p className="font-semibold text-orange-900">Sending payment request…</p>
        <p className="text-sm text-orange-700">
          We're notifying your ATH Móvil app to request ${total.toFixed(2)}.
        </p>
      </div>
    );
  }

  if (status === "waiting") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-orange-50 border border-orange-200 p-5 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center mx-auto">
            <Smartphone className="w-7 h-7 text-orange-600" />
          </div>
          <p className="font-bold text-orange-900 text-lg">Check your ATH Móvil app</p>
          <p className="text-sm text-orange-700">
            We sent a <strong>${total.toFixed(2)}</strong> payment request to the ATH Móvil app on <strong>{customerPhone}</strong>.
            Open the app and tap <strong>Approve</strong> to complete your order.
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-orange-500 pt-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Waiting for your approval…
          </div>
        </div>
        <p className="text-xs text-center text-muted-foreground">
          Order #{confirmationCode} · ${total.toFixed(2)} · Held for 10 minutes
        </p>
      </div>
    );
  }

  if (status === "completed") {
    return (
      <div className="rounded-xl bg-green-50 border border-green-200 p-6 text-center space-y-3">
        <CheckCircle className="w-10 h-10 text-green-600 mx-auto" />
        <p className="font-bold text-green-900 text-lg">Payment received!</p>
        <p className="text-sm text-green-700">Taking you to your order…</p>
      </div>
    );
  }

  if (status === "cancelled") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-red-50 border border-red-200 p-5 text-center space-y-2">
          <p className="font-semibold text-red-900">Payment request expired or was declined</p>
          <p className="text-sm text-red-700">Your order is still held. Try sending a new request.</p>
        </div>
        <Button onClick={retry} className="w-full" variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" /> Send new payment request
        </Button>
        <div className="border-t pt-4">
          <AthMovilInstructions
            total={total}
            confirmationCode={confirmationCode}
            onPaymentSent={onCompleted}
          />
        </div>
      </div>
    );
  }

  // error state
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-5 space-y-2">
        <p className="font-semibold text-amber-900">Couldn't send automatic payment request</p>
        {errorDetail && <p className="text-xs text-amber-700 font-mono">{errorDetail}</p>}
        <Button onClick={retry} size="sm" variant="outline" className="mt-2">
          <RefreshCw className="h-4 w-4 mr-2" /> Try again
        </Button>
      </div>
      <div className="border-t pt-4">
        <p className="text-sm text-muted-foreground mb-3 text-center">Or pay manually:</p>
        <AthMovilInstructions
          total={total}
          confirmationCode={confirmationCode}
          onPaymentSent={onCompleted}
        />
      </div>
    </div>
  );
}


// ─── Manual instructions fallback ───────────────────────────────────────────

interface AthMovilInstructionsProps {
  total: number;
  confirmationCode: string;
  onPaymentSent: () => void;
}

export function AthMovilInstructions({
  total,
  confirmationCode,
  onPaymentSent,
}: AthMovilInstructionsProps) {
  const [copied, setCopied] = useState(false);
  const [waiting, setWaiting] = useState(false);

  const copyCode = async () => {
    await navigator.clipboard.writeText(confirmationCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Smartphone className="h-5 w-5 text-orange-600" />
          <p className="font-semibold text-orange-900">Pay with ATH Móvil App</p>
        </div>

        <ol className="space-y-2 text-sm text-orange-800">
          <li className="flex gap-2">
            <span className="font-bold shrink-0">1.</span>
            <span>Open the <strong>ATH Móvil</strong> app on your phone</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold shrink-0">2.</span>
            <span>Tap <strong>"Pay a Business"</strong> and search for <strong>Island Tacos</strong></span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold shrink-0">3.</span>
            <span>Enter exactly <strong className="text-lg">${total.toFixed(2)}</strong></span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold shrink-0">4.</span>
            <div>
              <span>In the <strong>message/note</strong> field, type your order code:</span>
              <button
                onClick={copyCode}
                className="flex items-center gap-2 mt-1 bg-white border border-orange-300 rounded-lg px-3 py-1.5 font-mono font-bold text-orange-900 text-base hover:bg-orange-50 transition-colors w-full"
              >
                <span className="flex-1">{confirmationCode}</span>
                {copied
                  ? <Check className="h-4 w-4 text-green-600 shrink-0" />
                  : <Copy className="h-4 w-4 text-orange-500 shrink-0" />}
              </button>
              <p className="text-xs text-orange-600 mt-1">Tap to copy</p>
            </div>
          </li>
          <li className="flex gap-2">
            <span className="font-bold shrink-0">5.</span>
            <span>Send the payment, then tap the button below</span>
          </li>
        </ol>
      </div>

      <Button
        onClick={() => { setWaiting(true); onPaymentSent(); }}
        disabled={waiting}
        className="w-full bg-orange-600 hover:bg-orange-700 text-white"
        size="lg"
      >
        {waiting ? (
          <span className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Checking payment…
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            I've sent the payment
          </span>
        )}
      </Button>
    </div>
  );
}

export { AthMovilInstructions as AthMovilButton };
export { AthMovilDirectButton as AthMovilEcommerceButton };

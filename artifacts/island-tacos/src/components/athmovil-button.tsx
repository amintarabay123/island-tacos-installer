import { useState, useEffect, useRef } from "react";
import { CheckCircle, Smartphone, Copy, Check, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── Server-side session button (no JS SDK, no domain whitelist needed) ─────

interface AthMovilDirectButtonProps {
  orderId: number;
  total: number;
  confirmationCode: string;
  onCompleted: () => void;
}

export function AthMovilDirectButton({
  orderId,
  total,
  confirmationCode,
  onCompleted,
}: AthMovilDirectButtonProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Create the ATH Móvil session server-side when the component mounts
  useEffect(() => {
    setStatus("loading");
    fetch(`${basePath}/api/payments/athmovil/create-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    })
      .then(async (res) => {
        if (!mountedRef.current) return;
        if (!res.ok) throw new Error("session_failed");
        const data = await res.json() as { redirectUrl?: string };
        if (!data.redirectUrl) throw new Error("no_url");
        setRedirectUrl(data.redirectUrl);
        setStatus("ready");
      })
      .catch(() => {
        if (mountedRef.current) setStatus("error");
      });
  }, [orderId]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Preparing ATH Móvil payment…</span>
      </div>
    );
  }

  if (status === "error" || !redirectUrl) {
    return (
      <AthMovilInstructions
        total={total}
        confirmationCode={confirmationCode}
        onPaymentSent={onCompleted}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* ATH Móvil branded payment link */}
      <a
        href={redirectUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => setOpened(true)}
        className="flex items-center justify-center gap-3 w-full bg-[#FF6542] hover:bg-[#e5532f] active:bg-[#cc4a28] text-white font-bold text-base rounded-xl py-4 px-6 transition-colors shadow-sm"
      >
        <img
          src="https://www.athmovil.com/img/logo/ath-movil-logo-white.png"
          alt=""
          className="h-5 w-auto"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        Pay ${total.toFixed(2)} with ATH Móvil
        <ExternalLink className="w-4 h-4 opacity-80" />
      </a>

      <p className="text-xs text-center text-muted-foreground">
        Tapping the button will open ATH Móvil with the amount pre-filled.
      </p>

      {opened && (
        <div className="rounded-xl bg-orange-50 border border-orange-200 p-4 space-y-3">
          <p className="text-sm font-semibold text-orange-900 text-center">
            Did you complete the payment in ATH Móvil?
          </p>
          <Button
            onClick={onCompleted}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white"
            size="lg"
          >
            <CheckCircle className="h-5 w-5 mr-2" />
            Yes, I've paid
          </Button>
          <button
            onClick={() => setOpened(false)}
            className="w-full text-xs text-muted-foreground underline"
          >
            I haven't paid yet — let me try again
          </button>
        </div>
      )}
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

// Legacy alias kept for any existing imports
export { AthMovilInstructions as AthMovilButton };
export { AthMovilDirectButton as AthMovilEcommerceButton };

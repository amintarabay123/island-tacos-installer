import { useState, useEffect, useRef } from "react";
import { CheckCircle, Smartphone, Copy, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const ATH_SCRIPT_URL =
  "https://cdn.jsdelivr.net/gh/evertec/athmovil-javascript-api@master/dist/athmovil.min.js";

// ─── eCommerce button (opens ATH Móvil app with amount pre-filled) ──────────

interface AthMovilEcommerceButtonProps {
  orderId: number;
  total: number;
  publicToken: string;
  items: { name: string; quantity: number; price: number }[];
  onCompleted: (referenceNumber: string) => void;
  onCancelled: () => void;
}

export function AthMovilEcommerceButton({
  orderId,
  total,
  publicToken,
  items,
  onCompleted,
  onCancelled,
}: AthMovilEcommerceButtonProps) {
  const [scriptError, setScriptError] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    // Configure the ATHM_Checkout global BEFORE loading the script
    (window as Record<string, unknown>)["ATHM_Checkout"] = {
      env: "production",
      publicToken,
      timeout: 600,
      total: parseFloat(total.toFixed(2)),
      subtotal: parseFloat(total.toFixed(2)),
      tax: 0.0,
      metadata1: String(orderId),
      metadata2: "",
      items: items.map((i) => ({
        name: i.name,
        description: "",
        quantity: i.quantity,
        price: parseFloat(i.price.toFixed(2)),
        metadata: "",
      })),
    };

    (window as Record<string, unknown>)["ATHM_Checkout_Completed"] = async (response: { referenceNumber?: string }) => {
      if (!mountedRef.current) return;
      setVerifying(true);
      try {
        const res = await fetch(`${basePath}/api/payments/athmovil/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, referenceNumber: response.referenceNumber }),
        });
        if (res.ok) {
          onCompleted(response.referenceNumber ?? "");
        }
      } finally {
        if (mountedRef.current) setVerifying(false);
      }
    };

    (window as Record<string, unknown>)["ATHM_Checkout_Cancelled"] = () => {
      if (mountedRef.current) onCancelled();
    };

    (window as Record<string, unknown>)["ATHM_Checkout_Expired"] = () => {
      if (mountedRef.current) setScriptError(true);
    };

    // Remove any previous instance of the script
    const prev = document.getElementById("athmovil-js");
    if (prev) prev.remove();

    const script = document.createElement("script");
    script.id = "athmovil-js";
    script.src = ATH_SCRIPT_URL;
    script.async = false;
    script.onerror = () => { if (mountedRef.current) setScriptError(true); };
    document.body.appendChild(script);

    return () => {
      const s = document.getElementById("athmovil-js");
      if (s) s.remove();
      delete (window as Record<string, unknown>)["ATHM_Checkout"];
      delete (window as Record<string, unknown>)["ATHM_Checkout_Completed"];
      delete (window as Record<string, unknown>)["ATHM_Checkout_Cancelled"];
      delete (window as Record<string, unknown>)["ATHM_Checkout_Expired"];
    };
  }, [orderId, total, publicToken]); // eslint-disable-line react-hooks/exhaustive-deps

  if (verifying) {
    return (
      <div className="flex items-center justify-center gap-3 py-6 text-orange-600">
        <div className="w-5 h-5 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
        <span className="font-medium">Verifying payment…</span>
      </div>
    );
  }

  if (scriptError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-start gap-2">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Could not load ATH Móvil button.</p>
          <p className="mt-1">Please use the ATH Móvil app and pay <strong>/islandtaco</strong> — use your order code as the note.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground text-center">
        Tap the button below — it will open ATH Móvil with the exact amount already filled in.
      </p>
      {/* ATH Móvil renders their button into this div */}
      <div id="ATHMovil_Checkout_Button" className="flex justify-center" />
    </div>
  );
}


// ─── Manual instructions (fallback / Pay a Business flow) ───────────────────

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

  const handlePaymentSent = () => {
    setWaiting(true);
    onPaymentSent();
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
        onClick={handlePaymentSent}
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

      <p className="text-xs text-center text-muted-foreground">
        Your order will be confirmed as soon as we receive your payment.
      </p>
    </div>
  );
}

export { AthMovilInstructions as AthMovilButton };

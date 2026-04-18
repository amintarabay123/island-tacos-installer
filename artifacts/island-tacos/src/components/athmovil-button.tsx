import { useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";

interface CartItem {
  name: string;
  quantity: number;
  price: number;
}

interface AthMovilButtonProps {
  publicToken: string;
  total: number;
  subtotal: number;
  tax: number;
  orderId: number;
  items: CartItem[];
  onCompleted: (referenceNumber: string) => void;
  onCancelled: () => void;
  onExpired: () => void;
}

declare global {
  interface Window {
    ATHM_Checkout: {
      init: (config: Record<string, unknown>) => void;
    };
  }
}

export function AthMovilButton({
  publicToken,
  total,
  subtotal,
  tax,
  orderId,
  items,
  onCompleted,
  onCancelled,
  onExpired,
}: AthMovilButtonProps) {
  const initialized = useRef(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const initCheckout = () => {
      try {
        if (!window.ATHM_Checkout) {
          setSdkError("ATH Móvil could not be loaded. Please try Pay at Pickup instead.");
          setLoading(false);
          return;
        }
        window.ATHM_Checkout.init({
          env: "production",
          publicToken,
          timeout: 600,
          total,
          subtotal,
          tax,
          metadata1: String(orderId),
          metadata2: "",
          items: items.map((i) => ({
            name: i.name,
            description: "",
            quantity: i.quantity,
            price: i.price,
            metadata: "",
          })),
          onCompletedPayment: (payment: { referenceNumber: string }) => {
            onCompleted(payment.referenceNumber);
          },
          onCancelledPayment: () => onCancelled(),
          onExpiredPayment: () => onExpired(),
        });
        setLoading(false);
      } catch (err) {
        console.error("ATH Móvil SDK init error:", err);
        setSdkError(
          "ATH Móvil is not available on this device or browser. Please try Pay at Pickup or use another payment method."
        );
        setLoading(false);
      }
    };

    // Global error handler for non-Error exceptions thrown by the SDK
    const handleWindowError = (event: ErrorEvent) => {
      if (
        event.filename?.includes("athmovilV3") ||
        event.filename?.includes("athmovil")
      ) {
        event.preventDefault();
        setSdkError(
          "ATH Móvil is not available right now. Please try Pay at Pickup instead."
        );
        setLoading(false);
      }
    };
    window.addEventListener("error", handleWindowError);

    const existingScript = document.getElementById("athmovil-sdk");
    if (existingScript) {
      initCheckout();
      return () => window.removeEventListener("error", handleWindowError);
    }

    const script = document.createElement("script");
    script.id = "athmovil-sdk";
    script.src = "https://www.athmovil.com/api/js/v3/athmovilV3.js";
    script.async = true;
    script.onload = initCheckout;
    script.onerror = () => {
      setSdkError(
        "Could not connect to ATH Móvil. Please check your connection or try Pay at Pickup."
      );
      setLoading(false);
    };
    document.body.appendChild(script);

    return () => window.removeEventListener("error", handleWindowError);
  }, []);

  if (sdkError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
        <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-red-800">ATH Móvil Unavailable</p>
          <p className="text-sm text-red-700 mt-1">{sdkError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div id="ATH_Movil_Checkout_Button" className="flex justify-center min-h-[50px]" />
      {loading && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <div className="w-4 h-4 border-2 border-muted border-t-foreground rounded-full animate-spin" />
          <span>Loading ATH Móvil…</span>
        </div>
      )}
    </div>
  );
}

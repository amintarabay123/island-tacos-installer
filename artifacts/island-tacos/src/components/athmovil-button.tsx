import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

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

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const existingScript = document.getElementById("athmovil-sdk");
    const initCheckout = () => {
      if (!window.ATHM_Checkout) return;
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
    };

    if (existingScript) {
      initCheckout();
      return;
    }

    const script = document.createElement("script");
    script.id = "athmovil-sdk";
    script.src = "https://www.athmovil.com/api/js/v3/athmovilV3.js";
    script.async = true;
    script.onload = initCheckout;
    document.body.appendChild(script);
  }, []);

  return (
    <div className="space-y-4">
      <div id="ATH_Movil_Checkout_Button" className="flex justify-center" />
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Opening ATH Movil — complete payment in the app</span>
      </div>
    </div>
  );
}

import { useState } from "react";
import { CheckCircle, Smartphone, ArrowRight, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

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
            <ArrowRight className="h-4 w-4 ml-auto" />
          </span>
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        Your order will be confirmed as soon as we receive your payment.
      </p>
    </div>
  );
}

// Keep backward compat export name
export { AthMovilInstructions as AthMovilButton };

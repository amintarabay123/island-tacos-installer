const SUBSCRIBE_URL =
  "https://payments.athmovil.com/api/business-transaction/ecommerce/business/webhook/subscribe";

export async function registerAthMovilWebhook(listenerURL: string): Promise<void> {
  const publicToken = process.env["ATHMOVIL_PUBLIC_TOKEN"];
  const privateToken = process.env["ATHMOVIL_PRIVATE_TOKEN"];

  if (!publicToken || !privateToken) {
    console.log("[ATH webhook] Skipping registration — tokens not configured");
    return;
  }

  const body = {
    publicToken,
    privateToken,
    listenerURL,
    paymentReceivedEvent: true,
    refundSentEvent: false,
    donationReceivedEvent: false,
    ecommercePaymentReceivedEvent: true,
    ecommercePaymentCancelledEvent: true,
    ecommercePaymentExpiredEvent: true,
  };

  // ATH Móvil's subscribe endpoint requires the private token as a Bearer token
  // in addition to having it in the request body.
  const attemptVariants: Array<Record<string, string>> = [
    { "Content-Type": "application/json", "Authorization": `Bearer ${privateToken}` },
    { "Content-Type": "application/json", "Authorization": `Bearer ${publicToken}` },
    { "Content-Type": "application/json" },
  ];

  for (const headers of attemptVariants) {
    try {
      const res = await fetch(SUBSCRIBE_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (res.ok) {
        console.log(`[ATH webhook] Registered webhook URL: ${listenerURL}`);
        return;
      }

      const resBody = await res.text();
      console.log(`[ATH webhook] Registration attempt returned ${res.status}: ${resBody.slice(0, 200)}`);
    } catch (err) {
      console.log(`[ATH webhook] Registration attempt failed: ${err}`);
    }
  }

  // Registration failed through all variants — manual setup required.
  // The webhook URL to enter in the ATH Móvil Business app is:
  // https://orders.islandtacosbvi.com/api/webhooks/athmovil
  console.log("[ATH webhook] Auto-registration unsuccessful — webhook must be set manually in the ATH Móvil Business app.");
}

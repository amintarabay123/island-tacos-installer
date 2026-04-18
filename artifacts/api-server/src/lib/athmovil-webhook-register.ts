const SUBSCRIBE_URL =
  "https://payments.athmovil.com/api/business-transaction/ecommerce/business/webhook/subscribe";

export async function registerAthMovilWebhook(listenerURL: string): Promise<void> {
  const publicToken = process.env["ATHMOVIL_PUBLIC_TOKEN"];
  const privateToken = process.env["ATHMOVIL_PRIVATE_TOKEN"];

  if (!publicToken || !privateToken) {
    console.log("[ATH webhook] Skipping registration — tokens not configured");
    return;
  }

  try {
    const res = await fetch(SUBSCRIBE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicToken,
        privateToken,
        listenerURL,
        paymentReceivedEvent: true,
        refundSentEvent: false,
        donationReceivedEvent: false,
        ecommercePaymentReceivedEvent: true,
        ecommercePaymentCancelledEvent: true,
        ecommercePaymentExpiredEvent: true,
      }),
    });

    if (res.ok) {
      console.log(`[ATH webhook] Registered webhook URL: ${listenerURL}`);
    } else {
      const body = await res.text();
      console.warn(`[ATH webhook] Registration returned ${res.status}: ${body}`);
    }
  } catch (err) {
    console.warn("[ATH webhook] Registration failed:", err);
  }
}

import express, { Router, type IRouter } from "express";
import crypto from "crypto";
import { handleInboundMessage, sendWhatsAppMessage } from "../lib/whatsapp";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ── Webhook verification (GET) ────────────────────────────────────────────────
// Meta calls this once when you save the webhook URL in the dashboard.
// We reply with hub.challenge to confirm ownership.

router.get("/whatsapp/webhook", (req, res): void => {
  const mode      = req.query["hub.mode"];
  const token     = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const verifyToken = process.env.META_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken) {
    logger.info("[whatsapp] Webhook verified by Meta");
    res.status(200).send(challenge);
  } else {
    logger.warn({ mode, token }, "[whatsapp] Webhook verification failed");
    res.status(403).send("Forbidden");
  }
});

// ── Inbound messages (POST) ───────────────────────────────────────────────────
// Meta sends JSON here for every inbound WhatsApp message.
// We reply 200 immediately (Meta retries otherwise) and send the AI reply
// via a separate outbound API call.

router.post("/whatsapp/webhook", async (req, res): Promise<void> => {
  // Always ack Meta immediately — they retry aggressively on non-200
  res.status(200).json({ status: "ok" });

  if (process.env.META_WHATSAPP_ENABLED !== "true") return;

  // Verify x-hub-signature-256 when META_APP_SECRET is configured
  const appSecret = process.env.META_APP_SECRET;
  if (appSecret) {
    const rawBody = (req as express.Request & { rawBody?: Buffer }).rawBody;
    const sig     = (req.headers["x-hub-signature-256"] as string | undefined) ?? "";
    if (rawBody) {
      const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
      const valid    = sig.length === expected.length &&
                       crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
      if (!valid) {
        logger.warn("[whatsapp] Invalid Meta signature — ignoring");
        return;
      }
    }
  }

  // Parse Meta's webhook payload
  type MetaEntry = {
    changes?: {
      value?: {
        messages?: {
          from: string;
          type: string;
          text?: { body: string };
          id: string;
        }[];
        statuses?: unknown[];
      };
      field: string;
    }[];
  };

  const payload = req.body as { object?: string; entry?: MetaEntry[] };

  if (payload.object !== "whatsapp_business_account") return;

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      for (const msg of change.value?.messages ?? []) {
        if (msg.type !== "text" || !msg.text?.body) continue;

        const from = msg.from; // digits only, e.g. "12845448088"
        const text = msg.text.body.trim();

        logger.info({ from, text }, "[whatsapp] Inbound message");

        try {
          const reply = await handleInboundMessage(from, text);
          await sendWhatsAppMessage(from, reply);
        } catch (err) {
          logger.error({ err, from }, "[whatsapp] Handler error");
          await sendWhatsAppMessage(from, "Sorry, something went wrong. Please call us at (284) 544-8088 🌮");
        }
      }
    }
  }
});

export default router;

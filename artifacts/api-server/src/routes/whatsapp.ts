import { Router, type IRouter } from "express";
import twilio from "twilio";
import { handleInboundMessage } from "../lib/whatsapp";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * POST /whatsapp/webhook
 *
 * Twilio sends an application/x-www-form-urlencoded POST here when a customer
 * messages your WhatsApp Business number.
 *
 * Key fields from Twilio:
 *   Body  — the message text
 *   From  — customer's WhatsApp number, e.g. "whatsapp:+12843402291"
 *   To    — your WhatsApp number, e.g. "whatsapp:+14155238886"
 *
 * We respond with TwiML so Twilio delivers the reply directly.
 * If TWILIO_WHATSAPP_ENABLED is not "true", the endpoint returns 200 with no reply.
 */
router.post("/whatsapp/webhook", async (req, res): Promise<void> => {
  // Guard: must be explicitly enabled
  if (process.env.TWILIO_WHATSAPP_ENABLED !== "true") {
    res.status(200).send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>");
    return;
  }

  // Validate Twilio signature when auth token is available
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (authToken) {
    const signature = req.headers["x-twilio-signature"] as string | undefined;
    const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    const params = req.body as Record<string, string>;

    const valid = twilio.validateRequest(authToken, signature ?? "", url, params);
    if (!valid) {
      logger.warn({ url, signature }, "[whatsapp] Invalid Twilio signature — rejecting");
      res.status(403).send("Forbidden");
      return;
    }
  }

  const body: Record<string, string> = req.body as Record<string, string>;
  const from    = body.From  ?? "";
  const msgBody = (body.Body ?? "").trim();

  if (!from || !msgBody) {
    res.status(200).send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>");
    return;
  }

  logger.info({ from, msgBody }, "[whatsapp] Inbound message");

  let reply: string;
  try {
    reply = await handleInboundMessage(from, msgBody);
  } catch (err) {
    logger.error({ err }, "[whatsapp] Handler error");
    reply = "Sorry, something went wrong. Please call us at (284) 544-8088 🌮";
  }

  // Escape XML special chars in the reply
  const safe = reply
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  res.setHeader("Content-Type", "text/xml");
  res.status(200).send(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safe}</Message></Response>`
  );
});

export default router;

import express, { Router, type IRouter } from "express";
import crypto from "crypto";
import { handleInboundMessage, sendWhatsAppMessage } from "../lib/whatsapp";
import { logger } from "../lib/logger";
import { db, ordersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

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
    // Fail closed: if we can't verify (missing raw bytes), don't process.
    if (!rawBody) {
      logger.warn("[whatsapp] META_APP_SECRET set but rawBody missing — ignoring webhook");
      return;
    }
    const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
    const valid    = sig.length === expected.length &&
                     crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    if (!valid) {
      logger.warn("[whatsapp] Invalid Meta signature — ignoring");
      return;
    }
  }

  // Parse Meta's webhook payload
  type MetaMessage = {
    from: string;
    type: string;
    id: string;
    text?: { body: string };
    button?: { payload: string; text: string };
  };
  type MetaStatus = {
    id: string;           // wamid of the message this status refers to
    status: string;       // "sent" | "delivered" | "read" | "failed"
    errors?: { code?: number; title?: string; message?: string }[];
  };
  type MetaEntry = {
    changes?: {
      value?: {
        messages?: MetaMessage[];
        statuses?: MetaStatus[];
      };
      field: string;
    }[];
  };

  const payload = req.body as { object?: string; entry?: MetaEntry[] };

  if (payload.object !== "whatsapp_business_account") return;

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;

      // ── Delivery status updates ─────────────────────────────────────────
      // Meta reports the fate of each outbound message (delivered / failed).
      // We match on the stored reminder wamid so the KDS can show whether a
      // pickup reminder actually reached the customer. Error 131026 = the
      // number is not a WhatsApp user.
      for (const st of change.value?.statuses ?? []) {
        if (!st?.id || !st.status) continue;
        if (st.status !== "delivered" && st.status !== "read" && st.status !== "failed") continue;

        const newStatus =
          st.status === "failed"
            ? (st.errors?.some(e => e?.code === 131026) ? "failed_not_whatsapp" : "failed")
            : "delivered";

        try {
          // Monotonic transitions only:
          //  - "delivered" may only upgrade from "sent" (a stale/retried
          //    delivered event must never mask a recorded failure)
          //  - a failure may only apply while status is "sent" (a stale
          //    failure must never overwrite a confirmed delivery)
          const applyUpdate = () => db
            .update(ordersTable)
            .set({ waReminderStatus: newStatus })
            .where(and(
              eq(ordersTable.waReminderMsgId, st.id),
              eq(ordersTable.waReminderStatus, "sent"),
            ))
            .returning({ id: ordersTable.id, code: ordersTable.confirmationCode });

          let updated = await applyUpdate();

          // Race guard: Meta can report a failure milliseconds after the send,
          // before the reminder job has stamped the wamid on the order. Meta
          // does not retry after our 200 ack, so retry the match briefly.
          if (updated.length === 0 && st.status === "failed") {
            for (const delayMs of [2000, 5000]) {
              await new Promise(r => setTimeout(r, delayMs));
              updated = await applyUpdate();
              if (updated.length > 0) break;
            }
          }

          if (updated.length > 0) {
            logger.info({ wamid: st.id, newStatus, code: updated[0].code, errors: st.errors },
              "[whatsapp] Reminder delivery status updated");
          } else if (st.status === "failed") {
            logger.warn({ wamid: st.id, errors: st.errors },
              "[whatsapp] Outbound message failed (untracked or already in terminal state)");
          }
        } catch (err) {
          logger.error({ err, wamid: st.id }, "[whatsapp] Failed to record delivery status");
        }
      }

      for (const msg of change.value?.messages ?? []) {
        const from = msg.from;

        // ── Quick reply button: "I'm on my way" ──────────────────────────────
        if (msg.type === "button") {
          const btnText = msg.button?.text ?? msg.button?.payload ?? "";
          logger.info({ from, btnText }, "[whatsapp] Button reply received");

          if (btnText.toLowerCase().includes("on my way")) {
            // Find most recent ready order for this customer
            const normalizedPhone = from.replace(/\D/g, "");
            const [order] = await db
              .select()
              .from(ordersTable)
              .where(
                and(
                  eq(ordersTable.status, "ready"),
                  eq(ordersTable.customerPhone, normalizedPhone),
                )
              )
              .orderBy(desc(ordersTable.createdAt))
              .limit(1);

            if (order) {
              logger.info({ from, code: order.confirmationCode }, "[whatsapp] Customer on their way");
              await sendWhatsAppMessage(from,
                `Perfect! Your order #${order.confirmationCode} is waiting at the counter. See you soon! 🌮`
              ).catch(() => {});
            } else {
              await sendWhatsAppMessage(from,
                `We'll have your order ready at the counter! See you soon 🌮`
              ).catch(() => {});
            }
          }
          continue;
        }

        // ── Regular text message → AI assistant ──────────────────────────────
        if (msg.type !== "text" || !msg.text?.body) continue;

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

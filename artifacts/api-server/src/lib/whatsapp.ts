import OpenAI from "openai";
import { db, menuCategoriesTable, menuItemsTable, storeSettingsTable } from "@workspace/db";
import { SETTING_DEFAULTS, formatOpenDays } from "../routes/settings";
import { logger } from "./logger";

const STORE_URL = (process.env.STORE_URL ?? "https://orders.islandtacosbvi.com").replace(/\/$/, "");
const META_API_VERSION = "v21.0";

/**
 * Template names — override via env vars when you have approved custom templates.
 *
 * Test mode defaults use Meta's built-in sample templates which work without approval:
 *   - jaspers_market_order_confirmation_v1: body params = [name, order_id, date]
 *   - hello_world: no params (just "Hello World!" — placeholder until custom ready template approved)
 *
 * Production: create templates in Meta Business → WhatsApp → Manage → Message Templates,
 * get them approved (utility category, ~minutes with verified account), then set:
 *   WA_TEMPLATE_CONFIRMATION=your_confirmation_template_name
 *   WA_TEMPLATE_READY=your_ready_template_name
 *   WA_TEMPLATE_CANCELLED=your_cancelled_template_name
 */
const TEMPLATE_CONFIRMATION = process.env.WA_TEMPLATE_CONFIRMATION ?? "jaspers_market_order_confirmation_v1";
const TEMPLATE_READY        = process.env.WA_TEMPLATE_READY        ?? "hello_world";
const TEMPLATE_CANCELLED    = process.env.WA_TEMPLATE_CANCELLED    ?? "hello_world";

// ── Conversation memory ───────────────────────────────────────────────────────

interface ConvEntry {
  messages: { role: "user" | "assistant"; content: string }[];
  lastSeen: number;
}

const conversations = new Map<string, ConvEntry>();
const CONV_TTL_MS = 30 * 60 * 1000;

function getConversation(phone: string): ConvEntry {
  const now = Date.now();
  const entry = conversations.get(phone);
  if (!entry || now - entry.lastSeen > CONV_TTL_MS) {
    const fresh: ConvEntry = { messages: [], lastSeen: now };
    conversations.set(phone, fresh);
    return fresh;
  }
  entry.lastSeen = now;
  return entry;
}

setInterval(() => {
  const now = Date.now();
  for (const [phone, entry] of conversations) {
    if (now - entry.lastSeen > CONV_TTL_MS) conversations.delete(phone);
  }
}, 10 * 60 * 1000);

// ── System prompt (built fresh each conversation turn) ────────────────────────

async function buildSystemPrompt(): Promise<string> {
  const settingRows = await db.select().from(storeSettingsTable);
  const settings: Record<string, string> = { ...SETTING_DEFAULTS };
  for (const r of settingRows) settings[r.key] = r.value;

  const hours   = settings.hours   ?? "11am – 7pm daily";
  const days    = formatOpenDays(settings.open_days);
  // TODO(store-settings): replace fallbacks with getStoreSettings()
  const phone   = settings.phone   ?? "284-544-8088";
  const address = settings.address ?? "Wickhams Cay 1, Road Town, BVI";
  const payment = settings.payment_methods ?? "ATH Móvil · Card · Apple Pay";

  const [categories, items] = await Promise.all([
    db.select().from(menuCategoriesTable).orderBy(menuCategoriesTable.sortOrder),
    db.select().from(menuItemsTable).orderBy(menuItemsTable.sortOrder),
  ]);

  const menuLines = categories.map((cat) => {
    const catItems = items.filter((i) => i.categoryId === cat.id && i.available);
    if (!catItems.length) return null;
    const lines = catItems.map((i) => {
      const price = `$${parseFloat(i.price as unknown as string).toFixed(2)}`;
      const desc  = i.description ? ` — ${i.description}` : "";
      const tags  = [i.vegetarian ? "vegetarian" : "", i.spicy ? "spicy" : ""].filter(Boolean).join(", ");
      return `  • ${i.name}: ${price}${desc}${tags ? ` [${tags}]` : ""}`;
    });
    return `*${cat.name}*\n${lines.join("\n")}`;
  }).filter(Boolean).join("\n\n");

  // TODO(store-settings): interpolate storeName from getStoreSettings()
  return `You are the friendly WhatsApp assistant for Island Tacos, a Mexican taqueria in Road Town, British Virgin Islands.

STORE INFO:
- Address: ${address}
- Phone: ${phone}
- Hours: ${hours}, ${days}
- Pickup only — no delivery
- Payment: ${payment}
- Online ordering: ${STORE_URL}
- No tax (BVI)

CURRENT MENU:
${menuLines || "(menu unavailable — direct customer to call us)"}

GUIDELINES:
- Be warm, friendly, and concise. WhatsApp messages should be short and easy to read.
- Use simple formatting — asterisks for bold (*text*), no markdown headers.
- Answer questions about menu items, prices, hours, location, and how to order.
- When someone wants to place an order, always send them this link: ${STORE_URL}
- They can customize items (toppings, modifiers, extras, notes) during checkout on the website.
- For allergy or dietary concerns, recommend they call us at ${phone} to confirm.
- For order status questions, direct them to: ${STORE_URL}/track or ask for their order code (starts with IT).
- Do NOT invent menu items, prices, or modifiers not listed above.
- If unsure about anything, say so and offer the phone number ${phone} as a backup.
- Keep replies to 3–5 lines when possible. Longer only when the question genuinely needs it.`;
}

// ── Inbound message handler (AI) ──────────────────────────────────────────────

export async function handleInboundMessage(fromPhone: string, text: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // TODO(store-settings): replace phone literal with getStoreSettings().phone
    return `Sorry, I can't respond right now. Please call us at (284) 544-8088 or order at ${STORE_URL} 🌮`;
  }

  const conv = getConversation(fromPhone);
  conv.messages.push({ role: "user", content: text });
  if (conv.messages.length > 20) conv.messages.splice(0, conv.messages.length - 20);

  try {
    const systemPrompt = await buildSystemPrompt();
    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 350,
      temperature: 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        ...conv.messages,
      ],
    });

    const reply = completion.choices[0]?.message?.content?.trim()
      ?? "Sorry, I didn't catch that — try again or call us at (284) 544-8088 🌮";

    conv.messages.push({ role: "assistant", content: reply });
    return reply;
  } catch (err) {
    logger.error({ err }, "[whatsapp] OpenAI error");
    return `Sorry, something went wrong on my end. Please call us at (284) 544-8088 🌮`;
  }
}

// ── Outbound: free-text (use only within a 24h customer-service window) ────────

// Returns true if Meta accepted the message, false on any error.
export async function sendWhatsAppMessage(to: string, body: string): Promise<boolean> {
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  const accessToken   = process.env.META_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    logger.warn("[whatsapp] Missing META_PHONE_NUMBER_ID or META_ACCESS_TOKEN — skipping");
    return false;
  }

  const toNormalized = to.replace(/\D/g, "");

  try {
    const response = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: toNormalized,
          type: "text",
          text: { body },
        }),
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      logger.error({ to: toNormalized, status: response.status, errData }, "[whatsapp] Send failed");
      return false;
    }

    const data = await response.json() as { messages?: { id: string }[] };
    logger.info({ to: toNormalized, msgId: data.messages?.[0]?.id }, "[whatsapp] Message sent");
    return true;
  } catch (err) {
    logger.error({ err, to: toNormalized }, "[whatsapp] Send error");
    return false;
  }
}

// ── Outbound: template message (required for business-initiated sends) ─────────
//
// Business-initiated messages (order confirmations, ready alerts, cancellations)
// MUST use pre-approved templates — Meta will reject plain text to numbers that
// haven't messaged the business first within 24 hours.
//
// Template components format: https://developers.facebook.com/docs/whatsapp/api/messages/message-templates

/** Thrown when Meta's Graph API rejects a template send. Includes the raw Meta error body. */
export class WhatsAppApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly metaBody: unknown,
  ) {
    super(message);
    this.name = "WhatsAppApiError";
  }
}

// Returns true if Meta accepted the message, false on any error.
// Callers that need to record delivery (e.g. wa_reminder_sent_at) should
// check the return value before stamping — a false means the customer was
// NOT notified and the stamp should be skipped so a retry can happen.
// Throws WhatsAppApiError when Meta explicitly rejects (so callers can surface
// the exact error code instead of a generic 502).
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode: string,
  bodyParams: string[],   // ordered list of {{1}}, {{2}}, … substitutions
  headerDocument?: { link: string; filename: string }, // optional PDF/document header
): Promise<boolean> {
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  const accessToken   = process.env.META_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    logger.warn("[whatsapp] Missing META_PHONE_NUMBER_ID or META_ACCESS_TOKEN — skipping template");
    return false;
  }

  const toNormalized = to.replace(/\D/g, "");

  const components: object[] = [];
  if (headerDocument) {
    components.push({
      type: "header",
      parameters: [{ type: "document", document: { link: headerDocument.link, filename: headerDocument.filename } }],
    });
  }
  if (bodyParams.length > 0) {
    components.push({ type: "body", parameters: bodyParams.map(text => ({ type: "text", text })) });
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: toNormalized,
          type: "template",
          template: {
            name: templateName,
            language: { code: languageCode },
            ...(components.length > 0 && { components }),
          },
        }),
      }
    );

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      logger.error({ to: toNormalized, template: templateName, status: response.status, errBody },
        "[whatsapp] Template send failed");
      // Throw so route handlers can surface the Meta error code directly
      throw new WhatsAppApiError(
        `Meta rejected template "${templateName}" (HTTP ${response.status})`,
        response.status,
        errBody,
      );
    }

    const data = await response.json() as { messages?: { id: string }[] };
    logger.info({ to: toNormalized, template: templateName, msgId: data.messages?.[0]?.id },
      "[whatsapp] Template sent");
    return true;
  } catch (err) {
    if (err instanceof WhatsAppApiError) throw err; // let explicit rejections propagate
    logger.error({ err, to: toNormalized, template: templateName }, "[whatsapp] Template send error");
    return false;
  }
}

// ── Order notification helpers ────────────────────────────────────────────────

type OrderLike = {
  customerName?: string | null;
  customerPhone?: string | null;
  confirmationCode: string;
  total: unknown;
  paymentMethod?: string;
};

/**
 * Sends order confirmation via WhatsApp template.
 * No-ops until WA_TEMPLATE_CONFIRMATION is set to an approved template name.
 * Body params: {{1}} = name, {{2}} = confirmation code, {{3}} = date
 */
export async function sendOrderConfirmationWhatsApp(order: OrderLike): Promise<void> {
  if (!order.customerPhone) return;
  if (!process.env.WA_TEMPLATE_CONFIRMATION) return; // skip until template is approved

  const name = order.customerName ?? "there";
  const date = new Date().toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  await sendWhatsAppTemplate(
    order.customerPhone,
    TEMPLATE_CONFIRMATION,
    "en",
    [name, order.confirmationCode, date],
  );
}

const PAY_LABEL: Record<string, string> = {
  cash: "Cash", card: "Card", athmovil: "ATH Móvil",
  split: "Split", complimentary: "Comp",
};

/**
 * Sends "order ready" notification via WhatsApp template.
 *
 * Template body param: {{1}} = confirmation code (e.g. IT-4521)
 */
export async function sendOrderReadyWhatsApp(order: OrderLike): Promise<void> {
  if (!order.customerPhone) return;

  await sendWhatsAppTemplate(
    order.customerPhone,
    TEMPLATE_READY,
    "en",
    [order.confirmationCode],
  );
}

/**
 * Sends pickup reminder via WhatsApp template for orders sitting unpaid/uncollected.
 * Template: island_tacos_order_reminder
 * Body params: {{1}} = name, {{2}} = confirmation code
 */
// Returns true if Meta accepted the message (caller should only stamp
// wa_reminder_sent_at on true — false means no notification was sent).
export async function sendOrderReminderWhatsApp(order: OrderLike): Promise<boolean> {
  if (!order.customerPhone) return false;

  const templateName = process.env.WA_TEMPLATE_REMINDER ?? "island_tacos_order_reminder";
  const name = order.customerName ?? "there";

  return sendWhatsAppTemplate(
    order.customerPhone,
    templateName,
    "en",
    [name, order.confirmationCode],
  );
}

/**
 * Sends a WhatsApp receipt template.
 * Template: island_tacos_order_receipt (WABA 1725555828883850, approved utility)
 *   Header:  DOCUMENT — PDF fetched by Meta from GET /api/orders/receipt/:code
 *   Body:    {{1}} = customer name, {{2}} = confirmation code
 *   Footer:  "Wickhams Cay 1, Road Town, BVI" (static)
 *   Language: en_US
 */
export async function sendOrderReceiptWhatsApp(
  order: Pick<OrderLike, "customerPhone" | "customerName" | "confirmationCode">,
): Promise<boolean> {
  if (!order.customerPhone) return false;

  const templateName = process.env.WA_TEMPLATE_RECEIPT ?? "island_tacos_order_receipt";
  const name = order.customerName ?? "there";
  const publicUrl = (process.env.STORE_URL ?? "https://orders.islandtacosbvi.com").replace(/\/$/, "");
  // Append a timestamp so Meta never serves a cached copy of a previously-sent receipt.
  const pdfUrl    = `${publicUrl}/api/orders/receipt/${order.confirmationCode}?t=${Date.now()}`;

  return sendWhatsAppTemplate(
    order.customerPhone,
    templateName,
    "en_US",
    [name, order.confirmationCode],
    { link: pdfUrl, filename: `Island-Tacos-Receipt-${order.confirmationCode}.pdf` },
  );
}

/**
 * Sends cancellation notification via WhatsApp template.
 * Template body param: {{1}} = confirmation code (e.g. IT-4521)
 */
export async function sendOrderCancelledWhatsApp(order: OrderLike): Promise<void> {
  if (!order.customerPhone) return;

  await sendWhatsAppTemplate(
    order.customerPhone,
    TEMPLATE_CANCELLED,
    "en",
    [order.confirmationCode],
  );
}

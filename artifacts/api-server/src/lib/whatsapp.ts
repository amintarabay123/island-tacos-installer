import OpenAI from "openai";
import { db, menuCategoriesTable, menuItemsTable, storeSettingsTable } from "@workspace/db";
import { SETTING_DEFAULTS, formatOpenDays } from "../routes/settings";
import { logger } from "./logger";

const STORE_URL = (process.env.STORE_URL ?? "https://orders.islandtacosbvi.com").replace(/\/$/, "");
const META_API_VERSION = "v21.0";

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
  // TODO(store-settings): replace the phone/address fallbacks with `(await getStoreSettings()).phone`
  // and `(await getStoreSettings()).address` — the K/V `phone`/`address` keys are already shadowed by
  // the store_profile overlay in /api/settings, so we can drop the dual-lookup in a follow-up.
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

  // TODO(store-settings): interpolate `${(await getStoreSettings()).storeName}` instead of the literal.
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
    // TODO(store-settings): replace (284) 544-8088 with `${(await getStoreSettings()).phone}`
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

    // TODO(store-settings): replace (284) 544-8088 with `${(await getStoreSettings()).phone}`
    const reply = completion.choices[0]?.message?.content?.trim()
      ?? "Sorry, I didn't catch that — try again or call us at (284) 544-8088 🌮";

    conv.messages.push({ role: "assistant", content: reply });
    return reply;
  } catch (err) {
    logger.error({ err }, "[whatsapp] OpenAI error");
    // TODO(store-settings): replace (284) 544-8088 with `${(await getStoreSettings()).phone}`
    return `Sorry, something went wrong on my end. Please call us at (284) 544-8088 🌮`;
  }
}

// ── Outbound send via Meta Cloud API ─────────────────────────────────────────

export async function sendWhatsAppMessage(to: string, body: string): Promise<void> {
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  const accessToken   = process.env.META_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    logger.warn("[whatsapp] Missing META_PHONE_NUMBER_ID or META_ACCESS_TOKEN — skipping");
    return;
  }

  // Meta expects digits only, no +, no spaces
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
      return;
    }

    const data = await response.json() as { messages?: { id: string }[] };
    logger.info({ to: toNormalized, msgId: data.messages?.[0]?.id }, "[whatsapp] Message sent");
  } catch (err) {
    logger.error({ err, to: toNormalized }, "[whatsapp] Send error");
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

export async function sendOrderConfirmationWhatsApp(order: OrderLike): Promise<void> {
  if (!order.customerPhone) return;
  const name  = order.customerName ?? "there";
  const total = `$${parseFloat(order.total as string).toFixed(2)}`;
  const track = `${STORE_URL}/track?code=${order.confirmationCode}`;

  // TODO(store-settings): interpolate `${(await getStoreSettings()).storeName}` instead of "Island Tacos"
  const body =
    `✅ Order confirmed, ${name}!\n\n` +
    `Your Island Tacos order *#${order.confirmationCode}* (${total}) is being prepared.\n\n` +
    `Track it here: ${track}\n` +
    `We'll message you the moment it's ready for pickup 🌮`;

  await sendWhatsAppMessage(order.customerPhone, body);
}

const PAY_LABEL: Record<string, string> = {
  cash: "Cash", card: "Card", athmovil: "ATH Móvil",
  split: "Split", complimentary: "Comp",
};

export async function sendOrderReadyWhatsApp(order: OrderLike): Promise<void> {
  if (!order.customerPhone) return;
  const name     = order.customerName ?? "there";
  const total    = `$${parseFloat(order.total as string).toFixed(2)}`;
  const payLabel = order.paymentMethod ? (PAY_LABEL[order.paymentMethod] ?? order.paymentMethod) : "";

  const body =
    `🔔 Hey ${name}, your order is ready!\n\n` +
    `*#${order.confirmationCode}* — ${total}${payLabel ? ` (${payLabel})` : ""}\n\n` +
    `📍 Wickhams Cay 1, Road Town, BVI\n\n` +
    `Come grab your food! Hasta luego 🌮`;

  await sendWhatsAppMessage(order.customerPhone, body);
}

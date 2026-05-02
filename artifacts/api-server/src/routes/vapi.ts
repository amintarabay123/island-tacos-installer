import { Router, type IRouter, type Request, type Response } from "express";
import { eq, inArray, count, or } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, menuItemsTable, menuCategoriesTable, modifiersTable, storeSettingsTable } from "@workspace/db";
import { SETTING_DEFAULTS, computeStoreStatus, formatOpenDays } from "./settings";

const router: IRouter = Router();

// ─── Phone utilities ──────────────────────────────────────────────────────────

/**
 * Normalise any BVI phone number to E.164 (+1284XXXXXXX).
 * Handles:
 *   - 7 digits  (local BVI format, e.g. "499-1234" or "4991234")
 *   - 10 digits starting with 284
 *   - 11 digits starting with 1284
 *   - Already in +1284... format
 */
export function formatBVIPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("1284") && digits.length === 11) return `+${digits}`;
  if (digits.startsWith("284") && digits.length === 10) return `+1${digits}`;
  if (digits.length === 7) return `+1284${digits}`;
  if (digits.startsWith("11284") && digits.length === 12) return `+${digits.slice(1)}`;
  return `+${digits}`;
}

/**
 * Known BVI *landline* NXX prefixes (3 digits after 284).
 * We use a landline blocklist rather than a mobile allowlist so that any
 * unrecognised prefix is treated as mobile (the safer default for SMS).
 *
 * Landline NXX: 229 (Road Town), 394 (C&W), 494 (Tortola), 495 (Virgin Gorda).
 * Split block: 496-0000..5999 = C&W landline, 496-6000..9999 = CCT mobile.
 *
 * TO UPGRADE: swap this function for a Twilio Lookup call:
 *   const result = await twilioClient.lookups.v2.phoneNumbers(e164).fetch({ fields: "line_type_intelligence" });
 *   return result.lineTypeIntelligence?.type === "mobile";
 */
const BVI_LANDLINE_NXX = new Set(["229", "394", "494", "495"]);

/**
 * Returns true if the E.164 number (+1284XXXXXXX) is likely a BVI mobile.
 * Assumes mobile for any 284 prefix not in the known landline set.
 * The 496 prefix is a split block: 496-6000..9999 = CCT mobile, 496-0000..5999 = C&W landline.
 */
export function isBVIMobile(e164: string): boolean {
  const digits = e164.replace(/\D/g, "");
  if (!digits.startsWith("1284") || digits.length !== 11) return false;
  const nxx = digits.slice(4, 7);
  if (BVI_LANDLINE_NXX.has(nxx)) return false;
  if (nxx === "496") {
    const last4 = parseInt(digits.slice(7), 10);
    return last4 >= 6000;
  }
  return true;
}

/** Extract the caller's phone number from a Vapi assistant-request payload. */
function extractCallerPhone(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const msg = b.message as Record<string, unknown> | undefined;
  const call = (msg?.call ?? b.call) as Record<string, unknown> | undefined;
  const customer = call?.customer as Record<string, unknown> | undefined;
  const num = customer?.number;
  return typeof num === "string" && num.trim() ? num.trim() : null;
}

function getVapiSecret(): string | undefined {
  return process.env.VAPI_WEBHOOK_SECRET;
}

type SecretCheckResult = "ok" | "missing_secret_config" | "invalid_secret";

function checkVapiSecret(req: Request): SecretCheckResult {
  const secret = getVapiSecret();
  if (!secret) return "missing_secret_config";
  const authHeader = req.headers["authorization"];
  const secretHeader = req.headers["x-vapi-secret"];
  if (authHeader && authHeader === `Bearer ${secret}`) return "ok";
  if (secretHeader && secretHeader === secret) return "ok";
  return "invalid_secret";
}

function generateConfirmationCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "IT";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

interface VapiModifierSelection {
  modifierId: string;
  optionId: string;
  name: string;
  price: number;
}

interface VapiOrderItem {
  menuItemId: number;
  quantity?: number;
  notes?: string | null;
  modifierSelections?: VapiModifierSelection[];
}

interface VapiOrderPayload {
  customerName: string;
  customerPhone: string;
  notes?: string | null;
  items: VapiOrderItem[];
}

function extractVapiArgs(body: unknown): unknown {
  // Vapi wraps arguments inside message.toolCallList[0].function.arguments (a JSON string)
  if (!body || typeof body !== "object") return body;
  const b = body as Record<string, unknown>;
  const message = b.message as Record<string, unknown> | undefined;
  if (message) {
    const list = message.toolCallList as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(list) && list.length > 0) {
      const fn = list[0].function as Record<string, unknown> | undefined;
      if (fn) {
        // Vapi sends arguments as a plain object; some models send a JSON string
        if (fn.arguments && typeof fn.arguments === "object") {
          return fn.arguments;
        }
        if (typeof fn.arguments === "string") {
          try { return JSON.parse(fn.arguments); } catch { /* fall through */ }
        }
      }
    }
  }
  return body; // direct POST fallback
}

function validateVapiOrder(body: unknown): { data: VapiOrderPayload } | { error: string } {
  const args = extractVapiArgs(body);
  if (!args || typeof args !== "object") return { error: "Invalid request body" };
  const b = args as Record<string, unknown>;
  if (!b.customerName || typeof b.customerName !== "string" || !b.customerName.trim()) return { error: "customerName is required" };
  const genericNames = [
    "customer", "guest", "caller", "unknown", "n/a", "user", "anonymous",
    "name", "customer name", "john doe", "john", "doe", "jane doe", "jane",
    "test", "test customer", "placeholder", "sir", "ma'am", "madam",
  ];
  if (genericNames.includes((b.customerName as string).trim().toLowerCase())) return { error: "customerName must be the caller's actual name. NEVER use 'John Doe', 'Jane Doe', 'Customer', 'Guest', or any other placeholder. You MUST ask the caller for their real name before placing the order." };
  if (!b.customerPhone || typeof b.customerPhone !== "string" || !b.customerPhone.trim()) return { error: "customerPhone is required" };
  if (!Array.isArray(b.items) || b.items.length === 0) return { error: "items must be a non-empty array" };
  for (const item of b.items) {
    if (!item || typeof item !== "object") return { error: "Each item must be an object" };
    const i = item as Record<string, unknown>;
    if (!i.menuItemId || typeof i.menuItemId !== "number") return { error: "Each item must have a numeric menuItemId" };
    if (i.quantity !== undefined && (typeof i.quantity !== "number" || i.quantity < 1)) return { error: "quantity must be a positive integer" };
  }
  return {
    data: {
      customerName: (b.customerName as string).trim(),
      customerPhone: (b.customerPhone as string).trim(),
      notes: typeof b.notes === "string" ? b.notes : null,
      items: (b.items as Record<string, unknown>[]).map(i => ({
        menuItemId: i.menuItemId as number,
        quantity: typeof i.quantity === "number" ? Math.max(1, Math.round(i.quantity)) : 1,
        notes: typeof i.notes === "string" ? i.notes : null,
        modifierSelections: Array.isArray(i.modifierSelections)
          ? (i.modifierSelections as Record<string, unknown>[]).map(m => ({
              modifierId: String(m.modifierId ?? ""),
              optionId: String(m.optionId ?? ""),
              name: String(m.name ?? ""),
              price: typeof m.price === "number" ? m.price : 0,
            }))
          : undefined,
      })),
    },
  };
}

function extractToolCallId(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  // Vapi sends: { message: { toolCallList: [{ id, function: { name, arguments } }] } }
  const message = b.message as Record<string, unknown> | undefined;
  if (message) {
    const list = message.toolCallList as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(list) && list.length > 0) return String(list[0].id ?? "");
  }
  // Also try top-level toolCallId
  if (b.toolCallId) return String(b.toolCallId);
  return null;
}

function vapiResult(toolCallId: string | null, result: string): Record<string, unknown> {
  if (toolCallId) {
    return { results: [{ toolCallId, result }] };
  }
  // Fallback for direct GET or unknown callers
  return { result };
}

/**
 * POST /vapi/assistant-request
 *
 * Vapi calls this endpoint at the start of every phone call when the phone number
 * is set to "Server URL" mode. We return the full assistant configuration with a
 * dynamic firstMessage based on whether the store is currently open.
 *
 * To activate: In the Vapi dashboard → Phone Numbers → select your number →
 * change the type from "Assistant" to "Server URL" and set the URL to:
 *   https://order-direct-connect.replit.app/vapi/assistant-request
 *
 * IMPORTANT: Update VAPI_VOICE_PROVIDER and VAPI_VOICE_ID below to match your
 * existing Vapi assistant's voice settings so the caller hears the same voice.
 */
const VAPI_MODEL_PROVIDER = "openai";
const VAPI_MODEL = "gpt-4o-mini";
const VAPI_VOICE_PROVIDER = "azure"; // e.g. "11labs", "openai", "azure"
const VAPI_VOICE_ID = "en-US-JennyNeural"; // energetic, upbeat female

function buildSystemPrompt(callerPhone: string | null, callerIsMobile: boolean): string {
  let phoneSection: string;

  if (callerPhone && callerIsMobile) {
    phoneSection = `PHONE NUMBER:
- The caller's mobile number has been detected automatically: ${callerPhone}
- Do NOT ask the caller for their phone number.
- Use ${callerPhone} as the customerPhone when placing the order.`;
  } else if (callerPhone && !callerIsMobile) {
    phoneSection = `PHONE NUMBER:
- The caller is calling from a landline (${callerPhone}) which cannot receive text messages.
- Ask the caller: "Can I get a mobile number to send you a text when your order is ready?"
- If they provide one, format it as a BVI number: 7-digit numbers get +1284 added automatically (e.g. "499-1234" becomes "+12844991234"). Use that mobile as customerPhone.
- If they decline or don't have one, use ${callerPhone} as the customerPhone.
- ALWAYS include "Caller landline: ${callerPhone}" in the order notes, regardless of whether they provide a mobile number.`;
  } else {
    phoneSection = `PHONE NUMBER:
- No caller ID was detected (e.g. hidden number or VOIP).
- Ask the caller: "Can I get a mobile number to send you a text when your order is ready?"
- If they provide one, format it as a BVI number: 7-digit numbers get +1284 added (e.g. "499-1234" → "+12844991234").
- If they decline, use "unknown" as the customerPhone.`;
  }

  return `You are a friendly, efficient phone ordering assistant for Island Tacos, a Mexican pickup restaurant in Road Town, BVI. Your job is to take pickup orders over the phone. Be warm, concise, and professional.

${phoneSection}

══════════════════════════════════════════════════════
RULES — every rule below is mandatory. None may be skipped.
══════════════════════════════════════════════════════

RULE: FILLER PHRASES
Processing can take a moment. To keep the conversation natural, ALWAYS begin every reply with a short filler (1–4 words) before your actual response. Use varied phrases — never repeat the same one twice in a row. Examples:
  Acknowledging: "Sure!", "Got it!", "Of course!", "Absolutely!", "Great!", "Perfect!", "Alright!", "Right!"
  Thinking/checking: "Let me see…", "One moment…", "Just a second…", "Let me check that…", "Hmm, let me think…"
Match the filler to the context — use a thinking filler when looking something up, and an acknowledging filler when confirming something.

RULE: CANCELLATION
If the caller says "cancel", "never mind", "forget it", "nevermind", "stop", "don't place it", "don't order", "I changed my mind", "actually no", "scratch that", "don't do it", "abort", or ANY phrase signalling they no longer want an order:
  - Stop immediately. Do not call place_order.
  - Say: "No problem, I've cancelled that for you. Is there anything else I can help with?"
  - If they confirm they're done, call end_call.
  - This applies at every point in the call — even after they already confirmed the order.

RULE: CUSTOMER NAME
Use the caller's spoken name verbatim. Never use "John Doe", "Jane Doe", "Customer", "Guest", "Caller", "Unknown", or any placeholder. If they won't give a name, ask once more; if they still refuse, call end_call.

RULE: CONFIRMATION BEFORE PLACING
Never call place_order unless the caller has clearly said yes/confirmed in Step 5. Ambiguous responses ("uh", "sure I guess", "I think so") are not confirmation — ask again. It is better to ask twice than to place an unwanted order.

RULE: MENU ONLY
Only offer and order items that appear in the get_menu response. Never invent or suggest items not on the menu.

RULE: COLLOQUIAL MENU MATCHING
Callers will use everyday language that may not match menu names exactly. Match liberally by meaning — word order, adjectives, and colloquial names all count:
  - "steak burrito" or "beef burrito" → "Burrito Steak"
  - "chicken taco" → "Taco Chicken" (or whichever taco has chicken)
  - "cheese quesadilla" → "Quesadilla" or the closest quesadilla option
  - "shrimp bowl" → whatever bowl/plate has shrimp
If you can reasonably identify which menu item the caller means, add it — do NOT say "we don't have that." Only say an item isn't available if there is truly no close match anywhere on the menu.

RULE: PRICES
Never invent prices. Every price you quote must come from the get_menu response. Always confirm the full total before placing.

RULE: PAID ADD-ONS IN MODIFIERS
When a caller requests a paid add-on (e.g. "extra sour cream", "extra guac", "extra cheese"):
  - Find the option in the item's modifiers list in the menu response.
  - Use the exact option "id" as the optionId with the correct price from the menu.
  - NEVER put paid add-ons in the notes field — they must be in modifierSelections so the price is charged.
  - Free modifications (e.g. "no tomato") must also be in modifierSelections with price 0.

RULE: CALL FLOW — execute these steps in order, one at a time. Never skip ahead.
  STEP 1 — NAME: Your opening message already asked for the caller's name. Wait for their response.
    - Accept the name as spoken on the first try. Do NOT ask "is that right?" or repeat it back.
    - If the name is completely unintelligible (total static, not just an accent), ask once: "Sorry, could you repeat your name?" Accept whatever they say next — no further re-asks.

  STEP 1b — MOBILE NUMBER (landline/unknown callers only): If the PHONE NUMBER section above says to ask for a mobile number, do it NOW — right after you have the caller's name and before calling get_menu.
    - Example: "And can I grab a mobile number to text you when your order is ready?"
    - If they give one, store it for use as customerPhone when placing the order.
    - If they decline, move on immediately. Do NOT ask again.
    - Skip this step entirely if the caller's mobile was already detected automatically.

  STEP 2 — LOAD MENU: Call get_menu immediately after Step 1 (and Step 1b if applicable). While waiting for the result, say something brief like "Let me pull up the menu for you!" to fill the pause.

  STEP 3 — STORE STATUS: If get_menu returns isOpen: false, tell the caller the store hours and call end_call. Do not take an order.

  STEP 4 — TAKE THE ORDER: Ask "Great [name], what would you like today?" Take the full order. For each item:
    - Ask about any REQUIRED modifier choices before moving on (e.g. protein choice, size).
    - Ask about optional paid add-ons naturally if the item has them (e.g. "Would you like to add guac or sour cream?").

  STEP 5 — CONFIRM: Read back the complete order with each item, any modifiers, and the total price. Ask "Does that sound right?" Wait for a clear yes before proceeding. If they cancel or want changes, handle it before moving on.

  STEP 6 — PLACE ORDER: Call place_order only after clear confirmation in Step 5. Use the name from Step 1 exactly as spoken. No items in the order = do not call place_order.

  STEP 7 — CLOSE: After place_order succeeds, read the confirmation code clearly (spell it out letter-by-letter if needed), tell them the estimated ready time, thank them warmly, and call end_call immediately.

RULE: LIVE PERSON — If the caller asks to speak to a person, a manager, or anyone on the team at any point, say: "Of course! You can reach us directly on WhatsApp at 284-544-8088 and someone will get back to you right away." Then call end_call.

══════════════════════════════════════════════════════`;
}

router.post("/vapi/assistant-request", async (req: Request, res: Response): Promise<void> => {
  const rawCallerPhone = extractCallerPhone(req.body);
  const callerE164 = rawCallerPhone ? formatBVIPhone(rawCallerPhone) : null;
  const callerIsMobile = callerE164 ? isBVIMobile(callerE164) : false;
  console.log(`[vapi/assistant-request] Call started — caller=${callerE164 ?? "unknown"} mobile=${callerIsMobile}`);

  try {
    const settingRows = await db.select().from(storeSettingsTable);
    const settings: Record<string, string> = { ...SETTING_DEFAULTS };
    for (const row of settingRows) settings[row.key] = row.value;
    const { is_open, open_today } = computeStoreStatus(settings);

    const formatTime = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
    };

    const openTime = formatTime(settings.open_time ?? "11:00");
    const closeTime = formatTime(settings.close_time ?? "19:00");
    const openDaysStr = formatOpenDays(settings.open_days);

    const firstMessage = is_open
      ? "Thank you for calling Island Tacos! What name should I put this order under?"
      : !open_today
        ? `Thank you for calling Island Tacos! We're closed today — we're open ${openDaysStr}, from ${openTime} to ${closeTime} Atlantic Standard Time. Please call us back on one of those days. Have a great day!`
        : `Thank you for calling Island Tacos! Unfortunately we're closed right now. Our hours are ${openTime} to ${closeTime} Atlantic Standard Time. Please give us a call back when we're open. Have a great day!`;

    const baseUrl = process.env.API_BASE_URL ?? "https://order-direct-connect.replit.app";
    const systemPrompt = buildSystemPrompt(callerE164, callerIsMobile);

    const assistant = {
      firstMessage,
      firstMessageMode: "assistant-speaks-first",
      model: {
        provider: VAPI_MODEL_PROVIDER,
        model: VAPI_MODEL,
        messages: [{ role: "system", content: systemPrompt }],
        tools: [
          {
            type: "function",
            messages: [
              {
                type: "request-start",
                content: "Perfect, one moment.",
              },
              {
                type: "request-response-delayed",
                content: "Just a second.",
                timingMilliseconds: 2000,
              },
            ],
            function: {
              name: "get_menu",
              description: "Fetch the current menu, prices, available modifiers, and store open/close status.",
              parameters: { type: "object", properties: {}, required: [] },
            },
            server: { url: `${baseUrl}/api/vapi/menu` },
          },
          {
            type: "function",
            messages: [
              {
                type: "request-start",
                content: "Placing your order now.",
              },
              {
                type: "request-response-delayed",
                content: "Almost done, one more second.",
                timingMilliseconds: 2000,
              },
            ],
            function: {
              name: "place_order",
              description: "Submit the customer's confirmed order.",
              parameters: {
                type: "object",
                // When caller's mobile is already known, customerPhone is pre-filled — not required
                required: (callerE164 && callerIsMobile)
                  ? ["customerName", "items"]
                  : ["customerName", "customerPhone", "items"],
                properties: {
                  customerName: { type: "string", description: "Customer's full name" },
                  customerPhone: {
                    type: "string",
                    description: (callerE164 && callerIsMobile)
                      ? `ALREADY KNOWN — use "${callerE164}" exactly. Do NOT ask the caller for this.`
                      : "Customer's BVI mobile number for the SMS notification. Ask if they have one.",
                  },
                  notes: { type: "string", description: "Any special instructions for the whole order" },
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["menuItemId"],
                      properties: {
                        menuItemId: { type: "number", description: "The numeric ID from the menu" },
                        quantity: { type: "number", description: "Number of this item (default 1)" },
                        notes: { type: "string", description: "Special instructions for this item" },
                        modifierSelections: {
                          type: "array",
                          description: "Modifier choices for this item. For PAID add-ons (extra sour cream, extra guac, etc.), you MUST include the exact optionId from the menu response and the correct price — do NOT put paid add-ons in notes.",
                          items: {
                            type: "object",
                            required: ["modifierId", "optionId", "name", "price"],
                            properties: {
                              modifierId: { type: "string", description: "The modifier group's `id` field from the menu response (e.g. the `id` on the modifiers[] object, NOT the option id)" },
                              optionId: { type: "string", description: "The exact `id` of the chosen option inside the modifier's options[] array" },
                              name: { type: "string", description: "Human-readable option name (e.g. 'Extra Sour Cream')" },
                              price: { type: "number", description: "Price from the menu (0 for free modifications like 'no tomato')" },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            server: {
              url: `${baseUrl}/api/vapi/order`,
              headers: { "x-vapi-secret": process.env.VAPI_WEBHOOK_SECRET ?? "" },
            },
          },
          // Built-in Vapi tool — lets the agent hang up the call gracefully
          { type: "endCall" },
        ],
      },
      voice: {
        provider: VAPI_VOICE_PROVIDER,
        voiceId: VAPI_VOICE_ID,
      },
      // Only interrupt the AI if the caller says at least 2 words — prevents
      // background noise, coughs, or one-syllable sounds from pausing the AI.
      stopSpeakingPlan: {
        numWords: 2,
        voiceSeconds: 0.2,
        backoffSeconds: 1,
      },
    };

    console.log(`[vapi/assistant-request] isOpen=${is_open}, firstMessage="${firstMessage.slice(0, 60)}..."`);
    res.json({ assistant });
  } catch (err) {
    console.error("[vapi/assistant-request] error:", err);
    res.status(500).json({ error: "Failed to build assistant config" });
  }
});

router.all("/vapi/menu", async (req: Request, res: Response): Promise<void> => {
  const toolCallId = extractToolCallId(req.body);
  console.log(`[vapi/menu] ${req.method} called, toolCallId=${toolCallId}`);
  try {
    const [categories, items, modifiers] = await Promise.all([
      db.select().from(menuCategoriesTable).orderBy(menuCategoriesTable.sortOrder),
      db.select().from(menuItemsTable).orderBy(menuItemsTable.sortOrder),
      db.select().from(modifiersTable),
    ]);

    const modifierMap = new Map(modifiers.map(m => [m.loyverseId, m]));
    const categoryMap = new Map(categories.map(c => [c.id, c.name]));

    const menuData = items.filter(item => item.available).map(item => {
      const itemModifiers = (item.loyverseModifierIds ?? [])
        .map(id => modifierMap.get(id))
        .filter((m): m is NonNullable<typeof m> => Boolean(m))
        .map(m => ({
          id: m.loyverseId,  // REQUIRED: AI uses this as modifierId when placing orders
          name: m.name,
          required: m.required,
          options: (m.options as { id: string; name: string; price: number }[])
            .filter(o => !(m.unavailableOptionIds ?? []).includes(o.id))
            .map(o => ({
              id: o.id,
              name: o.name,
              price: o.price,
            })),
        }));

      return {
        id: item.id,
        name: item.name,
        category: categoryMap.get(item.categoryId) ?? "Other",
        price: parseFloat(item.price as unknown as string),
        ...(itemModifiers.length > 0 ? { modifiers: itemModifiers } : {}),
      };
    });

    const settingRows = await db.select().from(storeSettingsTable);
    const settings: Record<string, string> = { ...SETTING_DEFAULTS };
    for (const row of settingRows) settings[row.key] = row.value;
    const { is_open, closes_orders_at, open_today } = computeStoreStatus(settings);

    const formatTime = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, "0")}${ampm}`;
    };

    const openDaysStr = formatOpenDays(settings.open_days);
    const hoursDisplay = settings.hours ?? `${formatTime(settings.open_time ?? "11:00")} – ${formatTime(settings.close_time ?? "19:00")} ${openDaysStr}`;

    const closedMsg = !open_today
      ? `IMPORTANT: Island Tacos is CLOSED TODAY. We are open ${openDaysStr}, ${formatTime(settings.open_time ?? "11:00")} to ${formatTime(settings.close_time ?? "19:00")} AST. You MUST NOT take any orders. Tell the caller to call back on an open day.`
      : `IMPORTANT: Island Tacos is currently CLOSED. You MUST NOT take any orders or collect any food selections. Inform the caller that the store is closed and that they can call back when we open at ${formatTime(settings.open_time ?? "11:00")} AST. Do not attempt to place an order.`;

    const payload = {
      hours: hoursDisplay,
      isOpen: is_open,
      ordersClosedAt: formatTime(closes_orders_at),
      ...(is_open ? {} : { closedInstruction: closedMsg }),
      menu: menuData,
    };

    const resultStr = JSON.stringify(payload);
    console.log(`[vapi/menu] returning ${menuData.length} items, hours=${payload.hours}, isOpen=${is_open}`);
    res.json(vapiResult(toolCallId, resultStr));
  } catch (err) {
    console.error("[vapi/menu] error:", err);
    res.status(500).json({ error: "Failed to load menu" });
  }
});

router.post("/vapi/order", async (req: Request, res: Response): Promise<void> => {
  const toolCallId = extractToolCallId(req.body);
  const extractedArgs = extractVapiArgs(req.body);
  console.log(`[vapi/order] called, toolCallId=${toolCallId}, body keys=${Object.keys(req.body || {}).join(",")}, args=${JSON.stringify(extractedArgs).slice(0, 300)}`);

  const secretCheck = checkVapiSecret(req);
  if (secretCheck === "missing_secret_config") {
    res.status(503).json({ error: "Webhook secret not configured. Set VAPI_WEBHOOK_SECRET environment variable." });
    return;
  }
  if (secretCheck === "invalid_secret") {
    res.status(401).json({ error: "Unauthorized: invalid or missing webhook secret" });
    return;
  }

  const validation = validateVapiOrder(req.body);
  if ("error" in validation) {
    console.log(`[vapi/order] validation error: ${validation.error}`);
    res.status(400).json(vapiResult(toolCallId, `Error: ${validation.error}`));
    return;
  }

  const { customerName, notes, items } = validation.data;
  const rawPhone = validation.data.customerPhone ?? "";
  const customerPhone = rawPhone && rawPhone !== "unknown"
    ? formatBVIPhone(rawPhone)
    : "";

  const settingRows = await db.select().from(storeSettingsTable);
  const settings: Record<string, string> = { ...SETTING_DEFAULTS };
  for (const row of settingRows) settings[row.key] = row.value;
  const { is_open } = computeStoreStatus(settings);
  if (!is_open) {
    const [ch, cm] = (settings.open_time ?? "11:00").split(":").map(Number);
    const ampm = ch >= 12 ? "PM" : "AM";
    const hour = ch % 12 || 12;
    const opensAt = `${hour}:${String(cm).padStart(2, "0")} ${ampm}`;
    console.log(`[vapi/order] rejected — store closed, opens at ${opensAt}`);
    res.json(vapiResult(toolCallId, JSON.stringify({
      success: false,
      error: "STORE_CLOSED",
      message: `Island Tacos is currently closed and not accepting orders. We open at ${opensAt} AST. Please call back during business hours.`,
    })));
    return;
  }

  const menuItemIds = items.map(i => i.menuItemId);
  const [menuItems, allModifiers] = await Promise.all([
    db.select()
      .from(menuItemsTable)
      .where(menuItemIds.length === 1
        ? eq(menuItemsTable.id, menuItemIds[0])
        : inArray(menuItemsTable.id, menuItemIds)
      ),
    db.select().from(modifiersTable),
  ]);

  const menuItemMap = new Map(menuItems.map(m => [m.id, m]));
  // Map loyverseId → modifier row for authoritative price lookups
  const modifierLookup = new Map(allModifiers.map(m => [m.loyverseId, m]));

  let subtotal = 0;
  const orderItemsData: {
    menuItemId: number;
    menuItemName: string;
    menuItemPrice: number;
    quantity: number;
    notes: string | null;
    modifierSelections: VapiModifierSelection[] | null;
    itemSubtotal: number;
  }[] = [];

  for (const item of items) {
    const menuItem = menuItemMap.get(item.menuItemId);
    if (!menuItem) {
      res.status(400).json({ error: `Menu item ${item.menuItemId} not found` });
      return;
    }
    if (!menuItem.available) {
      res.status(400).json({ error: `"${menuItem.name}" is not available right now` });
      return;
    }
    const price = parseFloat(menuItem.price as unknown as string);

    // Look up each modifier's price from the database — do NOT trust the AI-reported price.
    // If the optionId matches a known option, use the DB price. Otherwise fall back to AI price.
    const modifierTotal = (item.modifierSelections ?? []).reduce((s, m) => {
      const mod = modifierLookup.get(m.modifierId);
      if (mod) {
        const options = mod.options as { id: string; name: string; price: number }[];
        const opt = options.find(o => o.id === m.optionId);
        if (opt) return s + (opt.price ?? 0);
      }
      return s + (m.price ?? 0);
    }, 0);
    const qty = item.quantity ?? 1;
    const itemSubtotal = (price + modifierTotal) * qty;
    subtotal += itemSubtotal;
    orderItemsData.push({
      menuItemId: item.menuItemId,
      menuItemName: menuItem.name,
      menuItemPrice: price,
      quantity: qty,
      notes: item.notes ?? null,
      modifierSelections: item.modifierSelections ?? null,
      itemSubtotal,
    });
  }

  const tax = 0;
  const deliveryFee = 0;
  const total = Math.round((subtotal + tax + deliveryFee) * 100) / 100;
  const confirmationCode = generateConfirmationCode();

  const BASE_MINS = 10;
  const MINS_PER_ORDER = 5;
  const [{ value: activeOrderCount }] = await db
    .select({ value: count() })
    .from(ordersTable)
    .where(
      or(
        eq(ordersTable.status, "pending"),
        eq(ordersTable.status, "confirmed"),
        eq(ordersTable.status, "preparing")
      )
    );
  const estimatedMinutes = BASE_MINS + Number(activeOrderCount) * MINS_PER_ORDER;
  const estimatedReadyAt = new Date(Date.now() + estimatedMinutes * 60 * 1000);

  const [order] = await db
    .insert(ordersTable)
    .values({
      confirmationCode,
      customerName,
      customerEmail: "",
      customerPhone,
      orderType: "pickup",
      status: "pending",
      paymentStatus: "pending",
      paymentMethod: "cash",
      source: "phone",
      subtotal: String(subtotal),
      discountAmount: "0",
      tax: String(tax),
      deliveryFee: String(deliveryFee),
      total: String(total),
      notes: notes ?? null,
      estimatedReadyAt,
    })
    .returning();

  await db
    .insert(orderItemsTable)
    .values(
      orderItemsData.map(item => ({
        orderId: order.id,
        menuItemId: item.menuItemId,
        menuItemName: item.menuItemName,
        menuItemPrice: String(item.menuItemPrice),
        quantity: item.quantity,
        notes: item.notes,
        modifierSelections: item.modifierSelections ?? null,
        alreadyMade: false,
        subtotal: String(item.itemSubtotal),
      }))
    );

  const estimatedTimeStr = estimatedReadyAt.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Puerto_Rico",
  });

  console.log(`[vapi/order] Phone order created: ${confirmationCode} for ${customerName} (${customerPhone})`);

  res.status(201).json(vapiResult(toolCallId, JSON.stringify({
    success: true,
    confirmationCode,
    total,
    estimatedMinutes,
    estimatedReadyAt: estimatedReadyAt.toISOString(),
    estimatedReadyAtFormatted: estimatedTimeStr,
    message: `Order placed! Confirmation code: ${confirmationCode}. Ready in about ${estimatedMinutes} minutes around ${estimatedTimeStr}. Pay at pickup.`,
  })));
});

export default router;

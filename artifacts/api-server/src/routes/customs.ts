import { Router, type IRouter, type Request, type Response } from "express";
import OpenAI from "openai";


const router: IRouter = Router();

function makeOpenAIClient(): OpenAI {
  if (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    return new OpenAI({
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      maxRetries: 0,
      timeout: 45000,
    });
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: 45000 });
}
// TODO(store-settings): replace hardcoded "Island Tacos" and "Road Town, British Virgin Islands"
// with `(await getStoreSettings()).storeName` / .address. Prompt is rebuilt per request so the
// extra DB hit is acceptable.
const EXTRACT_PROMPT = `You are an invoice data extraction assistant for "Island Tacos", a food importer in Road Town, British Virgin Islands. Extract ALL data from this supplier invoice and return a single valid JSON object with EXACTLY this structure:

{
  "supplier": {
    "name": "supplier company name",
    "street": "street address",
    "city": "city and state/province",
    "zip": "ZIP or postal code",
    "country": "full country name"
  },
  "invoiceRef": "invoice or PO number",
  "items": [
    {
      "desc": "full product description including brand name, product name, pack size",
      "qty": "quantity with unit abbreviation e.g. '12 cs', '5 bags', '24 each', '3 boxes'",
      "unit": "pack unit abbreviation e.g. cs, kg, bag, box, ea, lbs",
      "wt": "total net weight in pounds as decimal string e.g. '45.2', empty string if unknown",
      "fob": "line item extended total price as decimal string e.g. '189.60' (no currency symbols)"
    }
  ],
  "freight": "freight or shipping charge as decimal string e.g. '35.00', or '0' if not present",
  "insurance": "insurance charge as decimal string or '0' if not present"
}

Rules:
- Include EVERY line item from the invoice — do not skip any
- For desc: include brand + product name + pack size (e.g. "Brand Name Black Beans 6/#10 can case")
- For qty: format as "{number} {unit}" using the invoice's unit (e.g. "12 cs", "5 bags")
- For fob: use the extended/total price for the line (not unit price), as a plain number
- For wt: total weight for the line in pounds (convert kg × 2.205 if needed), or empty if not shown
- Return ONLY the JSON object — no markdown fences, no extra text, no comments`;

router.post("/customs/extract-invoice", async (req: Request, res: Response): Promise<void> => {
  const { type, data, mime } = req.body as { type: "image" | "text"; data: string; mime?: string };

  if (!type || !data) {
    res.status(400).json({ error: "Missing type or data" });
    return;
  }

  const openai = makeOpenAIClient();

  try {
    let messageContent: OpenAI.Chat.ChatCompletionContentPart[];

    if (type === "image") {
      messageContent = [
        { type: "text", text: EXTRACT_PROMPT },
        {
          type: "image_url",
          image_url: {
            url: `data:${mime || "image/jpeg"};base64,${data}`,
            detail: "high",
          },
        },
      ];
    } else {
      messageContent = [
        { type: "text", text: `${EXTRACT_PROMPT}\n\nInvoice text extracted from PDF:\n\n${data.slice(0, 12000)}` },
      ];
    }

    const usingIntegration = !!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    const response = await openai.chat.completions.create({
      model: usingIntegration ? "gpt-4o" : "gpt-4o",
      messages: [{ role: "user", content: messageContent }],
      response_format: { type: "json_object" },
      max_tokens: 3000,
    });

    const raw = response.choices[0]?.message?.content || "{}";
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw.trim();
    const result = JSON.parse(jsonStr);
    res.json(result);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    req.log.error({ status: e?.status, message: e?.message }, "Invoice extraction error");

    if (e?.status === 429) {
      res.status(503).json({ error: "AI service quota exceeded. Please try again later or use manual entry." });
    } else if (e?.status === 500) {
      res.status(503).json({ error: "AI service temporarily unavailable. Please try again later or use manual entry." });
    } else {
      res.status(500).json({ error: "Extraction failed", details: String(err) });
    }
  }
});

export default router;

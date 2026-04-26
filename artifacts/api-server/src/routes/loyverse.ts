import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, menuItemsTable } from "@workspace/db";
import { syncFromLoyverse, pushOrderToLoyverse, importLoyverseHistory } from "../lib/loyverse";
import multer from "multer";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// GET /loyverse/sync — pull full menu from Loyverse into local DB
router.post("/loyverse/sync", async (_req, res): Promise<void> => {
  try {
    const result = await syncFromLoyverse();
    res.json({
      success: true,
      categoriesUpserted: result.categoriesUpserted,
      itemsUpserted: result.itemsUpserted,
      itemsSkipped: result.itemsSkipped,
      modifiers: result.modifiers,
      errors: result.errors,
    });
  } catch (err) {
    console.error("Loyverse sync error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// POST /loyverse/push/:orderId — push a specific order as a receipt to Loyverse
router.post("/loyverse/push/:orderId", async (req, res): Promise<void> => {
  const orderId = parseInt(req.params.orderId, 10);
  if (isNaN(orderId)) {
    res.status(400).json({ error: "Invalid order ID" });
    return;
  }

  try {
    const order = await db.query.ordersTable.findFirst({
      where: eq(ordersTable.id, orderId),
    });
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const items = await db
      .select({
        name: orderItemsTable.menuItemName,
        quantity: orderItemsTable.quantity,
        price: orderItemsTable.menuItemPrice,
        loyverseItemId: menuItemsTable.loyverseItemId,
        loyverseVariantId: menuItemsTable.loyverseVariantId,
      })
      .from(orderItemsTable)
      .leftJoin(menuItemsTable, eq(orderItemsTable.menuItemId, menuItemsTable.id))
      .where(eq(orderItemsTable.orderId, orderId));

    const receiptNumber = await pushOrderToLoyverse({
      id: order.id,
      customerName: order.customerName,
      confirmationCode: order.confirmationCode,
      notes: order.notes,
      items: items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        price: parseFloat(i.price as string),
        loyverseItemId: i.loyverseItemId ?? null,
        loyverseVariantId: i.loyverseVariantId ?? null,
      })),
    });

    res.json({ success: true, receiptNumber });
  } catch (err) {
    console.error("Loyverse push error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// POST /loyverse/import-history — one-time import of all Loyverse customers + receipts
// Protected by admin auth in routes/index.ts
router.post("/loyverse/import-history", async (_req, res): Promise<void> => {
  console.log("[loyverse/import-history] Starting one-time history import…");
  try {
    const result = await importLoyverseHistory();
    console.log(`[loyverse/import-history] Done — customers: +${result.customersImported} skipped:${result.customersSkipped} | orders: +${result.ordersImported} skipped:${result.ordersSkipped} | errors:${result.errors.length}`);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("[loyverse/import-history] Error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

/** Parse a CSV buffer (handles quoted fields, commas inside quotes, CRLF/LF) */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let cur = "";
  let inQuote = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } // escaped quote
        else inQuote = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') { inQuote = true; }
      else if (ch === ',') { row.push(cur.trim()); cur = ""; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cur.trim()); cur = "";
        if (row.some(c => c !== "")) rows.push(row);
        row = [];
      } else {
        cur += ch;
      }
    }
  }
  if (cur !== "" || row.length > 0) { row.push(cur.trim()); if (row.some(c => c !== "")) rows.push(row); }
  return rows;
}

/** Find a column index by matching header keywords (case-insensitive) */
function findCol(headers: string[], ...keywords: string[]): number {
  const h = headers.map(s => s.toLowerCase().replace(/[^a-z0-9]/g, ""));
  for (const kw of keywords) {
    const k = kw.toLowerCase().replace(/[^a-z0-9]/g, "");
    const idx = h.findIndex(s => s === k || s.includes(k));
    if (idx >= 0) return idx;
  }
  return -1;
}

/** Map Loyverse payment type strings to our internal payment method values */
function mapPaymentMethod(raw: string): "cash" | "card" | "athmovil" | "split" | "complimentary" {
  const s = raw.toLowerCase();
  if (s.includes("ath") || s.includes("movil")) return "athmovil";
  if (s.includes("card") || s.includes("credit") || s.includes("debit") || s.includes("visa") || s.includes("master")) return "card";
  if (s.includes("comp") || s.includes("free") || s.includes("staff")) return "complimentary";
  if (s.includes("split") || s.includes("mix")) return "split";
  return "cash";
}

/** Parse a date string in various formats Loyverse might export */
function parseDate(raw: string): Date | null {
  if (!raw) return null;
  // Try ISO / common formats
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d;
  // Try "MM/DD/YYYY HH:MM:SS" or "DD/MM/YYYY HH:MM:SS"
  const parts = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (parts) {
    const [, a, b, y, h, min, s] = parts;
    // Assume MM/DD/YYYY
    return new Date(`${y}-${a.padStart(2, "0")}-${b.padStart(2, "0")}T${h.padStart(2, "0")}:${min}:${s ?? "00"}`);
  }
  return null;
}

// ---------------------------------------------------------------------------
// POST /loyverse/import-csv — upload a Loyverse receipts CSV for full history
// ---------------------------------------------------------------------------
router.post("/loyverse/import-csv", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const text = req.file.buffer.toString("utf-8").replace(/^\uFEFF/, ""); // strip BOM
  const rows = parseCSV(text);
  if (rows.length < 2) {
    res.status(400).json({ error: "CSV is empty or has no data rows" });
    return;
  }

  const headers = rows[0];
  console.log("[import-csv] Headers detected:", headers);

  // Detect column positions
  const colReceipt  = findCol(headers, "receipt number", "receiptno", "receiptnumber", "receipt#", "no");
  const colDate     = findCol(headers, "date", "receiptdate", "created");
  const colTotal    = findCol(headers, "total", "amount", "netsales", "net sales");
  const colPayment  = findCol(headers, "payment type", "paymenttype", "payment method", "paymentmethod", "payment");
  const colCustomer = findCol(headers, "customer name", "customername", "customer");

  if (colReceipt < 0 || colDate < 0 || colTotal < 0) {
    res.status(400).json({
      error: `Could not detect required columns. Found headers: ${headers.join(", ")}. Need: Receipt number, Date, Total.`,
    });
    return;
  }

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  // Load all existing confirmationCodes in one shot for fast dedup
  const existing = await db.select({ cc: ordersTable.confirmationCode }).from(ordersTable).where(eq(ordersTable.source, "loyverse"));
  const existingCodes = new Set(existing.map(r => r.cc));

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 2) continue;

    const receiptNum = row[colReceipt] ?? "";
    const dateRaw    = row[colDate] ?? "";
    const totalRaw   = (row[colTotal] ?? "").replace(/[$,\s]/g, "");
    const paymentRaw = colPayment >= 0 ? (row[colPayment] ?? "") : "cash";
    const customer   = colCustomer >= 0 ? (row[colCustomer] ?? "") : "";

    if (!receiptNum || !dateRaw) { skipped++; continue; }

    const confirmationCode = `LV-${receiptNum}`;
    if (existingCodes.has(confirmationCode)) { skipped++; continue; }

    const createdAt = parseDate(dateRaw);
    if (!createdAt) { console.warn(`[import-csv] Row ${i}: could not parse date "${dateRaw}"`); errors++; continue; }

    const total = parseFloat(totalRaw);
    if (isNaN(total) || total < 0) { console.warn(`[import-csv] Row ${i}: invalid total "${totalRaw}"`); errors++; continue; }

    try {
      await db.insert(ordersTable).values({
        source: "loyverse",
        status: "completed",
        paymentStatus: "paid",
        paymentMethod: mapPaymentMethod(paymentRaw),
        confirmationCode,
        customerName: customer || "Guest",
        total: total.toFixed(2),
        notes: null,
        createdAt,
      });
      existingCodes.add(confirmationCode);
      imported++;
    } catch (err) {
      console.error(`[import-csv] Row ${i} insert error:`, err);
      errors++;
    }
  }

  console.log(`[import-csv] Done — imported:${imported} skipped:${skipped} errors:${errors}`);
  res.json({ success: true, imported, skipped, errors });
});

export default router;

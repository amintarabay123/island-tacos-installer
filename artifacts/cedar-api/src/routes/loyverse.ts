import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, menuItemsTable, loyverseDailySummaryTable } from "@workspace/db";
import { syncFromLoyverse, pushOrderToLoyverse, importLoyverseHistory } from "../lib/loyverse";
import multer from "multer";
import { logger } from "../lib/logger";

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
    logger.error({ err }, "Loyverse sync error");
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
        notes: orderItemsTable.notes,
        modifierSelections: orderItemsTable.modifierSelections,
        loyverseItemId: menuItemsTable.loyverseItemId,
        loyverseVariantId: menuItemsTable.loyverseVariantId,
      })
      .from(orderItemsTable)
      .leftJoin(menuItemsTable, eq(orderItemsTable.menuItemId, menuItemsTable.id))
      .where(eq(orderItemsTable.orderId, orderId));

    const receiptNumber = await pushOrderToLoyverse({
      id: order.id,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      confirmationCode: order.confirmationCode,
      notes: order.notes,
      total: parseFloat(order.total as string),
      paymentMethod: order.paymentMethod ?? "cash",
      items: items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        price: parseFloat(i.price as string),
        notes: i.notes ?? null,
        modifierSelections: (i.modifierSelections as { modifierId: string; optionId: string; name: string; price: number }[] | null) ?? null,
        loyverseItemId: i.loyverseItemId ?? null,
        loyverseVariantId: i.loyverseVariantId ?? null,
      })),
    });

    res.json({ success: true, receiptNumber });
  } catch (err) {
    req.log.error({ err }, "Loyverse push error");
    res.status(500).json({ error: String(err) });
  }
});

// POST /loyverse/import-history — one-time import of all Loyverse customers + receipts
router.post("/loyverse/import-history", async (_req, res): Promise<void> => {
  logger.info("[loyverse/import-history] Starting one-time history import…");
  try {
    const result = await importLoyverseHistory();
    logger.info({ result }, "[loyverse/import-history] Done");
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error({ err }, "[loyverse/import-history] Error");
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
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = false;
      } else { cur += ch; }
    } else {
      if (ch === '"') { inQuote = true; }
      else if (ch === ',') { row.push(cur.trim()); cur = ""; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cur.trim()); cur = "";
        if (row.some(c => c !== "")) rows.push(row);
        row = [];
      } else { cur += ch; }
    }
  }
  if (cur !== "" || row.length > 0) { row.push(cur.trim()); if (row.some(c => c !== "")) rows.push(row); }
  return rows;
}

/** Find a column index by matching header keywords */
function findCol(headers: string[], ...keywords: string[]): number {
  const h = headers.map(s => s.toLowerCase().replace(/[^a-z0-9]/g, ""));
  for (const kw of keywords) {
    const k = kw.toLowerCase().replace(/[^a-z0-9]/g, "");
    const idx = h.findIndex(s => s === k || s.includes(k));
    if (idx >= 0) return idx;
  }
  return -1;
}

/** Strip currency symbols and commas, parse as float */
function parseMoney(raw: string): number {
  return parseFloat(raw.replace(/[$,%\s]/g, "")) || 0;
}

/** Map Loyverse payment type strings to our internal values */
function mapPaymentMethod(raw: string): "cash" | "card" | "athmovil" | "split" | "complimentary" {
  const s = raw.toLowerCase();
  if (s.includes("ath") || s.includes("movil")) return "athmovil";
  if (s.includes("card") || s.includes("credit") || s.includes("debit") || s.includes("visa") || s.includes("master")) return "card";
  if (s.includes("comp") || s.includes("free") || s.includes("staff")) return "complimentary";
  if (s.includes("split") || s.includes("mix")) return "split";
  return "cash";
}

/** Parse date string — handles "M/D/YY", "M/D/YYYY", ISO, etc. */
function parseFlexDate(raw: string): Date | null {
  if (!raw) return null;
  // M/D/YY or M/D/YYYY (Loyverse daily summary format)
  const mdyy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(.*))?$/);
  if (mdyy) {
    let [, m, d, y] = mdyy;
    const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y);
    return new Date(Date.UTC(year, parseInt(m) - 1, parseInt(d), 12, 0, 0)); // noon UTC = safe BVI day
  }
  const iso = new Date(raw);
  return isNaN(iso.getTime()) ? null : iso;
}

// ---------------------------------------------------------------------------
// POST /loyverse/import-csv
// Handles TWO formats from Loyverse:
//   A) Daily summary: Date, Gross sales, Refunds, Discounts, Net sales, …
//   B) Per-receipt:   Receipt number, Date, Customer, Payment type, Total, …
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
  req.log.info({ headers }, "[import-csv] Headers detected");

  // ── Detect format ──────────────────────────────────────────────────────────
  const colDate     = findCol(headers, "date", "receiptdate", "created");
  const colGross    = findCol(headers, "gross sales", "grosssales");
  const colRefunds  = findCol(headers, "refunds", "refund");
  const colDiscount = findCol(headers, "discounts", "discount");
  const colNetSales = findCol(headers, "net sales", "netsales");

  // Per-receipt columns
  const colReceipt  = findCol(headers, "receipt number", "receiptno", "receiptnumber", "receipt#");
  const colTotal    = findCol(headers, "total");
  const colPayment  = findCol(headers, "payment type", "paymenttype", "payment method", "paymentmethod", "payment");
  const colCustomer = findCol(headers, "customer name", "customername", "customer");

  const isDailySummary = colGross >= 0 && colReceipt < 0;
  const isPerReceipt   = colReceipt >= 0 && (colTotal >= 0 || colGross >= 0);

  if (!isDailySummary && !isPerReceipt) {
    res.status(400).json({
      error: `Could not detect required columns. Found headers: ${headers.join(", ")}. Need either (Date + "Gross sales") for a daily summary export, or (Receipt number + Date + Total) for a receipts export.`,
    });
    return;
  }

  // ── Format A: Daily summary ────────────────────────────────────────────────
  if (isDailySummary) {
    let imported = 0, skipped = 0, errors = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 2) continue;

      const dateRaw = row[colDate] ?? "";
      const d = parseFlexDate(dateRaw);
      if (!d) { errors++; continue; }

      // Format as YYYY-MM-DD for the DATE primary key
      const dateStr = d.toISOString().slice(0, 10);

      const grossSales = colGross    >= 0 ? parseMoney(row[colGross])    : 0;
      const refunds    = colRefunds  >= 0 ? parseMoney(row[colRefunds])  : 0;
      const discounts  = colDiscount >= 0 ? parseMoney(row[colDiscount]) : 0;
      const netSales   = colNetSales >= 0 ? parseMoney(row[colNetSales]) : grossSales - refunds - discounts;

      // Skip all-zero rows (closed days)
      if (grossSales === 0 && refunds === 0) { skipped++; continue; }

      try {
        await db.insert(loyverseDailySummaryTable).values({
          date: dateStr,
          grossSales: grossSales.toFixed(2),
          refunds: refunds.toFixed(2),
          discounts: discounts.toFixed(2),
          netSales: netSales.toFixed(2),
        }).onConflictDoUpdate({
          target: loyverseDailySummaryTable.date,
          set: {
            grossSales: grossSales.toFixed(2),
            refunds: refunds.toFixed(2),
            discounts: discounts.toFixed(2),
            netSales: netSales.toFixed(2),
          },
        });
        imported++;
      } catch (err) {
        req.log.error({ err, row: i }, "[import-csv] Row error");
        errors++;
      }
    }

    req.log.info({ imported, skipped, errors }, "[import-csv] Daily summary complete");
    res.json({ success: true, format: "daily_summary", imported, skipped, errors });
    return;
  }

  // ── Format B: Per-receipt ──────────────────────────────────────────────────
  {
    let imported = 0, skipped = 0, errors = 0;

    const existing = await db.select({ cc: ordersTable.confirmationCode }).from(ordersTable).where(eq(ordersTable.source, "loyverse"));
    const existingCodes = new Set(existing.map(r => r.cc));

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 2) continue;

      const receiptNum = row[colReceipt] ?? "";
      const dateRaw    = row[colDate] ?? "";
      const totalRaw   = colTotal >= 0 ? row[colTotal] : (colGross >= 0 ? row[colGross] : "0");
      const paymentRaw = colPayment  >= 0 ? (row[colPayment] ?? "") : "cash";
      const customer   = colCustomer >= 0 ? (row[colCustomer] ?? "") : "";

      if (!receiptNum || !dateRaw) { skipped++; continue; }

      const confirmationCode = `LV-${receiptNum}`;
      if (existingCodes.has(confirmationCode)) { skipped++; continue; }

      const createdAt = parseFlexDate(dateRaw);
      if (!createdAt) { errors++; continue; }

      const total = parseMoney(totalRaw);
      if (isNaN(total) || total < 0) { errors++; continue; }

      try {
        await db.insert(ordersTable).values({
          source: "pos",
          status: "completed",
          paymentStatus: "paid",
          paymentMethod: mapPaymentMethod(paymentRaw),
          confirmationCode,
          customerName: customer || "Guest",
          subtotal: total.toFixed(2),
          tax: "0",
          total: total.toFixed(2),
          notes: null,
          createdAt,
        });
        existingCodes.add(confirmationCode);
        imported++;
      } catch (err) {
        req.log.error({ err, row: i }, "[import-csv] Row error");
        errors++;
      }
    }

    req.log.info({ imported, skipped, errors }, "[import-csv] Per-receipt complete");
    res.json({ success: true, format: "per_receipt", imported, skipped, errors });
  }
});

export default router;

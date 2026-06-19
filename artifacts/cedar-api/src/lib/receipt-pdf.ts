import PDFDocument from "pdfkit";
import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";

/**
 * Strip emoji and other non-Latin characters that PDFKit's built-in
 * Helvetica font cannot render (they produce garbled glyphs in the PDF).
 */
function stripEmoji(text: string): string {
  return text
    .replace(/\p{Emoji_Presentation}/gu, "")
    .replace(/\p{Emoji}\uFE0F/gu, "")
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export interface ReceiptPdfItem {
  name:      string;
  quantity:  number;
  unitPrice: string;
  subtotal:  string;
  modifiers?: { name: string; price: number }[];
  notes?:    string | null;
}

export interface ReceiptPdfData {
  confirmationCode: string;
  customerName:     string;
  createdAt:        Date;
  paymentMethod:    string;
  subtotal:         string;
  discountAmount:   string;
  total:            string;
  items:            ReceiptPdfItem[];
  storeEmail?:      string;
  storeName?:       string;
  storeAddress?:    string;
}

const PAY_LABEL: Record<string, string> = {
  cash:          "Cash",
  card:          "Card",
  athmovil:      "ATH Móvil",
  split:         "Split",
  complimentary: "Complimentary",
  online:        "Paid Online",
};

function fmtMoney(v: string | number): string {
  return `$${parseFloat(String(v)).toFixed(2)}`;
}

// Dashed line matching the sample receipt style
function dashes(doc: InstanceType<typeof PDFDocument>, x: number, y: number, w: number): void {
  doc.fontSize(7).font("Helvetica").fillColor("#555555")
    .text("- - - - - - - - - - - - - - - - - - - - - - - - -", x, y, {
      width: w, align: "center", lineBreak: false,
    });
}

export function buildReceiptPdf(data: ReceiptPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // ── Page geometry (80mm thermal receipt = 227pt wide) ────────────────────
    const PAGE_W  = 227;
    const MARGIN  = 10;
    const CW      = PAGE_W - MARGIN * 2;   // 207

    // Column x positions (matched exactly to sample receipt)
    const COL_NAME  = MARGIN;              // x=10
    const COL_QTY   = 120;
    const COL_PRICE = 138;
    const COL_TTL   = 173;
    const COL_TTL_W = PAGE_W - MARGIN - COL_TTL; // 34

    // Pre-calculate page height
    const discount = parseFloat(String(data.discountAmount ?? "0"));
    let itemH = 0;
    for (const item of data.items) {
      itemH += 11;                         // name + total line
      itemH += 10;                         // qty × price line
      itemH += (item.modifiers?.filter(m => m.name).length ?? 0) * 10;
      if (item.notes) itemH += 10;
      itemH += 3;                          // gap between items
    }
    const PAGE_H = 195 + itemH + (discount > 0 ? 20 : 0) + 60;

    const sName = data.storeName ?? "Restaurant";
    const doc = new PDFDocument({
      size:   [PAGE_W, PAGE_H],
      margin: 0,
      info: { Title: `${sName} Receipt - ${data.confirmationCode}`, Author: sName },
    });

    const chunks: Buffer[] = [];
    doc.on("data",  (c: Buffer) => chunks.push(c));
    doc.on("end",   ()          => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ── Logo ──────────────────────────────────────────────────────────────────
    // receipt-logo.png lives in src/assets/ and is copied to dist/assets/ at build time.
    // That keeps it inside the api-server artifact — no cross-artifact filesystem dependency.
    const __dir  = path.dirname(fileURLToPath(import.meta.url));
    const logoCandidates = [
      path.join(__dir, "assets/receipt-logo.png"),             // production: dist/assets/
      path.join(__dir, "../src/assets/receipt-logo.png"),      // dev: src/assets/ (tsx)
      path.join(process.cwd(), "src/assets/receipt-logo.png"), // fallback
    ];
    const logoPath = logoCandidates.find((p) => existsSync(p));

    let y = 10;
    if (logoPath) {
      const logoW = 130;
      const logoH = 65;
      doc.image(logoPath, (PAGE_W - logoW) / 2, y, { width: logoW, height: logoH });
      y += logoH + 11;   // y ≈ 86
    } else if (data.storeName) {
      // Fallback: store name in text
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#e05a00")
        .text(data.storeName.toUpperCase(), MARGIN, y, { width: CW, align: "center" });
      y += 20;
    }

    // ── Store address & email ─────────────────────────────────────────────────
    if (data.storeAddress) {
      doc.fontSize(7).font("Helvetica").fillColor("#000000")
        .text(data.storeAddress, MARGIN, y, { width: CW, align: "center" });
      y += 10;
    }
    if (data.storeEmail) {
      doc.fontSize(7).font("Helvetica").fillColor("#000000")
        .text(data.storeEmail, MARGIN, y, { width: CW, align: "center" });
      y += 11;
    } else {
      y += 2;
    }

    // ── Divider ───────────────────────────────────────────────────────────────
    dashes(doc, MARGIN, y, CW); y += 11;

    // ── Receipt heading ───────────────────────────────────────────────────────
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#000000")
      .text("ORDER RECEIPT", MARGIN, y, { width: CW, align: "center" });
    y += 13;

    // ── Order # and date on same line ─────────────────────────────────────────
    const dateStr = new Date(data.createdAt).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      timeZone: "America/Puerto_Rico",
    }) + "  " + new Date(data.createdAt).toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit",
      timeZone: "America/Puerto_Rico",
    });
    doc.fontSize(7).font("Helvetica").fillColor("#000000")
      .text(`Order #: ${data.confirmationCode}`, COL_NAME, y, { lineBreak: false });
    doc.fontSize(7).font("Helvetica").fillColor("#000000")
      .text(dateStr, 90, y, { width: PAGE_W - MARGIN - 90, align: "right", lineBreak: false });
    y += 10;

    doc.fontSize(7).font("Helvetica").fillColor("#000000")
      .text(`Customer: ${data.customerName}`, COL_NAME, y);
    y += 10;

    doc.fontSize(7).font("Helvetica").fillColor("#000000")
      .text(`Payment: ${PAY_LABEL[data.paymentMethod] ?? data.paymentMethod}`, COL_NAME, y);
    y += 11;

    // ── Divider ───────────────────────────────────────────────────────────────
    dashes(doc, MARGIN, y, CW); y += 11;

    // ── Column headers ────────────────────────────────────────────────────────
    doc.fontSize(7.5).font("Helvetica-Bold").fillColor("#000000");
    doc.text("ITEM",  COL_NAME,  y, { lineBreak: false });
    doc.text("QTY",   COL_QTY,   y, { lineBreak: false });
    doc.text("PRICE", COL_PRICE, y, { lineBreak: false });
    doc.text("TTL",   COL_TTL,   y, { width: COL_TTL_W, align: "right", lineBreak: false });
    y += 10;

    // ── Line items ────────────────────────────────────────────────────────────
    for (const item of data.items) {
      doc.fontSize(7.5).font("Helvetica").fillColor("#000000");
      doc.text(stripEmoji(item.name),    COL_NAME,  y, { width: 108, lineBreak: false });
      doc.text(String(item.quantity),    COL_QTY,   y, { lineBreak: false });
      doc.text(fmtMoney(item.unitPrice), COL_PRICE, y, { lineBreak: false });
      doc.text(fmtMoney(item.subtotal),  COL_TTL,   y, { width: COL_TTL_W, align: "right", lineBreak: false });
      y += 11;

      for (const mod of item.modifiers ?? []) {
        if (!mod.name) continue;
        const label = mod.price > 0
          ? `+ ${stripEmoji(mod.name)}  +${fmtMoney(mod.price)}`
          : `+ ${stripEmoji(mod.name)}`;
        doc.fontSize(7).font("Helvetica").fillColor("#555555")
          .text(label, MARGIN + 6, y, { width: CW - 6, lineBreak: false });
        y += 10;
      }

      if (item.notes) {
        doc.fontSize(7).font("Helvetica-Oblique").fillColor("#777777")
          .text(`Note: ${stripEmoji(item.notes)}`, MARGIN + 6, y, { width: CW - 6, lineBreak: false });
        y += 10;
      }

      y += 3;
    }

    // ── Divider ───────────────────────────────────────────────────────────────
    dashes(doc, MARGIN, y, CW); y += 11;

    // ── Totals ────────────────────────────────────────────────────────────────
    if (discount > 0) {
      doc.fontSize(7.5).font("Helvetica").fillColor("#000000")
        .text("Subtotal", COL_NAME, y, { lineBreak: false });
      doc.text(fmtMoney(data.subtotal), COL_TTL, y, { width: COL_TTL_W, align: "right", lineBreak: false });
      y += 10;

      doc.fontSize(7.5).font("Helvetica").fillColor("#000000")
        .text("Discount", COL_NAME, y, { lineBreak: false });
      doc.text(`-${fmtMoney(discount)}`, COL_TTL, y, { width: COL_TTL_W, align: "right", lineBreak: false });
      y += 10;
    }

    doc.fontSize(8).font("Helvetica-Bold").fillColor("#000000")
      .text("TOTAL", COL_NAME, y, { lineBreak: false });
    doc.fontSize(8).font("Helvetica-Bold").fillColor("#000000")
      .text(fmtMoney(data.total), COL_TTL, y, { width: COL_TTL_W, align: "right", lineBreak: false });
    y += 13;

    // ── Divider ───────────────────────────────────────────────────────────────
    dashes(doc, MARGIN, y, CW); y += 11;

    // ── Footer ────────────────────────────────────────────────────────────────
    doc.fontSize(7.5).font("Helvetica").fillColor("#000000")
      .text("Thank you for dining with us!", MARGIN, y, { width: CW, align: "center" });
    y += 10;
    doc.fontSize(7).font("Helvetica").fillColor("#555555")
      .text("Pickup Only · Road Town, BVI", MARGIN, y, { width: CW, align: "center" });

    doc.end();
  });
}

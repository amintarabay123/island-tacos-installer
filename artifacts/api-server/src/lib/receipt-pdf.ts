import PDFDocument from "pdfkit";
import path from "path";
import { existsSync } from "fs";

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

export function buildReceiptPdf(data: ReceiptPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size:   "A4",
      margin: 50,
      info: {
        Title:  `Island Tacos Receipt - ${data.confirmationCode}`,
        Author: "Island Tacos",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data",  (c: Buffer) => chunks.push(c));
    doc.on("end",   ()          => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const LEFT = 50;
    const W    = doc.page.width - LEFT * 2; // 495 pts on A4

    // ── Logo + store name (top-left) ─────────────────────────────────────────
    const logoPath = path.join(process.cwd(), "artifacts/island-tacos/public/logo.png");
    const HEADER_Y = 40;

    if (existsSync(logoPath)) {
      doc.image(logoPath, LEFT, HEADER_Y, { width: 52 });
      doc.fontSize(20).font("Helvetica-Bold").fillColor("#e05a00")
        .text("ISLAND TACOS", LEFT + 62, HEADER_Y + 4);
      doc.fontSize(9).font("Helvetica").fillColor("#999")
        .text("Wickhams Cay 1 · Road Town, BVI", LEFT + 62, HEADER_Y + 27);
    } else {
      doc.fontSize(20).font("Helvetica-Bold").fillColor("#e05a00")
        .text("ISLAND TACOS", LEFT, HEADER_Y + 4);
      doc.fontSize(9).font("Helvetica").fillColor("#999")
        .text("Wickhams Cay 1 · Road Town, BVI", LEFT, HEADER_Y + 27);
    }

    // ── Receipt label + code + date (top-right) ───────────────────────────────
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#444")
      .text("RECEIPT", LEFT, HEADER_Y + 4, { width: W, align: "right" });
    doc.fontSize(10).font("Helvetica-Bold").fillColor("#e05a00")
      .text(data.confirmationCode, LEFT, HEADER_Y + 20, { width: W, align: "right" });
    doc.fontSize(9).font("Helvetica").fillColor("#999")
      .text(
        new Date(data.createdAt).toLocaleDateString("en-US", {
          month: "long", day: "numeric", year: "numeric",
          timeZone: "America/Puerto_Rico",
        }),
        LEFT, HEADER_Y + 35, { width: W, align: "right" }
      );

    // ── Divider ───────────────────────────────────────────────────────────────
    const AFTER_HEADER = 98;
    doc.moveTo(LEFT, AFTER_HEADER).lineTo(LEFT + W, AFTER_HEADER)
      .strokeColor("#ddd").lineWidth(1).stroke();

    // ── Bill-to ───────────────────────────────────────────────────────────────
    let y = AFTER_HEADER + 14;
    doc.fontSize(7).font("Helvetica-Bold").fillColor("#aaa")
      .text("BILLED TO", LEFT, y, { characterSpacing: 1 });
    y += 13;
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#111")
      .text(data.customerName, LEFT, y);
    y += 22;

    // ── Column headers ────────────────────────────────────────────────────────
    doc.moveTo(LEFT, y).lineTo(LEFT + W, y).strokeColor("#eee").lineWidth(0.5).stroke();
    y += 8;

    // Column x positions and widths
    const C_NAME  = LEFT;
    const C_QTY   = LEFT + W * 0.58;
    const C_PRICE = LEFT + W * 0.72;
    const C_TOTAL = LEFT + W * 0.86;
    const CW_NAME  = W * 0.56;
    const CW_QTY   = W * 0.12;
    const CW_PRICE = W * 0.13;
    const CW_TOTAL = W * 0.14;

    doc.fontSize(7).font("Helvetica-Bold").fillColor("#aaa");
    doc.text("ITEM",  C_NAME,  y, { width: CW_NAME,  characterSpacing: 1 });
    doc.text("QTY",   C_QTY,   y, { width: CW_QTY,   align: "center", characterSpacing: 1 });
    doc.text("PRICE", C_PRICE, y, { width: CW_PRICE, align: "right",  characterSpacing: 1 });
    doc.text("TOTAL", C_TOTAL, y, { width: CW_TOTAL, align: "right",  characterSpacing: 1 });
    y += 14;
    doc.moveTo(LEFT, y).lineTo(LEFT + W, y).strokeColor("#eee").lineWidth(0.5).stroke();
    y += 9;

    // ── Line items ────────────────────────────────────────────────────────────
    for (const item of data.items) {
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#111")
        .text(item.name, C_NAME, y, { width: CW_NAME, lineBreak: false });
      doc.fontSize(10).font("Helvetica").fillColor("#333");
      doc.text(String(item.quantity),    C_QTY,   y, { width: CW_QTY,   align: "center", lineBreak: false });
      doc.text(fmtMoney(item.unitPrice), C_PRICE, y, { width: CW_PRICE, align: "right",  lineBreak: false });
      doc.text(fmtMoney(item.subtotal),  C_TOTAL, y, { width: CW_TOTAL, align: "right",  lineBreak: false });
      y += 18;

      for (const mod of item.modifiers ?? []) {
        if (!mod.name) continue;
        const label = mod.price > 0
          ? `+ ${mod.name}  +${fmtMoney(mod.price)}`
          : `+ ${mod.name}`;
        doc.fontSize(8).font("Helvetica").fillColor("#777")
          .text(label, C_NAME + 10, y, { width: CW_NAME + CW_QTY + CW_PRICE, lineBreak: false });
        y += 12;
      }

      if (item.notes) {
        doc.fontSize(8).font("Helvetica-Oblique").fillColor("#999")
          .text(`Note: ${item.notes}`, C_NAME + 10, y, { width: W - 20, lineBreak: false });
        y += 12;
      }

      y += 4;
    }

    // ── Totals ────────────────────────────────────────────────────────────────
    y += 6;
    doc.moveTo(LEFT, y).lineTo(LEFT + W, y).strokeColor("#ddd").lineWidth(0.5).stroke();
    y += 14;

    const LABEL_X = C_PRICE - 60;
    const LABEL_W = 60 + CW_PRICE;

    const discount = parseFloat(String(data.discountAmount ?? "0"));
    if (discount > 0) {
      doc.fontSize(10).font("Helvetica").fillColor("#555");
      doc.text("Subtotal",            LABEL_X, y, { width: LABEL_W, align: "right", lineBreak: false });
      doc.text(fmtMoney(data.subtotal), C_TOTAL, y, { width: CW_TOTAL, align: "right", lineBreak: false });
      y += 17;
      doc.fillColor("#16a34a");
      doc.text("Discount",            LABEL_X, y, { width: LABEL_W, align: "right", lineBreak: false });
      doc.text(`-${fmtMoney(discount)}`, C_TOTAL, y, { width: CW_TOTAL, align: "right", lineBreak: false });
      y += 17;
    }

    doc.fontSize(14).font("Helvetica-Bold").fillColor("#111");
    doc.text("TOTAL",             LABEL_X, y, { width: LABEL_W, align: "right", lineBreak: false });
    doc.text(fmtMoney(data.total), C_TOTAL, y, { width: CW_TOTAL, align: "right", lineBreak: false });
    y += 22;

    doc.fontSize(9).font("Helvetica").fillColor("#aaa")
      .text(
        `Paid via ${PAY_LABEL[data.paymentMethod] ?? data.paymentMethod}`,
        LABEL_X, y,
        { width: LABEL_W + CW_TOTAL, align: "right", lineBreak: false }
      );
    y += 30;

    // ── Footer ────────────────────────────────────────────────────────────────
    doc.moveTo(LEFT, y).lineTo(LEFT + W, y).strokeColor("#ddd").lineWidth(1).stroke();
    y += 16;
    doc.fontSize(10).font("Helvetica").fillColor("#888")
      .text("Thank you for dining with Island Tacos!", LEFT, y, { width: W, align: "center" });
    y += 16;
    doc.fontSize(8).font("Helvetica").fillColor("#ccc")
      .text(
        "Wickhams Cay 1 · Road Town, BVI · (284) 544-8088 · orders.islandtacosbvi.com",
        LEFT, y, { width: W, align: "center" }
      );

    doc.end();
  });
}

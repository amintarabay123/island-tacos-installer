import PDFDocument from "pdfkit";
import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";

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

function dashedLine(doc: InstanceType<typeof PDFDocument>, x: number, w: number, y: number): void {
  doc.save()
    .moveTo(x, y).lineTo(x + w, y)
    .dash(2, { space: 2 })
    .strokeColor("#cccccc").lineWidth(0.5).stroke()
    .restore();
}

export function buildReceiptPdf(data: ReceiptPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // ── Page geometry (80 mm thermal receipt) ─────────────────────────────────
    const MM_TO_PT = 2.8346;
    const PAGE_W   = Math.round(80 * MM_TO_PT);   // 227 pts
    const MARGIN   = 12;
    const CW       = PAGE_W - MARGIN * 2;          // content width

    // Pre-calculate page height so the PDF is snug (no trailing blank space)
    let estimatedH = 310; // header + order info + totals + footer
    for (const item of data.items) {
      estimatedH += 22;
      estimatedH += (item.modifiers?.filter(m => m.name).length ?? 0) * 13;
      if (item.notes) estimatedH += 13;
    }
    const discount = parseFloat(String(data.discountAmount ?? "0"));
    if (discount > 0) estimatedH += 34;
    const PAGE_H = estimatedH + 30;

    const doc = new PDFDocument({
      size:    [PAGE_W, PAGE_H],
      margin:  0,
      info: {
        Title:  `Island Tacos Receipt - ${data.confirmationCode}`,
        Author: "Island Tacos",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data",  (c: Buffer) => chunks.push(c));
    doc.on("end",   ()          => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    let y = MARGIN;

    // ── Logo ───────────────────────────────────────────────────────────────────
    // Use import.meta.url so the path is correct regardless of process.cwd().
    // The compiled bundle lives at artifacts/api-server/dist/index.mjs;
    // logo.png is 512×512 (108 KB) — small enough to embed in a receipt PDF.
    const __dir = path.dirname(fileURLToPath(import.meta.url));
    const logoCandidates = [
      path.join(__dir, "../../../artifacts/island-tacos/public/logo.png"),
      path.join(process.cwd(), "artifacts/island-tacos/public/logo.png"),
    ];
    const logoPath = logoCandidates.find((p) => existsSync(p));
    if (logoPath) {
      const logoW = 110;
      doc.image(logoPath, (PAGE_W - logoW) / 2, y, { width: logoW });
      y += 40;
    }

    // ── Store name & address ───────────────────────────────────────────────────
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#e05a00")
      .text("ISLAND TACOS", MARGIN, y, { width: CW, align: "center" });
    y += 15;
    doc.fontSize(7.5).font("Helvetica").fillColor("#777")
      .text("Wickhams Cay 1 · Road Town, BVI", MARGIN, y, { width: CW, align: "center" });
    y += 11;
    doc.fontSize(7.5).font("Helvetica").fillColor("#777")
      .text("(284) 544-8088", MARGIN, y, { width: CW, align: "center" });
    y += 14;

    dashedLine(doc, MARGIN, CW, y); y += 10;

    // ── Receipt heading ────────────────────────────────────────────────────────
    doc.fontSize(7).font("Helvetica-Bold").fillColor("#aaa")
      .text("RECEIPT", MARGIN, y, { width: CW, align: "center", characterSpacing: 1.5 });
    y += 11;
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#111")
      .text(data.confirmationCode, MARGIN, y, { width: CW, align: "center" });
    y += 16;
    doc.fontSize(7.5).font("Helvetica").fillColor("#777")
      .text(
        new Date(data.createdAt).toLocaleDateString("en-US", {
          month: "long", day: "numeric", year: "numeric",
          timeZone: "America/Puerto_Rico",
        }) + "  " +
        new Date(data.createdAt).toLocaleTimeString("en-US", {
          hour: "numeric", minute: "2-digit",
          timeZone: "America/Puerto_Rico",
        }),
        MARGIN, y, { width: CW, align: "center" },
      );
    y += 14;

    dashedLine(doc, MARGIN, CW, y); y += 10;

    // ── Customer ───────────────────────────────────────────────────────────────
    doc.fontSize(7).font("Helvetica-Bold").fillColor("#aaa")
      .text("CUSTOMER", MARGIN, y, { characterSpacing: 1 });
    y += 11;
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#111")
      .text(data.customerName, MARGIN, y);
    y += 15;

    dashedLine(doc, MARGIN, CW, y); y += 8;

    // ── Column headers ─────────────────────────────────────────────────────────
    const PRICE_X = MARGIN + CW - 48;
    const PRICE_W = 48;
    const NAME_W  = CW - PRICE_W - 4;

    doc.fontSize(7).font("Helvetica-Bold").fillColor("#aaa");
    doc.text("ITEM",  MARGIN,   y, { width: NAME_W,  characterSpacing: 1 });
    doc.text("TOTAL", PRICE_X,  y, { width: PRICE_W, align: "right", characterSpacing: 1 });
    y += 11;
    dashedLine(doc, MARGIN, CW, y); y += 7;

    // ── Line items ─────────────────────────────────────────────────────────────
    for (const item of data.items) {
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#111")
        .text(item.name, MARGIN, y, { width: NAME_W, lineBreak: false });
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#111")
        .text(fmtMoney(item.subtotal), PRICE_X, y, { width: PRICE_W, align: "right", lineBreak: false });
      y += 13;

      doc.fontSize(7.5).font("Helvetica").fillColor("#888")
        .text(`${item.quantity} × ${fmtMoney(item.unitPrice)}`, MARGIN + 4, y, { lineBreak: false });
      y += 11;

      for (const mod of item.modifiers ?? []) {
        if (!mod.name) continue;
        const label = mod.price > 0
          ? `+ ${mod.name}  +${fmtMoney(mod.price)}`
          : `+ ${mod.name}`;
        doc.fontSize(7.5).font("Helvetica").fillColor("#aaa")
          .text(label, MARGIN + 4, y, { width: CW - 8, lineBreak: false });
        y += 12;
      }

      if (item.notes) {
        doc.fontSize(7.5).font("Helvetica-Oblique").fillColor("#aaa")
          .text(`Note: ${item.notes}`, MARGIN + 4, y, { width: CW - 8, lineBreak: false });
        y += 12;
      }

      y += 3;
    }

    dashedLine(doc, MARGIN, CW, y); y += 9;

    // ── Totals ─────────────────────────────────────────────────────────────────
    const LBL_X = MARGIN;
    const VAL_X = MARGIN + CW - 60;
    const VAL_W = 60;

    if (discount > 0) {
      doc.fontSize(9).font("Helvetica").fillColor("#555");
      doc.text("Subtotal", LBL_X, y, { lineBreak: false });
      doc.text(fmtMoney(data.subtotal), VAL_X, y, { width: VAL_W, align: "right", lineBreak: false });
      y += 14;

      doc.fontSize(9).font("Helvetica").fillColor("#16a34a");
      doc.text("Discount", LBL_X, y, { lineBreak: false });
      doc.text(`−${fmtMoney(discount)}`, VAL_X, y, { width: VAL_W, align: "right", lineBreak: false });
      y += 14;

      dashedLine(doc, MARGIN, CW, y); y += 9;
    }

    doc.fontSize(11).font("Helvetica-Bold").fillColor("#111");
    doc.text("TOTAL", LBL_X, y, { lineBreak: false });
    doc.text(fmtMoney(data.total), VAL_X, y, { width: VAL_W, align: "right", lineBreak: false });
    y += 17;

    doc.fontSize(8).font("Helvetica").fillColor("#aaa")
      .text(
        `Paid via ${PAY_LABEL[data.paymentMethod] ?? data.paymentMethod}`,
        LBL_X, y, { width: CW, align: "right", lineBreak: false },
      );
    y += 18;

    dashedLine(doc, MARGIN, CW, y); y += 12;

    // ── Footer ─────────────────────────────────────────────────────────────────
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#e05a00")
      .text("Thank you!", MARGIN, y, { width: CW, align: "center" });
    y += 13;
    doc.fontSize(8).font("Helvetica").fillColor("#888")
      .text("Come visit us again soon 🌮", MARGIN, y, { width: CW, align: "center" });
    y += 13;
    doc.fontSize(7).font("Helvetica").fillColor("#bbb")
      .text("orders.islandtacosbvi.com", MARGIN, y, { width: CW, align: "center" });

    doc.end();
  });
}

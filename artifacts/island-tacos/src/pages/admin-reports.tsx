import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { authHeaders, clearAuthToken } from "@/lib/auth";
import { adminRoutes } from "@/lib/admin-path";
import { ArrowLeft, Download, RefreshCw, Calendar, TrendingUp, DollarSign, ShoppingBag, Percent, Printer, Save } from "lucide-react";
import jsPDF from "jspdf";

interface SalesReport {
  from: string;
  to: string;
  totalOrders: number;
  paidOrders: number;
  cancelledOrders: number;
  totalSales: number;
  byMethod: { cash: number; card: number; athmovil: number; split: number; complimentary: number };
  refundTotal: number;
  netSales: number;
  avgOrderValue: number;
  topItems: { name: string; quantity: number; revenue: number }[];
  daily: { date: string; sales: number; orders: number }[];
}

interface PrinterConfig {
  type: "browser" | "network" | "bridge";
  ip: string;
  port: number;
  bridgeUrl: string;
}

function fmt(n: number) { return `$${n.toFixed(2)}`; }

const PRESETS = [
  { label: "Today", get: () => { const d = new Date(); return { from: d.toISOString().slice(0, 10), to: d.toISOString().slice(0, 10) }; } },
  { label: "Yesterday", get: () => { const d = new Date(); d.setDate(d.getDate() - 1); const s = d.toISOString().slice(0, 10); return { from: s, to: s }; } },
  { label: "This Week", get: () => { const d = new Date(); const day = d.getDay(); const from = new Date(d); from.setDate(d.getDate() - day); return { from: from.toISOString().slice(0, 10), to: d.toISOString().slice(0, 10) }; } },
  { label: "This Month", get: () => { const d = new Date(); return { from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`, to: d.toISOString().slice(0, 10) }; } },
  { label: "Last Month", get: () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); const from = d.toISOString().slice(0, 10); const to = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10); return { from, to }; } },
  { label: "This Year", get: () => { const d = new Date(); return { from: `${d.getFullYear()}-01-01`, to: d.toISOString().slice(0, 10) }; } },
];

export default function AdminReports() {
  const [, navigate] = useLocation();
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [activePreset, setActivePreset] = useState("Today");
  const [report, setReport] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printerConfig, setPrinterConfig] = useState<PrinterConfig>(() => {
    try { return JSON.parse(localStorage.getItem("printerConfig") ?? "{}"); } catch { return { type: "browser", ip: "", port: 9100 }; }
  });
  const [showPrinterSettings, setShowPrinterSettings] = useState(false);
  const [printerSaved, setPrinterSaved] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include", cache: "no-store", headers: authHeaders() })
      .then(r => r.json()).then(d => { if (!d.authed || d.role !== "admin") navigate(adminRoutes.login); })
      .catch(() => navigate(adminRoutes.login));
  }, [navigate]);

  const loadReport = useCallback(async (f: string, t: string) => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`/api/reports/sales?from=${f}&to=${t}`, { credentials: "include", headers: authHeaders() });
      if (!r.ok) throw new Error(await r.text());
      setReport(await r.json());
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadReport(from, to); }, []);

  const applyPreset = (label: string, get: () => { from: string; to: string }) => {
    const { from: f, to: t } = get();
    setFrom(f); setTo(t); setActivePreset(label);
    loadReport(f, t);
  };

  const savePrinterConfig = () => {
    localStorage.setItem("printerConfig", JSON.stringify(printerConfig));
    setPrinterSaved(true);
    setTimeout(() => setPrinterSaved(false), 2000);
  };

  const [pdfGenerating, setPdfGenerating] = useState(false);

  /** Builds the shared summary HTML used by both print and PDF export */
  // Strip emoji and non-Latin characters so PDF fonts render correctly
  const stripEmoji = (s: string) =>
    s.replace(/[\uD800-\uDFFF]/g, '')   // surrogate pairs (emoji above BMP)
     .replace(/[\u2600-\u27BF]/g, '')   // misc symbols & dingbats
     .replace(/[\uFE00-\uFE0F]/g, '')   // variation selectors
     .replace(/\u200D/g, '')            // zero-width joiner
     .replace(/\s+/g, ' ')
     .trim();

  const buildSummaryHTML = () => {
    if (!report) return "";
    const period = from === to ? from : `${from} to ${to}`;
    const generated = new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });
    const methods = [
      { label: "Cash",          value: report.byMethod.cash,          color: "#16a34a" },
      { label: "Card",          value: report.byMethod.card,          color: "#2563eb" },
      { label: "ATH Móvil",     value: report.byMethod.athmovil,      color: "#7c3aed" },
      { label: "Split",         value: report.byMethod.split ?? 0,    color: "#d97706" },
      { label: "Complimentary", value: report.byMethod.complimentary ?? 0, color: "#6b7280" },
    ].filter(m => m.value > 0);

    const pct = (v: number) => report.totalSales > 0 ? ((v / report.totalSales) * 100).toFixed(1) : "0.0";

    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; background:#fff; color:#1a1a1a; }
  .page { max-width: 720px; margin: 0 auto; padding: 0; }

  /* Header */
  .header { background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 32px 40px 28px; color: #fff; display: flex; justify-content: space-between; align-items: flex-start; }
  .header-left .brand { font-size: 26px; font-weight: 900; letter-spacing: -0.5px; }
  .header-left .subtitle { font-size: 12px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; opacity: 0.85; margin-top: 3px; }
  .header-left .address { font-size: 11px; opacity: 0.7; margin-top: 10px; }
  .header-right { text-align: right; }
  .header-right .period { font-size: 15px; font-weight: 700; }
  .header-right .generated { font-size: 10px; opacity: 0.75; margin-top: 4px; }

  /* KPI row */
  .kpi-row { display: grid; grid-template-columns: repeat(4,1fr); gap: 0; border-bottom: 1px solid #f0f0f0; }
  .kpi { padding: 22px 20px 18px; border-right: 1px solid #f0f0f0; position: relative; }
  .kpi:last-child { border-right: none; }
  .kpi-accent { position: absolute; top: 0; left: 0; width: 4px; height: 100%; border-radius: 0; }
  .kpi-value { font-size: 22px; font-weight: 800; color: #111; letter-spacing: -0.5px; margin-bottom: 3px; }
  .kpi-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; }
  .kpi-sub { font-size: 11px; color: #6b7280; margin-top: 2px; }

  /* Two column body */
  .body { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border-bottom: 1px solid #f0f0f0; }
  .col { padding: 28px 32px; }
  .col:first-child { border-right: 1px solid #f0f0f0; }
  .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #9ca3af; margin-bottom: 16px; }

  /* Payment bars */
  .method { margin-bottom: 14px; }
  .method-header { display: flex; justify-content: space-between; margin-bottom: 5px; }
  .method-name { font-size: 13px; font-weight: 600; color: #374151; }
  .method-amt { font-size: 13px; font-weight: 700; color: #111; }
  .method-pct { font-size: 11px; color: #9ca3af; margin-top: 2px; }
  .bar-bg { background: #f3f4f6; border-radius: 4px; height: 7px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 4px; }

  /* Summary rows */
  .sum-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f9fafb; }
  .sum-row:last-child { border-bottom: none; }
  .sum-label { font-size: 13px; color: #4b5563; }
  .sum-value { font-size: 13px; font-weight: 600; color: #111; }
  .sum-row.indent .sum-label { padding-left: 12px; font-size: 12px; color: #9ca3af; }
  .sum-row.indent .sum-value { font-size: 12px; color: #9ca3af; }
  .sum-row.net { background: #fff7ed; border-radius: 8px; padding: 12px 14px; margin-top: 6px; border: none; }
  .sum-row.net .sum-label { font-size: 14px; font-weight: 700; color: #ea580c; }
  .sum-row.net .sum-value { font-size: 16px; font-weight: 800; color: #ea580c; }

  /* Top items */
  .items-section { padding: 24px 32px; border-bottom: 1px solid #f0f0f0; }
  .item-row { display: grid; grid-template-columns: 20px 1fr 70px 80px 50px; gap: 8px; align-items: center; padding: 8px 0; border-bottom: 1px solid #f9fafb; }
  .item-row.header-row { padding-bottom: 6px; }
  .item-row .num { font-size: 11px; color: #d1d5db; font-weight: 600; }
  .item-row .name { font-size: 13px; font-weight: 600; color: #111; }
  .item-row .qty { font-size: 12px; color: #6b7280; text-align: right; }
  .item-row .rev { font-size: 13px; font-weight: 600; color: #111; text-align: right; }
  .item-row .pct { font-size: 11px; color: #9ca3af; text-align: right; }
  .item-row.header-row .num, .item-row.header-row .name,
  .item-row.header-row .qty, .item-row.header-row .rev,
  .item-row.header-row .pct { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; }

  /* Footer */
  .footer { display: flex; justify-content: space-between; align-items: center; padding: 16px 40px; background: #f9fafb; border-top: 1px solid #f0f0f0; }
  .footer-brand { font-size: 11px; font-weight: 600; color: #9ca3af; }
  .footer-note { font-size: 10px; color: #d1d5db; }

  @media print {
    @page { margin: 0; size: A4; }
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .page { max-width: 100%; }
  }
</style>
</head><body>
<div class="page">
  <!-- Header -->
  <div class="header">
    <div class="header-left">
      <div class="brand">ISLAND TACOS</div>
      <div class="subtitle">Sales Summary Report</div>
      <div class="address">Wickhams Cay 1, Road Town, Tortola · BVI</div>
    </div>
    <div class="header-right">
      <div class="period">${period}</div>
      <div class="generated">Generated ${generated}</div>
    </div>
  </div>

  <!-- KPI row -->
  <div class="kpi-row">
    <div class="kpi"><div class="kpi-accent" style="background:#16a34a"></div>
      <div class="kpi-value">${fmt(report.totalSales)}</div>
      <div class="kpi-label">Gross Sales</div>
    </div>
    <div class="kpi"><div class="kpi-accent" style="background:#2563eb"></div>
      <div class="kpi-value">${fmt(report.netSales)}</div>
      <div class="kpi-label">Net Sales</div>
      ${report.refundTotal > 0 ? `<div class="kpi-sub">after ${fmt(report.refundTotal)} in refunds</div>` : ""}
    </div>
    <div class="kpi"><div class="kpi-accent" style="background:#7c3aed"></div>
      <div class="kpi-value">${report.paidOrders.toLocaleString()}</div>
      <div class="kpi-label">Paid Orders</div>
      ${report.cancelledOrders > 0 ? `<div class="kpi-sub">${report.cancelledOrders} cancelled</div>` : ""}
    </div>
    <div class="kpi"><div class="kpi-accent" style="background:#f97316"></div>
      <div class="kpi-value">${fmt(report.avgOrderValue)}</div>
      <div class="kpi-label">Avg Order Value</div>
    </div>
  </div>

  <!-- Body: payment methods + financial summary -->
  <div class="body">
    <!-- Payment Methods -->
    <div class="col">
      <div class="section-title">Payment Breakdown</div>
      ${methods.map(m => `
        <div class="method">
          <div class="method-header">
            <span class="method-name">${m.label}</span>
            <span class="method-amt">${fmt(m.value)}</span>
          </div>
          <div class="bar-bg"><div class="bar-fill" style="width:${pct(m.value)}%;background:${m.color}"></div></div>
          <div class="method-pct">${pct(m.value)}% of gross sales</div>
        </div>`).join("")}
    </div>

    <!-- Financial Summary -->
    <div class="col">
      <div class="section-title">Financial Summary</div>
      <div class="sum-row">
        <span class="sum-label">Gross Sales</span>
        <span class="sum-value">${fmt(report.totalSales)}</span>
      </div>
      ${report.byMethod.cash > 0 ? `<div class="sum-row indent"><span class="sum-label">Cash</span><span class="sum-value">${fmt(report.byMethod.cash)}</span></div>` : ""}
      ${report.byMethod.card > 0 ? `<div class="sum-row indent"><span class="sum-label">Card</span><span class="sum-value">${fmt(report.byMethod.card)}</span></div>` : ""}
      ${report.byMethod.athmovil > 0 ? `<div class="sum-row indent"><span class="sum-label">ATH M\u00F3vil</span><span class="sum-value">${fmt(report.byMethod.athmovil)}</span></div>` : ""}
      ${(report.byMethod.split ?? 0) > 0 ? `<div class="sum-row indent"><span class="sum-label">Split</span><span class="sum-value">${fmt(report.byMethod.split)}</span></div>` : ""}
      ${(report.byMethod.complimentary ?? 0) > 0 ? `<div class="sum-row indent"><span class="sum-label">Complimentary</span><span class="sum-value">${fmt(report.byMethod.complimentary)}</span></div>` : ""}
      ${report.refundTotal > 0 ? `<div class="sum-row"><span class="sum-label">Total Refunds</span><span class="sum-value" style="color:#dc2626">- ${fmt(report.refundTotal)}</span></div>` : ""}
      <div class="sum-row net">
        <span class="sum-label">Net Sales</span>
        <span class="sum-value">${fmt(report.netSales)}</span>
      </div>
    </div>
  </div>

  ${report.topItems.length > 0 ? `
  <!-- Top Items -->
  <div class="items-section">
    <div class="section-title">Top Items (recent period)</div>
    <div class="item-row header-row">
      <span class="num">#</span><span class="name">Item</span>
      <span class="qty">Qty</span><span class="rev">Revenue</span><span class="pct">% Sales</span>
    </div>
    ${report.topItems.slice(0, 10).map((item, i) => `
      <div class="item-row">
        <span class="num">${i + 1}</span>
        <span class="name">${stripEmoji(item.name)}</span>
        <span class="qty">${item.quantity.toLocaleString()}</span>
        <span class="rev">${fmt(item.revenue)}</span>
        <span class="pct">${pct(item.revenue)}%</span>
      </div>`).join("")}
  </div>` : ""}

  <!-- Footer -->
  <div class="footer">
    <div class="footer-brand">Island Tacos · Confidential</div>
    <div class="footer-note">This report is generated from POS and online order data</div>
  </div>
</div>
</body></html>`;
  };

  const handlePrint = () => {
    const html = buildSummaryHTML();
    if (!html) return;
    const win = window.open("", "_blank", "width=800,height=700");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  };

  const handleDownloadPDF = () => {
    if (!report) return;
    setPdfGenerating(true);
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W = 210;
      const ML = 14;
      const MR = W - 14;
      const CW = MR - ML; // content width = 182mm
      let y = 0;

      // color palette
      const orange  = [249, 115, 22]  as [number, number, number];
      const orangeD = [234, 88,  12]  as [number, number, number];
      const dark    = [17,  17,  17]  as [number, number, number];
      const mid     = [107, 114, 128] as [number, number, number];
      const faint   = [209, 213, 219] as [number, number, number];
      const bg      = [249, 250, 251] as [number, number, number];
      const green   = [22,  163, 74]  as [number, number, number];
      const blue    = [37,  99,  235] as [number, number, number];
      const purple  = [124, 58,  237] as [number, number, number];
      const white   = [255, 255, 255] as [number, number, number];

      const checkPage = (needed = 12) => {
        if (y + needed > 278) {
          doc.addPage();
          // Thin orange top stripe on continuation pages
          doc.setFillColor(...orange);
          doc.rect(0, 0, W, 3, "F");
          y = 10;
        }
      };

      // ── HEADER BAR ───────────────────────────────────────────────────────
      // Gradient-effect: two overlapping rects
      doc.setFillColor(...orange);
      doc.rect(0, 0, W, 38, "F");
      doc.setFillColor(...orangeD);
      doc.rect(W / 2, 0, W / 2, 38, "F");
      // Brand
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(...white);
      doc.text("ISLAND TACOS", ML, 14);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(255, 255, 255);
      doc.text("SALES SUMMARY REPORT", ML, 21);
      doc.setFontSize(8);
      doc.setTextColor(255, 230, 200);
      doc.text("Wickhams Cay 1, Road Town, Tortola \u00B7 BVI", ML, 32);
      // Period + generated (right side)
      const periodLabel = from === to ? from : `${from}  \u2192  ${to}`;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...white);
      doc.text(periodLabel, MR, 15, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(255, 230, 200);
      doc.text(`Generated ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`, MR, 22, { align: "right" });
      y = 44;

      // ── KPI CARDS ────────────────────────────────────────────────────────
      const kpis = [
        { label: "Gross Sales",     value: fmt(report.totalSales),    accent: green  },
        { label: "Net Sales",       value: fmt(report.netSales),      accent: blue   },
        { label: "Paid Orders",     value: String(report.paidOrders.toLocaleString()), accent: purple },
        { label: "Avg Order Value", value: fmt(report.avgOrderValue), accent: orange },
      ];
      const kpiW = CW / 4;
      kpis.forEach((k, i) => {
        const x = ML + i * kpiW;
        // Card shadow effect
        doc.setFillColor(230, 230, 230);
        doc.roundedRect(x + 1.5, y + 1.5, kpiW - 3, 24, 2, 2, "F");
        // Card background
        doc.setFillColor(...white);
        doc.roundedRect(x + 1, y, kpiW - 2, 24, 2, 2, "F");
        // Left accent bar
        doc.setFillColor(...k.accent);
        doc.roundedRect(x + 1, y, 3, 24, 1, 1, "F");
        // Value
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(...dark);
        doc.text(k.value, x + kpiW / 2 + 1, y + 10, { align: "center" });
        // Label
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...mid);
        doc.text(k.label.toUpperCase(), x + kpiW / 2 + 1, y + 18, { align: "center" });
      });
      y += 30;

      // ── TWO-COLUMN SECTION ───────────────────────────────────────────────
      // Payment breakdown (left col 0–88mm) | Financial Summary (right col 96–182mm)
      const colMid = ML + CW / 2 + 4;
      const colLeft = ML;
      const colRight = colMid + 2;
      const colW = CW / 2 - 6;
      const sectionStartY = y;

      // === LEFT: PAYMENT METHODS ===
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...mid);
      doc.text("PAYMENT BREAKDOWN", colLeft, y);
      y += 5;

      const methods = [
        { label: "Cash",          value: report.byMethod.cash,     color: green  },
        { label: "Card",          value: report.byMethod.card,     color: blue   },
        { label: "ATH M\u00F3vil",    value: report.byMethod.athmovil, color: purple },
        { label: "Split",         value: report.byMethod.split ?? 0, color: [217, 119, 6] as [number,number,number] },
        { label: "Complimentary", value: report.byMethod.complimentary ?? 0, color: [107,114,128] as [number,number,number] },
      ].filter(m => m.value > 0);

      let leftY = y;
      methods.forEach(m => {
        const pct = report.totalSales > 0 ? (m.value / report.totalSales) * 100 : 0;
        const barMaxW = colW - 18;
        const barW = barMaxW * (pct / 100);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(...dark);
        doc.text(m.label, colLeft, leftY);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...mid);
        doc.text(fmt(m.value), colLeft + colW, leftY, { align: "right" });
        leftY += 3.5;
        // Bar track
        doc.setFillColor(...faint);
        doc.roundedRect(colLeft, leftY, barMaxW, 3, 1, 1, "F");
        // Bar fill
        doc.setFillColor(...m.color);
        if (barW > 0) doc.roundedRect(colLeft, leftY, barW, 3, 1, 1, "F");
        // Pct label
        doc.setFontSize(7);
        doc.setTextColor(...mid);
        doc.text(`${pct.toFixed(1)}%`, colLeft + colW, leftY + 2.5, { align: "right" });
        leftY += 8;
      });

      // === RIGHT: FINANCIAL SUMMARY ===
      y = sectionStartY;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...mid);
      doc.text("FINANCIAL SUMMARY", colRight, y);
      y += 5;

      const sumRows: [string, string, boolean, [number,number,number]?][] = [
        ["Gross Sales",  fmt(report.totalSales),  false, undefined],
        ...(report.byMethod.cash > 0 ? [["  Cash", fmt(report.byMethod.cash), false, mid] as [string,string,boolean,[number,number,number]?]] : []),
        ...(report.byMethod.card > 0 ? [["  Card", fmt(report.byMethod.card), false, mid] as [string,string,boolean,[number,number,number]?]] : []),
        ...(report.byMethod.athmovil > 0 ? [["  ATH M\u00F3vil", fmt(report.byMethod.athmovil), false, mid] as [string,string,boolean,[number,number,number]?]] : []),
        ...((report.byMethod.split ?? 0) > 0 ? [["  Split", fmt(report.byMethod.split), false, mid] as [string,string,boolean,[number,number,number]?]] : []),
        ...((report.byMethod.complimentary ?? 0) > 0 ? [["  Comps", fmt(report.byMethod.complimentary), false, mid] as [string,string,boolean,[number,number,number]?]] : []),
        ...(report.refundTotal > 0 ? [["Total Refunds", `\u2212 ${fmt(report.refundTotal)}`, false, [220,38,38] as [number,number,number]] as [string,string,boolean,[number,number,number]?]] : []),
        ["Net Sales", fmt(report.netSales), true, undefined],
      ];

      const sumRX = colRight + colW;
      let rightY = y;
      sumRows.forEach(([label, val, isNet, col]) => {
        const textColor = col ?? dark;
        if (isNet) {
          rightY += 1;
          doc.setFillColor(...orange);
          doc.roundedRect(colRight - 1, rightY - 5, colW + 2, 9, 2, 2, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(...white);
          doc.text(label, colRight + 2, rightY);
          doc.text(val, sumRX, rightY, { align: "right" });
          rightY += 8;
        } else {
          const isIndent = label.startsWith("  ");
          doc.setFont("helvetica", isIndent ? "normal" : "normal");
          doc.setFontSize(isIndent ? 7.5 : 8.5);
          doc.setTextColor(...textColor);
          doc.text(label.trim(), colRight + (isIndent ? 5 : 0), rightY);
          doc.text(val, sumRX, rightY, { align: "right" });
          doc.setDrawColor(...faint);
          doc.setLineWidth(0.2);
          doc.line(colRight, rightY + 2, sumRX, rightY + 2);
          rightY += 7;
        }
      });

      y = Math.max(leftY, rightY) + 4;

      // ── DIVIDER ──────────────────────────────────────────────────────────
      doc.setDrawColor(...faint);
      doc.setLineWidth(0.4);
      doc.line(ML, y, MR, y);
      y += 6;

      // ── TOP ITEMS ────────────────────────────────────────────────────────
      if (report.topItems.length > 0) {
        checkPage(20);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(...mid);
        doc.text("TOP ITEMS (RECENT PERIOD)", ML, y);
        y += 5;

        // Column positions
        const itemCols = { num: ML, name: ML + 8, qty: MR - 42, rev: MR - 18, pct: MR };
        doc.setFontSize(7);
        doc.setTextColor(...mid);
        ["#", "Item", "Qty", "Revenue", "% Sales"].forEach((h, i) => {
          const xs = [itemCols.num, itemCols.name, itemCols.qty, itemCols.rev, itemCols.pct];
          const aligns = ["left","left","right","right","right"] as const;
          doc.text(h, xs[i], y, { align: aligns[i] });
        });
        y += 2;
        doc.setDrawColor(...faint); doc.setLineWidth(0.3); doc.line(ML, y, MR, y);
        y += 4;

        report.topItems.slice(0, 10).forEach((item, i) => {
          checkPage(7);
          const pct = report.totalSales > 0 ? ((item.revenue / report.totalSales) * 100).toFixed(1) : "0.0";
          const even = i % 2 === 0;
          if (even) { doc.setFillColor(...bg); doc.rect(ML - 1, y - 4, CW + 2, 6, "F"); }
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          doc.setTextColor(...mid);
          doc.text(String(i + 1), itemCols.num, y);
          doc.setTextColor(...dark);
          doc.text(item.name.slice(0, 40), itemCols.name, y);
          doc.setTextColor(...mid);
          doc.text(item.quantity.toLocaleString(), itemCols.qty, y, { align: "right" });
          doc.setTextColor(...dark);
          doc.text(fmt(item.revenue), itemCols.rev, y, { align: "right" });
          doc.setTextColor(...mid);
          doc.text(`${pct}%`, itemCols.pct, y, { align: "right" });
          y += 6;
        });
        y += 4;
      }

      // ── FOOTER ───────────────────────────────────────────────────────────
      const pages = doc.getNumberOfPages();
      for (let p = 1; p <= pages; p++) {
        doc.setPage(p);
        doc.setFillColor(...bg);
        doc.rect(0, 284, W, 13, "F");
        doc.setDrawColor(...faint); doc.setLineWidth(0.3); doc.line(0, 284, W, 284);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...mid);
        doc.text("Island Tacos \u00B7 Confidential \u00B7 For internal use only", ML, 291);
        doc.text(`Page ${p} of ${pages}`, MR, 291, { align: "right" });
      }

      const filename = `island-tacos-summary-${from}${from !== to ? `-to-${to}` : ""}.pdf`;
      doc.save(filename);
    } finally {
      setPdfGenerating(false);
    }
  };

  const maxSales = report?.daily.reduce((m, d) => Math.max(m, d.sales), 0) ?? 1;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .print-area { box-shadow: none !important; }
        }
      `}</style>

      {/* Header */}
      <div className="no-print bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => navigate(adminRoutes.dashboard)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors shrink-0">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h1 className="text-lg md:text-xl font-bold text-gray-900 truncate">Sales Reports</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setShowPrinterSettings(s => !s)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <Printer className="w-4 h-4" /> <span className="hidden sm:inline">Printer</span>
            </button>
            <button onClick={handlePrint} disabled={!report}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print Summary</span>
            </button>
            <button onClick={handleDownloadPDF} disabled={!report || pdfGenerating}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
              <Download className={`w-4 h-4 ${pdfGenerating ? "animate-bounce" : ""}`} />
              <span className="hidden sm:inline">{pdfGenerating ? "Generating…" : "Download PDF"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Printer Settings Panel */}
      {showPrinterSettings && (
        <div className="no-print bg-amber-50 border-b border-amber-200">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <h3 className="font-semibold text-amber-900 mb-3 flex items-center gap-2"><Printer className="w-4 h-4" /> Receipt Printer Settings</h3>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-xs font-medium text-amber-800 mb-1">Print Mode</label>
                <select value={printerConfig.type ?? "browser"}
                  onChange={e => setPrinterConfig(p => ({ ...p, type: e.target.value as PrinterConfig["type"] }))}
                  className="px-3 py-2 border border-amber-300 rounded-lg text-sm bg-white">
                  <option value="browser">Browser Print (OS print dialog)</option>
                  <option value="bridge">Local Bridge (WiFi receipt printer ✓)</option>
                  <option value="network">Network ESC/POS (local server only)</option>
                </select>
              </div>

              {printerConfig.type === "bridge" && (
                <div>
                  <label className="block text-xs font-medium text-amber-800 mb-1">Bridge URL</label>
                  <input type="text" placeholder="http://localhost:8765"
                    value={printerConfig.bridgeUrl ?? "http://localhost:8765"}
                    onChange={e => setPrinterConfig(p => ({ ...p, bridgeUrl: e.target.value }))}
                    className="px-3 py-2 border border-amber-300 rounded-lg text-sm w-52" />
                </div>
              )}

              {printerConfig.type === "network" && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-amber-800 mb-1">Printer IP</label>
                    <input type="text" placeholder="192.168.1.100" value={printerConfig.ip ?? ""}
                      onChange={e => setPrinterConfig(p => ({ ...p, ip: e.target.value }))}
                      className="px-3 py-2 border border-amber-300 rounded-lg text-sm w-40" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-amber-800 mb-1">Port</label>
                    <input type="number" value={printerConfig.port ?? 9100}
                      onChange={e => setPrinterConfig(p => ({ ...p, port: parseInt(e.target.value) }))}
                      className="px-3 py-2 border border-amber-300 rounded-lg text-sm w-24" />
                  </div>
                </>
              )}

              <button onClick={savePrinterConfig}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors">
                <Save className="w-4 h-4" /> {printerSaved ? "Saved!" : "Save"}
              </button>
            </div>

            {printerConfig.type === "bridge" && (
              <div className="mt-3 p-3 bg-white border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1.5">
                <p className="font-semibold">Setup (one-time, ~2 minutes):</p>
                <p>1. Install <strong>Node.js</strong> on any Windows/Mac computer on your restaurant WiFi (free at nodejs.org).</p>
                <p>2. <a href="/api/print/bridge.js" download className="underline font-medium text-amber-700">Download the bridge script</a> — it's already pre-configured for your printer at <strong>192.168.8.195</strong>.</p>
                <p>3. Open a terminal/command prompt, go to where you saved the file, and run: <code className="bg-amber-100 px-1 rounded">node island-tacos-bridge.js</code></p>
                <p>4. Leave that window open. The bridge URL to enter above is <strong>http://localhost:8765</strong> (if running on the same computer as the POS browser).</p>
              </div>
            )}

            {printerConfig.type === "browser" && (
              <p className="text-xs text-amber-700 mt-2">Opens the OS print dialog. Set your receipt printer as the default printer to skip the dialog.</p>
            )}
            {printerConfig.type === "network" && (
              <p className="text-xs text-amber-700 mt-2">Only works when the API server is running on the same local network as the printer (not for the cloud-hosted app).</p>
            )}
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-6 print-area">
        {/* Date range controls */}
        <div className="no-print mb-6">
          <div className="flex flex-wrap gap-2 mb-3">
            {PRESETS.map(p => (
              <button key={p.label} onClick={() => applyPreset(p.label, p.get)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activePreset === p.label ? "bg-orange-500 text-white" : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
              <input type="date" value={from} onChange={e => { setFrom(e.target.value); setActivePreset("Custom"); }}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
              <input type="date" value={to} onChange={e => { setTo(e.target.value); setActivePreset("Custom"); }}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <button onClick={() => loadReport(from, to)} disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Loading…" : "Apply"}
            </button>
          </div>
        </div>

        {/* Print header */}
        <div className="hidden print:block mb-6 text-center">
          <div className="text-2xl font-bold">ISLAND TACOS</div>
          <div className="text-gray-600">Wickhams Cay 1, Road Town, BVI</div>
          <div className="text-lg font-semibold mt-2">Sales Report</div>
          <div className="text-gray-600">{from} — {to}</div>
          <div className="text-xs text-gray-400 mt-1">Generated {new Date().toLocaleString()}</div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 mb-6">{error}</div>}

        {report && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { icon: DollarSign, label: "Gross Sales", value: fmt(report.totalSales), sub: `Net: ${fmt(report.netSales)}`, color: "text-green-600" },
                { icon: ShoppingBag, label: "Orders", value: String(report.paidOrders), sub: `${report.cancelledOrders} cancelled`, color: "text-blue-600" },
                { icon: TrendingUp, label: "Avg Order", value: fmt(report.avgOrderValue), sub: "per paid order", color: "text-purple-600" },
                { icon: Percent, label: "Refunds", value: fmt(report.refundTotal), sub: `${report.totalSales > 0 ? ((report.refundTotal / report.totalSales) * 100).toFixed(1) : 0}% of sales`, color: "text-red-500" },
              ].map(c => (
                <div key={c.label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                  <c.icon className={`w-5 h-5 mb-2 ${c.color}`} />
                  <div className="text-2xl font-bold text-gray-900">{c.value}</div>
                  <div className="text-xs font-medium text-gray-500">{c.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{c.sub}</div>
                </div>
              ))}
            </div>

            {/* Payment method breakdown */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                <h2 className="font-bold text-gray-900 mb-4">Sales by Payment Method</h2>
                <div className="space-y-3">
                  {[
                    { label: "Cash", value: report.byMethod.cash, color: "bg-green-500" },
                    { label: "Card", value: report.byMethod.card, color: "bg-blue-500" },
                    { label: "ATH Móvil", value: report.byMethod.athmovil, color: "bg-purple-500" },
                    { label: "Split", value: report.byMethod.split ?? 0, color: "bg-orange-400" },
                    { label: "Complimentary", value: report.byMethod.complimentary ?? 0, color: "bg-gray-400" },
                  ].filter(m => m.value > 0).map(m => (
                    <div key={m.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700">{m.label}</span>
                        <span className="font-bold text-gray-900">{fmt(m.value)}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className={`${m.color} h-2 rounded-full transition-all`}
                          style={{ width: report.totalSales > 0 ? `${(m.value / report.totalSales) * 100}%` : "0%" }} />
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {report.totalSales > 0 ? `${((m.value / report.totalSales) * 100).toFixed(1)}%` : "0%"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Daily chart */}
              {report.daily.length > 1 && (
                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                  <h2 className="font-bold text-gray-900 mb-4">Daily Sales</h2>
                  <div className="flex items-end gap-1 h-32">
                    {report.daily.map(d => (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
                        <div className="text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{fmt(d.sales)}</div>
                        <div className="w-full bg-orange-400 rounded-t transition-all hover:bg-orange-500 cursor-default"
                          style={{ height: `${maxSales > 0 ? (d.sales / maxSales) * 112 : 0}px`, minHeight: d.sales > 0 ? "4px" : "0" }}
                          title={`${d.date}: ${fmt(d.sales)}`} />
                        <div className="text-xs text-gray-400 truncate w-full text-center"
                          style={{ fontSize: "9px" }}>
                          {d.date.slice(5)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Top Items */}
            {report.topItems.length > 0 && (
              <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm mb-6">
                <h2 className="font-bold text-gray-900 mb-4">Top Items</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 font-medium text-gray-500">#</th>
                        <th className="text-left py-2 font-medium text-gray-500">Item</th>
                        <th className="text-right py-2 font-medium text-gray-500">Revenue</th>
                        <th className="text-right py-2 font-medium text-gray-500">% of Sales</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.topItems.map((item, i) => (
                        <tr key={item.name} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 text-gray-400">{i + 1}</td>
                          <td className="py-2 font-medium text-gray-900">{item.name}</td>
                          <td className="py-2 text-right font-semibold text-gray-900">{fmt(item.revenue)}</td>
                          <td className="py-2 text-right text-gray-400">
                            {report.totalSales > 0 ? `${((item.revenue / report.totalSales) * 100).toFixed(1)}%` : "0%"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Summary totals for print */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
              <h2 className="font-bold text-gray-900 mb-3">Summary</h2>
              <div className="space-y-2 text-sm max-w-xs">
                {([
                  ["Total Orders", report.paidOrders],
                  ["Gross Sales", fmt(report.totalSales)],
                  ["Cash Sales", fmt(report.byMethod.cash)],
                  ["Card Sales", fmt(report.byMethod.card)],
                  ["ATH Móvil Sales", fmt(report.byMethod.athmovil)],
                  ...(report.byMethod.split > 0 ? [["Split Sales", fmt(report.byMethod.split)]] : []),
                  ...(report.byMethod.complimentary > 0 ? [["Complimentary", fmt(report.byMethod.complimentary)]] : []),
                  ["Total Refunds", `- ${fmt(report.refundTotal)}`],
                  ["Net Sales", fmt(report.netSales)],
                ] as [string, string | number][]).map(([label, val]) => (
                  <div key={label as string} className={`flex justify-between py-1 ${label === "Net Sales" ? "font-bold border-t border-gray-200 text-base" : "border-b border-gray-50 text-gray-700"}`}>
                    <span>{label}</span>
                    <span>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {!report && !loading && !error && (
          <div className="text-center py-16 text-gray-400">Select a date range and click Apply</div>
        )}
      </div>
    </div>
  );
}

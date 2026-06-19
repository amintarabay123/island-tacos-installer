import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { authHeaders, clearAuthToken } from "@/lib/auth";
import { adminRoutes } from "@/lib/admin-path";
import { ArrowLeft, Download, RefreshCw, Calendar, TrendingUp, DollarSign, ShoppingBag, Percent, Printer, Save } from "lucide-react";
import jsPDF from "jspdf";
import { useStoreSettings } from "@/lib/use-store-settings";

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
  localApiUrl: string;
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
  const { storeName, address } = useStoreSettings();
  const [, navigate] = useLocation();
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [activePreset, setActivePreset] = useState("Today");
  const [report, setReport] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printerConfig, setPrinterConfig] = useState<PrinterConfig>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("printerConfig") ?? "{}");
      return { type: "network", ip: "", port: 9100, bridgeUrl: "http://localhost:8765", localApiUrl: "", ...saved };
    } catch { return { type: "network", ip: "", port: 9100, bridgeUrl: "http://localhost:8765", localApiUrl: "" }; }
  });
  const [kdsPrinterConfig, setKdsPrinterConfig] = useState<PrinterConfig>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("kdsConfig") ?? "{}");
      return { type: "browser", ip: "", port: 9100, bridgeUrl: "http://localhost:8765", localApiUrl: "", ...saved };
    } catch { return { type: "browser", ip: "", port: 9100, bridgeUrl: "http://localhost:8765", localApiUrl: "" }; }
  });
  const [kdsConfigSaved, setKdsConfigSaved] = useState(false);
  const [showPrinterSettings, setShowPrinterSettings] = useState(false);
  const [printerSaved, setPrinterSaved] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include", cache: "no-store", headers: authHeaders() })
      .then(r => r.json()).then(d => { if (!d.authed || d.role !== "admin") navigate(adminRoutes.login); })
      .catch(() => navigate(adminRoutes.login));
  }, [navigate]);

  // Load printer configs from server so settings are shared across all devices
  useEffect(() => {
    fetch("/api/settings", { credentials: "include", headers: authHeaders() })
      .then(r => r.json())
      .then((data: Record<string, string>) => {
        if (data.printer_config) {
          try {
            const cfg = JSON.parse(data.printer_config) as Partial<PrinterConfig>;
            setPrinterConfig(p => ({ ...p, ...cfg }));
          } catch { /* ignore malformed */ }
        }
        if (data.kds_printer_config) {
          try {
            const cfg = JSON.parse(data.kds_printer_config) as Partial<PrinterConfig>;
            setKdsPrinterConfig(p => ({ ...p, ...cfg }));
          } catch { /* ignore malformed */ }
        }
      })
      .catch(() => {});
  }, []);

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

  useEffect(() => {
    localStorage.setItem("printerConfig", JSON.stringify(printerConfig));
  }, [printerConfig]);

  useEffect(() => {
    localStorage.setItem("kdsConfig", JSON.stringify(kdsPrinterConfig));
  }, [kdsPrinterConfig]);

  const savePrinterConfig = () => {
    localStorage.setItem("printerConfig", JSON.stringify(printerConfig));
    fetch("/api/settings", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ printer_config: JSON.stringify(printerConfig) }),
    }).catch(() => {});
    setPrinterSaved(true);
    setTimeout(() => setPrinterSaved(false), 2000);
  };

  const saveKdsPrinterConfig = () => {
    localStorage.setItem("kdsConfig", JSON.stringify(kdsPrinterConfig));
    fetch("/api/settings", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ kds_printer_config: JSON.stringify(kdsPrinterConfig) }),
    }).catch(() => {});
    setKdsConfigSaved(true);
    setTimeout(() => setKdsConfigSaved(false), 2000);
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
      <div class="brand">${storeName.toUpperCase()}</div>
      <div class="subtitle">Sales Summary Report</div>
      <div class="address">${address}</div>
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
    <div class="footer-brand">${storeName} · Confidential</div>
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
      doc.text(address || "Road Town, BVI", ML, 32);
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
        doc.text(`${storeName} \u00B7 Confidential \u00B7 For internal use only`, ML, 291);
        doc.text(`Page ${p} of ${pages}`, MR, 291, { align: "right" });
      }

      const filename = `${storeName.toLowerCase().replace(/\s+/g, '-')}-summary-${from}${from !== to ? `-to-${to}` : ""}.pdf`;
      doc.save(filename);
    } finally {
      setPdfGenerating(false);
    }
  };

  const maxSales = report?.daily.reduce((m, d) => Math.max(m, d.sales), 0) ?? 1;

  const S = {
    card: { background:"#1e1f38", borderRadius:14, border:"1px solid rgba(255,255,255,0.06)" } as React.CSSProperties,
    label: { display:"block", fontSize:11, fontWeight:600, color:"#7077a1", marginBottom:4, textTransform:"uppercase", letterSpacing:"0.06em" } as React.CSSProperties,
    input: { padding:"8px 12px", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, fontSize:14, background:"#16172b", color:"#e8eaf6", outline:"none" } as React.CSSProperties,
    h2: { fontWeight:700, color:"#e8eaf6", fontSize:15, margin:0, marginBottom:16 } as React.CSSProperties,
  };

  return (
    <div style={{ minHeight:"100dvh", background:"#16172b", color:"#e8eaf6" }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .print-area { box-shadow: none !important; }
        }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.6); cursor: pointer; }
        .rpt-bar-item:hover .rpt-bar-tip { opacity: 1 !important; }
      `}</style>

      {/* ── Header ── */}
      <div className="no-print" style={{ background:"#0e1020", borderBottom:"1px solid rgba(255,255,255,0.06)", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ maxWidth:1152, margin:"0 auto", padding:"10px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}>
            <button onClick={() => navigate(adminRoutes.dashboard)}
              style={{ padding:8, borderRadius:8, background:"transparent", border:"none", cursor:"pointer", color:"#7077a1", display:"flex" }}>
              <ArrowLeft style={{ width:20, height:20 }} />
            </button>
            <h1 style={{ fontSize:18, fontWeight:700, color:"#e8eaf6", margin:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>Sales Reports</h1>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
            <button onClick={() => setShowPrinterSettings(s => !s)}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 12px", fontSize:13, fontWeight:500, color:"#7077a1", background:"transparent", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, cursor:"pointer" }}>
              <Printer style={{ width:15, height:15 }} />
              <span className="hidden sm:inline">Printer</span>
            </button>
            <button onClick={handlePrint} disabled={!report}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", fontSize:13, fontWeight:500, background:"rgba(255,255,255,0.07)", color:"#e8eaf6", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, cursor:!report?"not-allowed":"pointer", opacity:!report?0.4:1 }}>
              <Printer style={{ width:15, height:15 }} />
              <span className="hidden sm:inline">Print</span>
            </button>
            <button onClick={handleDownloadPDF} disabled={!report || pdfGenerating}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", fontSize:13, fontWeight:600, background:"#ff6b00", color:"#fff", border:"none", borderRadius:8, cursor:(!report||pdfGenerating)?"not-allowed":"pointer", opacity:(!report||pdfGenerating)?0.5:1 }}>
              <Download style={{ width:15, height:15 }} className={pdfGenerating ? "animate-bounce" : ""} />
              <span className="hidden sm:inline">{pdfGenerating ? "Generating…" : "Download PDF"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Printer Settings Panel ── */}
      {showPrinterSettings && (
        <div className="no-print" style={{ background:"#1a1b30", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ maxWidth:1152, margin:"0 auto", padding:"16px" }}>
            <h3 style={{ fontWeight:600, color:"#e8eaf6", display:"flex", alignItems:"center", gap:8, fontSize:14, margin:"0 0 12px" }}>
              <Printer style={{ width:15, height:15, color:"#7077a1" }} /> Receipt Printer Settings
            </h3>
            <div style={{ display:"flex", flexWrap:"wrap", alignItems:"flex-end", gap:16, marginBottom:8 }}>
              <div>
                <label style={S.label}>Print Mode</label>
                <select value={printerConfig.type ?? "browser"}
                  onChange={e => setPrinterConfig(p => ({ ...p, type: e.target.value as PrinterConfig["type"] }))}
                  style={{ ...S.input, paddingRight:28 }}>
                  <option value="network">WiFi Direct — Munbyn (recommended ✓)</option>
                  <option value="bridge">Local Bridge (separate bridge script)</option>
                  <option value="browser">Browser Print (OS print dialog)</option>
                </select>
              </div>
              {printerConfig.type === "bridge" && (
                <div>
                  <label style={S.label}>Bridge URL</label>
                  <input type="text" placeholder="http://localhost:8765"
                    value={printerConfig.bridgeUrl ?? "http://localhost:8765"}
                    onChange={e => setPrinterConfig(p => ({ ...p, bridgeUrl: e.target.value }))}
                    style={{ ...S.input, width:208 }} />
                </div>
              )}
              {printerConfig.type === "network" && (
                <>
                  <div>
                    <label style={S.label}>Printer IP</label>
                    <input type="text" placeholder="192.168.1.100" value={printerConfig.ip ?? ""}
                      onChange={e => setPrinterConfig(p => ({ ...p, ip: e.target.value }))}
                      style={{ ...S.input, width:160 }} />
                  </div>
                  <div>
                    <label style={S.label}>Port</label>
                    <input type="number" value={printerConfig.port ?? 9100}
                      onChange={e => setPrinterConfig(p => ({ ...p, port: parseInt(e.target.value) }))}
                      style={{ ...S.input, width:96 }} />
                  </div>
                  <div>
                    <label style={S.label}>
                      Local Server URL <span style={{ fontWeight:400, textTransform:"none" }}>(for KDS on cloud URL)</span>
                    </label>
                    <input type="text" placeholder="http://192.168.8.x:8080"
                      value={printerConfig.localApiUrl ?? ""}
                      onChange={e => setPrinterConfig(p => ({ ...p, localApiUrl: e.target.value }))}
                      style={{ ...S.input, width:208 }} />
                  </div>
                </>
              )}
              <button onClick={savePrinterConfig}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 16px", background:"#7c6af7", color:"#fff", border:"none", borderRadius:8, fontSize:13, fontWeight:500, cursor:"pointer" }}>
                <Save style={{ width:15, height:15 }} /> {printerSaved ? "Saved!" : "Save"}
              </button>
            </div>
            {printerConfig.type === "bridge" && (
              <div style={{ marginTop:10, padding:12, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:8, fontSize:12, color:"#7077a1", lineHeight:1.7 }}>
                <p style={{ fontWeight:600, color:"#e8eaf6", marginBottom:6 }}>Setup (one-time, ~2 minutes):</p>
                <p>1. Install <strong style={{ color:"#e8eaf6" }}>Node.js</strong> on any Windows/Mac computer on your restaurant WiFi.</p>
                <p>2. <a href="/api/print/bridge.js" download style={{ color:"#7c6af7", fontWeight:600 }}>Download the bridge script</a> — open in a text editor and set PRINTER_IP to your printer's local IP.</p>
                <p>3. Run: <code style={{ background:"rgba(255,255,255,0.08)", padding:"1px 6px", borderRadius:4, color:"#e8eaf6" }}>node island-tacos-bridge.js</code></p>
                <p>4. Leave that window open. Bridge URL = <strong style={{ color:"#e8eaf6" }}>http://localhost:8765</strong></p>
              </div>
            )}
            {printerConfig.type === "browser" && <p style={{ fontSize:12, color:"#7077a1", marginTop:6 }}>Opens the OS print dialog. Set your receipt printer as default to skip the dialog.</p>}
            {printerConfig.type === "network" && <p style={{ fontSize:12, color:"#7077a1", marginTop:6 }}>Sends print jobs directly to the Munbyn over WiFi. Make sure the printer is on and connected.</p>}
          </div>
        </div>
      )}

      {/* ── KDS Printer Settings sub-panel ── */}
      {showPrinterSettings && (
        <div className="no-print" style={{ background:"#16172b", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ maxWidth:1152, margin:"0 auto", padding:"12px 16px" }}>
            <h3 style={{ fontWeight:600, color:"#7077a1", display:"flex", alignItems:"center", gap:8, fontSize:13, margin:"0 0 10px" }}>
              <Printer style={{ width:14, height:14 }} /> KDS Printer Settings
            </h3>
            <div style={{ display:"flex", flexWrap:"wrap", alignItems:"flex-end", gap:16 }}>
              <div>
                <label style={S.label}>KDS Print Mode</label>
                <select value={kdsPrinterConfig.type ?? "browser"}
                  onChange={e => setKdsPrinterConfig(p => ({ ...p, type: e.target.value as PrinterConfig["type"] }))}
                  style={{ ...S.input, paddingRight:28 }}>
                  <option value="network">WiFi Direct — Munbyn</option>
                  <option value="bridge">Local Bridge</option>
                  <option value="browser">Browser Print</option>
                </select>
              </div>
              {kdsPrinterConfig.type === "network" && (
                <>
                  <div>
                    <label style={S.label}>KDS Printer IP</label>
                    <input type="text" placeholder="192.168.1.100" value={kdsPrinterConfig.ip ?? ""}
                      onChange={e => setKdsPrinterConfig(p => ({ ...p, ip: e.target.value }))}
                      style={{ ...S.input, width:160 }} />
                  </div>
                  <div>
                    <label style={S.label}>Port</label>
                    <input type="number" value={kdsPrinterConfig.port ?? 9100}
                      onChange={e => setKdsPrinterConfig(p => ({ ...p, port: parseInt(e.target.value) }))}
                      style={{ ...S.input, width:96 }} />
                  </div>
                </>
              )}
              {kdsPrinterConfig.type === "bridge" && (
                <div>
                  <label style={S.label}>KDS Bridge URL</label>
                  <input type="text" placeholder="http://localhost:8765" value={kdsPrinterConfig.bridgeUrl ?? ""}
                    onChange={e => setKdsPrinterConfig(p => ({ ...p, bridgeUrl: e.target.value }))}
                    style={{ ...S.input, width:208 }} />
                </div>
              )}
              <button onClick={saveKdsPrinterConfig}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 16px", background:"#7c6af7", color:"#fff", border:"none", borderRadius:8, fontSize:13, fontWeight:500, cursor:"pointer" }}>
                <Save style={{ width:15, height:15 }} /> {kdsConfigSaved ? "Saved!" : "Save KDS"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth:1152, margin:"0 auto", padding:"24px 16px" }} className="print-area">

        {/* Stat cards */}
        <div className="no-print" style={{ display:"flex", gap:14, marginBottom:24, overflowX:"auto" }}>
          {[
            { art:"💰", grad:"linear-gradient(145deg,#10b981,#059669,#064e3b)", glow:"rgba(16,185,129,0.5)",   label:"Gross Sales",  value: report ? `$${report.totalSales.toFixed(2)}`    : "—", sub:"total revenue" },
            { art:"📈", grad:"linear-gradient(145deg,#7c6af7,#5b4cf5,#3730a3)", glow:"rgba(124,106,247,0.55)", label:"Net Sales",    value: report ? `$${report.netSales.toFixed(2)}`     : "—", sub:"after refunds" },
            { art:"🧾", grad:"linear-gradient(145deg,#ff6b00,#ff3d00,#c0392b)", glow:"rgba(255,107,0,0.55)",   label:"Paid Orders",  value: report ? String(report.paidOrders)             : "—", sub:"completed" },
            { art:"⚡", grad:"linear-gradient(145deg,#0ea5e9,#0284c7,#1e3a8a)", glow:"rgba(14,165,233,0.5)",   label:"Avg Order",    value: report ? `$${report.avgOrderValue.toFixed(2)}` : "—", sub:"per paid order" },
          ].map((fc) => (
            <div key={fc.label} style={{ width:168, flexShrink:0 }}>
              <div style={{ background:fc.grad, borderRadius:20, padding:"16px 16px 14px", position:"relative", overflow:"hidden", boxShadow:`0 6px 24px ${fc.glow}`, height:108, display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
                <div style={{ position:"absolute", inset:0, background:"linear-gradient(155deg,rgba(255,255,255,0.14) 0%,transparent 50%)", pointerEvents:"none" }} />
                <div style={{ position:"absolute", top:-6, right:0, fontSize:62, opacity:0.22, lineHeight:1, transform:"rotate(14deg)", pointerEvents:"none", userSelect:"none" }}>{fc.art}</div>
                <div style={{ position:"relative", zIndex:1 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.6)", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:3 }}>{fc.label}</div>
                  <div style={{ fontSize:26, fontWeight:900, color:"#fff", letterSpacing:"-0.05em", lineHeight:1, marginBottom:3 }}>{fc.value}</div>
                  <div style={{ fontSize:11, color:"rgba(255,255,255,0.65)", fontWeight:500 }}>{fc.sub}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Date range controls ── */}
        <div className="no-print" style={{ marginBottom:24 }}>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:12 }}>
            {PRESETS.map(p => (
              <button key={p.label} onClick={() => applyPreset(p.label, p.get)}
                style={{ padding:"6px 14px", borderRadius:8, fontSize:13, fontWeight:500, cursor:"pointer", border:"none", transition:"background 0.15s",
                  background: activePreset === p.label ? "#ff6b00" : "rgba(255,255,255,0.06)",
                  color: activePreset === p.label ? "#fff" : "#7077a1" }}>
                {p.label}
              </button>
            ))}
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", alignItems:"flex-end", gap:12 }}>
            <div>
              <label style={S.label}>From</label>
              <input type="date" value={from} onChange={e => { setFrom(e.target.value); setActivePreset("Custom"); }} style={S.input} />
            </div>
            <div>
              <label style={S.label}>To</label>
              <input type="date" value={to} onChange={e => { setTo(e.target.value); setActivePreset("Custom"); }} style={S.input} />
            </div>
            <button onClick={() => loadReport(from, to)} disabled={loading}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 18px", background:"#7c6af7", color:"#fff", border:"none", borderRadius:8, fontSize:13, fontWeight:600, cursor:loading?"not-allowed":"pointer", opacity:loading?0.6:1 }}>
              <RefreshCw style={{ width:15, height:15 }} className={loading ? "animate-spin" : ""} />
              {loading ? "Loading…" : "Apply"}
            </button>
          </div>
        </div>

        {/* Print header */}
        <div className="hidden print:block" style={{ marginBottom:24, textAlign:"center" }}>
          <div style={{ fontSize:24, fontWeight:700 }}>{storeName.toUpperCase()}</div>
          <div style={{ color:"#6b7280" }}>{address}</div>
          <div style={{ fontSize:18, fontWeight:600, marginTop:8 }}>Sales Report</div>
          <div style={{ color:"#6b7280" }}>{from} — {to}</div>
          <div style={{ fontSize:11, color:"#9ca3af", marginTop:4 }}>Generated {new Date().toLocaleString()}</div>
        </div>

        {error && (
          <div style={{ background:"rgba(220,38,38,0.12)", border:"1px solid rgba(220,38,38,0.3)", borderRadius:12, padding:16, color:"#f87171", marginBottom:24 }}>{error}</div>
        )}

        {report && (
          <>
            {/* ── KPI cards ── */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:16, marginBottom:24 }}>
              {[
                { icon: DollarSign, label: "Gross Sales",   value: fmt(report.totalSales),    sub: `Net: ${fmt(report.netSales)}`,    accent:"#30d158" },
                { icon: ShoppingBag,label: "Orders",        value: String(report.paidOrders), sub: `${report.cancelledOrders} cancelled`, accent:"#7c6af7" },
                { icon: TrendingUp,  label: "Avg Order",    value: fmt(report.avgOrderValue), sub: "per paid order",                  accent:"#ff6b00" },
                { icon: Percent,     label: "Refunds",      value: fmt(report.refundTotal),   sub: `${report.totalSales > 0 ? ((report.refundTotal/report.totalSales)*100).toFixed(1):0}% of sales`, accent:"#ff453a" },
              ].map(c => (
                <div key={c.label} style={{ ...S.card, padding:20, borderLeft:`3px solid ${c.accent}` }}>
                  <c.icon style={{ width:18, height:18, marginBottom:10, color:c.accent }} />
                  <div style={{ fontSize:26, fontWeight:800, color:"#e8eaf6", letterSpacing:"-0.5px" }}>{c.value}</div>
                  <div style={{ fontSize:11, fontWeight:600, color:"#7077a1", textTransform:"uppercase", letterSpacing:"0.06em", marginTop:2 }}>{c.label}</div>
                  <div style={{ fontSize:12, color:"#7077a1", marginTop:4 }}>{c.sub}</div>
                </div>
              ))}
            </div>

            {/* ── Payment methods + daily chart ── */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24, marginBottom:24 }}>
              <div style={{ ...S.card, padding:20 }}>
                <h2 style={S.h2}>Sales by Payment Method</h2>
                <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                  {[
                    { label:"Cash",          value:report.byMethod.cash,              color:"#30d158" },
                    { label:"Card",          value:report.byMethod.card,              color:"#007aff" },
                    { label:"ATH Móvil",     value:report.byMethod.athmovil,          color:"#7c6af7" },
                    { label:"Split",         value:report.byMethod.split ?? 0,        color:"#ff6b00" },
                    { label:"Complimentary", value:report.byMethod.complimentary ?? 0,color:"#7077a1" },
                  ].filter(m => m.value > 0).map(m => (
                    <div key={m.label}>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:5 }}>
                        <span style={{ fontWeight:500, color:"#b0b8d8" }}>{m.label}</span>
                        <span style={{ fontWeight:700, color:"#e8eaf6" }}>{fmt(m.value)}</span>
                      </div>
                      <div style={{ width:"100%", background:"rgba(255,255,255,0.06)", borderRadius:4, height:6, overflow:"hidden" }}>
                        <div style={{ background:m.color, height:6, borderRadius:4, transition:"width 0.6s ease",
                          width: report.totalSales > 0 ? `${(m.value/report.totalSales)*100}%` : "0%" }} />
                      </div>
                      <div style={{ fontSize:11, color:"#7077a1", marginTop:2 }}>
                        {report.totalSales > 0 ? `${((m.value/report.totalSales)*100).toFixed(1)}%` : "0%"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {report.daily.length > 1 ? (
                <div style={{ ...S.card, padding:20 }}>
                  <h2 style={S.h2}>Daily Sales</h2>
                  <div style={{ overflowX:"auto" }}>
                    <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:128, minWidth:`${Math.max(report.daily.length*18,200)}px` }}>
                      {report.daily.map(d => {
                        const showLabel = report.daily.length <= 31;
                        return (
                          <div key={d.date} className="rpt-bar-item" style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", alignItems:"center", gap:2, position:"relative" }}>
                            <div className="rpt-bar-tip" style={{ fontSize:9, color:"#7077a1", opacity:0, transition:"opacity 0.15s", whiteSpace:"nowrap", position:"absolute", top:-14 }}>{fmt(d.sales)}</div>
                            <div style={{ width:"100%", background:"#ff6b00", borderRadius:"2px 2px 0 0", cursor:"default", opacity:0.85,
                              height:`${maxSales>0?(d.sales/maxSales)*110:0}px`,
                              minHeight: d.sales>0?3:0 }}
                              title={`${d.date}: ${fmt(d.sales)}`} />
                            {showLabel && (
                              <div style={{ fontSize:9, color:"#7077a1", lineHeight:1.2, textAlign:"center", overflow:"hidden", width:"100%" }}>
                                {d.date.slice(5)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ ...S.card, padding:20, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <p style={{ color:"#7077a1", fontSize:13 }}>Select a multi-day range to see daily breakdown</p>
                </div>
              )}
            </div>

            {/* ── Top Items ── */}
            {report.topItems.length > 0 && (
              <div style={{ ...S.card, padding:20, marginBottom:24 }}>
                <h2 style={S.h2}>Top Items</h2>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                    <thead>
                      <tr style={{ borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                        {["#","Item","Qty","Revenue","% of Sales"].map((h,i) => (
                          <th key={h} style={{ padding:"6px 8px", fontWeight:600, color:"#7077a1", fontSize:11, textTransform:"uppercase", letterSpacing:"0.05em", textAlign: i<2?"left":"right" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.topItems.map((item, i) => (
                        <tr key={item.name} style={{ borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ padding:"8px 8px", color:"#7077a1" }}>{i+1}</td>
                          <td style={{ padding:"8px 8px", fontWeight:500, color:"#e8eaf6" }}>{item.name}</td>
                          <td style={{ padding:"8px 8px", color:"#7077a1", textAlign:"right" }}>{item.quantity.toLocaleString()}</td>
                          <td style={{ padding:"8px 8px", fontWeight:600, color:"#e8eaf6", textAlign:"right" }}>{fmt(item.revenue)}</td>
                          <td style={{ padding:"8px 8px", color:"#7077a1", textAlign:"right" }}>
                            {report.totalSales>0 ? `${((item.revenue/report.totalSales)*100).toFixed(1)}%` : "0%"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Summary totals ── */}
            <div style={{ ...S.card, padding:20 }}>
              <h2 style={S.h2}>Summary</h2>
              <div style={{ maxWidth:340 }}>
                {([
                  ["Total Orders",     report.paidOrders],
                  ["Gross Sales",      fmt(report.totalSales)],
                  ["Cash Sales",       fmt(report.byMethod.cash)],
                  ["Card Sales",       fmt(report.byMethod.card)],
                  ["ATH Móvil Sales",  fmt(report.byMethod.athmovil)],
                  ...(report.byMethod.split>0       ? [["Split Sales",   fmt(report.byMethod.split)]]        : []),
                  ...(report.byMethod.complimentary>0 ? [["Complimentary",fmt(report.byMethod.complimentary)]] : []),
                  ["Total Refunds",    `- ${fmt(report.refundTotal)}`],
                  ["Net Sales",        fmt(report.netSales)],
                ] as [string, string|number][]).map(([label, val]) => {
                  const isNet = label === "Net Sales";
                  return (
                    <div key={label as string} style={{
                      display:"flex", justifyContent:"space-between", padding:"7px 0",
                      borderTop: isNet ? "1px solid rgba(255,255,255,0.1)" : "none",
                      borderBottom: isNet ? "none" : "1px solid rgba(255,255,255,0.04)",
                      marginTop: isNet ? 6 : 0,
                      fontWeight: isNet ? 700 : 400,
                      fontSize: isNet ? 15 : 13,
                    }}>
                      <span style={{ color: isNet ? "#30d158" : "#b0b8d8" }}>{label}</span>
                      <span style={{ color: isNet ? "#30d158" : "#e8eaf6" }}>{val}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {!report && !loading && !error && (
          <div style={{ textAlign:"center", paddingTop:64, paddingBottom:64, color:"#7077a1", fontSize:14 }}>
            Select a date range and click Apply
          </div>
        )}
      </div>
    </div>
  );
}

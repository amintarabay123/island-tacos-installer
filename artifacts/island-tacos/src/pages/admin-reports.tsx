import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { authHeaders, clearAuthToken } from "@/lib/auth";
import { adminRoutes } from "@/lib/admin-path";
import { ArrowLeft, Download, RefreshCw, Calendar, TrendingUp, DollarSign, ShoppingBag, Percent, Printer, Save } from "lucide-react";

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

  const handlePrint = () => {
    window.print();
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
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors">
              <Download className="w-4 h-4" /> <span className="hidden sm:inline">Export PDF</span>
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

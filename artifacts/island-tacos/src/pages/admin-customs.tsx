import { useState, useCallback } from "react";
import { adminRoutes } from "@/lib/admin-path";
import { Printer, Plus, Trash2, ChevronLeft } from "lucide-react";
import { Link } from "wouter";

// ── Pre-filled Island Tacos declarant data ───────────────────────────────────
const DECLARANT = {
  name: "Island Tacos",
  id: "100494",
  importerId: "113917",
  importerName: "Island Tacos",
  importerAddress: "PO Box 643",
  importerTown: "Road Town, Tortola",
  carrierIdNo: "ADP/273",
  portOfArrival: "PP",
};

// ── Tariff lookup ────────────────────────────────────────────────────────────
type TariffInfo = { desc: string; rate: number | null; rateStr?: string; unit: string; cpc: string; taxType: string; base: string };
const TARIFF_DB: Record<string, TariffInfo> = {
  "0207.10":  { desc: "Poultry not cut in pieces, fresh or chilled", rate: 0, unit: "kg", cpc: "C400", taxType: "01", base: "42" },
  "0207.21":  { desc: "Fowls Gallus domesticus, frozen whole", rate: 0, unit: "kg", cpc: "C400", taxType: "01", base: "42" },
  "0207.22":  { desc: "Turkeys, frozen whole", rate: 0, unit: "kg", cpc: "C400", taxType: "01", base: "42" },
  "0207.411": { desc: "Chicken backs and necks, frozen", rate: 0, unit: "kg", cpc: "C400", taxType: "01", base: "42" },
  "0207.412": { desc: "Chicken wings, frozen", rate: 0, unit: "kg", cpc: "C400", taxType: "01", base: "42" },
  "0207.419": { desc: "Other chicken cuts, frozen", rate: 0, unit: "kg", cpc: "C400", taxType: "01", base: "42" },
  "0207.421": { desc: "Turkey backs, necks and wings, frozen", rate: 0, unit: "kg", cpc: "C400", taxType: "01", base: "42" },
  "0207.429": { desc: "Other turkey cuts, frozen", rate: 0, unit: "kg", cpc: "C400", taxType: "01", base: "42" },
  "0207.43":  { desc: "Duck/geese/guinea fowl cuts, frozen", rate: 0, unit: "kg", cpc: "C400", taxType: "01", base: "42" },
  "0207.50":  { desc: "Poultry livers, frozen", rate: 0.05, unit: "kg", cpc: "C400", taxType: "01", base: "42" },
  "0201.10":  { desc: "Beef carcases and half-carcases, fresh/chilled", rate: 0.05, unit: "kg", cpc: "C400", taxType: "01", base: "42" },
  "0202.10":  { desc: "Beef carcases and half-carcases, frozen", rate: 0.05, unit: "kg", cpc: "C400", taxType: "01", base: "42" },
  "0203.10":  { desc: "Pork carcases, fresh or chilled", rate: 0.05, unit: "kg", cpc: "C400", taxType: "01", base: "42" },
  "0203.20":  { desc: "Pork, frozen", rate: 0.05, unit: "kg", cpc: "C400", taxType: "01", base: "42" },
  "0302.10":  { desc: "Salmon/trout, fresh or chilled", rate: 0.15, unit: "kg", cpc: "C400", taxType: "01", base: "42" },
  "0302.60":  { desc: "Other fish (snapper, grouper, mahi etc.), fresh", rate: 0.15, unit: "kg", cpc: "C400", taxType: "01", base: "42" },
  "0303.70":  { desc: "Other fish frozen (snapper, grouper etc.)", rate: 0.15, unit: "kg", cpc: "C400", taxType: "01", base: "42" },
  "0304.10":  { desc: "Fish fillets, fresh or chilled", rate: 0.15, unit: "kg", cpc: "C400", taxType: "01", base: "42" },
  "0304.20":  { desc: "Fish fillets, frozen", rate: 0.15, unit: "kg", cpc: "C400", taxType: "01", base: "42" },
  "0305.40":  { desc: "Smoked fish/fillets", rate: 0, unit: "kg", cpc: "C400", taxType: "01", base: "42" },
  "0306.002": { desc: "Shrimps and prawns, frozen", rate: 0.15, unit: "kg", cpc: "C400", taxType: "01", base: "42" },
  "0306.003": { desc: "Lobsters, frozen", rate: 0.15, unit: "kg", cpc: "C400", taxType: "01", base: "42" },
  "1006.30":  { desc: "Semi-milled or wholly milled rice", rate: 0, unit: "kg", cpc: "C400", taxType: "01", base: "42" },
  "1006.40":  { desc: "Broken rice", rate: 0, unit: "kg", cpc: "C400", taxType: "01", base: "42" },
  "1701.10":  { desc: "Cane sugar, raw", rate: 0, unit: "kg", cpc: "C400", taxType: "01", base: "42" },
  "1701.91":  { desc: "Sugar, containing flavouring/colouring", rate: 0.15, unit: "kg", cpc: "C400", taxType: "01", base: "42" },
  "1701.999": { desc: "Other refined sugar", rate: 0, unit: "kg", cpc: "C400", taxType: "01", base: "42" },
  "1507.90":  { desc: "Soya-bean oil, refined", rate: 0.10, unit: "kg", cpc: "C400", taxType: "01", base: "42" },
  "1511.90":  { desc: "Palm oil, refined", rate: 0.10, unit: "kg", cpc: "C400", taxType: "01", base: "42" },
  "1512.19":  { desc: "Sunflower/safflower oil, refined", rate: 0.10, unit: "kg", cpc: "C400", taxType: "01", base: "42" },
  "1515.29":  { desc: "Maize (corn) oil, other", rate: 0.10, unit: "kg", cpc: "C400", taxType: "01", base: "42" },
  "1517.10":  { desc: "Margarine", rate: 0.05, unit: "kg", cpc: "C400", taxType: "01", base: "42" },
  "1517.901": { desc: "Imitation lard/shortening", rate: 0.05, unit: "kg", cpc: "C400", taxType: "01", base: "42" },
  "2201.101": { desc: "Mineral water", rate: 0, unit: "kg & litre", cpc: "C400", taxType: "01", base: "42" },
  "2202.101": { desc: "Aerated beverages (sodas)", rate: 0.15, unit: "kg & litre", cpc: "C400", taxType: "01", base: "42" },
  "2203.001": { desc: "Beer", rate: null, rateStr: "$1.10/gal", unit: "gal", cpc: "C400", taxType: "02", base: "07" },
  "2204.201": { desc: "Wine (table wine)", rate: null, rateStr: "$1.20/gal", unit: "gal", cpc: "C400", taxType: "02", base: "07" },
  "2208.201": { desc: "Brandy/Cognac, bottled ≤46%", rate: null, rateStr: "$2.30/gal", unit: "gal", cpc: "C400", taxType: "02", base: "07" },
  "2208.301": { desc: "Whisky, bottled ≤46%", rate: null, rateStr: "$2.30/gal", unit: "gal", cpc: "C400", taxType: "02", base: "07" },
  "2208.401": { desc: "Rum, bottled ≤46%", rate: null, rateStr: "$2.30/gal", unit: "gal", cpc: "C400", taxType: "02", base: "07" },
  "2208.501": { desc: "Gin, bottled ≤46%", rate: null, rateStr: "$2.30/gal", unit: "gal", cpc: "C400", taxType: "02", base: "07" },
  "2208.901": { desc: "Vodka", rate: null, rateStr: "$2.30/gal", unit: "gal", cpc: "C400", taxType: "02", base: "07" },
  "2208.902": { desc: "Cordials and liqueurs", rate: null, rateStr: "$2.30/gal", unit: "gal", cpc: "C400", taxType: "02", base: "07" },
  "2402.20":  { desc: "Cigarettes containing tobacco", rate: null, rateStr: "$0.55/lb", unit: "lb", cpc: "C400", taxType: "01", base: "04" },
  "2402.10":  { desc: "Cigars and cigarillos", rate: null, rateStr: "$0.55/lb", unit: "lb", cpc: "C400", taxType: "01", base: "04" },
  "8418.211": { desc: "Refrigerator, frost-free electrical", rate: 0.15, unit: "kg and No", cpc: "C400", taxType: "01", base: "42" },
  "8418.30":  { desc: "Chest freezer, ≤800L", rate: 0.15, unit: "kg and No", cpc: "C400", taxType: "01", base: "42" },
  "8418.40":  { desc: "Upright freezer, ≤900L", rate: 0.15, unit: "kg and No", cpc: "C400", taxType: "01", base: "42" },
  "8418.50":  { desc: "Commercial display refrigeration", rate: 0.15, unit: "kg and No", cpc: "C400", taxType: "01", base: "42" },
  "7321.101": { desc: "Stoves, ranges, cookers and barbecues", rate: 0.15, unit: "kg", cpc: "C400", taxType: "01", base: "42" },
};

// ── Types ────────────────────────────────────────────────────────────────────
interface LineItem { id: number; desc: string; tariff: string; fob: string; weight: string }
interface Shipment { arrivalDate: string; manifestNo: string; bolNo: string; numPackages: string; containerId: string }
interface Supplier { name: string; street: string; city: string; country: string; shipmentCity: string }

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}
function getTariffInfo(tariff: string): TariffInfo | null { return TARIFF_DB[tariff.trim()] ?? null; }
function getDutyRate(info: TariffInfo | null): number { return info ? (info.rate ?? 0) : 0.20; }
function getRateStr(info: TariffInfo | null, tariff: string): string {
  if (!tariff.trim()) return "—";
  if (!info) return "20%";
  if (info.rateStr) return info.rateStr;
  return info.rate === 0 ? "FREE" : `${((info.rate ?? 0) * 100).toFixed(0)}%`;
}

function calcTotals(lines: LineItem[], freight: number, insurance: number) {
  const parsed = lines.map(l => ({ ...l, fobN: parseFloat(l.fob) || 0, weightN: parseFloat(l.weight) || 0, info: getTariffInfo(l.tariff) }));
  const totalFob = parsed.reduce((s, l) => s + l.fobN, 0);
  const totalCif = totalFob + freight + insurance;
  let totalDuty = 0;
  const lineCalcs = parsed.map(l => {
    const frac = totalFob > 0 ? l.fobN / totalFob : 0;
    const lineCif = l.fobN + frac * (freight + insurance);
    const rate = getDutyRate(l.info);
    const duty = (l.info?.rate !== null && rate > 0) ? lineCif * rate : 0;
    totalDuty += duty;
    return { ...l, lineCif, duty };
  });
  const wharfage = totalFob * 0.01;
  return { totalFob, totalCif, totalDuty, wharfage, grandTotal: totalDuty + wharfage, lineCalcs, freight, insurance };
}

// ── Main component ───────────────────────────────────────────────────────────
export default function AdminCustoms() {
  // Form state
  const [shipment, setShipment] = useState<Shipment>({ arrivalDate: "", manifestNo: "", bolNo: "", numPackages: "1", containerId: "" });
  const [supplier, setSupplier] = useState<Supplier>({ name: "Sysco Puerto Rico", street: "", city: "San Juan, PR", country: "United States", shipmentCity: "San Juan" });
  const [freight, setFreight] = useState("0");
  const [insurance, setInsurance] = useState("0");
  const [lines, setLines] = useState<LineItem[]>([{ id: 1, desc: "", tariff: "", fob: "", weight: "" }]);
  const [nextId, setNextId] = useState(2);
  const [showPreview, setShowPreview] = useState(false);

  const addLine = () => { setLines(prev => [...prev, { id: nextId, desc: "", tariff: "", fob: "", weight: "" }]); setNextId(n => n + 1); };
  const removeLine = (id: number) => setLines(prev => prev.filter(l => l.id !== id));
  const updateLine = (id: number, field: keyof LineItem, value: string) => {
    setLines(prev => prev.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, [field]: value };
      if (field === "tariff") {
        const info = getTariffInfo(value);
        if (info && !l.desc) updated.desc = info.desc;
      }
      return updated;
    }));
  };

  const freightN = parseFloat(freight) || 0;
  const insuranceN = parseFloat(insurance) || 0;
  const { totalFob, totalCif, totalDuty, wharfage, grandTotal, lineCalcs } = calcTotals(lines, freightN, insuranceN);

  const handlePrint = () => {
    setShowPreview(true);
    setTimeout(() => window.print(), 300);
  };

  // ── Input field style ────────────────────────────────────────────────────
  const inp = "w-full bg-[#0d0f14] border border-[#252a35] text-[#e2e8f0] rounded px-2.5 py-2 text-xs font-mono focus:outline-none focus:border-[#00c896] transition-colors placeholder-[#64748b]";
  const lbl = "block text-[10px] text-[#94a3b8] uppercase tracking-wider mb-1 font-mono";
  const sec = "text-[10px] text-[#00c896] uppercase tracking-[2px] font-mono border-b border-[#252a35] pb-2 mb-3";

  return (
    <div className="min-h-screen bg-[#0d0f14] text-[#e2e8f0] flex flex-col">
      {/* Print styles injected globally */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #hmc-print-area, #hmc-print-area * { visibility: visible !important; }
          #hmc-print-area { position: fixed; top: 0; left: 0; width: 100%; }
        }
        .fp-grid2 { display: grid; grid-template-columns: 1fr 1fr; }
        .fp-cell { border: 1px solid #000; padding: 4px 6px; min-height: 22px; font-size: 9px; }
        .fp-cell.hdr { background: #ddd; font-weight: bold; font-size: 8px; }
        .fp-lbl { font-size: 7px; font-weight: bold; display: block; margin-bottom: 2px; color: #333; }
        .fp-val { font-size: 9px; }
        .rec-block { border: 1px solid #000; margin-top: 8px; }
        .rec-hdr { background: #222; color: #fff; font-weight: bold; font-size: 9px; padding: 3px 6px; }
        .rec-grid { display: grid; grid-template-columns: 1fr 1fr; }
        .rec-cell { border: 1px solid #ccc; padding: 4px 6px; min-height: 30px; }
        .tax-tbl { width: 100%; border-collapse: collapse; font-size: 8px; margin-top: 4px; }
        .tax-tbl th { background: #eee; border: 1px solid #ccc; padding: 2px 4px; text-align: left; font-size: 7px; }
        .tax-tbl td { border: 1px solid #ccc; padding: 2px 4px; }
        .sig-block { border: 1px solid #000; margin-top: 10px; display: grid; grid-template-columns: 1fr 1fr; }
        .sig-left { padding: 8px; border-right: 1px solid #000; }
        .sig-right { padding: 8px; background: #f5f5f5; }
        .sig-line { border-bottom: 1px solid #000; margin: 16px 0 4px; }
      `}</style>

      {/* Header */}
      <header className="bg-[#151820] border-b border-[#252a35] px-6 py-4 flex items-center gap-4 shrink-0 print:hidden">
        <Link href={adminRoutes.dashboard}>
          <button className="text-[#64748b] hover:text-[#e2e8f0] transition-colors flex items-center gap-1.5 text-sm">
            <ChevronLeft className="w-4 h-4" /> Dashboard
          </button>
        </Link>
        <div className="flex items-center gap-3 ml-2">
          <span className="font-mono text-xs text-[#00c896] border border-[#00c896] px-2 py-1 tracking-widest">HMC</span>
          <div>
            <p className="text-sm font-semibold">Trade Declaration Generator</p>
            <p className="text-xs text-[#64748b] font-mono">HMC-12 · CAPS · BVI Customs · Island Tacos</p>
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => setShowPreview(v => !v)} className="px-4 py-2 text-xs font-mono uppercase tracking-wider border border-[#252a35] text-[#94a3b8] hover:border-[#00c896] hover:text-[#00c896] rounded transition-colors">
            {showPreview ? "Hide Preview" : "Preview"}
          </button>
          <button onClick={handlePrint} className="px-4 py-2 text-xs font-mono uppercase tracking-wider bg-[#00c896] text-black font-bold rounded hover:bg-[#00e0aa] transition-colors flex items-center gap-2">
            <Printer className="w-3.5 h-3.5" /> Print / Save PDF
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden print:block">
        {/* ── SIDEBAR FORM ── */}
        <div className="w-[380px] shrink-0 bg-[#151820] border-r border-[#252a35] overflow-y-auto p-5 space-y-6 print:hidden">

          {/* Shipment details */}
          <div>
            <p className={sec}>Shipment Details</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div><label className={lbl}>Arrival Date</label><input type="date" className={inp} value={shipment.arrivalDate} onChange={e => setShipment(s => ({ ...s, arrivalDate: e.target.value }))} /></div>
                <div><label className={lbl}>Manifest No.</label><input type="text" className={inp} placeholder="273" value={shipment.manifestNo} onChange={e => setShipment(s => ({ ...s, manifestNo: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={lbl}>BOL / AWB No.</label><input type="text" className={inp} placeholder="ISA31C" value={shipment.bolNo} onChange={e => setShipment(s => ({ ...s, bolNo: e.target.value }))} /></div>
                <div><label className={lbl}>No. of Packages</label><input type="number" className={inp} min="1" value={shipment.numPackages} onChange={e => setShipment(s => ({ ...s, numPackages: e.target.value }))} /></div>
              </div>
              <div><label className={lbl}>Container ID & Length</label><input type="text" className={inp} placeholder="Leave blank if none" value={shipment.containerId} onChange={e => setShipment(s => ({ ...s, containerId: e.target.value }))} /></div>
            </div>
          </div>

          {/* Supplier */}
          <div>
            <p className={sec}>Supplier Details</p>
            <div className="space-y-3">
              <div><label className={lbl}>Supplier Name</label><input type="text" className={inp} placeholder="e.g. Sysco Puerto Rico" value={supplier.name} onChange={e => setSupplier(s => ({ ...s, name: e.target.value }))} /></div>
              <div><label className={lbl}>Supplier Address</label><input type="text" className={inp} placeholder="Street address" value={supplier.street} onChange={e => setSupplier(s => ({ ...s, street: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={lbl}>City / State</label><input type="text" className={inp} placeholder="San Juan, PR" value={supplier.city} onChange={e => setSupplier(s => ({ ...s, city: e.target.value }))} /></div>
                <div><label className={lbl}>Country</label><input type="text" className={inp} value={supplier.country} onChange={e => setSupplier(s => ({ ...s, country: e.target.value }))} /></div>
              </div>
              <div><label className={lbl}>City of Direct Shipment</label><input type="text" className={inp} placeholder="San Juan" value={supplier.shipmentCity} onChange={e => setSupplier(s => ({ ...s, shipmentCity: e.target.value }))} /></div>
            </div>
          </div>

          {/* Freight & Insurance */}
          <div>
            <p className={sec}>Freight & Insurance</p>
            <div className="grid grid-cols-2 gap-2">
              <div><label className={lbl}>Total Freight (USD)</label><input type="number" className={inp} step="0.01" placeholder="0.00" value={freight} onChange={e => setFreight(e.target.value)} /></div>
              <div><label className={lbl}>Total Insurance (USD)</label><input type="number" className={inp} step="0.01" placeholder="0.00" value={insurance} onChange={e => setInsurance(e.target.value)} /></div>
            </div>
          </div>

          {/* Line items */}
          <div>
            <p className={sec}>Line Items (Invoice Lines)</p>
            <div className="grid grid-cols-[2fr_1.2fr_0.7fr_0.7fr_24px] gap-1.5 pb-2 border-b border-[#252a35] mb-2">
              {["Description", "Tariff No.", "FOB $", "Weight lb", ""].map(h => (
                <span key={h} className="text-[9px] text-[#64748b] uppercase tracking-wider font-mono">{h}</span>
              ))}
            </div>
            <div className="space-y-2">
              {lines.map(line => {
                const info = getTariffInfo(line.tariff);
                const rateStr = getRateStr(info, line.tariff);
                const isFree = line.tariff && info && info.rate === 0;
                const isTaxed = line.tariff && (!info || (info.rate !== null && (info.rate ?? 0) > 0) || info.rate === null);
                return (
                  <div key={line.id} className="grid grid-cols-[2fr_1.2fr_0.7fr_0.7fr_24px] gap-1.5 items-center">
                    <input type="text" className={inp} placeholder="e.g. Frozen Chicken Wings" value={line.desc} onChange={e => updateLine(line.id, "desc", e.target.value)} />
                    <input type="text" list="tariff-list" className={inp} placeholder="0207.412" value={line.tariff} onChange={e => updateLine(line.id, "tariff", e.target.value)} />
                    <input type="number" className={inp} placeholder="0.00" step="0.01" value={line.fob} onChange={e => updateLine(line.id, "fob", e.target.value)} />
                    <input type="number" className={inp} placeholder="0.0" step="0.1" value={line.weight} onChange={e => updateLine(line.id, "weight", e.target.value)} />
                    <button onClick={() => removeLine(line.id)} className="text-[#64748b] hover:text-red-400 transition-colors flex items-center justify-center">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {line.tariff && (
                      <div className="col-span-5 -mt-1">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${isFree ? "bg-green-950 text-green-400" : isTaxed ? "bg-orange-950 text-orange-400" : "bg-[#252a35] text-[#94a3b8]"}`}>
                          {rateStr}{info ? ` — ${info.desc.substring(0, 50)}` : " (unknown tariff — defaulting to 20%)"}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={addLine} className="mt-3 w-full py-2.5 border border-dashed border-[#252a35] text-[#64748b] hover:border-[#00c896] hover:text-[#00c896] text-xs font-mono uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-2">
              <Plus className="w-3.5 h-3.5" /> Add Line Item
            </button>
            <datalist id="tariff-list">
              {Object.keys(TARIFF_DB).map(k => <option key={k} value={k}>{TARIFF_DB[k].desc}</option>)}
            </datalist>
          </div>

          {/* Totals summary */}
          <div>
            <p className={sec}>Summary</p>
            <div className="bg-[#0d0f14] border border-[#252a35] rounded p-3 font-mono text-xs space-y-1">
              {[
                ["Total FOB", `$${totalFob.toFixed(2)}`],
                ["Freight", `$${freightN.toFixed(2)}`],
                ["Insurance", `$${insuranceN.toFixed(2)}`],
                ["Total CIF", `$${totalCif.toFixed(2)}`],
                ["Customs Duty", `$${totalDuty.toFixed(2)}`],
                ["Wharfage (1% FOB)", `$${wharfage.toFixed(2)}`],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between text-[#94a3b8] border-b border-[#252a35] py-1 last:border-0">
                  <span>{label}</span><span>{val}</span>
                </div>
              ))}
              <div className="flex justify-between text-[#00c896] font-bold text-sm pt-2 border-t border-[#252a35]">
                <span>TOTAL DUE</span><span>${grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <button onClick={() => setShowPreview(true)} className="w-full py-3 bg-[#00c896] text-black font-bold font-mono text-xs uppercase tracking-widest rounded hover:bg-[#00e0aa] transition-colors">
            ▶ Generate Declaration
          </button>
        </div>

        {/* ── PREVIEW PANEL ── */}
        <div className="flex-1 overflow-y-auto bg-[#1a1d25] p-6 print:p-0 print:bg-white">
          {!showPreview ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-[#64748b]">
              <div className="text-5xl mb-4">📋</div>
              <p className="font-mono text-xs">Fill in the details and click<br />Generate Declaration</p>
            </div>
          ) : (
            <div id="hmc-print-area" style={{ background: "#fff", color: "#000", maxWidth: 780, margin: "0 auto", padding: 20, fontFamily: "Arial, Helvetica, sans-serif", fontSize: 9, boxShadow: "0 4px 40px rgba(0,0,0,0.5)", borderRadius: 2 }}>
              {/* Form header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, borderBottom: "2px solid #000", paddingBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: "bold", marginBottom: 4 }}>🛃 H.M. Customs Trade Declaration</div>
                  <div style={{ display: "flex", gap: 16, fontSize: 9, marginTop: 6 }}>
                    {["IMPORT", "EXPORT", "DEPOSIT", "ADJUSTMENT"].map((t, i) => (
                      <div key={t} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <div style={{ width: 10, height: 10, border: "1px solid #000", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 8 }}>{i === 0 ? "✓" : "\u00a0"}</div>
                        {t}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ textAlign: "right", fontSize: 8 }}>
                  <div>Page No./Total: <span style={{ borderBottom: "1px solid #000", minWidth: 60, display: "inline-block" }}>1 / {Math.ceil(lines.length / 3)}</span></div>
                  <div>Trader Reference: <span style={{ borderBottom: "1px solid #000", minWidth: 80, display: "inline-block" }}>&nbsp;</span></div>
                  <div>Related TD No.: <span style={{ borderBottom: "1px solid #000", minWidth: 80, display: "inline-block" }}>&nbsp;</span></div>
                </div>
              </div>

              {/* Supplier + Importer grid */}
              <div className="fp-grid2">
                <div className="fp-cell hdr">1 SUPPLIER DETAILS &nbsp;&nbsp; ID: ___________</div>
                <div className="fp-cell hdr">5 SHIPMENT DETAILS</div>
                <div className="fp-cell"><span className="fp-lbl">a. NAME</span><span className="fp-val">{supplier.name}</span></div>
                <div className="fp-cell"><span className="fp-lbl">a. CITY OF DIRECT SHIPMENT</span><span className="fp-val">{supplier.shipmentCity}</span></div>
                <div className="fp-cell"><span className="fp-lbl">b. STREET</span><span className="fp-val">{supplier.street}</span></div>
                <div className="fp-cell"><span className="fp-lbl">b. COUNTRY OF DIRECT SHIPMENT</span><span className="fp-val">{supplier.country}</span></div>
                <div className="fp-cell"><span className="fp-lbl">c. CITY, STATE/PROV.</span><span className="fp-val">{supplier.city}</span></div>
                <div className="fp-cell"><span className="fp-lbl">c. COUNTRY OF ORIGINAL SHIPMENT</span><span className="fp-val">{supplier.country}</span></div>
                <div className="fp-cell"><span className="fp-lbl">e. COUNTRY</span><span className="fp-val">{supplier.country}</span></div>
                <div className="fp-cell hdr">6 ADDITIONAL INFORMATION</div>

                <div className="fp-cell hdr">2 IMPORTER DETAILS &nbsp;&nbsp; ID: {DECLARANT.importerId}</div>
                <div className="fp-cell"><span className="fp-lbl">7 TOTAL NO. OF RECORDS</span><span className="fp-val">{lines.length}</span></div>
                <div className="fp-cell"><span className="fp-lbl">a. NAME</span><span className="fp-val">{DECLARANT.importerName}</span></div>
                <div className="fp-cell"><span className="fp-lbl">8 TOTAL FREIGHT</span><span className="fp-val">${freightN.toFixed(2)}</span></div>
                <div className="fp-cell"><span className="fp-lbl">b. PO BOX, STREET</span><span className="fp-val">{DECLARANT.importerAddress}</span></div>
                <div className="fp-cell">
                  <span className="fp-lbl">9 TOTAL INSURANCE</span><span className="fp-val">${insuranceN.toFixed(2)}</span><br />
                  <span className="fp-lbl" style={{ marginTop: 4 }}>Total Customs Duty</span><span className="fp-val">${totalDuty.toFixed(2)}</span><br />
                  <span className="fp-lbl">Total Wharfage</span><span className="fp-val">${wharfage.toFixed(2)}</span>
                </div>
                <div className="fp-cell"><span className="fp-lbl">c. TOWN, ISLAND</span><span className="fp-val">{DECLARANT.importerTown}</span></div>

                <div className="fp-cell hdr">3 TRANSPORT DETAILS</div>
                <div className="fp-cell" style={{ background: "#fffde7", fontWeight: "bold" }}>
                  <span className="fp-lbl">10 TOTAL DUTY</span>
                  <span style={{ fontSize: 13, fontWeight: "bold" }}>${grandTotal.toFixed(2)}</span>
                </div>

                <div className="fp-cell"><span className="fp-lbl">a. CARRIER ID / NO.</span><span className="fp-val">{DECLARANT.carrierIdNo}</span></div>
                <div />
                <div className="fp-cell"><span className="fp-lbl">b. PORT OF ARRIVAL</span><span className="fp-val">{DECLARANT.portOfArrival}</span></div>
                <div />
                <div className="fp-cell"><span className="fp-lbl">c. ARRIVAL DATE</span><span className="fp-val">{fmtDate(shipment.arrivalDate)}</span></div>
                <div />

                <div className="fp-cell hdr">4 MANIFEST DETAILS &nbsp;&nbsp; NO.: {shipment.manifestNo}</div>
                <div />
                <div className="fp-cell"><span className="fp-lbl">a. NO. OF PACKAGES</span><span className="fp-val">{shipment.numPackages}</span></div>
                <div />
                <div className="fp-cell"><span className="fp-lbl">b. BILL OF LADING / AWB</span><span className="fp-val">{shipment.bolNo}</span></div>
                <div />
                <div className="fp-cell"><span className="fp-lbl">c. CONTAINER ID & LENGTH</span><span className="fp-val">{shipment.containerId || "—"}</span></div>
                <div />
              </div>

              {/* Record blocks */}
              {lineCalcs.map((l, i) => {
                const recNo = String(i + 1).padStart(3, "0");
                const rateStr = getRateStr(l.info, l.tariff);
                const wharfAmt = (l.fobN * 0.01).toFixed(2);
                const fobFrac = totalFob > 0 ? l.fobN / totalFob : 0;
                return (
                  <div key={l.id} className="rec-block">
                    <div className="rec-hdr">11 RECORD NO.: {recNo}</div>
                    <div className="rec-grid">
                      <div className="rec-cell"><span className="fp-lbl">12 CPC</span><span className="fp-val">{l.info?.cpc ?? "C400"}</span></div>
                      <div className="rec-cell"><span className="fp-lbl">18 F.O.B. VALUE</span><span className="fp-val">${l.fobN.toFixed(2)}</span></div>
                      <div className="rec-cell"><span className="fp-lbl">13 TARIFF NO.</span><span className="fp-val">{l.tariff}</span></div>
                      <div className="rec-cell"><span className="fp-lbl">19 CHARGES / DEDUCTIONS</span><span className="fp-val">Freight: ${(fobFrac * freightN).toFixed(2)} | Ins: ${(fobFrac * insuranceN).toFixed(2)}</span></div>
                      <div className="rec-cell"><span className="fp-lbl">14 COUNTRY OF ORIGIN</span><span className="fp-val">{supplier.country || "United States"} / US</span></div>
                      <div className="rec-cell" style={{ background: "#f9f9f9" }}><span className="fp-lbl">20 C.I.F. VALUE</span><span className="fp-val" style={{ fontWeight: "bold" }}>${l.lineCif.toFixed(2)}</span></div>
                      <div className="rec-cell" style={{ gridColumn: "span 2" }}><span className="fp-lbl">16 DESCRIPTION</span><span className="fp-val">{l.desc}</span></div>
                    </div>
                    <div style={{ padding: "4px 6px", borderTop: "1px solid #ccc" }}>
                      <table className="tax-tbl">
                        <thead><tr><th>21 TAX</th><th>IND.</th><th>VALUE</th><th>RATE</th><th>AMOUNT</th></tr></thead>
                        <tbody>
                          <tr><td>01 Import Duty</td><td>{l.info?.base ?? "42"}</td><td>${l.lineCif.toFixed(2)}</td><td>{rateStr}</td><td>${l.duty.toFixed(2)}</td></tr>
                          <tr><td>03 Wharfage</td><td>25</td><td>${l.fobN.toFixed(2)}</td><td>1%</td><td>${wharfAmt}</td></tr>
                        </tbody>
                      </table>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: "1px solid #ccc" }}>
                      <div className="rec-cell"><span className="fp-lbl">17a NET WEIGHT (LB)</span><span className="fp-val">{l.weightN} lb</span></div>
                      <div className="rec-cell" style={{ textAlign: "right" }}><span className="fp-lbl">TOTAL</span><span className="fp-val" style={{ fontWeight: "bold" }}>${(l.duty + l.fobN * 0.01).toFixed(2)}</span></div>
                    </div>
                  </div>
                );
              })}

              {/* Signature block */}
              <div className="sig-block">
                <div className="sig-left">
                  <div><strong>DECLARANT NAME:</strong> {DECLARANT.name}</div>
                  <div style={{ marginTop: 6 }}><strong>DECLARANT ID:</strong> {DECLARANT.id}</div>
                  <div style={{ fontSize: 8, marginTop: 8, fontStyle: "italic" }}>I/We declare that the above particulars are true and correct.</div>
                  <div style={{ display: "flex", gap: 24, marginTop: 8 }}>
                    <div><div className="sig-line" /><div style={{ fontSize: 7 }}>SIGNATURE</div></div>
                    <div><div className="sig-line" style={{ minWidth: 80 }} /><div style={{ fontSize: 7 }}>DATE</div></div>
                  </div>
                </div>
                <div className="sig-right"><div style={{ fontSize: 8, fontStyle: "italic", color: "#666" }}>Customs Use Only</div></div>
              </div>
              <div style={{ textAlign: "right", fontSize: 7, marginTop: 6, color: "#999" }}>HMC-12 (10/12)</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

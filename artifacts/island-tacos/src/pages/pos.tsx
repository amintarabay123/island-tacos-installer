import { useState, useEffect, useRef, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { useLocation } from "wouter";
import { adminRoutes } from "@/lib/admin-path";
import { authHeaders, clearAuthToken } from "@/lib/auth";
import { setPageMeta } from "@/lib/page-meta";

// ─── Types ────────────────────────────────────────────────────────────────────

type ModifierOption = { id: string; name: string; price: number; position: number; allowMultiple?: boolean; maxQuantity?: number };
type Modifier = { id: number; loyverseId: string; name: string; options: ModifierOption[]; required: boolean; minSelections: number; maxSelections: number | null };
type MenuCategory = { id: number; name: string; sortOrder: number };
type MenuItem = {
  id: number; categoryId: number; name: string; description?: string | null;
  price: number; imageUrl?: string | null; posImageUrl?: string | null; available: boolean;
  popular: boolean; spicy: boolean; vegetarian: boolean;
};
type CartModifier = { modifierId: string; optionId: string; name: string; price: number };
type CartItem = {
  key: string; menuItemId: number; name: string; price: number;
  quantity: number; notes: string; modifierSelections: CartModifier[];
  alreadyMade?: boolean;
};
type Order = {
  id: number; confirmationCode: string; customerName: string; status: string;
  paymentStatus: string; paymentMethod: string; source: string;
  subtotal: number; discountAmount: number; tax: number; total: number;
  notes?: string | null; createdAt: string; customerPhone?: string | null; customerEmail?: string | null;
  orderType?: string; estimatedReadyAt?: string | null; scheduledPickupAt?: string | null;
  items: { id: number; menuItemId: number; menuItemName: string; quantity: number; menuItemPrice: number; subtotal: number; modifierSelections?: CartModifier[] | null; notes?: string | null; alreadyMade?: boolean | null }[];
};

type Shift = {
  id: number; openedAt: string; closedAt: string | null;
  openingFloat: number; closingFloat: number | null; notes: string | null;
};
type CashTxn = { id: number; shiftId: number | null; type: string; amount: number; note: string | null; createdAt: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) => `$${n.toFixed(2)}`;
const now = () => new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const uid = () => Math.random().toString(36).slice(2, 9);
const PAY_LABEL: Record<string, string> = { cash: "Cash", card: "Card", athmovil: "ATH Móvil", complimentary: "Comp", split: "Split" };

type PrinterConfig = { type: "browser" | "network" | "bridge"; ip?: string; port?: number; bridgeUrl?: string };
function getPrinterConfig(): PrinterConfig {
  try { return JSON.parse(localStorage.getItem("printerConfig") ?? "{}"); } catch { return { type: "browser" }; }
}

async function printReceiptLines(
  lines: { text: string; bold?: boolean; center?: boolean; size?: string; divider?: boolean }[],
  config?: PrinterConfig
): Promise<{ ok: boolean; error?: string }> {
  const cfg = config ?? getPrinterConfig();

  // Local bridge: browser calls the bridge directly, bridge talks to printer via TCP
  if (cfg.type === "bridge") {
    const url = (cfg.bridgeUrl ?? "http://localhost:8765").replace(/\/$/, "");
    try {
      const r = await fetch(`${url}/print`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      });
      const data = await r.json();
      return data;
    } catch (e) { return { ok: false, error: `Bridge unreachable: ${String(e)}` }; }
  }

  if (cfg.type === "network" && cfg.ip) {
    try {
      const r = await fetch("/api/print/network", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ ip: cfg.ip, port: cfg.port ?? 9100, lines }),
      });
      const data = await r.json();
      return data;
    } catch (e) { return { ok: false, error: String(e) }; }
  }
  // Browser print fallback
  const html = `<html><head><title>Receipt</title><style>
    body{font-family:monospace;font-size:12px;width:280px;margin:0 auto;padding:8px}
    .center{text-align:center}.bold{font-weight:bold}.large{font-size:16px}
    .small{font-size:10px}.divider{border-top:1px dashed #000;margin:6px 0}
  </style></head><body>
    ${lines.map(l => {
      if (l.divider) return '<div class="divider"></div>';
      const cls = [l.center ? "center" : "", l.bold ? "bold" : "", l.size === "large" ? "large" : l.size === "small" ? "small" : ""].filter(Boolean).join(" ");
      return `<div class="${cls}">${l.text || "&nbsp;"}</div>`;
    }).join("")}
  </body></html>`;
  const win = window.open("", "_blank", "width=320,height=600");
  if (!win) return { ok: false, error: "Popup blocked" };
  win.document.write(html);
  win.document.close(); win.focus(); win.print(); win.close();
  return { ok: true };
}

function buildReceiptLines(order: Order, tendered?: number): { text: string; bold?: boolean; center?: boolean; size?: string; divider?: boolean }[] {
  const lines: { text: string; bold?: boolean; center?: boolean; size?: string; divider?: boolean }[] = [];
  lines.push({ text: "ISLAND TACOS", bold: true, center: true, size: "large" });
  lines.push({ text: "Wickhams Cay 1, Road Town, BVI", center: true });
  lines.push({ text: "Tel: +1 (284) 000-0000", center: true });
  lines.push({ divider: true, text: "" });
  lines.push({ text: `#${order.confirmationCode}  ${new Date(order.createdAt).toLocaleString()}` });
  lines.push({ text: `Customer: ${order.customerName || "Walk-in"}` });
  lines.push({ text: `Payment: ${PAY_LABEL[order.paymentMethod] ?? order.paymentMethod}` });
  lines.push({ divider: true, text: "" });
  for (const item of order.items) {
    lines.push({ text: `${item.quantity}x ${item.menuItemName}`, bold: true });
    if (item.modifierSelections?.length) {
      for (const m of item.modifierSelections) {
        lines.push({ text: `  + ${m.name}${m.price > 0 ? ` $${m.price.toFixed(2)}` : ""}` });
      }
    }
    if (item.notes) lines.push({ text: `  Note: ${item.notes}` });
    lines.push({ text: `$${item.subtotal.toFixed(2)}`, bold: false });
  }
  lines.push({ divider: true, text: "" });
  lines.push({ text: `Subtotal: ${fmt(order.subtotal)}` });
  if (order.discountAmount > 0) lines.push({ text: `Discount: -${fmt(order.discountAmount)}` });
  if (order.tax > 0) lines.push({ text: `Tax: ${fmt(order.tax)}` });
  lines.push({ text: `TOTAL: ${fmt(order.total)}`, bold: true, size: "large" });
  if (tendered != null) {
    lines.push({ text: `Tendered: ${fmt(tendered)}` });
    lines.push({ text: `Change: ${fmt(Math.max(0, tendered - order.total))}` });
  }
  lines.push({ divider: true, text: "" });
  lines.push({ text: "Thank you for your visit!", center: true });
  lines.push({ text: "islandtacos.com", center: true });
  lines.push({ text: "", center: true });
  return lines;
}


// ─── Numpad ──────────────────────────────────────────────────────────────────

function Numpad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const press = (k: string) => {
    if (k === "⌫") { onChange(value.slice(0, -1) || "0"); return; }
    if (k === "." && value.includes(".")) return;
    if (value === "0" && k !== ".") { onChange(k); return; }
    if (value.split(".")[1]?.length >= 2) return;
    onChange(value === "0" ? k : value + k);
  };
  const keys = ["7","8","9","4","5","6","1","2","3","00","0","⌫"];
  return (
    <div className="grid grid-cols-3 gap-2 mt-3">
      {keys.map(k => (
        <button key={k} onClick={() => press(k)}
          className="h-14 rounded-xl text-xl font-semibold bg-gray-100 hover:bg-gray-200 active:bg-gray-200 text-gray-900 transition-colors">
          {k}
        </button>
      ))}
    </div>
  );
}

// ─── RetryImg ─────────────────────────────────────────────────────────────────
// Retries failed image loads up to MAX_RETRIES times with exponential back-off.
// Shows a pulsing skeleton while loading (so the dark card bg doesn't flash).
// Falls back to a taco emoji if all retries are exhausted.
const MAX_IMG_RETRIES = 4;
function RetryImg({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cache-bust suffix added on retries so the browser actually re-requests
  const bustedSrc = attempt === 0 ? src : `${src}&_r=${attempt}`;
  const handleError = () => {
    setLoaded(false);
    if (attempt < MAX_IMG_RETRIES) {
      timerRef.current = setTimeout(() => setAttempt(a => a + 1), 1500 * (attempt + 1));
    } else {
      setFailed(true);
    }
  };
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  if (failed) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl opacity-30">🌮</span>
      </div>
    );
  }
  return (
    <>
      {!loaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-200/60 to-gray-300/60 animate-pulse" />
      )}
      <img
        src={bustedSrc}
        alt={alt}
        className={`${className} transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setLoaded(true)}
        onError={handleError}
      />
    </>
  );
}

// ─── Modifier Modal ───────────────────────────────────────────────────────────

function ModifierModal({ item, modifiers, onConfirm, onClose, initialSelections = [], initialNote = "" }: {
  item: MenuItem; modifiers: Modifier[];
  onConfirm: (sels: CartModifier[], note: string) => void; onClose: () => void;
  initialSelections?: CartModifier[]; initialNote?: string;
}) {
  // Build initial qtys from pre-existing selections (when editing a cart item)
  const buildInitialQtys = () => {
    const q: Record<string, Record<string, number>> = {};
    for (const sel of initialSelections) {
      if (!q[sel.modifierId]) q[sel.modifierId] = {};
      q[sel.modifierId][sel.optionId] = (q[sel.modifierId][sel.optionId] ?? 0) + 1;
    }
    return q;
  };
  // Record<modLoyverseId, Record<optionId, quantity>>
  const [qtys, setQtys] = useState<Record<string, Record<string, number>>>(buildInitialQtys);
  const [note, setNote] = useState(initialNote);

  const totalExtra = modifiers.reduce((sum, mod) => {
    const sel = qtys[mod.loyverseId] ?? {};
    return sum + mod.options.reduce((s, o) => s + (sel[o.id] ?? 0) * o.price, 0);
  }, 0);
  const total = item.price + totalExtra;

  const totalSelForGroup = (mod: Modifier) =>
    Object.values(qtys[mod.loyverseId] ?? {}).reduce((s, q) => s + q, 0);

  const changeQty = (mod: Modifier, opt: ModifierOption, delta: number) => {
    setQtys(prev => {
      const current = { ...(prev[mod.loyverseId] ?? {}) };
      const maxQty = opt.allowMultiple ? (opt.maxQuantity ?? 1) : 1;
      const totalOther = Object.entries(current).filter(([k]) => k !== opt.id).reduce((s, [, v]) => s + v, 0);
      const newQty = Math.max(0, Math.min(maxQty, (current[opt.id] ?? 0) + delta));
      if (delta > 0 && mod.maxSelections !== null && totalOther + newQty > mod.maxSelections) return prev;
      if (newQty === 0) { delete current[opt.id]; } else { current[opt.id] = newQty; }
      return { ...prev, [mod.loyverseId]: current };
    });
  };

  const validationError = modifiers.reduce<string | null>((err, mod) => {
    if (err) return err;
    const total = totalSelForGroup(mod);
    if (mod.required && total === 0) return `Select "${mod.name}"`;
    if (mod.minSelections > 0 && total < mod.minSelections) return `"${mod.name}": min ${mod.minSelections}`;
    return null;
  }, null);

  const handleConfirm = () => {
    if (validationError) return;
    const sels: CartModifier[] = [];
    for (const mod of modifiers) {
      const sel = qtys[mod.loyverseId] ?? {};
      for (const opt of mod.options) {
        const qty = sel[opt.id] ?? 0;
        for (let i = 0; i < qty; i++) {
          sels.push({ modifierId: mod.loyverseId, optionId: opt.id, name: opt.name, price: opt.price });
        }
      }
    }
    onConfirm(sels, note.trim());
  };

  return (
    // Outer backdrop is the scroll container — the iOS-reliable pattern.
    // overflow-y-auto on a fixed inset-0 div scrolls correctly on every device
    // including iPhone/iPad Safari/PWA. Inner overflow-y-auto inside a flex
    // parent with overflow-hidden reliably breaks on iOS.
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70"
      onClick={onClose}
      style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
    >
      <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4">
        <div
          className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Header — sticky inside the outer scroll */}
          <div className="sticky top-0 z-10 bg-white rounded-t-2xl sm:rounded-t-2xl p-5 border-b border-gray-200">
            <h2 className="text-gray-900 text-xl font-bold">{item.name}</h2>
            <p className="text-[#F5A623] text-lg font-semibold">{fmt(total)}</p>
          </div>
          {/* Content — no overflow, flows naturally */}
          <div className="p-5 space-y-6">
          {modifiers.map(mod => {
            const groupTotal = totalSelForGroup(mod);
            const atMax = mod.maxSelections !== null && groupTotal >= mod.maxSelections;
            return (
              <div key={mod.id}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">{mod.name}</p>
                  <div className="flex items-center gap-1.5">
                    {mod.required && groupTotal === 0 && (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-red-600 bg-red-950/40 px-1.5 py-0.5 rounded">Required</span>
                    )}
                    {mod.minSelections > 0 && (
                      <span className="text-[11px] text-gray-400">
                        {mod.maxSelections === mod.minSelections ? `Pick ${mod.minSelections}` : mod.maxSelections ? `${mod.minSelections}–${mod.maxSelections}` : `Min ${mod.minSelections}`}
                      </span>
                    )}
                    {mod.maxSelections !== null && mod.minSelections === 0 && (
                      <span className="text-[11px] text-gray-400">Up to {mod.maxSelections}</span>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  {mod.options.sort((a, b) => a.position - b.position).map(opt => {
                    const qty = qtys[mod.loyverseId]?.[opt.id] ?? 0;
                    const sel = qty > 0;
                    if (opt.allowMultiple) {
                      return (
                        <div key={opt.id} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${sel ? "border-[#F5A623] bg-[#F5A623]/10" : "border-gray-200 bg-gray-100"}`}>
                          <span className={`font-medium ${sel ? "text-gray-900" : "text-gray-700"}`}>{opt.name}</span>
                          <div className="flex items-center gap-3">
                            {opt.price > 0 && <span className="text-[#F5A623] text-sm font-semibold">+{fmt(opt.price)}</span>}
                            <div className="flex items-center gap-2 bg-gray-50 rounded-full px-2 py-1">
                              <button
                                className="w-9 h-9 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-900 disabled:opacity-30 transition-colors active:bg-white/10"
                                onClick={() => changeQty(mod, opt, -1)}
                                disabled={qty === 0}
                              ><span className="text-xl leading-none">−</span></button>
                              <span className="w-5 text-center text-sm font-bold text-gray-900">{qty}</span>
                              <button
                                className="w-9 h-9 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-900 disabled:opacity-30 transition-colors active:bg-white/10"
                                onClick={() => changeQty(mod, opt, 1)}
                                disabled={atMax || qty >= (opt.maxQuantity ?? 1)}
                              ><span className="text-xl leading-none">+</span></button>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <button key={opt.id} onClick={() => changeQty(mod, opt, sel ? -1 : 1)}
                        disabled={!sel && atMax}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all disabled:opacity-40 ${sel ? "border-[#F5A623] bg-[#F5A623]/10 text-gray-900" : "border-gray-200 bg-gray-100 text-gray-700 hover:border-gray-400"}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${sel ? "border-[#F5A623] bg-[#F5A623]" : "border-gray-400"}`}>
                            {sel && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                          <span className="font-medium">{opt.name}</span>
                        </div>
                        {opt.price > 0 && <span className="text-[#F5A623] text-sm font-semibold">+{fmt(opt.price)}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {validationError && (
            <p className="text-red-600 text-sm text-center">{validationError}</p>
          )}
          </div>
          {/* Special instructions + action buttons — at the bottom of the flow */}
          <div className="px-5 pb-3 border-t border-gray-200 pt-4">
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">Special Instructions</p>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. chicken slightly burnt, extra crispy…"
              rows={2}
              className="w-full bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 text-sm placeholder-gray-400 resize-none focus:outline-none focus:border-amber-400/60 transition-colors"
            />
          </div>
          <div className="p-5 pt-2 flex gap-3 pb-safe">
            <button onClick={onClose} className="flex-1 h-12 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-100 transition-colors">Cancel</button>
            <button onClick={handleConfirm} disabled={!!validationError}
              className="flex-2 flex-grow h-12 rounded-xl bg-[#F5A623] hover:bg-[#E09520] disabled:opacity-50 text-black font-bold transition-colors">
              Add to Order · {fmt(total)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Payment Modal ────────────────────────────────────────────────────────────

function PaymentModal({ total, onPay, onClose, onSplit, onTabChange, onPayAndHold }: {
  total: number;
  onPay: (method: string, tendered?: number, splitNote?: string) => void;
  onPayAndHold?: (method: string, tendered?: number, splitNote?: string) => void;
  onClose: () => void;
  onSplit?: () => void;
  onTabChange?: (tab: string) => void;
}) {
  const [tab, setTab] = useState<"cash" | "card" | "athmovil" | "split">("cash");

  useEffect(() => { onTabChange?.(tab); }, [tab]);
  const [tendered, setTendered] = useState(String(Math.ceil(total)));
  const change = Math.max(0, parseFloat(tendered || "0") - total);

  // Split-by-amount state
  const [splitAmounts, setSplitAmounts] = useState<{ cash: string; card: string; athmovil: string }>({ cash: "0", card: "0", athmovil: "0" });
  const [splitActive, setSplitActive] = useState<"cash" | "card" | "athmovil">("cash");
  const [splitCollecting, setSplitCollecting] = useState(false);

  const splitParsed = {
    cash: parseFloat(splitAmounts.cash || "0"),
    card: parseFloat(splitAmounts.card || "0"),
    athmovil: parseFloat(splitAmounts.athmovil || "0"),
  };
  const splitSum = Math.round((splitParsed.cash + splitParsed.card + splitParsed.athmovil) * 100) / 100;
  const splitRemaining = Math.round((total - splitSum) * 100) / 100;
  const activeSplitMethods = (["cash", "card", "athmovil"] as const).filter(k => splitParsed[k] > 0);
  const splitReady = Math.abs(splitRemaining) < 0.005 && activeSplitMethods.length >= 2;

  const SPLIT_METHOD_LABELS: Record<string, { icon: string; label: string }> = {
    cash: { icon: "💵", label: "Cash" },
    card: { icon: "💳", label: "Card" },
    athmovil: { icon: "📱", label: "ATH Móvil" },
  };

  const buildSplitNote = () => {
    const parts = activeSplitMethods.map(k => `${SPLIT_METHOD_LABELS[k].icon} ${SPLIT_METHOD_LABELS[k].label} ${fmt(splitParsed[k])}`);
    return `SPLIT: ${parts.join(" + ")}`;
  };

  const QUICK = (() => {
    const add = (result: number[], v: number) => {
      const r = Math.round(v * 100) / 100;
      if (r >= total && !result.includes(r)) result.push(r);
    };
    const result: number[] = [total];
    add(result, Math.ceil(total / 10) * 10);
    add(result, Math.ceil(total / 20) * 20);
    add(result, 50);
    add(result, 100);
    return result;
  })();

  const TABS = [
    { key: "cash", label: "Cash" },
    { key: "card", label: "Card" },
    { key: "athmovil", label: "ATH Móvil" },
    { key: "split", label: "✂ Split" },
  ] as const;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-200">
          <h2 className="text-gray-900 text-xl font-bold">Collect Payment</h2>
          <p className="text-[#F5A623] text-3xl font-black mt-1">{fmt(total)}</p>
        </div>

        {/* Method tabs */}
        <div className="flex border-b border-gray-200">
          {TABS.map(m => (
            <button key={m.key} onClick={() => { setTab(m.key as typeof tab); setSplitCollecting(false); }}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === m.key ? "text-[#F5A623] border-b-2 border-[#F5A623]" : "text-gray-500 hover:text-gray-900"}`}>
              {m.label}
            </button>
          ))}
        </div>

        <div className="p-5 overflow-y-auto max-h-[60vh]">
          {tab === "cash" && (
            <div>
              <p className="text-gray-500 text-sm mb-2">Amount tendered</p>
              <div className="bg-gray-100 rounded-xl p-3 text-gray-900 text-3xl font-mono font-bold text-right mb-3">
                ${tendered}
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                {QUICK.map(q => (
                  <button key={q} onClick={() => setTendered(String(q))}
                    className={`flex-1 min-w-[56px] h-10 rounded-xl text-sm font-semibold transition-colors ${
                      parseFloat(tendered) === q
                        ? "bg-[#F5A623] text-black"
                        : "bg-gray-100 hover:bg-gray-200 text-gray-900"
                    }`}>
                    {fmt(q)}
                  </button>
                ))}
              </div>
              <Numpad value={tendered} onChange={setTendered} />
              {parseFloat(tendered) >= total && (
                <div className="mt-4 bg-green-50 rounded-xl p-4 text-center">
                  <p className="text-gray-500 text-sm">Change due</p>
                  <p className="text-green-700 text-3xl font-black">{fmt(change)}</p>
                </div>
              )}
            </div>
          )}
          {tab === "card" && (
            <div className="text-center py-6">
              <div className="text-5xl mb-4">💳</div>
              <p className="text-gray-900 font-semibold mb-1">Swipe or tap card on terminal</p>
              <p className="text-gray-500 text-sm">Confirm payment of <span className="text-[#F5A623] font-bold">{fmt(total)}</span></p>
            </div>
          )}
          {tab === "athmovil" && (
            <div className="text-center py-6">
              <div className="text-5xl mb-4">📱</div>
              <p className="text-gray-900 font-semibold mb-1">ATH Móvil payment</p>
              <p className="text-gray-500 text-sm">Confirm receipt of <span className="text-[#F5A623] font-bold">{fmt(total)}</span></p>
            </div>
          )}
          {tab === "split" && !splitCollecting && (
            <div className="space-y-2">
              {/* Method selector rows — tap to activate */}
              {(["cash", "card", "athmovil"] as const).map(k => {
                const isActive = splitActive === k;
                const amt = splitParsed[k];
                return (
                  <button
                    key={k}
                    onClick={() => setSplitActive(k)}
                    className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 border transition-all ${isActive ? "border-[#F5A623] bg-[#F5A623]/10" : "border-gray-200 bg-gray-100 hover:border-gray-400"}`}
                  >
                    <span className="text-2xl">{SPLIT_METHOD_LABELS[k].icon}</span>
                    <span className={`font-semibold flex-1 text-left ${isActive ? "text-gray-900" : "text-gray-700"}`}>{SPLIT_METHOD_LABELS[k].label}</span>
                    <span className={`text-xl font-black font-mono ${amt > 0 ? (isActive ? "text-[#F5A623]" : "text-gray-900") : "text-gray-500"}`}>
                      {fmt(amt)}
                    </span>
                  </button>
                );
              })}
              {/* Remaining tracker */}
              <div className={`rounded-xl px-4 py-2.5 flex items-center justify-between ${splitReady ? "bg-green-50 border border-green-300" : "bg-gray-100 border border-gray-200"}`}>
                <span className="text-gray-500 text-sm font-semibold">
                  {splitReady ? "Ready!" : splitRemaining < 0 ? "Over by" : "Remaining"}
                </span>
                <span className={`text-lg font-black ${splitReady ? "text-green-700" : splitRemaining < 0 ? "text-red-600" : "text-gray-700"}`}>
                  {splitReady ? "✓ " + fmt(total) : fmt(Math.abs(splitRemaining))}
                </span>
              </div>
              {/* Numpad for active method */}
              <Numpad
                value={splitAmounts[splitActive]}
                onChange={v => setSplitAmounts(prev => ({ ...prev, [splitActive]: v }))}
              />
              {onSplit && (
                <button
                  onClick={() => { onClose(); onSplit(); }}
                  className="w-full h-10 rounded-xl border border-gray-200 text-gray-400 hover:text-gray-900 hover:border-gray-400 text-sm font-semibold transition-colors mt-1">
                  Switch to split by item instead
                </button>
              )}
            </div>
          )}
          {tab === "split" && splitCollecting && (
            <div className="space-y-3">
              <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold mb-1">Collect from customer</p>
              {activeSplitMethods.map(k => (
                <div key={k} className="flex items-center justify-between bg-gray-100 rounded-xl px-4 py-4 border border-gray-200">
                  <span className="text-gray-900 text-base font-semibold">{SPLIT_METHOD_LABELS[k].icon} {SPLIT_METHOD_LABELS[k].label}</span>
                  <span className="text-[#F5A623] text-2xl font-black">{fmt(splitParsed[k])}</span>
                </div>
              ))}
              {splitParsed.cash > 0 && (() => {
                const cashChange = Math.max(0, splitParsed.cash - (total - splitParsed.card - splitParsed.athmovil));
                return cashChange > 0.005 ? (
                  <div className="bg-green-50 rounded-xl px-4 py-3 flex items-center justify-between border border-green-300">
                    <span className="text-green-700 text-sm font-semibold">Cash change due</span>
                    <span className="text-green-700 text-xl font-black">{fmt(cashChange)}</span>
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-gray-200 flex gap-3">
          <button onClick={onClose} className="h-12 px-5 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-100 transition-colors">Cancel</button>
          {tab === "split" && !splitCollecting && (
            <button
              disabled={!splitReady}
              onClick={() => setSplitCollecting(true)}
              className="flex-1 h-12 rounded-xl bg-[#F5A623] hover:bg-[#E09520] disabled:opacity-30 disabled:cursor-not-allowed text-black font-black text-base transition-colors">
              ✂ Confirm Split
            </button>
          )}
          {tab === "split" && splitCollecting && (
            <button
              onClick={() => onPay("split", undefined, buildSplitNote())}
              className="flex-1 h-12 rounded-xl bg-green-500 hover:bg-green-400 text-black font-black text-base transition-colors">
              Mark as Paid
            </button>
          )}
          {tab !== "split" && (
            <div className="flex-1 flex flex-col gap-2">
              {onPayAndHold && (
                <button
                  disabled={tab === "cash" && parseFloat(tendered || "0") < total}
                  onClick={() => onPayAndHold(tab, tab === "cash" ? parseFloat(tendered) : undefined)}
                  className="w-full h-11 rounded-xl bg-amber-400 hover:bg-amber-500 disabled:opacity-30 disabled:cursor-not-allowed text-black font-bold text-sm transition-colors">
                  ⏸ Charge & Hold
                </button>
              )}
              <button
                disabled={tab === "cash" && parseFloat(tendered || "0") < total}
                onClick={() => onPay(tab, tab === "cash" ? parseFloat(tendered) : undefined)}
                className="w-full h-12 rounded-xl bg-green-500 hover:bg-green-400 disabled:opacity-30 disabled:cursor-not-allowed text-black font-black text-lg transition-colors">
                {onPayAndHold ? "✅ Charge & Complete" : `Charge ${fmt(total)}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Receipt Modal ────────────────────────────────────────────────────────────

function ReceiptModal({ order, tendered, onClose }: { order: Order; tendered?: number; onClose: () => void }) {
  const change = tendered != null ? Math.max(0, tendered - order.total) : null;
  const printRef = useRef<HTMLDivElement>(null);

  const print = () => {
    const win = window.open("", "_blank", "width=320,height=600");
    if (!win || !printRef.current) return;
    win.document.write(`<html><head><title>Receipt</title><style>
      body{font-family:monospace;font-size:12px;width:280px;margin:0 auto;padding:8px}
      .center{text-align:center} .bold{font-weight:bold} .line{border-top:1px dashed #000;margin:6px 0}
      .row{display:flex;justify-content:space-between;margin:2px 0}
      .total{font-size:14px;font-weight:bold}
    </style></head><body>${printRef.current.innerHTML}</body></html>`);
    win.document.close(); win.focus(); win.print(); win.close();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-gray-900 text-xl font-bold">Receipt</h2>
          <span className="text-green-700 font-semibold text-sm">✓ Order placed</span>
        </div>
        <div className="p-5 max-h-96 overflow-y-auto">
          <div ref={printRef} className="font-mono text-sm">
            <div className="text-center mb-3">
              <div className="font-bold text-base">ISLAND TACOS</div>
              <div className="text-gray-500 text-xs">Wickhams Cay 1, Road Town, BVI</div>
              <div className="text-gray-500 text-xs">(284) 000-0000</div>
            </div>
            <div className="border-t border-dashed border-gray-300 my-2"/>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>#{order.confirmationCode}</span>
              <span>{new Date(order.createdAt).toLocaleString()}</span>
            </div>
            {order.customerName && <div className="text-xs text-gray-500 mb-2">Customer: {order.customerName}</div>}
            <div className="border-t border-dashed border-gray-300 my-2"/>
            {order.items.map((item, i) => (
              <div key={i} className="mb-2">
                <div className="flex justify-between text-gray-900 text-sm">
                  <span>{item.quantity}× {item.menuItemName}</span>
                  <span>{fmt(item.subtotal)}</span>
                </div>
                {item.modifierSelections?.map((m, j) => (
                  <div key={j} className="flex justify-between text-gray-500 text-xs pl-4">
                    <span>+ {m.name}</span>
                    {m.price > 0 && <span>+{fmt(m.price)}</span>}
                  </div>
                ))}
                {item.notes && <div className="text-gray-400 text-xs pl-4">Note: {item.notes}</div>}
              </div>
            ))}
            <div className="border-t border-dashed border-gray-300 my-2"/>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-gray-700"><span>Subtotal</span><span>{fmt(order.subtotal)}</span></div>
              {order.discountAmount > 0 && <div className="flex justify-between text-green-700"><span>Discount</span><span>-{fmt(order.discountAmount)}</span></div>}
              {order.tax > 0 && <div className="flex justify-between text-gray-700"><span>Tax</span><span>{fmt(order.tax)}</span></div>}
              <div className="flex justify-between text-gray-900 font-bold text-base border-t border-gray-300 pt-1 mt-1">
                <span>TOTAL</span><span>{fmt(order.total)}</span>
              </div>
              <div className="flex justify-between text-gray-500 text-xs mt-1">
                <span>Payment</span>
                <span className="capitalize">{order.paymentMethod === "athmovil" ? "ATH Móvil" : order.paymentMethod}</span>
              </div>
              {tendered != null && <div className="flex justify-between text-gray-500 text-xs"><span>Tendered</span><span>{fmt(tendered)}</span></div>}
              {change != null && change > 0 && <div className="flex justify-between text-green-700 text-sm font-semibold"><span>Change</span><span>{fmt(change)}</span></div>}
            </div>
            <div className="border-t border-dashed border-gray-300 my-3"/>
            <div className="text-center text-gray-500 text-xs">
              <div>Gracias · Thank you!</div>
              <div className="mt-1">Order online at islandtacos.com</div>
            </div>
          </div>
        </div>
        <div className="p-5 border-t border-gray-200 flex gap-3">
          <button onClick={print} className="flex-1 h-12 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-100 flex items-center justify-center gap-2 transition-colors">
            🖨️ Print
          </button>
          <button onClick={onClose} className="flex-1 h-12 rounded-xl bg-[#F5A623] hover:bg-[#E09520] text-black font-bold transition-colors">
            New Order
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Hold Modal ───────────────────────────────────────────────────────────────

interface CustomerSuggestion { id: number; name: string; phone: string | null; email: string | null; }

function HoldModal({ initialName, initialNote, onHold, onClose }: {
  initialName: string; initialNote: string;
  onHold: (name: string, phone: string, note: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState(initialNote);
  const [suggestions, setSuggestions] = useState<CustomerSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const API = import.meta.env.BASE_URL.replace(/\/$/, "");

  useEffect(() => {
    const t = setTimeout(() => nameInputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (name.trim().length < 2) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${API}/api/customers?q=${encodeURIComponent(name.trim())}&limit=6`, { headers: authHeaders() });
        if (r.ok) { const d = await r.json(); setSuggestions(d); setShowSuggestions(true); }
      } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [name, API]);

  const fillCustomer = (c: CustomerSuggestion) => {
    setName(c.name);
    setPhone(c.phone ?? "");
    setSuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-200">
          <h2 className="text-gray-900 text-xl font-bold">Hold Ticket</h2>
          <p className="text-gray-500 text-sm mt-1">Save this order to resume and charge later.</p>
        </div>
        <div className="p-5 space-y-3">
          <div className="relative">
            <label className="text-gray-500 text-xs font-semibold uppercase tracking-wider block mb-1">Customer Name</label>
            <input
              ref={nameInputRef}
              value={name}
              onChange={e => { setName(e.target.value); setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="e.g. Maria"
              className="w-full bg-gray-100 border border-gray-200 focus:border-amber-400 rounded-xl px-4 py-2.5 text-gray-900 text-sm outline-none placeholder-gray-400"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-gray-100 border border-gray-200 rounded-xl shadow-2xl z-10 overflow-hidden">
                {suggestions.map(c => (
                  <button
                    key={c.id}
                    onMouseDown={() => fillCustomer(c)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-200 transition-colors border-b border-gray-200 last:border-b-0"
                  >
                    <p className="text-gray-900 text-sm font-semibold">{c.name}</p>
                    {(c.phone || c.email) && (
                      <p className="text-gray-500 text-xs mt-0.5">{c.phone ?? c.email}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-gray-500 text-xs font-semibold uppercase tracking-wider block mb-1">Phone (optional)</label>
            <input
              value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="e.g. 284-555-0100"
              type="tel"
              className="w-full bg-gray-100 border border-gray-200 focus:border-amber-400 rounded-xl px-4 py-2.5 text-gray-900 text-sm outline-none placeholder-gray-400"
            />
          </div>
          <div>
            <label className="text-gray-500 text-xs font-semibold uppercase tracking-wider block mb-1">Comment (optional)</label>
            <textarea
              value={note} onChange={e => setNote(e.target.value)}
              placeholder="Special instructions, table number…"
              className="w-full bg-gray-100 border border-gray-200 focus:border-amber-400 rounded-xl px-4 py-2.5 text-gray-900 text-sm outline-none resize-none h-20 placeholder-gray-400"
            />
          </div>
        </div>
        <div className="p-5 border-t border-gray-200 flex gap-3">
          <button onClick={onClose} className="flex-1 h-12 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-100 transition-colors">Cancel</button>
          <button
            onClick={() => onHold(name.trim(), phone.trim(), note.trim())}
            className="flex-1 h-12 rounded-xl bg-[#F5A623] hover:bg-[#E09520] text-black font-black transition-colors">
            🎫 Hold Ticket
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Discount Modal ───────────────────────────────────────────────────────────

function DiscountModal({ subtotal, onApply, onClose }: { subtotal: number; onApply: (amt: number) => void; onClose: () => void }) {
  const [type, setType] = useState<"pct" | "amt">("pct");
  const [val, setVal] = useState("0");
  const pct = parseFloat(val || "0");
  const discAmt = type === "pct" ? Math.round(subtotal * pct / 100 * 100) / 100 : Math.min(parseFloat(val || "0"), subtotal);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-xs shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-200">
          <h2 className="text-gray-900 text-xl font-bold">Apply Discount</h2>
        </div>
        <div className="p-5">
          <div className="flex gap-2 mb-4">
            <button onClick={() => setType("pct")} className={`flex-1 h-10 rounded-xl text-sm font-semibold transition-colors ${type === "pct" ? "bg-[#F5A623] text-black" : "bg-gray-100 text-gray-700"}`}>Percent %</button>
            <button onClick={() => setType("amt")} className={`flex-1 h-10 rounded-xl text-sm font-semibold transition-colors ${type === "amt" ? "bg-[#F5A623] text-black" : "bg-gray-100 text-gray-700"}`}>Amount $</button>
          </div>
          <div className="bg-gray-100 rounded-xl p-3 text-gray-900 text-3xl font-mono font-bold text-right mb-2">
            {type === "pct" ? `${val}%` : `$${val}`}
          </div>
          {discAmt > 0 && (
            <p className="text-green-700 text-sm text-center mb-2">Saves {fmt(discAmt)} off {fmt(subtotal)}</p>
          )}
          <div className="grid grid-cols-4 gap-2 mb-2">
            {(type === "pct" ? [5,10,15,20] : [1,2,5,10]).map(q => (
              <button key={q} onClick={() => setVal(String(q))}
                className="h-10 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-900 text-sm font-semibold transition-colors">
                {type === "pct" ? `${q}%` : fmt(q)}
              </button>
            ))}
          </div>
          <Numpad value={val} onChange={setVal} />
        </div>
        <div className="p-5 border-t border-gray-200 flex gap-3">
          <button onClick={onClose} className="flex-1 h-12 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-100 transition-colors">Cancel</button>
          <button onClick={() => { onApply(discAmt); onClose(); }} disabled={discAmt <= 0}
            className="flex-1 h-12 rounded-xl bg-[#F5A623] hover:bg-[#E09520] disabled:opacity-30 text-black font-bold transition-colors">
            Apply -{fmt(discAmt)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tickets Drawer (Held + Live Queue tabs) ─────────────────────────────────

function TicketsDrawer({ onResume, onClose, onPaymentComplete }: {
  onResume: (items: CartItem[], name: string, note: string, discount: number, orderId: number) => void;
  onClose: () => void;
  onPaymentComplete: (order: Order, tendered?: number) => void;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [chargeOrder, setChargeOrder] = useState<Order | null>(null);
  const [splitChargeOrder, setSplitChargeOrder] = useState<Order | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/orders", { credentials: "include" });
      const data: Order[] = await r.json();
      // Show all non-cancelled orders EXCEPT completed ones that are already paid —
      // completed+unpaid tickets must remain visible so staff can still edit/charge them.
      setOrders(data.filter(o => o.status !== "cancelled" && !(o.status === "completed" && o.paymentStatus === "paid")));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);

  // Real-time sync: any order change on another POS instance triggers an immediate reload
  useEffect(() => {
    const es = new EventSource("/api/pos/events", { withCredentials: true });
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as { type: string };
        if (msg.type === "order_created" || msg.type === "order_updated") load();
      } catch { /* ignore parse errors */ }
    };
    return () => es.close();
  }, [load]);

  const resume = (o: Order) => {
    // All items from a saved ticket were already sent to the KDS when first created.
    // Mark them all alreadyMade so re-submitting doesn't re-fire them to the kitchen.
    // Only brand-new items added after recall will be alreadyMade: false.
    const items: CartItem[] = o.items.map(i => ({
      key: uid(), menuItemId: i.menuItemId, name: i.menuItemName, price: i.menuItemPrice,
      quantity: i.quantity, notes: i.notes ?? "",
      modifierSelections: (i.modifierSelections ?? []) as CartModifier[],
      alreadyMade: true,
    }));
    onResume(items, o.customerName, o.notes ?? "", o.discountAmount, o.id);
    onClose();
  };

  // Push saved ticket to customer display when charging directly (without loading into cart)
  const chargeTicket = (o: Order) => {
    // DB returns numeric fields as strings — coerce everything to number before sending
    const n = (v: unknown) => parseFloat(String(v)) || 0;
    fetch("/api/display", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "active",
        items: o.items.map(i => ({
          name: i.menuItemName,
          quantity: i.quantity,
          unitPrice: n(i.menuItemPrice),
          modifiers: (i.modifierSelections ?? []).map(m => m.name),
        })),
        subtotal: n(o.subtotal),
        tax: n(o.tax),
        total: n(o.total),
        discountAmount: n(o.discountAmount) > 0 ? n(o.discountAmount) : undefined,
      }),
    }).catch(() => {});
    setChargeOrder(o);
  };

  const voidTicket = async (id: number) => {
    await fetch(`/api/orders/${id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    load();
  };

  const updateStatus = async (id: number, status: string) => {
    await fetch(`/api/orders/${id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  };

  const completeWithPayment = async (method: string, tendered?: number, splitNote?: string) => {
    if (!chargeOrder) return;
    const notes = splitNote
      ? (chargeOrder.notes ? `${chargeOrder.notes}\n${splitNote}` : splitNote)
      : chargeOrder.notes;
    await fetch(`/api/orders/${chargeOrder.id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      // Do NOT set status:"completed" here — the KDS owns order removal.
      // Payment only marks the order as paid; kitchen staff clear it when done.
      body: JSON.stringify({ actualPaymentMethod: method, paymentStatus: "paid", ...(notes ? { notes } : {}) }),
    });
    // Update customer display to "completed" state
    fetch("/api/display", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "completed",
        items: [],
        subtotal: 0,
        tax: 0,
        total: chargeOrder.total,
        paymentMethod: method,
        orderCode: chargeOrder.confirmationCode,
      }),
    }).catch(() => {});
    const paidOrder = { ...chargeOrder, paymentStatus: "paid", paymentMethod: method, ...(notes ? { notes } : {}) };
    setChargeOrder(null);
    onPaymentComplete(paidOrder, tendered);
  };

  const completeWithPaymentAndHold = async (method: string, tendered?: number, splitNote?: string) => {
    if (!chargeOrder) return;
    const notes = splitNote
      ? (chargeOrder.notes ? `${chargeOrder.notes}\n${splitNote}` : splitNote)
      : chargeOrder.notes;
    await fetch(`/api/orders/${chargeOrder.id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actualPaymentMethod: method, paymentStatus: "paid", ...(notes ? { notes } : {}) }),
    });
    setChargeOrder(null);
    load(); // ticket stays in list (status is still "confirmed", not "completed")
  };

  const completeOrder = async (id: number) => {
    await fetch(`/api/orders/${id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    load();
  };

  const completeWithSplit = async (_groups: SplitGroup[], note: string, order: Order) => {
    const existingNotes = order.notes ? `${order.notes}\n${note}` : note;
    await fetch(`/api/orders/${order.id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      // Do NOT set status:"completed" — KDS owns removal, payment only marks as paid.
      body: JSON.stringify({ actualPaymentMethod: "split", paymentStatus: "paid", notes: existingNotes }),
    });
    const paidOrder = { ...order, paymentStatus: "paid", paymentMethod: "split", notes: existingNotes };
    setSplitChargeOrder(null);
    onPaymentComplete(paidOrder);
  };

  const STATUS_COLOR: Record<string, string> = {
    pending: "text-yellow-400", confirmed: "text-blue-400",
    preparing: "text-orange-600", ready: "text-green-700",
  };
  const STATUS_LABEL: Record<string, string> = {
    pending: "New", confirmed: "Accepted", preparing: "Cooking", ready: "Ready",
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/70 flex justify-end z-50" onClick={onClose}>
        <div className="bg-white w-full max-w-sm h-full flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="p-5 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-gray-900 text-xl font-bold">Orders{orders.length > 0 ? ` (${orders.length})` : ""}</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-900 text-2xl">×</button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading && <p className="text-gray-400 text-center py-8">Loading…</p>}
            {!loading && orders.length === 0 && <p className="text-gray-400 text-center py-8">No active orders</p>}
            {!loading && orders.map(o => (
              <div key={o.id} className="bg-gray-100 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-gray-900 font-bold text-base leading-tight">{o.customerName || "Walk-in"}</p>
                    {o.customerPhone && (
                      <a href={`tel:${o.customerPhone}`} className="text-[#F5A623] text-sm font-semibold hover:underline leading-tight block mt-0.5">
                        📞 {o.customerPhone}
                      </a>
                    )}
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-gray-400 text-xs font-mono">#{o.confirmationCode}</span>
                      <span className={`text-xs font-semibold ${STATUS_COLOR[o.status] ?? "text-gray-500"}`}>
                        {STATUS_LABEL[o.status] ?? o.status}
                      </span>
                      {o.scheduledPickupAt && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 font-semibold">
                          ⏰ {new Date(o.scheduledPickupAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Puerto_Rico" })}
                        </span>
                      )}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${o.source === "pos" ? "bg-purple-50 text-purple-600" : o.source === "phone" ? "bg-green-50 text-green-700 font-bold" : "bg-blue-50 text-blue-600"}`}>
                        {o.source === "pos" ? "POS" : o.source === "phone" ? "📞 Phone" : "Online"}
                      </span>
                    </div>
                  </div>
                  <span className="text-[#F5A623] font-bold shrink-0">{fmt(o.total)}</span>
                </div>
                <div className="mb-2 space-y-0.5">
                  {o.items.map((i, idx) => {
                    const mods = i.modifierSelections?.length ? ` (${i.modifierSelections.map(m => m.name).join(", ")})` : "";
                    return (
                      <div key={idx} className="text-gray-500 text-xs leading-snug">
                        <span className="font-semibold text-gray-700">{i.quantity}×</span> {i.menuItemName}{mods}
                      </div>
                    );
                  })}
                </div>
                {o.notes && <p className="text-gray-500 text-xs italic mb-2">"{o.notes}"</p>}
                <div className="flex flex-wrap gap-2">
                  {o.status === "pending" && (o.source === "online" || o.source === "phone") && (
                    <>
                      <button onClick={() => updateStatus(o.id, "confirmed")} className="flex-1 h-10 rounded-lg bg-blue-600 hover:bg-blue-500 text-gray-900 text-sm font-semibold transition-colors">Accept</button>
                      <button onClick={() => updateStatus(o.id, "cancelled")} className="h-10 px-3 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold transition-colors">Reject</button>
                    </>
                  )}
                  {o.status === "confirmed" && (
                    <button onClick={() => updateStatus(o.id, "preparing")} className="flex-1 h-10 rounded-lg bg-orange-600 hover:bg-orange-500 text-gray-900 text-sm font-semibold transition-colors">Start Cooking</button>
                  )}
                  {o.status === "preparing" && (
                    <button onClick={() => updateStatus(o.id, "ready")} className="flex-1 h-10 rounded-lg bg-green-600 hover:bg-green-500 text-gray-900 text-sm font-semibold transition-colors">Mark Ready</button>
                  )}
                  {o.paymentStatus === "pending" && (
                    <button onClick={() => resume(o)} className="h-10 px-3 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-900 text-sm font-semibold transition-colors">Edit</button>
                  )}
                  {o.paymentStatus === "pending" ? (
                    <button onClick={() => chargeTicket(o)} className="flex-1 h-10 rounded-lg bg-[#F5A623] hover:bg-[#E09520] text-black text-sm font-bold transition-colors">
                      Charge {fmt(o.total)}
                    </button>
                  ) : (
                    <>
                      <span className="flex items-center gap-1 text-sm font-semibold text-green-700 bg-green-50 rounded-lg px-2 h-10">
                        ✓ Paid · {PAY_LABEL[o.paymentMethod] ?? o.paymentMethod}
                      </span>
                      <button onClick={() => completeOrder(o.id)} className="flex-1 h-10 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-900 text-sm font-semibold transition-colors">
                        Complete → Receipts
                      </button>
                    </>
                  )}
                  <button onClick={() => voidTicket(o.id)} className="h-10 px-3 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold transition-colors">Void</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {chargeOrder && (
        <PaymentModal
          total={chargeOrder.total}
          onPay={completeWithPayment}
          onPayAndHold={completeWithPaymentAndHold}
          onClose={() => setChargeOrder(null)}
          onSplit={() => { setSplitChargeOrder(chargeOrder); setChargeOrder(null); }}
          onTabChange={(tab) => {
            if (!chargeOrder) return;
            const n = (v: unknown) => parseFloat(String(v)) || 0;
            fetch("/api/display", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                status: "active",
                items: chargeOrder.items.map(i => ({
                  name: i.menuItemName,
                  quantity: i.quantity,
                  unitPrice: n(i.menuItemPrice),
                  modifiers: (i.modifierSelections ?? []).map(m => m.name),
                })),
                subtotal: n(chargeOrder.subtotal),
                tax: n(chargeOrder.tax),
                total: n(chargeOrder.total),
                discountAmount: n(chargeOrder.discountAmount) > 0 ? n(chargeOrder.discountAmount) : undefined,
                paymentMethod: tab === "athmovil" ? "athmovil" : undefined,
              }),
            }).catch(() => {});
          }}
        />
      )}

      {splitChargeOrder && (
        <SplitPaymentModal
          cart={splitChargeOrder.items.map(i => ({
            key: String(i.id),
            menuItemId: 0,
            name: i.menuItemName,
            price: i.menuItemPrice,
            quantity: i.quantity,
            notes: i.notes ?? "",
            modifierSelections: (i.modifierSelections ?? []) as CartModifier[],
          }))}
          total={splitChargeOrder.total}
          onConfirm={async (groups, note) => {
            await completeWithSplit(groups, note, splitChargeOrder);
          }}
          onClose={() => setSplitChargeOrder(null)}
        />
      )}
    </>
  );
}

// ─── Item Card ────────────────────────────────────────────────────────────────

function ItemCard({ item, onClick }: { item: MenuItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative text-left flex flex-col gap-1 rounded-2xl p-3 transition-all duration-150
        bg-white border border-gray-200 shadow-sm
        hover:-translate-y-1 hover:shadow-md hover:border-amber-300
        active:translate-y-0 active:scale-[0.98] active:shadow-sm"
    >
      {(item.posImageUrl ?? item.imageUrl) ? (
        <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-1 bg-gray-100">
          <RetryImg src={(item.posImageUrl ?? item.imageUrl)!} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>
        </div>
      ) : (
        <div className="w-full aspect-square rounded-xl mb-1 bg-gray-100 flex items-center justify-center">
          <span className="text-3xl opacity-25">🌮</span>
        </div>
      )}
      <div className="flex items-start justify-between gap-1">
        <span className="text-gray-900 text-sm font-semibold leading-tight line-clamp-2">{item.name}</span>
        <div className="flex gap-0.5 flex-shrink-0">
          {item.spicy && <span title="Spicy" className="text-xs">🌶</span>}
          {item.vegetarian && <span title="Vegetarian" className="text-xs">🥗</span>}
          {item.popular && <span title="Popular" className="text-xs">⭐</span>}
        </div>
      </div>
      <span className="text-amber-500 font-bold text-sm">{fmt(item.price)}</span>
    </button>
  );
}

// ─── Receipts Drawer ─────────────────────────────────────────────────────────

function ReceiptsDrawer({ onClose }: { onClose: () => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"today" | "all">("today");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundMethod, setRefundMethod] = useState("cash");
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [refundSuccess, setRefundSuccess] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState<"idle" | "sent" | "error">("idle");
  const [emailError, setEmailError] = useState("");
  const [refiring, setRefiring] = useState(false);
  const [refireStatus, setRefireStatus] = useState<"idle" | "sent" | "error">("idle");

  useEffect(() => {
    fetch("/api/orders", { credentials: "include" })
      .then(r => r.json())
      .then((data: Order[]) => {
        const done = data
          .filter(o => o.paymentStatus === "paid" || o.status === "completed")
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setOrders(done);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toDateString();
  const q = search.trim().toLowerCase();
  const visible = orders
    .filter(o => filter === "today" ? new Date(o.createdAt).toDateString() === today : true)
    .filter(o => {
      if (!q) return true;
      if ((o.customerName ?? "").toLowerCase().includes(q)) return true;
      if ((o.customerPhone ?? "").toLowerCase().includes(q)) return true;
      if (o.items.some(i => i.menuItemName.toLowerCase().includes(q))) return true;
      return false;
    });

  const totalRevenue = visible.reduce((s, o) => s + o.total, 0);

  if (selected) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
        <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="p-5 border-b border-gray-200 flex items-center justify-between">
            <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-gray-900 text-sm">← Back</button>
            <h2 className="text-gray-900 text-lg font-bold">Receipt #{selected.confirmationCode}</h2>
            <div/>
          </div>
          <div className="p-5 max-h-[70vh] overflow-y-auto font-mono text-sm">
            <div className="text-center mb-3">
              <div className="font-bold text-base text-gray-900">ISLAND TACOS</div>
              <div className="text-gray-500 text-xs">Wickhams Cay 1, Road Town, BVI</div>
            </div>
            <div className="border-t border-dashed border-gray-300 my-2"/>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>#{selected.confirmationCode}</span>
              <span>{new Date(selected.createdAt).toLocaleString()}</span>
            </div>
            <div className="text-xs text-gray-500 mb-0.5">Customer: {selected.customerName || "Walk-in"}</div>
            {selected.customerPhone && <div className="text-xs text-gray-500 mb-0.5">Phone: {selected.customerPhone}</div>}
            <div className="text-xs text-gray-500 mb-2">Payment: {PAY_LABEL[selected.paymentMethod] ?? selected.paymentMethod}</div>
            <div className="border-t border-dashed border-gray-300 my-2"/>
            {selected.items.map((item, i) => (
              <div key={i} className="mb-2">
                <div className="flex justify-between text-gray-900 text-sm">
                  <span>{item.quantity}× {item.menuItemName}</span>
                  <span>{fmt(item.subtotal)}</span>
                </div>
                {item.modifierSelections?.map((m, j) => (
                  <div key={j} className="flex justify-between text-gray-500 text-xs pl-4">
                    <span>+ {m.name}</span>
                    {m.price > 0 && <span>+{fmt(m.price)}</span>}
                  </div>
                ))}
                {item.notes && <div className="text-gray-400 text-xs pl-4">Note: {item.notes}</div>}
              </div>
            ))}
            <div className="border-t border-dashed border-gray-300 my-2"/>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-gray-700"><span>Subtotal</span><span>{fmt(selected.subtotal)}</span></div>
              {selected.discountAmount > 0 && <div className="flex justify-between text-green-700"><span>Discount</span><span>-{fmt(selected.discountAmount)}</span></div>}
              {selected.tax > 0 && <div className="flex justify-between text-gray-700"><span>Tax</span><span>{fmt(selected.tax)}</span></div>}
              <div className="flex justify-between text-gray-900 font-bold text-base border-t border-gray-300 pt-1 mt-1">
                <span>TOTAL</span><span>{fmt(selected.total)}</span>
              </div>
            </div>
            <div className="border-t border-dashed border-gray-300 my-3"/>
            <div className="text-center text-gray-400 text-xs">Thank you!</div>
          </div>
          <div className="p-4 border-t border-gray-200 space-y-2">
            {printError && <p className="text-red-600 text-xs text-center">{printError}</p>}
            {refundSuccess && <p className="text-green-700 text-xs text-center">✓ Refund recorded</p>}
            {emailStatus === "sent" && <p className="text-green-700 text-xs text-center">✓ Receipt emailed!</p>}
            {emailStatus === "error" && <p className="text-red-600 text-xs text-center">Email failed: {emailError}</p>}
            {refireStatus === "sent" && <p className="text-green-700 text-xs text-center">✓ Re-fired to KDS</p>}
            {refireStatus === "error" && <p className="text-red-600 text-xs text-center">Re-fire failed — try again</p>}
            <button
              disabled={refiring}
              onClick={async () => {
                setRefiring(true);
                setRefireStatus("idle");
                try {
                  const r = await fetch(`/api/orders/${selected.id}`, {
                    method: "PATCH",
                    credentials: "include",
                    headers: { "Content-Type": "application/json", ...authHeaders() },
                    body: JSON.stringify({ status: "ready", kdsCleared: false }),
                  });
                  if (r.ok) setRefireStatus("sent");
                  else setRefireStatus("error");
                } catch {
                  setRefireStatus("error");
                } finally {
                  setRefiring(false);
                }
              }}
              className="w-full h-10 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-300 text-purple-700 text-sm font-bold transition-colors disabled:opacity-50"
            >
              {refiring ? "Sending…" : "🔁 Re-fire to KDS"}
            </button>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  setPrinting(true); setPrintError(null);
                  const result = await printReceiptLines(buildReceiptLines(selected));
                  if (!result.ok) setPrintError(result.error ?? "Print failed");
                  setPrinting(false);
                }}
                disabled={printing}
                className="flex-1 h-11 rounded-xl bg-[#F5A623] hover:bg-[#E09520] text-black font-bold transition-colors disabled:opacity-50"
              >
                {printing ? "Printing…" : "🖨 Print"}
              </button>
              <button
                onClick={() => {
                  setEmailOpen(o => !o);
                  setEmailAddress(selected.customerEmail || "");
                  setEmailStatus("idle");
                }}
                className="flex-1 h-11 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-600 font-bold transition-colors"
              >
                ✉ Email
              </button>
              <button
                onClick={() => { setRefundOpen(o => !o); setRefundAmount(selected.total.toFixed(2)); }}
                className="h-11 px-3 rounded-xl bg-red-100 hover:bg-red-100 border border-red-300 text-red-600 font-bold transition-colors"
              >
                ↩
              </button>
            </div>
            {emailOpen && (
              <div className="bg-gray-100 rounded-xl p-4 space-y-2 border border-blue-900/40">
                <p className="text-blue-600 text-sm font-semibold">Email Receipt</p>
                <input
                  type="email"
                  placeholder="customer@email.com"
                  value={emailAddress}
                  onChange={e => setEmailAddress(e.target.value)}
                  className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 text-sm outline-none focus:border-blue-500"
                />
                <button
                  disabled={emailSending || !emailAddress}
                  onClick={async () => {
                    setEmailSending(true); setEmailStatus("idle");
                    try {
                      const r = await fetch(`/api/orders/${selected.id}/email-receipt`, {
                        method: "POST", credentials: "include",
                        headers: { "Content-Type": "application/json", ...authHeaders() },
                        body: JSON.stringify({ toEmail: emailAddress }),
                      });
                      const data = await r.json();
                      if (data.ok) { setEmailStatus("sent"); setEmailOpen(false); }
                      else { setEmailStatus("error"); setEmailError(data.error ?? "Unknown error"); }
                    } catch (e) {
                      setEmailStatus("error"); setEmailError(String(e));
                    }
                    setEmailSending(false);
                  }}
                  className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-500 text-gray-900 font-bold transition-colors disabled:opacity-50"
                >
                  {emailSending ? "Sending…" : `Send to ${emailAddress || "…"}`}
                </button>
              </div>
            )}
            {selected.customerPhone && (
              <div className="flex gap-2">
                <a
                  href={`tel:${selected.customerPhone}`}
                  className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-600 text-sm font-bold transition-colors"
                >
                  📞 Call
                </a>
                <a
                  href={`https://wa.me/${selected.customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi ${selected.customerName}, your Island Tacos order #${selected.confirmationCode} is ready for pickup! 🌮`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl bg-green-50 hover:bg-green-100 border border-green-300 text-green-700 text-sm font-bold transition-colors"
                >
                  💬 WhatsApp
                </a>
              </div>
            )}
            {refundOpen && (
              <div className="bg-gray-100 rounded-xl p-4 space-y-3 border border-red-900/40">
                <p className="text-red-600 text-sm font-semibold">Issue Refund</p>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-gray-500 text-xs mb-1 block">Amount</label>
                    <input type="number" step="0.01" value={refundAmount} onChange={e => setRefundAmount(e.target.value)}
                      className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 text-sm outline-none" />
                  </div>
                  <div className="flex-1">
                    <label className="text-gray-500 text-xs mb-1 block">Method</label>
                    <select value={refundMethod} onChange={e => setRefundMethod(e.target.value)}
                      className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 text-sm outline-none">
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="athmovil">ATH Móvil</option>
                    </select>
                  </div>
                </div>
                <input type="text" placeholder="Reason (optional)" value={refundReason} onChange={e => setRefundReason(e.target.value)}
                  className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 text-sm outline-none" />
                <button disabled={refundSubmitting || !refundAmount}
                  onClick={async () => {
                    setRefundSubmitting(true);
                    await fetch(`/api/orders/${selected.id}/refund`, {
                      method: "POST", credentials: "include",
                      headers: { "Content-Type": "application/json", ...authHeaders() },
                      body: JSON.stringify({ amount: parseFloat(refundAmount), reason: refundReason, refundMethod }),
                    });
                    setRefundOpen(false); setRefundSuccess(true); setRefundSubmitting(false);
                    setTimeout(() => onClose(), 1500);
                  }}
                  className="w-full h-10 rounded-xl bg-red-600 hover:bg-red-500 text-gray-900 font-bold transition-colors disabled:opacity-50">
                  {refundSubmitting ? "Processing…" : `Confirm Refund ${refundAmount ? fmt(parseFloat(refundAmount)) : ""}`}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex justify-end z-50" onClick={onClose}>
      <div className="bg-white w-full max-w-sm h-full flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-gray-900 text-xl font-bold">Receipts</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 text-2xl leading-none">×</button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 px-4 pt-3 pb-2">
          {(["today", "all"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`flex-1 h-10 rounded-lg text-sm font-semibold transition-colors ${filter === f ? "bg-[#F5A623] text-black" : "bg-gray-100 text-gray-500 hover:text-gray-900"}`}>
              {f === "today" ? "Today" : "All Time"}
            </button>
          ))}
        </div>

        {/* Search bar */}
        <div className="px-4 pb-2">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">🔍</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Name, phone, or item…"
              className="w-full h-10 pl-8 pr-8 bg-gray-100 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F5A623]"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-lg leading-none"
              >×</button>
            )}
          </div>
        </div>

        {/* Summary bar */}
        {!loading && visible.length > 0 && (
          <div className="mx-4 mb-2 px-4 py-2 bg-gray-100 rounded-xl flex justify-between text-sm">
            <span className="text-gray-500">{visible.length} order{visible.length !== 1 ? "s" : ""}</span>
            <span className="text-[#F5A623] font-bold">{fmt(totalRevenue)}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && <p className="text-gray-400 text-center py-8">Loading…</p>}
          {!loading && visible.length === 0 && (
            <p className="text-gray-400 text-center py-8">
              {q ? `No orders matching "${search}"` : filter === "today" ? "No completed orders today" : "No completed orders yet"}
            </p>
          )}
          {visible.map(o => (
            <button key={o.id} onClick={() => { setSelected(o); setRefireStatus("idle"); }}
              className="w-full bg-gray-100 hover:bg-gray-200 rounded-xl p-4 text-left transition-colors">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <span className="text-gray-900 font-bold text-sm">{o.customerName || "Walk-in"}</span>
                  <span className="ml-2 text-gray-500 text-xs">#{o.confirmationCode}</span>
                </div>
                <span className="text-[#F5A623] font-bold">{fmt(o.total)}</span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-gray-400 text-xs">
                  {o.items.map(i => {
                    const mods = i.modifierSelections?.length ? ` (${i.modifierSelections.map(m => m.name).join(", ")})` : "";
                    return `${i.quantity}× ${i.menuItemName}${mods}`;
                  }).join(" • ")}
                </p>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-gray-500 text-xs">{new Date(o.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{PAY_LABEL[o.paymentMethod] ?? o.paymentMethod}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── 86 List / Sold-Out Drawer ────────────────────────────────────────────────

type SoldOutItem = { id: number; name: string; categoryId: number; available: boolean };
type SoldOutModifier = {
  id: number; name: string;
  options: { id: string; name: string; price: number }[];
  unavailableOptionIds: string[];
};
type SoldOutCategory = { id: number; name: string };
type SoldOutData = { items: SoldOutItem[]; modifiers: SoldOutModifier[]; categories: SoldOutCategory[] };

function SoldOutDrawer({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<SoldOutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [quickSearch, setQuickSearch] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/menu/soldout", { credentials: "include", headers: authHeaders() });
      if (r.ok) setData(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleItem = async (item: SoldOutItem) => {
    const key = `item-${item.id}`;
    setToggling(key);
    const newVal = !item.available;
    try {
      const r = await fetch(`/api/menu/soldout/item/${item.id}`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ available: newVal }),
      });
      if (r.ok) {
        setData(prev => prev ? {
          ...prev,
          items: prev.items.map(i => i.id === item.id ? { ...i, available: newVal } : i),
        } : prev);
      }
    } finally { setToggling(null); }
  };

  const toggleOption = async (mod: SoldOutModifier, optionId: string) => {
    const key = `opt-${mod.id}-${optionId}`;
    setToggling(key);
    const isCurrentlyUnavailable = mod.unavailableOptionIds.includes(optionId);
    const newAvailable = isCurrentlyUnavailable; // toggling: if unavailable → make available
    try {
      const r = await fetch("/api/menu/soldout/modifier-option", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ modifierId: mod.id, optionId, available: newAvailable }),
      });
      if (r.ok) {
        setData(prev => prev ? {
          ...prev,
          modifiers: prev.modifiers.map(m => m.id !== mod.id ? m : {
            ...m,
            unavailableOptionIds: newAvailable
              ? m.unavailableOptionIds.filter(id => id !== optionId)
              : [...m.unavailableOptionIds, optionId],
          }),
        } : prev);
      }
    } finally { setToggling(null); }
  };

  const itemsByCategory = data
    ? data.categories.map(cat => ({
        cat,
        items: data.items.filter(i => i.categoryId === cat.id),
      })).filter(g => g.items.length > 0)
    : [];

  const soldOutItemCount = data ? data.items.filter(i => !i.available).length : 0;
  const soldOutOptCount = data ? data.modifiers.reduce((s, m) => s + m.unavailableOptionIds.length, 0) : 0;
  const totalSoldOut = soldOutItemCount + soldOutOptCount;

  // ── Bulk / Quick-mark helpers ──────────────────────────────────────────────
  const qTerm = quickSearch.trim().toLowerCase();
  const bulkMatchItems = qTerm && data
    ? data.items.filter(i => i.name.toLowerCase().includes(qTerm))
    : [];
  const bulkMatchOptions: { mod: SoldOutModifier; optionId: string }[] = qTerm && data
    ? data.modifiers.flatMap(m =>
        (m.options as { id: string; name: string; price: number }[])
          .filter(o => o.name.toLowerCase().includes(qTerm))
          .map(o => ({ mod: m, optionId: o.id }))
      )
    : [];
  const bulkTotal = bulkMatchItems.length + bulkMatchOptions.length;

  const bulkMark = async (available: boolean) => {
    if (!bulkTotal || bulkBusy) return;
    setBulkBusy(true);
    try {
      await Promise.all([
        ...bulkMatchItems.map(item =>
          fetch(`/api/menu/soldout/item/${item.id}`, {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify({ available }),
          })
        ),
        ...bulkMatchOptions.map(({ mod, optionId }) =>
          fetch("/api/menu/soldout/modifier-option", {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify({ modifierId: mod.id, optionId, available }),
          })
        ),
      ]);
      await load();
      setQuickSearch("");
    } finally { setBulkBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-stretch justify-end" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-red-50">
          <div>
            <h2 className="text-lg font-bold text-gray-900">🚫 Sold Out List</h2>
            {totalSoldOut > 0 ? (
              <p className="text-xs text-red-600 font-medium mt-0.5">{totalSoldOut} item{totalSoldOut !== 1 ? "s" : ""} currently sold out</p>
            ) : (
              <p className="text-xs text-gray-400 mt-0.5">Everything is available</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none px-1"
          >×</button>
        </div>

        {/* Quick Mark by keyword */}
        {!loading && data && (
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Quick Mark</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={quickSearch}
                onChange={e => setQuickSearch(e.target.value)}
                placeholder='e.g. "Steak" or "Shrimp"'
                className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-300"
              />
            </div>
            {qTerm && (
              <div className="mt-2">
                {bulkTotal > 0 ? (
                  <>
                    <p className="text-xs text-gray-500 mb-2">
                      Found <span className="font-bold text-gray-800">{bulkTotal}</span> match{bulkTotal !== 1 ? "es" : ""}
                      {bulkMatchItems.length > 0 && ` (${bulkMatchItems.length} item${bulkMatchItems.length !== 1 ? "s" : ""})`}
                      {bulkMatchOptions.length > 0 && ` · ${bulkMatchOptions.length} modifier option${bulkMatchOptions.length !== 1 ? "s" : ""}`}
                    </p>
                    <div className="flex gap-2">
                      <button
                        disabled={bulkBusy}
                        onClick={() => bulkMark(false)}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm font-bold py-2 rounded-lg transition-colors disabled:opacity-40"
                      >
                        {bulkBusy ? "Marking…" : "🚫 Mark All Sold Out"}
                      </button>
                      <button
                        disabled={bulkBusy}
                        onClick={() => bulkMark(true)}
                        className="flex-1 bg-green-500 hover:bg-green-600 text-white text-sm font-bold py-2 rounded-lg transition-colors disabled:opacity-40"
                      >
                        {bulkBusy ? "…" : "✓ Restore All"}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-gray-400 italic">No items or options match "{qTerm}"</p>
                )}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
        ) : !data ? (
          <div className="flex-1 flex items-center justify-center text-red-500 text-sm">Failed to load</div>
        ) : (
          <div className="flex-1 overflow-y-auto">

            {/* ── Menu Items ── */}
            <div className="px-4 pt-4 pb-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Menu Items</p>
              {itemsByCategory.map(({ cat, items }) => (
                <div key={cat.id} className="mb-4">
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">{cat.name}</p>
                  <div className="space-y-1.5">
                    {items.map(item => {
                      const isSoldOut = !item.available;
                      const busy = toggling === `item-${item.id}`;
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center justify-between rounded-xl px-3 py-2.5 border transition-colors ${
                            isSoldOut
                              ? "bg-red-50 border-red-200"
                              : "bg-gray-50 border-gray-200"
                          }`}
                        >
                          <span className={`text-sm font-medium flex-1 mr-2 ${isSoldOut ? "line-through text-red-400" : "text-gray-800"}`}>
                            {item.name}
                            {isSoldOut && <span className="ml-2 text-xs font-bold text-red-500 no-underline" style={{ textDecoration: "none" }}>OUT</span>}
                          </span>
                          <button
                            disabled={busy}
                            onClick={() => toggleItem(item)}
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors min-w-[80px] text-center ${
                              isSoldOut
                                ? "bg-green-100 text-green-700 hover:bg-green-200"
                                : "bg-red-100 text-red-700 hover:bg-red-200"
                            } disabled:opacity-40`}
                          >
                            {busy ? "…" : isSoldOut ? "Restore" : "Sold Out"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Divider */}
            {data.modifiers.length > 0 && (
              <div className="h-px bg-gray-200 mx-4 my-2" />
            )}

            {/* ── Modifier Options ── */}
            {data.modifiers.length > 0 && (
              <div className="px-4 pt-2 pb-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Modifier Options</p>
                {data.modifiers.map(mod => (
                  <div key={mod.id} className="mb-4">
                    <p className="text-xs font-semibold text-gray-500 mb-1.5">{mod.name}</p>
                    <div className="space-y-1.5">
                      {(mod.options as { id: string; name: string; price: number }[]).map(opt => {
                        const isSoldOut = mod.unavailableOptionIds.includes(opt.id);
                        const busy = toggling === `opt-${mod.id}-${opt.id}`;
                        return (
                          <div
                            key={opt.id}
                            className={`flex items-center justify-between rounded-xl px-3 py-2.5 border transition-colors ${
                              isSoldOut
                                ? "bg-red-50 border-red-200"
                                : "bg-gray-50 border-gray-200"
                            }`}
                          >
                            <span className={`text-sm flex-1 mr-2 ${isSoldOut ? "line-through text-red-400" : "text-gray-700"}`}>
                              {opt.name}
                              {opt.price > 0 && <span className="text-gray-400 text-xs ml-1">+${opt.price.toFixed(2)}</span>}
                              {isSoldOut && <span className="ml-2 text-xs font-bold text-red-500" style={{ textDecoration: "none" }}>OUT</span>}
                            </span>
                            <button
                              disabled={busy}
                              onClick={() => toggleOption(mod, opt.id)}
                              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors min-w-[80px] text-center ${
                                isSoldOut
                                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                                  : "bg-red-100 text-red-700 hover:bg-red-200"
                              } disabled:opacity-40`}
                            >
                              {busy ? "…" : isSoldOut ? "Restore" : "Sold Out"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}

// ─── Open Shift Modal ────────────────────────────────────────────────────────

function OpenShiftModal({ onOpen }: { onOpen: (shift: Shift) => void }) {
  const [float, setFloat] = useState("0");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = async () => {
    setSubmitting(true); setError(null);
    try {
      const r = await fetch("/api/shifts", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ openingFloat: parseFloat(float) || 0, notes: notes || undefined }),
      });
      if (!r.ok) { const d = await r.json(); setError(d.error ?? "Failed to open shift"); setSubmitting(false); return; }
      const shift = await r.json();
      onOpen(shift);
    } catch { setError("Network error"); setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🏪</div>
          <h2 className="text-gray-900 text-xl font-bold">Open Shift</h2>
          <p className="text-gray-500 text-sm mt-1">Count your starting cash before opening</p>
        </div>
        <div className="mb-4">
          <label className="text-gray-500 text-xs font-medium mb-2 block">Starting Cash Float</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg font-bold">$</span>
            <input type="number" step="0.01" min="0" value={float} onChange={e => setFloat(e.target.value)}
              className="w-full bg-gray-100 border border-gray-200 focus:border-amber-400 rounded-xl pl-8 pr-4 py-3 text-gray-900 text-xl font-mono font-bold outline-none" />
          </div>
        </div>
        <div className="mb-5">
          <label className="text-gray-500 text-xs font-medium mb-2 block">Notes (optional)</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. regular Tuesday shift"
            className="w-full bg-gray-100 border border-gray-200 focus:border-amber-400 rounded-xl px-4 py-2.5 text-gray-900 text-sm outline-none placeholder-gray-400" />
        </div>
        {error && <p className="text-red-600 text-sm text-center mb-3">{error}</p>}
        <div className="flex gap-2">
          <button onClick={handleOpen} disabled={submitting}
            className="flex-1 h-12 rounded-xl bg-[#F5A623] hover:bg-[#E09520] text-black font-bold transition-colors disabled:opacity-50">
            {submitting ? "Opening…" : "Open Shift"}
          </button>
          <button onClick={() => onOpen({ id: 0, openedAt: new Date().toISOString(), closedAt: null, openingFloat: 0, closingFloat: null, notes: null })}
            className="px-4 h-12 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 text-sm transition-colors">
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Close Shift Modal ────────────────────────────────────────────────────────

function CloseShiftModal({ shift, onClose }: { shift: Shift; onClose: () => void }) {
  type Summary = { totalOrders: number; totalSales: number; byMethod: { cash: number; card: number; athmovil: number }; refundTotal: number; netSales: number; payIns: number; payOuts: number; expectedCash: number; cashTransactions: CashTxn[] };
  const [summary, setSummary] = useState<Summary | null>(null);
  const [closingFloat, setClosingFloat] = useState("");
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState(false);
  const [printingZ, setPrintingZ] = useState(false);

  useEffect(() => {
    if (shift.id === 0) return;
    fetch(`/api/shifts/${shift.id}/summary`, { credentials: "include", headers: authHeaders() })
      .then(r => r.json()).then(d => { setSummary(d); }).catch(() => {});
  }, [shift.id]);

  const handleClose = async () => {
    setClosing(true);
    await fetch(`/api/shifts/${shift.id}/close`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ closingFloat: closingFloat ? parseFloat(closingFloat) : undefined }),
    });
    setClosed(true); setClosing(false);
  };

  const printZReport = async () => {
    if (!summary) return;
    setPrintingZ(true);
    const lines: Parameters<typeof printReceiptLines>[0] = [
      { text: "ISLAND TACOS", bold: true, center: true, size: "large" },
      { text: "Wickhams Cay 1, Road Town, BVI", center: true },
      { divider: true, text: "" },
      { text: "Z-REPORT — END OF SHIFT", bold: true, center: true },
      { text: new Date().toLocaleString(), center: true },
      { divider: true, text: "" },
      { text: `Opened: ${new Date(shift.openedAt).toLocaleString()}` },
      { text: `Closed: ${new Date().toLocaleString()}` },
      { divider: true, text: "" },
      { text: `Total Orders: ${summary.totalOrders}`, bold: true },
      { text: `Gross Sales: ${fmt(summary.totalSales)}`, bold: true },
      { text: `Cash Sales: ${fmt(summary.byMethod.cash)}` },
      { text: `Card Sales: ${fmt(summary.byMethod.card)}` },
      { text: `ATH Movil: ${fmt(summary.byMethod.athmovil)}` },
      { divider: true, text: "" },
      { text: `Refunds: -${fmt(summary.refundTotal)}` },
      { text: `Net Sales: ${fmt(summary.netSales)}`, bold: true, size: "large" },
      { divider: true, text: "" },
      { text: `Opening Float: ${fmt(shift.openingFloat)}` },
      { text: `Pay Ins: +${fmt(summary.payIns)}` },
      { text: `Pay Outs: -${fmt(summary.payOuts)}` },
      { text: `Expected Cash: ${fmt(summary.expectedCash)}`, bold: true },
      ...(closingFloat ? [{ text: `Actual Cash: ${fmt(parseFloat(closingFloat))}` }, { text: `Difference: ${fmt(parseFloat(closingFloat) - summary.expectedCash)}` }] : []),
      { divider: true, text: "" },
      { text: "Thank you!", center: true },
    ];
    await printReceiptLines(lines);
    setPrintingZ(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={closed ? onClose : undefined}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-gray-900 text-lg font-bold">{closed ? "Shift Closed" : "Close Shift"}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 text-2xl leading-none">×</button>
        </div>
        <div className="p-5 max-h-[70vh] overflow-y-auto">
          {summary ? (
            <div className="space-y-3 font-mono text-sm">
              <div className="bg-gray-100 rounded-xl p-4 space-y-1.5">
                <div className="flex justify-between"><span className="text-gray-500">Total Orders</span><span className="text-gray-900">{summary.totalOrders}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Cash Sales</span><span className="text-gray-900">{fmt(summary.byMethod.cash)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Card Sales</span><span className="text-gray-900">{fmt(summary.byMethod.card)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">ATH Móvil</span><span className="text-gray-900">{fmt(summary.byMethod.athmovil)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Refunds</span><span className="text-red-600">-{fmt(summary.refundTotal)}</span></div>
                <div className="flex justify-between border-t border-gray-200 pt-1.5 mt-1"><span className="text-gray-900 font-bold">Net Sales</span><span className="text-[#F5A623] font-bold text-base">{fmt(summary.netSales)}</span></div>
              </div>
              <div className="bg-gray-100 rounded-xl p-4 space-y-1.5">
                <div className="flex justify-between"><span className="text-gray-500">Opening Float</span><span className="text-gray-900">{fmt(shift.openingFloat)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Pay Ins</span><span className="text-green-700">+{fmt(summary.payIns)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Pay Outs</span><span className="text-red-600">-{fmt(summary.payOuts)}</span></div>
                <div className="flex justify-between border-t border-gray-200 pt-1.5"><span className="text-gray-700">Expected Cash</span><span className="text-gray-900 font-bold">{fmt(summary.expectedCash)}</span></div>
              </div>
              {!closed && (
                <div>
                  <label className="text-gray-500 text-xs mb-1 block">Actual cash in drawer (optional)</label>
                  <input type="number" step="0.01" value={closingFloat} onChange={e => setClosingFloat(e.target.value)}
                    placeholder={fmt(summary.expectedCash)}
                    className="w-full bg-gray-100 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 text-sm font-mono outline-none" />
                  {closingFloat && <p className={`text-xs mt-1 ${parseFloat(closingFloat) - summary.expectedCash >= 0 ? "text-green-700" : "text-red-600"}`}>
                    Difference: {parseFloat(closingFloat) - summary.expectedCash >= 0 ? "+" : ""}{fmt(parseFloat(closingFloat) - summary.expectedCash)}
                  </p>}
                </div>
              )}
              {closed && <div className="text-center text-green-700 font-bold text-lg py-2">✓ Shift Closed</div>}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">Loading summary…</p>
          )}
        </div>
        <div className="p-4 border-t border-gray-200 flex gap-2">
          <button onClick={printZReport} disabled={printingZ || !summary}
            className="flex-1 h-11 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-900 text-sm font-semibold transition-colors disabled:opacity-50">
            {printingZ ? "Printing…" : "🖨 Print Z-Report"}
          </button>
          {!closed && (
            <button onClick={handleClose} disabled={closing}
              className="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-500 text-gray-900 font-bold transition-colors disabled:opacity-50">
              {closing ? "Closing…" : "Close Shift"}
            </button>
          )}
          {closed && (
            <button onClick={onClose} className="flex-1 h-11 rounded-xl bg-[#F5A623] hover:bg-[#E09520] text-black font-bold transition-colors">
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Pay In / Out Modal ────────────────────────────────────────────────────────

function PayInOutModal({ shiftId, onClose }: { shiftId: number | null; onClose: () => void }) {
  const [type, setType] = useState<"pay_in" | "pay_out">("pay_in");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [transactions, setTransactions] = useState<CashTxn[]>([]);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const url = shiftId ? `/api/cash-transactions?shiftId=${shiftId}` : "/api/cash-transactions";
    fetch(url, { credentials: "include", headers: authHeaders() })
      .then(r => r.json()).then(setTransactions).catch(() => {});
  }, [shiftId]);

  const submit = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setSubmitting(true);
    await fetch("/api/cash-transactions", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ shiftId, type, amount: parseFloat(amount), note: note || undefined }),
    });
    const msg = `${type === "pay_in" ? "Pay In" : "Pay Out"} ${fmt(parseFloat(amount))} recorded`;
    setSuccess(msg); setAmount(""); setNote(""); setSubmitting(false);
    const url = shiftId ? `/api/cash-transactions?shiftId=${shiftId}` : "/api/cash-transactions";
    fetch(url, { credentials: "include", headers: authHeaders() })
      .then(r => r.json()).then(setTransactions).catch(() => {});
    setTimeout(() => setSuccess(null), 3000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-gray-900 text-lg font-bold">Cash Management</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 text-2xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex gap-2">
            {(["pay_in", "pay_out"] as const).map(t => (
              <button key={t} onClick={() => setType(t)}
                className={`flex-1 h-10 rounded-xl text-sm font-bold transition-colors ${type === t ? (t === "pay_in" ? "bg-green-600 text-gray-900" : "bg-red-600 text-gray-900") : "bg-gray-100 text-gray-500 hover:text-gray-900"}`}>
                {t === "pay_in" ? "💵 Pay In" : "💸 Pay Out"}
              </button>
            ))}
          </div>
          <div>
            <label className="text-gray-500 text-xs mb-1 block">Amount</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
              <input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)}
                className="w-full bg-gray-100 border border-gray-200 focus:border-amber-400 rounded-xl pl-8 pr-4 py-3 text-gray-900 text-xl font-mono font-bold outline-none" />
            </div>
          </div>
          <div>
            <label className="text-gray-500 text-xs mb-1 block">Note (optional)</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)}
              placeholder="e.g. change for $100 bill, vendor payment…"
              className="w-full bg-gray-100 border border-gray-200 focus:border-amber-400 rounded-xl px-4 py-2.5 text-gray-900 text-sm outline-none placeholder-gray-400" />
          </div>
          {success && <p className="text-green-700 text-sm text-center">{success}</p>}
          <button onClick={submit} disabled={submitting || !amount}
            className={`w-full h-12 rounded-xl font-bold transition-colors disabled:opacity-50 ${type === "pay_in" ? "bg-green-600 hover:bg-green-500 text-gray-900" : "bg-red-600 hover:bg-red-500 text-gray-900"}`}>
            {submitting ? "Recording…" : `Record ${type === "pay_in" ? "Pay In" : "Pay Out"}`}
          </button>

          {transactions.filter(t => t.type === "pay_in" || t.type === "pay_out").length > 0 && (
            <div>
              <p className="text-gray-400 text-xs mb-2">Today's Cash Movements</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {transactions.filter(t => t.type === "pay_in" || t.type === "pay_out").map(t => (
                  <div key={t.id} className="flex justify-between items-center py-1.5 px-3 bg-gray-100 rounded-lg">
                    <div>
                      <span className={`text-xs font-bold ${t.type === "pay_in" ? "text-green-700" : "text-red-600"}`}>{t.type === "pay_in" ? "IN" : "OUT"}</span>
                      {t.note && <span className="text-gray-400 text-xs ml-2">{t.note}</span>}
                    </div>
                    <span className={`text-sm font-bold ${t.type === "pay_in" ? "text-green-700" : "text-red-600"}`}>
                      {t.type === "pay_in" ? "+" : "-"}{fmt(t.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Split Payment ────────────────────────────────────────────────────────────

type SplitGroup = { method: string; amount: number; itemKeys: string[] };

const SPLIT_METHODS = [
  { key: "cash", label: "Cash", icon: "💵" },
  { key: "card", label: "Card", icon: "💳" },
  { key: "athmovil", label: "ATH", icon: "📱" },
];

function SplitPaymentModal({
  cart, total, onConfirm, onClose,
}: {
  cart: CartItem[];
  total: number;
  onConfirm: (groups: SplitGroup[], note: string) => void;
  onClose: () => void;
}) {
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState(false);

  const lineTotal = (item: CartItem) =>
    (item.price + item.modifierSelections.reduce((s, m) => s + m.price, 0)) * item.quantity;

  const rawTotal = cart.reduce((s, i) => s + lineTotal(i), 0);
  const scale = rawTotal > 0 ? total / rawTotal : 1;

  const assignItems = (keys: string[], method: string) => {
    setAssignments(prev => { const next = { ...prev }; for (const k of keys) next[k] = method; return next; });
    setSelected(new Set());
  };

  const toggleSelect = (key: string) => {
    setSelected(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  };

  const removeAssignment = (key: string) => {
    setAssignments(prev => { const next = { ...prev }; delete next[key]; return next; });
  };

  const allAssigned = cart.length > 0 && cart.every(i => assignments[i.key]);

  const methodTotals: Record<string, { amount: number; keys: string[] }> = {};
  let unassignedAmt = 0;
  for (const item of cart) {
    const method = assignments[item.key];
    const amt = lineTotal(item) * scale;
    if (method) {
      if (!methodTotals[method]) methodTotals[method] = { amount: 0, keys: [] };
      methodTotals[method].amount += amt;
      methodTotals[method].keys.push(item.key);
    } else {
      unassignedAmt += amt;
    }
  }

  const handleConfirm = () => {
    const groups: SplitGroup[] = Object.entries(methodTotals).map(([method, { amount, keys }]) => ({
      method, amount: Math.round(amount * 100) / 100, itemKeys: keys,
    }));
    const noteParts = groups.map(g => {
      const names = g.itemKeys.map(k => { const it = cart.find(i => i.key === k); return it ? `${it.quantity}× ${it.name}` : k; }).join(", ");
      const sm = SPLIT_METHODS.find(x => x.key === g.method);
      return `${sm?.icon ?? ""} ${sm?.label ?? g.method} ${fmt(g.amount)} — ${names}`;
    });
    onConfirm(groups, `SPLIT:\n${noteParts.join("\n")}`);
    setConfirmed(true);
  };

  if (confirmed) {
    return (
      <div className="fixed inset-0 bg-black/75 flex items-end sm:items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 bg-green-800/50 border-b border-green-300 flex items-center gap-3">
            <span className="text-3xl">✅</span>
            <div>
              <p className="text-gray-900 font-black text-lg">Order Placed!</p>
              <p className="text-green-700 text-sm">Collect from each method below</p>
            </div>
          </div>
          <div className="p-5 space-y-3">
            {Object.entries(methodTotals).map(([method, { amount }]) => {
              const sm = SPLIT_METHODS.find(x => x.key === method);
              return (
                <div key={method} className="flex items-center justify-between bg-gray-100 rounded-xl px-4 py-3.5 border border-gray-200">
                  <span className="text-gray-900 text-base font-semibold">{sm?.icon} {sm?.label ?? method}</span>
                  <span className="text-[#F5A623] text-2xl font-black">{fmt(Math.round(amount * 100) / 100)}</span>
                </div>
              );
            })}
          </div>
          <div className="px-5 pb-5">
            <button onClick={onClose} className="w-full h-12 rounded-xl bg-[#F5A623] hover:bg-[#E09520] text-black font-black text-base transition-colors">
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/75 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl border border-gray-200 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-gray-900 font-black text-lg">✂ Split Payment</p>
            <p className="text-gray-500 text-sm">Tap a method to assign each item</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 text-2xl font-bold w-8 h-8 flex items-center justify-center transition-colors">×</button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cart.map(item => {
            const isSelected = selected.has(item.key);
            const method = assignments[item.key];
            const sm = method ? SPLIT_METHODS.find(x => x.key === method) : null;
            const itemAmt = lineTotal(item) * scale;
            return (
              <div key={item.key} className={`rounded-xl border transition-all ${method ? "border-green-700/60 bg-green-900/20" : isSelected ? "border-[#F5A623] bg-[#F5A623]/8" : "border-gray-200 bg-gray-100"}`}>
                <div className="flex items-center gap-2.5 px-3 py-2.5">
                  {/* Checkbox or method icon */}
                  {method ? (
                    <span className="text-xl flex-shrink-0">{sm?.icon}</span>
                  ) : (
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(item.key)}
                      className="w-4 h-4 rounded accent-orange-400 cursor-pointer flex-shrink-0" />
                  )}

                  {/* Item name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 text-sm font-semibold leading-tight">
                      {item.quantity > 1 && <span className="text-[#F5A623] font-black mr-1">{item.quantity}×</span>}
                      {item.name}
                    </p>
                    {item.modifierSelections.length > 0 && (
                      <p className="text-gray-400 text-xs truncate">{item.modifierSelections.map(m => m.name).join(", ")}</p>
                    )}
                  </div>

                  {/* Line total */}
                  <span className="text-gray-900 text-sm font-bold flex-shrink-0">{fmt(itemAmt)}</span>

                  {/* Assigned badge + unassign, OR quick-assign buttons */}
                  {method ? (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-xs bg-green-800/60 text-green-200 font-bold px-2 py-1 rounded-lg">{sm?.label}</span>
                      <button onClick={() => removeAssignment(item.key)}
                        className="text-gray-500 hover:text-red-600 font-bold w-5 h-5 flex items-center justify-center transition-colors text-base">×</button>
                    </div>
                  ) : !isSelected ? (
                    <div className="flex gap-1 flex-shrink-0">
                      {SPLIT_METHODS.map(sm => (
                        <button key={sm.key} onClick={() => assignItems([item.key], sm.key)}
                          title={sm.label}
                          className="w-8 h-8 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors flex items-center justify-center text-base">
                          {sm.icon}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bulk assign bar (appears when items are selected) */}
        {selected.size > 0 && (
          <div className="px-4 pb-2 flex-shrink-0">
            <div className="bg-[#F5A623]/10 border border-[#F5A623]/40 rounded-xl p-3 flex items-center gap-2">
              <span className="text-[#F5A623] text-sm font-black flex-shrink-0 min-w-[60px]">{selected.size} item{selected.size > 1 ? "s" : ""}</span>
              <span className="text-gray-400 text-xs flex-shrink-0">pay with:</span>
              {SPLIT_METHODS.map(sm => (
                <button key={sm.key} onClick={() => assignItems(Array.from(selected), sm.key)}
                  className="flex-1 h-9 rounded-xl text-sm font-black transition-colors bg-gray-200 hover:bg-gray-300 text-gray-900">
                  {sm.icon} {sm.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="px-4 pb-2 flex-shrink-0 space-y-1.5">
          {Object.entries(methodTotals).map(([method, { amount }]) => {
            const sm = SPLIT_METHODS.find(x => x.key === method);
            return (
              <div key={method} className="flex justify-between text-sm">
                <span className="text-gray-500">{sm?.icon} {sm?.label ?? method}</span>
                <span className="text-gray-900 font-bold">{fmt(Math.round(amount * 100) / 100)}</span>
              </div>
            );
          })}
          {unassignedAmt > 0.005 && (
            <div className="flex justify-between text-sm">
              <span className="text-red-600">⚠ Unassigned</span>
              <span className="text-red-600 font-bold">{fmt(Math.round(unassignedAmt * 100) / 100)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-black border-t border-gray-200 pt-2">
            <span className="text-gray-900">Total</span>
            <span className="text-[#F5A623]">{fmt(total)}</span>
          </div>
        </div>

        {/* Confirm button */}
        <div className="px-4 pb-4 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 h-12 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-100 font-semibold transition-colors">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={!allAssigned}
            className="flex-1 h-12 rounded-xl font-black text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-[#F5A623] hover:bg-[#E09520] text-black">
            {allAssigned ? "✓ Confirm & Charge" : "Assign all items first"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main POS ─────────────────────────────────────────────────────────────────

export default function POS() {
  const [, navigate] = useLocation();

  useEffect(() => { setPageMeta("POS — Island Tacos", "🖥️", { iconUrl: "/icon-pos-192.png", manifestUrl: "/manifest-pos.json" }); }, []);

  // Auth guard
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include", cache: "no-store", headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (!d.authed) navigate(`${adminRoutes.login}?redirect=${encodeURIComponent(adminRoutes.pos)}`); })
      .catch(() => navigate(`${adminRoutes.login}?redirect=${encodeURIComponent(adminRoutes.pos)}`));
  }, [navigate]);

  // Menu data
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [allItems, setAllItems] = useState<MenuItem[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/menu/categories").then(r => r.json()),
      fetch("/api/menu/items?available=true").then(r => r.json()),
    ]).then(([cats, items]) => {
      setCategories(cats);
      setAllItems(items);
    }).finally(() => setLoadingMenu(false));
  }, []);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [discount, setDiscount] = useState(0);
  const [resumedOrderId, setResumedOrderId] = useState<number | null>(null);

  // Customer autocomplete in cart
  const [customerSuggestions, setCustomerSuggestions] = useState<CustomerSuggestion[]>([]);
  const [customerSuggestionsOpen, setCustomerSuggestionsOpen] = useState(false);
  const API = import.meta.env.BASE_URL.replace(/\/$/, "");
  useEffect(() => {
    if (customerName.trim().length < 2) { setCustomerSuggestions([]); return; }
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${API}/api/customers?q=${encodeURIComponent(customerName.trim())}&limit=6`, {
          headers: authHeaders(),
          signal: controller.signal,
        });
        if (r.ok) { const d = await r.json(); setCustomerSuggestions(d); setCustomerSuggestionsOpen(true); }
      } catch (e) {
        if ((e as Error).name !== "AbortError") console.warn("Customer search failed", e);
      }
    }, 250);
    return () => { clearTimeout(t); controller.abort(); };
  }, [customerName, API]);

  // UI state
  const [mobileView, setMobileView] = useState<"menu" | "cart">("menu");
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [time, setTime] = useState(now());
  const [ticketCount, setTicketCount] = useState(0);

  // Shift state
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [openShiftModal, setOpenShiftModal] = useState(false);
  const [closeShiftModal, setCloseShiftModal] = useState(false);
  const [cashMgmtOpen, setCashMgmtOpen] = useState(false);

  useEffect(() => {
    fetch("/api/shifts/current", { credentials: "include", headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        if (d && d.id) { setCurrentShift(d); setShiftLoading(false); }
        else { setShiftLoading(false); setOpenShiftModal(true); }
      })
      .catch(() => setShiftLoading(false));
  }, []);

  // Modals
  const [modifierModal, setModifierModal] = useState<{
    item: MenuItem; mods: Modifier[];
    editKey?: string; initialSelections?: CartModifier[]; initialNote?: string;
  } | null>(null);
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentTab, setPaymentTab] = useState<string>("cash");
  const [splitModal, setSplitModal] = useState(false);
  const [receiptModal, setReceiptModal] = useState<{ order: Order; tendered?: number } | null>(null);
  const [discountModal, setDiscountModal] = useState(false);
  const [holdModal, setHoldModal] = useState(false);
  const [ticketsOpen, setTicketsOpen] = useState(false);
  const [receiptsOpen, setReceiptsOpen] = useState(false);
  const [soldOutOpen, setSoldOutOpen] = useState(false);
  const [itemNoteModal, setItemNoteModal] = useState<string | null>(null); // cart item key
  const [orderNoteModal, setOrderNoteModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Incoming online orders (pending + source:online)
  // incomingOrders = all currently-pending online orders (used for bell badge count)
  // popupOrders    = only orders that arrived DURING this session (trigger the full-screen popup)
  const [incomingOrders, setIncomingOrders] = useState<Order[]>([]);
  const [popupOrders, setPopupOrders] = useState<Order[]>([]);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );
  const seenOnlineIdsRef = useRef<Set<number>>(new Set());
  const isFirstOnlineFetchRef = useRef(true);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const chimeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Timestamp of last "completed" push — prevents the debounced idle from wiping it too soon
  const displayCompletedAt = useRef<number>(0);
  // Holds latest poll fn so the SSE effect can call it without re-subscribing
  const mainPollRef = useRef<() => void>(() => {});

  // Silently unlock AudioContext on the first interaction — supports both click and touch (iOS/iPad)
  useEffect(() => {
    const unlock = () => {
      try {
        if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
        audioCtxRef.current.resume().catch(() => {});
      } catch {}
    };
    document.addEventListener("click", unlock, { passive: true });
    document.addEventListener("touchend", unlock, { passive: true });
    return () => {
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchend", unlock);
    };
  }, []);

  const requestNotifPermission = async () => {
    if (typeof Notification === "undefined") return;
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
  };

  const sendNotification = useCallback((title: string, body: string) => {
    // Only send browser notifications when this tab is in the background
    if (document.visibilityState === "hidden" && typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/icon-192.png" });
    }
  }, []);

  const playChime = useCallback(async () => {
    try {
      // Only chime in the active foreground tab
      if (document.visibilityState !== "visible") return;
      // Create AudioContext lazily if it was never unlocked yet
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      // MUST await resume — notes scheduled against a suspended context play at time=0
      // (already elapsed) and are silently dropped
      await ctx.resume();
      const notes = [
        { freq: 880, t: 0 }, { freq: 1108, t: 0.15 },
        { freq: 1320, t: 0.30 }, { freq: 880, t: 0.50 },
        { freq: 1320, t: 0.65 },
      ];
      notes.forEach(({ freq, t }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "sine"; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, ctx.currentTime + t);
        gain.gain.linearRampToValueAtTime(0.7, ctx.currentTime + t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.55);
        osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + 0.6);
      });
    } catch {}
  }, []);

  // Single poll for all orders every 8s — handles online notifications + ticket count
  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch("/api/orders", { credentials: "include" });
        const data: Order[] = await r.json();

        // ── Online + phone order notifications ──
        const pending = data.filter(o => (o.source === "online" || o.source === "phone") && o.status === "pending");
        if (isFirstOnlineFetchRef.current) {
          isFirstOnlineFetchRef.current = false;
          pending.forEach(o => seenOnlineIdsRef.current.add(o.id));
          setIncomingOrders(pending);
        } else {
          const newOrders = pending.filter(o => !seenOnlineIdsRef.current.has(o.id));
          if (newOrders.length > 0) {
            playChime();
            sendNotification(
              `🔔 New Pending Order${newOrders.length > 1 ? "s" : ""}!`,
              `${newOrders.length} order${newOrders.length > 1 ? "s" : ""} waiting for approval`
            );
            setPopupOrders(prev => {
              const existingIds = new Set(prev.map(o => o.id));
              return [...prev, ...newOrders.filter(o => !existingIds.has(o.id))];
            });
          }
          pending.forEach(o => seenOnlineIdsRef.current.add(o.id));
          setIncomingOrders(pending);
        }

        // ── Held ticket count ──
        setTicketCount(data.filter(o =>
          !["completed", "cancelled"].includes(o.status) &&
          ((o.source === "pos" && o.paymentStatus === "pending") || o.status === "ready")
        ).length);
      } catch {}
    };
    mainPollRef.current = poll;
    poll();
    const t = setInterval(poll, 8000);
    return () => clearInterval(t);
  }, [playChime, sendNotification]);

  // Real-time sync: fire the main poll immediately when any order changes on another instance
  useEffect(() => {
    const es = new EventSource("/api/pos/events", { withCredentials: true });
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as { type: string };
        if (msg.type === "order_created" || msg.type === "order_updated") mainPollRef.current();
      } catch { /* ignore parse errors */ }
    };
    return () => es.close();
  }, []);

  // Repeat chime every 5s while there are new orders in the popup
  useEffect(() => {
    if (popupOrders.length > 0) {
      if (!chimeIntervalRef.current) chimeIntervalRef.current = setInterval(playChime, 5000);
    } else {
      if (chimeIntervalRef.current) { clearInterval(chimeIntervalRef.current); chimeIntervalRef.current = null; }
    }
    return () => { if (chimeIntervalRef.current) { clearInterval(chimeIntervalRef.current); chimeIntervalRef.current = null; } };
  }, [popupOrders, playChime]);

  const acceptOnline = async (id: number) => {
    await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "confirmed" }),
    });
    seenOnlineIdsRef.current.delete(id);
    setIncomingOrders(prev => prev.filter(o => o.id !== id));
    setPopupOrders(prev => prev.filter(o => o.id !== id));
    setShowRejectInput(false); setRejectReason("");
  };

  const rejectOnline = async (id: number) => {
    await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled", cancellationReason: rejectReason || null }),
    });
    seenOnlineIdsRef.current.delete(id);
    setIncomingOrders(prev => prev.filter(o => o.id !== id));
    setPopupOrders(prev => prev.filter(o => o.id !== id));
    setShowRejectInput(false); setRejectReason("");
  };

  // Clock + ticket count
  useEffect(() => {
    const t = setInterval(() => setTime(now()), 10000);
    return () => clearInterval(t);
  }, []);


  // Filtered items
  const filteredItems = allItems.filter(item => {
    if (!item.available) return false;
    const matchCat = selectedCat === null || item.categoryId === selectedCat;
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  // Cart calculations
  const subtotal = cart.reduce((s, i) => s + (i.price + i.modifierSelections.reduce((ms, m) => ms + m.price, 0)) * i.quantity, 0);
  const total = Math.max(0, subtotal - discount);

  // On mount: immediately reset display to idle so stale state from a previous session is cleared
  useEffect(() => {
    fetch("/api/display", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "idle", items: [], subtotal: 0, tax: 0, total: 0 }),
    }).catch(() => {});
  }, []);

  // Broadcast cart state to customer display tablet (debounced 400ms)
  useEffect(() => {
    const t = setTimeout(() => {
      const showingAthMovil = paymentModal && paymentTab === "athmovil";
      // Don't override a "completed" screen — let it show for 15s before going idle
      if (cart.length === 0 && Date.now() - displayCompletedAt.current < 15_000) return;
      const body = cart.length > 0
        ? {
            status: "active",
            items: cart.map(c => ({
              name: c.name,
              quantity: c.quantity,
              unitPrice: c.price + c.modifierSelections.reduce((s, m) => s + m.price, 0),
              modifiers: c.modifierSelections.map(m => m.name),
            })),
            subtotal,
            tax: 0,
            total,
            discountAmount: discount > 0 ? discount : undefined,
            paymentMethod: showingAthMovil ? "athmovil" : undefined,
          }
        : { status: "idle", items: [], subtotal: 0, tax: 0, total: 0 };
      fetch("/api/display", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [cart, subtotal, total, discount, paymentModal, paymentTab]);

  // Add item to cart
  const addItem = async (item: MenuItem) => {
    // Check for modifiers
    try {
      const r = await fetch(`/api/menu/items/${item.id}/modifiers`, { credentials: "include" });
      const mods: Modifier[] = await r.json();
      if (mods.length > 0) {
        setModifierModal({ item, mods });
        return;
      }
    } catch {}
    // No modifiers — add directly
    pushToCart(item, []);
  };

  const pushToCart = (item: MenuItem, sels: CartModifier[], note = "") => {
    // Try to merge with existing identical item (only when no note)
    const existingKey = !note ? cart.find(c =>
      c.menuItemId === item.id && c.notes === "" &&
      JSON.stringify(c.modifierSelections) === JSON.stringify(sels)
    )?.key : undefined;
    if (existingKey) {
      setCart(cart.map(c => c.key === existingKey ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { key: uid(), menuItemId: item.id, name: item.name, price: item.price, quantity: 1, notes: note, modifierSelections: sels }]);
    }
    // Auto-switch to cart panel on mobile
    if (window.innerWidth < 640) setMobileView("cart");
  };

  const removeItem = (key: string) => setCart(cart.filter(c => c.key !== key));
  const changeQty = (key: string, delta: number) => {
    setCart(cart.map(c => c.key === key ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c));
  };
  const setItemNote = (key: string, note: string) => setCart(cart.map(c => c.key === key ? { ...c, notes: note } : c));

  // Re-open the modifier modal pre-filled with a cart item's current selections
  const editCartItem = async (cartItem: CartItem) => {
    const menuItem = allItems.find(i => i.id === cartItem.menuItemId);
    if (!menuItem) return;
    try {
      const r = await fetch(`/api/menu/items/${menuItem.id}/modifiers`, { credentials: "include" });
      const mods: Modifier[] = await r.json();
      if (mods.length > 0 || cartItem.notes) {
        setModifierModal({
          item: menuItem,
          mods,
          editKey: cartItem.key,
          initialSelections: cartItem.modifierSelections,
          initialNote: cartItem.notes,
        });
      }
    } catch {}
  };

  const clearCart = () => {
    setCart([]); setCustomerName(""); setCustomerPhone(""); setOrderNotes(""); setDiscount(0); setResumedOrderId(null);
    setCustomerSuggestions([]); setCustomerSuggestionsOpen(false);
  };

  // Place order
  const placeOrder = async (method: string, paymentStatus: "pending" | "paid", tendered?: number, overrideName?: string, overridePhone?: string, overrideNote?: string) => {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      // If resuming a ticket, cancel the old one first
      if (resumedOrderId) {
        await fetch(`/api/orders/${resumedOrderId}`, {
          method: "PATCH", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "cancelled" }),
        });
      }

      const r = await fetch("/api/orders", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: overrideName ?? (customerName || "Walk-in"),
          customerEmail: "",
          customerPhone: overridePhone ?? "",
          orderType: "pickup",
          paymentMethod: method,
          paymentStatus,
          source: "pos",
          discountAmount: discount,
          notes: (overrideNote ?? orderNotes) || null,
          items: cart.map(c => ({
            menuItemId: c.menuItemId,
            quantity: c.quantity,
            notes: c.notes || null,
            modifierSelections: c.modifierSelections.length > 0 ? c.modifierSelections : undefined,
            alreadyMade: c.alreadyMade ?? false,
          })),
        }),
      });
      if (!r.ok) {
        const errData = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(errData.error ?? `Order failed (${r.status})`);
      }
      const order: Order = await r.json();
      if (!order?.items) throw new Error("Order response missing items");
      // Push "completed" state to customer display
      displayCompletedAt.current = Date.now();
      fetch("/api/display", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "completed",
          items: [],
          subtotal: 0,
          tax: 0,
          total: order.total,
          paymentMethod: method,
          orderCode: order.confirmationCode,
          estimatedReadyAt: order.estimatedReadyAt,
        }),
      }).catch(() => {});
      clearCart();
      setResumedOrderId(null);
      setReceiptModal({ order, tendered });
      // Adjust held ticket count: +1 when holding a new ticket, -1 when paying a resumed one
      setTicketCount(tc => Math.max(0, tc + (paymentStatus === "pending" ? 1 : resumedOrderId ? -1 : 0)));
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to place order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePay = async (method: string, tendered?: number, splitNote?: string) => {
    setPaymentModal(false);
    const noteWithSplit = splitNote
      ? (orderNotes ? `${orderNotes}\n${splitNote}` : splitNote)
      : (orderNotes || undefined);
    await placeOrder(method, "paid", tendered, undefined, customerPhone || undefined, noteWithSplit);
  };

  const handleSplitPay = async (_groups: SplitGroup[], note: string) => {
    // Place order as "split" — the note contains the per-method breakdown
    const existingNote = orderNotes ? `${orderNotes}\n${note}` : note;
    await placeOrder("split", "paid", undefined, undefined, customerPhone || undefined, existingNote);
  };

  const handleHold = () => {
    if (cart.length === 0) return;
    setHoldModal(true);
  };

  const handleHoldConfirm = async (name: string, phone: string, note: string) => {
    setHoldModal(false);
    await placeOrder("cash", "pending", undefined, name || "Walk-in", phone, note);
  };

  const handleResume = (items: CartItem[], name: string, note: string, disc: number, orderId: number) => {
    setCart(items); setCustomerName(name); setOrderNotes(note); setDiscount(disc); setResumedOrderId(orderId);
  };

  const handleTicketPaymentComplete = (order: Order, tendered?: number) => {
    setTicketsOpen(false);
    setReceiptModal({ order, tendered });
    setTicketCount(tc => Math.max(0, tc - 1));
  };

  // ─ Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-gray-50 flex flex-col overflow-hidden select-none" style={{ fontFamily: "Inter, sans-serif" }}>

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="Island Tacos" className="h-8 w-8 object-contain rounded-lg"/>
          <span className="text-gray-400 text-sm font-medium hidden sm:block">Point of Sale</span>
        </div>
        <div className="text-gray-500 text-sm font-mono">{time}</div>
        <div className="flex items-center gap-2">
          <button
            onClick={notifPerm === "granted" ? undefined : requestNotifPermission}
            title={notifPerm === "denied" ? "Enable notifications in your browser/device settings" : undefined}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              incomingOrders.length > 0
                ? "bg-orange-600 hover:bg-orange-500 text-gray-900 animate-pulse"
                : notifPerm === "granted"
                  ? "bg-gray-100 text-green-700"
                  : notifPerm === "denied"
                    ? "bg-gray-100 text-red-600 cursor-not-allowed"
                    : "bg-gray-100 text-yellow-400 hover:bg-gray-200"
            }`}
          >
            {incomingOrders.length > 0 ? "🔔" : notifPerm === "granted" ? "🔔" : notifPerm === "denied" ? "🔕" : "🔔"}
            <span className="hidden sm:inline">
              {incomingOrders.length > 0
                ? `${incomingOrders.length} Pending`
                : notifPerm === "granted"
                  ? "Alerts On"
                  : notifPerm === "denied"
                    ? "Alerts Off"
                    : "Allow Alerts"}
            </span>
            {incomingOrders.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-gray-900 text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {incomingOrders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => currentShift && currentShift.id !== 0 ? setCloseShiftModal(true) : setOpenShiftModal(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              currentShift && currentShift.id !== 0
                ? "bg-green-50 text-green-700 hover:bg-green-100 border border-green-300"
                : "bg-red-50 text-red-700 hover:bg-red-100 border border-red-300"
            }`}
          >
            ⏱ <span className="hidden sm:inline">{currentShift && currentShift.id !== 0 ? "Shift Open" : "No Shift"}</span>
          </button>
          <button
            onClick={() => setCashMgmtOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors"
          >
            💵 <span className="hidden sm:inline">Cash</span>
          </button>
          <button onClick={() => setReceiptsOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors">
            🧾 <span className="hidden sm:inline">Receipts</span>
          </button>
          <button
            onClick={() => setSoldOutOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 text-sm font-bold transition-colors"
          >
            🚫 <span className="hidden sm:inline">Sold Out</span>
          </button>
          <button
            onClick={() => setTicketsOpen(true)}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
              ticketCount > 0
                ? "bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_12px_rgba(245,166,35,0.5)] animate-pulse"
                : "bg-gray-100 hover:bg-gray-200 text-gray-700"
            }`}
          >
            🎫 <span className="hidden sm:inline">{ticketCount > 0 ? `${ticketCount} Held` : "Tickets"}</span>
            {ticketCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-gray-900 text-xs font-black w-5 h-5 rounded-full flex items-center justify-center shadow-md">
                {ticketCount}
              </span>
            )}
          </button>
          <button onClick={() => navigate(`${adminRoutes.login}?redirect=${encodeURIComponent(adminRoutes.dashboard)}`)} className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-900 text-sm font-medium transition-colors">
            ← <span className="hidden sm:inline">Admin</span>
          </button>
          <button
            onClick={() => window.location.reload()}
            title="Reload POS"
            className="px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Main content ── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* ── Left: Menu ── */}
        <div className={`flex-col flex-1 min-w-0 overflow-hidden border-r border-gray-200 ${mobileView === "menu" ? "flex" : "hidden"} sm:flex`}>

          {/* Search */}
          <div className="px-3 pt-3 pb-2 flex-shrink-0">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items…"
                className="w-full bg-white border border-gray-200 focus:border-amber-400 rounded-xl pl-9 pr-4 py-2.5 text-gray-900 text-sm outline-none transition-colors placeholder-gray-400"/>
            </div>
          </div>

          {/* Category tabs */}
          <div className="flex gap-2 px-3 pb-2 overflow-x-auto flex-shrink-0 scrollbar-none">
            <button onClick={() => setSelectedCat(null)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${selectedCat === null ? "bg-[#F5A623] text-black" : "bg-white text-gray-500 hover:text-gray-900 border border-gray-200"}`}>
              All
            </button>
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setSelectedCat(cat.id)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${selectedCat === cat.id ? "bg-[#F5A623] text-black" : "bg-white text-gray-500 hover:text-gray-900 border border-gray-200"}`}>
                {cat.name}
              </button>
            ))}
          </div>

          {/* Item grid */}
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {loadingMenu ? (
              <div className="flex items-center justify-center h-40 text-gray-400">Loading menu…</div>
            ) : filteredItems.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-gray-400">No items found</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {filteredItems.map(item => (
                  <ItemCard key={item.id} item={item} onClick={() => addItem(item)} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Cart ── */}
        <div className={`flex-col bg-gray-100 flex-shrink-0 w-full sm:w-80 xl:w-96 ${mobileView === "cart" ? "flex" : "hidden"} sm:flex`}>

          {/* Cart header */}
          <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-gray-900 font-bold text-base">{resumedOrderId ? "Resumed Ticket" : "New Order"}</h2>
              {cart.length > 0 && (
                <button onClick={clearCart} className="text-gray-400 hover:text-red-600 text-xs font-semibold transition-colors">Clear</button>
              )}
            </div>
            {/* Customer name with autocomplete */}
            <div className="relative mb-2">
              <input
                value={customerName}
                onChange={e => { setCustomerName(e.target.value); setCustomerSuggestionsOpen(true); }}
                onBlur={() => setTimeout(() => setCustomerSuggestionsOpen(false), 150)}
                onFocus={() => customerSuggestions.length > 0 && setCustomerSuggestionsOpen(true)}
                placeholder="Customer name (optional)"
                className="w-full bg-white border border-gray-200 focus:border-amber-400 rounded-lg px-3 py-2 text-gray-900 text-sm outline-none transition-colors placeholder-gray-400"
              />
              {customerSuggestionsOpen && customerSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-gray-100 border border-gray-200 rounded-xl shadow-2xl z-20 overflow-hidden">
                  {customerSuggestions.map(c => (
                    <button
                      key={c.id}
                      onMouseDown={() => { setCustomerName(c.name); setCustomerPhone(c.phone ?? ""); setCustomerSuggestions([]); setCustomerSuggestionsOpen(false); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-200 transition-colors border-b border-gray-200 last:border-b-0"
                    >
                      <p className="text-gray-900 text-sm font-semibold">{c.name}</p>
                      {(c.phone || c.email) && <p className="text-gray-500 text-xs">{c.phone ?? c.email}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input
              value={customerPhone}
              onChange={e => setCustomerPhone(e.target.value)}
              placeholder="Phone (optional)"
              type="tel"
              className="w-full bg-white border border-gray-200 focus:border-amber-400 rounded-lg px-3 py-2 text-gray-900 text-sm outline-none transition-colors placeholder-gray-400"
            />
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                <span className="text-3xl mb-2">🌮</span>
                <span className="text-sm">Tap items to add</span>
              </div>
            ) : (
              cart.map(item => {
                const lineTotal = (item.price + item.modifierSelections.reduce((s, m) => s + m.price, 0)) * item.quantity;
                return (
                  <div key={item.key} className="bg-white rounded-xl p-3 border border-gray-200">
                    <div className="flex items-start gap-2">
                      <button
                        className="flex-1 min-w-0 text-left active:opacity-70 transition-opacity"
                        onClick={() => editCartItem(item)}
                        title="Tap to edit modifiers"
                      >
                        <p className="text-gray-900 text-sm font-semibold truncate">{item.name}</p>
                        {item.modifierSelections.map((m, i) => (
                          <p key={i} className="text-gray-500 text-xs">+ {m.name}{m.price > 0 ? ` (+${fmt(m.price)})` : ""}</p>
                        ))}
                        {item.notes && <p className="text-gray-400 text-xs italic">{item.notes}</p>}
                        {(item.modifierSelections.length > 0 || item.notes) && (
                          <p className="text-gray-400 text-[10px] mt-0.5">tap to edit</p>
                        )}
                      </button>
                      <span className="text-[#F5A623] text-sm font-bold flex-shrink-0">{fmt(lineTotal)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <button onClick={() => changeQty(item.key, -1)} className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 active:bg-gray-200 text-gray-900 text-xl flex items-center justify-center transition-colors">−</button>
                        <span className="text-gray-900 text-sm font-bold w-6 text-center">{item.quantity}</span>
                        <button onClick={() => changeQty(item.key, 1)} className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 active:bg-gray-200 text-gray-900 text-xl flex items-center justify-center transition-colors">+</button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setItemNoteModal(item.key)} className="text-gray-400 hover:text-gray-700 text-xs transition-colors">Note</button>
                        <button onClick={() => removeItem(item.key)} className="text-gray-500 hover:text-red-600 text-lg transition-colors">×</button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Totals + actions */}
          {cart.length > 0 && (
            <div className="border-t border-gray-200 px-4 py-4 flex-shrink-0 space-y-3">
              {/* Discount + note row */}
              <div className="flex gap-2">
                <button onClick={() => setDiscountModal(true)} className={`flex-1 h-12 rounded-xl text-base font-semibold border transition-colors ${discount > 0 ? "border-green-500 text-green-700 bg-green-900/20" : "border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-400"}`}>
                  {discount > 0 ? `Discount -${fmt(discount)}` : "% Discount"}
                </button>
                {discount > 0 && (
                  <button onClick={() => setDiscount(0)} className="h-12 w-12 rounded-xl border border-gray-200 text-gray-400 hover:text-red-600 text-lg transition-colors flex items-center justify-center">×</button>
                )}
                <button onClick={() => setOrderNoteModal(true)} className={`flex-1 h-12 rounded-xl text-base font-semibold border transition-colors ${orderNotes ? "border-blue-500 text-blue-400" : "border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-400"}`}>
                  {orderNotes ? "📝 Note" : "Add Note"}
                </button>
              </div>

              {/* Totals */}
              <div className="space-y-1 py-2 border-t border-gray-200">
                <div className="flex justify-between text-sm text-gray-500"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                {discount > 0 && <div className="flex justify-between text-sm text-green-700"><span>Discount</span><span>-{fmt(discount)}</span></div>}
                <div className="flex justify-between text-xl text-gray-900 font-black border-t border-gray-200 pt-2 mt-1"><span>Total</span><span className="text-[#F5A623]">{fmt(total)}</span></div>
              </div>

              {/* Payment buttons */}
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={handleHold} disabled={submitting}
                    className="h-14 rounded-xl border-2 border-amber-400 bg-amber-50 hover:bg-amber-100 text-amber-700 hover:text-amber-800 text-base font-bold transition-all disabled:opacity-50">
                    🎫 Hold
                  </button>
                  <button onClick={() => setSplitModal(true)} disabled={submitting || cart.length < 2}
                    className="h-14 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-100 text-base font-bold transition-colors disabled:opacity-50">
                    ✂ Split
                  </button>
                </div>
                <button onClick={() => setPaymentModal(true)} disabled={submitting}
                  className="w-full h-16 rounded-xl bg-[#F5A623] hover:bg-[#E09520] text-black font-black text-xl transition-colors disabled:opacity-50">
                  {submitting ? "Processing…" : `Charge ${fmt(total)}`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile bottom tab bar ── */}
      <div className="sm:hidden flex border-t border-gray-200 bg-gray-100 flex-shrink-0">
        <button
          onClick={() => setMobileView("menu")}
          className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${mobileView === "menu" ? "text-[#F5A623]" : "text-gray-400"}`}
        >
          <span className="text-xl">🍽</span>
          <span className="text-[10px] font-semibold">Menu</span>
        </button>
        <button
          onClick={() => setMobileView("cart")}
          className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 relative transition-colors ${mobileView === "cart" ? "text-[#F5A623]" : "text-gray-400"}`}
        >
          <span className="text-xl">🛒</span>
          <span className="text-[10px] font-semibold">Cart</span>
          {cart.length > 0 && (
            <span className="absolute top-1.5 right-[calc(50%-12px)] bg-[#F5A623] text-black text-[9px] font-black min-w-[16px] h-4 px-0.5 rounded-full flex items-center justify-center">
              {cart.reduce((s, i) => s + i.quantity, 0)}
            </span>
          )}
        </button>
      </div>

      {/* ── Modals ── */}

      {modifierModal && (
        <ModifierModal
          item={modifierModal.item}
          modifiers={modifierModal.mods}
          initialSelections={modifierModal.initialSelections}
          initialNote={modifierModal.initialNote}
          onConfirm={(sels, note) => {
            if (modifierModal.editKey) {
              // Replace the existing cart item's modifiers and note in-place
              setCart(prev => prev.map(c => c.key === modifierModal.editKey
                ? { ...c, modifierSelections: sels, notes: note }
                : c
              ));
            } else {
              pushToCart(modifierModal.item, sels, note);
            }
            setModifierModal(null);
          }}
          onClose={() => setModifierModal(null)}
        />
      )}

      {paymentModal && (
        <PaymentModal
          total={total}
          onPay={handlePay}
          onClose={() => { setPaymentModal(false); setPaymentTab("cash"); }}
          onSplit={cart.length >= 2 ? () => { setPaymentModal(false); setSplitModal(true); setPaymentTab("cash"); } : undefined}
          onTabChange={setPaymentTab}
        />
      )}

      {splitModal && (
        <SplitPaymentModal
          cart={cart}
          total={total}
          onConfirm={async (groups, note) => {
            await handleSplitPay(groups, note);
            setSplitModal(false);
          }}
          onClose={() => setSplitModal(false)}
        />
      )}

      {receiptModal && (
        <ReceiptModal order={receiptModal.order} tendered={receiptModal.tendered} onClose={() => setReceiptModal(null)} />
      )}

      {discountModal && (
        <DiscountModal subtotal={subtotal} onApply={setDiscount} onClose={() => setDiscountModal(false)} />
      )}

      {ticketsOpen && (
        <TicketsDrawer onResume={handleResume} onClose={() => setTicketsOpen(false)} onPaymentComplete={handleTicketPaymentComplete} />
      )}

      {holdModal && (
        <HoldModal
          initialName={customerName}
          initialNote={orderNotes}
          onHold={handleHoldConfirm}
          onClose={() => setHoldModal(false)}
        />
      )}

      {/* ── Incoming Online Order Modal ── */}
      {popupOrders.length > 0 && (() => {
        const order = popupOrders[0];
        const subtotal = order.items.reduce((s, i) => s + i.menuItemPrice * i.quantity, 0);
        return (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-orange-500/40 overflow-hidden">
              <div className={`px-5 py-3 flex items-center justify-between ${order.source === "phone" ? "bg-green-600" : "bg-orange-600"}`}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{order.source === "phone" ? "📞" : "🔔"}</span>
                  <span className="text-gray-900 font-bold text-lg">{order.source === "phone" ? "New Phone Order" : "New Online Order"}</span>
                </div>
                {popupOrders.length > 1 && (
                  <span className="bg-orange-800 text-orange-100 text-xs font-bold px-2 py-0.5 rounded-full">
                    +{popupOrders.length - 1} more
                  </span>
                )}
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-2xl font-black text-gray-900 tracking-tight">{order.confirmationCode}</div>
                    <div className="text-gray-700 font-semibold mt-0.5">{order.customerName}</div>
                    {order.customerPhone && <div className="text-gray-400 text-sm">{order.customerPhone}</div>}
                  </div>
                  <div className="text-right">
                    <div className="text-[#F5A623] font-bold text-lg">${subtotal.toFixed(2)}</div>
                    <div className="text-gray-400 text-xs capitalize">{order.orderType}</div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {order.items.map(item => (
                    <div key={item.id} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-black text-gray-900">{item.quantity}×</span>
                        <span className="text-base font-semibold text-gray-900">{item.menuItemName}</span>
                      </div>
                      {(item.modifierSelections ?? []).length > 0 && (
                        <div className="text-amber-600 text-sm mt-1 space-y-0.5">
                          {(item.modifierSelections ?? []).map((m, i) => <div key={i}>+ {m.name}</div>)}
                        </div>
                      )}
                      {item.notes && <div className="text-amber-600 text-sm mt-1">{item.notes}</div>}
                    </div>
                  ))}
                </div>

                {order.notes && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-700 text-sm">
                    {order.notes}
                  </div>
                )}

                {showRejectInput ? (
                  <div className="space-y-3">
                    <p className="text-red-600 text-xs font-semibold uppercase tracking-wide">Why are you rejecting?</p>
                    <div className="flex flex-wrap gap-1.5">
                      {["Out of chicken","Out of steak","Out of shrimp","Out of salmon","Out of burger"].map(opt => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setRejectReason(r => r === opt ? "" : opt)}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                            rejectReason === opt
                              ? "bg-red-500 text-gray-900 border-red-400"
                              : "border-red-300 text-red-600 hover:bg-red-50"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={["Out of chicken","Out of steak","Out of shrimp","Out of salmon","Out of burger"].includes(rejectReason) ? "" : rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      placeholder="Other reason (optional)"
                      className="w-full bg-gray-100 border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm outline-none focus:border-red-500 placeholder-gray-400"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => rejectOnline(order.id)}
                        className="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-500 text-gray-900 font-bold transition-colors"
                      >
                        Confirm Reject
                      </button>
                      <button
                        onClick={() => { setShowRejectInput(false); setRejectReason(""); }}
                        className="px-4 h-11 rounded-xl bg-gray-200 hover:bg-gray-200 text-gray-700 font-medium transition-colors"
                      >
                        Back
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-3">
                      <button
                        onClick={() => acceptOnline(order.id)}
                        className="flex-1 h-12 rounded-xl bg-green-600 hover:bg-green-500 text-gray-900 font-bold text-base transition-colors active:scale-95"
                      >
                        ✓ Accept
                      </button>
                      <button
                        onClick={() => setShowRejectInput(true)}
                        className="px-5 h-12 rounded-xl border border-red-300 text-red-600 hover:bg-red-50 hover:border-red-500 font-semibold transition-colors"
                      >
                        ✕ Reject
                      </button>
                    </div>
                    <button
                      onClick={() => setPopupOrders(prev => prev.filter((o) => o.id !== order.id))}
                      className="w-full h-9 rounded-xl text-gray-400 hover:text-gray-700 text-sm transition-colors"
                    >
                      Handle Later
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {receiptsOpen && (
        <ReceiptsDrawer onClose={() => setReceiptsOpen(false)} />
      )}

      {soldOutOpen && (
        <SoldOutDrawer onClose={() => setSoldOutOpen(false)} />
      )}

      {/* Item note inline modal */}
      {itemNoteModal && (() => {
        const item = cart.find(c => c.key === itemNoteModal);
        if (!item) return null;
        return (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setItemNoteModal(null)}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-gray-900 font-bold mb-3">Note for {item.name}</h3>
              <textarea value={item.notes} onChange={e => setItemNote(itemNoteModal, e.target.value)}
                placeholder="E.g. no onions, extra sauce…"
                className="w-full bg-gray-100 border border-gray-200 focus:border-amber-400 rounded-xl p-3 text-gray-900 text-sm outline-none resize-none h-24 placeholder-gray-400"/>
              <button onClick={() => setItemNoteModal(null)} className="mt-3 w-full h-11 rounded-xl bg-[#F5A623] hover:bg-[#E09520] text-black font-bold transition-colors">Done</button>
            </div>
          </div>
        );
      })()}

      {/* Order note modal */}
      {orderNoteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setOrderNoteModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-gray-900 font-bold mb-3">Order Note</h3>
            <textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)}
              placeholder="Special instructions for this order…"
              className="w-full bg-gray-100 border border-gray-200 focus:border-amber-400 rounded-xl p-3 text-gray-900 text-sm outline-none resize-none h-28 placeholder-gray-400"/>
            <button onClick={() => setOrderNoteModal(false)} className="mt-3 w-full h-11 rounded-xl bg-[#F5A623] hover:bg-[#E09520] text-black font-bold transition-colors">Done</button>
          </div>
        </div>
      )}

      {/* Shift modals */}
      {!shiftLoading && openShiftModal && (
        <OpenShiftModal onOpen={(shift) => { setCurrentShift(shift); setOpenShiftModal(false); }} />
      )}
      {closeShiftModal && currentShift && (
        <CloseShiftModal
          shift={currentShift}
          onClose={() => { setCloseShiftModal(false); setCurrentShift(null); setOpenShiftModal(true); }}
        />
      )}
      {cashMgmtOpen && (
        <PayInOutModal
          shiftId={currentShift && currentShift.id !== 0 ? currentShift.id : null}
          onClose={() => setCashMgmtOpen(false)}
        />
      )}
    </div>
  );
}

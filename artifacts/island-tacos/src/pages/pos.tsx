import { memo, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { RefreshCw, X } from "lucide-react";
import { useLocation } from "wouter";
import { adminRoutes } from "@/lib/admin-path";
import { authHeaders, clearAuthToken } from "@/lib/auth";
import { setPageMeta } from "@/lib/page-meta";

// ─── Types ────────────────────────────────────────────────────────────────────

type ModifierOption = { id: string; name: string; price: number; position: number; allowMultiple?: boolean; maxQuantity?: number };
type Modifier = { id: number; loyverseId: string; name: string; options: ModifierOption[]; required: boolean; minSelections: number; maxSelections: number | null };
type MenuCategory = { id: number; name: string; sortOrder: number; sendToKds: boolean };
type MenuItem = {
  id: number; categoryId: number; name: string; description?: string | null;
  price: number; imageUrl?: string | null; posImageUrl?: string | null; available: boolean;
  popular: boolean; spicy: boolean; vegetarian: boolean;
  openPrice?: boolean;
};
type CartModifier = { modifierId: string; optionId: string; name: string; price: number };
type CartItem = {
  key: string; menuItemId: number; name: string; price: number;
  quantity: number; notes: string; modifierSelections: CartModifier[];
  alreadyMade?: boolean;
  // Set when the line came from an open-price menu item — `price` then holds the
  // cashier-entered amount which the server validates against menuItem.openPrice.
  priceOverride?: number;
};
type Order = {
  id: number; confirmationCode: string; customerName: string; status: string;
  paymentStatus: string; paymentMethod: string; source: string;
  subtotal: number; discountAmount: number; tax: number; total: number;
  amountTendered?: number | null;
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

// ─── Indigo Luxe design tokens ────────────────────────────────────────────────
const IL = { bg:"#16172b",card:"#1e1f38",hdr:"#0e1020",bord:"rgba(255,255,255,0.06)",tp:"#e8eaf6",tm:"#b0b8d8",mu:"#7077a1",or:"#ff6b00",pur:"#7c6af7",grn:"#30d158",red:"#ff453a" };
const IL_GLOW = { background:"#1e1f38",border:"1px solid rgba(255,255,255,0.06)",borderRadius:16,boxShadow:"0 0 0 1px rgba(255,255,255,0.04),0 4px 24px rgba(0,0,0,0.35),0 0 20px rgba(124,106,247,0.06)" };
const ITEM_GRADS = [
  { grad:"linear-gradient(145deg,#ff6b00,#ff3d00,#c0392b)", glow:"rgba(255,107,0,0.5)" },
  { grad:"linear-gradient(145deg,#7c6af7,#5b4cf5,#3730a3)", glow:"rgba(124,106,247,0.5)" },
  { grad:"linear-gradient(145deg,#0ea5e9,#0284c7,#1e3a8a)", glow:"rgba(14,165,233,0.5)" },
  { grad:"linear-gradient(145deg,#10b981,#059669,#064e3b)", glow:"rgba(16,185,129,0.5)" },
  { grad:"linear-gradient(145deg,#f59e0b,#d97706,#78350f)", glow:"rgba(245,158,11,0.5)" },
  { grad:"linear-gradient(145deg,#ef4444,#dc2626,#7f1d1d)", glow:"rgba(239,68,68,0.45)" },
  { grad:"linear-gradient(145deg,#06b6d4,#0891b2,#164e63)", glow:"rgba(6,182,212,0.5)" },
  { grad:"linear-gradient(145deg,#8b5cf6,#7c3aed,#4c1d95)", glow:"rgba(139,92,246,0.5)" },
];

type PrinterConfig = { type: "browser" | "network" | "bridge"; ip?: string; port?: number; bridgeUrl?: string; localApiUrl?: string };
function getPrinterConfig(): PrinterConfig {
  try {
    const saved = JSON.parse(localStorage.getItem("printerConfig") ?? "{}");
    return { type: "network", ip: "", port: 9100, ...saved };
  } catch { return { type: "network", ip: "", port: 9100 }; }
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
      // localApiUrl lets the request reach the shop's local API even when the
      // browser is open on the cloud URL (e.g. a kitchen tablet on orders.islandtacosbvi.com).
      const apiBase = cfg.localApiUrl ? cfg.localApiUrl.replace(/\/$/, "") : "";
      const r = await fetch(`${apiBase}/api/print/network`, {
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
  const W = 32; // Munbyn 58mm paper = 32 chars
  // Right-aligns `right` against `left`, truncating left if needed
  const padLine = (left: string, right: string): string => {
    const maxLeft = W - right.length - 1;
    const l = left.length > maxLeft ? left.slice(0, maxLeft - 1) + "." : left;
    return l + " ".repeat(Math.max(1, W - l.length - right.length)) + right;
  };

  const lines: { text: string; bold?: boolean; center?: boolean; size?: string; divider?: boolean }[] = [];

  // ── Header ──────────────────────────────────────────────────────────────────
  lines.push({ text: "================================", center: true });
  // TODO(store-settings): replace "ISLAND TACOS" / address / "(284) 544-8088" with
  // values from useStoreSettings() — receipt text is the single most visible piece
  // of store identity in the SaaS context.
  lines.push({ text: "ISLAND TACOS", bold: true, center: true, size: "large" });
  lines.push({ text: "================================", center: true });
  lines.push({ text: "Wickhams Cay 1, Road Town, BVI", center: true });
  lines.push({ text: "Tel: (284) 544-8088", center: true });
  lines.push({ divider: true, text: "" });

  // ── Order info ──────────────────────────────────────────────────────────────
  lines.push({ text: `Order #${order.confirmationCode}`, bold: true });
  lines.push({ text: new Date(order.createdAt).toLocaleString() });
  lines.push({ text: `Customer: ${order.customerName || "Walk-in"}` });
  if (order.customerPhone) lines.push({ text: `Phone: ${order.customerPhone}` });
  lines.push({ text: `Payment: ${PAY_LABEL[order.paymentMethod] ?? order.paymentMethod}` });
  lines.push({ divider: true, text: "" });

  // ── Items ───────────────────────────────────────────────────────────────────
  for (const item of order.items) {
    const label = `${item.quantity}x ${item.menuItemName}`;
    const price = `$${item.subtotal.toFixed(2)}`;
    lines.push({ text: padLine(label, price), bold: true });
    if (item.modifierSelections?.length) {
      for (const m of item.modifierSelections) {
        lines.push({ text: `  + ${m.name}${m.price > 0 ? ` $${m.price.toFixed(2)}` : ""}` });
      }
    }
    if (item.notes) lines.push({ text: `  Note: ${item.notes}` });
  }

  // ── Totals ──────────────────────────────────────────────────────────────────
  lines.push({ divider: true, text: "" });
  lines.push({ text: padLine("Subtotal:", fmt(order.subtotal)) });
  if (order.discountAmount > 0) lines.push({ text: padLine("Discount:", `-${fmt(order.discountAmount)}`) });
  if (order.tax > 0) lines.push({ text: padLine("Tax:", fmt(order.tax)) });
  lines.push({ text: `TOTAL: ${fmt(order.total)}`, bold: true, size: "large" });
  if (tendered != null) {
    lines.push({ text: padLine("Tendered:", fmt(tendered)) });
    lines.push({ text: padLine("Change:", fmt(Math.max(0, tendered - order.total))) });
  }

  // ── Footer ──────────────────────────────────────────────────────────────────
  lines.push({ text: "================================", center: true });
  lines.push({ text: "** THANK YOU! **", bold: true, center: true });
  lines.push({ text: "orders.islandtacosbvi.com", center: true });
  lines.push({ text: "Hasta luego!", center: true });
  lines.push({ text: "", center: true });
  return lines;
}


// ─── Numpad ──────────────────────────────────────────────────────────────────

function Numpad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // Right-to-left (cents-based) entry: digits represent cents and shift left.
  // e.g. "9" → $0.09 → "99" → $0.99 → "999" → $9.99 → "9999" → $99.99
  // "00" shifts two places: "5" + "00" → $5.00
  // Backspace shifts right: $9.99 → backspace → $0.99
  //
  // "pristine" = value was set externally (initial total or quick-tender chip).
  // First digit typed while pristine REPLACES from zero instead of appending.
  const [cents, setCents] = useState(() => Math.round(parseFloat(value || "0") * 100));
  const [pristine, setPristine] = useState(true);
  const lastSetByNumpad = useRef<string | null>(null);

  useEffect(() => {
    if (value !== lastSetByNumpad.current) {
      setCents(Math.round(parseFloat(value || "0") * 100));
      setPristine(true);
    }
  }, [value]);

  const emit = (c: number) => {
    const v = (c / 100).toFixed(2);
    lastSetByNumpad.current = v;
    setCents(c);
    setPristine(false);
    onChange(v);
  };

  const press = (k: string) => {
    if (k === "⌫") { emit(pristine ? 0 : Math.floor(cents / 10)); return; }
    const base = pristine ? 0 : cents;
    if (k === "00") { const n = base * 100; if (n <= 9_999_999) emit(n); return; }
    const d = parseInt(k, 10);
    if (isNaN(d)) return;
    const n = base * 10 + d;
    if (n <= 9_999_999) emit(n);
  };

  const keys = ["7","8","9","4","5","6","1","2","3","00","0","⌫"];
  return (
    <div className="grid grid-cols-3 gap-2 mt-3">
      {keys.map(k => (
        <button key={k} onClick={() => press(k)}
          style={{ height:56, borderRadius:14, fontSize:20, fontWeight:600, background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.09)", color:IL.tp, cursor:"pointer", fontFamily:"inherit", transition:"background 0.1s" }}>
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
    // Backdrop — flex column so card can be full height up to a max
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4"
      onClick={onClose}
    >
        <div
          style={{ background:IL.card, borderRadius:24, width:"100%", maxWidth:672, boxShadow:"0 24px 80px rgba(0,0,0,0.65),0 0 0 1px rgba(255,255,255,0.06)", display:"flex", flexDirection:"column", maxHeight:"92dvh" }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header — always visible at top */}
          <div className="flex-shrink-0 p-5" style={{ borderBottom:`1px solid ${IL.bord}`, borderRadius:"24px 24px 0 0" }}>
            <h2 style={{ color:IL.tp, fontSize:20, fontWeight:800 }}>{item.name}</h2>
            <p style={{ color:IL.or, fontSize:17, fontWeight:600 }}>{fmt(total)}</p>
          </div>
          {/* Content — scrollable middle */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6" style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
          {modifiers.map(mod => {
            const groupTotal = totalSelForGroup(mod);
            const atMax = mod.maxSelections !== null && groupTotal >= mod.maxSelections;
            return (
              <div key={mod.id}>
                <div className="flex items-center justify-between mb-3">
                  <p style={{ color:IL.mu, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:".08em" }}>{mod.name}</p>
                  <div className="flex items-center gap-1.5">
                    {mod.required && groupTotal === 0 && (
                      <span style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:".04em", color:IL.red, background:"rgba(255,69,58,0.15)", padding:"2px 6px", borderRadius:4 }}>Required</span>
                    )}
                    {mod.minSelections > 0 && (
                      <span style={{ fontSize:11, color:IL.mu }}>
                        {mod.maxSelections === mod.minSelections ? `Pick ${mod.minSelections}` : mod.maxSelections ? `${mod.minSelections}–${mod.maxSelections}` : `Min ${mod.minSelections}`}
                      </span>
                    )}
                    {mod.maxSelections !== null && mod.minSelections === 0 && (
                      <span style={{ fontSize:11, color:IL.mu }}>Up to {mod.maxSelections}</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {mod.options.sort((a, b) => a.position - b.position).map(opt => {
                    const qty = qtys[mod.loyverseId]?.[opt.id] ?? 0;
                    const sel = qty > 0;
                    if (opt.allowMultiple) {
                      return (
                        <div key={opt.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 12px", borderRadius:14, border: sel ? "1px solid rgba(255,107,0,0.5)" : `1px solid ${IL.bord}`, background: sel ? "rgba(255,107,0,0.15)" : "rgba(255,255,255,0.05)" }}>
                          <div style={{ display:"flex", flexDirection:"column", minWidth:0, marginRight:8 }}>
                            <span style={{ fontWeight:500, fontSize:13, lineHeight:1.3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color: sel ? "#fff" : IL.tm }}>{opt.name}</span>
                            {opt.price > 0 && <span style={{ color:IL.or, fontSize:11, fontWeight:600 }}>+{fmt(opt.price)}</span>}
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:4, background:"rgba(255,255,255,0.08)", borderRadius:20, padding:"2px 4px", flexShrink:0 }}>
                            <button
                              style={{ width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", borderRadius:"50%", color: qty===0 ? "rgba(255,255,255,0.25)" : IL.mu, background:"none", border:"none", cursor:qty===0?"not-allowed":"pointer", fontFamily:"inherit", fontSize:18, lineHeight:1 }}
                              onClick={() => changeQty(mod, opt, -1)}
                              disabled={qty === 0}
                            >−</button>
                            <span style={{ width:16, textAlign:"center", fontSize:13, fontWeight:700, color:IL.tp }}>{qty}</span>
                            <button
                              style={{ width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", borderRadius:"50%", color: (atMax||qty>=(opt.maxQuantity??1)) ? "rgba(255,255,255,0.25)" : IL.mu, background:"none", border:"none", cursor:(atMax||qty>=(opt.maxQuantity??1))?"not-allowed":"pointer", fontFamily:"inherit", fontSize:18, lineHeight:1 }}
                              onClick={() => changeQty(mod, opt, 1)}
                              disabled={atMax || qty >= (opt.maxQuantity ?? 1)}
                            >+</button>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <button key={opt.id} onClick={() => changeQty(mod, opt, sel ? -1 : 1)}
                        disabled={!sel && atMax}
                        style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 12px", borderRadius:14, border: sel ? "1px solid rgba(255,107,0,0.5)" : `1px solid ${IL.bord}`, background: sel ? "rgba(255,107,0,0.15)" : "rgba(255,255,255,0.05)", cursor:(!sel&&atMax)?"not-allowed":"pointer", fontFamily:"inherit", opacity:(!sel&&atMax)?0.4:1 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}>
                          <div style={{ width:20, height:20, borderRadius:"50%", border: sel ? "2px solid #ff9500" : `2px solid ${IL.mu}`, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", background: sel ? "#ff9500" : "transparent" }}>
                            {sel && <div style={{ width:8, height:8, borderRadius:"50%", background:"#fff" }} />}
                          </div>
                          <span style={{ fontWeight:500, fontSize:13, lineHeight:1.3, textAlign:"left", color: sel ? "#fff" : IL.tm }}>{opt.name}</span>
                        </div>
                        {opt.price > 0 && <span style={{ color:IL.or, fontSize:11, fontWeight:600, marginLeft:4, flexShrink:0 }}>+{fmt(opt.price)}</span>}
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
          {/* Special instructions — pinned above buttons */}
          <div className="flex-shrink-0 px-5 pb-3 pt-4" style={{ borderTop:`1px solid ${IL.bord}` }}>
            <p style={{ color:IL.mu, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:".08em", marginBottom:8 }}>Special Instructions</p>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. chicken slightly burnt, extra crispy…"
              rows={2}
              style={{ width:"100%", background:"rgba(255,255,255,0.06)", border:`1px solid ${IL.bord}`, borderRadius:12, padding:"10px 12px", color:IL.tp, fontSize:13, resize:"none", outline:"none", fontFamily:"inherit", boxSizing:"border-box" }}
            />
          </div>
          {/* Action buttons — always visible at bottom */}
          <div className="flex-shrink-0 p-5 pt-2 flex gap-3 pb-safe">
            <button onClick={onClose} style={{ flex:1, height:48, borderRadius:14, border:`1px solid ${IL.bord}`, color:IL.mu, background:"none", fontWeight:600, cursor:"pointer", fontFamily:"inherit", fontSize:13 }}>Cancel</button>
            <button onClick={handleConfirm} disabled={!!validationError}
              style={{ flexGrow:2, height:48, borderRadius:14, background:`linear-gradient(135deg,${IL.or},#ff9500)`, border:"none", color:"#fff", fontWeight:700, cursor:"pointer", fontFamily:"inherit", fontSize:14, opacity:validationError?0.5:1, boxShadow:validationError?"none":"0 4px 16px rgba(255,107,0,0.45)" }}>
              Add to Order · {fmt(total)}
            </button>
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
      <div style={{ background:IL.card, borderRadius:24, width:"100%", maxWidth:384, boxShadow:"0 24px 80px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.06)", overflow:"hidden" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding:"20px 20px 16px", borderBottom:`1px solid ${IL.bord}` }}>
          <div style={{ fontSize:16, fontWeight:800, color:IL.tp, letterSpacing:"-0.03em" }}>Collect Payment</div>
          <div style={{ fontSize:34, fontWeight:900, color:IL.or, letterSpacing:"-0.05em", lineHeight:1, marginTop:4 }}>{fmt(total)}</div>
        </div>

        {/* Method tabs */}
        <div style={{ display:"flex", borderBottom:`1px solid ${IL.bord}` }}>
          {TABS.map(m => (
            <button key={m.key} onClick={() => { setTab(m.key as typeof tab); setSplitCollecting(false); }}
              style={{ flex:1, padding:"12px 0", fontSize:12, fontWeight:700, cursor:"pointer", background:"none", border:"none", borderBottom: tab === m.key ? `2px solid ${IL.or}` : "2px solid transparent", color: tab === m.key ? IL.or : IL.mu, transition:"all 0.15s", fontFamily:"inherit" }}>
              {m.label}
            </button>
          ))}
        </div>

        <div style={{ padding:20, overflowY:"auto", maxHeight:"60vh" }}>
          {tab === "cash" && (
            <div>
              <p style={{ color:IL.mu, fontSize:13, marginBottom:8 }}>Amount tendered</p>
              <div style={{ background:"rgba(255,255,255,0.06)", borderRadius:14, padding:"12px 16px", color:IL.tp, fontSize:30, fontFamily:"monospace", fontWeight:700, textAlign:"right", marginBottom:12, border:`1px solid ${IL.bord}` }}>
                ${tendered}
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:8 }}>
                {QUICK.map(q => (
                  <button key={q} onClick={() => setTendered(String(q))}
                    style={{ flex:1, minWidth:56, height:40, borderRadius:12, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", transition:"all 0.12s",
                      background: parseFloat(tendered) === q ? IL.or : "rgba(255,255,255,0.07)",
                      border: parseFloat(tendered) === q ? "none" : `1px solid ${IL.bord}`,
                      color: parseFloat(tendered) === q ? "#fff" : IL.tm }}>
                    {fmt(q)}
                  </button>
                ))}
              </div>
              <Numpad value={tendered} onChange={setTendered} />
              {parseFloat(tendered || "0") >= total ? (
                <div style={{ marginTop:16, background:"rgba(48,209,88,0.1)", border:"1px solid rgba(48,209,88,0.25)", borderRadius:14, padding:"14px 16px", textAlign:"center" }}>
                  <p style={{ color:IL.mu, fontSize:13, marginBottom:2 }}>Change due</p>
                  <p style={{ color:IL.grn, fontSize:30, fontWeight:900 }}>{fmt(change)}</p>
                </div>
              ) : (
                <div style={{ marginTop:16, background:"rgba(255,107,0,0.1)", border:"1px solid rgba(255,107,0,0.25)", borderRadius:14, padding:"14px 16px", textAlign:"center" }}>
                  <p style={{ color:IL.mu, fontSize:13, marginBottom:2 }}>Still owed</p>
                  <p style={{ color:IL.or, fontSize:30, fontWeight:900 }}>{fmt(total - parseFloat(tendered || "0"))}</p>
                </div>
              )}
            </div>
          )}
          {tab === "card" && (
            <div style={{ borderRadius:18, padding:28, textAlign:"center", background:"linear-gradient(145deg,#1e3a8a,#0ea5e9,#0284c7)", boxShadow:"0 8px 28px rgba(14,165,233,0.5)", position:"relative", overflow:"hidden" }}>
              <div style={{ position:"absolute", inset:0, background:"linear-gradient(155deg,rgba(255,255,255,0.12) 0%,transparent 55%)", pointerEvents:"none" }} />
              <div style={{ fontSize:64, marginBottom:14, position:"relative", filter:"drop-shadow(0 6px 16px rgba(14,165,233,0.6))" }}>💳</div>
              <p style={{ color:"#fff", fontWeight:700, marginBottom:6, fontSize:16, position:"relative" }}>Swipe or tap card on terminal</p>
              <p style={{ color:"rgba(255,255,255,0.75)", fontSize:13, position:"relative" }}>Confirm payment of <span style={{ color:"#fff", fontWeight:800 }}>{fmt(total)}</span></p>
            </div>
          )}
          {tab === "athmovil" && (
            <div style={{ borderRadius:18, padding:28, textAlign:"center", background:"linear-gradient(145deg,#7c6af7,#5b4cf5,#3730a3)", boxShadow:"0 8px 28px rgba(124,106,247,0.55)", position:"relative", overflow:"hidden" }}>
              <div style={{ position:"absolute", inset:0, background:"linear-gradient(155deg,rgba(255,255,255,0.12) 0%,transparent 55%)", pointerEvents:"none" }} />
              <div style={{ fontSize:64, marginBottom:14, position:"relative", filter:"drop-shadow(0 6px 16px rgba(124,106,247,0.6))" }}>📱</div>
              <p style={{ color:"#fff", fontWeight:700, marginBottom:6, fontSize:16, position:"relative" }}>ATH Móvil payment</p>
              <p style={{ color:"rgba(255,255,255,0.75)", fontSize:13, position:"relative" }}>Confirm receipt of <span style={{ color:"#fff", fontWeight:800 }}>{fmt(total)}</span></p>
            </div>
          )}
          {tab === "split" && !splitCollecting && (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {(["cash", "card", "athmovil"] as const).map(k => {
                const isActive = splitActive === k;
                const amt = splitParsed[k];
                return (
                  <button key={k} onClick={() => setSplitActive(k)}
                    style={{ display:"flex", alignItems:"center", gap:12, borderRadius:14, padding:"12px 16px", border: isActive ? `1px solid ${IL.or}` : `1px solid ${IL.bord}`, background: isActive ? "rgba(255,107,0,0.1)" : "rgba(255,255,255,0.04)", cursor:"pointer", fontFamily:"inherit" }}>
                    <span style={{ fontSize:22 }}>{SPLIT_METHOD_LABELS[k].icon}</span>
                    <span style={{ fontWeight:600, flex:1, textAlign:"left", color: isActive ? IL.tp : IL.tm }}>{SPLIT_METHOD_LABELS[k].label}</span>
                    <span style={{ fontSize:18, fontWeight:900, fontFamily:"monospace", color: amt > 0 ? (isActive ? IL.or : IL.tp) : IL.mu }}>{fmt(amt)}</span>
                  </button>
                );
              })}
              <div style={{ borderRadius:14, padding:"10px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", background: splitReady ? "rgba(48,209,88,0.1)" : "rgba(255,255,255,0.04)", border: splitReady ? "1px solid rgba(48,209,88,0.25)" : `1px solid ${IL.bord}` }}>
                <span style={{ color:IL.mu, fontSize:13, fontWeight:600 }}>{splitReady ? "Ready!" : splitRemaining < 0 ? "Over by" : "Remaining"}</span>
                <span style={{ fontSize:16, fontWeight:900, color: splitReady ? IL.grn : splitRemaining < 0 ? IL.red : IL.tp }}>{splitReady ? "✓ " + fmt(total) : fmt(Math.abs(splitRemaining))}</span>
              </div>
              <Numpad value={splitAmounts[splitActive]} onChange={v => setSplitAmounts(prev => ({ ...prev, [splitActive]: v }))} />
              {onSplit && (
                <button onClick={() => { onClose(); onSplit(); }}
                  style={{ width:"100%", height:40, borderRadius:14, border:`1px solid ${IL.bord}`, color:IL.mu, background:"none", fontSize:13, fontWeight:600, cursor:"pointer", marginTop:4, fontFamily:"inherit" }}>
                  Switch to split by item instead
                </button>
              )}
            </div>
          )}
          {tab === "split" && splitCollecting && (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <p style={{ color:IL.mu, fontSize:11, textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:700 }}>Collect from customer</p>
              {activeSplitMethods.map(k => (
                <div key={k} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"rgba(255,255,255,0.05)", borderRadius:14, padding:"14px 16px", border:`1px solid ${IL.bord}` }}>
                  <span style={{ color:IL.tp, fontSize:14, fontWeight:600 }}>{SPLIT_METHOD_LABELS[k].icon} {SPLIT_METHOD_LABELS[k].label}</span>
                  <span style={{ color:IL.or, fontSize:22, fontWeight:900, fontFamily:"monospace" }}>{fmt(splitParsed[k])}</span>
                </div>
              ))}
              {splitParsed.cash > 0 && (() => {
                const cashChange = Math.max(0, splitParsed.cash - (total - splitParsed.card - splitParsed.athmovil));
                return cashChange > 0.005 ? (
                  <div style={{ background:"rgba(48,209,88,0.1)", borderRadius:14, padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", border:"1px solid rgba(48,209,88,0.25)" }}>
                    <span style={{ color:IL.grn, fontSize:13, fontWeight:600 }}>Cash change due</span>
                    <span style={{ color:IL.grn, fontSize:20, fontWeight:900 }}>{fmt(cashChange)}</span>
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </div>

        <div style={{ padding:20, borderTop:`1px solid ${IL.bord}`, display:"flex", gap:12 }}>
          <button onClick={onClose} style={{ height:48, padding:"0 20px", borderRadius:14, border:`1px solid ${IL.bord}`, color:IL.tm, background:"none", fontWeight:600, cursor:"pointer", fontFamily:"inherit", fontSize:14 }}>Cancel</button>
          {tab === "split" && !splitCollecting && (
            <button disabled={!splitReady} onClick={() => setSplitCollecting(true)}
              style={{ flex:1, height:48, borderRadius:14, background: splitReady ? IL.or : "rgba(255,107,0,0.2)", border:"none", color:"#fff", fontWeight:900, fontSize:14, cursor: splitReady ? "pointer" : "default", opacity: splitReady ? 1 : 0.5, fontFamily:"inherit" }}>
              ✂ Confirm Split
            </button>
          )}
          {tab === "split" && splitCollecting && (
            <button onClick={() => onPay("split", undefined, buildSplitNote())}
              style={{ flex:1, height:48, borderRadius:14, background:"linear-gradient(135deg,#10b981,#059669)", border:"none", color:"#fff", fontWeight:900, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>
              Mark as Paid
            </button>
          )}
          {tab !== "split" && (
            <div style={{ flex:1, display:"flex", flexDirection:"column", gap:8 }}>
              {onPayAndHold && (
                <button disabled={tab === "cash" && parseFloat(tendered || "0") < total}
                  onClick={() => onPayAndHold(tab, tab === "cash" ? parseFloat(tendered) : undefined)}
                  style={{ width:"100%", height:44, borderRadius:14, background:"rgba(245,158,11,0.15)", border:"1px solid rgba(245,158,11,0.35)", color:"#fbbf24", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit", opacity:(tab==="cash"&&parseFloat(tendered||"0")<total)?0.3:1 }}>
                  ⏸ Charge & Hold
                </button>
              )}
              <button disabled={tab === "cash" && parseFloat(tendered || "0") < total}
                onClick={() => onPay(tab, tab === "cash" ? parseFloat(tendered) : undefined)}
                style={{ width:"100%", height:48, borderRadius:14, background:"linear-gradient(135deg,#10b981,#059669)", border:"none", color:"#fff", fontWeight:900, fontSize:16, cursor:"pointer", fontFamily:"inherit", boxShadow:"0 4px 18px rgba(16,185,129,0.4)", opacity:(tab==="cash"&&parseFloat(tendered||"0")<total)?0.3:1 }}>
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
      <div style={{ background:IL.card, borderRadius:24, width:"100%", maxWidth:384, boxShadow:"0 24px 80px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.06)", overflow:"hidden" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding:"16px 20px", borderBottom:`1px solid ${IL.bord}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontSize:16, fontWeight:800, color:IL.tp }}>Receipt</div>
          <span style={{ color:IL.grn, fontWeight:700, fontSize:13 }}>✓ Order placed</span>
        </div>
        <div style={{ padding:20, maxHeight:384, overflowY:"auto" }}>
          <div ref={printRef} style={{ fontFamily:"monospace", fontSize:13, color:IL.tp }}>
            <div style={{ textAlign:"center", marginBottom:12 }}>
              <div style={{ fontWeight:700, fontSize:14 }}>ISLAND TACOS</div>
              <div style={{ color:IL.mu, fontSize:11 }}>Wickhams Cay 1, Road Town, BVI</div>
              <div style={{ color:IL.mu, fontSize:11 }}>(284) 000-0000</div>
            </div>
            <div style={{ borderTop:`1px dashed ${IL.bord}`, margin:"8px 0" }}/>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:IL.mu, marginBottom:4 }}>
              <span>#{order.confirmationCode}</span>
              <span>{new Date(order.createdAt).toLocaleString()}</span>
            </div>
            {order.customerName && <div style={{ fontSize:11, color:IL.mu, marginBottom:8 }}>Customer: {order.customerName}</div>}
            <div style={{ borderTop:`1px dashed ${IL.bord}`, margin:"8px 0" }}/>
            {order.items.map((item, i) => (
              <div key={i} style={{ marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:IL.tp }}>
                  <span>{item.quantity}× {item.menuItemName}</span>
                  <span>{fmt(item.subtotal)}</span>
                </div>
                {item.modifierSelections?.map((m, j) => (
                  <div key={j} style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:IL.mu, paddingLeft:16 }}>
                    <span>+ {m.name}</span>
                    {m.price > 0 && <span>+{fmt(m.price)}</span>}
                  </div>
                ))}
                {item.notes && <div style={{ fontSize:11, color:IL.mu, paddingLeft:16 }}>Note: {item.notes}</div>}
              </div>
            ))}
            <div style={{ borderTop:`1px dashed ${IL.bord}`, margin:"8px 0" }}/>
            <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:IL.tm }}><span>Subtotal</span><span>{fmt(order.subtotal)}</span></div>
              {order.discountAmount > 0 && <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:IL.grn }}><span>Discount</span><span>-{fmt(order.discountAmount)}</span></div>}
              {order.tax > 0 && <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:IL.tm }}><span>Tax</span><span>{fmt(order.tax)}</span></div>}
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:15, fontWeight:700, color:IL.tp, borderTop:`1px solid ${IL.bord}`, paddingTop:6, marginTop:3 }}>
                <span>TOTAL</span><span style={{ color:IL.or }}>{fmt(order.total)}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:IL.mu }}>
                <span>Payment</span>
                <span>{order.paymentMethod === "athmovil" ? "ATH Móvil" : order.paymentMethod}</span>
              </div>
              {tendered != null && <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:IL.mu }}><span>Tendered</span><span>{fmt(tendered)}</span></div>}
              {change != null && change > 0 && <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, fontWeight:600, color:IL.grn }}><span>Change</span><span>{fmt(change)}</span></div>}
            </div>
            <div style={{ borderTop:`1px dashed ${IL.bord}`, margin:"12px 0" }}/>
            <div style={{ textAlign:"center", color:IL.mu, fontSize:11 }}>
              <div>Gracias · Thank you!</div>
              <div style={{ marginTop:4 }}>Order online at islandtacos.com</div>
            </div>
          </div>
        </div>
        <div style={{ padding:20, borderTop:`1px solid ${IL.bord}`, display:"flex", gap:12 }}>
          <button onClick={print} style={{ flex:1, height:48, borderRadius:14, border:`1px solid ${IL.bord}`, color:IL.tm, background:"none", fontWeight:600, cursor:"pointer", fontFamily:"inherit", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
            🖨️ Print
          </button>
          <button onClick={onClose} style={{ flex:1, height:48, borderRadius:14, background:`linear-gradient(135deg,${IL.or},#ff9500)`, border:"none", color:"#fff", fontWeight:900, cursor:"pointer", fontFamily:"inherit", fontSize:14, boxShadow:"0 4px 18px rgba(255,107,0,0.4)" }}>
            New Order
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Hold Modal ───────────────────────────────────────────────────────────────

interface CustomerSuggestion { id: number; name: string; phone: string | null; email: string | null; }

function HoldModal({ initialName, initialPhone, initialNote, onHold, onClose }: {
  initialName: string; initialPhone: string; initialNote: string;
  onHold: (name: string, phone: string, note: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
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

  const ilInput: React.CSSProperties = { width:"100%", background:"rgba(255,255,255,0.06)", border:`1px solid ${IL.bord}`, borderRadius:14, padding:"10px 16px", color:IL.tp, fontSize:14, outline:"none", fontFamily:"inherit" };
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div style={{ background:IL.card, borderRadius:24, width:"100%", maxWidth:384, boxShadow:"0 24px 80px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.06)", overflow:"hidden" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding:"20px 20px 16px", borderBottom:`1px solid ${IL.bord}` }}>
          <div style={{ fontSize:16, fontWeight:800, color:IL.tp }}>Hold Ticket</div>
          <p style={{ color:IL.mu, fontSize:13, marginTop:4 }}>Save this order to resume and charge later.</p>
        </div>
        <div style={{ padding:20, display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ position:"relative" }}>
            <label style={{ color:IL.mu, fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", display:"block", marginBottom:6 }}>Customer Name</label>
            <input ref={nameInputRef} value={name}
              onChange={e => { setName(e.target.value); setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="e.g. Maria" style={{ ...ilInput }} />
            {showSuggestions && suggestions.length > 0 && (
              <div style={{ position:"absolute", left:0, right:0, top:"100%", marginTop:4, background:IL.hdr, border:`1px solid ${IL.bord}`, borderRadius:14, boxShadow:"0 12px 40px rgba(0,0,0,0.5)", zIndex:10, overflow:"hidden" }}>
                {suggestions.map(c => (
                  <button key={c.id} onMouseDown={() => fillCustomer(c)}
                    style={{ width:"100%", textAlign:"left", padding:"12px 16px", borderBottom:`1px solid ${IL.bord}`, background:"none", cursor:"pointer", fontFamily:"inherit" }}>
                    <p style={{ color:IL.tp, fontSize:13, fontWeight:600 }}>{c.name}</p>
                    {(c.phone || c.email) && <p style={{ color:IL.mu, fontSize:11, marginTop:2 }}>{c.phone ?? c.email}</p>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label style={{ color:IL.mu, fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", display:"block", marginBottom:6 }}>Phone (optional)</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 284-555-0100" type="tel" style={{ ...ilInput }} />
          </div>
          <div>
            <label style={{ color:IL.mu, fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", display:"block", marginBottom:6 }}>Comment (optional)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              placeholder="Special instructions, table number…"
              style={{ ...ilInput, resize:"none", height:80 }} />
          </div>
        </div>
        <div style={{ padding:20, borderTop:`1px solid ${IL.bord}`, display:"flex", gap:12 }}>
          <button onClick={onClose} style={{ flex:1, height:48, borderRadius:14, border:`1px solid ${IL.bord}`, color:IL.tm, background:"none", fontWeight:600, cursor:"pointer", fontFamily:"inherit", fontSize:14 }}>Cancel</button>
          <button onClick={() => onHold(name.trim(), phone.trim(), note.trim())}
            style={{ flex:1, height:48, borderRadius:14, background:`linear-gradient(135deg,${IL.or},#ff9500)`, border:"none", color:"#fff", fontWeight:900, cursor:"pointer", fontFamily:"inherit", fontSize:14, boxShadow:"0 4px 18px rgba(255,107,0,0.4)" }}>
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
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div style={{ background:IL.card, borderRadius:24, width:"100%", maxWidth:320, boxShadow:"0 24px 80px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.06)", overflow:"hidden" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding:"20px 20px 16px", borderBottom:`1px solid ${IL.bord}` }}>
          <div style={{ fontSize:16, fontWeight:800, color:IL.tp }}>Apply Discount</div>
        </div>
        <div style={{ padding:20 }}>
          <div style={{ display:"flex", gap:8, marginBottom:16 }}>
            <button onClick={() => setType("pct")} style={{ flex:1, height:40, borderRadius:12, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", background: type==="pct" ? IL.or : "rgba(255,255,255,0.07)", border: type==="pct" ? "none" : `1px solid ${IL.bord}`, color: type==="pct" ? "#fff" : IL.tm }}>Percent %</button>
            <button onClick={() => setType("amt")} style={{ flex:1, height:40, borderRadius:12, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", background: type==="amt" ? IL.or : "rgba(255,255,255,0.07)", border: type==="amt" ? "none" : `1px solid ${IL.bord}`, color: type==="amt" ? "#fff" : IL.tm }}>Amount $</button>
          </div>
          <div style={{ background:"rgba(255,255,255,0.06)", borderRadius:14, padding:"12px 16px", color:IL.tp, fontSize:30, fontFamily:"monospace", fontWeight:700, textAlign:"right", marginBottom:8, border:`1px solid ${IL.bord}` }}>
            {type === "pct" ? `${val}%` : `$${val}`}
          </div>
          {discAmt > 0 && (
            <p style={{ color:IL.grn, fontSize:13, textAlign:"center", marginBottom:8 }}>Saves {fmt(discAmt)} off {fmt(subtotal)}</p>
          )}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:8 }}>
            {(type === "pct" ? [5,10,15,20] : [1,2,5,10]).map(q => (
              <button key={q} onClick={() => setVal(String(q))}
                style={{ height:40, borderRadius:12, background:"rgba(255,255,255,0.07)", border:`1px solid ${IL.bord}`, color:IL.tm, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                {type === "pct" ? `${q}%` : fmt(q)}
              </button>
            ))}
          </div>
          <Numpad value={val} onChange={setVal} />
        </div>
        <div style={{ padding:20, borderTop:`1px solid ${IL.bord}`, display:"flex", gap:12 }}>
          <button onClick={onClose} style={{ flex:1, height:48, borderRadius:14, border:`1px solid ${IL.bord}`, color:IL.tm, background:"none", fontWeight:600, cursor:"pointer", fontFamily:"inherit", fontSize:14 }}>Cancel</button>
          <button onClick={() => { onApply(discAmt); onClose(); }} disabled={discAmt <= 0}
            style={{ flex:1, height:48, borderRadius:14, background:`linear-gradient(135deg,${IL.grn},#059669)`, border:"none", color:"#fff", fontWeight:900, cursor: discAmt>0?"pointer":"default", fontFamily:"inherit", fontSize:14, opacity:discAmt>0?1:0.3, boxShadow: discAmt>0?"0 4px 18px rgba(48,209,88,0.35)":"none" }}>
            Apply -{fmt(discAmt)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Open-Price Modal (custom-priced item, e.g. "Misc") ─────────────────────

function OpenPriceModal({ item, onConfirm, onClose, initialPrice, initialNote }: {
  item: MenuItem;
  onConfirm: (price: number, note: string) => void;
  onClose: () => void;
  initialPrice?: number;
  initialNote?: string;
}) {
  const [val, setVal] = useState(initialPrice && initialPrice > 0 ? initialPrice.toFixed(2) : "0");
  const [note, setNote] = useState(initialNote ?? "");
  const price = parseFloat(val || "0");
  const valid = Number.isFinite(price) && price > 0 && note.trim().length > 0;
  const isEdit = initialPrice !== undefined;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div style={{ background:IL.card, borderRadius:24, width:"100%", maxWidth:320, boxShadow:"0 24px 80px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.06)", overflow:"hidden" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding:"20px 20px 16px", borderBottom:`1px solid ${IL.bord}` }}>
          <div style={{ fontSize:16, fontWeight:800, color:IL.tp }}>{item.name}</div>
          <p style={{ color:IL.mu, fontSize:12, marginTop:4 }}>Set price and describe the item</p>
        </div>
        <div style={{ padding:20 }}>
          <div style={{ background:"rgba(255,255,255,0.06)", borderRadius:14, padding:"12px 16px", color:IL.tp, fontSize:30, fontFamily:"monospace", fontWeight:700, textAlign:"right", marginBottom:12, border:`1px solid ${IL.bord}` }}>
            ${val}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:8 }}>
            {[1, 2, 5, 10].map(q => (
              <button key={q} onClick={() => setVal(String(q))}
                style={{ height:40, borderRadius:12, background:"rgba(255,255,255,0.07)", border:`1px solid ${IL.bord}`, color:IL.tm, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                {fmt(q)}
              </button>
            ))}
          </div>
          <Numpad value={val} onChange={setVal} />
          <div style={{ marginTop:12 }}>
            <label style={{ color:IL.mu, fontSize:11, fontWeight:700, display:"block", marginBottom:6 }}>Description (required)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              placeholder="What is this item? Goes on the receipt + KDS." rows={2}
              style={{ width:"100%", background:"rgba(255,255,255,0.06)", border:`1px solid ${IL.bord}`, borderRadius:14, padding:"10px 14px", color:IL.tp, fontSize:13, outline:"none", resize:"none", fontFamily:"inherit", boxSizing:"border-box" }} />
          </div>
        </div>
        <div style={{ padding:20, borderTop:`1px solid ${IL.bord}`, display:"flex", gap:12 }}>
          <button onClick={onClose} style={{ flex:1, height:48, borderRadius:14, border:`1px solid ${IL.bord}`, color:IL.tm, background:"none", fontWeight:600, cursor:"pointer", fontFamily:"inherit", fontSize:14 }}>Cancel</button>
          <button onClick={() => { onConfirm(price, note.trim()); }} disabled={!valid}
            style={{ flex:1, height:48, borderRadius:14, background:`linear-gradient(135deg,${IL.or},#ff9500)`, border:"none", color:"#fff", fontWeight:900, cursor: valid?"pointer":"default", fontFamily:"inherit", fontSize:14, opacity:valid?1:0.3, boxShadow: valid?"0 4px 18px rgba(255,107,0,0.4)":"none" }}>
            {isEdit ? "Save" : "Add"} {price > 0 ? fmt(price) : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tickets Drawer (Held + Live Queue tabs) ─────────────────────────────────

function elapsedLabel(createdAt: string, now: number): { label: string; cls: string } {
  const mins = Math.floor((now - new Date(createdAt).getTime()) / 60000);
  const label = mins < 1 ? "just now" : mins < 60 ? `${mins} min ago` : `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
  const cls = mins < 15 ? "text-green-600 bg-green-50" : mins < 30 ? "text-amber-600 bg-amber-50" : "text-red-600 bg-red-50";
  return { label, cls };
}

function TicketsDrawer({ onResume, onClose, onPaymentComplete }: {
  onResume: (items: CartItem[], name: string, phone: string, note: string, discount: number, orderId: number) => void;
  onClose: () => void;
  onPaymentComplete: (order: Order, tendered?: number) => void;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [chargeOrder, setChargeOrder] = useState<Order | null>(null);
  const [splitChargeOrder, setSplitChargeOrder] = useState<Order | null>(null);
  const [now, setNow] = useState(Date.now());
  const [search, setSearch] = useState("");

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    const qDigits = q.replace(/\D/g, "");
    return orders.filter(o => {
      if ((o.customerName ?? "").toLowerCase().includes(q)) return true;
      if ((o.confirmationCode ?? "").toLowerCase().includes(q)) return true;
      if (qDigits && o.customerPhone) {
        const phoneDigits = o.customerPhone.replace(/\D/g, "");
        if (phoneDigits.endsWith(qDigits)) return true;
      }
      if (o.items.some(i => (i.menuItemName ?? "").toLowerCase().includes(q))) return true;
      return false;
    });
  }, [orders, search]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/orders", { credentials: "include", headers: authHeaders() });
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
    onResume(items, o.customerName, o.customerPhone ?? "", o.notes ?? "", o.discountAmount, o.id);
    onClose();
  };

  // Push saved ticket to customer display when charging directly (without loading into cart)
  const chargeTicket = (o: Order) => {
    // DB returns numeric fields as strings — coerce everything to number before sending
    const n = (v: unknown) => parseFloat(String(v)) || 0;
    fetch("/api/display", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders() },
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
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ status: "cancelled" }),
    });
    load();
  };

  const updateStatus = async (id: number, status: string) => {
    await fetch(`/api/orders/${id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ status }),
    });
    load();
  };

  const completeWithPayment = async (method: string, tendered?: number, splitNote?: string) => {
    if (!chargeOrder) return;
    const notes = splitNote
      ? (chargeOrder.notes ? `${chargeOrder.notes}\n${splitNote}` : splitNote)
      : chargeOrder.notes;
    const r = await fetch(`/api/orders/${chargeOrder.id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      // Set status:"completed" so the ticket is removed from held tickets.
      // "Charge & Hold" (completeWithPaymentAndHold) intentionally omits this.
      body: JSON.stringify({ actualPaymentMethod: method, paymentStatus: "paid", status: "completed", ...(tendered != null ? { amountTendered: tendered } : {}), ...(notes ? { notes } : {}) }),
    });
    if (!r.ok) {
      const errData = await r.json().catch(() => ({})) as { error?: string };
      alert(errData.error ?? `Failed to save payment (${r.status}). Please try again.`);
      return;
    }
    // Update customer display to "completed" state
    fetch("/api/display", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders() },
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
    const r = await fetch(`/api/orders/${chargeOrder.id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ actualPaymentMethod: method, paymentStatus: "paid", ...(tendered != null ? { amountTendered: tendered } : {}), ...(notes ? { notes } : {}) }),
    });
    if (!r.ok) { alert("Failed to save payment. Please try again."); return; }
    setChargeOrder(null);
    await load(); // ticket stays in list (status is still "confirmed", not "completed")
  };

  const completeOrder = async (id: number) => {
    await fetch(`/api/orders/${id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ status: "completed" }),
    });
    load();
  };

  const completeWithSplit = async (_groups: SplitGroup[], note: string, order: Order) => {
    const existingNotes = order.notes ? `${order.notes}\n${note}` : note;
    await fetch(`/api/orders/${order.id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders() },
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
      <div className="fixed inset-0 bg-black/75 flex justify-end z-50" onClick={onClose}>
        <div className="w-full max-w-sm h-full flex flex-col shadow-2xl" style={{ background:IL.hdr }} onClick={e => e.stopPropagation()}>
          <div className="p-5 flex items-center justify-between" style={{ borderBottom:`1px solid ${IL.bord}` }}>
            <h2 style={{ color:IL.tp, fontSize:20, fontWeight:800 }}>
              Orders{orders.length > 0 ? (search.trim() ? ` (${filteredOrders.length} of ${orders.length})` : ` (${orders.length})`) : ""}
            </h2>
            <button onClick={onClose} style={{ color:IL.mu, fontSize:28, background:"none", border:"none", cursor:"pointer", lineHeight:1, fontFamily:"inherit" }}>×</button>
          </div>

          {orders.length > 0 && (
            <div className="px-4 pt-3 pb-2 sticky top-0 z-10" style={{ borderBottom:`1px solid ${IL.bord}`, background:IL.hdr }}>
              <div className="relative">
                <input
                  type="search"
                  inputMode="search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search name, code, item, or last 4 of phone…"
                  style={{ width:"100%", background:"rgba(255,255,255,0.06)", border:`1px solid ${IL.bord}`, borderRadius:12, paddingLeft:36, paddingRight:36, paddingTop:10, paddingBottom:10, fontSize:13, color:IL.tp, outline:"none", fontFamily:"inherit" }}
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:IL.mu, fontSize:14, pointerEvents:"none" }}>🔍</span>
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                    style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", width:22, height:22, borderRadius:"50%", background:"rgba(255,255,255,0.15)", border:"none", color:IL.tm, fontSize:12, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontFamily:"inherit" }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading && <p style={{ color:IL.mu, textAlign:"center", padding:"32px 0" }}>Loading…</p>}
            {!loading && orders.length === 0 && <p style={{ color:IL.mu, textAlign:"center", padding:"32px 0" }}>No active orders</p>}
            {!loading && orders.length > 0 && filteredOrders.length === 0 && (
              <p style={{ color:IL.mu, textAlign:"center", padding:"32px 0" }}>No orders match "{search}"</p>
            )}
            {!loading && filteredOrders.map(o => {
              const { grad: tg, glow: tGw } = ITEM_GRADS[o.id % ITEM_GRADS.length];
              return (
              <div key={o.id} style={{ background:tg, borderRadius:16, padding:14, boxShadow:`0 4px 20px ${tGw}`, position:"relative", overflow:"hidden" }}>
                <div style={{ position:"absolute", inset:0, background:"linear-gradient(155deg,rgba(255,255,255,0.10) 0%,transparent 55%)", pointerEvents:"none", zIndex:0 }} />
                <div style={{ position:"relative", zIndex:1 }}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p style={{ color:"#fff", fontWeight:800, fontSize:15, lineHeight:1.2 }}>{o.customerName || "Walk-in"}</p>
                    {o.customerPhone && (
                      <a href={`tel:${o.customerPhone}`} style={{ color:"rgba(255,255,255,0.85)", fontSize:13, fontWeight:600, display:"block", marginTop:2, textDecoration:"none" }}>
                        📞 {o.customerPhone}
                      </a>
                    )}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span style={{ color:"rgba(255,255,255,0.6)", fontSize:11, fontFamily:"monospace" }}>#{o.confirmationCode}</span>
                      <span style={{ color:"#fff", fontSize:11, fontWeight:700, background:"rgba(0,0,0,0.28)", borderRadius:6, padding:"1px 6px" }}>
                        {STATUS_LABEL[o.status] ?? o.status}
                      </span>
                      {o.scheduledPickupAt && (
                        <span style={{ fontSize:11, color:"#fff", background:"rgba(0,0,0,0.28)", borderRadius:6, padding:"1px 6px", fontWeight:600 }}>
                          ⏰ {new Date(o.scheduledPickupAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Puerto_Rico" })}
                        </span>
                      )}
                      <span style={{ fontSize:11, color:"#fff", background:"rgba(0,0,0,0.28)", borderRadius:6, padding:"1px 6px", fontWeight:600 }}>
                        {o.source === "pos" ? "POS" : o.source === "phone" ? "📞 Phone" : "Online"}
                      </span>
                      {(() => { const e = elapsedLabel(o.createdAt, now); const urgent = e.cls.includes("red"); return <span style={{ fontSize:11, color: urgent ? "#fca5a5" : "rgba(255,255,255,0.8)", background:"rgba(0,0,0,0.28)", borderRadius:6, padding:"1px 6px", fontWeight:600 }}>⏱ {e.label}</span>; })()}
                    </div>
                  </div>
                  <span style={{ color:"#fff", fontWeight:800, fontSize:16, flexShrink:0 }}>{fmt(o.total)}</span>
                </div>
                <div className="mb-2 space-y-0.5">
                  {o.items.map((i, idx) => {
                    const mods = i.modifierSelections?.length ? ` (${i.modifierSelections.map(m => m.name).join(", ")})` : "";
                    return (
                      <div key={idx} style={{ color:"rgba(255,255,255,0.75)", fontSize:12, lineHeight:1.4 }}>
                        <span style={{ fontWeight:700, color:"#fff" }}>{i.quantity}×</span> {i.menuItemName}{mods}
                      </div>
                    );
                  })}
                </div>
                {o.notes && <p style={{ color:"rgba(255,255,255,0.65)", fontSize:11, fontStyle:"italic", marginBottom:8 }}>"{o.notes}"</p>}
                {o.paymentStatus === "paid" && o.source === "pos" && (
                  <div className="mb-2 flex items-center gap-2 rounded-lg px-3 py-2" style={{ background:"rgba(48,209,88,0.22)", border:"1px solid rgba(48,209,88,0.45)" }}>
                    <span style={{ color:"#6ee7a0", fontSize:13, fontWeight:700 }}>✓ Pre-paid</span>
                    <span style={{ color:"#6ee7a0", fontSize:13 }}>{PAY_LABEL[o.paymentMethod] ?? o.paymentMethod}</span>
                    <span style={{ color:"rgba(110,231,160,0.7)", fontSize:11, marginLeft:"auto" }}>awaiting pickup</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {o.status === "pending" && (o.source === "online" || o.source === "phone") && (
                    <>
                      <button onClick={() => updateStatus(o.id, "confirmed")} style={{ flex:1, height:40, borderRadius:10, background:"rgba(255,255,255,0.25)", border:"1px solid rgba(255,255,255,0.35)", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Accept</button>
                      <button onClick={() => updateStatus(o.id, "cancelled")} style={{ height:40, padding:"0 12px", borderRadius:10, background:"rgba(255,69,58,0.3)", border:"1px solid rgba(255,69,58,0.5)", color:"#ffa5a1", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Reject</button>
                    </>
                  )}
                  {o.status === "confirmed" && (
                    <button onClick={() => updateStatus(o.id, "preparing")} style={{ flex:1, height:40, borderRadius:10, background:"rgba(255,107,0,0.35)", border:"1px solid rgba(255,107,0,0.55)", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Start Cooking</button>
                  )}
                  {o.status === "preparing" && (
                    <button onClick={() => updateStatus(o.id, "ready")} style={{ flex:1, height:40, borderRadius:10, background:"rgba(48,209,88,0.3)", border:"1px solid rgba(48,209,88,0.55)", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Mark Ready</button>
                  )}
                  {o.paymentStatus === "pending" && (
                    <button onClick={() => resume(o)} style={{ height:40, padding:"0 12px", borderRadius:10, background:"rgba(255,255,255,0.2)", border:"1px solid rgba(255,255,255,0.3)", color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Edit</button>
                  )}
                  {o.paymentStatus === "pending" ? (
                    <button onClick={() => chargeTicket(o)} style={{ flex:1, height:40, borderRadius:10, background:`linear-gradient(135deg,${IL.or},#ff9500)`, border:"none", color:"#fff", fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:"inherit", boxShadow:"0 3px 14px rgba(255,107,0,0.55)" }}>
                      Charge {fmt(o.total)}
                    </button>
                  ) : o.status === "ready" ? (
                    <button onClick={() => completeOrder(o.id)} style={{ flex:1, height:40, borderRadius:10, background:"linear-gradient(135deg,#10b981,#059669)", border:"none", color:"#fff", fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:"inherit", boxShadow:"0 3px 14px rgba(16,185,129,0.55)" }}>
                      ✓ Complete & Receipt
                    </button>
                  ) : (
                    <button disabled style={{ flex:1, height:40, borderRadius:10, background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.15)", color:"rgba(255,255,255,0.4)", fontSize:13, cursor:"not-allowed", fontFamily:"inherit" }}>
                      Pre-paid — awaiting kitchen
                    </button>
                  )}
                  <button onClick={() => voidTicket(o.id)} style={{ height:40, padding:"0 12px", borderRadius:10, background:"rgba(255,69,58,0.25)", border:"1px solid rgba(255,69,58,0.45)", color:"#ffa5a1", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Void</button>
                </div>
                </div>
              </div>
              );
            })}
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
              credentials: "include",
              headers: { "Content-Type": "application/json", ...authHeaders() },
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
// MEMOIZED. The parent POS component re-renders every 8s when the order poll
// returns, and on every cart change, search keystroke, etc. Without this memo,
// 100+ ItemCard + RetryImg components re-render and remount their image state
// each time → 1-2s main-thread freeze on the mini PC, exactly matching the
// "POS randomly freezes while scrolling" symptom reported 2026-05-20.
//
// Comparator intentionally ignores `onClick` identity — the parent recreates
// it inline (`() => addItem(item)`) on every render, but the behaviour is
// identical for a given `item`, so a referential change is meaningless. The
// `item` itself comes from state set once by the menu fetch, so identity is
// stable across renders.

const ItemCard = memo(function ItemCard({ item, onClick }: { item: MenuItem; onClick: () => void }) {
  const { grad, glow } = ITEM_GRADS[item.id % ITEM_GRADS.length];
  const hasImg = !!(item.posImageUrl ?? item.imageUrl);
  return (
    <button onClick={onClick} style={{ position:"relative", display:"block", cursor:"pointer", background:"none", border:"none", padding:0, paddingTop: hasImg ? 0 : 30, textAlign:"left", width:"100%" }}>
      {!hasImg && (
        <div style={{ position:"absolute", top:-24, left:"50%", transform:"translateX(-50%)", zIndex:5, pointerEvents:"none", filter:`drop-shadow(0 6px 14px ${glow})`, fontSize:46, lineHeight:1 }}>🌮</div>
      )}
      <div style={{ background: grad, borderRadius:18, position:"relative", overflow:"hidden", boxShadow:`0 6px 22px ${glow}`, width:"100%" }}>
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(155deg,rgba(255,255,255,0.08) 0%,transparent 50%)", pointerEvents:"none", zIndex:1 }} />
        {hasImg && (
          <div style={{ position:"relative", width:"100%", aspectRatio:"1", overflow:"hidden" }}>
            <RetryImg src={(item.posImageUrl ?? item.imageUrl)!} alt={item.name} className="w-full h-full object-cover"/>
            <div style={{ position:"absolute", bottom:0, left:0, right:0, height:60, background:"linear-gradient(to top,rgba(14,16,32,0.92),transparent)", pointerEvents:"none" }} />
          </div>
        )}
        {!item.available && (
          <span style={{ position:"absolute", top:8, left:8, background:"rgba(255,69,58,0.9)", color:"#fff", fontSize:9, fontWeight:700, padding:"2px 6px", borderRadius:6, lineHeight:1.4, zIndex:3 }}>🌐 ONLINE OFF</span>
        )}
        <div style={{ paddingTop: hasImg ? 6 : 36, paddingBottom:14, paddingLeft:12, paddingRight:12, position:"relative", zIndex:2, textAlign:"center" }}>
          <div style={{ fontSize:12, fontWeight:800, color:"#fff", letterSpacing:"-0.02em", marginBottom:4, lineHeight:1.3 }}>{item.name}</div>
          <div style={{ fontSize:16, fontWeight:900, color:"#fff", letterSpacing:"-0.04em" }}>{item.openPrice ? "Set Price" : fmt(item.price)}</div>
          {(item.spicy || item.vegetarian || item.popular) && (
            <div style={{ marginTop:3, display:"flex", justifyContent:"center", gap:2, fontSize:11 }}>
              {item.spicy && <span>🌶</span>}{item.vegetarian && <span>🥗</span>}{item.popular && <span>⭐</span>}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}, (prev, next) => prev.item === next.item);

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
  const [orderRefunds, setOrderRefunds] = useState<{ id: number; amount: number; reason: string | null; refundMethod: string; createdAt: string }[]>([]);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState<"idle" | "sent" | "error">("idle");
  const [emailError, setEmailError] = useState("");
  const [refiring, setRefiring] = useState(false);
  const [refireStatus, setRefireStatus] = useState<"idle" | "sent" | "error">("idle");

  useEffect(() => {
    fetch("/api/orders", { credentials: "include", headers: authHeaders() })
      .then(r => r.json())
      .then((data: Order[]) => {
        const done = data
          .filter(o => o.paymentStatus === "paid" || o.paymentStatus === "refunded" || o.status === "completed")
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setOrders(done);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) { setOrderRefunds([]); return; }
    fetch(`/api/orders/${selected.id}/refunds`, { credentials: "include", headers: authHeaders() })
      .then(r => r.json())
      .then(setOrderRefunds)
      .catch(() => {});
  }, [selected?.id]);

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
        <div style={{ background:IL.card, borderRadius:24, width:"100%", maxWidth:384, boxShadow:"0 24px 80px rgba(0,0,0,0.65),0 0 0 1px rgba(255,255,255,0.06)", overflow:"hidden" }} onClick={e => e.stopPropagation()}>
          <div style={{ padding:"18px 20px", borderBottom:`1px solid ${IL.bord}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <button onClick={() => setSelected(null)} style={{ color:IL.mu, fontSize:13, background:"none", border:"none", cursor:"pointer", fontFamily:"inherit" }}>← Back</button>
            <h2 style={{ color:IL.tp, fontSize:16, fontWeight:800 }}>Receipt #{selected.confirmationCode}</h2>
            <div/>
          </div>
          <div style={{ padding:20, maxHeight:"70vh", overflowY:"auto", fontFamily:"monospace", fontSize:13 }}>
            <div style={{ textAlign:"center", marginBottom:12 }}>
              <div style={{ fontWeight:800, fontSize:14, color:IL.tp }}>ISLAND TACOS</div>
              <div style={{ color:IL.mu, fontSize:11 }}>Wickhams Cay 1, Road Town, BVI</div>
            </div>
            <div style={{ borderTop:`1px dashed rgba(255,255,255,0.12)`, margin:"8px 0" }}/>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:IL.mu, marginBottom:4 }}>
              <span>#{selected.confirmationCode}</span>
              <span>{new Date(selected.createdAt).toLocaleString()}</span>
            </div>
            <div style={{ fontSize:11, color:IL.mu, marginBottom:2 }}>Customer: {selected.customerName || "Walk-in"}</div>
            {selected.customerPhone && <div style={{ fontSize:11, color:IL.mu, marginBottom:2 }}>Phone: {selected.customerPhone}</div>}
            <div style={{ fontSize:11, color:IL.mu, marginBottom:8 }}>Payment: {PAY_LABEL[selected.paymentMethod] ?? selected.paymentMethod}</div>
            <div style={{ borderTop:`1px dashed rgba(255,255,255,0.12)`, margin:"8px 0" }}/>
            {selected.items.map((item, i) => (
              <div key={i} style={{ marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", color:IL.tp, fontSize:13 }}>
                  <span>{item.quantity}× {item.menuItemName}</span>
                  <span>{fmt(item.subtotal)}</span>
                </div>
                {item.modifierSelections?.map((m, j) => (
                  <div key={j} style={{ display:"flex", justifyContent:"space-between", color:IL.mu, fontSize:11, paddingLeft:16 }}>
                    <span>+ {m.name}</span>
                    {m.price > 0 && <span>+{fmt(m.price)}</span>}
                  </div>
                ))}
                {item.notes && <div style={{ color:IL.mu, fontSize:11, paddingLeft:16 }}>Note: {item.notes}</div>}
              </div>
            ))}
            <div style={{ borderTop:`1px dashed rgba(255,255,255,0.12)`, margin:"8px 0" }}/>
            <div style={{ display:"flex", flexDirection:"column", gap:4, fontSize:13 }}>
              <div style={{ display:"flex", justifyContent:"space-between", color:IL.tm }}><span>Subtotal</span><span>{fmt(selected.subtotal)}</span></div>
              {selected.discountAmount > 0 && <div style={{ display:"flex", justifyContent:"space-between", color:IL.grn }}><span>Discount</span><span>-{fmt(selected.discountAmount)}</span></div>}
              {selected.tax > 0 && <div style={{ display:"flex", justifyContent:"space-between", color:IL.tm }}><span>Tax</span><span>{fmt(selected.tax)}</span></div>}
              <div style={{ display:"flex", justifyContent:"space-between", color:IL.tp, fontWeight:800, fontSize:15, borderTop:`1px solid ${IL.bord}`, paddingTop:8, marginTop:4 }}>
                <span>TOTAL</span><span style={{ color:IL.or }}>{fmt(selected.total)}</span>
              </div>
              {selected.amountTendered != null && (
                <>
                  <div style={{ display:"flex", justifyContent:"space-between", color:IL.tm }}><span>Tendered</span><span>{fmt(selected.amountTendered)}</span></div>
                  <div style={{ display:"flex", justifyContent:"space-between", color:IL.tm }}><span>Change</span><span>{fmt(Math.max(0, selected.amountTendered - selected.total))}</span></div>
                </>
              )}
            </div>
            <div style={{ borderTop:`1px dashed rgba(255,255,255,0.12)`, margin:"12px 0" }}/>
            {orderRefunds.length > 0 && (
              <div style={{ background:"rgba(255,69,58,0.12)", border:"1px solid rgba(255,69,58,0.3)", borderRadius:12, padding:12, marginBottom:8, display:"flex", flexDirection:"column", gap:6 }}>
                {orderRefunds.map(r => (
                  <div key={r.id}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ color:"#ff8a84", fontWeight:700, fontSize:13 }}>REFUNDED</span>
                      <span style={{ color:"#ff8a84", fontWeight:700, fontSize:13 }}>-{fmt(r.amount)}</span>
                    </div>
                    <div style={{ color:"rgba(255,138,132,0.7)", fontSize:11 }}>{PAY_LABEL[r.refundMethod] ?? r.refundMethod} · {new Date(r.createdAt).toLocaleString()}</div>
                    {r.reason && <div style={{ color:"rgba(255,138,132,0.55)", fontSize:11 }}>Reason: {r.reason}</div>}
                  </div>
                ))}
              </div>
            )}
            <div style={{ textAlign:"center", color:IL.mu, fontSize:11 }}>Thank you!</div>
          </div>
          <div style={{ padding:16, borderTop:`1px solid ${IL.bord}`, display:"flex", flexDirection:"column", gap:8 }}>
            {printError && <p style={{ color:IL.red, fontSize:11, textAlign:"center" }}>{printError}</p>}
            {refundSuccess && <p style={{ color:IL.grn, fontSize:11, textAlign:"center" }}>✓ Refund recorded</p>}
            {emailStatus === "sent" && <p style={{ color:IL.grn, fontSize:11, textAlign:"center" }}>✓ Receipt emailed!</p>}
            {emailStatus === "error" && <p style={{ color:IL.red, fontSize:11, textAlign:"center" }}>Email failed: {emailError}</p>}
            {refireStatus === "sent" && <p style={{ color:IL.grn, fontSize:11, textAlign:"center" }}>✓ Re-fired to KDS</p>}
            {refireStatus === "error" && <p style={{ color:IL.red, fontSize:11, textAlign:"center" }}>Re-fire failed — try again</p>}
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
              style={{ width:"100%", height:40, borderRadius:12, background:"rgba(124,106,247,0.15)", border:"1px solid rgba(124,106,247,0.35)", color:IL.pur, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", opacity:refiring?0.5:1 }}
            >
              {refiring ? "Sending…" : "🔁 Re-fire to KDS"}
            </button>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  setPrinting(true); setPrintError(null);
                  const result = await printReceiptLines(buildReceiptLines(selected, selected.amountTendered ?? undefined));
                  if (!result.ok) setPrintError(result.error ?? "Print failed");
                  setPrinting(false);
                }}
                disabled={printing}
                style={{ flex:1, height:44, borderRadius:12, background:`linear-gradient(135deg,${IL.or},#ff9500)`, border:"none", color:"#fff", fontWeight:700, cursor:"pointer", fontFamily:"inherit", fontSize:13, opacity:printing?0.5:1, boxShadow:"0 3px 14px rgba(255,107,0,0.4)" }}
              >
                {printing ? "Printing…" : "🖨 Print"}
              </button>
              <button
                onClick={() => {
                  setEmailOpen(o => !o);
                  setEmailAddress(selected.customerEmail || "");
                  setEmailStatus("idle");
                }}
                style={{ flex:1, height:44, borderRadius:12, background:"rgba(14,165,233,0.15)", border:"1px solid rgba(14,165,233,0.35)", color:"#38bdf8", fontWeight:700, cursor:"pointer", fontFamily:"inherit", fontSize:13 }}
              >
                ✉ Email
              </button>
              <button
                onClick={() => { setRefundOpen(o => !o); setRefundAmount(selected.total.toFixed(2)); }}
                style={{ height:44, padding:"0 12px", borderRadius:12, background:"rgba(255,69,58,0.15)", border:"1px solid rgba(255,69,58,0.35)", color:"#ff8a84", fontWeight:700, cursor:"pointer", fontFamily:"inherit", fontSize:14 }}
              >
                ↩
              </button>
            </div>
            {emailOpen && (
              <div style={{ background:"rgba(14,165,233,0.1)", borderRadius:12, padding:14, border:"1px solid rgba(14,165,233,0.25)", display:"flex", flexDirection:"column", gap:8 }}>
                <p style={{ color:"#38bdf8", fontSize:13, fontWeight:600 }}>Email Receipt</p>
                <input
                  type="email"
                  placeholder="customer@email.com"
                  value={emailAddress}
                  onChange={e => setEmailAddress(e.target.value)}
                  style={{ width:"100%", background:"rgba(255,255,255,0.06)", border:`1px solid ${IL.bord}`, borderRadius:10, padding:"8px 12px", color:IL.tp, fontSize:13, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }}
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
                  style={{ width:"100%", height:40, borderRadius:10, background:"rgba(14,165,233,0.3)", border:"1px solid rgba(14,165,233,0.5)", color:"#fff", fontWeight:700, cursor:"pointer", fontFamily:"inherit", fontSize:13, opacity:(emailSending||!emailAddress)?0.5:1 }}
                >
                  {emailSending ? "Sending…" : `Send to ${emailAddress || "…"}`}
                </button>
              </div>
            )}
            {selected.customerPhone && (
              <div className="flex gap-2">
                <a
                  href={`tel:${selected.customerPhone}`}
                  style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, height:40, borderRadius:12, background:"rgba(14,165,233,0.12)", border:"1px solid rgba(14,165,233,0.28)", color:"#38bdf8", fontSize:13, fontWeight:700, textDecoration:"none" }}
                >
                  📞 Call
                </a>
                {/* TODO(store-settings): interpolate ${useStoreSettings().storeName} instead of "Island Tacos" */}
                <a
                  href={`https://wa.me/${selected.customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi ${selected.customerName}, your Island Tacos order #${selected.confirmationCode} is ready for pickup! 🌮`)}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, height:40, borderRadius:12, background:"rgba(48,209,88,0.12)", border:"1px solid rgba(48,209,88,0.28)", color:"#6ee7a0", fontSize:13, fontWeight:700, textDecoration:"none" }}
                >
                  💬 WhatsApp
                </a>
              </div>
            )}
            {refundOpen && (
              <div style={{ background:"rgba(255,69,58,0.1)", borderRadius:12, padding:14, border:"1px solid rgba(255,69,58,0.28)", display:"flex", flexDirection:"column", gap:10 }}>
                <p style={{ color:"#ff8a84", fontSize:13, fontWeight:600 }}>Issue Refund</p>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label style={{ color:IL.mu, fontSize:11, display:"block", marginBottom:4 }}>Amount</label>
                    <input type="number" step="0.01" value={refundAmount} onChange={e => setRefundAmount(e.target.value)}
                      style={{ width:"100%", background:"rgba(255,255,255,0.06)", border:`1px solid ${IL.bord}`, borderRadius:8, padding:"8px 10px", color:IL.tp, fontSize:13, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }} />
                  </div>
                  <div className="flex-1">
                    <label style={{ color:IL.mu, fontSize:11, display:"block", marginBottom:4 }}>Method</label>
                    <select value={refundMethod} onChange={e => setRefundMethod(e.target.value)}
                      style={{ width:"100%", background:IL.card, border:`1px solid ${IL.bord}`, borderRadius:8, padding:"8px 10px", color:IL.tp, fontSize:13, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }}>
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="athmovil">ATH Móvil</option>
                    </select>
                  </div>
                </div>
                <input type="text" placeholder="Reason (optional)" value={refundReason} onChange={e => setRefundReason(e.target.value)}
                  style={{ width:"100%", background:"rgba(255,255,255,0.06)", border:`1px solid ${IL.bord}`, borderRadius:8, padding:"8px 10px", color:IL.tp, fontSize:13, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }} />
                <button disabled={refundSubmitting || !refundAmount}
                  onClick={async () => {
                    setRefundSubmitting(true);
                    try {
                      const r = await fetch(`/api/orders/${selected.id}/refund`, {
                        method: "POST", credentials: "include",
                        headers: { "Content-Type": "application/json", ...authHeaders() },
                        body: JSON.stringify({ amount: parseFloat(refundAmount), reason: refundReason, refundMethod }),
                      });
                      if (r.ok) {
                        const newRefund = await r.json();
                        setOrderRefunds(prev => [...prev, newRefund]);
                        setOrders(prev => prev.map(o => o.id === selected.id ? { ...o, paymentStatus: "refunded" } : o));
                        setSelected(prev => prev ? { ...prev, paymentStatus: "refunded" } : prev);
                        setRefundOpen(false);
                        setRefundSuccess(true);
                      }
                    } finally {
                      setRefundSubmitting(false);
                    }
                  }}
                  style={{ width:"100%", height:40, borderRadius:10, background:"rgba(255,69,58,0.3)", border:"1px solid rgba(255,69,58,0.5)", color:"#fff", fontWeight:700, cursor:"pointer", fontFamily:"inherit", fontSize:13, opacity:(refundSubmitting||!refundAmount)?0.4:1 }}>
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
    <div className="fixed inset-0 bg-black/75 flex justify-end z-50" onClick={onClose}>
      <div className="w-full max-w-sm h-full flex flex-col shadow-2xl" style={{ background:IL.hdr }} onClick={e => e.stopPropagation()}>
        <div className="p-5 flex items-center justify-between" style={{ borderBottom:`1px solid ${IL.bord}` }}>
          <h2 style={{ color:IL.tp, fontSize:20, fontWeight:800 }}>Receipts</h2>
          <button onClick={onClose} style={{ color:IL.mu, fontSize:28, background:"none", border:"none", cursor:"pointer", lineHeight:1, fontFamily:"inherit" }}>×</button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 px-4 pt-3 pb-2">
          {(["today", "all"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ flex:1, height:40, borderRadius:10, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", background: filter === f ? `linear-gradient(135deg,${IL.or},#ff9500)` : "rgba(255,255,255,0.07)", border: filter === f ? "none" : `1px solid ${IL.bord}`, color: filter === f ? "#fff" : IL.mu, boxShadow: filter === f ? "0 3px 12px rgba(255,107,0,0.4)" : "none" }}>
              {f === "today" ? "Today" : "All Time"}
            </button>
          ))}
        </div>

        {/* Search bar */}
        <div className="px-4 pb-2">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color:IL.mu, fontSize:14 }}>🔍</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Name, phone, or item…"
              style={{ width:"100%", height:40, paddingLeft:32, paddingRight:32, background:"rgba(255,255,255,0.06)", border:`1px solid ${IL.bord}`, borderRadius:10, fontSize:13, color:IL.tp, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", color:IL.mu, background:"none", border:"none", cursor:"pointer", fontSize:18, lineHeight:1, fontFamily:"inherit" }}
              >×</button>
            )}
          </div>
        </div>

        {/* Summary bar */}
        {!loading && visible.length > 0 && (
          <div style={{ margin:"0 16px 8px", padding:"8px 16px", background:"rgba(255,255,255,0.05)", borderRadius:12, display:"flex", justifyContent:"space-between", alignItems:"center", border:`1px solid ${IL.bord}` }}>
            <span style={{ color:IL.mu, fontSize:13 }}>{visible.length} order{visible.length !== 1 ? "s" : ""}</span>
            <span style={{ color:IL.or, fontWeight:700, fontSize:13 }}>{fmt(totalRevenue)}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && <p style={{ color:IL.mu, textAlign:"center", padding:"32px 0" }}>Loading…</p>}
          {!loading && visible.length === 0 && (
            <p style={{ color:IL.mu, textAlign:"center", padding:"32px 0" }}>
              {q ? `No orders matching "${search}"` : filter === "today" ? "No completed orders today" : "No completed orders yet"}
            </p>
          )}
          {visible.map(o => {
            const isRefunded = o.paymentStatus === "refunded";
            const { grad: rg, glow: rGw } = ITEM_GRADS[o.id % ITEM_GRADS.length];
            return (
              <button key={o.id} onClick={() => { setSelected(o); setRefireStatus("idle"); setRefundSuccess(false); setRefundOpen(false); }}
                style={{ width:"100%", borderRadius:14, padding:14, textAlign:"left", cursor:"pointer", fontFamily:"inherit", background: isRefunded ? "rgba(255,69,58,0.12)" : rg, border: isRefunded ? "1px solid rgba(255,69,58,0.3)" : "none", boxShadow: isRefunded ? "none" : `0 4px 18px ${rGw}`, position:"relative", overflow:"hidden" }}>
                {!isRefunded && <div style={{ position:"absolute", inset:0, background:"linear-gradient(155deg,rgba(255,255,255,0.10) 0%,transparent 55%)", pointerEvents:"none", zIndex:0 }} />}
                <div style={{ position:"relative", zIndex:1 }}>
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <span style={{ fontWeight:700, fontSize:13, color: isRefunded ? "rgba(255,255,255,0.5)" : "#fff" }}>{o.customerName || "Walk-in"}</span>
                    <span style={{ marginLeft:8, color:"rgba(255,255,255,0.5)", fontSize:11 }}>#{o.confirmationCode}</span>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:2 }}>
                    <span style={{ fontWeight:700, fontSize:13, color: isRefunded ? "rgba(255,255,255,0.35)" : "#fff", textDecoration: isRefunded ? "line-through" : "none" }}>{fmt(o.total)}</span>
                    {isRefunded && <span style={{ fontSize:11, fontWeight:700, color:"#ff8a84" }}>↩ Refunded</span>}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p style={{ color:"rgba(255,255,255,0.6)", fontSize:11 }}>
                    {o.items.map(i => {
                      const mods = i.modifierSelections?.length ? ` (${i.modifierSelections.map(m => m.name).join(", ")})` : "";
                      return `${i.quantity}× ${i.menuItemName}${mods}`;
                    }).join(" • ")}
                  </p>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span style={{ color:"rgba(255,255,255,0.5)", fontSize:11 }}>{new Date(o.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                  <span style={{ fontSize:11, padding:"1px 8px", borderRadius:6, background:"rgba(0,0,0,0.28)", color:"rgba(255,255,255,0.7)" }}>{PAY_LABEL[o.paymentMethod] ?? o.paymentMethod}</span>
                </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── 86 Panel ────────────────────────────────────────────────────────────────

const EIGHTY_SIX = [
  { label: "Steak",       emoji: "🥩", type: "item"     as const, keywords: ["steak"]                   },
  { label: "Salmon",      emoji: "🐟", type: "item"     as const, keywords: ["salmon"]                  },
  { label: "Shrimp",      emoji: "🍤", type: "item"     as const, keywords: ["shrimp"]                  },
  { label: "Chicken",     emoji: "🍗", type: "item"     as const, keywords: ["chicken"]                 },
  { label: "Veggie",      emoji: "🥗", type: "item"     as const, keywords: ["veggie"]                  },
  { label: "Burger",      emoji: "🍔", type: "item"     as const, keywords: ["burger"]                  },
  { label: "Rice",        emoji: "🍚", type: "modifier" as const, keywords: ["rice"]                    },
  { label: "Beans",       emoji: "🫘", type: "modifier" as const, keywords: ["bean"]                    },
  { label: "Guac",        emoji: "🥑", type: "modifier" as const, keywords: ["guac"]                    },
  { label: "Corn",        emoji: "🌽", type: "modifier" as const, keywords: ["corn"]                    },
  { label: "Cabbage",     emoji: "🥬", type: "modifier" as const, keywords: ["cabbage"]                 },
  { label: "Cheese",      emoji: "🧀", type: "modifier" as const, keywords: ["cheese"]                  },
  { label: "Pico/Tomato", emoji: "🍅", type: "modifier" as const, keywords: ["pico", "tomato", "salsa"] },
];

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
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/menu/soldout", { credentials: "include", headers: authHeaders() });
      if (r.ok) setData(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const matches = (name: string, keywords: readonly string[]) =>
    keywords.some(k => name.toLowerCase().includes(k.toLowerCase()));

  const isOff = (preset: typeof EIGHTY_SIX[number]) => {
    if (!data) return false;
    if (preset.type === "item") {
      return data.items.some(i => matches(i.name, preset.keywords) && !i.available);
    }
    return data.modifiers.some(m =>
      m.options.some(o => matches(o.name, preset.keywords) && m.unavailableOptionIds.includes(o.id))
    );
  };

  const toggle = async (preset: typeof EIGHTY_SIX[number]) => {
    if (!data || busy) return;
    setBusy(preset.label);
    const turnOff = !isOff(preset);
    try {
      if (preset.type === "item") {
        const targets = data.items.filter(i => matches(i.name, preset.keywords));
        await Promise.all(targets.map(item =>
          fetch(`/api/menu/soldout/item/${item.id}`, {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify({ available: !turnOff }),
          })
        ));
        setData(prev => prev ? {
          ...prev,
          items: prev.items.map(i => matches(i.name, preset.keywords) ? { ...i, available: !turnOff } : i),
        } : prev);
      } else {
        await Promise.all(
          data.modifiers.flatMap(mod =>
            mod.options
              .filter(o => matches(o.name, preset.keywords))
              .map(o =>
                fetch("/api/menu/soldout/modifier-option", {
                  method: "POST", credentials: "include",
                  headers: { "Content-Type": "application/json", ...authHeaders() },
                  body: JSON.stringify({ modifierId: mod.id, optionId: o.id, available: !turnOff }),
                })
              )
          )
        );
        setData(prev => prev ? {
          ...prev,
          modifiers: prev.modifiers.map(m => ({
            ...m,
            unavailableOptionIds: turnOff
              ? [...new Set([...m.unavailableOptionIds, ...m.options.filter(o => matches(o.name, preset.keywords)).map(o => o.id)])]
              : m.unavailableOptionIds.filter(id => !m.options.some(o => o.id === id && matches(o.name, preset.keywords))),
          })),
        } : prev);
      }
    } finally { setBusy(null); }
  };

  const anyOff = data ? EIGHTY_SIX.some(p => isOff(p)) : false;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-stretch justify-end" onClick={onClose}>
      <div style={{ background:IL.hdr, width:"100%", maxWidth:384, height:"100%", display:"flex", flexDirection:"column", boxShadow:"0 0 60px rgba(0,0,0,0.7)", overflow:"hidden" }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px", borderBottom:`1px solid ${IL.bord}` }}>
          <div>
            <h2 style={{ color:IL.tp, fontSize:17, fontWeight:800 }}>86 List</h2>
            <p style={{ color:IL.mu, fontSize:11, marginTop:2 }}>
              {anyOff ? "Some items blocked online" : "Everything available online"}
            </p>
          </div>
          <button onClick={onClose} style={{ color:IL.mu, fontSize:26, background:"none", border:"none", cursor:"pointer", lineHeight:1, padding:"0 4px", fontFamily:"inherit" }}>×</button>
        </div>

        {loading ? (
          <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:IL.mu, fontSize:13 }}>Loading…</div>
        ) : !data ? (
          <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:IL.red, fontSize:13 }}>Failed to load</div>
        ) : (
          <div style={{ flex:1, overflowY:"auto", padding:"16px 20px", display:"flex", flexDirection:"column", gap:24 }}>

            {/* Proteins */}
            <div>
              <p style={{ fontSize:10, fontWeight:700, color:IL.mu, textTransform:"uppercase", letterSpacing:".1em", marginBottom:10 }}>Proteins</p>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {EIGHTY_SIX.filter(p => p.type === "item").map(preset => {
                  const off = isOff(preset);
                  return (
                    <button
                      key={preset.label}
                      onClick={() => toggle(preset)}
                      disabled={!!busy}
                      style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderRadius:14, border: off ? "1px solid rgba(255,69,58,0.4)" : `1px solid ${IL.bord}`, background: off ? "rgba(255,69,58,0.12)" : "rgba(255,255,255,0.05)", cursor:"pointer", fontFamily:"inherit", opacity:busy?0.5:1 }}
                    >
                      <span style={{ display:"flex", alignItems:"center", gap:12 }}>
                        <span style={{ fontSize:20 }}>{preset.emoji}</span>
                        <span style={{ fontSize:13, fontWeight:600, color: off ? "#ffa5a1" : IL.tm }}>
                          {preset.label}
                        </span>
                      </span>
                      <span style={{ position:"relative", display:"inline-flex", height:24, width:44, alignItems:"center", borderRadius:12, background: off ? IL.red : IL.grn, flexShrink:0 }}>
                        <span style={{ display:"inline-block", height:16, width:16, borderRadius:"50%", background:"#fff", boxShadow:"0 1px 4px rgba(0,0,0,0.3)", transform: off ? "translateX(4px)" : "translateX(24px)", transition:"transform 0.15s" }} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Ingredients */}
            <div>
              <p style={{ fontSize:10, fontWeight:700, color:IL.mu, textTransform:"uppercase", letterSpacing:".1em", marginBottom:10 }}>Ingredients</p>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {EIGHTY_SIX.filter(p => p.type === "modifier").map(preset => {
                  const off = isOff(preset);
                  return (
                    <button
                      key={preset.label}
                      onClick={() => toggle(preset)}
                      disabled={!!busy}
                      style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderRadius:14, border: off ? "1px solid rgba(255,69,58,0.4)" : `1px solid ${IL.bord}`, background: off ? "rgba(255,69,58,0.12)" : "rgba(255,255,255,0.05)", cursor:"pointer", fontFamily:"inherit", opacity:busy?0.5:1 }}
                    >
                      <span style={{ display:"flex", alignItems:"center", gap:12 }}>
                        <span style={{ fontSize:20 }}>{preset.emoji}</span>
                        <span style={{ fontSize:13, fontWeight:600, color: off ? "#ffa5a1" : IL.tm }}>
                          {preset.label}
                        </span>
                      </span>
                      <span style={{ position:"relative", display:"inline-flex", height:24, width:44, alignItems:"center", borderRadius:12, background: off ? IL.red : IL.grn, flexShrink:0 }}>
                        <span style={{ display:"inline-block", height:16, width:16, borderRadius:"50%", background:"#fff", boxShadow:"0 1px 4px rgba(0,0,0,0.3)", transform: off ? "translateX(4px)" : "translateX(24px)", transition:"transform 0.15s" }} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

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
      <div style={{ background:IL.card, borderRadius:24, width:"100%", maxWidth:384, boxShadow:"0 24px 80px rgba(0,0,0,0.65),0 0 0 1px rgba(255,255,255,0.06)", padding:24 }}>
        <div style={{ textAlign:"center", marginBottom:24 }}>
          <div style={{ fontSize:40, marginBottom:8 }}>🏪</div>
          <h2 style={{ color:IL.tp, fontSize:20, fontWeight:800 }}>Open Shift</h2>
          <p style={{ color:IL.mu, fontSize:13, marginTop:4 }}>Count your starting cash before opening</p>
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={{ color:IL.mu, fontSize:11, fontWeight:600, display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:".05em" }}>Starting Cash Float</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color:IL.mu, fontSize:17, fontWeight:700 }}>$</span>
            <input type="number" step="0.01" min="0" value={float} onChange={e => setFloat(e.target.value)}
              style={{ width:"100%", background:"rgba(255,255,255,0.07)", border:`1px solid ${IL.bord}`, borderRadius:14, paddingLeft:32, paddingRight:16, paddingTop:12, paddingBottom:12, color:IL.tp, fontSize:20, fontFamily:"monospace", fontWeight:700, outline:"none", boxSizing:"border-box" }} />
          </div>
        </div>
        <div style={{ marginBottom:20 }}>
          <label style={{ color:IL.mu, fontSize:11, fontWeight:600, display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:".05em" }}>Notes (optional)</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. regular Tuesday shift"
            style={{ width:"100%", background:"rgba(255,255,255,0.07)", border:`1px solid ${IL.bord}`, borderRadius:14, padding:"10px 16px", color:IL.tp, fontSize:13, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }} />
        </div>
        {error && <p style={{ color:IL.red, fontSize:13, textAlign:"center", marginBottom:12 }}>{error}</p>}
        <div className="flex gap-2">
          <button onClick={handleOpen} disabled={submitting}
            style={{ flex:1, height:48, borderRadius:14, background:`linear-gradient(135deg,${IL.or},#ff9500)`, border:"none", color:"#fff", fontWeight:700, cursor:"pointer", fontFamily:"inherit", fontSize:15, opacity:submitting?0.5:1, boxShadow:"0 4px 16px rgba(255,107,0,0.45)" }}>
            {submitting ? "Opening…" : "Open Shift"}
          </button>
          <button onClick={() => onOpen({ id: 0, openedAt: new Date().toISOString(), closedAt: null, openingFloat: 0, closingFloat: null, notes: null })}
            style={{ padding:"0 16px", height:48, borderRadius:14, background:"rgba(255,255,255,0.07)", border:`1px solid ${IL.bord}`, color:IL.mu, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
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
      <div style={{ background:IL.card, borderRadius:24, width:"100%", maxWidth:384, boxShadow:"0 24px 80px rgba(0,0,0,0.65),0 0 0 1px rgba(255,255,255,0.06)", overflow:"hidden" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding:"18px 20px", borderBottom:`1px solid ${IL.bord}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <h2 style={{ color:IL.tp, fontSize:17, fontWeight:800 }}>{closed ? "Shift Closed" : "Close Shift"}</h2>
          <button onClick={onClose} style={{ color:IL.mu, fontSize:26, background:"none", border:"none", cursor:"pointer", lineHeight:1, fontFamily:"inherit" }}>×</button>
        </div>
        <div style={{ padding:20, maxHeight:"70vh", overflowY:"auto" }}>
          {summary ? (
            <div style={{ display:"flex", flexDirection:"column", gap:12, fontFamily:"monospace", fontSize:13 }}>
              <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:14, padding:16, border:`1px solid ${IL.bord}`, display:"flex", flexDirection:"column", gap:6 }}>
                <div style={{ display:"flex", justifyContent:"space-between" }}><span style={{ color:IL.mu }}>Total Orders</span><span style={{ color:IL.tp }}>{summary.totalOrders}</span></div>
                <div style={{ display:"flex", justifyContent:"space-between" }}><span style={{ color:IL.mu }}>Cash Sales</span><span style={{ color:IL.tp }}>{fmt(summary.byMethod.cash)}</span></div>
                <div style={{ display:"flex", justifyContent:"space-between" }}><span style={{ color:IL.mu }}>Card Sales</span><span style={{ color:IL.tp }}>{fmt(summary.byMethod.card)}</span></div>
                <div style={{ display:"flex", justifyContent:"space-between" }}><span style={{ color:IL.mu }}>ATH Móvil</span><span style={{ color:IL.tp }}>{fmt(summary.byMethod.athmovil)}</span></div>
                <div style={{ display:"flex", justifyContent:"space-between" }}><span style={{ color:IL.mu }}>Refunds</span><span style={{ color:IL.red }}>-{fmt(summary.refundTotal)}</span></div>
                <div style={{ display:"flex", justifyContent:"space-between", borderTop:`1px solid ${IL.bord}`, paddingTop:6, marginTop:2 }}><span style={{ color:IL.tp, fontWeight:700 }}>Net Sales</span><span style={{ color:IL.or, fontWeight:700, fontSize:14 }}>{fmt(summary.netSales)}</span></div>
              </div>
              <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:14, padding:16, border:`1px solid ${IL.bord}`, display:"flex", flexDirection:"column", gap:6 }}>
                <div style={{ display:"flex", justifyContent:"space-between" }}><span style={{ color:IL.mu }}>Opening Float</span><span style={{ color:IL.tp }}>{fmt(shift.openingFloat)}</span></div>
                <div style={{ display:"flex", justifyContent:"space-between" }}><span style={{ color:IL.mu }}>Pay Ins</span><span style={{ color:IL.grn }}>+{fmt(summary.payIns)}</span></div>
                <div style={{ display:"flex", justifyContent:"space-between" }}><span style={{ color:IL.mu }}>Pay Outs</span><span style={{ color:IL.red }}>-{fmt(summary.payOuts)}</span></div>
                <div style={{ display:"flex", justifyContent:"space-between", borderTop:`1px solid ${IL.bord}`, paddingTop:6 }}><span style={{ color:IL.tm }}>Expected Cash</span><span style={{ color:IL.tp, fontWeight:700 }}>{fmt(summary.expectedCash)}</span></div>
              </div>
              {!closed && (
                <div>
                  <label style={{ color:IL.mu, fontSize:11, display:"block", marginBottom:4 }}>Actual cash in drawer (optional)</label>
                  <input type="number" step="0.01" value={closingFloat} onChange={e => setClosingFloat(e.target.value)}
                    placeholder={fmt(summary.expectedCash)}
                    style={{ width:"100%", background:"rgba(255,255,255,0.07)", border:`1px solid ${IL.bord}`, borderRadius:12, padding:"8px 12px", color:IL.tp, fontSize:13, fontFamily:"monospace", outline:"none", boxSizing:"border-box" }} />
                  {closingFloat && <p style={{ fontSize:11, marginTop:4, color: parseFloat(closingFloat) - summary.expectedCash >= 0 ? IL.grn : IL.red }}>
                    Difference: {parseFloat(closingFloat) - summary.expectedCash >= 0 ? "+" : ""}{fmt(parseFloat(closingFloat) - summary.expectedCash)}
                  </p>}
                </div>
              )}
              {closed && <div style={{ textAlign:"center", color:IL.grn, fontWeight:700, fontSize:17, padding:"8px 0" }}>✓ Shift Closed</div>}
            </div>
          ) : (
            <p style={{ color:IL.mu, textAlign:"center", padding:"32px 0" }}>Loading summary…</p>
          )}
        </div>
        <div style={{ padding:16, borderTop:`1px solid ${IL.bord}`, display:"flex", gap:8 }}>
          <button onClick={printZReport} disabled={printingZ || !summary}
            style={{ flex:1, height:44, borderRadius:12, background:"rgba(255,255,255,0.07)", border:`1px solid ${IL.bord}`, color:IL.tm, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", opacity:(printingZ||!summary)?0.5:1 }}>
            {printingZ ? "Printing…" : "🖨 Print Z-Report"}
          </button>
          {!closed && (
            <button onClick={handleClose} disabled={closing}
              style={{ flex:1, height:44, borderRadius:12, background:"rgba(255,69,58,0.25)", border:"1px solid rgba(255,69,58,0.45)", color:"#ffa5a1", fontWeight:700, cursor:"pointer", fontFamily:"inherit", fontSize:13, opacity:closing?0.5:1 }}>
              {closing ? "Closing…" : "Close Shift"}
            </button>
          )}
          {closed && (
            <button onClick={onClose} style={{ flex:1, height:44, borderRadius:12, background:`linear-gradient(135deg,${IL.or},#ff9500)`, border:"none", color:"#fff", fontWeight:700, cursor:"pointer", fontFamily:"inherit", fontSize:13, boxShadow:"0 4px 16px rgba(255,107,0,0.45)" }}>
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
      <div style={{ background:IL.card, borderRadius:24, width:"100%", maxWidth:384, boxShadow:"0 24px 80px rgba(0,0,0,0.65),0 0 0 1px rgba(255,255,255,0.06)", overflow:"hidden" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding:"18px 20px", borderBottom:`1px solid ${IL.bord}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <h2 style={{ color:IL.tp, fontSize:17, fontWeight:800 }}>Cash Management</h2>
          <button onClick={onClose} style={{ color:IL.mu, fontSize:26, background:"none", border:"none", cursor:"pointer", lineHeight:1, fontFamily:"inherit" }}>×</button>
        </div>
        <div style={{ padding:20, display:"flex", flexDirection:"column", gap:16 }}>
          <div className="flex gap-2">
            {(["pay_in", "pay_out"] as const).map(t => (
              <button key={t} onClick={() => setType(t)}
                style={{ flex:1, height:40, borderRadius:12, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", background: type === t ? (t === "pay_in" ? "rgba(48,209,88,0.25)" : "rgba(255,69,58,0.25)") : "rgba(255,255,255,0.07)", border: type === t ? (t === "pay_in" ? "1px solid rgba(48,209,88,0.5)" : "1px solid rgba(255,69,58,0.5)") : `1px solid ${IL.bord}`, color: type === t ? (t === "pay_in" ? IL.grn : "#ffa5a1") : IL.mu }}>
                {t === "pay_in" ? "💵 Pay In" : "💸 Pay Out"}
              </button>
            ))}
          </div>
          <div>
            <label style={{ color:IL.mu, fontSize:11, display:"block", marginBottom:4 }}>Amount</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color:IL.mu, fontWeight:700 }}>$</span>
              <input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)}
                style={{ width:"100%", background:"rgba(255,255,255,0.07)", border:`1px solid ${IL.bord}`, borderRadius:14, paddingLeft:32, paddingRight:16, paddingTop:12, paddingBottom:12, color:IL.tp, fontSize:20, fontFamily:"monospace", fontWeight:700, outline:"none", boxSizing:"border-box" }} />
            </div>
          </div>
          <div>
            <label style={{ color:IL.mu, fontSize:11, display:"block", marginBottom:4 }}>Note (optional)</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)}
              placeholder="e.g. change for $100 bill, vendor payment…"
              style={{ width:"100%", background:"rgba(255,255,255,0.07)", border:`1px solid ${IL.bord}`, borderRadius:14, padding:"10px 16px", color:IL.tp, fontSize:13, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }} />
          </div>
          {success && <p style={{ color:IL.grn, fontSize:13, textAlign:"center" }}>{success}</p>}
          <button onClick={submit} disabled={submitting || !amount}
            style={{ width:"100%", height:48, borderRadius:14, background: type === "pay_in" ? "linear-gradient(135deg,#10b981,#059669)" : "linear-gradient(135deg,#ef4444,#dc2626)", border:"none", color:"#fff", fontWeight:700, cursor:"pointer", fontFamily:"inherit", fontSize:14, opacity:(submitting||!amount)?0.5:1, boxShadow: type === "pay_in" ? "0 4px 16px rgba(16,185,129,0.4)" : "0 4px 16px rgba(239,68,68,0.4)" }}>
            {submitting ? "Recording…" : `Record ${type === "pay_in" ? "Pay In" : "Pay Out"}`}
          </button>

          {transactions.filter(t => t.type === "pay_in" || t.type === "pay_out").length > 0 && (
            <div>
              <p style={{ color:IL.mu, fontSize:11, marginBottom:8 }}>Today's Cash Movements</p>
              <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:160, overflowY:"auto" }}>
                {transactions.filter(t => t.type === "pay_in" || t.type === "pay_out").map(t => (
                  <div key={t.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 12px", background:"rgba(255,255,255,0.05)", borderRadius:10, border:`1px solid ${IL.bord}` }}>
                    <div>
                      <span style={{ fontSize:11, fontWeight:700, color: t.type === "pay_in" ? IL.grn : IL.red }}>{t.type === "pay_in" ? "IN" : "OUT"}</span>
                      {t.note && <span style={{ color:IL.mu, fontSize:11, marginLeft:8 }}>{t.note}</span>}
                    </div>
                    <span style={{ fontSize:13, fontWeight:700, color: t.type === "pay_in" ? IL.grn : IL.red }}>
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
  const [submitting, setSubmitting] = useState(false);
  // Per-item cash receipts: key = item.key, value = {tendered, change} once collected.
  const [cashReceipts, setCashReceipts] = useState<Record<string, { tendered: number; change: number }>>({});
  // Which item is currently being cash-collected (null = no cash overlay open).
  const [cashCollectingFor, setCashCollectingFor] = useState<string | null>(null);
  const [cashTendered, setCashTendered] = useState("0");

  const lineTotal = (item: CartItem) =>
    (item.price + item.modifierSelections.reduce((s, m) => s + m.price, 0)) * item.quantity;

  const rawTotal = cart.reduce((s, i) => s + lineTotal(i), 0);
  const scale = rawTotal > 0 ? total / rawTotal : 1;

  const scaledItemAmount = (item: CartItem) => Math.round(lineTotal(item) * scale * 100) / 100;

  // ─── Per-item assignment + cash flow ─────────────────────────────────────
  const openCashFor = (itemKey: string) => {
    const item = cart.find(i => i.key === itemKey);
    if (!item) return;
    const amt = scaledItemAmount(item);
    setCashTendered(String(Math.ceil(amt)));
    setCashCollectingFor(itemKey);
  };

  // Assign one item to a method. Cash assignments immediately open the cash overlay
  // for that item only (so each customer paying cash gets their own tendered/change).
  const pickMethodForItem = (itemKey: string, method: string) => {
    if (!method) {
      // "Pay with…" / cleared
      setAssignments(prev => { const next = { ...prev }; delete next[itemKey]; return next; });
      setCashReceipts(prev => { const next = { ...prev }; delete next[itemKey]; return next; });
      return;
    }
    setAssignments(prev => ({ ...prev, [itemKey]: method }));
    if (method !== "cash") {
      // Card/ATH — no collection step, drop any stale cash receipt.
      setCashReceipts(prev => { const next = { ...prev }; delete next[itemKey]; return next; });
    } else if (!cashReceipts[itemKey]) {
      // Cash and not yet collected — prompt now.
      openCashFor(itemKey);
    }
  };

  // Bulk assign for multi-select. For cash, marks all selected as cash and opens
  // the first one's collection step; subsequent ones are queued (the user will be
  // prompted for each in turn after each Save).
  const bulkAssign = (keys: string[], method: string) => {
    setAssignments(prev => { const next = { ...prev }; for (const k of keys) next[k] = method; return next; });
    setSelected(new Set());
    if (method !== "cash") {
      setCashReceipts(prev => {
        const next = { ...prev }; for (const k of keys) delete next[k]; return next;
      });
    } else {
      const firstUncollected = keys.find(k => !cashReceipts[k]);
      if (firstUncollected) openCashFor(firstUncollected);
    }
  };

  const assignAll = (method: string) => bulkAssign(cart.map(i => i.key), method);

  const toggleSelect = (key: string) => {
    setSelected(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  };

  const clearAll = () => { setAssignments({}); setCashReceipts({}); setSelected(new Set()); };

  // An item is "ready to place" if: it has a non-cash method, OR cash + receipt collected.
  const itemPaid = (item: CartItem): boolean => {
    const m = assignments[item.key];
    if (!m) return false;
    if (m === "cash") return !!cashReceipts[item.key];
    return true;
  };

  const allPaid = cart.length > 0 && cart.every(itemPaid);
  const allAssigned = cart.length > 0 && cart.every(i => !!assignments[i.key]);

  const methodTotals: Record<string, { amount: number; keys: string[] }> = {};
  let unassignedAmt = 0;
  for (const item of cart) {
    const method = assignments[item.key];
    const amt = scaledItemAmount(item);
    if (method) {
      if (!methodTotals[method]) methodTotals[method] = { amount: 0, keys: [] };
      methodTotals[method].amount += amt;
      methodTotals[method].keys.push(item.key);
    } else {
      unassignedAmt += amt;
    }
  }

  const totalCashChange = Object.values(cashReceipts).reduce((s, r) => s + r.change, 0);

  // ─── Cash overlay state (computed from cashCollectingFor) ────────────────
  const cashItem = cashCollectingFor ? cart.find(i => i.key === cashCollectingFor) ?? null : null;
  const cashItemAmount = cashItem ? scaledItemAmount(cashItem) : 0;
  const cashTenderedNum = parseFloat(cashTendered || "0");
  const cashChangeForItem = Math.max(0, Math.round((cashTenderedNum - cashItemAmount) * 100) / 100);
  const cashTenderedEnough = cashTenderedNum + 0.005 >= cashItemAmount;

  const cashQuick = (() => {
    const result: number[] = [];
    const add = (v: number) => {
      const r = Math.round(v * 100) / 100;
      if (r >= cashItemAmount && !result.includes(r)) result.push(r);
    };
    add(cashItemAmount);
    add(Math.ceil(cashItemAmount / 5) * 5);
    add(Math.ceil(cashItemAmount / 10) * 10);
    add(Math.ceil(cashItemAmount / 20) * 20);
    add(20); add(50); add(100);
    return result.filter(v => v >= cashItemAmount).sort((a, b) => a - b).slice(0, 5);
  })();

  const saveCashReceipt = () => {
    if (!cashCollectingFor || !cashTenderedEnough) return;
    const key = cashCollectingFor;
    setCashReceipts(prev => ({ ...prev, [key]: { tendered: cashTenderedNum, change: cashChangeForItem } }));
    setCashCollectingFor(null);
    // If other items are assigned to cash but not yet collected, chain to the next one.
    const nextKey = cart.find(i => i.key !== key && assignments[i.key] === "cash" && !cashReceipts[i.key])?.key;
    if (nextKey) setTimeout(() => openCashFor(nextKey), 0);
  };

  const cancelCashCollection = () => {
    if (!cashCollectingFor) return;
    const key = cashCollectingFor;
    // If the user was RE-editing an already-collected receipt, cancel just
    // closes the overlay — keep the prior receipt + assignment intact.
    // If this was a first-time collection (no receipt yet), drop the cash
    // assignment so the item doesn't get stuck in "cash pending".
    if (!cashReceipts[key]) {
      setAssignments(prev => { const next = { ...prev }; delete next[key]; return next; });
    }
    setCashCollectingFor(null);
  };

  const finalizeOrder = () => {
    if (submitting || confirmed) return;
    setSubmitting(true);
    const groups: SplitGroup[] = Object.entries(methodTotals).map(([method, { amount, keys }]) => ({
      method, amount: Math.round(amount * 100) / 100, itemKeys: keys,
    }));
    const lines: string[] = [];
    for (const item of cart) {
      const m = assignments[item.key];
      if (!m) continue;
      const sm = SPLIT_METHODS.find(x => x.key === m);
      const amt = scaledItemAmount(item);
      const base = `${sm?.icon ?? ""} ${sm?.label ?? m} ${fmt(amt)} — ${item.quantity}× ${item.name}`;
      if (m === "cash") {
        const r = cashReceipts[item.key];
        if (r) lines.push(`${base} (tendered ${fmt(r.tendered)}, change ${fmt(r.change)})`);
        else lines.push(base);
      } else {
        lines.push(base);
      }
    }
    onConfirm(groups, `SPLIT:\n${lines.join("\n")}`);
    setConfirmed(true);
  };

  // ─── Final confirmation screen (order placed) ────────────────────────────
  if (confirmed) {
    return (
      <div className="fixed inset-0 bg-black/75 flex items-end sm:items-center justify-center z-50 p-4">
        <div style={{ background:IL.card, borderRadius:24, width:"100%", maxWidth:384, boxShadow:"0 24px 80px rgba(0,0,0,0.65),0 0 0 1px rgba(255,255,255,0.06)", overflow:"hidden" }}>
          <div style={{ padding:"16px 20px", background:"rgba(48,209,88,0.15)", borderBottom:"1px solid rgba(48,209,88,0.3)", display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ fontSize:28 }}>✅</span>
            <div>
              <p style={{ color:IL.tp, fontWeight:900, fontSize:17 }}>Order Placed!</p>
              <p style={{ color:IL.grn, fontSize:13 }}>Hand back change if any</p>
            </div>
          </div>
          <div style={{ padding:20, display:"flex", flexDirection:"column", gap:10 }}>
            {cart.map(item => {
              const m = assignments[item.key];
              if (!m) return null;
              const sm = SPLIT_METHODS.find(x => x.key === m);
              const amt = scaledItemAmount(item);
              const r = m === "cash" ? cashReceipts[item.key] : undefined;
              const { grad: ig, glow: igw } = ITEM_GRADS[item.menuItemId % ITEM_GRADS.length];
              return (
                <div key={item.key} style={{ borderRadius:14, padding:"12px 16px", background:ig, boxShadow:`0 3px 14px ${igw}`, position:"relative", overflow:"hidden" }}>
                  <div style={{ position:"absolute", inset:0, background:"linear-gradient(155deg,rgba(255,255,255,0.10) 0%,transparent 55%)", pointerEvents:"none" }} />
                  <div style={{ position:"relative" }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <span style={{ color:"#fff", fontSize:13, fontWeight:700 }}>
                      {item.quantity > 1 && <span style={{ color:"rgba(255,255,255,0.75)", fontWeight:900, marginRight:4 }}>{item.quantity}×</span>}
                      {item.name}
                    </span>
                    <span style={{ color:"#fff", fontSize:16, fontWeight:900, flexShrink:0, marginLeft:8 }}>{sm?.icon} {fmt(amt)}</span>
                  </div>
                  {r && r.change > 0.005 && (
                    <div style={{ marginTop:4, display:"flex", alignItems:"center", justifyContent:"space-between", fontSize:11 }}>
                      <span style={{ color:"rgba(255,255,255,0.6)" }}>Tendered {fmt(r.tendered)}</span>
                      <span style={{ color:"#fff", fontWeight:700 }}>Change {fmt(r.change)}</span>
                    </div>
                  )}
                  </div>
                </div>
              );
            })}
            {totalCashChange > 0.005 && (
              <div style={{ background:"rgba(48,209,88,0.15)", borderRadius:14, padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", border:"1px solid rgba(48,209,88,0.3)" }}>
                <span style={{ color:IL.grn, fontSize:13, fontWeight:600 }}>Total change due</span>
                <span style={{ color:IL.grn, fontSize:22, fontWeight:900 }}>{fmt(totalCashChange)}</span>
              </div>
            )}
          </div>
          <div style={{ padding:"0 20px 20px" }}>
            <button onClick={onClose} style={{ width:"100%", height:48, borderRadius:14, background:`linear-gradient(135deg,${IL.or},#ff9500)`, border:"none", color:"#fff", fontWeight:900, fontSize:15, cursor:"pointer", fontFamily:"inherit", boxShadow:"0 4px 16px rgba(255,107,0,0.45)" }}>
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main assign-items screen (with optional cash overlay on top) ────────
  return (
    <div className="fixed inset-0 bg-black/75 flex items-end sm:items-center justify-center z-50 p-4">
      <div style={{ background:IL.card, borderRadius:24, width:"100%", maxWidth:672, boxShadow:"0 24px 80px rgba(0,0,0,0.65),0 0 0 1px rgba(255,255,255,0.06)", display:"flex", flexDirection:"column", maxHeight:"90vh" }}>

        {/* Header */}
        <div style={{ padding:"16px 20px", borderBottom:`1px solid ${IL.bord}`, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexShrink:0 }}>
          <div style={{ minWidth:0 }}>
            <p style={{ color:IL.tp, fontWeight:900, fontSize:17 }}>✂ Split Payment</p>
            <p style={{ color:IL.mu, fontSize:13 }}>Pick a method for each item — cash collects right away</p>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
            <select
              value=""
              onChange={e => { if (e.target.value) assignAll(e.target.value); }}
              style={{ height:40, padding:"0 12px", borderRadius:12, background:IL.hdr, border:`1px solid ${IL.bord}`, color:IL.tp, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}
              aria-label="Pay all with…"
            >
              <option value="">Pay all with…</option>
              {SPLIT_METHODS.map(sm => (
                <option key={sm.key} value={sm.key}>{sm.icon} {sm.label}</option>
              ))}
            </select>
            <button onClick={onClose} style={{ color:IL.mu, fontSize:24, fontWeight:700, width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit" }}>×</button>
          </div>
        </div>

        {/* Items */}
        <div style={{ flex:1, overflowY:"auto", padding:16, display:"flex", flexDirection:"column", gap:8 }}>
          {cart.map(item => {
            const isSelected = selected.has(item.key);
            const method = assignments[item.key];
            const isPaid = itemPaid(item);
            const isCashPending = method === "cash" && !cashReceipts[item.key];
            const itemAmt = scaledItemAmount(item);
            const r = method === "cash" ? cashReceipts[item.key] : undefined;
            return (
              <div key={item.key} style={{ borderRadius:14, border: isPaid ? "1px solid rgba(48,209,88,0.4)" : isCashPending ? "1px solid rgba(245,158,11,0.45)" : isSelected ? "1px solid rgba(255,107,0,0.4)" : `1px solid ${IL.bord}`, background: isPaid ? "rgba(48,209,88,0.1)" : isCashPending ? "rgba(245,158,11,0.1)" : isSelected ? "rgba(255,107,0,0.1)" : "rgba(255,255,255,0.04)" }}>
                <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 12px" }}>
                  <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(item.key)}
                    className="w-5 h-5 rounded accent-orange-400 cursor-pointer flex-shrink-0" />

                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ color:IL.tp, fontSize:13, fontWeight:600, lineHeight:1.3 }}>
                      {item.quantity > 1 && <span style={{ color:IL.or, fontWeight:900, marginRight:4 }}>{item.quantity}×</span>}
                      {item.name}
                    </p>
                    {item.modifierSelections.length > 0 && (
                      <p style={{ color:IL.mu, fontSize:11, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.modifierSelections.map(m => m.name).join(", ")}</p>
                    )}
                    {r && (
                      <p style={{ color:IL.grn, fontSize:11, fontWeight:600, marginTop:2 }}>
                        Tendered {fmt(r.tendered)}{r.change > 0.005 ? ` • Change ${fmt(r.change)}` : ""}
                      </p>
                    )}
                  </div>

                  <span style={{ color:IL.tp, fontSize:13, fontWeight:700, flexShrink:0, width:60, textAlign:"right" }}>{fmt(itemAmt)}</span>

                  <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
                    {isPaid && <span style={{ color:IL.grn, fontSize:16, flexShrink:0 }} title="Paid">✓</span>}
                    {method === "cash" && r && (
                      <button onClick={() => openCashFor(item.key)} title="Re-enter cash"
                        style={{ height:44, padding:"0 8px", fontSize:11, color:IL.mu, background:"none", border:"none", cursor:"pointer", textDecoration:"underline", fontFamily:"inherit" }}>edit</button>
                    )}
                    <select
                      value={method ?? ""}
                      onChange={e => pickMethodForItem(item.key, e.target.value)}
                      style={{ height:44, padding:"0 12px", borderRadius:12, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", minWidth:140, background: isPaid ? "rgba(48,209,88,0.15)" : isCashPending ? "rgba(245,158,11,0.15)" : IL.hdr, border: isPaid ? "1px solid rgba(48,209,88,0.4)" : isCashPending ? "1px solid rgba(245,158,11,0.4)" : `1px solid ${IL.bord}`, color: isPaid ? IL.grn : isCashPending ? "#fbbf24" : IL.tm }}
                      aria-label={`Payment method for ${item.name}`}
                    >
                      <option value="">Pay with…</option>
                      {SPLIT_METHODS.map(s => (
                        <option key={s.key} value={s.key}>{s.icon} {s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bulk assign bar */}
        {selected.size > 0 && (
          <div style={{ padding:"0 16px 8px", flexShrink:0 }}>
            <div style={{ background:"rgba(255,107,0,0.1)", border:"1px solid rgba(255,107,0,0.3)", borderRadius:14, padding:12, display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
              <span style={{ color:IL.or, fontSize:13, fontWeight:900, flexShrink:0 }}>{selected.size} item{selected.size > 1 ? "s" : ""}</span>
              <span style={{ color:IL.mu, fontSize:11, flexShrink:0 }}>pay with:</span>
              {SPLIT_METHODS.map(sm => (
                <button key={sm.key} onClick={() => bulkAssign(Array.from(selected), sm.key)}
                  style={{ flex:1, minWidth:80, height:40, borderRadius:12, fontSize:13, fontWeight:900, background:"rgba(255,255,255,0.08)", border:`1px solid ${IL.bord}`, color:IL.tp, cursor:"pointer", fontFamily:"inherit" }}>
                  {sm.icon} {sm.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        <div style={{ padding:"0 16px 8px", flexShrink:0, display:"flex", flexDirection:"column", gap:6 }}>
          {Object.entries(methodTotals).map(([method, { amount }]) => {
            const sm = SPLIT_METHODS.find(x => x.key === method);
            return (
              <div key={method} style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                <span style={{ color:IL.mu }}>{sm?.icon} {sm?.label ?? method}</span>
                <span style={{ color:IL.tp, fontWeight:700 }}>{fmt(Math.round(amount * 100) / 100)}</span>
              </div>
            );
          })}
          {unassignedAmt > 0.005 && (
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
              <span style={{ color:"#fbbf24" }}>⚠ Not yet assigned</span>
              <span style={{ color:"#fbbf24", fontWeight:700 }}>{fmt(Math.round(unassignedAmt * 100) / 100)}</span>
            </div>
          )}
          {allAssigned && !allPaid && (
            <div style={{ fontSize:13 }}>
              <span style={{ color:"#fbbf24" }}>⚠ Cash still to collect for {cart.filter(i => assignments[i.key] === "cash" && !cashReceipts[i.key]).length} item(s)</span>
            </div>
          )}
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:15, fontWeight:900, borderTop:`1px solid ${IL.bord}`, paddingTop:8 }}>
            <span style={{ color:IL.tp }}>Total</span>
            <span style={{ color:IL.or }}>{fmt(total)}</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding:"0 16px 16px", display:"flex", gap:12, flexShrink:0 }}>
          <button onClick={onClose} style={{ height:48, padding:"0 16px", borderRadius:14, border:`1px solid ${IL.bord}`, color:IL.mu, background:"none", fontWeight:600, cursor:"pointer", fontFamily:"inherit", fontSize:13 }}>
            Cancel
          </button>
          {Object.keys(assignments).length > 0 && (
            <button onClick={clearAll} style={{ height:48, padding:"0 16px", borderRadius:14, border:`1px solid ${IL.bord}`, color:IL.mu, background:"none", fontWeight:600, cursor:"pointer", fontFamily:"inherit", fontSize:13 }}>
              Clear
            </button>
          )}
          <button onClick={finalizeOrder} disabled={!allPaid || submitting}
            style={{ flex:1, height:48, borderRadius:14, background:`linear-gradient(135deg,${IL.or},#ff9500)`, border:"none", color:"#fff", fontWeight:900, fontSize:13, cursor:"pointer", fontFamily:"inherit", opacity:(!allPaid||submitting)?0.4:1, boxShadow:(!allPaid||submitting)?"none":"0 4px 16px rgba(255,107,0,0.45)" }}>
            {submitting ? "Placing order…" : allPaid ? "✓ Place Order" : !allAssigned ? "Assign all items first" : "Collect remaining cash first"}
          </button>
        </div>
      </div>

      {/* Per-item cash overlay — opens when user picks Cash for an item */}
      {cashItem && (
        <div className="fixed inset-0 bg-black/85 z-[60] flex items-end sm:items-center justify-center p-4" onClick={cancelCashCollection}>
          <div style={{ background:IL.card, borderRadius:24, width:"100%", maxWidth:384, boxShadow:"0 24px 80px rgba(0,0,0,0.7),0 0 0 1px rgba(255,255,255,0.06)", display:"flex", flexDirection:"column", maxHeight:"90vh" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding:"16px 20px", borderBottom:`1px solid ${IL.bord}`, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
              <div style={{ minWidth:0 }}>
                <p style={{ color:IL.tp, fontWeight:900, fontSize:15, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>💵 Cash for {cashItem.quantity > 1 ? `${cashItem.quantity}× ` : ""}{cashItem.name}</p>
                <p style={{ color:IL.mu, fontSize:13 }}>Amount due: <span style={{ color:IL.or, fontWeight:700 }}>{fmt(cashItemAmount)}</span></p>
              </div>
              <button onClick={cancelCashCollection} style={{ color:IL.mu, fontSize:24, fontWeight:700, width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit" }}>×</button>
            </div>

            <div style={{ padding:20, overflowY:"auto" }}>
              <p style={{ color:IL.mu, fontSize:13, marginBottom:8 }}>Amount tendered</p>
              <div style={{ background:"rgba(255,255,255,0.07)", border:`1px solid ${IL.bord}`, borderRadius:14, padding:12, color:IL.tp, fontSize:30, fontFamily:"monospace", fontWeight:700, textAlign:"right", marginBottom:12 }}>
                ${cashTendered}
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                {cashQuick.map(q => (
                  <button key={q} onClick={() => setCashTendered(String(q))}
                    style={{ flex:1, minWidth:56, height:40, borderRadius:12, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", background: parseFloat(cashTendered) === q ? `linear-gradient(135deg,${IL.or},#ff9500)` : "rgba(255,255,255,0.07)", border: parseFloat(cashTendered) === q ? "none" : `1px solid ${IL.bord}`, color: parseFloat(cashTendered) === q ? "#fff" : IL.tm, boxShadow: parseFloat(cashTendered) === q ? "0 3px 10px rgba(255,107,0,0.4)" : "none" }}>
                    {fmt(q)}
                  </button>
                ))}
              </div>
              <Numpad value={cashTendered} onChange={setCashTendered} />
              {cashTenderedEnough ? (
                <div style={{ marginTop:16, background:"rgba(48,209,88,0.12)", borderRadius:14, padding:16, textAlign:"center", border:"1px solid rgba(48,209,88,0.3)" }}>
                  <p style={{ color:IL.grn, fontSize:13, fontWeight:600 }}>Change due</p>
                  <p style={{ color:IL.grn, fontSize:30, fontWeight:900, marginTop:4 }}>{fmt(cashChangeForItem)}</p>
                </div>
              ) : (
                <div style={{ marginTop:16, background:"rgba(255,69,58,0.1)", borderRadius:14, padding:12, textAlign:"center", border:"1px solid rgba(255,69,58,0.3)" }}>
                  <p style={{ color:"#ffa5a1", fontSize:13, fontWeight:600 }}>Short by {fmt(cashItemAmount - cashTenderedNum)}</p>
                </div>
              )}
            </div>

            <div style={{ padding:"16px 20px", borderTop:`1px solid ${IL.bord}`, display:"flex", gap:12, flexShrink:0 }}>
              <button onClick={cancelCashCollection} style={{ height:48, padding:"0 20px", borderRadius:14, border:`1px solid ${IL.bord}`, color:IL.mu, background:"none", fontWeight:600, cursor:"pointer", fontFamily:"inherit", fontSize:13 }}>Cancel</button>
              <button onClick={saveCashReceipt} disabled={!cashTenderedEnough}
                style={{ flex:1, height:48, borderRadius:14, background:`linear-gradient(135deg,${IL.or},#ff9500)`, border:"none", color:"#fff", fontWeight:900, fontSize:15, cursor:"pointer", fontFamily:"inherit", opacity:cashTenderedEnough?1:0.4, boxShadow:cashTenderedEnough?"0 4px 16px rgba(255,107,0,0.45)":"none" }}>
                ✓ Save & Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main POS ─────────────────────────────────────────────────────────────────

export default function POS() {
  const [, navigate] = useLocation();

  // TODO(store-settings): use `POS — ${useStoreSettings().storeName}` once page-meta accepts a getter
  useEffect(() => { setPageMeta("POS — Island Tacos", "🖥️", { iconUrl: "/icon-pos-192.png", manifestUrl: "/manifest-pos.json" }); }, []);

  // Sync printer config from server on load — ensures all devices share one config
  // set from Admin → Reports → Printer Settings.
  useEffect(() => {
    fetch("/api/settings", { credentials: "include", headers: authHeaders() })
      .then(r => r.json())
      .then((data: Record<string, string>) => {
        if (data.printer_config) {
          try {
            const cfg = JSON.parse(data.printer_config) as Record<string, unknown>;
            const current = JSON.parse(localStorage.getItem("printerConfig") ?? "{}") as Record<string, unknown>;
            localStorage.setItem("printerConfig", JSON.stringify({ ...current, ...cfg }));
          } catch { /* ignore */ }
        }
      })
      .catch(() => { /* fallback to localStorage */ });
  }, []);

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

  const _API = import.meta.env.BASE_URL.replace(/\/$/, "");
  const reloadMenu = useCallback(() => {
    Promise.all([
      fetch(`${_API}/api/menu/categories`, { credentials: "include", headers: authHeaders() }).then(r => r.json()),
      fetch(`${_API}/api/menu/items`, { credentials: "include", headers: authHeaders() }).then(r => r.json()),
    ]).then(([cats, items]) => {
      setCategories(Array.isArray(cats) ? cats : []);
      setAllItems(Array.isArray(items) ? items : []);
    }).catch(err => {
      console.error("POS menu load failed:", err);
    }).finally(() => setLoadingMenu(false));
  }, [_API]);
  useEffect(() => { reloadMenu(); }, [reloadMenu]);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [discount, setDiscount] = useState(0);
  const [resumedOrderId, setResumedOrderId] = useState<number | null>(null);
  // Snapshot of resumed-ticket lines (key → quantity) taken at resume time.
  // Used to detect whether the cashier modified the resumed lines (removed an
  // item or changed a quantity). If unchanged, we PATCH the existing order
  // in-place (keeps it on KDS). If ANY structural change happened, we MUST
  // cancel + recreate so the new item list actually persists — the PATCH
  // endpoint does not accept an items array, so without this check a removed
  // item silently stays on the saved order (bug seen 2026-05-20).
  const resumedSnapshotRef = useRef<Map<string, number>>(new Map());
  // Cache modifier lists by menu item ID so re-tapping a cart item is instant
  // and rapid double-taps don't fire concurrent fetches.
  // TTL: 5 minutes — ensures modifier updates (new options, price changes)
  // are picked up without requiring a full page refresh.
  const MODIFIER_CACHE_TTL_MS = 5 * 60 * 1000;
  const modifierCacheRef = useRef<Map<number, { mods: Modifier[]; ts: number }>>(new Map());
  const editingCartKeyRef = useRef<string | null>(null);
  const resumedItemsUnchanged = useCallback((): boolean => {
    const snap = resumedSnapshotRef.current;
    if (snap.size === 0) return true; // not a resumed ticket
    const madeLines = cart.filter(c => c.alreadyMade);
    if (madeLines.length !== snap.size) return false; // line removed
    return madeLines.every(c => snap.get(c.key) === c.quantity);
  }, [cart]);

  const API = import.meta.env.BASE_URL.replace(/\/$/, "");

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
  const [openPriceModal, setOpenPriceModal] = useState<{
    item: MenuItem; editKey?: string; initialPrice?: number; initialNote?: string;
  } | null>(null);
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
        const r = await fetch("/api/orders?limit=500", { credentials: "include", headers: authHeaders() });
        const data: Order[] = await r.json();

        // ── Online + phone order notifications ──
        const pending = data.filter(o => (o.source === "online" || o.source === "phone") && o.status === "pending");
        if (isFirstOnlineFetchRef.current) {
          isFirstOnlineFetchRef.current = false;
          pending.forEach(o => seenOnlineIdsRef.current.add(o.id));
          setIncomingOrders(pending);
          // Show popup + chime for any pending orders already waiting when the page loads
          if (pending.length > 0) {
            setPopupOrders(pending);
            playChime();
          }
        } else {
          // Prune popup orders that are no longer pending on the server.
          // This stops the repeat chime when an order was confirmed/cancelled
          // by another device or auto-process (e.g. Vapi) without the POS acting on it.
          const pendingIds = new Set(pending.map(o => o.id));
          setPopupOrders(prev => prev.filter(o => pendingIds.has(o.id)));

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

        // ── Held ticket count — unpaid POS holds + pre-paid holds + ready orders ──
        setTicketCount(data.filter(o =>
          !["completed", "cancelled"].includes(o.status) &&
          (o.source === "pos" || o.status === "ready")
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
      credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ status: "confirmed" }),
    });
    // Do NOT delete from seenOnlineIdsRef — keeping the ID prevents re-alerting
    // if the PATCH fails silently (order would re-appear as "new" on next poll).
    setIncomingOrders(prev => prev.filter(o => o.id !== id));
    setPopupOrders(prev => prev.filter(o => o.id !== id));
    setShowRejectInput(false); setRejectReason("");
  };

  const rejectOnline = async (id: number) => {
    await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ status: "cancelled", cancellationReason: rejectReason || null }),
    });
    // Do NOT delete from seenOnlineIdsRef — same reason as acceptOnline above.
    setIncomingOrders(prev => prev.filter(o => o.id !== id));
    setPopupOrders(prev => prev.filter(o => o.id !== id));
    setShowRejectInput(false); setRejectReason("");
  };

  // Clock + ticket count
  useEffect(() => {
    const t = setInterval(() => setTime(now()), 10000);
    return () => clearInterval(t);
  }, []);


  // Filtered items — sold-out items still show in POS (available=false only hides from online store)
  const filteredItems = allItems.filter(item => {
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
      credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ status: "idle", items: [], subtotal: 0, tax: 0, total: 0 }),
    }).catch(() => {});
  }, []);

  // Broadcast cart state to customer display tablet (debounced 50ms)
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
              // Number() coercion: DB may return price as string — prevent "12.50" + 2 = "12.502"
              unitPrice: Number(c.price) + (c.modifierSelections ?? []).reduce((s, m) => s + m.price, 0),
              modifiers: (c.modifierSelections ?? []).map(m => m.name),
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
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      }).catch(() => {});
    }, 50);
    return () => clearTimeout(t);
  }, [cart, subtotal, total, discount, paymentModal, paymentTab]);

  // Add item to cart
  const addItem = async (item: MenuItem) => {
    // Open-price items (e.g. "Misc") prompt for a one-off price + note before going in the cart.
    if (item.openPrice) {
      setOpenPriceModal({ item });
      return;
    }
    // Check for modifiers (seed cache so cart re-edits are instant)
    try {
      const cached = modifierCacheRef.current.get(item.id);
      const now = Date.now();
      let mods = (cached && now - cached.ts < MODIFIER_CACHE_TTL_MS) ? cached.mods : null;
      if (!mods) {
        const r = await fetch(`/api/menu/items/${item.id}/modifiers`, { credentials: "include" });
        mods = await r.json() as Modifier[];
        modifierCacheRef.current.set(item.id, { mods, ts: now });
      }
      if (mods.length > 0) {
        setModifierModal({ item, mods });
        return;
      }
    } catch {}
    // No modifiers — add directly
    pushToCart(item, []);
  };

  const pushToCart = (item: MenuItem, sels: CartModifier[], note = "", priceOverride?: number) => {
    // New items added during a resumed ticket leave alreadyMade undefined so the
    // save path detects the cart change and runs cancel+create. Existing lines on
    // the resumed ticket keep their alreadyMade=true flag, which is what protects
    // kitchen items from being re-fired to KDS — including when a non-KDS line
    // (e.g. a drink) is the only thing being added.
    //
    // IMPORTANT: use the functional form of setCart. This function is called via
    // the memoized ItemCard's onClick, which caches a closure over an OLDER
    // `cart` value. Reading `cart` from this closure would wipe items added
    // after the ItemCard last rendered — e.g. resuming a held ticket then
    // tapping a new item caused the new item to replace all resumed lines
    // (bug seen 2026-05-25, caused by the ItemCard memo added 2026-05-25).
    const unitPrice = priceOverride ?? item.price;
    setCart(prev => {
      // Every tap always creates a new line — no auto-merging.
      // Use the + / − buttons on an existing line to adjust quantity.
      // This keeps split payments possible (each person's item is its own line).
      return [...prev, {
        key: uid(),
        menuItemId: item.id,
        name: item.name,
        price: unitPrice,
        quantity: 1,
        notes: note,
        modifierSelections: sels,
        ...(priceOverride !== undefined ? { priceOverride } : {}),
      }];
    });
    // Auto-switch to cart panel on mobile
    if (window.innerWidth < 640) setMobileView("cart");
  };

  const removeItem = (key: string) => setCart(prev => prev.filter(c => c.key !== key));
  const changeQty = (key: string, delta: number) => {
    setCart(prev => prev.map(c => c.key === key ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c));
  };
  const setItemNote = (key: string, note: string) => setCart(prev => prev.map(c => c.key === key ? { ...c, notes: note } : c));

  // Re-open the modifier modal pre-filled with a cart item's current selections
  const editCartItem = async (cartItem: CartItem) => {
    // Guard: ignore rapid double-taps while a fetch is already in flight for this key.
    if (editingCartKeyRef.current === cartItem.key) return;
    editingCartKeyRef.current = cartItem.key;
    try {
      const menuItem = allItems.find(i => i.id === cartItem.menuItemId);
      if (!menuItem) return;
      // Open-price lines: reopen the OpenPriceModal pre-filled so the cashier can adjust
      // the price and description in place. Cancelling preserves the original line.
      if (menuItem.openPrice || cartItem.priceOverride !== undefined) {
        setOpenPriceModal({
          item: menuItem,
          editKey: cartItem.key,
          initialPrice: cartItem.price,
          initialNote: cartItem.notes,
        });
        return;
      }
      // Use cached modifiers — already fetched when the item was first added.
      // Only hits the network if the cache is cold or expired (5-min TTL).
      const cachedEdit = modifierCacheRef.current.get(menuItem.id);
      const nowEdit = Date.now();
      let mods = (cachedEdit && nowEdit - cachedEdit.ts < MODIFIER_CACHE_TTL_MS) ? cachedEdit.mods : null;
      if (!mods) {
        const r = await fetch(`/api/menu/items/${menuItem.id}/modifiers`, { credentials: "include" });
        mods = await r.json() as Modifier[];
        modifierCacheRef.current.set(menuItem.id, { mods, ts: nowEdit });
      }
      if (mods.length > 0 || cartItem.notes) {
        setModifierModal({
          item: menuItem,
          mods,
          editKey: cartItem.key,
          initialSelections: cartItem.modifierSelections,
          initialNote: cartItem.notes,
        });
      }
    } catch {
      // network error — silently ignore, cashier can try again
    } finally {
      editingCartKeyRef.current = null;
    }
  };

  const clearCart = () => {
    setCart([]); setCustomerName(""); setCustomerPhone(""); setOrderNotes(""); setDiscount(0); setResumedOrderId(null);
    resumedSnapshotRef.current = new Map();
  };

  // Place order
  const placeOrder = async (method: string, paymentStatus: "pending" | "paid", tendered?: number, overrideName?: string, overridePhone?: string, overrideNote?: string) => {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      let order: Order;
      // PATCH-in-place only when no new items AND no resumed lines were
      // removed/qty-changed — the PATCH endpoint doesn't accept items, so any
      // structural change must go through cancel + recreate or it's silently lost.
      // Detect add-on scenario: new items added to resumed ticket but original lines
      // untouched (no qty changes, no removals). Use add-items endpoint instead of
      // cancel+recreate so the original order keeps its KDS position and status column.
      // cancel+recreate was causing: (1) order disappearing from KDS when only a drink
      // was added, and (2) items in "Preparing" jumping back to "Accept".
      const newCartItems = cart.filter(c => !c.alreadyMade);
      const existingUnchanged = resumedItemsUnchanged();
      const noNewItems = resumedOrderId && newCartItems.length === 0 && existingUnchanged;
      const addOnOnly = resumedOrderId && newCartItems.length > 0 && existingUnchanged;

      if (noNewItems) {
        // Unchanged resumed ticket — patch the existing order in-place so it stays on KDS.
        const notes = (overrideNote ?? orderNotes) || undefined;
        const patchBody: Record<string, unknown> = { ...(notes ? { notes } : {}) };
        if (paymentStatus === "paid") {
          patchBody.actualPaymentMethod = method;
          patchBody.paymentStatus = "paid";
          patchBody.status = "completed";
          if (tendered != null) patchBody.amountTendered = tendered;
        }
        // For "pending" (re-hold): just update notes/name if changed — keep status as-is
        const r = await fetch(`/api/orders/${resumedOrderId}`, {
          method: "PATCH", credentials: "include",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify(patchBody),
        });
        if (!r.ok) {
          const errData = await r.json().catch(() => ({})) as { error?: string };
          throw new Error(errData.error ?? `Order failed (${r.status})`);
        }
        order = await r.json();
        if (!order?.items) throw new Error("Order response missing items");
      } else if (addOnOnly) {
        // Add-on items only, existing lines untouched — append to the existing order.
        // The original order stays on KDS with its current status and column position.
        const addR = await fetch(`/api/orders/${resumedOrderId}/add-items`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            items: newCartItems.map(c => {
              const mi = allItems.find(i => i.id === c.menuItemId);
              const override = c.priceOverride ?? (mi?.openPrice ? c.price : undefined);
              return {
                menuItemId: c.menuItemId ?? null,
                menuItemName: c.name,
                menuItemPrice: c.price,
                quantity: c.quantity,
                notes: c.notes || null,
                modifierSelections: c.modifierSelections.length > 0 ? c.modifierSelections : undefined,
                ...(override !== undefined ? { priceOverride: override } : {}),
              };
            }),
          }),
        });
        if (!addR.ok) {
          const errData = await addR.json().catch(() => ({})) as { error?: string };
          throw new Error(errData.error ?? `Failed to add items (${addR.status})`);
        }
        // PATCH payment / hold state on the same order
        const notes = (overrideNote ?? orderNotes) || undefined;
        const patchBody: Record<string, unknown> = { ...(notes ? { notes } : {}) };
        if (paymentStatus === "paid") {
          patchBody.actualPaymentMethod = method;
          patchBody.paymentStatus = "paid";
          patchBody.status = "completed";
          if (tendered != null) patchBody.amountTendered = tendered;
        }
        const patchR = await fetch(`/api/orders/${resumedOrderId}`, {
          method: "PATCH", credentials: "include",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify(patchBody),
        });
        if (!patchR.ok) {
          const errData = await patchR.json().catch(() => ({})) as { error?: string };
          throw new Error(errData.error ?? `Order failed (${patchR.status})`);
        }
        order = await patchR.json();
        if (!order?.items) throw new Error("Order response missing items");
      } else {
        // Existing items were changed (qty or removed) — cancel old and create fresh order
        if (resumedOrderId) {
          const cancelRes = await fetch(`/api/orders/${resumedOrderId}`, {
            method: "PATCH", credentials: "include",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify({ status: "cancelled" }),
          });
          if (!cancelRes.ok) {
            const errData = await cancelRes.json().catch(() => ({})) as { error?: string };
            throw new Error(errData.error ?? `Could not cancel previous ticket (${cancelRes.status}). Order not placed.`);
          }
        }

        // If paying immediately and the cart has no KDS items (e.g. drinks only),
        // create the order as "completed" directly — no kitchen workflow needed.
        const cartHasKdsItems = cart.some(c => {
          const mi = allItems.find(i => i.id === c.menuItemId);
          if (!mi) return true; // unknown item — err on the side of caution, let KDS handle it
          const cat = categories.find(cat => cat.id === mi.categoryId);
          return cat?.sendToKds === true;
        });
        const r = await fetch("/api/orders", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            customerName: overrideName ?? (customerName || "Walk-in"),
            customerEmail: "",
            customerPhone: overridePhone ?? "",
            orderType: "pickup",
            paymentMethod: method,
            paymentStatus,
            source: "pos",
            discountAmount: discount,
            ...(paymentStatus === "paid" && !cartHasKdsItems ? { status: "completed" } : {}),
            ...(tendered != null && paymentStatus === "paid" ? { amountTendered: tendered } : {}),
            notes: (overrideNote ?? orderNotes) || null,
            items: cart.map(c => {
              // Resumed tickets lose the priceOverride flag in transit (the persisted order
              // item only carries the unit price). Re-derive it for any line whose menu item
              // is openPrice so the server-side validation is satisfied on resubmit.
              const mi = allItems.find(i => i.id === c.menuItemId);
              const override = c.priceOverride ?? (mi?.openPrice ? c.price : undefined);
              return {
                menuItemId: c.menuItemId ?? null,
                // Always send the snapshotted name+price. The server uses these as a
                // fallback when menuItemId is null (menu item deleted after ticket was held).
                menuItemName: c.name,
                menuItemPrice: c.price,
                quantity: c.quantity,
                notes: c.notes || null,
                modifierSelections: c.modifierSelections.length > 0 ? c.modifierSelections : undefined,
                alreadyMade: c.alreadyMade ?? false,
                ...(override !== undefined ? { priceOverride: override } : {}),
              };
            }),
          }),
        });
        if (!r.ok) {
          const errData = await r.json().catch(() => ({})) as { error?: string };
          throw new Error(errData.error ?? `Order failed (${r.status})`);
        }
        order = await r.json();
        if (!order?.items) throw new Error("Order response missing items");
      }
      if (paymentStatus === "paid") {
        // Push "completed" state to customer display only for actual payments
        displayCompletedAt.current = Date.now();
        fetch("/api/display", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", ...authHeaders() },
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
      }
      clearCart();
      setResumedOrderId(null);
      if (paymentStatus === "paid") {
        // Show receipt only for completed payments
        setReceiptModal({ order, tendered });
        // Paying a resumed ticket removes it from the held count; new paid orders don't affect it
        setTicketCount(tc => Math.max(0, tc + (resumedOrderId ? -1 : 0)));
      } else if (!noNewItems && !addOnOnly) {
        // First-time hold of a brand-new ticket: add it to the held count
        setTicketCount(tc => tc + 1);
      }
      // Re-hold (noNewItems or addOnOnly + pending): ticket already counted — no change
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

  const handlePayAndHold = async (method: string, tendered?: number, splitNote?: string) => {
    setPaymentModal(false);
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      const noteWithSplit = splitNote
        ? (orderNotes ? `${orderNotes}\n${splitNote}` : splitNote)
        : (orderNotes || undefined);
      // Same three-way guard as placeOrder: PATCH-in-place / add-items / cancel+recreate.
      const hpNewCartItems = cart.filter(c => !c.alreadyMade);
      const hpExistingUnchanged = resumedItemsUnchanged();
      const noNewItems = resumedOrderId && hpNewCartItems.length === 0 && hpExistingUnchanged;
      const addOnOnly = resumedOrderId && hpNewCartItems.length > 0 && hpExistingUnchanged;

      if (noNewItems) {
        // No new items — patch existing order's payment without touching status or KDS state
        const r = await fetch(`/api/orders/${resumedOrderId}`, {
          method: "PATCH", credentials: "include",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            actualPaymentMethod: method,
            paymentStatus: "paid",
            ...(noteWithSplit ? { notes: noteWithSplit } : {}),
          }),
        });
        if (!r.ok) {
          const errData = await r.json().catch(() => ({})) as { error?: string };
          throw new Error(errData.error ?? `Order failed (${r.status})`);
        }
      } else if (addOnOnly) {
        // Add-on items only — append to existing order, then patch payment
        const addR = await fetch(`/api/orders/${resumedOrderId}/add-items`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            items: hpNewCartItems.map(c => {
              const mi = allItems.find(i => i.id === c.menuItemId);
              const override = c.priceOverride ?? (mi?.openPrice ? c.price : undefined);
              return {
                menuItemId: c.menuItemId ?? null,
                menuItemName: c.name,
                menuItemPrice: c.price,
                quantity: c.quantity,
                notes: c.notes || null,
                modifierSelections: c.modifierSelections.length > 0 ? c.modifierSelections : undefined,
                ...(override !== undefined ? { priceOverride: override } : {}),
              };
            }),
          }),
        });
        if (!addR.ok) {
          const errData = await addR.json().catch(() => ({})) as { error?: string };
          throw new Error(errData.error ?? `Failed to add items (${addR.status})`);
        }
        const patchR = await fetch(`/api/orders/${resumedOrderId}`, {
          method: "PATCH", credentials: "include",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            actualPaymentMethod: method,
            paymentStatus: "paid",
            ...(noteWithSplit ? { notes: noteWithSplit } : {}),
          }),
        });
        if (!patchR.ok) {
          const errData = await patchR.json().catch(() => ({})) as { error?: string };
          throw new Error(errData.error ?? `Order failed (${patchR.status})`);
        }
      } else {
        // Existing items were changed — cancel old ticket and create a new one
        if (resumedOrderId) {
          const cancelRes = await fetch(`/api/orders/${resumedOrderId}`, {
            method: "PATCH", credentials: "include",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify({ status: "cancelled" }),
          });
          if (!cancelRes.ok) {
            const errData = await cancelRes.json().catch(() => ({})) as { error?: string };
            throw new Error(errData.error ?? `Could not cancel previous ticket (${cancelRes.status}). Order not placed.`);
          }
        }
        const r = await fetch("/api/orders", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            customerName: customerName || "Walk-in",
            customerEmail: "",
            customerPhone: customerPhone || "",
            orderType: "pickup",
            paymentMethod: method,
            paymentStatus: "paid",
            source: "pos",
            discountAmount: discount,
            ...(tendered != null ? { amountTendered: tendered } : {}),
            notes: noteWithSplit || null,
            items: cart.map(c => {
              const mi = allItems.find(i => i.id === c.menuItemId);
              const override = c.priceOverride ?? (mi?.openPrice ? c.price : undefined);
              return {
                menuItemId: c.menuItemId ?? null,
                menuItemName: c.name,
                menuItemPrice: c.price,
                quantity: c.quantity,
                notes: c.notes || null,
                modifierSelections: c.modifierSelections.length > 0 ? c.modifierSelections : undefined,
                alreadyMade: c.alreadyMade ?? false,
                ...(override !== undefined ? { priceOverride: override } : {}),
              };
            }),
          }),
        });
        if (!r.ok) {
          const errData = await r.json().catch(() => ({})) as { error?: string };
          throw new Error(errData.error ?? `Order failed (${r.status})`);
        }
      }
      clearCart();
      setResumedOrderId(null);
      // addOnOnly: ticket was already held, now paid — decrement same as noNewItems path
      setTicketCount(tc => tc + (noNewItems || addOnOnly ? 0 : 1));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to hold order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleHold = () => {
    if (cart.length === 0) return;
    // Resumed ticket already has name/phone — save immediately without re-asking
    if (resumedOrderId) {
      void placeOrder("cash", "pending", undefined, customerName || "Walk-in", customerPhone, orderNotes);
      return;
    }
    setHoldModal(true);
  };

  const handleHoldConfirm = async (name: string, phone: string, note: string) => {
    setHoldModal(false);
    await placeOrder("cash", "pending", undefined, name || "Walk-in", phone, note);
  };

  const handleResume = (items: CartItem[], name: string, phone: string, note: string, disc: number, orderId: number) => {
    setCart(items); setCustomerName(name); setCustomerPhone(phone); setOrderNotes(note); setDiscount(disc); setResumedOrderId(orderId);
    // Snapshot original lines so we can later detect removals / qty edits.
    resumedSnapshotRef.current = new Map(items.map(i => [i.key, i.quantity]));
  };

  const handleTicketPaymentComplete = (order: Order, tendered?: number) => {
    setTicketsOpen(false);
    setReceiptModal({ order, tendered });
    setTicketCount(tc => Math.max(0, tc - 1));
  };

  // ─ Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden select-none" style={{ fontFamily:"Inter, sans-serif", background:IL.bg, color:IL.tp }}>

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 py-2.5 flex-shrink-0" style={{ background:IL.hdr, borderBottom:`1px solid ${IL.bord}` }}>
        <div className="flex items-center gap-3">
          {/* TODO(store-settings): use useStoreSettings().storeName for alt */}
          <img src="/logo.svg" alt="Island Tacos" className="h-8 w-8 object-contain rounded-lg"/>
          <span style={{ color:IL.mu, fontSize:13, fontWeight:600 }} className="hidden sm:block">Point of Sale</span>
        </div>
        <div style={{ color:IL.mu, fontSize:13, fontFamily:"monospace" }}>{time}</div>
        <div className="flex items-center gap-2">
          <button
            onClick={notifPerm === "granted" ? undefined : requestNotifPermission}
            title={notifPerm === "denied" ? "Enable notifications in your browser/device settings" : undefined}
            style={{ position:"relative", display:"flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:10, fontSize:13, fontWeight:600, cursor:notifPerm==="denied"?"not-allowed":"pointer", fontFamily:"inherit", background: incomingOrders.length > 0 ? IL.or : notifPerm === "granted" ? "rgba(48,209,88,0.12)" : notifPerm === "denied" ? "rgba(255,69,58,0.12)" : "rgba(255,255,255,0.07)", border: incomingOrders.length > 0 ? "none" : notifPerm === "granted" ? "1px solid rgba(48,209,88,0.3)" : notifPerm === "denied" ? "1px solid rgba(255,69,58,0.3)" : `1px solid ${IL.bord}`, color: incomingOrders.length > 0 ? "#fff" : notifPerm === "granted" ? IL.grn : notifPerm === "denied" ? IL.red : "#fbbf24", boxShadow: incomingOrders.length > 0 ? "0 0 18px rgba(255,107,0,0.5)" : "none" }}
            className={incomingOrders.length > 0 ? "animate-pulse" : ""}
          >
            {incomingOrders.length > 0 ? "🔔" : notifPerm === "granted" ? "🔔" : notifPerm === "denied" ? "🔕" : "🔔"}
            <span>
              {incomingOrders.length > 0
                ? `${incomingOrders.length} Pending`
                : notifPerm === "granted"
                  ? "Alerts On"
                  : notifPerm === "denied"
                    ? "Alerts Off"
                    : "Allow Alerts"}
            </span>
            {incomingOrders.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {incomingOrders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => currentShift && currentShift.id !== 0 ? setCloseShiftModal(true) : setOpenShiftModal(true)}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:10, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", background: currentShift && currentShift.id !== 0 ? "rgba(48,209,88,0.12)" : "rgba(255,69,58,0.12)", border: currentShift && currentShift.id !== 0 ? "1px solid rgba(48,209,88,0.3)" : "1px solid rgba(255,69,58,0.3)", color: currentShift && currentShift.id !== 0 ? IL.grn : IL.red }}
          >
            ⏱ <span className="hidden sm:inline">{currentShift && currentShift.id !== 0 ? "Shift Open" : "No Shift"}</span>
          </button>
          <button
            onClick={() => setCashMgmtOpen(true)}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:10, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", background:"rgba(255,255,255,0.06)", border:`1px solid ${IL.bord}`, color:IL.tm }}
          >
            💵 <span className="hidden sm:inline">Cash</span>
          </button>
          <button onClick={() => setReceiptsOpen(true)} style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:10, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", background:"rgba(255,255,255,0.06)", border:`1px solid ${IL.bord}`, color:IL.tm }}>
            🧾 <span className="hidden sm:inline">Receipts</span>
          </button>
          <button
            onClick={() => setSoldOutOpen(true)}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:10, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", background:"rgba(255,69,58,0.1)", border:"1px solid rgba(255,69,58,0.25)", color:IL.red }}
          >
            🚫 <span className="hidden sm:inline">Sold Out</span>
          </button>
          <button
            onClick={() => setTicketsOpen(true)}
            style={{ position:"relative", display:"flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:10, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", background: ticketCount > 0 ? IL.or : "rgba(255,255,255,0.06)", border: ticketCount > 0 ? "none" : `1px solid ${IL.bord}`, color: ticketCount > 0 ? "#fff" : IL.tm, boxShadow: ticketCount > 0 ? "0 0 18px rgba(255,107,0,0.5)" : "none" }}
          >
            🎫 <span className="hidden sm:inline">{ticketCount > 0 ? `${ticketCount} Held` : "Tickets"}</span>
            {ticketCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-gray-900 text-xs font-black w-5 h-5 rounded-full flex items-center justify-center shadow-md">
                {ticketCount}
              </span>
            )}
          </button>
          <button onClick={() => navigate(`${adminRoutes.login}?redirect=${encodeURIComponent(adminRoutes.dashboard)}`)} style={{ padding:"6px 12px", borderRadius:10, background:"rgba(255,255,255,0.06)", border:`1px solid ${IL.bord}`, color:IL.mu, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
            ← <span className="hidden sm:inline">Admin</span>
          </button>
          <button
            onClick={() => window.location.reload()}
            title="Reload POS"
            style={{ padding:"6px 10px", borderRadius:10, background:"rgba(255,255,255,0.06)", border:`1px solid ${IL.bord}`, color:IL.mu, cursor:"pointer" }}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Main content ── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* ── Left: Menu ── */}
        <div className={`flex-col flex-1 min-w-0 overflow-hidden ${mobileView === "menu" ? "flex" : "hidden"} sm:flex`} style={{ borderRight:`1px solid ${IL.bord}` }}>

          {/* Search */}
          <div className="px-3 pt-3 pb-2 flex-shrink-0">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color:IL.mu }}>🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items…"
                style={{ width:"100%", background:"rgba(255,255,255,0.06)", border:`1px solid ${IL.bord}`, borderRadius:14, padding:"10px 16px 10px 36px", color:IL.tp, fontSize:14, outline:"none", fontFamily:"inherit" }}/>
            </div>
          </div>

          {/* Category tabs */}
          <div className="flex gap-2 px-3 pb-2 overflow-x-auto flex-shrink-0 scrollbar-none">
            <button onClick={() => setSelectedCat(null)}
              style={{ flexShrink:0, padding:"6px 16px", borderRadius:999, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", transition:"all 0.15s", background: selectedCat === null ? `linear-gradient(135deg,${IL.or},#ff9500)` : "rgba(255,255,255,0.07)", border: selectedCat === null ? "none" : `1px solid ${IL.bord}`, color: selectedCat === null ? "#fff" : IL.mu, boxShadow: selectedCat === null ? "0 3px 14px rgba(255,107,0,0.4)" : "none" }}>
              All
            </button>
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setSelectedCat(cat.id)}
                style={{ flexShrink:0, padding:"6px 16px", borderRadius:999, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", transition:"all 0.15s", background: selectedCat === cat.id ? `linear-gradient(135deg,${IL.or},#ff9500)` : "rgba(255,255,255,0.07)", border: selectedCat === cat.id ? "none" : `1px solid ${IL.bord}`, color: selectedCat === cat.id ? "#fff" : IL.mu, boxShadow: selectedCat === cat.id ? "0 3px 14px rgba(255,107,0,0.4)" : "none" }}>
                {cat.name}
              </button>
            ))}
          </div>

          {/* Item grid */}
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {loadingMenu ? (
              <div className="flex items-center justify-center h-40" style={{ color:IL.mu }}>Loading menu…</div>
            ) : filteredItems.length === 0 ? (
              <div className="flex items-center justify-center h-40" style={{ color:IL.mu }}>No items found</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3" style={{ paddingTop:12 }}>
                {filteredItems.map(item => (
                  <ItemCard key={item.id} item={item} onClick={() => addItem(item)} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Cart ── */}
        <div className={`flex-col flex-shrink-0 w-full sm:w-80 xl:w-96 ${mobileView === "cart" ? "flex" : "hidden"} sm:flex`} style={{ background:IL.hdr }}>

          {/* Cart header */}
          <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom:`1px solid ${IL.bord}` }}>
            <div className="flex items-center justify-between mb-2">
              <h2 style={{ color:IL.tp, fontWeight:800, fontSize:15 }}>{resumedOrderId ? "Resumed Ticket" : "New Order"}</h2>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  style={{ display:"flex", alignItems:"center", gap:4, padding:"6px 12px", borderRadius:10, background:"rgba(255,69,58,0.1)", border:"1px solid rgba(255,69,58,0.25)", color:IL.red, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}
                >
                  <X className="w-4 h-4" />
                  Clear
                </button>
              )}
            </div>
            {resumedOrderId && (customerName || customerPhone) && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background:"rgba(255,107,0,0.1)", border:"1px solid rgba(255,107,0,0.25)" }}>
                <span className="text-base">👤</span>
                <div className="min-w-0">
                  {customerName && <p style={{ color:IL.tp, fontSize:13, fontWeight:600 }} className="leading-tight truncate">{customerName}</p>}
                  {customerPhone && <p style={{ color:IL.or, fontSize:11 }} className="leading-tight">{customerPhone}</p>}
                </div>
              </div>
            )}
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32" style={{ color:IL.mu }}>
                <span className="text-3xl mb-2">🌮</span>
                <span className="text-sm">Tap items to add</span>
              </div>
            ) : (
              cart.map(item => {
                const lineTotal = (item.price + item.modifierSelections.reduce((s, m) => s + m.price, 0)) * item.quantity;
                const { grad: cg, glow: cGw } = ITEM_GRADS[item.menuItemId % ITEM_GRADS.length];
                return (
                  <div key={item.key} style={{ background:cg, borderRadius:14, padding:12, boxShadow:`0 4px 18px ${cGw}`, position:"relative", overflow:"hidden" }}>
                    <div style={{ position:"absolute", inset:0, background:"linear-gradient(155deg,rgba(255,255,255,0.10) 0%,transparent 55%)", pointerEvents:"none", zIndex:0 }} />
                    <div className="flex items-start gap-2" style={{ position:"relative", zIndex:1 }}>
                      <button
                        className="flex-1 min-w-0 text-left active:opacity-70 transition-opacity"
                        onClick={() => editCartItem(item)}
                        title="Tap to edit modifiers"
                        style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"inherit" }}
                      >
                        <p style={{ color:"#fff", fontSize:13, fontWeight:700 }} className="truncate">{item.name}</p>
                        {item.modifierSelections.map((m, i) => (
                          <p key={i} style={{ color:"rgba(255,255,255,0.72)", fontSize:11 }}>+ {m.name}{m.price > 0 ? ` (+${fmt(m.price)})` : ""}</p>
                        ))}
                        {item.notes && <p style={{ color:"rgba(255,255,255,0.72)", fontSize:11, fontStyle:"italic" }}>{item.notes}</p>}
                        {(item.modifierSelections.length > 0 || item.notes) && (
                          <p style={{ color:"rgba(255,255,255,0.5)", fontSize:10, marginTop:2 }}>tap to edit</p>
                        )}
                      </button>
                      <span style={{ color:"#fff", fontSize:13, fontWeight:800, flexShrink:0 }}>{fmt(lineTotal)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2" style={{ position:"relative", zIndex:1 }}>
                      <div className="flex items-center gap-2">
                        <button onClick={() => changeQty(item.key, -1)} style={{ width:40, height:40, borderRadius:10, background:"rgba(0,0,0,0.25)", border:"1px solid rgba(255,255,255,0.2)", color:"#fff", fontSize:20, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontFamily:"inherit" }}>−</button>
                        <span style={{ color:"#fff", fontSize:13, fontWeight:800, width:24, textAlign:"center" }}>{item.quantity}</span>
                        <button onClick={() => changeQty(item.key, 1)} style={{ width:40, height:40, borderRadius:10, background:"rgba(0,0,0,0.25)", border:"1px solid rgba(255,255,255,0.2)", color:"#fff", fontSize:20, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontFamily:"inherit" }}>+</button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setItemNoteModal(item.key)} style={{ color:"rgba(255,255,255,0.7)", fontSize:12, background:"none", border:"none", cursor:"pointer", fontFamily:"inherit" }}>Note</button>
                        <button onClick={() => removeItem(item.key)} style={{ color:"rgba(255,255,255,0.7)", fontSize:20, background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", lineHeight:1 }}>×</button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Totals + actions */}
          {cart.length > 0 && (
            <div className="px-4 py-4 flex-shrink-0 space-y-3" style={{ borderTop:`1px solid ${IL.bord}` }}>
              {/* Discount + note row */}
              <div className="flex gap-2">
                <button onClick={() => setDiscountModal(true)} style={{ flex:1, height:44, borderRadius:12, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", background: discount > 0 ? "rgba(48,209,88,0.1)" : "rgba(255,255,255,0.06)", border: discount > 0 ? "1px solid rgba(48,209,88,0.3)" : `1px solid ${IL.bord}`, color: discount > 0 ? IL.grn : IL.mu }}>
                  {discount > 0 ? `Discount -${fmt(discount)}` : "% Discount"}
                </button>
                {discount > 0 && (
                  <button onClick={() => setDiscount(0)} style={{ height:44, width:44, borderRadius:12, background:"rgba(255,255,255,0.06)", border:`1px solid ${IL.bord}`, color:IL.mu, fontSize:20, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontFamily:"inherit" }}>×</button>
                )}
                <button onClick={() => setOrderNoteModal(true)} style={{ flex:1, height:44, borderRadius:12, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", background: orderNotes ? "rgba(124,106,247,0.1)" : "rgba(255,255,255,0.06)", border: orderNotes ? `1px solid ${IL.pur}` : `1px solid ${IL.bord}`, color: orderNotes ? IL.pur : IL.mu }}>
                  {orderNotes ? "📝 Note" : "Add Note"}
                </button>
              </div>

              {/* Totals */}
              <div className="space-y-1 py-2" style={{ borderTop:`1px solid ${IL.bord}` }}>
                <div className="flex justify-between text-sm" style={{ color:IL.mu }}><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                {discount > 0 && <div className="flex justify-between text-sm" style={{ color:IL.grn }}><span>Discount</span><span>-{fmt(discount)}</span></div>}
                <div className="flex justify-between font-black" style={{ color:IL.tp, fontSize:20, borderTop:`1px solid ${IL.bord}`, paddingTop:8, marginTop:4 }}><span>Total</span><span style={{ color:IL.or }}>{fmt(total)}</span></div>
              </div>

              {/* Payment buttons */}
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={handleHold} disabled={submitting}
                    style={{ height:56, borderRadius:14, background:"rgba(245,158,11,0.12)", border:"1px solid rgba(245,158,11,0.35)", color:"#fbbf24", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit", opacity:submitting?0.5:1 }}>
                    🎫 Hold
                  </button>
                  <button onClick={() => setSplitModal(true)} disabled={submitting || cart.length < 2}
                    style={{ height:56, borderRadius:14, background:"rgba(255,255,255,0.06)", border:`1px solid ${IL.bord}`, color:IL.tm, fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit", opacity:(submitting||cart.length<2)?0.4:1 }}>
                    ✂ Split
                  </button>
                </div>
                <button onClick={() => setPaymentModal(true)} disabled={submitting}
                  style={{ width:"100%", height:64, borderRadius:16, background:`linear-gradient(135deg,${IL.or},#ff9500)`, border:"none", color:"#fff", fontWeight:900, fontSize:20, cursor:"pointer", fontFamily:"inherit", boxShadow:"0 6px 24px rgba(255,107,0,0.45)", opacity:submitting?0.5:1 }}>
                  {submitting ? "Processing…" : `Charge ${fmt(total)}`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile bottom tab bar ── */}
      <div className="sm:hidden flex flex-shrink-0" style={{ borderTop:`1px solid ${IL.bord}`, background:IL.hdr }}>
        <button
          onClick={() => setMobileView("menu")}
          className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5"
          style={{ color: mobileView === "menu" ? IL.or : IL.mu, background:"none", border:"none", cursor:"pointer", fontFamily:"inherit" }}
        >
          <span className="text-xl">🍽</span>
          <span style={{ fontSize:10, fontWeight:700 }}>Menu</span>
        </button>
        <button
          onClick={() => setMobileView("cart")}
          className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 relative"
          style={{ color: mobileView === "cart" ? IL.or : IL.mu, background:"none", border:"none", cursor:"pointer", fontFamily:"inherit" }}
        >
          <span className="text-xl">🛒</span>
          <span style={{ fontSize:10, fontWeight:700 }}>Cart</span>
          {cart.length > 0 && (
            <span className="absolute top-1.5 right-[calc(50%-12px)] text-black font-black min-w-[16px] h-4 px-0.5 rounded-full flex items-center justify-center" style={{ background:IL.or, fontSize:9 }}>
              {cart.reduce((s, i) => s + i.quantity, 0)}
            </span>
          )}
        </button>
      </div>

      {/* ── Modals ── */}

      {openPriceModal && (
        <OpenPriceModal
          item={openPriceModal.item}
          initialPrice={openPriceModal.initialPrice}
          initialNote={openPriceModal.initialNote}
          onConfirm={(price, note) => {
            const editKey = openPriceModal.editKey;
            if (editKey) {
              // Update the existing line in place — preserves quantity + position.
              // If the price or description actually changed on a resumed/alreadyMade
              // line, clear `alreadyMade`. Otherwise the "no new items → patch only"
              // submit path silently skips the item update and the new price/desc
              // never reaches the DB. Re-firing to KDS is correct here too: for an
              // open-price item the description is what tells the kitchen what to
              // make, so a change is worth re-notifying.
              setCart(prev => prev.map(c => {
                if (c.key !== editKey) return c;
                const changed = c.price !== price || c.notes !== note;
                return {
                  ...c,
                  price,
                  notes: note,
                  priceOverride: price,
                  alreadyMade: changed ? false : c.alreadyMade,
                };
              }));
            } else {
              pushToCart(openPriceModal.item, [], note, price);
            }
            setOpenPriceModal(null);
          }}
          onClose={() => setOpenPriceModal(null)}
        />
      )}

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
          onPayAndHold={handlePayAndHold}
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
          initialPhone={customerPhone}
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
            <div style={{ background:IL.card, borderRadius:24, width:"100%", maxWidth:448, boxShadow:"0 24px 80px rgba(0,0,0,0.7),0 0 0 1px rgba(255,255,255,0.08)", overflow:"hidden" }}>
              <div style={{ padding:"12px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", background: order.source === "phone" ? "linear-gradient(135deg,#10b981,#059669)" : `linear-gradient(135deg,${IL.or},#ff9500)` }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:20 }}>{order.source === "phone" ? "📞" : "🔔"}</span>
                  <span style={{ color:"#fff", fontWeight:800, fontSize:16 }}>{order.source === "phone" ? "New Phone Order" : "New Online Order"}</span>
                </div>
                {popupOrders.length > 1 && (
                  <span style={{ background:"rgba(0,0,0,0.25)", color:"#fff", fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:999 }}>
                    +{popupOrders.length - 1} more
                  </span>
                )}
              </div>
              <div style={{ padding:20, display:"flex", flexDirection:"column", gap:16 }}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
                  <div>
                    <div style={{ fontSize:24, fontWeight:900, color:IL.tp, letterSpacing:"-0.04em" }}>{order.confirmationCode}</div>
                    <div style={{ color:IL.tm, fontWeight:600, marginTop:2 }}>{order.customerName}</div>
                    {order.customerPhone && <div style={{ color:IL.mu, fontSize:13 }}>{order.customerPhone}</div>}
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ color:IL.or, fontWeight:800, fontSize:18 }}>${subtotal.toFixed(2)}</div>
                    <div style={{ color:IL.mu, fontSize:12 }} className="capitalize">{order.orderType}</div>
                  </div>
                </div>

                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {order.items.map(item => (
                    <div key={item.id} style={{ background:"rgba(255,255,255,0.05)", border:`1px solid ${IL.bord}`, borderRadius:12, padding:"10px 14px" }}>
                      <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
                        <span style={{ fontSize:16, fontWeight:900, color:IL.or }}>{item.quantity}×</span>
                        <span style={{ fontSize:14, fontWeight:700, color:IL.tp }}>{item.menuItemName}</span>
                      </div>
                      {(item.modifierSelections ?? []).length > 0 && (
                        <div style={{ color:IL.mu, fontSize:12, marginTop:4, display:"flex", flexDirection:"column", gap:2 }}>
                          {(item.modifierSelections ?? []).map((m, i) => <div key={i}>+ {m.name}</div>)}
                        </div>
                      )}
                      {item.notes && <div style={{ color:IL.mu, fontSize:12, marginTop:4 }}>{item.notes}</div>}
                    </div>
                  ))}
                </div>

                {order.notes && (
                  <div style={{ background:"rgba(255,107,0,0.1)", border:"1px solid rgba(255,107,0,0.25)", borderRadius:12, padding:"8px 14px", color:IL.or, fontSize:13 }}>
                    {order.notes}
                  </div>
                )}

                {showRejectInput ? (
                  <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                    <p style={{ color:IL.red, fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>Why are you rejecting?</p>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                      {["Out of chicken","Out of steak","Out of shrimp","Out of salmon","Out of burger"].map(opt => (
                        <button key={opt} type="button" onClick={() => setRejectReason(r => r === opt ? "" : opt)}
                          style={{ borderRadius:999, padding:"6px 12px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", background: rejectReason === opt ? IL.red : "rgba(255,69,58,0.1)", border: rejectReason === opt ? "none" : "1px solid rgba(255,69,58,0.3)", color: rejectReason === opt ? "#fff" : IL.red }}>
                          {opt}
                        </button>
                      ))}
                    </div>
                    <input type="text"
                      value={["Out of chicken","Out of steak","Out of shrimp","Out of salmon","Out of burger"].includes(rejectReason) ? "" : rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      placeholder="Other reason (optional)"
                      style={{ width:"100%", background:"rgba(255,255,255,0.06)", border:`1px solid ${IL.bord}`, borderRadius:14, padding:"10px 14px", color:IL.tp, fontSize:13, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }} />
                    <div style={{ display:"flex", gap:8 }}>
                      <button onClick={() => rejectOnline(order.id)}
                        style={{ flex:1, height:44, borderRadius:14, background:IL.red, border:"none", color:"#fff", fontWeight:800, cursor:"pointer", fontFamily:"inherit", fontSize:14 }}>
                        Confirm Reject
                      </button>
                      <button onClick={() => { setShowRejectInput(false); setRejectReason(""); }}
                        style={{ padding:"0 16px", height:44, borderRadius:14, background:"rgba(255,255,255,0.06)", border:`1px solid ${IL.bord}`, color:IL.tm, fontWeight:600, cursor:"pointer", fontFamily:"inherit", fontSize:14 }}>
                        Back
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display:"flex", gap:12 }}>
                      <button onClick={() => acceptOnline(order.id)}
                        style={{ flex:1, height:48, borderRadius:14, background:"linear-gradient(135deg,#10b981,#059669)", border:"none", color:"#fff", fontWeight:900, fontSize:15, cursor:"pointer", fontFamily:"inherit", boxShadow:"0 4px 18px rgba(16,185,129,0.4)" }}>
                        ✓ Accept
                      </button>
                      <button onClick={() => setShowRejectInput(true)}
                        style={{ padding:"0 20px", height:48, borderRadius:14, background:"rgba(255,69,58,0.1)", border:"1px solid rgba(255,69,58,0.3)", color:IL.red, fontWeight:700, cursor:"pointer", fontFamily:"inherit", fontSize:14 }}>
                        ✕ Reject
                      </button>
                    </div>
                    <div style={{ display:"flex", gap:8 }}>
                      <button onClick={() => setPopupOrders(prev => prev.filter((o) => o.id !== order.id))}
                        style={{ flex:1, height:36, borderRadius:12, background:"none", border:"none", color:IL.mu, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                        Handle Later
                      </button>
                      {popupOrders.length > 1 && (
                        <button onClick={() => setPopupOrders([])}
                          style={{ flex:1, height:36, borderRadius:12, background:"rgba(255,255,255,0.05)", border:`1px solid ${IL.bord}`, color:IL.mu, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                          Dismiss All ({popupOrders.length})
                        </button>
                      )}
                    </div>
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
        <SoldOutDrawer onClose={() => { setSoldOutOpen(false); reloadMenu(); }} />
      )}

      {/* Item note inline modal */}
      {itemNoteModal && (() => {
        const item = cart.find(c => c.key === itemNoteModal);
        if (!item) return null;
        return (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setItemNoteModal(null)}>
            <div style={{ background:IL.card, borderRadius:24, width:"100%", maxWidth:384, padding:20, boxShadow:"0 24px 80px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.06)" }} onClick={e => e.stopPropagation()}>
              <h3 style={{ color:IL.tp, fontWeight:800, fontSize:15, marginBottom:12 }}>Note for {item.name}</h3>
              <textarea value={item.notes} onChange={e => setItemNote(itemNoteModal, e.target.value)}
                placeholder="E.g. no onions, extra sauce…"
                style={{ width:"100%", background:"rgba(255,255,255,0.06)", border:`1px solid ${IL.bord}`, borderRadius:14, padding:"10px 14px", color:IL.tp, fontSize:14, outline:"none", resize:"none", height:96, fontFamily:"inherit", boxSizing:"border-box" }}/>
              <button onClick={() => setItemNoteModal(null)} style={{ marginTop:12, width:"100%", height:44, borderRadius:14, background:`linear-gradient(135deg,${IL.or},#ff9500)`, border:"none", color:"#fff", fontWeight:900, cursor:"pointer", fontFamily:"inherit", fontSize:14, boxShadow:"0 4px 18px rgba(255,107,0,0.4)" }}>Done</button>
            </div>
          </div>
        );
      })()}

      {/* Order note modal */}
      {orderNoteModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setOrderNoteModal(false)}>
          <div style={{ background:IL.card, borderRadius:24, width:"100%", maxWidth:384, padding:20, boxShadow:"0 24px 80px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.06)" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color:IL.tp, fontWeight:800, fontSize:15, marginBottom:12 }}>Order Note</h3>
            <textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)}
              placeholder="Special instructions for this order…"
              style={{ width:"100%", background:"rgba(255,255,255,0.06)", border:`1px solid ${IL.bord}`, borderRadius:14, padding:"10px 14px", color:IL.tp, fontSize:14, outline:"none", resize:"none", height:112, fontFamily:"inherit", boxSizing:"border-box" }}/>
            <button onClick={() => setOrderNoteModal(false)} style={{ marginTop:12, width:"100%", height:44, borderRadius:14, background:`linear-gradient(135deg,${IL.pur},#5b4cf5)`, border:"none", color:"#fff", fontWeight:900, cursor:"pointer", fontFamily:"inherit", fontSize:14, boxShadow:"0 4px 18px rgba(124,106,247,0.4)" }}>Done</button>
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

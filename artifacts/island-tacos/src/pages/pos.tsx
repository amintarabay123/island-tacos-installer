import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { adminRoutes } from "@/lib/admin-path";
import { authHeaders, clearAuthToken } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

type ModifierOption = { id: string; name: string; price: number; position: number };
type Modifier = { id: number; loyverseId: string; name: string; options: ModifierOption[] };
type MenuCategory = { id: number; name: string; sortOrder: number };
type MenuItem = {
  id: number; categoryId: number; name: string; description?: string | null;
  price: number; imageUrl?: string | null; available: boolean;
  popular: boolean; spicy: boolean; vegetarian: boolean;
};
type CartModifier = { modifierId: string; optionId: string; name: string; price: number };
type CartItem = {
  key: string; menuItemId: number; name: string; price: number;
  quantity: number; notes: string; modifierSelections: CartModifier[];
};
type Order = {
  id: number; confirmationCode: string; customerName: string; status: string;
  paymentStatus: string; paymentMethod: string; source: string;
  subtotal: number; discountAmount: number; tax: number; total: number;
  notes?: string | null; createdAt: string; customerPhone?: string | null;
  orderType?: string;
  items: { id: number; menuItemName: string; quantity: number; menuItemPrice: number; subtotal: number; modifierSelections?: CartModifier[] | null; notes?: string | null }[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) => `$${n.toFixed(2)}`;
const now = () => new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const uid = () => Math.random().toString(36).slice(2, 9);

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
          className="h-14 rounded-xl text-xl font-semibold bg-[#1E2130] hover:bg-[#2A2F45] active:bg-[#353B55] text-white transition-colors">
          {k}
        </button>
      ))}
    </div>
  );
}

// ─── Modifier Modal ───────────────────────────────────────────────────────────

function ModifierModal({ item, modifiers, onConfirm, onClose }: {
  item: MenuItem; modifiers: Modifier[];
  onConfirm: (sels: CartModifier[]) => void; onClose: () => void;
}) {
  const [sels, setSels] = useState<CartModifier[]>([]);
  const total = item.price + sels.reduce((s, m) => s + m.price, 0);

  const toggle = (mod: Modifier, opt: ModifierOption) => {
    const exists = sels.find(s => s.modifierId === mod.loyverseId && s.optionId === opt.id);
    if (exists) { setSels(sels.filter(s => !(s.modifierId === mod.loyverseId && s.optionId === opt.id))); }
    else { setSels([...sels, { modifierId: mod.loyverseId, optionId: opt.id, name: opt.name, price: opt.price }]); }
  };
  const isSelected = (modId: string, optId: string) => sels.some(s => s.modifierId === modId && s.optionId === optId);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#13151C] rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-[#1E2130]">
          <h2 className="text-white text-xl font-bold">{item.name}</h2>
          <p className="text-[#F5A623] text-lg font-semibold">{fmt(total)}</p>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {modifiers.map(mod => (
            <div key={mod.id}>
              <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-3">{mod.name}</p>
              <div className="space-y-2">
                {mod.options.sort((a,b) => a.position - b.position).map(opt => {
                  const sel = isSelected(mod.loyverseId, opt.id);
                  return (
                    <button key={opt.id} onClick={() => toggle(mod, opt)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${sel ? "border-[#F5A623] bg-[#F5A623]/10 text-white" : "border-[#2A2F45] bg-[#1E2130] text-zinc-300 hover:border-zinc-500"}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${sel ? "border-[#F5A623] bg-[#F5A623]" : "border-zinc-500"}`}>
                          {sel && <div className="w-2 h-2 rounded-full bg-white"/>}
                        </div>
                        <span className="font-medium">{opt.name}</span>
                      </div>
                      {opt.price > 0 && <span className="text-[#F5A623] text-sm font-semibold">+{fmt(opt.price)}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="p-5 border-t border-[#1E2130] flex gap-3">
          <button onClick={onClose} className="flex-1 h-12 rounded-xl border border-[#2A2F45] text-zinc-300 font-semibold hover:bg-[#1E2130] transition-colors">Cancel</button>
          <button onClick={() => onConfirm(sels)} className="flex-2 flex-grow h-12 rounded-xl bg-[#F5A623] hover:bg-[#E09520] text-black font-bold transition-colors">
            Add to Order · {fmt(total)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Payment Modal ────────────────────────────────────────────────────────────

function PaymentModal({ total, onPay, onClose }: {
  total: number; onPay: (method: string, tendered?: number) => void; onClose: () => void;
}) {
  const [tab, setTab] = useState<"cash" | "card" | "athmovil">("cash");
  const [tendered, setTendered] = useState(String(Math.ceil(total)));
  const change = Math.max(0, parseFloat(tendered || "0") - total);

  const QUICK = (() => {
    const add = (result: number[], v: number) => {
      const r = Math.round(v * 100) / 100;
      if (r >= total && !result.includes(r)) result.push(r);
    };
    const result: number[] = [total];
    add(result, Math.ceil(total / 10) * 10);   // next $10
    add(result, Math.ceil(total / 20) * 20);   // next $20
    add(result, 50);
    add(result, 100);
    return result;
  })();

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#13151C] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-[#1E2130]">
          <h2 className="text-white text-xl font-bold">Collect Payment</h2>
          <p className="text-[#F5A623] text-3xl font-black mt-1">{fmt(total)}</p>
        </div>

        {/* Method tabs */}
        <div className="flex border-b border-[#1E2130]">
          {(["cash","card","athmovil"] as const).map(m => (
            <button key={m} onClick={() => setTab(m)}
              className={`flex-1 py-3 text-sm font-semibold capitalize transition-colors ${tab === m ? "text-[#F5A623] border-b-2 border-[#F5A623]" : "text-zinc-400 hover:text-white"}`}>
              {m === "athmovil" ? "ATH Móvil" : m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === "cash" && (
            <div>
              <p className="text-zinc-400 text-sm mb-2">Amount tendered</p>
              <div className="bg-[#0A0B0F] rounded-xl p-3 text-white text-3xl font-mono font-bold text-right mb-3">
                ${tendered}
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                {QUICK.map(q => (
                  <button key={q} onClick={() => setTendered(String(q))}
                    className={`flex-1 min-w-[56px] h-10 rounded-xl text-sm font-semibold transition-colors ${
                      parseFloat(tendered) === q
                        ? "bg-[#F5A623] text-black"
                        : "bg-[#1E2130] hover:bg-[#2A2F45] text-white"
                    }`}>
                    {fmt(q)}
                  </button>
                ))}
              </div>
              <Numpad value={tendered} onChange={setTendered} />
              {parseFloat(tendered) >= total && (
                <div className="mt-4 bg-green-900/30 rounded-xl p-4 text-center">
                  <p className="text-zinc-400 text-sm">Change due</p>
                  <p className="text-green-400 text-3xl font-black">{fmt(change)}</p>
                </div>
              )}
            </div>
          )}
          {tab === "card" && (
            <div className="text-center py-6">
              <div className="text-5xl mb-4">💳</div>
              <p className="text-white font-semibold mb-1">Swipe or tap card on terminal</p>
              <p className="text-zinc-400 text-sm">Confirm payment of <span className="text-[#F5A623] font-bold">{fmt(total)}</span></p>
            </div>
          )}
          {tab === "athmovil" && (
            <div className="text-center py-6">
              <div className="text-5xl mb-4">📱</div>
              <p className="text-white font-semibold mb-1">ATH Móvil payment</p>
              <p className="text-zinc-400 text-sm">Confirm receipt of <span className="text-[#F5A623] font-bold">{fmt(total)}</span></p>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-[#1E2130] flex gap-3">
          <button onClick={onClose} className="h-12 px-5 rounded-xl border border-[#2A2F45] text-zinc-300 font-semibold hover:bg-[#1E2130] transition-colors">Cancel</button>
          <button
            disabled={tab === "cash" && parseFloat(tendered || "0") < total}
            onClick={() => onPay(tab, tab === "cash" ? parseFloat(tendered) : undefined)}
            className="flex-1 h-12 rounded-xl bg-green-500 hover:bg-green-400 disabled:opacity-30 disabled:cursor-not-allowed text-black font-black text-lg transition-colors">
            Charge {fmt(total)}
          </button>
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
      <div className="bg-[#13151C] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-[#1E2130] flex items-center justify-between">
          <h2 className="text-white text-xl font-bold">Receipt</h2>
          <span className="text-green-400 font-semibold text-sm">✓ Order placed</span>
        </div>
        <div className="p-5 max-h-96 overflow-y-auto">
          <div ref={printRef} className="font-mono text-sm">
            <div className="text-center mb-3">
              <div className="font-bold text-base">ISLAND TACOS</div>
              <div className="text-zinc-400 text-xs">Wickhams Cay 1, Road Town, BVI</div>
              <div className="text-zinc-400 text-xs">(284) 000-0000</div>
            </div>
            <div className="border-t border-dashed border-zinc-600 my-2"/>
            <div className="flex justify-between text-xs text-zinc-400 mb-1">
              <span>#{order.confirmationCode}</span>
              <span>{new Date(order.createdAt).toLocaleString()}</span>
            </div>
            {order.customerName && <div className="text-xs text-zinc-400 mb-2">Customer: {order.customerName}</div>}
            <div className="border-t border-dashed border-zinc-600 my-2"/>
            {order.items.map((item, i) => (
              <div key={i} className="mb-2">
                <div className="flex justify-between text-white text-sm">
                  <span>{item.quantity}× {item.menuItemName}</span>
                  <span>{fmt(item.subtotal)}</span>
                </div>
                {item.modifierSelections?.map((m, j) => (
                  <div key={j} className="flex justify-between text-zinc-400 text-xs pl-4">
                    <span>+ {m.name}</span>
                    {m.price > 0 && <span>+{fmt(m.price)}</span>}
                  </div>
                ))}
                {item.notes && <div className="text-zinc-500 text-xs pl-4">Note: {item.notes}</div>}
              </div>
            ))}
            <div className="border-t border-dashed border-zinc-600 my-2"/>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-zinc-300"><span>Subtotal</span><span>{fmt(order.subtotal)}</span></div>
              {order.discountAmount > 0 && <div className="flex justify-between text-green-400"><span>Discount</span><span>-{fmt(order.discountAmount)}</span></div>}
              {order.tax > 0 && <div className="flex justify-between text-zinc-300"><span>Tax</span><span>{fmt(order.tax)}</span></div>}
              <div className="flex justify-between text-white font-bold text-base border-t border-zinc-600 pt-1 mt-1">
                <span>TOTAL</span><span>{fmt(order.total)}</span>
              </div>
              <div className="flex justify-between text-zinc-400 text-xs mt-1">
                <span>Payment</span>
                <span className="capitalize">{order.paymentMethod === "athmovil" ? "ATH Móvil" : order.paymentMethod}</span>
              </div>
              {tendered != null && <div className="flex justify-between text-zinc-400 text-xs"><span>Tendered</span><span>{fmt(tendered)}</span></div>}
              {change != null && change > 0 && <div className="flex justify-between text-green-400 text-sm font-semibold"><span>Change</span><span>{fmt(change)}</span></div>}
            </div>
            <div className="border-t border-dashed border-zinc-600 my-3"/>
            <div className="text-center text-zinc-400 text-xs">
              <div>Gracias · Thank you!</div>
              <div className="mt-1">Order online at islandtacos.com</div>
            </div>
          </div>
        </div>
        <div className="p-5 border-t border-[#1E2130] flex gap-3">
          <button onClick={print} className="flex-1 h-12 rounded-xl border border-[#2A2F45] text-zinc-300 font-semibold hover:bg-[#1E2130] flex items-center justify-center gap-2 transition-colors">
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

function HoldModal({ initialName, initialNote, onHold, onClose }: {
  initialName: string; initialNote: string;
  onHold: (name: string, phone: string, note: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState(initialNote);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#13151C] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-[#1E2130]">
          <h2 className="text-white text-xl font-bold">Hold Ticket</h2>
          <p className="text-zinc-400 text-sm mt-1">Save this order to resume and charge later.</p>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-1">Customer Name</label>
            <input
              value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Maria"
              className="w-full bg-[#0A0B0F] border border-[#2A2F45] focus:border-[#F5A623] rounded-xl px-4 py-2.5 text-white text-sm outline-none placeholder-zinc-600"
            />
          </div>
          <div>
            <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-1">Phone (optional)</label>
            <input
              value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="e.g. 284-555-0100"
              type="tel"
              className="w-full bg-[#0A0B0F] border border-[#2A2F45] focus:border-[#F5A623] rounded-xl px-4 py-2.5 text-white text-sm outline-none placeholder-zinc-600"
            />
          </div>
          <div>
            <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-1">Comment (optional)</label>
            <textarea
              value={note} onChange={e => setNote(e.target.value)}
              placeholder="Special instructions, table number…"
              className="w-full bg-[#0A0B0F] border border-[#2A2F45] focus:border-[#F5A623] rounded-xl px-4 py-2.5 text-white text-sm outline-none resize-none h-20 placeholder-zinc-600"
            />
          </div>
        </div>
        <div className="p-5 border-t border-[#1E2130] flex gap-3">
          <button onClick={onClose} className="flex-1 h-12 rounded-xl border border-[#2A2F45] text-zinc-300 font-semibold hover:bg-[#1E2130] transition-colors">Cancel</button>
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
      <div className="bg-[#13151C] rounded-2xl w-full max-w-xs shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-[#1E2130]">
          <h2 className="text-white text-xl font-bold">Apply Discount</h2>
        </div>
        <div className="p-5">
          <div className="flex gap-2 mb-4">
            <button onClick={() => setType("pct")} className={`flex-1 h-10 rounded-xl text-sm font-semibold transition-colors ${type === "pct" ? "bg-[#F5A623] text-black" : "bg-[#1E2130] text-zinc-300"}`}>Percent %</button>
            <button onClick={() => setType("amt")} className={`flex-1 h-10 rounded-xl text-sm font-semibold transition-colors ${type === "amt" ? "bg-[#F5A623] text-black" : "bg-[#1E2130] text-zinc-300"}`}>Amount $</button>
          </div>
          <div className="bg-[#0A0B0F] rounded-xl p-3 text-white text-3xl font-mono font-bold text-right mb-2">
            {type === "pct" ? `${val}%` : `$${val}`}
          </div>
          {discAmt > 0 && (
            <p className="text-green-400 text-sm text-center mb-2">Saves {fmt(discAmt)} off {fmt(subtotal)}</p>
          )}
          <div className="grid grid-cols-4 gap-2 mb-2">
            {(type === "pct" ? [5,10,15,20] : [1,2,5,10]).map(q => (
              <button key={q} onClick={() => setVal(String(q))}
                className="h-10 rounded-xl bg-[#1E2130] hover:bg-[#2A2F45] text-white text-sm font-semibold transition-colors">
                {type === "pct" ? `${q}%` : fmt(q)}
              </button>
            ))}
          </div>
          <Numpad value={val} onChange={setVal} />
        </div>
        <div className="p-5 border-t border-[#1E2130] flex gap-3">
          <button onClick={onClose} className="flex-1 h-12 rounded-xl border border-[#2A2F45] text-zinc-300 font-semibold hover:bg-[#1E2130] transition-colors">Cancel</button>
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

function TicketsDrawer({ onResume, onClose }: {
  onResume: (items: CartItem[], name: string, note: string, discount: number, orderId: number) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"held" | "live">("held");
  const [tickets, setTickets] = useState<Order[]>([]);
  const [liveOrders, setLiveOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [chargeOrder, setChargeOrder] = useState<Order | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/orders", { credentials: "include" });
      const data: Order[] = await r.json();
      setTickets(data.filter(o => o.source === "pos" && o.paymentStatus === "pending" && !["completed","cancelled"].includes(o.status)));
      setLiveOrders(data.filter(o => ["pending","confirmed","preparing","ready"].includes(o.status)));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);

  const resume = (o: Order) => {
    const items: CartItem[] = o.items.map(i => ({
      key: uid(), menuItemId: i.menuItemId, name: i.menuItemName, price: i.menuItemPrice,
      quantity: i.quantity, notes: i.notes ?? "",
      modifierSelections: (i.modifierSelections ?? []) as CartModifier[],
    }));
    onResume(items, o.customerName, o.notes ?? "", o.discountAmount, o.id);
    onClose();
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

  const completeWithPayment = async (method: string) => {
    if (!chargeOrder) return;
    await fetch(`/api/orders/${chargeOrder.id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed", actualPaymentMethod: method, paymentStatus: "paid" }),
    });
    setChargeOrder(null);
    load();
  };

  const STATUS_COLOR: Record<string, string> = {
    pending: "text-yellow-400", confirmed: "text-blue-400",
    preparing: "text-orange-400", ready: "text-green-400",
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/70 flex justify-end z-50" onClick={onClose}>
        <div className="bg-[#13151C] w-full max-w-sm h-full flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="p-5 border-b border-[#1E2130] flex items-center justify-between">
            <h2 className="text-white text-xl font-bold">Tickets</h2>
            <button onClick={onClose} className="text-zinc-400 hover:text-white text-2xl">×</button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[#1E2130]">
            <button onClick={() => setTab("held")}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${tab === "held" ? "text-[#F5A623] border-b-2 border-[#F5A623]" : "text-zinc-400 hover:text-white"}`}>
              🎫 Held{tickets.length > 0 ? ` (${tickets.length})` : ""}
            </button>
            <button onClick={() => setTab("live")}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${tab === "live" ? "text-[#F5A623] border-b-2 border-[#F5A623]" : "text-zinc-400 hover:text-white"}`}>
              📋 Live Queue{liveOrders.length > 0 ? ` (${liveOrders.length})` : ""}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading && <p className="text-zinc-500 text-center py-8">Loading…</p>}

            {/* ── Held Tickets tab ── */}
            {!loading && tab === "held" && (
              <>
                {tickets.length === 0 && <p className="text-zinc-500 text-center py-8">No held tickets</p>}
                {tickets.map(o => (
                  <div key={o.id} className="bg-[#1E2130] rounded-xl p-4">
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <p className="text-white font-bold">{o.customerName || "Guest"}</p>
                        {o.customerPhone && <p className="text-zinc-400 text-xs">{o.customerPhone}</p>}
                        <p className="text-zinc-500 text-xs">#{o.confirmationCode}</p>
                      </div>
                      <span className="text-[#F5A623] font-bold text-lg">{fmt(o.total)}</span>
                    </div>
                    {o.notes && <p className="text-zinc-400 text-xs italic mb-1">"{o.notes}"</p>}
                    <p className="text-zinc-400 text-xs mb-3">
                      {o.items.map(i => {
                        const mods = i.modifierSelections?.length ? ` (${i.modifierSelections.map(m => m.name).join(", ")})` : "";
                        return `${i.quantity}× ${i.menuItemName}${mods}`;
                      }).join(" • ")}
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => resume(o)} className="flex-1 h-9 rounded-lg bg-[#F5A623] hover:bg-[#E09520] text-black text-sm font-bold transition-colors">Resume</button>
                      <button onClick={() => voidTicket(o.id)} className="h-9 px-3 rounded-lg bg-red-900/40 hover:bg-red-800/60 text-red-400 text-sm font-semibold transition-colors">Void</button>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* ── Live Queue tab ── */}
            {!loading && tab === "live" && (
              <>
                {liveOrders.length === 0 && <p className="text-zinc-500 text-center py-8">No active orders</p>}
                {liveOrders.map(o => (
                  <div key={o.id} className="bg-[#1E2130] rounded-xl p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="text-white font-bold">#{o.confirmationCode}</span>
                        <span className={`ml-2 text-sm font-semibold capitalize ${STATUS_COLOR[o.status] ?? "text-zinc-400"}`}>{o.status}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[#F5A623] font-bold">{fmt(o.total)}</span>
                        <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${o.source === "pos" ? "bg-purple-900/50 text-purple-300" : "bg-blue-900/50 text-blue-300"}`}>
                          {o.source === "pos" ? "POS" : "Online"}
                        </span>
                      </div>
                    </div>
                    <p className="text-zinc-300 text-sm">{o.customerName}</p>
                    <p className="text-zinc-500 text-xs mt-1">
                      {o.items.map(i => {
                        const mods = i.modifierSelections?.length ? ` (${i.modifierSelections.map(m => m.name).join(", ")})` : "";
                        return `${i.quantity}× ${i.menuItemName}${mods}`;
                      }).join(" • ")}
                    </p>
                    <div className="flex gap-2 mt-3">
                      {o.status === "pending" && (
                        <>
                          <button onClick={() => updateStatus(o.id, "confirmed")} className="flex-1 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors">Accept</button>
                          <button onClick={() => updateStatus(o.id, "cancelled")} className="h-8 px-3 rounded-lg bg-red-900/50 hover:bg-red-800 text-red-300 text-xs font-semibold transition-colors">Reject</button>
                        </>
                      )}
                      {o.status === "confirmed" && <button onClick={() => updateStatus(o.id, "preparing")} className="flex-1 h-8 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold transition-colors">Start Cooking</button>}
                      {o.status === "preparing" && <button onClick={() => updateStatus(o.id, "ready")} className="flex-1 h-8 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-semibold transition-colors">Mark Ready</button>}
                      {o.status === "ready" && (
                        <button onClick={() => setChargeOrder(o)} className="flex-1 h-8 rounded-lg bg-[#F5A623] hover:bg-[#E09520] text-black text-xs font-bold transition-colors">
                          Charge {fmt(o.total)}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {chargeOrder && (
        <PaymentModal
          total={chargeOrder.total}
          onPay={completeWithPayment}
          onClose={() => setChargeOrder(null)}
        />
      )}
    </>
  );
}

// ─── Item Card ────────────────────────────────────────────────────────────────

function ItemCard({ item, onClick }: { item: MenuItem; onClick: () => void }) {
  return (
    <button onClick={onClick} className="bg-[#13151C] hover:bg-[#1E2130] active:bg-[#252940] border border-[#1E2130] hover:border-[#2A2F45] rounded-xl p-3 text-left transition-all flex flex-col gap-1 group">
      {item.imageUrl && (
        <div className="w-full aspect-square rounded-lg overflow-hidden mb-1 bg-[#0A0B0F]">
          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>
        </div>
      )}
      <div className="flex items-start justify-between gap-1">
        <span className="text-white text-sm font-semibold leading-tight line-clamp-2">{item.name}</span>
        <div className="flex gap-1 flex-shrink-0">
          {item.spicy && <span title="Spicy" className="text-xs">🌶</span>}
          {item.vegetarian && <span title="Vegetarian" className="text-xs">🥗</span>}
          {item.popular && <span title="Popular" className="text-xs">⭐</span>}
        </div>
      </div>
      <span className="text-[#F5A623] font-bold text-sm">{fmt(item.price)}</span>
    </button>
  );
}

// ─── Receipts Drawer ─────────────────────────────────────────────────────────

const PAY_LABEL: Record<string, string> = {
  cash: "Cash", card: "Card", athmovil: "ATH Móvil", complimentary: "Comp", split: "Split",
};

function ReceiptsDrawer({ onClose }: { onClose: () => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"today" | "all">("today");
  const [selected, setSelected] = useState<Order | null>(null);

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
  const visible = filter === "today"
    ? orders.filter(o => new Date(o.createdAt).toDateString() === today)
    : orders;

  const totalRevenue = visible.reduce((s, o) => s + o.total, 0);

  if (selected) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
        <div className="bg-[#13151C] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="p-5 border-b border-[#1E2130] flex items-center justify-between">
            <button onClick={() => setSelected(null)} className="text-zinc-400 hover:text-white text-sm">← Back</button>
            <h2 className="text-white text-lg font-bold">Receipt #{selected.confirmationCode}</h2>
            <div/>
          </div>
          <div className="p-5 max-h-[70vh] overflow-y-auto font-mono text-sm">
            <div className="text-center mb-3">
              <div className="font-bold text-base text-white">ISLAND TACOS</div>
              <div className="text-zinc-400 text-xs">Wickhams Cay 1, Road Town, BVI</div>
            </div>
            <div className="border-t border-dashed border-zinc-600 my-2"/>
            <div className="flex justify-between text-xs text-zinc-400 mb-1">
              <span>#{selected.confirmationCode}</span>
              <span>{new Date(selected.createdAt).toLocaleString()}</span>
            </div>
            <div className="text-xs text-zinc-400 mb-1">Customer: {selected.customerName || "Walk-in"}</div>
            <div className="text-xs text-zinc-400 mb-2">Payment: {PAY_LABEL[selected.paymentMethod] ?? selected.paymentMethod}</div>
            <div className="border-t border-dashed border-zinc-600 my-2"/>
            {selected.items.map((item, i) => (
              <div key={i} className="mb-2">
                <div className="flex justify-between text-white text-sm">
                  <span>{item.quantity}× {item.menuItemName}</span>
                  <span>{fmt(item.subtotal)}</span>
                </div>
                {item.modifierSelections?.map((m, j) => (
                  <div key={j} className="flex justify-between text-zinc-400 text-xs pl-4">
                    <span>+ {m.name}</span>
                    {m.price > 0 && <span>+{fmt(m.price)}</span>}
                  </div>
                ))}
                {item.notes && <div className="text-zinc-500 text-xs pl-4">Note: {item.notes}</div>}
              </div>
            ))}
            <div className="border-t border-dashed border-zinc-600 my-2"/>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-zinc-300"><span>Subtotal</span><span>{fmt(selected.subtotal)}</span></div>
              {selected.discountAmount > 0 && <div className="flex justify-between text-green-400"><span>Discount</span><span>-{fmt(selected.discountAmount)}</span></div>}
              {selected.tax > 0 && <div className="flex justify-between text-zinc-300"><span>Tax</span><span>{fmt(selected.tax)}</span></div>}
              <div className="flex justify-between text-white font-bold text-base border-t border-zinc-600 pt-1 mt-1">
                <span>TOTAL</span><span>{fmt(selected.total)}</span>
              </div>
            </div>
            <div className="border-t border-dashed border-zinc-600 my-3"/>
            <div className="text-center text-zinc-500 text-xs">Thank you!</div>
          </div>
          <div className="p-4 border-t border-[#1E2130]">
            <button
              onClick={() => {
                const win = window.open("", "_blank", "width=320,height=600");
                if (!win) return;
                win.document.write(`<html><head><title>Receipt</title><style>body{font-family:monospace;font-size:12px;width:280px;margin:0 auto;padding:8px}.center{text-align:center}.bold{font-weight:bold}.line{border-top:1px dashed #000;margin:6px 0}.row{display:flex;justify-content:space-between;margin:2px 0}</style></head><body>
                  <div class="center bold">ISLAND TACOS</div>
                  <div class="center">Wickhams Cay 1, Road Town, BVI</div>
                  <div class="line"></div>
                  <div class="row"><span>#${selected.confirmationCode}</span><span>${new Date(selected.createdAt).toLocaleString()}</span></div>
                  <div>Customer: ${selected.customerName || "Walk-in"}</div>
                  <div>Payment: ${PAY_LABEL[selected.paymentMethod] ?? selected.paymentMethod}</div>
                  <div class="line"></div>
                  ${selected.items.map(item => `<div class="row"><span>${item.quantity}× ${item.menuItemName}</span><span>$${item.subtotal.toFixed(2)}</span></div>${(item.modifierSelections ?? []).map(m => `<div style="padding-left:12px">+ ${m.name}${m.price > 0 ? ` +$${m.price.toFixed(2)}` : ""}</div>`).join("")}${item.notes ? `<div style="padding-left:12px;color:#888">Note: ${item.notes}</div>` : ""}`).join("")}
                  <div class="line"></div>
                  <div class="row"><span>Subtotal</span><span>$${selected.subtotal.toFixed(2)}</span></div>
                  ${selected.discountAmount > 0 ? `<div class="row"><span>Discount</span><span>-$${selected.discountAmount.toFixed(2)}</span></div>` : ""}
                  ${selected.tax > 0 ? `<div class="row"><span>Tax</span><span>$${selected.tax.toFixed(2)}</span></div>` : ""}
                  <div class="row bold"><span>TOTAL</span><span>$${selected.total.toFixed(2)}</span></div>
                  <div class="line"></div>
                  <div class="center">Thank you!</div>
                </body></html>`);
                win.document.close(); win.focus(); win.print(); win.close();
              }}
              className="w-full h-11 rounded-xl bg-[#F5A623] hover:bg-[#E09520] text-black font-bold transition-colors"
            >
              🖨 Print Receipt
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex justify-end z-50" onClick={onClose}>
      <div className="bg-[#13151C] w-full max-w-sm h-full flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-[#1E2130] flex items-center justify-between">
          <h2 className="text-white text-xl font-bold">Receipts</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 px-4 pt-3 pb-2">
          {(["today", "all"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`flex-1 h-8 rounded-lg text-sm font-semibold transition-colors ${filter === f ? "bg-[#F5A623] text-black" : "bg-[#1E2130] text-zinc-400 hover:text-white"}`}>
              {f === "today" ? "Today" : "All Time"}
            </button>
          ))}
        </div>

        {/* Summary bar */}
        {!loading && visible.length > 0 && (
          <div className="mx-4 mb-2 px-4 py-2 bg-[#1E2130] rounded-xl flex justify-between text-sm">
            <span className="text-zinc-400">{visible.length} order{visible.length !== 1 ? "s" : ""}</span>
            <span className="text-[#F5A623] font-bold">{fmt(totalRevenue)}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && <p className="text-zinc-500 text-center py-8">Loading…</p>}
          {!loading && visible.length === 0 && (
            <p className="text-zinc-500 text-center py-8">
              {filter === "today" ? "No completed orders today" : "No completed orders yet"}
            </p>
          )}
          {visible.map(o => (
            <button key={o.id} onClick={() => setSelected(o)}
              className="w-full bg-[#1E2130] hover:bg-[#2A2F45] rounded-xl p-4 text-left transition-colors">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <span className="text-white font-bold text-sm">#{o.confirmationCode}</span>
                  <span className="ml-2 text-zinc-400 text-xs">{o.customerName || "Walk-in"}</span>
                </div>
                <span className="text-[#F5A623] font-bold">{fmt(o.total)}</span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-zinc-500 text-xs">
                  {o.items.map(i => {
                    const mods = i.modifierSelections?.length ? ` (${i.modifierSelections.map(m => m.name).join(", ")})` : "";
                    return `${i.quantity}× ${i.menuItemName}${mods}`;
                  }).join(" • ")}
                </p>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-zinc-600 text-xs">{new Date(o.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#0A0B0F] text-zinc-400">{PAY_LABEL[o.paymentMethod] ?? o.paymentMethod}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main POS Component ────────────────────────────────────────────────────────

export default function POS() {
  const [, navigate] = useLocation();

  // Auth guard
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include", cache: "no-store", headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (!d.authed) navigate(adminRoutes.login); })
      .catch(() => navigate(adminRoutes.login));
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
  const [orderNotes, setOrderNotes] = useState("");
  const [discount, setDiscount] = useState(0);
  const [resumedOrderId, setResumedOrderId] = useState<number | null>(null);

  // UI state
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [time, setTime] = useState(now());
  const [ticketCount, setTicketCount] = useState(0);

  // Modals
  const [modifierModal, setModifierModal] = useState<{ item: MenuItem; mods: Modifier[] } | null>(null);
  const [paymentModal, setPaymentModal] = useState(false);
  const [receiptModal, setReceiptModal] = useState<{ order: Order; tendered?: number } | null>(null);
  const [discountModal, setDiscountModal] = useState(false);
  const [holdModal, setHoldModal] = useState(false);
  const [ticketsOpen, setTicketsOpen] = useState(false);
  const [receiptsOpen, setReceiptsOpen] = useState(false);
  const [itemNoteModal, setItemNoteModal] = useState<string | null>(null); // cart item key
  const [orderNoteModal, setOrderNoteModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Incoming online orders (pending + source:online)
  const [incomingOrders, setIncomingOrders] = useState<Order[]>([]);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const seenOnlineIdsRef = useRef<Set<number>>(new Set());
  const isFirstOnlineFetchRef = useRef(true);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const chimeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const unlockAudio = () => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      audioCtxRef.current.resume().then(() => setAudioUnlocked(true));
    } catch {}
  };

  const playChime = useCallback(() => {
    try {
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      ctx.resume();
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

  // Poll for pending online orders every 8s
  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch("/api/orders");
        const data: Order[] = await r.json();
        const pending = data.filter(o => o.source === "online" && o.status === "pending");
        if (isFirstOnlineFetchRef.current) {
          isFirstOnlineFetchRef.current = false;
          pending.forEach(o => seenOnlineIdsRef.current.add(o.id));
        } else {
          const hasNew = pending.some(o => !seenOnlineIdsRef.current.has(o.id));
          if (hasNew && audioUnlocked) playChime();
          pending.forEach(o => seenOnlineIdsRef.current.add(o.id));
        }
        setIncomingOrders(pending);
      } catch {}
    };
    poll();
    const t = setInterval(poll, 8000);
    return () => clearInterval(t);
  }, [audioUnlocked, playChime]);

  // Repeat chime every 5s while there are pending incoming orders
  useEffect(() => {
    if (incomingOrders.length > 0 && audioUnlocked) {
      if (!chimeIntervalRef.current) chimeIntervalRef.current = setInterval(playChime, 5000);
    } else {
      if (chimeIntervalRef.current) { clearInterval(chimeIntervalRef.current); chimeIntervalRef.current = null; }
    }
    return () => { if (chimeIntervalRef.current) { clearInterval(chimeIntervalRef.current); chimeIntervalRef.current = null; } };
  }, [incomingOrders, audioUnlocked, playChime]);

  const acceptOnline = async (id: number) => {
    await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "confirmed" }),
    });
    seenOnlineIdsRef.current.delete(id);
    setIncomingOrders(prev => prev.filter(o => o.id !== id));
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
    setShowRejectInput(false); setRejectReason("");
  };

  // Clock + ticket count
  useEffect(() => {
    const t = setInterval(() => setTime(now()), 10000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const loadCount = async () => {
      try {
        const r = await fetch("/api/orders", { credentials: "include" });
        const data = await r.json();
        setTicketCount(data.filter((o: Order) => o.source === "pos" && o.paymentStatus === "pending" && !["completed","cancelled"].includes(o.status)).length);
      } catch {}
    };
    loadCount();
    const t = setInterval(loadCount, 15000);
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

  const pushToCart = (item: MenuItem, sels: CartModifier[]) => {
    // Try to merge with existing identical item
    const existingKey = cart.find(c =>
      c.menuItemId === item.id && c.notes === "" &&
      JSON.stringify(c.modifierSelections) === JSON.stringify(sels)
    )?.key;
    if (existingKey) {
      setCart(cart.map(c => c.key === existingKey ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { key: uid(), menuItemId: item.id, name: item.name, price: item.price, quantity: 1, notes: "", modifierSelections: sels }]);
    }
  };

  const removeItem = (key: string) => setCart(cart.filter(c => c.key !== key));
  const changeQty = (key: string, delta: number) => {
    setCart(cart.map(c => c.key === key ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c));
  };
  const setItemNote = (key: string, note: string) => setCart(cart.map(c => c.key === key ? { ...c, notes: note } : c));

  const clearCart = () => {
    setCart([]); setCustomerName(""); setOrderNotes(""); setDiscount(0); setResumedOrderId(null);
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
          })),
        }),
      });
      if (!r.ok) {
        const errData = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(errData.error ?? `Order failed (${r.status})`);
      }
      const order: Order = await r.json();
      if (!order?.items) throw new Error("Order response missing items");
      clearCart();
      setReceiptModal({ order, tendered });
      setTicketCount(tc => tc + (paymentStatus === "pending" ? 1 : 0));
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to place order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePay = async (method: string, tendered?: number) => {
    setPaymentModal(false);
    await placeOrder(method, "paid", tendered);
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

  // ─ Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-[#0A0B0F] flex flex-col overflow-hidden" style={{ fontFamily: "Inter, sans-serif" }}>

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-[#0F1117] border-b border-[#1E2130] flex-shrink-0">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Island Tacos" className="h-8 object-contain brightness-0 invert opacity-80"/>
          <span className="text-zinc-500 text-sm font-medium hidden sm:block">Point of Sale</span>
        </div>
        <div className="text-zinc-400 text-sm font-mono">{time}</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { unlockAudio(); }}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              incomingOrders.length > 0
                ? "bg-orange-600 hover:bg-orange-500 text-white animate-pulse"
                : audioUnlocked
                  ? "bg-[#1E2130] text-green-400 hover:bg-[#2A2F45]"
                  : "bg-[#1E2130] text-zinc-400 hover:bg-[#2A2F45]"
            }`}
          >
            {incomingOrders.length > 0 ? "🔔" : audioUnlocked ? "🔊" : "🔇"}
            <span className="hidden sm:inline">{incomingOrders.length > 0 ? `${incomingOrders.length} Online` : "Sound"}</span>
            {incomingOrders.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {incomingOrders.length}
              </span>
            )}
          </button>
          <button onClick={() => setReceiptsOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E2130] hover:bg-[#2A2F45] text-zinc-300 text-sm font-medium transition-colors">
            🧾 <span className="hidden sm:inline">Receipts</span>
          </button>
          <button onClick={() => setTicketsOpen(true)} className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E2130] hover:bg-[#2A2F45] text-zinc-300 text-sm font-medium transition-colors">
            🎫 <span className="hidden sm:inline">Tickets</span>
            {ticketCount > 0 && <span className="absolute -top-1 -right-1 bg-[#F5A623] text-black text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center">{ticketCount}</span>}
          </button>
          <button onClick={() => navigate(adminRoutes.dashboard)} className="px-3 py-1.5 rounded-lg bg-[#1E2130] hover:bg-[#2A2F45] text-zinc-400 hover:text-white text-sm font-medium transition-colors">
            ← <span className="hidden sm:inline">Admin</span>
          </button>
        </div>
      </header>

      {/* ── Main content ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: Menu ── */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden border-r border-[#1E2130]">

          {/* Search */}
          <div className="px-3 pt-3 pb-2 flex-shrink-0">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items…"
                className="w-full bg-[#13151C] border border-[#1E2130] focus:border-[#F5A623] rounded-xl pl-9 pr-4 py-2.5 text-white text-sm outline-none transition-colors placeholder-zinc-600"/>
            </div>
          </div>

          {/* Category tabs */}
          <div className="flex gap-2 px-3 pb-2 overflow-x-auto flex-shrink-0 scrollbar-none">
            <button onClick={() => setSelectedCat(null)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${selectedCat === null ? "bg-[#F5A623] text-black" : "bg-[#13151C] text-zinc-400 hover:text-white border border-[#1E2130]"}`}>
              All
            </button>
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setSelectedCat(cat.id)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${selectedCat === cat.id ? "bg-[#F5A623] text-black" : "bg-[#13151C] text-zinc-400 hover:text-white border border-[#1E2130]"}`}>
                {cat.name}
              </button>
            ))}
          </div>

          {/* Item grid */}
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {loadingMenu ? (
              <div className="flex items-center justify-center h-40 text-zinc-500">Loading menu…</div>
            ) : filteredItems.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-zinc-500">No items found</div>
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
        <div className="w-80 xl:w-96 flex flex-col bg-[#0F1117] flex-shrink-0">

          {/* Cart header */}
          <div className="px-4 py-3 border-b border-[#1E2130] flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-white font-bold text-base">{resumedOrderId ? "Resumed Ticket" : "New Order"}</h2>
              {cart.length > 0 && (
                <button onClick={clearCart} className="text-zinc-500 hover:text-red-400 text-xs font-semibold transition-colors">Clear</button>
              )}
            </div>
            <input value={customerName} onChange={e => setCustomerName(e.target.value)}
              placeholder="Customer name (optional)"
              className="w-full bg-[#13151C] border border-[#1E2130] focus:border-[#F5A623] rounded-lg px-3 py-2 text-white text-sm outline-none transition-colors placeholder-zinc-600"/>
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-zinc-600">
                <span className="text-3xl mb-2">🌮</span>
                <span className="text-sm">Tap items to add</span>
              </div>
            ) : (
              cart.map(item => {
                const lineTotal = (item.price + item.modifierSelections.reduce((s, m) => s + m.price, 0)) * item.quantity;
                return (
                  <div key={item.key} className="bg-[#13151C] rounded-xl p-3 border border-[#1E2130]">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold truncate">{item.name}</p>
                        {item.modifierSelections.map((m, i) => (
                          <p key={i} className="text-zinc-400 text-xs">+ {m.name}{m.price > 0 ? ` (+${fmt(m.price)})` : ""}</p>
                        ))}
                        {item.notes && <p className="text-zinc-500 text-xs italic">{item.notes}</p>}
                      </div>
                      <span className="text-[#F5A623] text-sm font-bold flex-shrink-0">{fmt(lineTotal)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <button onClick={() => changeQty(item.key, -1)} className="w-7 h-7 rounded-lg bg-[#1E2130] hover:bg-[#2A2F45] text-white text-lg flex items-center justify-center transition-colors">−</button>
                        <span className="text-white text-sm font-bold w-6 text-center">{item.quantity}</span>
                        <button onClick={() => changeQty(item.key, 1)} className="w-7 h-7 rounded-lg bg-[#1E2130] hover:bg-[#2A2F45] text-white text-lg flex items-center justify-center transition-colors">+</button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setItemNoteModal(item.key)} className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors">Note</button>
                        <button onClick={() => removeItem(item.key)} className="text-zinc-600 hover:text-red-400 text-lg transition-colors">×</button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Totals + actions */}
          {cart.length > 0 && (
            <div className="border-t border-[#1E2130] px-4 py-3 flex-shrink-0 space-y-2">
              {/* Discount + note row */}
              <div className="flex gap-2">
                <button onClick={() => setDiscountModal(true)} className={`flex-1 h-8 rounded-lg text-xs font-semibold border transition-colors ${discount > 0 ? "border-green-500 text-green-400 bg-green-900/20" : "border-[#2A2F45] text-zinc-400 hover:text-white hover:border-zinc-500"}`}>
                  {discount > 0 ? `Discount -${fmt(discount)}` : "% Discount"}
                </button>
                {discount > 0 && (
                  <button onClick={() => setDiscount(0)} className="h-8 w-8 rounded-lg border border-[#2A2F45] text-zinc-500 hover:text-red-400 text-sm transition-colors flex items-center justify-center">×</button>
                )}
                <button onClick={() => setOrderNoteModal(true)} className={`flex-1 h-8 rounded-lg text-xs font-semibold border transition-colors ${orderNotes ? "border-blue-500 text-blue-400" : "border-[#2A2F45] text-zinc-400 hover:text-white hover:border-zinc-500"}`}>
                  {orderNotes ? "📝 Note" : "Add Note"}
                </button>
              </div>

              {/* Totals */}
              <div className="space-y-1 py-2 border-t border-[#1E2130]">
                <div className="flex justify-between text-sm text-zinc-400"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                {discount > 0 && <div className="flex justify-between text-sm text-green-400"><span>Discount</span><span>-{fmt(discount)}</span></div>}
                <div className="flex justify-between text-lg text-white font-black border-t border-[#1E2130] pt-1 mt-1"><span>Total</span><span className="text-[#F5A623]">{fmt(total)}</span></div>
              </div>

              {/* Payment buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={handleHold} disabled={submitting}
                  className="h-11 rounded-xl border border-[#2A2F45] text-zinc-300 hover:bg-[#1E2130] text-sm font-semibold transition-colors disabled:opacity-50">
                  🎫 Hold
                </button>
                <button onClick={() => setPaymentModal(true)} disabled={submitting}
                  className="h-11 rounded-xl bg-[#F5A623] hover:bg-[#E09520] text-black font-black text-sm transition-colors disabled:opacity-50">
                  {submitting ? "Processing…" : `Charge ${fmt(total)}`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}

      {modifierModal && (
        <ModifierModal
          item={modifierModal.item}
          modifiers={modifierModal.mods}
          onConfirm={sels => { pushToCart(modifierModal.item, sels); setModifierModal(null); }}
          onClose={() => setModifierModal(null)}
        />
      )}

      {paymentModal && (
        <PaymentModal total={total} onPay={handlePay} onClose={() => setPaymentModal(false)} />
      )}

      {receiptModal && (
        <ReceiptModal order={receiptModal.order} tendered={receiptModal.tendered} onClose={() => setReceiptModal(null)} />
      )}

      {discountModal && (
        <DiscountModal subtotal={subtotal} onApply={setDiscount} onClose={() => setDiscountModal(false)} />
      )}

      {ticketsOpen && (
        <TicketsDrawer onResume={handleResume} onClose={() => setTicketsOpen(false)} />
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
      {incomingOrders.length > 0 && (() => {
        const order = incomingOrders[0];
        const subtotal = order.items.reduce((s, i) => s + i.menuItemPrice * i.quantity, 0);
        return (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-[#13151C] rounded-2xl w-full max-w-md shadow-2xl border border-orange-500/40 overflow-hidden">
              <div className="bg-orange-600 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🔔</span>
                  <span className="text-white font-bold text-lg">New Online Order</span>
                </div>
                {incomingOrders.length > 1 && (
                  <span className="bg-orange-800 text-orange-100 text-xs font-bold px-2 py-0.5 rounded-full">
                    +{incomingOrders.length - 1} more
                  </span>
                )}
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-2xl font-black text-white tracking-tight">{order.confirmationCode}</div>
                    <div className="text-zinc-300 font-semibold mt-0.5">{order.customerName}</div>
                    {order.customerPhone && <div className="text-zinc-500 text-sm">{order.customerPhone}</div>}
                  </div>
                  <div className="text-right">
                    <div className="text-[#F5A623] font-bold text-lg">${subtotal.toFixed(2)}</div>
                    <div className="text-zinc-500 text-xs capitalize">{order.orderType}</div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {order.items.map(item => (
                    <div key={item.id} className="bg-black/40 rounded-lg px-3 py-2.5">
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-black text-white">{item.quantity}×</span>
                        <span className="text-base font-semibold text-white">{item.menuItemName}</span>
                      </div>
                      {(item.modifierSelections ?? []).length > 0 && (
                        <div className="text-yellow-300 text-sm mt-1 space-y-0.5">
                          {(item.modifierSelections ?? []).map((m, i) => <div key={i}>+ {m.name}</div>)}
                        </div>
                      )}
                      {item.notes && <div className="text-yellow-300 text-sm mt-1">{item.notes}</div>}
                    </div>
                  ))}
                </div>

                {order.notes && (
                  <div className="bg-yellow-900/40 border border-yellow-700/30 rounded-lg px-3 py-2 text-yellow-200 text-sm">
                    {order.notes}
                  </div>
                )}

                {showRejectInput ? (
                  <div className="space-y-3">
                    <p className="text-red-400 text-xs font-semibold uppercase tracking-wide">Why are you rejecting?</p>
                    <div className="flex flex-wrap gap-1.5">
                      {["Out of chicken","Out of steak","Out of shrimp","Out of salmon","Out of burger"].map(opt => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setRejectReason(r => r === opt ? "" : opt)}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                            rejectReason === opt
                              ? "bg-red-500 text-white border-red-400"
                              : "border-red-700/60 text-red-400 hover:bg-red-950/50"
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
                      className="w-full bg-black/50 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-red-500 placeholder-zinc-600"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => rejectOnline(order.id)}
                        className="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-colors"
                      >
                        Confirm Reject
                      </button>
                      <button
                        onClick={() => { setShowRejectInput(false); setRejectReason(""); }}
                        className="px-4 h-11 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition-colors"
                      >
                        Back
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={() => acceptOnline(order.id)}
                      className="flex-1 h-12 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-base transition-colors active:scale-95"
                    >
                      ✓ Accept
                    </button>
                    <button
                      onClick={() => setShowRejectInput(true)}
                      className="px-5 h-12 rounded-xl border border-red-700/60 text-red-400 hover:bg-red-950/50 hover:border-red-500 font-semibold transition-colors"
                    >
                      ✕ Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {receiptsOpen && (
        <ReceiptsDrawer onClose={() => setReceiptsOpen(false)} />
      )}

      {/* Item note inline modal */}
      {itemNoteModal && (() => {
        const item = cart.find(c => c.key === itemNoteModal);
        if (!item) return null;
        return (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setItemNoteModal(null)}>
            <div className="bg-[#13151C] rounded-2xl w-full max-w-sm p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-white font-bold mb-3">Note for {item.name}</h3>
              <textarea value={item.notes} onChange={e => setItemNote(itemNoteModal, e.target.value)}
                placeholder="E.g. no onions, extra sauce…"
                className="w-full bg-[#0A0B0F] border border-[#2A2F45] focus:border-[#F5A623] rounded-xl p-3 text-white text-sm outline-none resize-none h-24 placeholder-zinc-600"/>
              <button onClick={() => setItemNoteModal(null)} className="mt-3 w-full h-11 rounded-xl bg-[#F5A623] hover:bg-[#E09520] text-black font-bold transition-colors">Done</button>
            </div>
          </div>
        );
      })()}

      {/* Order note modal */}
      {orderNoteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setOrderNoteModal(false)}>
          <div className="bg-[#13151C] rounded-2xl w-full max-w-sm p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-bold mb-3">Order Note</h3>
            <textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)}
              placeholder="Special instructions for this order…"
              className="w-full bg-[#0A0B0F] border border-[#2A2F45] focus:border-[#F5A623] rounded-xl p-3 text-white text-sm outline-none resize-none h-28 placeholder-zinc-600"/>
            <button onClick={() => setOrderNoteModal(false)} className="mt-3 w-full h-11 rounded-xl bg-[#F5A623] hover:bg-[#E09520] text-black font-bold transition-colors">Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

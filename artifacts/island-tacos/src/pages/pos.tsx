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
  notes?: string | null; createdAt: string;
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

  const QUICK = [total, Math.ceil(total / 5) * 5, Math.ceil(total / 10) * 10, Math.ceil(total / 20) * 20]
    .filter((v, i, a) => a.indexOf(v) === i).slice(0, 4);

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
              <div className="grid grid-cols-4 gap-2 mb-2">
                {QUICK.map(q => (
                  <button key={q} onClick={() => setTendered(String(q))}
                    className="h-10 rounded-xl bg-[#1E2130] hover:bg-[#2A2F45] text-white text-sm font-semibold transition-colors">
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

// ─── Order Queue Drawer ───────────────────────────────────────────────────────

function QueueDrawer({ onClose }: { onClose: () => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/orders", { credentials: "include" });
      const data = await r.json();
      setOrders(data.filter((o: Order) => ["pending", "confirmed", "preparing", "ready"].includes(o.status)));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);

  const update = async (id: number, status: string) => {
    await fetch(`/api/orders/${id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  };

  const STATUS_COLOR: Record<string, string> = {
    pending: "text-yellow-400", confirmed: "text-blue-400",
    preparing: "text-orange-400", ready: "text-green-400",
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex justify-end z-50" onClick={onClose}>
      <div className="bg-[#13151C] w-full max-w-md h-full flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-[#1E2130] flex items-center justify-between">
          <h2 className="text-white text-xl font-bold">Live Orders</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-2xl">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && <p className="text-zinc-500 text-center py-8">Loading…</p>}
          {!loading && orders.length === 0 && <p className="text-zinc-500 text-center py-8">No active orders</p>}
          {orders.map(o => (
            <div key={o.id} className="bg-[#1E2130] rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="text-white font-bold">#{o.confirmationCode}</span>
                  <span className={`ml-2 text-sm font-semibold capitalize ${STATUS_COLOR[o.status] ?? "text-zinc-400"}`}>{o.status}</span>
                </div>
                <div className="text-right">
                  <span className="text-[#F5A623] font-bold">{fmt(o.total)}</span>
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${o.source === "pos" ? "bg-purple-900/50 text-purple-300" : "bg-blue-900/50 text-blue-300"}`}>{o.source === "pos" ? "POS" : "Online"}</span>
                </div>
              </div>
              <p className="text-zinc-300 text-sm">{o.customerName}</p>
              <p className="text-zinc-500 text-xs mt-1">{o.items.map(i => `${i.quantity}× ${i.menuItemName}`).join(", ")}</p>
              <div className="flex gap-2 mt-3">
                {o.status === "pending" && (
                  <>
                    <button onClick={() => update(o.id, "confirmed")} className="flex-1 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors">Accept</button>
                    <button onClick={() => update(o.id, "cancelled")} className="h-8 px-3 rounded-lg bg-red-900/50 hover:bg-red-800 text-red-300 text-xs font-semibold transition-colors">Reject</button>
                  </>
                )}
                {o.status === "confirmed" && <button onClick={() => update(o.id, "preparing")} className="flex-1 h-8 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold transition-colors">Start Cooking</button>}
                {o.status === "preparing" && <button onClick={() => update(o.id, "ready")} className="flex-1 h-8 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-semibold transition-colors">Mark Ready</button>}
                {o.status === "ready" && <button onClick={() => update(o.id, "completed")} className="flex-1 h-8 rounded-lg bg-zinc-600 hover:bg-zinc-500 text-white text-xs font-semibold transition-colors">Complete</button>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Open Tickets Drawer ──────────────────────────────────────────────────────

function TicketsDrawer({ onResume, onClose }: {
  onResume: (items: CartItem[], name: string, note: string, discount: number, orderId: number) => void;
  onClose: () => void;
}) {
  const [tickets, setTickets] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/orders", { credentials: "include" });
      const data = await r.json();
      setTickets(data.filter((o: Order) => o.source === "pos" && o.paymentStatus === "pending" && !["completed","cancelled"].includes(o.status)));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resume = (o: Order) => {
    const items: CartItem[] = o.items.map(i => ({
      key: uid(), menuItemId: i.id, name: i.menuItemName, price: i.menuItemPrice,
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

  return (
    <div className="fixed inset-0 bg-black/70 flex justify-end z-50" onClick={onClose}>
      <div className="bg-[#13151C] w-full max-w-sm h-full flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-[#1E2130] flex items-center justify-between">
          <h2 className="text-white text-xl font-bold">Open Tickets</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-2xl">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && <p className="text-zinc-500 text-center py-8">Loading…</p>}
          {!loading && tickets.length === 0 && <p className="text-zinc-500 text-center py-8">No open tickets</p>}
          {tickets.map(o => (
            <div key={o.id} className="bg-[#1E2130] rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-white font-bold">{o.customerName || "Guest"}</p>
                  <p className="text-zinc-400 text-xs">#{o.confirmationCode}</p>
                </div>
                <span className="text-[#F5A623] font-bold text-lg">{fmt(o.total)}</span>
              </div>
              <p className="text-zinc-400 text-xs mb-3">{o.items.map(i => `${i.quantity}× ${i.menuItemName}`).join(", ")}</p>
              <div className="flex gap-2">
                <button onClick={() => resume(o)} className="flex-1 h-9 rounded-lg bg-[#F5A623] hover:bg-[#E09520] text-black text-sm font-bold transition-colors">Resume</button>
                <button onClick={() => voidTicket(o.id)} className="h-9 px-3 rounded-lg bg-red-900/40 hover:bg-red-800/60 text-red-400 text-sm font-semibold transition-colors">Void</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
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
  const [ticketsOpen, setTicketsOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [itemNoteModal, setItemNoteModal] = useState<string | null>(null); // cart item key
  const [orderNoteModal, setOrderNoteModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
  const placeOrder = async (method: string, paymentStatus: "pending" | "paid", tendered?: number) => {
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
          customerName: customerName || "Walk-in",
          customerEmail: "", customerPhone: "",
          orderType: "pickup",
          paymentMethod: method,
          paymentStatus,
          source: "pos",
          discountAmount: discount,
          notes: orderNotes || null,
          items: cart.map(c => ({
            menuItemId: c.menuItemId,
            quantity: c.quantity,
            notes: c.notes || null,
            modifierSelections: c.modifierSelections.length > 0 ? c.modifierSelections : undefined,
          })),
        }),
      });
      const order: Order = await r.json();
      clearCart();
      setReceiptModal({ order, tendered });
      setTicketCount(tc => tc + (paymentStatus === "pending" ? 1 : 0));
    } catch (err) {
      console.error(err);
      alert("Failed to place order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePay = async (method: string, tendered?: number) => {
    setPaymentModal(false);
    await placeOrder(method, "paid", tendered);
  };

  const handleHold = async () => {
    if (cart.length === 0) return;
    await placeOrder("cash", "pending");
    setTicketCount(tc => tc + 1);
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
          <button onClick={() => setQueueOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E2130] hover:bg-[#2A2F45] text-zinc-300 text-sm font-medium transition-colors">
            📋 <span className="hidden sm:inline">Orders</span>
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

      {queueOpen && (
        <QueueDrawer onClose={() => setQueueOpen(false)} />
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

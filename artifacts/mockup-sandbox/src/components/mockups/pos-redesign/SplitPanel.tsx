import { useState } from "react";
import {
  RefreshCw, Search, Bell, Clock, Banknote, Receipt,
  Ban, Ticket, Settings, ChevronLeft, ChevronRight,
  Plus, Minus, X, StickyNote, Scissors, Tag, User, Phone,
  CreditCard, Smartphone, CheckCircle, ChevronDown
} from "lucide-react";

// ─── Sample data ────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 0,  name: "All",          emoji: "🍽",  color: "#F5A623", bg: "#fff7ed" },
  { id: 1,  name: "Tacos",        emoji: "🌮",  color: "#dc2626", bg: "#fef2f2" },
  { id: 2,  name: "Burritos",     emoji: "🌯",  color: "#ea580c", bg: "#fff7ed" },
  { id: 3,  name: "Rice Bowls",   emoji: "🍚",  color: "#16a34a", bg: "#f0fdf4" },
  { id: 4,  name: "Quesadillas",  emoji: "🧀",  color: "#ca8a04", bg: "#fefce8" },
  { id: 5,  name: "Sides",        emoji: "🥗",  color: "#7c3aed", bg: "#f5f3ff" },
  { id: 6,  name: "Drinks",       emoji: "🥤",  color: "#0284c7", bg: "#eff6ff" },
];

const MENU = [
  { id:1,  catId:1, name:"Tacos Chicken",    price:14.00, emoji:"🌮", bg:"#fef3c7", popular:true,  spicy:false, veggie:false },
  { id:2,  catId:1, name:"Tacos Steak",      price:16.00, emoji:"🌮", bg:"#fee2e2", popular:true,  spicy:true,  veggie:false },
  { id:3,  catId:1, name:"Tacos Carnitas",   price:15.00, emoji:"🌮", bg:"#fce7f3", popular:false, spicy:false, veggie:false },
  { id:4,  catId:1, name:"Tacos Fish",       price:16.00, emoji:"🐟", bg:"#dbeafe", popular:false, spicy:false, veggie:false },
  { id:5,  catId:1, name:"Tacos Shrimp",     price:17.00, emoji:"🍤", bg:"#d1fae5", popular:false, spicy:false, veggie:false },
  { id:6,  catId:1, name:"Tacos Veggie",     price:13.00, emoji:"🥬", bg:"#dcfce7", popular:false, spicy:false, veggie:true  },
  { id:7,  catId:2, name:"Burrito Chicken",  price:14.00, emoji:"🌯", bg:"#fef3c7", popular:true,  spicy:false, veggie:false },
  { id:8,  catId:2, name:"Burrito Steak",    price:16.00, emoji:"🌯", bg:"#fee2e2", popular:true,  spicy:true,  veggie:false },
  { id:9,  catId:2, name:"Burrito Fish",     price:16.00, emoji:"🌯", bg:"#dbeafe", popular:false, spicy:false, veggie:false },
  { id:10, catId:3, name:"Rice Bowl Chicken",price:16.00, emoji:"🍗", bg:"#fef3c7", popular:true,  spicy:false, veggie:false },
  { id:11, catId:3, name:"Rice Bowl Steak",  price:18.00, emoji:"🥩", bg:"#fee2e2", popular:false, spicy:false, veggie:false },
  { id:12, catId:3, name:"Rice Bowl Salmon", price:20.00, emoji:"🐟", bg:"#dbeafe", popular:true,  spicy:false, veggie:false },
  { id:13, catId:4, name:"Quesadilla Chicken",price:14.00,emoji:"🧀", bg:"#fef3c7", popular:false, spicy:false, veggie:false },
  { id:14, catId:4, name:"Island Taco Burger",price:14.00,emoji:"🍔", bg:"#fce7f3", popular:true,  spicy:false, veggie:false },
  { id:15, catId:5, name:"Chips & Guac",     price: 4.00, emoji:"🥑", bg:"#dcfce7", popular:false, spicy:false, veggie:true  },
  { id:16, catId:5, name:"Side Rice",        price: 3.00, emoji:"🍚", bg:"#fef3c7", popular:false, spicy:false, veggie:true  },
  { id:17, catId:6, name:"Soda",             price: 2.00, emoji:"🥤", bg:"#dbeafe", popular:false, spicy:false, veggie:true  },
  { id:18, catId:6, name:"Water",            price: 1.00, emoji:"💧", bg:"#e0f2fe", popular:false, spicy:false, veggie:true  },
];

type CartItem = { key: string; id: number; name: string; price: number; qty: number; mods: string[]; note: string };

const uid = () => Math.random().toString(36).slice(2,7);
const fmt = (n: number) => `$${n.toFixed(2)}`;

// ─── Sub-components ─────────────────────────────────────────────────────────

function PaymentModal({ total, onClose, onCharge }: { total: number; onClose: () => void; onCharge: () => void }) {
  const [tab, setTab] = useState<"cash"|"card"|"athmovil">("cash");
  const [tendered, setTendered] = useState("");
  const change = tab === "cash" && parseFloat(tendered) > 0 ? Math.max(0, parseFloat(tendered) - total) : 0;
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gray-900 px-5 py-4 flex items-center justify-between">
          <span className="text-white font-black text-xl">Charge {fmt(total)}</span>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex border-b border-gray-100">
          {(["cash","card","athmovil"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-bold transition-colors ${tab === t ? "border-b-2 border-amber-400 text-amber-600" : "text-gray-400"}`}>
              {t === "cash" ? "💵 Cash" : t === "card" ? "💳 Card" : "📱 ATH"}
            </button>
          ))}
        </div>
        <div className="p-5 space-y-4">
          {tab === "cash" && (
            <>
              <div>
                <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1 block">Tendered</label>
                <input value={tendered} onChange={e => setTendered(e.target.value)} type="number" placeholder="0.00"
                  className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-2xl font-black text-gray-900 outline-none focus:border-amber-400"/>
              </div>
              {change > 0 && <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex justify-between">
                <span className="text-green-700 font-semibold">Change</span>
                <span className="text-green-700 font-black text-lg">{fmt(change)}</span>
              </div>}
              <div className="grid grid-cols-3 gap-2">
                {[20,50,100].map(v => (
                  <button key={v} onClick={() => setTendered(String(v))}
                    className="py-2 bg-gray-100 rounded-xl text-sm font-bold text-gray-700 hover:bg-amber-50 hover:text-amber-700 transition-colors">${v}</button>
                ))}
              </div>
            </>
          )}
          {tab === "card" && <p className="text-center text-gray-400 py-4 text-sm">Tap Card on terminal to complete</p>}
          {tab === "athmovil" && <p className="text-center text-gray-400 py-4 text-sm">Customer will receive push notification</p>}
          <button onClick={onCharge}
            className="w-full h-14 rounded-xl bg-amber-400 hover:bg-amber-500 text-black font-black text-lg transition-colors">
            ✓ Confirm Payment
          </button>
          <button onClick={onClose} className="w-full text-center text-gray-400 text-sm">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function TicketsDrawer({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex justify-end z-50" onClick={onClose}>
      <div className="bg-white w-80 h-full flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-black text-gray-900 text-lg">Held Tickets (2)</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {[
            { code:"IT4A1B", name:"Maria", total:48.00, items:["Rice Bowl Chicken","Tacos Steak x2"], status:"confirmed" },
            { code:"IT9X2C", name:"Walk-in", total:14.00, items:["Burrito Chicken"], status:"preparing" },
          ].map(t => (
            <div key={t.code} className="bg-gray-50 rounded-xl p-3 border border-gray-200">
              <div className="flex justify-between mb-1">
                <span className="font-black text-gray-900 text-sm">#{t.code}</span>
                <span className="text-amber-600 font-bold text-sm">{fmt(t.total)}</span>
              </div>
              <p className="text-gray-600 text-xs font-semibold">{t.name}</p>
              {t.items.map(i => <p key={i} className="text-gray-400 text-xs">{i}</p>)}
              <div className="flex gap-2 mt-3">
                <button className="flex-1 h-8 rounded-lg bg-amber-400 text-black text-xs font-bold">Resume</button>
                <button className="flex-1 h-8 rounded-lg bg-green-100 text-green-700 text-xs font-bold">Charge</button>
                <button className="w-8 h-8 rounded-lg bg-red-50 text-red-500 text-xs font-bold flex items-center justify-center"><Trash /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Trash() { return <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>; }

// ─── Main Component ──────────────────────────────────────────────────────────

export function SplitPanel() {
  const [search, setSearch]           = useState("");
  const [selectedCat, setSelectedCat] = useState(0);
  const [cart, setCart]               = useState<CartItem[]>([
    { key:"a", id:10, name:"Rice Bowl Chicken", price:16.00, qty:1, mods:["Extra salsa"], note:"" },
    { key:"b", id:2,  name:"Tacos Steak",       price:16.00, qty:2, mods:[], note:"No onions" },
  ]);
  const [customerName, setCustomerName] = useState("Maria");
  const [customerPhone, setCustomerPhone] = useState("");
  const [discount, setDiscount]         = useState(0);
  const [orderNote, setOrderNote]       = useState("");
  const [paymentModal, setPaymentModal] = useState(false);
  const [ticketsOpen, setTicketsOpen]   = useState(false);
  const [paidOrder, setPaidOrder]       = useState(false);
  const [shiftOpen, setShiftOpen]       = useState(true);
  const [incomingOrders]                = useState(1);
  const [ticketCount]                   = useState(2);
  const [mobileView, setMobileView]     = useState<"menu"|"cart">("menu");

  const filteredItems = MENU.filter(i =>
    (selectedCat === 0 || i.catId === selectedCat) &&
    (!search || i.name.toLowerCase().includes(search.toLowerCase()))
  );

  const addItem = (item: typeof MENU[0]) => {
    const existing = cart.find(c => c.id === item.id && c.mods.length === 0 && c.note === "");
    if (existing) {
      setCart(cart.map(c => c.key === existing.key ? { ...c, qty: c.qty + 1 } : c));
    } else {
      setCart([...cart, { key: uid(), id: item.id, name: item.name, price: item.price, qty: 1, mods: [], note: "" }]);
    }
    if (window.innerWidth < 640) setMobileView("cart");
  };

  const changeQty = (key: string, delta: number) =>
    setCart(cart.flatMap(c => c.key !== key ? [c] : (c.qty + delta < 1 ? [] : [{ ...c, qty: c.qty + delta }])));

  const removeItem = (key: string) => setCart(cart.filter(c => c.key !== key));

  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const total    = Math.max(0, subtotal - discount);

  if (paidOrder) return (
    <div className="w-full h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
        <p className="text-2xl font-black text-gray-900">Payment Complete</p>
        <p className="text-gray-500 mt-1">Total charged: {fmt(total)}</p>
        <button onClick={() => { setCart([]); setCustomerName(""); setDiscount(0); setOrderNote(""); setPaidOrder(false); }}
          className="mt-6 bg-amber-400 text-black px-8 py-3 rounded-xl font-black text-lg">
          New Order
        </button>
      </div>
    </div>
  );

  return (
    <div className="w-full h-screen bg-gray-100 flex flex-col overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-3 h-12 bg-white border-b border-gray-200 shadow-sm flex-shrink-0 gap-2">
        {/* Logo + title */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center">
            <span className="text-white text-[10px] font-black">IT</span>
          </div>
          <span className="text-gray-400 text-xs font-semibold hidden sm:block">Point of Sale</span>
        </div>

        {/* Clock */}
        <div className="text-gray-400 text-xs font-mono flex-shrink-0 hidden sm:block">
          <Clock className="w-3 h-3 inline mr-1" />10:42 AM
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 flex-1 justify-end">
          {/* Incoming orders */}
          <button className={`relative flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${incomingOrders > 0 ? "bg-orange-500 text-white animate-pulse" : "bg-gray-100 text-green-700"}`}>
            <Bell className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{incomingOrders > 0 ? `${incomingOrders} Pending` : "Alerts On"}</span>
            {incomingOrders > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">{incomingOrders}</span>}
          </button>

          {/* Shift */}
          <button onClick={() => setShiftOpen(!shiftOpen)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${shiftOpen ? "bg-green-50 text-green-700 border-green-300" : "bg-red-50 text-red-700 border-red-300"}`}>
            ⏱ <span className="hidden sm:inline">{shiftOpen ? "Shift Open" : "No Shift"}</span>
          </button>

          {/* Cash */}
          <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200 transition-colors">
            <Banknote className="w-3.5 h-3.5" /><span className="hidden sm:inline">Cash</span>
          </button>

          {/* Receipts */}
          <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200 transition-colors">
            <Receipt className="w-3.5 h-3.5" /><span className="hidden sm:inline">Receipts</span>
          </button>

          {/* Sold Out */}
          <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-100 text-red-700 text-xs font-bold hover:bg-red-200 transition-colors">
            <Ban className="w-3.5 h-3.5" /><span className="hidden sm:inline">Sold Out</span>
          </button>

          {/* Tickets */}
          <button onClick={() => setTicketsOpen(true)}
            className={`relative flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${ticketCount > 0 ? "bg-amber-400 text-black shadow-[0_0_10px_rgba(245,166,35,0.4)] animate-pulse" : "bg-gray-100 text-gray-700"}`}>
            <Ticket className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{ticketCount > 0 ? `${ticketCount} Held` : "Tickets"}</span>
            {ticketCount > 0 && <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow">{ticketCount}</span>}
          </button>

          {/* Admin + Reload */}
          <button className="px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-500 text-xs font-semibold hover:bg-gray-200 transition-colors hidden sm:flex items-center gap-1">
            <Settings className="w-3.5 h-3.5" /><span>Admin</span>
          </button>
          <button className="p-1.5 rounded-lg bg-gray-100 text-gray-400 hover:bg-gray-200 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* ── BODY ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* ── LEFT: MENU ───────────────────────────────────────────────── */}
        <div className={`flex-col flex-1 min-w-0 overflow-hidden border-r border-gray-200 ${mobileView === "menu" ? "flex" : "hidden"} sm:flex`}>

          {/* Search */}
          <div className="px-3 pt-2.5 pb-2 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search items…"
                className="w-full bg-white border border-gray-200 focus:border-amber-400 rounded-xl pl-9 pr-4 py-2 text-gray-900 text-sm outline-none transition-colors placeholder-gray-400"
              />
            </div>
          </div>

          {/* Category tabs — icon tiles like reference */}
          <div className="flex gap-2 px-3 pb-2 overflow-x-auto flex-shrink-0" style={{ scrollbarWidth: "none" }}>
            <button className="p-1 text-gray-300 flex-shrink-0"><ChevronLeft className="w-4 h-4" /></button>
            {CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setSelectedCat(cat.id)}
                className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl flex-shrink-0 transition-all border"
                style={selectedCat === cat.id
                  ? { background: cat.color, borderColor: cat.color, transform: "scale(1.05)", boxShadow: `0 4px 12px ${cat.color}44` }
                  : { background: "white", borderColor: "#e5e7eb" }
                }
              >
                <span className="text-lg leading-none">{cat.emoji}</span>
                <span className="text-[9px] font-bold tracking-wide" style={{ color: selectedCat === cat.id ? "white" : "#6b7280" }}>
                  {cat.name.toUpperCase()}
                </span>
              </button>
            ))}
            <button className="p-1 text-gray-300 flex-shrink-0"><ChevronRight className="w-4 h-4" /></button>
          </div>

          {/* Item grid */}
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {filteredItems.map(item => (
                <button key={item.id} onClick={() => addItem(item)}
                  className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md active:scale-95 transition-all border border-gray-100 text-left group">
                  <div className="w-full h-24 flex items-center justify-center relative" style={{ background: item.bg }}>
                    <span className="text-4xl select-none">{item.emoji}</span>
                    <div className="absolute top-1.5 right-1.5 flex flex-col gap-1">
                      {item.popular && <span className="bg-amber-400 text-black text-[8px] font-black px-1.5 py-0.5 rounded-full">⭐ TOP</span>}
                      {item.spicy   && <span className="bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">🌶 SPICY</span>}
                      {item.veggie  && <span className="bg-green-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">🌿 VEG</span>}
                    </div>
                    <div className="absolute top-1.5 left-1.5 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus className="w-3 h-3 text-red-600" />
                    </div>
                  </div>
                  <div className="px-2.5 py-2">
                    <p className="text-[11px] font-semibold text-gray-800 leading-tight truncate">{item.name}</p>
                    <p className="text-sm font-black text-red-600 mt-0.5">{fmt(item.price)}</p>
                  </div>
                </button>
              ))}
              {filteredItems.length === 0 && (
                <div className="col-span-full flex items-center justify-center h-32 text-gray-400 text-sm">
                  No items found
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT: CART ──────────────────────────────────────────────── */}
        <div className={`flex-col bg-gray-50 flex-shrink-0 w-full sm:w-80 xl:w-96 border-l border-gray-200 ${mobileView === "cart" ? "flex" : "hidden"} sm:flex`}>

          {/* Cart header */}
          <div className="px-4 py-3 bg-white border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-black text-gray-900 text-sm">New Order</h2>
              {cart.length > 0 && (
                <button onClick={() => { setCart([]); setCustomerName(""); setDiscount(0); setOrderNote(""); }}
                  className="text-xs text-gray-400 hover:text-red-600 font-semibold transition-colors">Clear</button>
              )}
            </div>
            {/* Customer name */}
            <div className="relative mb-1.5">
              <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
              <input value={customerName} onChange={e => setCustomerName(e.target.value)}
                placeholder="Customer name (optional)"
                className="w-full bg-gray-100 border border-transparent focus:border-amber-400 rounded-lg pl-8 pr-3 py-1.5 text-gray-900 text-xs outline-none transition-colors placeholder-gray-400"
              />
            </div>
            {/* Phone */}
            <div className="relative">
              <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
              <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
                placeholder="Phone (optional)" type="tel"
                className="w-full bg-gray-100 border border-transparent focus:border-amber-400 rounded-lg pl-8 pr-3 py-1.5 text-gray-900 text-xs outline-none transition-colors placeholder-gray-400"
              />
            </div>
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-28 text-gray-400">
                <span className="text-3xl mb-1">🌮</span>
                <span className="text-xs">Tap items to add</span>
              </div>
            ) : cart.map(item => {
              const lineTotal = item.price * item.qty;
              return (
                <div key={item.key} className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
                  <div className="flex items-start gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{item.name}</p>
                      {item.mods.map((m, i) => (
                        <p key={i} className="text-[10px] text-gray-400">+ {m}</p>
                      ))}
                      {item.note && <p className="text-[10px] text-amber-600 italic">{item.note}</p>}
                      {(item.mods.length > 0 || item.note) && (
                        <p className="text-[9px] text-gray-300 mt-0.5">tap to edit</p>
                      )}
                    </div>
                    <span className="text-amber-500 text-sm font-black flex-shrink-0">{fmt(lineTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => changeQty(item.key, -1)}
                        className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-700 text-base flex items-center justify-center transition-colors font-bold">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-gray-900 text-sm font-black w-5 text-center">{item.qty}</span>
                      <button onClick={() => changeQty(item.key, 1)}
                        className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-green-50 hover:text-green-600 text-gray-700 text-base flex items-center justify-center transition-colors font-bold">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button className="text-[10px] text-gray-400 hover:text-blue-600 font-semibold transition-colors flex items-center gap-0.5">
                        <StickyNote className="w-3 h-3" /> Note
                      </button>
                      <button onClick={() => removeItem(item.key)}
                        className="text-gray-300 hover:text-red-500 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals + actions */}
          {cart.length > 0 && (
            <div className="border-t border-gray-200 px-4 pt-3 pb-3 bg-white flex-shrink-0 space-y-3">

              {/* Discount + Note row */}
              <div className="flex gap-2">
                <button onClick={() => setDiscount(d => d > 0 ? 0 : 5)}
                  className={`flex-1 h-10 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1 ${
                    discount > 0 ? "border-green-400 bg-green-50 text-green-700" : "border-gray-200 text-gray-500 hover:border-gray-400"
                  }`}>
                  <Tag className="w-3.5 h-3.5" />
                  {discount > 0 ? `Discount -${fmt(discount)}` : "% Discount"}
                </button>
                <button onClick={() => setOrderNote(n => n ? "" : "No onions please")}
                  className={`flex-1 h-10 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1 ${
                    orderNote ? "border-blue-400 text-blue-500" : "border-gray-200 text-gray-500 hover:border-gray-400"
                  }`}>
                  <StickyNote className="w-3.5 h-3.5" />
                  {orderNote ? "📝 Note" : "Add Note"}
                </button>
              </div>

              {/* Totals */}
              <div className="space-y-1 py-2 border-t border-gray-100">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Subtotal</span><span>{fmt(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-xs text-green-600">
                    <span>Discount</span><span>-{fmt(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-gray-900 border-t border-gray-100 pt-1.5 mt-1">
                  <span>TOTAL</span>
                  <span className="text-amber-500 text-xl">{fmt(total)}</span>
                </div>
              </div>

              {/* Buttons */}
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button className="h-12 rounded-xl border-2 border-amber-400 bg-amber-50 text-amber-700 text-xs font-black flex items-center justify-center gap-1.5 hover:bg-amber-100 transition-colors">
                    <Ticket className="w-4 h-4" /> Hold
                  </button>
                  <button disabled={cart.length < 2}
                    className="h-12 rounded-xl border border-gray-200 text-gray-600 text-xs font-black flex items-center justify-center gap-1.5 hover:bg-gray-100 transition-colors disabled:opacity-40">
                    <Scissors className="w-4 h-4" /> Split
                  </button>
                </div>
                <button onClick={() => setPaymentModal(true)}
                  className="w-full h-14 rounded-xl bg-amber-400 hover:bg-amber-500 text-black font-black text-lg transition-colors">
                  Charge {fmt(total)}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── MOBILE BOTTOM TAB BAR ─────────────────────────────────────── */}
      <div className="sm:hidden flex border-t border-gray-200 bg-white flex-shrink-0">
        <button onClick={() => setMobileView("menu")}
          className={`flex-1 flex flex-col items-center py-2 gap-0.5 ${mobileView === "menu" ? "text-amber-500" : "text-gray-400"}`}>
          <span className="text-xl">🍽</span>
          <span className="text-[10px] font-semibold">Menu</span>
        </button>
        <button onClick={() => setMobileView("cart")}
          className={`flex-1 flex flex-col items-center py-2 gap-0.5 relative ${mobileView === "cart" ? "text-amber-500" : "text-gray-400"}`}>
          <span className="text-xl">🛒</span>
          <span className="text-[10px] font-semibold">Cart</span>
          {cart.length > 0 && (
            <span className="absolute top-1 right-[calc(50%-14px)] bg-amber-400 text-black text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center">
              {cart.reduce((s, c) => s + c.qty, 0)}
            </span>
          )}
        </button>
      </div>

      {/* ── MODALS ─────────────────────────────────────────────────────── */}
      {paymentModal && (
        <PaymentModal
          total={total}
          onClose={() => setPaymentModal(false)}
          onCharge={() => { setPaymentModal(false); setPaidOrder(true); }}
        />
      )}
      {ticketsOpen && <TicketsDrawer onClose={() => setTicketsOpen(false)} />}

      {/* Incoming order popup */}
      {incomingOrders > 0 && false && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-orange-400/40">
            <div className="bg-orange-600 px-5 py-3 flex items-center gap-2">
              <Bell className="w-5 h-5 text-white" />
              <span className="text-white font-black text-lg">New Online Order</span>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex justify-between">
                <div><p className="text-2xl font-black text-gray-900">IT4A1B</p><p className="text-gray-600">Carlos Rivera</p></div>
                <div className="text-right"><p className="text-amber-500 font-bold">$48.00</p><p className="text-gray-400 text-xs">Pickup</p></div>
              </div>
              <div className="flex gap-3">
                <button className="flex-1 h-12 rounded-xl bg-green-600 text-white font-bold">✓ Accept</button>
                <button className="px-5 h-12 rounded-xl border border-red-300 text-red-600 font-semibold">✕ Reject</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

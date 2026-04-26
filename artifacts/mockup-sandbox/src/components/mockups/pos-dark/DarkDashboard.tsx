import { useState } from "react";
import {
  LayoutGrid, Ticket, Receipt, Banknote, Ban, Settings,
  LogOut, Search, Bell, RefreshCw, Plus, Minus, X,
  Tag, StickyNote, Scissors, CheckCircle, ChevronRight,
  User, Phone, Clock, CreditCard, Smartphone, Zap
} from "lucide-react";

// ─── Palette ─────────────────────────────────────────────────────────────────
const C = {
  bg:       "#0f1117",
  surface:  "#1a1d27",
  card:     "#20232f",
  border:   "#2a2d3a",
  text:     "#e2e8f0",
  muted:    "#6b7280",
  accent:   "#ef4444",
  amber:    "#f59e0b",
  green:    "#22c55e",
};

// ─── Data ────────────────────────────────────────────────────────────────────
const CATS = [
  { id:0, name:"All",        emoji:"🍽", glow:"#f59e0b" },
  { id:1, name:"Tacos",      emoji:"🌮", glow:"#ef4444" },
  { id:2, name:"Burritos",   emoji:"🌯", glow:"#f97316" },
  { id:3, name:"Rice Bowls", emoji:"🍚", glow:"#22c55e" },
  { id:4, name:"Quesadilla", emoji:"🧀", glow:"#eab308" },
  { id:5, name:"Sides",      emoji:"🥗", glow:"#a855f7" },
  { id:6, name:"Drinks",     emoji:"🥤", glow:"#3b82f6" },
];

const MENU = [
  { id:1, catId:1, name:"Tacos Chicken",     price:14, emoji:"🌮", popular:true,  spicy:false, veggie:false, glow:"#ef4444" },
  { id:2, catId:1, name:"Tacos Steak",       price:16, emoji:"🥩", popular:true,  spicy:true,  veggie:false, glow:"#dc2626" },
  { id:3, catId:1, name:"Tacos Carnitas",    price:15, emoji:"🌮", popular:false, spicy:false, veggie:false, glow:"#f97316" },
  { id:4, catId:1, name:"Tacos Fish",        price:16, emoji:"🐟", popular:false, spicy:false, veggie:false, glow:"#3b82f6" },
  { id:5, catId:1, name:"Tacos Shrimp",      price:17, emoji:"🍤", popular:false, spicy:false, veggie:false, glow:"#22c55e" },
  { id:6, catId:1, name:"Tacos Veggie",      price:13, emoji:"🥬", popular:false, spicy:false, veggie:true,  glow:"#22c55e" },
  { id:7, catId:2, name:"Burrito Chicken",   price:14, emoji:"🌯", popular:true,  spicy:false, veggie:false, glow:"#f97316" },
  { id:8, catId:2, name:"Burrito Steak",     price:16, emoji:"🌯", popular:false, spicy:true,  veggie:false, glow:"#ef4444" },
  { id:9, catId:2, name:"Burrito Fish",      price:16, emoji:"🌯", popular:false, spicy:false, veggie:false, glow:"#3b82f6" },
  { id:10,catId:3, name:"Rice Bowl Chicken", price:16, emoji:"🍗", popular:true,  spicy:false, veggie:false, glow:"#f59e0b" },
  { id:11,catId:3, name:"Rice Bowl Steak",   price:18, emoji:"🥩", popular:false, spicy:false, veggie:false, glow:"#ef4444" },
  { id:12,catId:3, name:"Rice Bowl Salmon",  price:20, emoji:"🐟", popular:true,  spicy:false, veggie:false, glow:"#3b82f6" },
  { id:13,catId:4, name:"Quesadilla Chkn",   price:14, emoji:"🧀", popular:false, spicy:false, veggie:false, glow:"#eab308" },
  { id:14,catId:4, name:"Island Burger",     price:14, emoji:"🍔", popular:true,  spicy:false, veggie:false, glow:"#a855f7" },
  { id:15,catId:5, name:"Chips & Guac",      price: 4, emoji:"🥑", popular:false, spicy:false, veggie:true,  glow:"#22c55e" },
  { id:16,catId:5, name:"Side Rice",         price: 3, emoji:"🍚", popular:false, spicy:false, veggie:true,  glow:"#f59e0b" },
  { id:17,catId:6, name:"Soda",              price: 2, emoji:"🥤", popular:false, spicy:false, veggie:true,  glow:"#3b82f6" },
  { id:18,catId:6, name:"Water",             price: 1, emoji:"💧", popular:false, spicy:false, veggie:true,  glow:"#6366f1" },
];

const RECENT = [
  { code:"IT4A1B", name:"Maria Rivera",  items:"Rice Bowl Chicken, Tacos Steak ×2", total:48.00, method:"Cash",  status:"completed" },
  { code:"IT9X2C", name:"Walk-in",       items:"Burrito Chicken",                   total:14.00, method:"Card",  status:"preparing" },
  { code:"IT3K7M", name:"Carlos Ruiz",   items:"Island Burger, Soda ×2",            total:18.00, method:"ATH",   status:"ready"     },
  { code:"IT1P5Q", name:"Walk-in",       items:"Tacos Chicken ×3",                  total:42.00, method:"Cash",  status:"confirmed" },
];

type CartItem = { key:string; id:number; name:string; price:number; qty:number; mods:string[]; note:string };
const uid = () => Math.random().toString(36).slice(2,7);
const fmt = (n:number) => `$${n.toFixed(2)}`;

// ─── Payment Modal ────────────────────────────────────────────────────────────
function PayModal({ total, onClose, onCharge }: { total:number; onClose:()=>void; onCharge:()=>void }) {
  const [tab, setTab] = useState<"cash"|"card"|"athmovil">("cash");
  const [tendered, setTendered] = useState("");
  const change = tab==="cash" && parseFloat(tendered)>0 ? Math.max(0,parseFloat(tendered)-total) : 0;
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl" style={{ background:C.surface, border:`1px solid ${C.border}` }} onClick={e=>e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ background:C.card }}>
          <span className="font-black text-xl" style={{ color:C.text }}>Charge {fmt(total)}</span>
          <button onClick={onClose} style={{ color:C.muted }}><X className="w-5 h-5"/></button>
        </div>
        <div className="flex border-b" style={{ borderColor:C.border }}>
          {(["cash","card","athmovil"] as const).map(t => (
            <button key={t} onClick={()=>setTab(t)}
              className="flex-1 py-3 text-sm font-bold transition-colors"
              style={{ color:tab===t?C.amber:C.muted, borderBottom:tab===t?`2px solid ${C.amber}`:"2px solid transparent" }}>
              {t==="cash"?"💵 Cash":t==="card"?"💳 Card":"📱 ATH"}
            </button>
          ))}
        </div>
        <div className="p-5 space-y-4">
          {tab==="cash" && <>
            <input value={tendered} onChange={e=>setTendered(e.target.value)} type="number" placeholder="Amount tendered"
              className="w-full rounded-xl px-4 py-3 text-2xl font-black outline-none"
              style={{ background:C.card, border:`1px solid ${C.border}`, color:C.text }}/>
            {change>0 && <div className="rounded-xl px-4 py-3 flex justify-between" style={{ background:"#14532d33", border:"1px solid #16a34a44" }}>
              <span style={{ color:C.green }} className="font-semibold">Change</span>
              <span style={{ color:C.green }} className="font-black text-lg">{fmt(change)}</span>
            </div>}
            <div className="grid grid-cols-3 gap-2">
              {[20,50,100].map(v=>(
                <button key={v} onClick={()=>setTendered(String(v))}
                  className="py-2 rounded-xl text-sm font-bold transition-colors"
                  style={{ background:C.card, color:C.amber, border:`1px solid ${C.border}` }}>${v}</button>
              ))}
            </div>
          </>}
          {tab==="card"     && <p className="text-center py-4 text-sm" style={{ color:C.muted }}>Tap card on terminal</p>}
          {tab==="athmovil" && <p className="text-center py-4 text-sm" style={{ color:C.muted }}>Customer will receive push notification</p>}
          <button onClick={onCharge}
            className="w-full h-14 rounded-xl font-black text-lg transition-colors"
            style={{ background:C.accent, color:"white" }}>
            ✓ Confirm Payment
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tickets Drawer ───────────────────────────────────────────────────────────
function TicketsDrawer({ onClose }: { onClose:()=>void }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex justify-end z-50" onClick={onClose}>
      <div className="h-full w-80 flex flex-col shadow-2xl" style={{ background:C.surface }} onClick={e=>e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor:C.border }}>
          <h2 className="font-black text-lg" style={{ color:C.text }}>Held Tickets (2)</h2>
          <button onClick={onClose} style={{ color:C.muted }}><X className="w-5 h-5"/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {[
            { code:"IT4A1B", name:"Maria", total:48.00, items:["Rice Bowl Chicken","Tacos Steak ×2"] },
            { code:"IT9X2C", name:"Walk-in",total:14.00, items:["Burrito Chicken"] },
          ].map(t=>(
            <div key={t.code} className="rounded-xl p-3" style={{ background:C.card, border:`1px solid ${C.border}` }}>
              <div className="flex justify-between mb-1">
                <span className="font-black text-sm" style={{ color:C.text }}>#{t.code}</span>
                <span className="font-bold text-sm" style={{ color:C.amber }}>{fmt(t.total)}</span>
              </div>
              <p className="text-xs font-semibold mb-1" style={{ color:C.muted }}>{t.name}</p>
              {t.items.map(i=><p key={i} className="text-xs" style={{ color:C.muted }}>{i}</p>)}
              <div className="flex gap-2 mt-3">
                <button className="flex-1 h-8 rounded-lg text-xs font-bold" style={{ background:C.amber, color:"#000" }}>Resume</button>
                <button className="flex-1 h-8 rounded-lg text-xs font-bold" style={{ background:"#14532d55", color:C.green, border:`1px solid ${C.green}44` }}>Charge</button>
                <button className="w-8 h-8 rounded-lg text-xs flex items-center justify-center" style={{ background:"#7f1d1d44", color:C.accent }}>×</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Status pill ─────────────────────────────────────────────────────────────
function StatusPill({ s }: { s:string }) {
  const map: Record<string,{bg:string;color:string;label:string}> = {
    completed:{ bg:"#14532d44", color:"#4ade80", label:"Completed" },
    preparing:{ bg:"#78350f44", color:"#fbbf24", label:"Cooking"   },
    ready:    { bg:"#1e3a5f44", color:"#60a5fa", label:"Ready"     },
    confirmed:{ bg:"#4c1d9544", color:"#c084fc", label:"Accepted"  },
  };
  const m = map[s] ?? { bg:"#1f293744", color:"#9ca3af", label:s };
  return (
    <span className="px-2.5 py-1 rounded-full text-[10px] font-black" style={{ background:m.bg, color:m.color }}>
      {m.label}
    </span>
  );
}

// ─── Sidebar nav item ─────────────────────────────────────────────────────────
function NavItem({ icon, label, active, badge, onClick }: { icon:React.ReactNode; label:string; active?:boolean; badge?:number; onClick?:()=>void }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative group"
      style={{ background:active?`${C.accent}22`:"transparent", color:active?C.accent:C.muted }}>
      {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full" style={{ background:C.accent }}/>}
      <span className={`transition-colors ${active?"":"group-hover:text-white"}`}>{icon}</span>
      <span className="text-xs font-semibold" style={{ color:active?C.text:C.muted }}>{label}</span>
      {badge!=null && badge>0 && (
        <span className="ml-auto text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{ background:C.accent, color:"white" }}>{badge}</span>
      )}
    </button>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export function DarkDashboard() {
  const [selectedCat, setSelectedCat] = useState(0);
  const [search, setSearch]           = useState("");
  const [cart, setCart]               = useState<CartItem[]>([
    { key:"a", id:10, name:"Rice Bowl Chicken", price:16, qty:1, mods:["Extra salsa"], note:"" },
    { key:"b", id:2,  name:"Tacos Steak",       price:16, qty:2, mods:[], note:"No onions" },
  ]);
  const [customerName, setCustomerName] = useState("Maria");
  const [customerPhone, setCustomerPhone] = useState("");
  const [discount, setDiscount]         = useState(0);
  const [orderNote, setOrderNote]       = useState("");
  const [payModal, setPayModal]         = useState(false);
  const [ticketsOpen, setTicketsOpen]   = useState(false);
  const [paidOrder, setPaidOrder]       = useState(false);
  const [shiftOpen, setShiftOpen]       = useState(true);
  const [incomingOrders]                = useState(1);
  const [ticketCount]                   = useState(2);
  const [mobileView, setMobileView]     = useState<"menu"|"cart">("menu");
  const [activeNav, setActiveNav]       = useState("pos");

  const filtered = MENU.filter(i=>
    (selectedCat===0||i.catId===selectedCat) &&
    (!search||i.name.toLowerCase().includes(search.toLowerCase()))
  );
  const popular = MENU.filter(i=>i.popular).slice(0,4);

  const addItem = (item:typeof MENU[0]) => {
    const ex = cart.find(c=>c.id===item.id&&c.mods.length===0&&c.note==="");
    if (ex) setCart(cart.map(c=>c.key===ex.key?{...c,qty:c.qty+1}:c));
    else setCart([...cart,{ key:uid(),id:item.id,name:item.name,price:item.price,qty:1,mods:[],note:"" }]);
    if (window.innerWidth<640) setMobileView("cart");
  };

  const changeQty=(key:string,d:number)=>setCart(cart.flatMap(c=>c.key!==key?[c]:(c.qty+d<1?[]:[{...c,qty:c.qty+d}])));
  const removeItem=(key:string)=>setCart(cart.filter(c=>c.key!==key));

  const subtotal = cart.reduce((s,c)=>s+c.price*c.qty,0);
  const total    = Math.max(0,subtotal-discount);

  if (paidOrder) return (
    <div className="w-full h-screen flex items-center justify-center" style={{ background:C.bg }}>
      <div className="text-center">
        <CheckCircle className="w-20 h-20 mx-auto mb-4" style={{ color:C.green }}/>
        <p className="text-2xl font-black" style={{ color:C.text }}>Payment Complete</p>
        <p className="text-sm mt-1" style={{ color:C.muted }}>Total charged: {fmt(total)}</p>
        <button onClick={()=>{ setCart([]); setCustomerName(""); setDiscount(0); setOrderNote(""); setPaidOrder(false); }}
          className="mt-6 px-8 py-3 rounded-xl font-black text-lg" style={{ background:C.accent, color:"white" }}>
          New Order
        </button>
      </div>
    </div>
  );

  return (
    <div className="w-full h-screen flex overflow-hidden" style={{ background:C.bg, fontFamily:"'Inter',sans-serif" }}>

      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
      <aside className="hidden sm:flex flex-col w-44 flex-shrink-0 border-r py-4 px-2 gap-1" style={{ background:C.surface, borderColor:C.border }}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-3 pb-4 mb-2 border-b" style={{ borderColor:C.border }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg font-black shadow-lg" style={{ background:C.accent }}>
            🌮
          </div>
          <div>
            <p className="text-xs font-black" style={{ color:C.text }}>Island</p>
            <p className="text-xs font-black" style={{ color:C.accent }}>Tacos</p>
          </div>
        </div>

        <NavItem icon={<LayoutGrid className="w-4 h-4"/>} label="Point of Sale" active={activeNav==="pos"} onClick={()=>setActiveNav("pos")}/>
        <NavItem icon={<Ticket className="w-4 h-4"/>} label="Held Tickets" badge={ticketCount} active={activeNav==="tickets"} onClick={()=>{ setTicketsOpen(true); }}/>
        <NavItem icon={<Receipt className="w-4 h-4"/>} label="Receipts" active={activeNav==="receipts"} onClick={()=>setActiveNav("receipts")}/>
        <NavItem icon={<Banknote className="w-4 h-4"/>} label="Cash Mgmt" active={activeNav==="cash"} onClick={()=>setActiveNav("cash")}/>
        <NavItem icon={<Ban className="w-4 h-4"/>} label="Sold Out" active={activeNav==="soldout"} onClick={()=>setActiveNav("soldout")}/>

        <div className="flex-1"/>

        {/* Shift status */}
        <button onClick={()=>setShiftOpen(!shiftOpen)}
          className="mx-1 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors"
          style={{ background:shiftOpen?"#14532d33":"#7f1d1d33", color:shiftOpen?C.green:C.accent, borderColor:shiftOpen?"#16a34a44":"#ef444444" }}>
          ⏱ {shiftOpen?"Shift Open":"No Shift"}
        </button>
        <NavItem icon={<Settings className="w-4 h-4"/>} label="Admin" onClick={()=>setActiveNav("admin")}/>
        <NavItem icon={<LogOut className="w-4 h-4"/>} label="Sign Out"/>
      </aside>

      {/* ── MAIN ─────────────────────────────────────────────────────────── */}
      <div className={`flex-col flex-1 min-w-0 overflow-hidden ${mobileView==="menu"?"flex":"hidden"} sm:flex`}>

        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 h-14 border-b flex-shrink-0" style={{ background:C.surface, borderColor:C.border }}>
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color:C.muted }}/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search items…"
              className="w-full rounded-xl pl-9 pr-4 py-2 text-sm outline-none"
              style={{ background:C.card, border:`1px solid ${C.border}`, color:C.text }}/>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Clock */}
            <div className="items-center gap-1 text-xs font-mono hidden lg:flex" style={{ color:C.muted }}>
              <Clock className="w-3.5 h-3.5"/>10:42 AM
            </div>

            {/* Incoming orders */}
            <button className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${incomingOrders>0?"animate-pulse":""}`}
              style={{ background:incomingOrders>0?`${C.accent}33`:C.card, color:incomingOrders>0?C.accent:C.muted, border:`1px solid ${incomingOrders>0?C.accent:C.border}` }}>
              <Bell className="w-3.5 h-3.5"/>
              <span className="hidden sm:inline">{incomingOrders>0?`${incomingOrders} Pending`:"Alerts On"}</span>
              {incomingOrders>0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center" style={{ background:C.accent, color:"white" }}>{incomingOrders}</span>}
            </button>

            {/* Reload */}
            <button className="p-2 rounded-lg transition-colors" style={{ background:C.card, color:C.muted, border:`1px solid ${C.border}` }}>
              <RefreshCw className="w-3.5 h-3.5"/>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

          {/* Categories */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color:C.muted }}>Categories</p>
            <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth:"none" }}>
              {CATS.map(cat=>(
                <button key={cat.id} onClick={()=>setSelectedCat(cat.id)}
                  className="flex flex-col items-center gap-1.5 flex-shrink-0 transition-all">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-all"
                    style={{
                      background:selectedCat===cat.id?`${cat.glow}33`:C.card,
                      border:`2px solid ${selectedCat===cat.id?cat.glow:C.border}`,
                      boxShadow:selectedCat===cat.id?`0 0 16px ${cat.glow}66`:"none",
                      transform:selectedCat===cat.id?"scale(1.1)":"scale(1)",
                    }}>
                    {cat.emoji}
                  </div>
                  <span className="text-[10px] font-semibold" style={{ color:selectedCat===cat.id?C.text:C.muted }}>
                    {cat.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Popular / Featured (shown when no search and All category) */}
          {selectedCat===0 && !search && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color:C.muted }}>Popular Items</p>
                <button className="text-xs font-semibold flex items-center gap-1" style={{ color:C.accent }}>View All <ChevronRight className="w-3.5 h-3.5"/></button>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {popular.map(item=>(
                  <button key={item.id} onClick={()=>addItem(item)}
                    className="rounded-2xl p-4 text-left relative overflow-hidden group transition-all active:scale-95"
                    style={{ background:C.card, border:`1px solid ${C.border}`, boxShadow:`0 4px 24px ${item.glow}11` }}>
                    {/* Glow blob */}
                    <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-20 blur-xl transition-opacity group-hover:opacity-40"
                      style={{ background:item.glow }}/>
                    <div className="text-5xl mb-3 relative z-10 drop-shadow-lg">{item.emoji}</div>
                    <p className="text-sm font-bold relative z-10" style={{ color:C.text }}>{item.name}</p>
                    <p className="text-xs mt-0.5 relative z-10" style={{ color:C.muted }}>Starting from</p>
                    <p className="text-lg font-black mt-1 relative z-10" style={{ color:C.amber }}>{fmt(item.price)}</p>
                    <div className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background:C.accent }}>
                      <Plus className="w-3.5 h-3.5 text-white"/>
                    </div>
                    {item.spicy && <span className="absolute top-3 left-3 text-[8px] font-black px-1.5 py-0.5 rounded-full" style={{ background:`${C.accent}33`, color:C.accent }}>🌶 SPICY</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Full menu grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color:C.muted }}>
                {selectedCat===0&&!search?"All Items":CATS.find(c=>c.id===selectedCat)?.name??("Search: "+search)}
              </p>
              <span className="text-[10px]" style={{ color:C.muted }}>{filtered.length} items</span>
            </div>
            <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {filtered.map(item=>(
                <button key={item.id} onClick={()=>addItem(item)}
                  className="rounded-xl p-3 text-left group relative overflow-hidden transition-all active:scale-95"
                  style={{ background:C.card, border:`1px solid ${C.border}` }}>
                  <div className="text-3xl mb-2">{item.emoji}</div>
                  <p className="text-[11px] font-semibold leading-tight truncate" style={{ color:C.text }}>{item.name}</p>
                  <p className="text-sm font-black mt-1" style={{ color:C.amber }}>{fmt(item.price)}</p>
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background:C.accent }}>
                    <Plus className="w-3 h-3 text-white"/>
                  </div>
                  {item.popular && <div className="absolute bottom-0 left-0 w-1 h-full rounded-l-xl" style={{ background:C.amber }}/>}
                  {item.veggie  && <div className="absolute bottom-0 left-0 w-1 h-full rounded-l-xl" style={{ background:"#22c55e" }}/>}
                </button>
              ))}
              {filtered.length===0 && (
                <div className="col-span-full flex items-center justify-center h-24 text-sm" style={{ color:C.muted }}>No items found</div>
              )}
            </div>
          </div>

          {/* Recent orders table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color:C.muted }}>Recent Orders</p>
              <button className="text-xs font-semibold flex items-center gap-1" style={{ color:C.accent }}>View All <ChevronRight className="w-3.5 h-3.5"/></button>
            </div>
            <div className="rounded-2xl overflow-hidden" style={{ background:C.card, border:`1px solid ${C.border}` }}>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                    {["Code","Customer","Items","Total","Method","Status"].map(h=>(
                      <th key={h} className="px-4 py-3 text-left font-bold uppercase tracking-wide" style={{ color:C.muted }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {RECENT.map((r,i)=>(
                    <tr key={r.code} style={{ borderBottom:i<RECENT.length-1?`1px solid ${C.border}`:"none" }}>
                      <td className="px-4 py-3 font-black font-mono" style={{ color:C.amber }}>#{r.code}</td>
                      <td className="px-4 py-3 font-semibold" style={{ color:C.text }}>{r.name}</td>
                      <td className="px-4 py-3 max-w-[160px] truncate" style={{ color:C.muted }}>{r.items}</td>
                      <td className="px-4 py-3 font-bold" style={{ color:C.text }}>{fmt(r.total)}</td>
                      <td className="px-4 py-3 font-semibold" style={{ color:C.muted }}>{r.method}</td>
                      <td className="px-4 py-3"><StatusPill s={r.status}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT: CART ──────────────────────────────────────────────────── */}
      <div className={`flex-col flex-shrink-0 w-full sm:w-80 xl:w-88 border-l ${mobileView==="cart"?"flex":"hidden"} sm:flex`}
        style={{ background:C.surface, borderColor:C.border }}>

        {/* Cart header */}
        <div className="px-4 py-3 border-b flex-shrink-0" style={{ borderColor:C.border }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-black text-sm" style={{ color:C.text }}>New Order</p>
              <p className="text-[10px]" style={{ color:C.muted }}>Order #{Math.floor(Math.random()*9000+1000)}</p>
            </div>
            {cart.length>0 && <button onClick={()=>{ setCart([]); setCustomerName(""); setDiscount(0); setOrderNote(""); }}
              className="text-xs font-semibold transition-colors" style={{ color:C.muted }}>Clear</button>}
          </div>
          {/* Customer */}
          <div className="space-y-1.5">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color:C.muted }}/>
              <input value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="Customer name"
                className="w-full rounded-lg pl-9 pr-3 py-2 text-xs outline-none"
                style={{ background:C.card, border:`1px solid ${C.border}`, color:C.text }}/>
            </div>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color:C.muted }}/>
              <input value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)} placeholder="Phone (optional)" type="tel"
                className="w-full rounded-lg pl-9 pr-3 py-2 text-xs outline-none"
                style={{ background:C.card, border:`1px solid ${C.border}`, color:C.text }}/>
            </div>
          </div>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
          {cart.length===0 ? (
            <div className="flex flex-col items-center justify-center h-32" style={{ color:C.muted }}>
              <span className="text-3xl mb-2">🌮</span>
              <span className="text-xs">Tap items to add</span>
            </div>
          ) : cart.map(item=>{
            const lineTotal=item.price*item.qty;
            return (
              <div key={item.key} className="rounded-xl p-3" style={{ background:C.card, border:`1px solid ${C.border}` }}>
                <div className="flex items-start gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color:C.text }}>{item.name}</p>
                    {item.mods.map((m,i)=><p key={i} className="text-[10px]" style={{ color:C.muted }}>+ {m}</p>)}
                    {item.note && <p className="text-[10px] italic" style={{ color:C.amber }}>{item.note}</p>}
                  </div>
                  <span className="text-sm font-black flex-shrink-0" style={{ color:C.amber }}>{fmt(lineTotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <button onClick={()=>changeQty(item.key,-1)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                      style={{ background:C.surface, color:C.accent }}>
                      <Minus className="w-3 h-3"/>
                    </button>
                    <span className="w-5 text-center text-sm font-black" style={{ color:C.text }}>{item.qty}</span>
                    <button onClick={()=>changeQty(item.key,1)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                      style={{ background:C.surface, color:C.green }}>
                      <Plus className="w-3 h-3"/>
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="text-[10px] font-semibold flex items-center gap-0.5" style={{ color:C.muted }}>
                      <StickyNote className="w-3 h-3"/> Note
                    </button>
                    <button onClick={()=>removeItem(item.key)} style={{ color:C.muted }}>
                      <X className="w-3.5 h-3.5"/>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Totals + actions */}
        {cart.length>0 && (
          <div className="border-t px-4 pt-3 pb-4 flex-shrink-0 space-y-3" style={{ borderColor:C.border }}>
            {/* Discount + Note */}
            <div className="flex gap-2">
              <button onClick={()=>setDiscount(d=>d>0?0:5)}
                className="flex-1 h-9 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                style={{ background:discount>0?`${C.green}22`:C.card, color:discount>0?C.green:C.muted, border:`1px solid ${discount>0?"#22c55e44":C.border}` }}>
                <Tag className="w-3.5 h-3.5"/>
                {discount>0?`-${fmt(discount)} off`:"Discount"}
              </button>
              <button onClick={()=>setOrderNote(n=>n?"":"No onions")}
                className="flex-1 h-9 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                style={{ background:orderNote?`#3b82f622`:C.card, color:orderNote?"#60a5fa":C.muted, border:`1px solid ${orderNote?"#3b82f644":C.border}` }}>
                <StickyNote className="w-3.5 h-3.5"/>
                {orderNote?"📝 Note":"Add Note"}
              </button>
            </div>

            {/* Promo code (reference image feature) */}
            <div className="flex gap-2">
              <input placeholder="Discount code" className="flex-1 rounded-xl px-3 py-2 text-xs outline-none"
                style={{ background:C.card, border:`1px solid ${C.border}`, color:C.text }}/>
              <button className="px-4 rounded-xl text-xs font-black" style={{ background:C.accent, color:"white" }}>Apply</button>
            </div>

            {/* Totals */}
            <div className="space-y-1.5 py-2 border-t" style={{ borderColor:C.border }}>
              <div className="flex justify-between text-xs" style={{ color:C.muted }}>
                <span>Sub Total</span><span>{fmt(subtotal)}</span>
              </div>
              {discount>0 && <div className="flex justify-between text-xs" style={{ color:C.green }}>
                <span>Discount</span><span>-{fmt(discount)}</span>
              </div>}
              <div className="flex justify-between font-black border-t pt-2 mt-1" style={{ borderColor:C.border }}>
                <span className="text-base" style={{ color:C.text }}>TOTAL</span>
                <span className="text-xl" style={{ color:C.amber }}>{fmt(total)}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button className="h-11 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-colors"
                  style={{ background:`${C.amber}22`, color:C.amber, border:`1px solid ${C.amber}44` }}>
                  <Ticket className="w-3.5 h-3.5"/> Hold
                </button>
                <button disabled={cart.length<2}
                  className="h-11 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
                  style={{ background:C.card, color:C.muted, border:`1px solid ${C.border}` }}>
                  <Scissors className="w-3.5 h-3.5"/> Split
                </button>
              </div>
              <button onClick={()=>setPayModal(true)}
                className="w-full h-14 rounded-xl font-black text-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                style={{ background:C.accent, color:"white", boxShadow:`0 4px 20px ${C.accent}55` }}>
                <Zap className="w-5 h-5"/> Charge {fmt(total)}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── MOBILE BOTTOM TABS ───────────────────────────────────────────── */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 flex border-t z-40" style={{ background:C.surface, borderColor:C.border }}>
        <button onClick={()=>setMobileView("menu")} className="flex-1 flex flex-col items-center py-2 gap-0.5"
          style={{ color:mobileView==="menu"?C.accent:C.muted }}>
          <LayoutGrid className="w-5 h-5"/><span className="text-[10px] font-semibold">Menu</span>
        </button>
        <button onClick={()=>setMobileView("cart")} className="flex-1 flex flex-col items-center py-2 gap-0.5 relative"
          style={{ color:mobileView==="cart"?C.accent:C.muted }}>
          <span className="text-xl">🛒</span><span className="text-[10px] font-semibold">Cart</span>
          {cart.length>0 && (
            <span className="absolute top-1 right-[calc(50%-14px)] text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center"
              style={{ background:C.accent, color:"white" }}>{cart.reduce((s,c)=>s+c.qty,0)}</span>
          )}
        </button>
      </div>

      {/* Modals */}
      {payModal && <PayModal total={total} onClose={()=>setPayModal(false)} onCharge={()=>{ setPayModal(false); setPaidOrder(true); }}/>}
      {ticketsOpen && <TicketsDrawer onClose={()=>setTicketsOpen(false)}/>}
    </div>
  );
}

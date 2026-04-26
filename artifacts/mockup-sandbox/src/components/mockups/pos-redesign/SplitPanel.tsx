import { useState } from "react";
import {
  LayoutDashboard, ShoppingBag, ArrowRight, Star, Trash2,
  Plus, Minus, ChevronLeft, ChevronRight, User, CreditCard,
  Banknote, Smartphone, X, CheckCircle
} from "lucide-react";

const CATEGORIES = [
  { id: "tacos",     label: "Tacos",      emoji: "🌮", color: "#f97316" },
  { id: "burritos",  label: "Burritos",   emoji: "🌯", color: "#dc2626" },
  { id: "bowls",     label: "Rice Bowls", emoji: "🍚", color: "#16a34a" },
  { id: "quesadillas", label: "Quesadillas", emoji: "🧀", color: "#ca8a04" },
  { id: "sides",     label: "Sides",      emoji: "🥗", color: "#7c3aed" },
  { id: "drinks",    label: "Drinks",     emoji: "🥤", color: "#0284c7" },
];

const MENU: Record<string, { name: string; price: number; bg: string; emoji: string }[]> = {
  tacos: [
    { name: "Tacos Chicken",  price: 14.00, bg: "#fef3c7", emoji: "🌮" },
    { name: "Tacos Steak",    price: 16.00, bg: "#fee2e2", emoji: "🌮" },
    { name: "Tacos Carnitas", price: 15.00, bg: "#fce7f3", emoji: "🌮" },
    { name: "Tacos Fish",     price: 16.00, bg: "#dbeafe", emoji: "🐟" },
    { name: "Tacos Shrimp",   price: 17.00, bg: "#d1fae5", emoji: "🍤" },
    { name: "Tacos Veggie",   price: 13.00, bg: "#dcfce7", emoji: "🥬" },
  ],
  burritos: [
    { name: "Burrito Chicken", price: 14.00, bg: "#fef3c7", emoji: "🌯" },
    { name: "Burrito Steak",   price: 16.00, bg: "#fee2e2", emoji: "🌯" },
    { name: "Burrito Fish",    price: 16.00, bg: "#dbeafe", emoji: "🌯" },
    { name: "Burrito Veggie",  price: 13.00, bg: "#dcfce7", emoji: "🌯" },
  ],
  bowls: [
    { name: "Rice Bowl Chicken", price: 16.00, bg: "#fef3c7", emoji: "🍗" },
    { name: "Rice Bowl Steak",   price: 18.00, bg: "#fee2e2", emoji: "🥩" },
    { name: "Rice Bowl Salmon",  price: 20.00, bg: "#dbeafe", emoji: "🐟" },
    { name: "Rice Bowl Shrimp",  price: 19.00, bg: "#d1fae5", emoji: "🍤" },
    { name: "Rice Bowl Veggie",  price: 15.00, bg: "#dcfce7", emoji: "🥗" },
  ],
  quesadillas: [
    { name: "Quesadilla Chicken", price: 14.00, bg: "#fef3c7", emoji: "🧀" },
    { name: "Quesadilla Steak",   price: 16.00, bg: "#fee2e2", emoji: "🧀" },
    { name: "Island Taco Burger", price: 14.00, bg: "#fce7f3", emoji: "🍔" },
  ],
  sides: [
    { name: "Chips & Guac",    price:  4.00, bg: "#dcfce7", emoji: "🥑" },
    { name: "Side Rice",       price:  3.00, bg: "#fef3c7", emoji: "🍚" },
    { name: "Side Beans",      price:  3.00, bg: "#fce7f3", emoji: "🫘" },
    { name: "Extra Salsa",     price:  2.00, bg: "#fee2e2", emoji: "🍅" },
  ],
  drinks: [
    { name: "Soda",   price: 2.00, bg: "#dbeafe", emoji: "🥤" },
    { name: "Water",  price: 1.00, bg: "#e0f2fe", emoji: "💧" },
    { name: "Juice",  price: 3.00, bg: "#fef3c7", emoji: "🍊" },
  ],
};

type CartItem = { name: string; price: number; qty: number };

export function SplitPanel() {
  const [activeTab, setActiveTab] = useState<"dash" | "togo" | "entry">("entry");
  const [activeCat, setActiveCat] = useState("tacos");
  const [cart, setCart] = useState<CartItem[]>([
    { name: "Rice Bowl Chicken", price: 16.00, qty: 1 },
    { name: "Tacos Steak",       price: 16.00, qty: 2 },
  ]);
  const [paid, setPaid] = useState(false);

  const addItem = (item: { name: string; price: number }) => {
    setCart(c => {
      const idx = c.findIndex(x => x.name === item.name);
      if (idx >= 0) {
        const next = [...c];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...c, { name: item.name, price: item.price, qty: 1 }];
    });
  };

  const changeQty = (name: string, delta: number) => {
    setCart(c =>
      c.flatMap(x => {
        if (x.name !== name) return [x];
        const qty = x.qty + delta;
        return qty <= 0 ? [] : [{ ...x, qty }];
      })
    );
  };

  const subtotal = cart.reduce((s, x) => s + x.price * x.qty, 0);
  const tax = subtotal * 0.0;
  const total = subtotal + tax;

  const items = MENU[activeCat] ?? [];

  if (paid) {
    return (
      <div className="w-full h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
          <p className="text-2xl font-bold text-gray-800">Order Complete!</p>
          <p className="text-gray-500 mt-1">Total charged: ${total.toFixed(2)}</p>
          <button
            onClick={() => { setCart([]); setPaid(false); }}
            className="mt-6 bg-red-600 text-white px-8 py-3 rounded-xl font-semibold"
          >
            New Order
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-gray-100 flex flex-col overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── Top Navigation Bar ─────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 flex items-center px-4 h-14 gap-3 shadow-sm flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2 mr-4">
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center">
            <span className="text-white text-xs font-black">IT</span>
          </div>
          <span className="font-black text-gray-900 text-sm tracking-tight hidden sm:block">Island Tacos</span>
        </div>

        {/* Staff name */}
        <div className="flex items-center gap-1.5 text-gray-500 text-xs mr-2">
          <User className="w-3.5 h-3.5" />
          <span>Maria G.</span>
        </div>

        {/* Nav tabs */}
        <div className="flex gap-1 flex-1">
          {[
            { id: "dash",  label: "DASH",   icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
            { id: "togo",  label: "TO GO",  icon: <ShoppingBag className="w-3.5 h-3.5" /> },
            { id: "entry", label: "ENTRY",  icon: <ArrowRight className="w-3.5 h-3.5" /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold tracking-wider transition-all ${
                activeTab === tab.id
                  ? "bg-red-600 text-white shadow-sm"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {/* Right icons */}
        <div className="flex items-center gap-2">
          <button className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <Star className="w-4 h-4" />
          </button>
          <div className="relative">
            <button className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <ShoppingBag className="w-4 h-4" />
            </button>
            {cart.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {cart.reduce((s, x) => s + x.qty, 0)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Body: split panel ──────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: Order Panel ──────────────────────────────────────── */}
        <div className="w-72 bg-white border-r border-gray-200 flex flex-col shadow-sm flex-shrink-0">
          {/* Order header */}
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-gray-800 text-sm">Current Order</span>
              <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">Pickup</span>
            </div>
            <div className="text-xs text-gray-400">Order #1042 · Maria G.</div>
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto px-3 py-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-2">
                <ShoppingBag className="w-10 h-10" />
                <span className="text-sm">No items yet</span>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.name} className="flex items-center gap-2 py-2.5 border-b border-gray-50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{item.name}</p>
                    <p className="text-xs text-gray-400">${item.price.toFixed(2)} each</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => changeQty(item.name, -1)}
                      className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-red-100 hover:text-red-600 transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-5 text-center text-xs font-bold text-gray-800">{item.qty}</span>
                    <button
                      onClick={() => changeQty(item.name, 1)}
                      className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-green-100 hover:text-green-600 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-xs font-bold text-gray-900 w-12 text-right">
                    ${(item.price * item.qty).toFixed(2)}
                  </span>
                  <button
                    onClick={() => changeQty(item.name, -item.qty)}
                    className="text-gray-300 hover:text-red-500 transition-colors ml-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Totals */}
          <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-1.5">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Subtotal</span>
              <span className="font-medium">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Tax</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-black text-gray-900 pt-1 border-t border-gray-200 text-sm">
              <span>TOTAL</span>
              <span className="text-red-600">${total.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment buttons */}
          <div className="px-3 pb-3 space-y-2">
            <div className="grid grid-cols-3 gap-1.5">
              <button className="flex flex-col items-center gap-1 p-2 bg-green-50 hover:bg-green-100 rounded-xl border border-green-200 transition-colors" onClick={() => cart.length > 0 && setPaid(true)}>
                <Banknote className="w-4 h-4 text-green-600" />
                <span className="text-[10px] font-semibold text-green-700">Cash</span>
              </button>
              <button className="flex flex-col items-center gap-1 p-2 bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 transition-colors" onClick={() => cart.length > 0 && setPaid(true)}>
                <CreditCard className="w-4 h-4 text-blue-600" />
                <span className="text-[10px] font-semibold text-blue-700">Card</span>
              </button>
              <button className="flex flex-col items-center gap-1 p-2 bg-purple-50 hover:bg-purple-100 rounded-xl border border-purple-200 transition-colors" onClick={() => cart.length > 0 && setPaid(true)}>
                <Smartphone className="w-4 h-4 text-purple-600" />
                <span className="text-[10px] font-semibold text-purple-700">ATH</span>
              </button>
            </div>
            <button
              onClick={() => setCart([])}
              className="w-full py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-50 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear Order
            </button>
          </div>
        </div>

        {/* ── RIGHT: Menu Panel ──────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Category tabs — horizontal scroll */}
          <div className="bg-white border-b border-gray-200 px-4 flex gap-2 overflow-x-auto flex-shrink-0 py-2" style={{ scrollbarWidth: "none" }}>
            <button className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCat(cat.id)}
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl flex-shrink-0 transition-all ${
                  activeCat === cat.id
                    ? "shadow-md scale-105"
                    : "hover:bg-gray-50"
                }`}
                style={activeCat === cat.id ? { background: cat.color, color: "white" } : {}}
              >
                <span className="text-xl leading-none">{cat.emoji}</span>
                <span className={`text-[10px] font-bold tracking-wide ${activeCat === cat.id ? "text-white" : "text-gray-600"}`}>
                  {cat.label.toUpperCase()}
                </span>
              </button>
            ))}
            <button className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Menu grid */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-3 gap-3">
              {items.map(item => (
                <button
                  key={item.name}
                  onClick={() => addItem(item)}
                  className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md active:scale-95 transition-all border border-gray-100 text-left group"
                >
                  {/* Photo tile */}
                  <div
                    className="w-full h-28 flex items-center justify-center relative"
                    style={{ background: item.bg }}
                  >
                    <span className="text-5xl select-none">{item.emoji}</span>
                    {/* quick-add badge */}
                    <div className="absolute top-2 right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus className="w-3.5 h-3.5 text-red-600" />
                    </div>
                  </div>
                  {/* Details */}
                  <div className="px-3 py-2">
                    <p className="text-xs font-semibold text-gray-800 leading-tight truncate">{item.name}</p>
                    <p className="text-sm font-black text-red-600 mt-0.5">${item.price.toFixed(2)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MetallicPOS() {
  const bg   = "#16172b";
  const card = "#1e1f38";
  const border = "rgba(255,255,255,0.06)";
  const tp  = "#e8eaf6";
  const tm  = "#7077a1";

  const categories = ["Tacos", "Burritos", "Potato Bowls", "Rice Bowl", "Quesadilla", "Nachos", "Salads", "Sides", "Drinks"];

  const itemsByCategory: Record<string, Array<{name:string;price:number;emoji:string;grad:string;glow:string}>> = {
    "Tacos": [
      { name: "Tacos Steak 🥩",    price: 16, emoji: "🥩", grad: "linear-gradient(145deg,#ff6b00,#c0392b)", glow: "rgba(255,107,0,0.5)" },
      { name: "Taco Salmon 🐟",    price: 20, emoji: "🐟", grad: "linear-gradient(145deg,#0ea5e9,#1e3a8a)", glow: "rgba(14,165,233,0.5)" },
      { name: "Taco Shrimp 🍤",    price: 18, emoji: "🍤", grad: "linear-gradient(145deg,#7c6af7,#3730a3)", glow: "rgba(124,106,247,0.5)" },
      { name: "Tacos Chicken 🍗",  price: 14, emoji: "🍗", grad: "linear-gradient(145deg,#f59e0b,#92400e)", glow: "rgba(245,158,11,0.5)" },
      { name: "Taco Veggie 🥗",    price: 12, emoji: "🥗", grad: "linear-gradient(145deg,#10b981,#064e3b)", glow: "rgba(16,185,129,0.5)" },
      { name: "Salmon Tacos",      price: 20, emoji: "🐟", grad: "linear-gradient(145deg,#06b6d4,#164e63)", glow: "rgba(6,182,212,0.5)" },
    ],
    "Burritos": [
      { name: "Burrito Steak 🥩",    price: 16, emoji: "🥩", grad: "linear-gradient(145deg,#ff6b00,#c0392b)", glow: "rgba(255,107,0,0.5)" },
      { name: "Burrito Salmon 🐟",   price: 20, emoji: "🐟", grad: "linear-gradient(145deg,#0ea5e9,#1e3a8a)", glow: "rgba(14,165,233,0.5)" },
      { name: "Burrito Shrimp 🍤",   price: 18, emoji: "🍤", grad: "linear-gradient(145deg,#7c6af7,#3730a3)", glow: "rgba(124,106,247,0.5)" },
      { name: "Burrito Chicken 🍗",  price: 14, emoji: "🍗", grad: "linear-gradient(145deg,#f59e0b,#92400e)", glow: "rgba(245,158,11,0.5)" },
      { name: "Burrito Veggie 🥗",   price: 12, emoji: "🥗", grad: "linear-gradient(145deg,#10b981,#064e3b)", glow: "rgba(16,185,129,0.5)" },
    ],
    "Potato Bowls": [
      { name: "Potato Bowl Steak 🥩",   price: 18, emoji: "🥩", grad: "linear-gradient(145deg,#ff6b00,#c0392b)", glow: "rgba(255,107,0,0.5)" },
      { name: "Potato Bowl Salmon 🐟",  price: 22, emoji: "🐟", grad: "linear-gradient(145deg,#0ea5e9,#1e3a8a)", glow: "rgba(14,165,233,0.5)" },
      { name: "Potato Bowl Shrimp 🍤",  price: 20, emoji: "🍤", grad: "linear-gradient(145deg,#7c6af7,#3730a3)", glow: "rgba(124,106,247,0.5)" },
      { name: "Potato Bowl Chicken 🍗", price: 16, emoji: "🍗", grad: "linear-gradient(145deg,#f59e0b,#92400e)", glow: "rgba(245,158,11,0.5)" },
      { name: "Potato Bowl Veggies 🥗", price: 14, emoji: "🥗", grad: "linear-gradient(145deg,#10b981,#064e3b)", glow: "rgba(16,185,129,0.5)" },
    ],
    "Sides": [
      { name: "Fries",        price: 5,  emoji: "🍟", grad: "linear-gradient(145deg,#fbbf24,#78350f)", glow: "rgba(251,191,36,0.5)" },
    ],
    "Drinks": [
      { name: "Jarritos 🥤",  price: 3,  emoji: "🥤", grad: "linear-gradient(145deg,#f43f5e,#9f1239)", glow: "rgba(244,63,94,0.5)" },
      { name: "Soda/Juice 🥤",price: 2,  emoji: "🧃", grad: "linear-gradient(145deg,#a78bfa,#5b21b6)", glow: "rgba(167,139,250,0.5)" },
      { name: "Water 💧",     price: 1,  emoji: "💧", grad: "linear-gradient(145deg,#38bdf8,#0c4a6e)", glow: "rgba(56,189,248,0.5)" },
    ],
    "Rice Bowl": [
      { name: "Rice Bowl Steak 🥩",   price: 18, emoji: "🥩", grad: "linear-gradient(145deg,#ff6b00,#c0392b)", glow: "rgba(255,107,0,0.5)" },
      { name: "Rice Bowl Salmon 🐟",  price: 22, emoji: "🐟", grad: "linear-gradient(145deg,#0ea5e9,#1e3a8a)", glow: "rgba(14,165,233,0.5)" },
      { name: "Rice Bowl Shrimp 🍤",  price: 20, emoji: "🍤", grad: "linear-gradient(145deg,#7c6af7,#3730a3)", glow: "rgba(124,106,247,0.5)" },
      { name: "Rice Bowl Chicken 🍗", price: 16, emoji: "🍗", grad: "linear-gradient(145deg,#f59e0b,#92400e)", glow: "rgba(245,158,11,0.5)" },
    ],
    "Quesadilla": [
      { name: "Quesadilla Steak 🥩",   price: 16, emoji: "🥩", grad: "linear-gradient(145deg,#ff6b00,#c0392b)", glow: "rgba(255,107,0,0.5)" },
      { name: "Quesadilla Salmon",      price: 20, emoji: "🐟", grad: "linear-gradient(145deg,#0ea5e9,#1e3a8a)", glow: "rgba(14,165,233,0.5)" },
      { name: "Quesadilla Shrimp 🍤",  price: 18, emoji: "🍤", grad: "linear-gradient(145deg,#7c6af7,#3730a3)", glow: "rgba(124,106,247,0.5)" },
      { name: "Quesadilla Chicken 🍗", price: 14, emoji: "🍗", grad: "linear-gradient(145deg,#f59e0b,#92400e)", glow: "rgba(245,158,11,0.5)" },
      { name: "Quesadilla Cheese",      price: 9.99, emoji: "🧀", grad: "linear-gradient(145deg,#fbbf24,#78350f)", glow: "rgba(251,191,36,0.5)" },
    ],
    "Nachos": [
      { name: "Nachos Steak",   price: 14, emoji: "🥩", grad: "linear-gradient(145deg,#ff6b00,#c0392b)", glow: "rgba(255,107,0,0.5)" },
      { name: "Nachos Chicken", price: 12, emoji: "🍗", grad: "linear-gradient(145deg,#f59e0b,#92400e)", glow: "rgba(245,158,11,0.5)" },
    ],
    "Salads": [
      { name: "Salad Steak 🥩",   price: 18, emoji: "🥩", grad: "linear-gradient(145deg,#ff6b00,#c0392b)", glow: "rgba(255,107,0,0.5)" },
      { name: "Salad Salmon 🐟",  price: 22, emoji: "🐟", grad: "linear-gradient(145deg,#0ea5e9,#1e3a8a)", glow: "rgba(14,165,233,0.5)" },
      { name: "Salad Shrimp 🍤",  price: 20, emoji: "🍤", grad: "linear-gradient(145deg,#7c6af7,#3730a3)", glow: "rgba(124,106,247,0.5)" },
      { name: "Salad Chicken 🍗", price: 16, emoji: "🍗", grad: "linear-gradient(145deg,#f59e0b,#92400e)", glow: "rgba(245,158,11,0.5)" },
      { name: "Salad Veggie 🥗",  price: 14, emoji: "🥗", grad: "linear-gradient(145deg,#10b981,#064e3b)", glow: "rgba(16,185,129,0.5)" },
    ],
  };

  const activeCat = "Tacos";
  const items = itemsByCategory[activeCat] || [];

  const cart = [
    { name: "Tacos Steak 🥩",   mods: "No cilantro", qty: 2, price: 32, grad: "linear-gradient(135deg,#ff6b00,#c0392b)" },
    { name: "Taco Salmon 🐟",   mods: "",             qty: 1, price: 20, grad: "linear-gradient(135deg,#0ea5e9,#1e3a8a)" },
    { name: "Potato Bowl Chicken 🍗", mods: "Extra fries", qty: 1, price: 16, grad: "linear-gradient(135deg,#f59e0b,#92400e)" },
    { name: "Water 💧",          mods: "",             qty: 2, price: 2,  grad: "linear-gradient(135deg,#38bdf8,#0c4a6e)" },
  ];

  const navItems = [
    { icon: "⊞", label: "POS",      active: true  },
    { icon: "🧾", label: "Orders",  active: false },
    { icon: "🎫", label: "Tickets", active: false },
    { icon: "📊", label: "Shift",   active: false },
    { icon: "⚙️", label: "Settings",active: false },
  ];

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: bg, color: tp, height: "100vh", display: "flex", overflow: "hidden", fontSize: 13 }}>

      {/* SIDEBAR — same bg, no separation */}
      <div style={{ width: 68, display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 0 14px", gap: 6, flexShrink: 0, background: "transparent", zIndex: 2 }}>
        <div style={{ width: 38, height: 38, borderRadius: 13, background: "linear-gradient(135deg,#ff6b00,#ff9500)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, marginBottom: 14, boxShadow: "0 0 0 1px rgba(255,107,0,0.3), 0 6px 20px rgba(255,107,0,0.45)" }}>🌮</div>
        {navItems.map((n) => (
          <div key={n.label} title={n.label} style={{ width: 46, height: 46, borderRadius: 14, background: n.active ? "rgba(255,107,0,0.15)" : "rgba(255,255,255,0.03)", border: n.active ? "1px solid rgba(255,107,0,0.4)" : `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, cursor: "pointer", boxShadow: n.active ? "0 0 16px rgba(255,107,0,0.25)" : "none" }}>
            <span style={{ filter: n.active ? "none" : "grayscale(1) opacity(0.4)" }}>{n.icon}</span>
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg,#7c6af7,#a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, boxShadow: "0 0 0 2px rgba(124,106,247,0.3), 0 4px 14px rgba(124,106,247,0.3)" }}>👤</div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Top bar */}
        <div style={{ height: 54, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", background: "transparent", flexShrink: 0 }}>
          <div>
            <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: "-0.03em" }}>Point of Sale</span>
            <span style={{ fontSize: 12, color: tm, marginLeft: 10 }}>Order <span style={{ color: "#ff6b00", fontWeight: 700 }}>#318</span></span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(48,209,88,0.1)", border: "1px solid rgba(48,209,88,0.25)", borderRadius: 10, padding: "5px 12px" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#30d158", boxShadow: "0 0 8px rgba(48,209,88,0.7)", display: "inline-block" }} />
              <span style={{ fontSize: 11, color: "#30d158", fontWeight: 700 }}>María · Shift Open · $200 float</span>
            </div>
            <button style={{ background: "rgba(255,69,58,0.1)", border: "1px solid rgba(255,69,58,0.2)", borderRadius: 10, padding: "6px 14px", fontSize: 11, color: "#ff453a", cursor: "pointer", fontWeight: 700 }}>End Shift</button>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* ITEM GRID */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 14px 14px 10px", gap: 10, overflow: "hidden" }}>
            {/* Category pills */}
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", flexShrink: 0 }}>
              {categories.map((cat, i) => (
                <button key={cat} style={{ background: cat === activeCat ? "linear-gradient(135deg,#ff6b00,#ff9500)" : card, color: cat === activeCat ? "#fff" : tm, border: cat === activeCat ? "none" : `1px solid ${border}`, borderRadius: 20, padding: "7px 16px", fontSize: 12, fontWeight: cat === activeCat ? 800 : 500, cursor: "pointer", boxShadow: cat === activeCat ? "0 3px 14px rgba(255,107,0,0.35)" : "none", whiteSpace: "nowrap" }}>{cat}</button>
              ))}
            </div>

            {/* Pop-out item grid */}
            <div style={{ flex: 1, overflowY: "auto", paddingTop: 36 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
                {items.map((item) => (
                  <div key={item.name} style={{ position: "relative", cursor: "pointer" }}>
                    {/* Pop-out emoji */}
                    <div style={{ position: "absolute", top: -30, left: "50%", transform: "translateX(-50%)", zIndex: 5, pointerEvents: "none", filter: `drop-shadow(0 6px 14px ${item.glow})` }}>
                      <span style={{ fontSize: 50, lineHeight: 1, display: "block" }}>{item.emoji}</span>
                    </div>
                    {/* Card */}
                    <div style={{ background: item.grad, borderRadius: 18, padding: "36px 12px 14px", position: "relative", overflow: "hidden", boxShadow: `0 6px 22px ${item.glow}`, textAlign: "center" }}>
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "linear-gradient(155deg, rgba(255,255,255,0.1) 0%, transparent 50%)", pointerEvents: "none" }} />
                      <div style={{ position: "absolute", top: -20, left: "50%", transform: "translateX(-50%)", width: 60, height: 60, background: "rgba(255,255,255,0.1)", borderRadius: "50%", filter: "blur(16px)", pointerEvents: "none" }} />
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", marginBottom: 6, lineHeight: 1.3 }}>{item.name}</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em" }}>${item.price}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick action row */}
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              {[
                ["💰 Pay In", "#7c6af7", "rgba(124,106,247,0.15)", "rgba(124,106,247,0.3)"],
                ["💸 Pay Out", "#ff453a", "rgba(255,69,58,0.12)", "rgba(255,69,58,0.25)"],
                ["🏷 Discount", "#ff6b00", "rgba(255,107,0,0.12)", "rgba(255,107,0,0.3)"],
                ["🎫 Hold", tm, card, border],
                ["🖨 Reprint", tm, card, border],
              ].map(([label, color, bg2, bdr]) => (
                <button key={String(label)} style={{ flex: 1, background: bg2 as string, border: `1px solid ${bdr}`, borderRadius: 12, padding: "9px 0", fontSize: 11, color: color as string, fontWeight: 800, cursor: "pointer" }}>{String(label)}</button>
              ))}
            </div>
          </div>

          {/* CART */}
          <div style={{ width: 300, display: "flex", flexDirection: "column", borderLeft: `1px solid ${border}`, background: "rgba(22,23,43,0.6)" }}>
            <div style={{ padding: "12px 16px 10px", borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: tm, letterSpacing: "0.06em", textTransform: "uppercase" }}>Current Order</span>
                <button style={{ fontSize: 10, color: "#ff453a", background: "rgba(255,69,58,0.1)", border: "1px solid rgba(255,69,58,0.2)", borderRadius: 7, padding: "2px 8px", cursor: "pointer", fontWeight: 700 }}>Clear</button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
              {cart.map((item) => (
                <div key={item.name} style={{ padding: "8px 16px", borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 8, background: item.grad, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>🍽</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: tp, letterSpacing: "-0.015em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
                      {item.mods && <div style={{ fontSize: 10, color: tm }}>{item.mods}</div>}
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingLeft: 34 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, background: card, border: `1px solid ${border}`, borderRadius: 8, padding: "2px 8px" }}>
                      <button style={{ background: "none", border: "none", color: tm, cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0 }}>−</button>
                      <span style={{ fontSize: 11, fontWeight: 800, color: tp, minWidth: 10, textAlign: "center" }}>{item.qty}</span>
                      <button style={{ background: "none", border: "none", color: tm, cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0 }}>+</button>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 900, color: tp }}>${item.price}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals + payment */}
            <div style={{ padding: "10px 16px", borderTop: `1px solid ${border}`, flexShrink: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 12, color: tm }}>Subtotal</span><span style={{ fontSize: 12, color: tm }}>$70.00</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: tm }}>Discount</span><span style={{ fontSize: 12, color: "#30d158", fontWeight: 600 }}>— $0.00</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: `1px solid ${border}`, marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: tm }}>Total</span>
                <span style={{ fontSize: 28, fontWeight: 900, color: tp, letterSpacing: "-0.05em" }}>$70.00</span>
              </div>
              <button style={{ width: "100%", background: "linear-gradient(135deg,#ff6b00,#ff9500)", color: "#fff", border: "none", borderRadius: 14, padding: "13px 0", fontSize: 14, fontWeight: 900, cursor: "pointer", marginBottom: 7, boxShadow: "0 5px 22px rgba(255,107,0,0.45)" }}>💵  Cash</button>
              <div style={{ display: "flex", gap: 7 }}>
                <button style={{ flex: 1, background: card, color: "#7c6af7", border: "1px solid rgba(124,106,247,0.3)", borderRadius: 11, padding: "10px 0", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>💳 Card</button>
                <button style={{ flex: 1, background: card, color: tm, border: `1px solid ${border}`, borderRadius: 11, padding: "10px 0", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>📱 ATH</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

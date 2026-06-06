export function MetallicPOS() {
  const categories = ["Tacos", "Burritos", "Bowls", "Drinks", "Sides", "Specials"];
  const items = [
    { name: "Carne Asada", price: 14, emoji: "🥩" }, { name: "Fish Tacos", price: 13, emoji: "🐟" },
    { name: "Al Pastor", price: 12, emoji: "🍍" }, { name: "Veggie Bowl", price: 11, emoji: "🥑" },
    { name: "Chicken Burrito", price: 13, emoji: "🌯" }, { name: "Beef Burrito", price: 14, emoji: "🌮" },
    { name: "Horchata", price: 4, emoji: "🥛" }, { name: "Jamaica", price: 4, emoji: "🍹" },
    { name: "Chips & Salsa", price: 5, emoji: "🫙" }, { name: "Guacamole", price: 4, emoji: "🥑" },
    { name: "Quesadilla", price: 10, emoji: "🧀" }, { name: "Kids Plate", price: 8, emoji: "⭐" },
  ];
  const cart = [
    { name: "Carne Asada Tacos", mods: "No onion", qty: 2, price: 28 },
    { name: "Fish Tacos", mods: "", qty: 1, price: 13 },
    { name: "Horchata", mods: "Extra ice", qty: 2, price: 8 },
    { name: "Chips & Salsa", mods: "", qty: 1, price: 5 },
  ];

  const bg = "#13142a";
  const surface = "#1a1b35";
  const surfaceHigh = "#20214080";
  const border = "rgba(255,255,255,0.06)";
  const textPrimary = "#e8eaf6";
  const textMuted = "#6b7094";
  const orange = "#ff6b00";
  const orangeGlow = "rgba(255,107,0,0.35)";
  const purpleAccent = "#7c6af7";
  const purpleGlow = "rgba(124,106,247,0.3)";

  return (
    <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", background: bg, color: textPrimary, height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* TOP BAR */}
      <div style={{ height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", background: `rgba(19,20,42,0.95)`, borderBottom: `1px solid ${border}`, backdropFilter: "blur(20px)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: `linear-gradient(135deg, ${orange}, #ff9500)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, boxShadow: `0 3px 12px ${orangeGlow}` }}>🌮</div>
          <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.03em" }}>Island Tacos <span style={{ color: textMuted, fontWeight: 400 }}>· POS</span></span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 12, color: textMuted }}>Staff: <span style={{ color: textPrimary, fontWeight: 700 }}>María</span></div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: surfaceHigh, border: `1px solid ${border}`, borderRadius: 10, padding: "6px 12px" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#30d158", boxShadow: "0 0 8px rgba(48,209,88,0.7)", display: "inline-block" }} />
            <span style={{ fontSize: 12, color: textMuted, fontWeight: 600 }}>Shift open · $200 float</span>
          </div>
          <button style={{ background: surfaceHigh, border: `1px solid ${border}`, borderRadius: 10, padding: "6px 14px", fontSize: 12, color: textMuted, cursor: "pointer", fontWeight: 600 }}>📋 Orders</button>
          <button style={{ background: "rgba(255,69,58,0.1)", border: "1px solid rgba(255,69,58,0.2)", borderRadius: 10, padding: "6px 14px", fontSize: 12, color: "#ff453a", cursor: "pointer", fontWeight: 600 }}>⬛ End Shift</button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* LEFT — GRID */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "14px 14px 14px 16px", gap: 12, overflow: "hidden" }}>
          {/* Category pills */}
          <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
            {categories.map((cat, i) => (
              <button key={cat} style={{ background: i === 0 ? `linear-gradient(135deg, ${orange}, #ff9500)` : surface, color: i === 0 ? "#fff" : textMuted, border: i === 0 ? "none" : `1px solid ${border}`, borderRadius: 20, padding: "8px 18px", fontSize: 13, fontWeight: i === 0 ? 700 : 500, cursor: "pointer", boxShadow: i === 0 ? `0 4px 14px ${orangeGlow}` : "none", whiteSpace: "nowrap" }}>{cat}</button>
            ))}
          </div>
          {/* Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, overflowY: "auto", flex: 1 }}>
            {items.map((item) => (
              <button key={item.name} style={{ background: surface, border: `1px solid ${border}`, borderRadius: 18, padding: "16px 10px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", position: "relative", overflow: "hidden", transition: "border-color 0.15s" }}>
                <div style={{ position: "absolute", top: 0, left: "15%", right: "15%", height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)" }} />
                <span style={{ fontSize: 26 }}>{item.emoji}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: textPrimary, letterSpacing: "-0.015em", textAlign: "center", lineHeight: 1.3 }}>{item.name}</span>
                <span style={{ fontSize: 15, fontWeight: 900, color: orange, letterSpacing: "-0.03em" }}>${item.price}</span>
              </button>
            ))}
          </div>
          {/* Quick actions */}
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {[["💰 Pay In", purpleAccent, purpleGlow], ["💸 Pay Out", "#ff453a", "rgba(255,69,58,0.25)"], ["🏷 Discount", orange, orangeGlow], ["🎫 Hold Ticket", "#6b7094", "transparent"], ["🖨 Reprint", "#6b7094", "transparent"]].map(([label, color, glow]) => (
              <button key={String(label)} style={{ flex: 1, background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: "10px 0", fontSize: 12, color: color as string, fontWeight: 700, cursor: "pointer", boxShadow: glow !== "transparent" ? `0 2px 10px ${glow}` : "none" }}>{String(label)}</button>
            ))}
          </div>
        </div>

        {/* RIGHT — CART */}
        <div style={{ width: 320, display: "flex", flexDirection: "column", borderLeft: `1px solid ${border}`, background: `rgba(19,20,42,0.8)` }}>
          {/* Header */}
          <div style={{ padding: "14px 18px 12px", borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: textMuted, letterSpacing: "0.06em", textTransform: "uppercase" }}>Current Order</span>
              <button style={{ fontSize: 11, color: "#ff453a", background: "rgba(255,69,58,0.1)", border: "1px solid rgba(255,69,58,0.2)", borderRadius: 8, padding: "3px 10px", cursor: "pointer", fontWeight: 700 }}>Clear</button>
            </div>
            <div style={{ fontSize: 12, color: textMuted, marginTop: 4 }}>
              Order <span style={{ color: orange, fontWeight: 700 }}>#251</span>  ·  Walk-in
            </div>
          </div>
          {/* Items */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
            {cart.map((item) => (
              <div key={item.name} style={{ padding: "10px 18px", borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: textPrimary, letterSpacing: "-0.02em" }}>{item.name}</div>
                    {item.mods && <div style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>{item.mods}</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, background: surface, border: `1px solid ${border}`, borderRadius: 8, padding: "3px 8px" }}>
                      <button style={{ background: "none", border: "none", color: textMuted, cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 }}>−</button>
                      <span style={{ fontSize: 12, fontWeight: 800, color: textPrimary, minWidth: 12, textAlign: "center" }}>{item.qty}</span>
                      <button style={{ background: "none", border: "none", color: textMuted, cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 }}>+</button>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 800, color: textPrimary, minWidth: 34, textAlign: "right" }}>${item.price}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Totals + payment */}
          <div style={{ padding: "12px 18px", borderTop: `1px solid ${border}`, flexShrink: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: textMuted }}>Subtotal</span>
              <span style={{ fontSize: 13, color: textMuted }}>$54.00</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: textMuted }}>Discount</span>
              <span style={{ fontSize: 13, color: "#30d158", fontWeight: 600 }}>− $5.00</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: `1px solid ${border}`, marginBottom: 14 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: textMuted }}>Total</span>
              <span style={{ fontSize: 30, fontWeight: 900, color: textPrimary, letterSpacing: "-0.05em" }}>$49.00</span>
            </div>
            <button style={{ width: "100%", background: `linear-gradient(135deg, ${orange}, #ff9500)`, color: "#fff", border: "none", borderRadius: 14, padding: "14px 0", fontSize: 15, fontWeight: 800, cursor: "pointer", marginBottom: 8, boxShadow: `0 6px 24px ${orangeGlow}`, letterSpacing: "-0.02em" }}>
              💵  Cash Payment
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ flex: 1, background: surface, color: purpleAccent, border: `1px solid rgba(124,106,247,0.3)`, borderRadius: 12, padding: "11px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: `0 2px 10px ${purpleGlow}` }}>💳 Card</button>
              <button style={{ flex: 1, background: surface, color: textMuted, border: `1px solid ${border}`, borderRadius: 12, padding: "11px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>📱 ATH</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

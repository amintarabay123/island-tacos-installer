export function MetallicPOS() {
  const categories = ["Tacos", "Burritos", "Bowls", "Drinks", "Sides", "Specials"];
  const items = [
    { name: "Carne Asada", price: 14 }, { name: "Fish Tacos", price: 13 },
    { name: "Al Pastor", price: 12 }, { name: "Veggie Bowl", price: 11 },
    { name: "Chicken Burrito", price: 13 }, { name: "Beef Burrito", price: 14 },
    { name: "Horchata", price: 4 }, { name: "Jamaica", price: 4 },
    { name: "Chips & Salsa", price: 5 }, { name: "Guacamole", price: 4 },
    { name: "Quesadilla", price: 10 }, { name: "Kids Plate", price: 8 },
  ];
  const cart = [
    { name: "Carne Asada Tacos", mods: "No onion", qty: 2, price: 28 },
    { name: "Fish Tacos", mods: "", qty: 1, price: 13 },
    { name: "Horchata", mods: "Extra ice", qty: 2, price: 8 },
    { name: "Chips & Salsa", mods: "", qty: 1, price: 5 },
  ];

  const metalBase = { background: "linear-gradient(160deg, #2a2a2e 0%, #222226 60%, #1e1e22 100%)", border: "1px solid rgba(255,255,255,0.07)" };
  const metalDeep = { background: "linear-gradient(160deg, #1e1e22 0%, #18181c 100%)", border: "1px solid rgba(255,255,255,0.05)" };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", background: "#101012", color: "#f2f2f7", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* TOP BAR */}
      <div style={{ height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", ...metalBase, borderLeft: "none", borderRight: "none", borderTop: "none", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #ff6600, #ff8c00)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🌮</div>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.025em" }}>Island Tacos  <span style={{ color: "#48484a", fontWeight: 400 }}>·  POS</span></span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 12, color: "#636366" }}>Shift: <span style={{ color: "#f2f2f7", fontWeight: 600 }}>María  ·  4h 12m</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, ...metalDeep, borderRadius: 8, padding: "5px 12px" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#30d158", boxShadow: "0 0 6px rgba(48,209,88,0.6)", display: "inline-block" }} />
            <span style={{ fontSize: 12, color: "#aeaeb2", fontWeight: 600 }}>Float: $200</span>
          </div>
          <button style={{ ...metalDeep, border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "#636366", cursor: "pointer" }}>⊞ Orders</button>
          <button style={{ ...metalDeep, border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "#636366", cursor: "pointer" }}>⬛ Close Shift</button>
        </div>
      </div>

      {/* MAIN LAYOUT */}
      <div style={{ flex: 1, display: "flex", gap: 0, overflow: "hidden" }}>

        {/* LEFT — ITEM GRID */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "14px 14px 14px 16px", gap: 12, overflow: "hidden" }}>
          {/* Category tabs */}
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {categories.map((cat, i) => (
              <button key={cat} style={{ background: i === 0 ? "linear-gradient(135deg, #ff6600, #ff8c00)" : "linear-gradient(160deg, #242428, #1e1e22)", color: i === 0 ? "#fff" : "#636366", border: i === 0 ? "none" : "1px solid rgba(255,255,255,0.06)", borderRadius: 9, padding: "8px 16px", fontSize: 13, fontWeight: i === 0 ? 700 : 500, cursor: "pointer", letterSpacing: "-0.01em", boxShadow: i === 0 ? "0 2px 10px rgba(255,102,0,0.3)" : "none", whiteSpace: "nowrap" }}>{cat}</button>
            ))}
          </div>
          {/* Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, overflowY: "auto", flex: 1 }}>
            {items.map((item) => (
              <button key={item.name} style={{ background: "linear-gradient(150deg, #26262a 0%, #1e1e22 100%)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "16px 12px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)" }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#e5e5ea", letterSpacing: "-0.015em", textAlign: "center", lineHeight: 1.3 }}>{item.name}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#ff8c00", letterSpacing: "-0.02em" }}>${item.price}</span>
              </button>
            ))}
          </div>
          {/* Quick actions */}
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {["Pay In", "Pay Out", "Discount", "Hold Ticket", "Reprint"].map((act) => (
              <button key={act} style={{ flex: 1, background: "linear-gradient(160deg, #242428, #1c1c20)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "9px 0", fontSize: 12, color: "#48484a", fontWeight: 600, cursor: "pointer", letterSpacing: "-0.01em" }}>{act}</button>
            ))}
          </div>
        </div>

        {/* RIGHT — CART */}
        <div style={{ width: 320, display: "flex", flexDirection: "column", borderLeft: "1px solid rgba(255,255,255,0.05)", background: "linear-gradient(180deg, #18181c 0%, #141416 100%)" }}>
          {/* Cart header */}
          <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#aeaeb2", letterSpacing: "0.04em", textTransform: "uppercase" }}>Current Order</span>
              <button style={{ fontSize: 11, color: "#ff453a", background: "rgba(255,69,58,0.1)", border: "1px solid rgba(255,69,58,0.2)", borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontWeight: 600 }}>Clear</button>
            </div>
            <div style={{ fontSize: 11, color: "#3a3a3c", marginTop: 3 }}>Order #251  ·  Walk-in</div>
          </div>
          {/* Items */}
          <div style={{ flex: 1, overflowY: "auto", padding: "10px 0" }}>
            {cart.map((item) => (
              <div key={item.name} style={{ padding: "10px 18px", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e5e5ea", letterSpacing: "-0.015em" }}>{item.name}</div>
                    {item.mods && <div style={{ fontSize: 11, color: "#48484a", marginTop: 2 }}>{item.mods}</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.05)", borderRadius: 6, padding: "3px 6px" }}>
                      <button style={{ background: "none", border: "none", color: "#636366", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 }}>−</button>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#aeaeb2", minWidth: 12, textAlign: "center" }}>{item.qty}</span>
                      <button style={{ background: "none", border: "none", color: "#636366", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 }}>+</button>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#f2f2f7", minWidth: 36, textAlign: "right" }}>${item.price}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Totals */}
          <div style={{ padding: "12px 18px", borderTop: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: "#48484a" }}>Subtotal</span>
              <span style={{ fontSize: 13, color: "#8e8e93" }}>$54.00</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: "#48484a" }}>Discount</span>
              <span style={{ fontSize: 13, color: "#30d158" }}>— $5.00</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)", marginBottom: 14 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#aeaeb2" }}>Total</span>
              <span style={{ fontSize: 26, fontWeight: 800, color: "#f2f2f7", letterSpacing: "-0.04em" }}>$49.00</span>
            </div>
            {/* Payment buttons */}
            <button style={{ width: "100%", background: "linear-gradient(135deg, #ff6600, #ff8c00)", color: "#fff", border: "none", borderRadius: 11, padding: "14px 0", fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 8, boxShadow: "0 3px 16px rgba(255,102,0,0.35)", letterSpacing: "-0.02em" }}>
              💵  Cash
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ flex: 1, background: "linear-gradient(160deg, #242428, #1e1e22)", color: "#8e8e93", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "11px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>💳  Card</button>
              <button style={{ flex: 1, background: "linear-gradient(160deg, #242428, #1e1e22)", color: "#8e8e93", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "11px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>📱  ATH</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

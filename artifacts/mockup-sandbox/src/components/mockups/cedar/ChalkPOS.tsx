export function ChalkPOS() {
  const BG      = "#0c0805";
  const SURFACE = "#171009";
  const SIDEBAR = "#100c06";
  const BORDER  = "#4a3020";
  const CHALK   = "#F5ECD7";
  const MUTED   = "#9e8570";
  const ACCENT  = "#C8A882";
  const HUNTER  = "#2d6a4f";
  const HUNTER_LT = "#3d8f6a";
  const GREEN   = "#7cba7a";
  const RED     = "#d4614a";

  const categories = ["Coffees", "Teas", "Pastries", "Sandwiches", "Cold", "Specials"];

  const items = [
    { name: "Flat White",    price: 5.50, emoji: "☕" },
    { name: "Cedar Latte",   price: 6.00, emoji: "🌿" },
    { name: "Cortado",       price: 5.00, emoji: "☕" },
    { name: "Pour Over",     price: 5.50, emoji: "✨" },
    { name: "Espresso",      price: 3.50, emoji: "⚡" },
    { name: "Cappuccino",    price: 5.00, emoji: "☁️" },
    { name: "Cold Brew",     price: 5.00, emoji: "🧊" },
    { name: "Tonic Espresso",price: 6.50, emoji: "🍋" },
    { name: "Americano",     price: 4.00, emoji: "🖤" },
    { name: "Macchiato",     price: 4.50, emoji: "☕" },
    { name: "Oat Latte",     price: 6.00, emoji: "🥛" },
    { name: "Iced Latte",    price: 6.50, emoji: "🧊" },
  ];

  const cart = [
    { name: "Cedar Latte", price: 6.00, qty: 1 },
    { name: "Flat White",  price: 5.50, qty: 2 },
    { name: "Croissant",   price: 3.50, qty: 1 },
  ];
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

  const cardShadow = "0 8px 28px rgba(0,0,0,0.85), 0 2px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 0 24px rgba(200,168,130,0.03)";

  return (
    <div style={{ fontFamily: "'Lato', sans-serif", background: BG, color: CHALK, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=Lato:wght@300;400;700&display=swap');
        .item-btn { transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.15s !important; cursor: pointer; }
        .item-btn:hover { transform: translateY(-3px) scale(1.03) !important; background: linear-gradient(145deg, #382618, #281a0e) !important; }
        .pay-btn { transition: transform 0.18s, box-shadow 0.18s; cursor: pointer; }
        .pay-btn:hover { transform: translateY(-2px); }
      `}</style>

      {/* Top bar */}
      <header style={{
        background: `linear-gradient(135deg, ${SIDEBAR} 0%, #1a1108 100%)`,
        borderBottom: `1px solid ${BORDER}`,
        padding: "10px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 4px 20px rgba(0,0,0,0.7)",
      }}>
        <img src="/__mockup/cedar-logo-bold-transparent.png" alt="Cedar Cafe"
          style={{ height: 64, width: "auto" }} />
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ fontSize: 12, color: MUTED }}>Shift: 07:00 – 15:00</div>
          <div style={{
            background: HUNTER + "30", border: `1px solid ${HUNTER}`, color: HUNTER_LT,
            borderRadius: 20, padding: "4px 12px", fontSize: 11, letterSpacing: 1,
            boxShadow: `0 0 12px rgba(45,106,79,0.3)`,
          }}>● OPEN</div>
          <div style={{
            background: "linear-gradient(135deg, #2a1c12, #1e1208)",
            border: `1px solid ${BORDER}`, borderRadius: 20,
            padding: "5px 14px", fontSize: 12, color: MUTED, cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
          }}>Barista: Maria</div>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left: Categories + Items */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Category tabs */}
          <div style={{ background: SURFACE, borderBottom: `1px solid ${BORDER}`, padding: "0 16px", display: "flex", gap: 0, boxShadow: "0 2px 10px rgba(0,0,0,0.4)" }}>
            {categories.map((c, i) => (
              <button key={c} style={{
                background: "transparent", border: "none",
                borderBottom: i === 0 ? `2px solid ${ACCENT}` : "2px solid transparent",
                color: i === 0 ? ACCENT : MUTED,
                padding: "12px 16px", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer",
              }}>{c}</button>
            ))}
          </div>

          {/* Item grid */}
          <div style={{ flex: 1, overflow: "auto", padding: 14, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, alignContent: "start" }}>
            {items.map((item, idx) => (
              <div key={item.name} className="item-btn" style={{
                background: "linear-gradient(145deg, #2a1c12, #1e1108)",
                border: `1px solid ${BORDER}`,
                borderRadius: 10,
                padding: "14px 12px",
                display: "flex", flexDirection: "column", gap: 6,
                textAlign: "center",
                position: "relative",
                boxShadow: cardShadow,
              }}>
                <div style={{ position: "absolute", top: 0, left: "15%", right: "15%", height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)" }} />
                <div style={{ fontSize: 24, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))" }}>{item.emoji}</div>
                <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 12, color: CHALK, lineHeight: 1.3 }}>{item.name}</div>
                <div style={{ fontSize: 14, color: ACCENT, fontWeight: 700, textShadow: "0 0 10px rgba(200,168,130,0.4)" }}>${item.price.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Cart */}
        <div style={{
          width: 280,
          background: `linear-gradient(180deg, ${SIDEBAR} 0%, #0e0905 100%)`,
          borderLeft: `1px solid ${BORDER}`,
          display: "flex", flexDirection: "column",
          boxShadow: "-6px 0 30px rgba(0,0,0,0.6)",
        }}>
          {/* Order header */}
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${BORDER}`, background: "linear-gradient(135deg, #1e1409, #150f06)" }}>
            <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 16, fontStyle: "italic", color: CHALK, textShadow: "0 1px 6px rgba(200,168,130,0.2)" }}>
              Current Order
            </div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>CC-0043 · Walk-in</div>
          </div>

          {/* Cart items */}
          <div style={{ flex: 1, overflow: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
            {cart.map(item => (
              <div key={item.name} style={{
                background: "linear-gradient(135deg, #271a0e, #1c1208)",
                border: `1px solid ${BORDER}`,
                borderRadius: 8,
                padding: "10px 12px",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                boxShadow: "0 4px 14px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
                position: "relative",
              }}>
                <div style={{ position: "absolute", top: 0, left: "10%", right: "10%", height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }} />
                <div>
                  <div style={{ fontSize: 13, color: CHALK }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: MUTED }}>× {item.qty}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, color: ACCENT, textShadow: "0 0 8px rgba(200,168,130,0.4)" }}>${(item.price * item.qty).toFixed(2)}</span>
                  <span style={{ color: RED, fontSize: 13, cursor: "pointer" }}>✕</span>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div style={{ borderTop: `1px dashed ${BORDER}`, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: MUTED }}>Subtotal</span>
              <span style={{ fontSize: 12, color: CHALK }}>${subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 16, color: CHALK }}>Total</span>
              <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, color: ACCENT, textShadow: "0 0 14px rgba(200,168,130,0.5)" }}>${subtotal.toFixed(2)}</span>
            </div>

            {/* Payment buttons */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <button className="pay-btn" style={{
                background: "linear-gradient(135deg, #2e2010, #1e1408)",
                border: `1px solid ${ACCENT}`,
                color: ACCENT, borderRadius: 8, padding: "10px 0", fontSize: 12, fontWeight: 700,
                boxShadow: `0 4px 16px rgba(0,0,0,0.5), 0 0 10px rgba(200,168,130,0.15), inset 0 1px 0 rgba(255,255,255,0.06)`,
              }}>💵 Cash</button>
              <button className="pay-btn" style={{
                background: "linear-gradient(135deg, #1e1810, #15120a)",
                border: `1px solid ${BORDER}`, color: CHALK, borderRadius: 8, padding: "10px 0", fontSize: 12,
                boxShadow: "0 4px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
              }}>💳 Card</button>
            </div>
            <button className="pay-btn" style={{
              width: "100%",
              background: `linear-gradient(135deg, ${HUNTER} 0%, #1f4d38 100%)`,
              border: `1px solid ${HUNTER_LT}`,
              color: "#d4f5e2", borderRadius: 8, padding: "10px 0", fontSize: 12, fontWeight: 700,
              boxShadow: `0 6px 20px rgba(45,106,79,0.45), inset 0 1px 0 rgba(255,255,255,0.1)`,
              letterSpacing: 0.5,
            }}>ATH Móvil</button>
          </div>

          {/* Action buttons */}
          <div style={{ borderTop: `1px solid ${BORDER}`, padding: "10px 16px", display: "flex", gap: 8 }}>
            <button style={{ flex: 1, background: "transparent", border: `1px solid ${BORDER}`, color: MUTED, borderRadius: 6, padding: "8px 0", fontSize: 11, cursor: "pointer" }}>Hold</button>
            <button style={{ flex: 1, background: RED + "20", border: `1px solid ${RED}`, color: RED, borderRadius: 6, padding: "8px 0", fontSize: 11, cursor: "pointer" }}>Void</button>
          </div>
        </div>
      </div>
    </div>
  );
}

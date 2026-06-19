export function ChalkStore() {
  const BG      = "#0f0a06";
  const SURFACE = "#1a1109";
  const CARD    = "linear-gradient(145deg, #2a1c12 0%, #1c1108 100%)";
  const CARDBG  = "#221610";
  const BORDER  = "#4a3020";
  const CHALK   = "#F5ECD7";
  const MUTED   = "#9e8570";
  const ACCENT  = "#C8A882";
  const ACCENT2 = "#a07850";
  const HUNTER  = "#2d6a4f";
  const HUNTER_LT = "#3d8f6a";

  const categories = ["All", "Coffees", "Teas & Matcha", "Pastries", "Sandwiches", "Bowls", "Cold Drinks"];
  const active = 1;

  const items = [
    { name: "Flat White",      desc: "Double ristretto, silky steamed whole milk",     price: 5.50, tag: "Popular",    emoji: "☕", glow: ACCENT },
    { name: "Cedar Latte",     desc: "House blend espresso, oat milk, vanilla bean",   price: 6.00, tag: "Signature",  emoji: "🌿", glow: HUNTER_LT },
    { name: "Cortado",         desc: "Equal parts espresso and warm micro-foam",       price: 5.00, tag: "",           emoji: "☕", glow: ACCENT },
    { name: "Pour Over",       desc: "Single origin, slow brewed to order",            price: 5.50, tag: "Chef's Pick",emoji: "✨", glow: ACCENT },
    { name: "Espresso Tonic",  desc: "Double shot over tonic, lemon zest",             price: 6.50, tag: "New",        emoji: "🍋", glow: HUNTER_LT },
    { name: "Cold Brew",       desc: "18-hour steeped, smooth & bold",                price: 5.00, tag: "",           emoji: "🧊", glow: ACCENT },
    { name: "Cappuccino",      desc: "Classic dry cap with house roast",               price: 5.00, tag: "",           emoji: "☕", glow: ACCENT },
    { name: "Matcha Latte",    desc: "Ceremonial grade matcha, oat milk",             price: 6.00, tag: "",           emoji: "🍵", glow: HUNTER_LT },
  ];

  const cardShadow = (glowCol: string) =>
    `0 10px 36px rgba(0,0,0,0.85), 0 3px 10px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 0 32px rgba(200,168,130,0.04), 0 0 0 1px rgba(255,255,255,0.02)`;

  const cardHoverShadow = (glowCol: string) =>
    `0 18px 48px rgba(0,0,0,0.9), 0 6px 18px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.09), inset 0 0 40px rgba(200,168,130,0.07), 0 0 16px rgba(200,168,130,0.12)`;

  return (
    <div style={{ fontFamily: "'Georgia', serif", background: BG, color: CHALK, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Lato:wght@300;400;700&display=swap');
        .chalk-font { font-family: 'Playfair Display', Georgia, serif !important; }
        .body-font  { font-family: 'Lato', system-ui, sans-serif !important; }
        .item-card  { transition: transform 0.22s ease, box-shadow 0.22s ease !important; }
        .item-card:hover { transform: translateY(-4px) scale(1.01) !important; }
        .add-btn:hover { background: ${ACCENT} !important; color: ${BG} !important; transform: scale(1.03); }
        .cat-btn-active { border-bottom: 2px solid ${ACCENT} !important; color: ${ACCENT} !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${BORDER}; border-radius: 2px; }
      `}</style>

      {/* Header */}
      <header style={{
        background: `linear-gradient(135deg, #1a1008 0%, #221510 100%)`,
        borderBottom: `1px solid ${BORDER}`,
        padding: "14px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 4px 24px rgba(0,0,0,0.7)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <img src="/__mockup/cedar-logo-bold-transparent.png" alt="Cedar Cafe"
            style={{ height: 80, width: "auto" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }} className="body-font">
          <div style={{ fontSize: 12, color: MUTED, letterSpacing: 0.5 }}>Road Town, Tortola · Pickup Only</div>
          <div style={{
            background: "linear-gradient(135deg, #2a1c12, #1e1208)",
            border: `1px solid ${BORDER}`,
            borderRadius: 40,
            padding: "8px 18px",
            display: "flex", alignItems: "center", gap: 8,
            fontSize: 14, cursor: "pointer",
            boxShadow: "0 4px 14px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)",
          }}>
            <span>🛒</span>
            <span style={{ color: ACCENT }}>2 items</span>
          </div>
        </div>
      </header>

      {/* Hero strip */}
      <div style={{
        background: `linear-gradient(135deg, #1c1008 0%, #2a1a0c 40%, #1c1008 100%)`,
        padding: "26px 32px",
        borderBottom: `1px solid ${BORDER}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        boxShadow: "inset 0 -1px 0 rgba(200,168,130,0.1)",
      }}>
        <div>
          <div className="chalk-font" style={{ fontSize: 28, fontStyle: "italic", color: CHALK, marginBottom: 6, textShadow: "0 2px 12px rgba(200,168,130,0.3)" }}>
            Good morning, welcome in
          </div>
          <div className="body-font" style={{ fontSize: 12, color: MUTED, letterSpacing: 2, textTransform: "uppercase" }}>
            Premium Quality · Made to Order
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="body-font" style={{ fontSize: 11, color: MUTED, letterSpacing: 1 }}>TODAY'S HOURS</div>
          <div className="body-font" style={{ fontSize: 14, color: ACCENT, marginTop: 2 }}>7:00 AM – 6:00 PM</div>
          <div style={{ marginTop: 6, display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <div style={{ background: HUNTER + "30", border: `1px solid ${HUNTER}`, color: HUNTER_LT, borderRadius: 20, padding: "3px 10px", fontSize: 11, letterSpacing: 0.5 }}>● Open</div>
          </div>
        </div>
      </div>

      {/* Category tabs */}
      <div style={{ background: SURFACE, borderBottom: `1px solid ${BORDER}`, padding: "0 32px", display: "flex", gap: 0, overflowX: "auto", boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
        {categories.map((c, i) => (
          <button key={c} className={`body-font${i === active ? " cat-btn-active" : ""}`} style={{
            background: "transparent",
            border: "none",
            borderBottom: i === active ? `2px solid ${ACCENT}` : "2px solid transparent",
            color: i === active ? ACCENT : MUTED,
            padding: "14px 20px",
            fontSize: 12, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap",
          }}>{c}</button>
        ))}
      </div>

      {/* Main content */}
      <div style={{ display: "flex", flex: 1, gap: 0 }}>
        {/* Item grid */}
        <div style={{ flex: 1, padding: "28px 32px" }}>
          <div style={{ marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 className="chalk-font" style={{ fontSize: 22, fontStyle: "italic", color: CHALK, margin: 0, textShadow: "0 2px 10px rgba(200,168,130,0.2)" }}>Coffees</h2>
            <div className="body-font" style={{ fontSize: 12, color: MUTED }}>8 items</div>
          </div>
          <div style={{ borderBottom: `1px dashed ${BORDER}`, marginBottom: 24 }} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {items.map((item) => (
              <div key={item.name} className="item-card" style={{
                background: CARD,
                border: `1px solid ${BORDER}`,
                borderRadius: 10,
                padding: "18px 20px",
                display: "flex", flexDirection: "column", gap: 10,
                cursor: "pointer",
                position: "relative",
                boxShadow: cardShadow(item.glow),
              }}>
                {/* Top-edge highlight */}
                <div style={{ position: "absolute", top: 0, left: "10%", right: "10%", height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)", borderRadius: 1 }} />

                {item.tag && (
                  <div className="body-font" style={{
                    position: "absolute", top: 12, right: 12,
                    fontSize: 9, letterSpacing: 1, textTransform: "uppercase",
                    color: item.glow === HUNTER_LT ? HUNTER_LT : BG,
                    background: item.glow === HUNTER_LT ? HUNTER + "40" : ACCENT,
                    border: item.glow === HUNTER_LT ? `1px solid ${HUNTER}` : "none",
                    padding: "2px 8px", borderRadius: 20, fontWeight: 700,
                  }}>{item.tag}</div>
                )}

                <div style={{ fontSize: 30, filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.5))" }}>{item.emoji}</div>
                <div>
                  <div className="chalk-font" style={{ fontSize: 16, color: CHALK, marginBottom: 4, textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>{item.name}</div>
                  <div className="body-font" style={{ fontSize: 11, color: MUTED, lineHeight: 1.5 }}>{item.desc}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                  <div className="chalk-font" style={{ fontSize: 20, color: ACCENT, textShadow: "0 0 12px rgba(200,168,130,0.4)" }}>${item.price.toFixed(2)}</div>
                  <button className="add-btn body-font" style={{
                    background: "transparent",
                    border: `1px solid ${ACCENT2}`,
                    color: ACCENT,
                    borderRadius: 20,
                    padding: "6px 16px",
                    fontSize: 11, cursor: "pointer",
                    transition: "all 0.2s",
                    letterSpacing: 0.5,
                  }}>Add to Order</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cart sidebar */}
        <div style={{
          width: 300,
          background: `linear-gradient(180deg, #1a1108 0%, #160f07 100%)`,
          borderLeft: `1px solid ${BORDER}`,
          padding: 24, display: "flex", flexDirection: "column", gap: 16,
          boxShadow: "-4px 0 24px rgba(0,0,0,0.5)",
        }}>
          <div className="chalk-font" style={{ fontSize: 18, fontStyle: "italic", color: CHALK, paddingBottom: 12, borderBottom: `1px dashed ${BORDER}`, textShadow: "0 2px 8px rgba(200,168,130,0.2)" }}>
            Your Order
          </div>

          {[{ name: "Cedar Latte", price: 6.00, mod: "Oat milk" }, { name: "Flat White", price: 5.50, mod: "" }].map(item => (
            <div key={item.name} style={{
              display: "flex", justifyContent: "space-between", alignItems: "flex-start",
              padding: "10px 12px",
              background: "linear-gradient(135deg, #2a1c12, #1e1208)",
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              boxShadow: "0 4px 14px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}>
              <div>
                <div className="body-font" style={{ fontSize: 13, color: CHALK }}>{item.name}</div>
                {item.mod && <div className="body-font" style={{ fontSize: 11, color: MUTED }}>{item.mod}</div>}
              </div>
              <div className="body-font" style={{ fontSize: 14, color: ACCENT }}>${item.price.toFixed(2)}</div>
            </div>
          ))}

          <div style={{ borderTop: `1px dashed ${BORDER}`, paddingTop: 14, marginTop: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <span className="chalk-font" style={{ fontSize: 16, color: CHALK }}>Total</span>
              <span className="chalk-font" style={{ fontSize: 20, color: ACCENT, textShadow: "0 0 14px rgba(200,168,130,0.4)" }}>$11.50</span>
            </div>
            <button className="body-font" style={{
              width: "100%",
              background: `linear-gradient(135deg, ${HUNTER} 0%, #1f4d38 100%)`,
              color: "#d4f5e2",
              border: `1px solid ${HUNTER_LT}`,
              borderRadius: 6, padding: "12px 0", fontSize: 12, fontWeight: 700, cursor: "pointer",
              letterSpacing: 1.5, textTransform: "uppercase",
              boxShadow: `0 6px 20px rgba(45,106,79,0.5), inset 0 1px 0 rgba(255,255,255,0.1)`,
            }}>Checkout</button>
          </div>

          <div style={{ marginTop: "auto", borderTop: `1px dashed ${BORDER}`, paddingTop: 16 }}>
            <div className="body-font" style={{ fontSize: 11, color: MUTED, textAlign: "center", lineHeight: 1.7 }}>
              🌿 All drinks made fresh to order<br />
              Pickup only · Road Town, BVI
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

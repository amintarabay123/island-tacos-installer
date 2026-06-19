export function ChalkStore() {
  const BG      = "#140d08";
  const SURFACE = "#1f1410";
  const CARD    = "#2a1c14";
  const BORDER  = "#3d2a1e";
  const CHALK   = "#F5ECD7";
  const MUTED   = "#9e8570";
  const ACCENT  = "#C8A882";
  const ACCENT2 = "#a07850";

  const categories = ["All", "Coffees", "Teas & Matcha", "Pastries", "Sandwiches", "Bowls", "Cold Drinks"];
  const active = 1;

  const items = [
    { name: "Flat White", desc: "Double ristretto, silky steamed whole milk", price: 5.50, tag: "Popular", emoji: "☕" },
    { name: "Cedar Latte", desc: "House blend espresso, oat milk, vanilla bean", price: 6.00, tag: "Signature", emoji: "🌿" },
    { name: "Cortado", desc: "Equal parts espresso and warm micro-foam", price: 5.00, tag: "", emoji: "☕" },
    { name: "Pour Over", desc: "Single origin, slow brewed to order", price: 5.50, tag: "Chef's Pick", emoji: "✨" },
    { name: "Espresso Tonic", desc: "Double shot over tonic, lemon zest", price: 6.50, tag: "New", emoji: "🍋" },
    { name: "Cold Brew", desc: "18-hour steeped, smooth & bold", price: 5.00, tag: "", emoji: "🧊" },
    { name: "Cappuccino", desc: "Classic dry cap with house roast", price: 5.00, tag: "", emoji: "☕" },
    { name: "Matcha Latte", desc: "Ceremonial grade matcha, oat milk", price: 6.00, tag: "", emoji: "🍵" },
  ];

  return (
    <div style={{ fontFamily: "'Georgia', 'Times New Roman', serif", background: BG, color: CHALK, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Google Font injection */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Lato:wght@300;400;700&display=swap');
        .chalk-font { font-family: 'Playfair Display', Georgia, serif !important; }
        .body-font  { font-family: 'Lato', system-ui, sans-serif !important; }
        .dashed-border { border: 1.5px dashed ${BORDER}; }
        .item-card:hover { background: #32221a !important; }
        .cat-btn { cursor: pointer; }
        .add-btn:hover { background: ${ACCENT} !important; color: ${BG} !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: ${SURFACE}; }
        ::-webkit-scrollbar-thumb { background: ${BORDER}; border-radius: 2px; }
      `}</style>

      {/* Header */}
      <header style={{ background: SURFACE, borderBottom: `1px solid ${BORDER}`, padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img src="/__mockup/cedar-logo-dark.jpg" alt="Cedar Cafe" style={{ height: 52, objectFit: "contain", borderRadius: 4 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }} className="body-font">
          <div style={{ fontSize: 13, color: MUTED }}>Road Town, Tortola · Pickup Only</div>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 40, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
            <span>🛒</span>
            <span style={{ color: ACCENT }}>2 items</span>
          </div>
        </div>
      </header>

      {/* Hero strip */}
      <div style={{ background: `linear-gradient(135deg, #1f1108 0%, #2d1a0e 50%, #1f1108 100%)`, padding: "28px 32px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="chalk-font" style={{ fontSize: 28, fontStyle: "italic", color: CHALK, marginBottom: 6 }}>Good morning, welcome in</div>
          <div className="body-font" style={{ fontSize: 13, color: MUTED, letterSpacing: 2, textTransform: "uppercase" }}>Premium Quality · Made to Order</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="body-font" style={{ fontSize: 12, color: MUTED, letterSpacing: 1 }}>TODAY'S HOURS</div>
          <div className="body-font" style={{ fontSize: 14, color: ACCENT, marginTop: 2 }}>7:00 AM – 6:00 PM</div>
        </div>
      </div>

      {/* Category tabs */}
      <div style={{ background: SURFACE, borderBottom: `1px solid ${BORDER}`, padding: "0 32px", display: "flex", gap: 0, overflowX: "auto" }}>
        {categories.map((c, i) => (
          <button key={c} className="cat-btn body-font" style={{
            background: "transparent",
            border: "none",
            borderBottom: i === active ? `2px solid ${ACCENT}` : "2px solid transparent",
            color: i === active ? ACCENT : MUTED,
            padding: "14px 20px",
            fontSize: 13,
            letterSpacing: 1,
            textTransform: "uppercase",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}>{c}</button>
        ))}
      </div>

      {/* Main content */}
      <div style={{ display: "flex", flex: 1, gap: 0 }}>
        {/* Item grid */}
        <div style={{ flex: 1, padding: "28px 32px" }}>
          <div style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 className="chalk-font" style={{ fontSize: 22, fontStyle: "italic", color: CHALK, margin: 0 }}>Coffees</h2>
            <div className="body-font" style={{ fontSize: 12, color: MUTED }}>8 items</div>
          </div>

          {/* Chalk divider */}
          <div style={{ borderBottom: `1px dashed ${BORDER}`, marginBottom: 24 }} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {items.map((item) => (
              <div key={item.name} className="item-card" style={{
                background: CARD,
                border: `1px solid ${BORDER}`,
                borderRadius: 8,
                padding: "18px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                transition: "background 0.2s",
                cursor: "pointer",
                position: "relative",
              }}>
                {item.tag && (
                  <div className="body-font" style={{ position: "absolute", top: 12, right: 12, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: BG, background: ACCENT, padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>
                    {item.tag}
                  </div>
                )}
                <div style={{ fontSize: 28 }}>{item.emoji}</div>
                <div>
                  <div className="chalk-font" style={{ fontSize: 17, color: CHALK, marginBottom: 4 }}>{item.name}</div>
                  <div className="body-font" style={{ fontSize: 12, color: MUTED, lineHeight: 1.5 }}>{item.desc}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                  <div className="chalk-font" style={{ fontSize: 20, color: ACCENT }}>${item.price.toFixed(2)}</div>
                  <button className="add-btn body-font" style={{
                    background: "transparent",
                    border: `1px solid ${ACCENT2}`,
                    color: ACCENT,
                    borderRadius: 20,
                    padding: "6px 16px",
                    fontSize: 12,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    letterSpacing: 0.5,
                  }}>Add to Order</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cart sidebar */}
        <div style={{ width: 300, background: SURFACE, borderLeft: `1px solid ${BORDER}`, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="chalk-font" style={{ fontSize: 18, fontStyle: "italic", color: CHALK, paddingBottom: 12, borderBottom: `1px dashed ${BORDER}` }}>Your Order</div>

          {[{ name: "Cedar Latte", price: 6.00, mod: "Oat milk" }, { name: "Flat White", price: 5.50, mod: "" }].map(item => (
            <div key={item.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div className="body-font" style={{ fontSize: 14, color: CHALK }}>{item.name}</div>
                {item.mod && <div className="body-font" style={{ fontSize: 11, color: MUTED }}>{item.mod}</div>}
              </div>
              <div className="body-font" style={{ fontSize: 14, color: ACCENT }}>${item.price.toFixed(2)}</div>
            </div>
          ))}

          <div style={{ borderTop: `1px dashed ${BORDER}`, paddingTop: 12, marginTop: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <span className="chalk-font" style={{ fontSize: 16, color: CHALK }}>Total</span>
              <span className="chalk-font" style={{ fontSize: 18, color: ACCENT }}>$11.50</span>
            </div>
            <button className="body-font" style={{ width: "100%", background: ACCENT, color: BG, border: "none", borderRadius: 6, padding: "12px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", letterSpacing: 1, textTransform: "uppercase" }}>
              Checkout
            </button>
          </div>

          <div style={{ marginTop: "auto", borderTop: `1px dashed ${BORDER}`, paddingTop: 16 }}>
            <div className="body-font" style={{ fontSize: 11, color: MUTED, textAlign: "center", lineHeight: 1.6 }}>
              🌿 All drinks made fresh to order<br />
              Pickup only · Road Town, BVI
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

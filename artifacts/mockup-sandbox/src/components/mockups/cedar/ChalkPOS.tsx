export function ChalkPOS() {
  const BG      = "#0f0b07";
  const SURFACE = "#1a1208";
  const CARD    = "#231810";
  const SIDEBAR = "#160f08";
  const BORDER  = "#382818";
  const CHALK   = "#F5ECD7";
  const MUTED   = "#9e8570";
  const ACCENT  = "#C8A882";
  const GREEN   = "#7cba7a";
  const RED     = "#d4614a";

  const categories = ["Coffees", "Teas", "Pastries", "Sandwiches", "Cold", "Specials"];
  const activecat = 0;

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

  return (
    <div style={{ fontFamily: "'Lato', sans-serif", background: BG, color: CHALK, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=Lato:wght@300;400;700&display=swap');`}</style>

      {/* Top bar */}
      <header style={{ background: SIDEBAR, borderBottom: `1px solid ${BORDER}`, padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <img src="/__mockup/cedar-logo-dark.jpg" alt="Cedar Cafe" style={{ height: 38, objectFit: "contain", borderRadius: 4 }} />
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ fontSize: 12, color: MUTED }}>Shift: 07:00 – 15:00</div>
          <div style={{ background: GREEN + "22", border: `1px solid ${GREEN}`, color: GREEN, borderRadius: 20, padding: "3px 12px", fontSize: 11, letterSpacing: 1 }}>● OPEN</div>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 20, padding: "5px 14px", fontSize: 12, color: MUTED, cursor: "pointer" }}>Barista: Maria</div>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left: Categories + Items */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Category tabs */}
          <div style={{ background: SURFACE, borderBottom: `1px solid ${BORDER}`, padding: "0 16px", display: "flex", gap: 0 }}>
            {categories.map((c, i) => (
              <button key={c} style={{
                background: "transparent",
                border: "none",
                borderBottom: i === activecat ? `2px solid ${ACCENT}` : "2px solid transparent",
                color: i === activecat ? ACCENT : MUTED,
                padding: "12px 16px",
                fontSize: 12,
                letterSpacing: 1,
                textTransform: "uppercase",
                cursor: "pointer",
              }}>{c}</button>
            ))}
          </div>

          {/* Item grid */}
          <div style={{ flex: 1, overflow: "auto", padding: 16, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, alignContent: "start" }}>
            {items.map(item => (
              <div key={item.name} style={{
                background: CARD,
                border: `1px solid ${BORDER}`,
                borderRadius: 8,
                padding: "14px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                cursor: "pointer",
                textAlign: "center",
              }}>
                <div style={{ fontSize: 26 }}>{item.emoji}</div>
                <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 13, color: CHALK, lineHeight: 1.3 }}>{item.name}</div>
                <div style={{ fontSize: 14, color: ACCENT, fontWeight: 700 }}>${item.price.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Cart */}
        <div style={{ width: 280, background: SIDEBAR, borderLeft: `1px solid ${BORDER}`, display: "flex", flexDirection: "column" }}>
          {/* Order header */}
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 16, fontStyle: "italic", color: CHALK }}>Current Order</div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>CC-0043 · Walk-in</div>
          </div>

          {/* Cart items */}
          <div style={{ flex: 1, overflow: "auto", padding: "12px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
            {cart.map(item => (
              <div key={item.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, color: CHALK }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: MUTED }}>× {item.qty}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, color: ACCENT }}>${(item.price * item.qty).toFixed(2)}</span>
                  <span style={{ color: RED, fontSize: 14, cursor: "pointer" }}>✕</span>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div style={{ borderTop: `1px dashed ${BORDER}`, padding: "14px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: MUTED }}>Subtotal</span>
              <span style={{ fontSize: 12, color: CHALK }}>${subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 16, color: CHALK }}>Total</span>
              <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 18, color: ACCENT }}>${subtotal.toFixed(2)}</span>
            </div>

            {/* Payment buttons */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <button style={{ background: ACCENT + "22", border: `1px solid ${ACCENT}`, color: ACCENT, borderRadius: 6, padding: "10px 0", fontSize: 12, fontWeight: 700, cursor: "pointer", letterSpacing: 0.5 }}>💵 Cash</button>
              <button style={{ background: CARD, border: `1px solid ${BORDER}`, color: CHALK, borderRadius: 6, padding: "10px 0", fontSize: 12, cursor: "pointer" }}>💳 Card</button>
            </div>
            <button style={{ width: "100%", background: GREEN + "22", border: `1px solid ${GREEN}`, color: GREEN, borderRadius: 6, padding: "10px 0", fontSize: 12, fontWeight: 700, cursor: "pointer", letterSpacing: 0.5 }}>ATH Móvil</button>
          </div>

          {/* Action buttons */}
          <div style={{ borderTop: `1px solid ${BORDER}`, padding: "10px 18px", display: "flex", gap: 8 }}>
            <button style={{ flex: 1, background: "transparent", border: `1px solid ${BORDER}`, color: MUTED, borderRadius: 6, padding: "8px 0", fontSize: 11, cursor: "pointer" }}>Hold</button>
            <button style={{ flex: 1, background: RED + "22", border: `1px solid ${RED}`, color: RED, borderRadius: 6, padding: "8px 0", fontSize: 11, cursor: "pointer" }}>Void</button>
          </div>
        </div>
      </div>
    </div>
  );
}

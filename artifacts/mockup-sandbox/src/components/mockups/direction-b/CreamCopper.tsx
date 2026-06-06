export function CreamCopper() {
  const menuItems = [
    { name: "Carne Asada Tacos", desc: "Grilled steak, pico de gallo, cilantro", price: 14, tag: "Popular" },
    { name: "Fish Tacos", desc: "Crispy mahi-mahi, cabbage slaw, chipotle aioli", price: 13, tag: "Chef's Pick" },
    { name: "Al Pastor", desc: "Marinated pork, pineapple, white onion", price: 12, tag: "" },
    { name: "Veggie Bowl", desc: "Black beans, roasted corn, guacamole", price: 11, tag: "Vegan" },
  ];

  const posItems = [
    { name: "Carne Asada", qty: 2, price: 28 },
    { name: "Fish Tacos", qty: 1, price: 13 },
    { name: "Horchata", qty: 2, price: 8 },
  ];

  const kdsOrders = [
    { id: "247", items: ["Carne Asada ×2", "Horchata ×1"], time: "2m", status: "preparing" },
    { id: "248", items: ["Fish Tacos ×1", "Veggie Bowl ×1"], time: "4m", status: "new" },
    { id: "249", items: ["Al Pastor ×3"], time: "7m", status: "ready" },
  ];

  return (
    <div style={{ fontFamily: "'Georgia', 'Times New Roman', serif", background: "#faf7f2", color: "#1a1008", minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* ── TOP NAV ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 40px", height: 68, borderBottom: "1px solid #e8e0d4", background: "#faf7f2" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#b5451b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🌮</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em", color: "#1a1008", lineHeight: 1.1 }}>Island Tacos</div>
            <div style={{ fontSize: 11, color: "#9a8a78", letterSpacing: "0.06em", textTransform: "uppercase" }}>Wickhams Cay · BVI</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 32, fontSize: 14, color: "#9a8a78", fontFamily: "system-ui, sans-serif" }}>
          <span style={{ color: "#1a1008", borderBottom: "2px solid #b5451b", paddingBottom: 2 }}>Menu</span>
          <span>Story</span>
          <span>Track Order</span>
        </div>
        <button style={{ background: "#b5451b", color: "#fff", border: "none", borderRadius: 6, padding: "10px 22px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "system-ui, sans-serif", letterSpacing: "0.01em" }}>
          Cart · $49
        </button>
      </div>

      {/* ── HERO ── */}
      <div style={{ padding: "56px 40px 44px", background: "linear-gradient(180deg, #faf7f2 0%, #f5ede0 100%)", textAlign: "center", borderBottom: "1px solid #e8e0d4" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #e8e0d4", borderRadius: 20, padding: "6px 16px", marginBottom: 24, fontFamily: "system-ui, sans-serif" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
          <span style={{ fontSize: 12, color: "#6b5a4a", fontWeight: 600, letterSpacing: "0.04em" }}>OPEN · CLOSES 9 PM</span>
        </div>
        <h1 style={{ fontSize: 52, fontWeight: 400, letterSpacing: "-0.02em", lineHeight: 1.1, margin: "0 0 12px", color: "#1a1008" }}>
          <em>Handcrafted</em> Tacos<br />
          <span style={{ color: "#b5451b" }}>From the Heart of BVI</span>
        </h1>
        <p style={{ fontSize: 15, color: "#9a8a78", margin: "0 0 36px", fontFamily: "system-ui, sans-serif", fontWeight: 400, lineHeight: 1.6 }}>
          Fresh ingredients. Made to order. Ready for pickup.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button style={{ background: "#b5451b", color: "#fff", border: "none", borderRadius: 6, padding: "14px 36px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "system-ui, sans-serif", letterSpacing: "0.02em" }}>
            Order Now →
          </button>
          <button style={{ background: "transparent", color: "#9a8a78", border: "1px solid #ddd5c8", borderRadius: 6, padding: "14px 24px", fontSize: 15, cursor: "pointer", fontFamily: "system-ui, sans-serif" }}>
            See Full Menu
          </button>
        </div>
      </div>

      {/* ── MENU GRID ── */}
      <div style={{ padding: "32px 40px", flex: 1 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 24, fontFamily: "system-ui, sans-serif" }}>
          {["All", "Tacos", "Bowls", "Drinks", "Sides"].map((cat, i) => (
            <button key={cat} style={{ background: i === 0 ? "#b5451b" : "#fff", color: i === 0 ? "#fff" : "#9a8a78", border: "1px solid " + (i === 0 ? "#b5451b" : "#e0d8ce"), borderRadius: 6, padding: "8px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{cat}</button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          {menuItems.map((item) => (
            <div key={item.name} style={{ background: "#fff", border: "1px solid #ede6dc", borderRadius: 12, padding: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start", cursor: "pointer" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: "#1a1008" }}>{item.name}</span>
                  {item.tag && <span style={{ fontSize: 10, fontWeight: 600, background: "#fdf0e8", color: "#b5451b", border: "1px solid #f0d4c0", borderRadius: 4, padding: "2px 6px", letterSpacing: "0.04em", fontFamily: "system-ui, sans-serif" }}>{item.tag}</span>}
                </div>
                <p style={{ fontSize: 13, color: "#9a8a78", margin: "0 0 14px", lineHeight: 1.5, fontFamily: "system-ui, sans-serif" }}>{item.desc}</p>
                <span style={{ fontSize: 18, fontWeight: 700, color: "#1a1008", fontFamily: "system-ui, sans-serif" }}>${item.price}</span>
              </div>
              <button style={{ background: "#b5451b", border: "none", borderRadius: 6, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#fff", cursor: "pointer", marginLeft: 16, flexShrink: 0, fontFamily: "system-ui, sans-serif" }}>+</button>
            </div>
          ))}
        </div>
      </div>

      {/* ── DIVIDER ── */}
      <div style={{ height: 1, background: "#e8e0d4", margin: "0 40px" }} />
      <div style={{ padding: "8px 40px", fontSize: 11, color: "#c0b0a0", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, fontFamily: "system-ui, sans-serif" }}>POS · STAFF VIEW</div>
      <div style={{ height: 1, background: "#e8e0d4", margin: "0 40px 16px" }} />

      {/* ── POS + KDS STRIP ── */}
      <div style={{ display: "flex", gap: 16, padding: "0 40px 20px", height: 185, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ flex: 1, background: "#fff", border: "1px solid #ede6dc", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, color: "#c0b0a0", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 4 }}>CURRENT ORDER</div>
          {posItems.map(item => (
            <div key={item.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#4a3828" }}>{item.name}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, color: "#c0b0a0" }}>×{item.qty}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1008" }}>${item.price}</span>
              </div>
            </div>
          ))}
          <div style={{ marginTop: "auto", paddingTop: 8, borderTop: "1px solid #ede6dc", display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#9a8a78" }}>Total</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: "#b5451b" }}>$49.00</span>
          </div>
        </div>
        <div style={{ width: 100, display: "flex", flexDirection: "column", gap: 8 }}>
          <button style={{ flex: 1, background: "#b5451b", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cash</button>
          <button style={{ flex: 1, background: "#fff", border: "1px solid #ede6dc", borderRadius: 8, color: "#9a8a78", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Card</button>
          <button style={{ flex: 1, background: "#fff", border: "1px solid #ede6dc", borderRadius: 8, color: "#9a8a78", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>ATH</button>
        </div>
        <div style={{ flex: 1.2, background: "#fff", border: "1px solid #ede6dc", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 11, color: "#c0b0a0", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 8 }}>KDS · LIVE ORDERS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {kdsOrders.map(o => (
              <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", background: "#faf7f2", borderRadius: 8, border: "1px solid " + (o.status === "new" ? "#f0d4c0" : o.status === "ready" ? "#d4f0dc" : "#ede6dc") }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: o.status === "new" ? "#b5451b" : o.status === "ready" ? "#16a34a" : "#9a8a78", width: 28 }}>#{o.id}</span>
                <span style={{ fontSize: 12, color: "#6b5a4a", flex: 1 }}>{o.items[0]}</span>
                <span style={{ fontSize: 11, color: "#c0b0a0" }}>{o.time}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: o.status === "new" ? "#b5451b" : o.status === "ready" ? "#16a34a" : "#9a8a78", textTransform: "uppercase", letterSpacing: "0.06em" }}>{o.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

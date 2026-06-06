export function Obsidian() {
  const menuItems = [
    { name: "Carne Asada Tacos", desc: "Grilled steak, pico, cilantro", price: 14, tag: "Popular" },
    { name: "Fish Tacos", desc: "Crispy mahi, slaw, chipotle aioli", price: 13, tag: "Chef's Pick" },
    { name: "Al Pastor", desc: "Marinated pork, pineapple, onion", price: 12, tag: "" },
    { name: "Veggie Bowl", desc: "Black beans, roasted corn, avocado", price: 11, tag: "Vegan" },
  ];

  const posItems = [
    { name: "Carne Asada", qty: 2, price: 28 },
    { name: "Fish Tacos", qty: 1, price: 13 },
    { name: "Horchata", qty: 2, price: 8 },
  ];

  const kdsOrders = [
    { id: "247", items: ["Carne Asada x2", "Horchata x1"], time: "2m", status: "preparing" },
    { id: "248", items: ["Fish Tacos x1", "Veggie Bowl x1"], time: "4m", status: "new" },
    { id: "249", items: ["Al Pastor x3"], time: "7m", status: "ready" },
  ];

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#0a0a0a", color: "#f5f5f5", minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* ── TOP NAV ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 40px", height: 64, borderBottom: "1px solid #1a1a1a", background: "#0a0a0a" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #e85d04, #f48c06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🌮</div>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em", color: "#fff" }}>Island Tacos</span>
        </div>
        <div style={{ display: "flex", gap: 32, fontSize: 14, color: "#666" }}>
          <span style={{ color: "#fff" }}>Menu</span>
          <span>About</span>
          <span>Track Order</span>
        </div>
        <button style={{ background: "#e85d04", color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          Cart (3) · $49
        </button>
      </div>

      {/* ── HERO ── */}
      <div style={{ background: "linear-gradient(180deg, #111 0%, #0a0a0a 100%)", padding: "60px 40px 48px", textAlign: "center" }}>
        <div style={{ display: "inline-block", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 20, padding: "6px 14px", fontSize: 12, color: "#e85d04", fontWeight: 600, letterSpacing: "0.08em", marginBottom: 20 }}>
          OPEN NOW · CLOSES AT 9 PM
        </div>
        <h1 style={{ fontSize: 56, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1, margin: "0 0 16px", background: "linear-gradient(135deg, #fff 40%, #888)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Authentic Tacos<br />Made Fresh Daily
        </h1>
        <p style={{ fontSize: 16, color: "#666", margin: "0 0 32px", fontWeight: 400 }}>
          Wickhams Cay 1 · Road Town, BVI · Pickup only
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button style={{ background: "#e85d04", color: "#fff", border: "none", borderRadius: 10, padding: "14px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            Order Now
          </button>
          <button style={{ background: "transparent", color: "#888", border: "1px solid #2a2a2a", borderRadius: 10, padding: "14px 24px", fontSize: 15, fontWeight: 500, cursor: "pointer" }}>
            View Menu
          </button>
        </div>
      </div>

      {/* ── MENU GRID ── */}
      <div style={{ padding: "0 40px 40px", flex: 1 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 24, overflowX: "auto" }}>
          {["All", "Tacos", "Bowls", "Drinks", "Sides"].map((cat, i) => (
            <button key={cat} style={{ background: i === 0 ? "#e85d04" : "#141414", color: i === 0 ? "#fff" : "#888", border: "1px solid " + (i === 0 ? "#e85d04" : "#1e1e1e"), borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{cat}</button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          {menuItems.map((item) => (
            <div key={item.name} style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 14, padding: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start", cursor: "pointer", transition: "border-color 0.2s" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#f5f5f5" }}>{item.name}</span>
                  {item.tag && <span style={{ fontSize: 10, fontWeight: 700, background: "#1a1a1a", color: "#e85d04", border: "1px solid #2a1810", borderRadius: 4, padding: "2px 6px", letterSpacing: "0.04em" }}>{item.tag}</span>}
                </div>
                <p style={{ fontSize: 13, color: "#555", margin: "0 0 14px", lineHeight: 1.5 }}>{item.desc}</p>
                <span style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>${item.price}</span>
              </div>
              <button style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#e85d04", cursor: "pointer", marginLeft: 16, flexShrink: 0 }}>+</button>
            </div>
          ))}
        </div>
      </div>

      {/* ── DIVIDER ── */}
      <div style={{ height: 2, background: "#1a1a1a", margin: "0 40px" }} />
      <div style={{ padding: "8px 40px", fontSize: 11, color: "#333", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>POS · STAFF VIEW</div>
      <div style={{ height: 2, background: "#1a1a1a", margin: "0 40px 16px" }} />

      {/* ── POS STRIP ── */}
      <div style={{ display: "flex", gap: 16, padding: "0 40px 16px", height: 180 }}>
        <div style={{ flex: 1, background: "#111", border: "1px solid #1e1e1e", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, color: "#444", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 4 }}>CURRENT ORDER</div>
          {posItems.map(item => (
            <div key={item.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#ccc" }}>{item.name}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, color: "#555" }}>×{item.qty}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>${item.price}</span>
              </div>
            </div>
          ))}
          <div style={{ marginTop: "auto", paddingTop: 8, borderTop: "1px solid #1e1e1e", display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#888" }}>Total</span>
            <span style={{ fontSize: 16, fontWeight: 900, color: "#e85d04" }}>$49.00</span>
          </div>
        </div>
        <div style={{ width: 100, display: "flex", flexDirection: "column", gap: 8 }}>
          <button style={{ flex: 1, background: "#e85d04", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cash</button>
          <button style={{ flex: 1, background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, color: "#888", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Card</button>
          <button style={{ flex: 1, background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, color: "#888", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>ATH</button>
        </div>
        <div style={{ flex: 1.2, background: "#111", border: "1px solid #1e1e1e", borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 11, color: "#444", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 8 }}>KDS · LIVE ORDERS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {kdsOrders.map(o => (
              <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", background: "#0d0d0d", borderRadius: 8, border: "1px solid " + (o.status === "new" ? "#2a1810" : o.status === "ready" ? "#0f2a1a" : "#1a1a1a") }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: o.status === "new" ? "#e85d04" : o.status === "ready" ? "#22c55e" : "#888", width: 28 }}>#{o.id}</span>
                <span style={{ fontSize: 12, color: "#666", flex: 1 }}>{o.items[0]}</span>
                <span style={{ fontSize: 11, color: "#444" }}>{o.time}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: o.status === "new" ? "#e85d04" : o.status === "ready" ? "#22c55e" : "#666", textTransform: "uppercase", letterSpacing: "0.06em" }}>{o.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

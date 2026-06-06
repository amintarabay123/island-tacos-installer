export function IslandLuxe() {
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
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif", background: "#0d1117", color: "#e6edf3", minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* ── TOP NAV ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 40px", height: 64, borderBottom: "1px solid #21262d", background: "rgba(13,17,23,0.95)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, #f97316, #fb923c)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>🌮</div>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#e6edf3", letterSpacing: "-0.02em" }}>Island Tacos</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {["Menu", "Story", "Track Order"].map((item, i) => (
            <button key={item} style={{ background: i === 0 ? "#21262d" : "transparent", color: i === 0 ? "#e6edf3" : "#8b949e", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 13, cursor: "pointer", fontWeight: i === 0 ? 600 : 400 }}>{item}</button>
          ))}
        </div>
        <button style={{ background: "linear-gradient(135deg, #f97316, #ea580c)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          Cart (3) · $49
        </button>
      </div>

      {/* ── HERO ── */}
      <div style={{ padding: "64px 40px 52px", background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(249,115,22,0.12) 0%, transparent 70%)", textAlign: "center", position: "relative" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#161b22", border: "1px solid #30363d", borderRadius: 20, padding: "6px 16px", marginBottom: 24 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#3fb950", boxShadow: "0 0 6px #3fb950" }} />
          <span style={{ fontSize: 12, color: "#8b949e", fontWeight: 500 }}>Open now · Closes at 9 PM</span>
        </div>
        <h1 style={{ fontSize: 54, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.05, margin: "0 0 16px" }}>
          <span style={{ color: "#e6edf3" }}>Fresh Tacos,</span><br />
          <span style={{ background: "linear-gradient(135deg, #f97316, #fbbf24)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Island Soul</span>
        </h1>
        <p style={{ fontSize: 15, color: "#8b949e", margin: "0 0 36px", lineHeight: 1.7 }}>
          Wickhams Cay 1 · Road Town, BVI · Pickup only
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button style={{ background: "linear-gradient(135deg, #f97316, #ea580c)", color: "#fff", border: "none", borderRadius: 10, padding: "13px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 24px rgba(249,115,22,0.3)" }}>
            Order Now
          </button>
          <button style={{ background: "#161b22", color: "#8b949e", border: "1px solid #30363d", borderRadius: 10, padding: "13px 24px", fontSize: 15, cursor: "pointer" }}>
            View Menu
          </button>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 32, marginTop: 32 }}>
          {[["4.9★", "Rating"], ["2k+", "Orders"], ["15min", "Avg. Wait"]].map(([val, label]) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#e6edf3" }}>{val}</div>
              <div style={{ fontSize: 11, color: "#484f58", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── MENU GRID ── */}
      <div style={{ padding: "24px 40px", flex: 1 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {["All", "Tacos", "Bowls", "Drinks", "Sides"].map((cat, i) => (
            <button key={cat} style={{ background: i === 0 ? "rgba(249,115,22,0.15)" : "#161b22", color: i === 0 ? "#f97316" : "#8b949e", border: "1px solid " + (i === 0 ? "rgba(249,115,22,0.4)" : "#21262d"), borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: i === 0 ? 600 : 400, cursor: "pointer" }}>{cat}</button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          {menuItems.map((item) => (
            <div key={item.name} style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 12, padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", cursor: "pointer" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#e6edf3" }}>{item.name}</span>
                  {item.tag && <span style={{ fontSize: 10, fontWeight: 600, background: "rgba(249,115,22,0.1)", color: "#f97316", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 4, padding: "2px 6px", letterSpacing: "0.04em" }}>{item.tag}</span>}
                </div>
                <p style={{ fontSize: 12, color: "#484f58", margin: "0 0 12px", lineHeight: 1.5 }}>{item.desc}</p>
                <span style={{ fontSize: 17, fontWeight: 800, color: "#e6edf3" }}>${item.price}</span>
              </div>
              <button style={{ background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.3)", borderRadius: 8, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, color: "#f97316", cursor: "pointer", marginLeft: 14, flexShrink: 0 }}>+</button>
            </div>
          ))}
        </div>
      </div>

      {/* ── DIVIDER ── */}
      <div style={{ height: 1, background: "#21262d", margin: "0 40px" }} />
      <div style={{ padding: "8px 40px", fontSize: 11, color: "#30363d", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>POS · STAFF VIEW</div>
      <div style={{ height: 1, background: "#21262d", margin: "0 40px 14px" }} />

      {/* ── POS + KDS STRIP ── */}
      <div style={{ display: "flex", gap: 14, padding: "0 40px 20px", height: 180 }}>
        <div style={{ flex: 1, background: "#161b22", border: "1px solid #21262d", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, color: "#30363d", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 4 }}>CURRENT ORDER</div>
          {posItems.map(item => (
            <div key={item.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#c9d1d9" }}>{item.name}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, color: "#484f58" }}>×{item.qty}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#e6edf3" }}>${item.price}</span>
              </div>
            </div>
          ))}
          <div style={{ marginTop: "auto", paddingTop: 8, borderTop: "1px solid #21262d", display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#8b949e" }}>Total</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: "#f97316" }}>$49.00</span>
          </div>
        </div>
        <div style={{ width: 100, display: "flex", flexDirection: "column", gap: 8 }}>
          <button style={{ flex: 1, background: "linear-gradient(135deg, #f97316, #ea580c)", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cash</button>
          <button style={{ flex: 1, background: "#161b22", border: "1px solid #21262d", borderRadius: 8, color: "#8b949e", fontSize: 13, cursor: "pointer" }}>Card</button>
          <button style={{ flex: 1, background: "#161b22", border: "1px solid #21262d", borderRadius: 8, color: "#8b949e", fontSize: 13, cursor: "pointer" }}>ATH</button>
        </div>
        <div style={{ flex: 1.2, background: "#161b22", border: "1px solid #21262d", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 11, color: "#30363d", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 8 }}>KDS · LIVE ORDERS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {kdsOrders.map(o => (
              <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", background: "#0d1117", borderRadius: 8, border: "1px solid " + (o.status === "new" ? "rgba(249,115,22,0.3)" : o.status === "ready" ? "rgba(63,185,80,0.3)" : "#21262d") }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: o.status === "new" ? "#f97316" : o.status === "ready" ? "#3fb950" : "#8b949e", width: 28 }}>#{o.id}</span>
                <span style={{ fontSize: 12, color: "#8b949e", flex: 1 }}>{o.items[0]}</span>
                <span style={{ fontSize: 11, color: "#484f58" }}>{o.time}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: o.status === "new" ? "#f97316" : o.status === "ready" ? "#3fb950" : "#8b949e", textTransform: "uppercase", letterSpacing: "0.06em" }}>{o.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

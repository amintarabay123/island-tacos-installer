export function MetallicStore() {
  const categories = ["All", "Tacos", "Burritos", "Bowls", "Drinks", "Sides"];
  const items = [
    { name: "Carne Asada Tacos", desc: "Grilled skirt steak, pico de gallo, cilantro, lime", price: 14, badge: "Popular", cal: 480 },
    { name: "Mahi-Mahi Fish Tacos", desc: "Crispy battered fish, chipotle aioli, cabbage slaw", price: 13, badge: "Chef's Pick", cal: 420 },
    { name: "Al Pastor Tacos", desc: "Achiote-marinated pork, fresh pineapple, white onion", price: 12, badge: "", cal: 440 },
    { name: "Veggie Power Bowl", desc: "Black beans, roasted corn, avocado, jalapeño crema", price: 11, badge: "Vegan", cal: 390 },
    { name: "Chicken Burrito", desc: "Grilled chicken, rice, beans, pico, sour cream", price: 13, badge: "", cal: 620 },
    { name: "Horchata", desc: "House-made, cinnamon, vanilla", price: 4, badge: "", cal: 180 },
  ];

  // Metal surface gradient
  const metalPanel = {
    background: "linear-gradient(160deg, #2a2a2e 0%, #222226 60%, #1e1e22 100%)",
    border: "1px solid rgba(255,255,255,0.07)",
  };
  const metalCard = {
    background: "linear-gradient(150deg, #26262a 0%, #1e1e22 100%)",
    border: "1px solid rgba(255,255,255,0.06)",
  };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", background: "#141416", color: "#f2f2f7", minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* NAV */}
      <nav style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 40px", background: "linear-gradient(180deg, #1c1c20 0%, rgba(20,20,22,0.95) 100%)", borderBottom: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg, #ff6600 0%, #ff8c00 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, boxShadow: "0 2px 8px rgba(255,102,0,0.35)" }}>🌮</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.025em", color: "#f2f2f7", lineHeight: 1.1 }}>Island Tacos</div>
            <div style={{ fontSize: 10, color: "#636366", letterSpacing: "0.06em", fontWeight: 500 }}>ROAD TOWN · BVI</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          {["Menu", "Our Story", "Track Order"].map((item, i) => (
            <button key={item} style={{ background: i === 0 ? "rgba(255,255,255,0.08)" : "transparent", color: i === 0 ? "#f2f2f7" : "#636366", border: "none", borderRadius: 7, padding: "6px 14px", fontSize: 13, fontWeight: i === 0 ? 600 : 400, cursor: "pointer", letterSpacing: "-0.01em" }}>{item}</button>
          ))}
        </div>
        <button style={{ background: "linear-gradient(135deg, #ff6600, #ff8c00)", color: "#fff", border: "none", borderRadius: 9, padding: "9px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer", letterSpacing: "-0.01em", boxShadow: "0 2px 12px rgba(255,102,0,0.3)", display: "flex", alignItems: "center", gap: 8 }}>
          <span>Cart</span>
          <span style={{ background: "rgba(255,255,255,0.25)", borderRadius: 5, padding: "1px 7px", fontSize: 11, fontWeight: 800 }}>3 · $39</span>
        </button>
      </nav>

      {/* HERO */}
      <div style={{ padding: "52px 40px 44px", position: "relative", overflow: "hidden", textAlign: "center" }}>
        {/* radial glow */}
        <div style={{ position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)", width: 600, height: 300, background: "radial-gradient(ellipse, rgba(255,102,0,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, ...metalPanel, borderRadius: 20, padding: "5px 14px", marginBottom: 22, position: "relative" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#30d158", boxShadow: "0 0 8px rgba(48,209,88,0.7)", display: "inline-block" }} />
          <span style={{ fontSize: 11, color: "#aeaeb2", fontWeight: 600, letterSpacing: "0.05em" }}>OPEN NOW  ·  CLOSES 9 PM</span>
        </div>
        <h1 style={{ fontSize: 58, fontWeight: 800, letterSpacing: "-0.045em", lineHeight: 1.02, margin: "0 0 14px", position: "relative" }}>
          <span style={{ background: "linear-gradient(180deg, #ffffff 30%, #a1a1aa 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Tacos Built for</span><br />
          <span style={{ background: "linear-gradient(135deg, #ff6600 0%, #ffaa00 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>The Islands</span>
        </h1>
        <p style={{ fontSize: 15, color: "#636366", margin: "0 0 32px", fontWeight: 400, lineHeight: 1.65, position: "relative" }}>
          Fresh ingredients. Handcrafted daily. Pickup only — Wickhams Cay 1.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", position: "relative" }}>
          <button style={{ background: "linear-gradient(135deg, #ff6600, #ff8c00)", color: "#fff", border: "none", borderRadius: 11, padding: "13px 34px", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(255,102,0,0.35)", letterSpacing: "-0.02em" }}>Order Now</button>
          <button style={{ ...metalPanel, color: "#8e8e93", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 11, padding: "13px 24px", fontSize: 15, fontWeight: 500, cursor: "pointer", letterSpacing: "-0.01em" }}>Browse Menu</button>
        </div>
        {/* stats bar */}
        <div style={{ display: "flex", justifyContent: "center", gap: 40, marginTop: 36, position: "relative" }}>
          {[["4.9 ★", "Customer Rating"], ["2,400+", "Orders Served"], ["~12 min", "Avg. Wait Time"]].map(([val, label]) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em", color: "#f2f2f7" }}>{val}</div>
              <div style={{ fontSize: 10, color: "#48484a", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CATEGORY TABS */}
      <div style={{ padding: "0 40px 0", display: "flex", gap: 6, overflowX: "auto", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: 0 }}>
        {categories.map((cat, i) => (
          <button key={cat} style={{ background: "transparent", color: i === 0 ? "#ff6600" : "#636366", border: "none", borderBottom: i === 0 ? "2px solid #ff6600" : "2px solid transparent", padding: "11px 16px", fontSize: 13, fontWeight: i === 0 ? 700 : 500, cursor: "pointer", whiteSpace: "nowrap", letterSpacing: "-0.01em", marginBottom: -1 }}>{cat}</button>
        ))}
      </div>

      {/* MENU GRID */}
      <div style={{ padding: "24px 40px 40px", flex: 1 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {items.map((item) => (
            <div key={item.name} style={{ ...metalCard, borderRadius: 14, padding: "18px 18px 14px", display: "flex", flexDirection: "column", cursor: "pointer", transition: "border 0.15s", position: "relative", overflow: "hidden" }}>
              {/* top gloss line */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%)" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#f2f2f7", letterSpacing: "-0.02em" }}>{item.name}</span>
                    {item.badge && (
                      <span style={{ fontSize: 10, fontWeight: 700, background: "rgba(255,102,0,0.15)", color: "#ff8c00", border: "1px solid rgba(255,102,0,0.25)", borderRadius: 5, padding: "2px 7px", letterSpacing: "0.04em" }}>{item.badge.toUpperCase()}</span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: "#48484a", margin: "0 0 12px", lineHeight: 1.5, fontWeight: 400 }}>{item.desc}</p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
                <div>
                  <span style={{ fontSize: 19, fontWeight: 800, color: "#f2f2f7", letterSpacing: "-0.03em" }}>${item.price}</span>
                  <span style={{ fontSize: 11, color: "#3a3a3c", fontWeight: 500, marginLeft: 8 }}>{item.cal} cal</span>
                </div>
                <button style={{ background: "linear-gradient(135deg, #ff6600, #ff8c00)", border: "none", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, color: "#fff", cursor: "pointer", boxShadow: "0 2px 8px rgba(255,102,0,0.3)", fontWeight: 700, lineHeight: 1 }}>+</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

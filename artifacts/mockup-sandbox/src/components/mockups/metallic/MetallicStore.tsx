export function MetallicStore() {
  const categories = ["All", "Tacos", "Burritos", "Bowls", "Drinks", "Sides"];
  const items = [
    { name: "Carne Asada Tacos", desc: "Grilled skirt steak, pico de gallo, cilantro", price: 14, badge: "Popular", emoji: "🥩" },
    { name: "Mahi-Mahi Fish Tacos", desc: "Crispy battered fish, chipotle aioli, slaw", price: 13, badge: "Chef's Pick", emoji: "🐟" },
    { name: "Al Pastor Tacos", desc: "Achiote pork, fresh pineapple, white onion", price: 12, badge: "", emoji: "🍍" },
    { name: "Veggie Power Bowl", desc: "Black beans, roasted corn, avocado crema", price: 11, badge: "Vegan", emoji: "🥑" },
    { name: "Chicken Burrito", desc: "Grilled chicken, rice, beans, pico, crema", price: 13, badge: "", emoji: "🌯" },
    { name: "Horchata", desc: "House-made, cinnamon, vanilla, served cold", price: 4, badge: "", emoji: "🥛" },
  ];

  // Indigo-space palette
  const bg = "#13142a";
  const surface = "#1a1b35";
  const surfaceHigh = "#202140";
  const border = "rgba(255,255,255,0.06)";
  const textPrimary = "#e8eaf6";
  const textMuted = "#6b7094";
  const orange = "#ff6b00";
  const orangeGlow = "rgba(255,107,0,0.35)";
  const purpleAccent = "#7c6af7";

  return (
    <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", background: bg, color: textPrimary, minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* NAV */}
      <nav style={{ height: 62, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 40px", background: "rgba(19,20,42,0.92)", borderBottom: `1px solid ${border}`, backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 12, background: `linear-gradient(135deg, ${orange} 0%, #ff9500 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, boxShadow: `0 4px 16px ${orangeGlow}` }}>🌮</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.03em", color: textPrimary, lineHeight: 1.1 }}>Island Tacos</div>
            <div style={{ fontSize: 10, color: textMuted, letterSpacing: "0.08em", fontWeight: 600 }}>ROAD TOWN · BVI</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {["Menu", "Our Story", "Track Order"].map((item, i) => (
            <button key={item} style={{ background: i === 0 ? `rgba(124,106,247,0.15)` : "transparent", color: i === 0 ? purpleAccent : textMuted, border: i === 0 ? `1px solid rgba(124,106,247,0.3)` : "1px solid transparent", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: i === 0 ? 700 : 400, cursor: "pointer" }}>{item}</button>
          ))}
        </div>
        <button style={{ background: `linear-gradient(135deg, ${orange}, #ff9500)`, color: "#fff", border: "none", borderRadius: 20, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 18px ${orangeGlow}`, display: "flex", alignItems: "center", gap: 8 }}>
          <span>🛒</span>
          <span>Cart  ·  $39</span>
          <span style={{ background: "rgba(255,255,255,0.25)", borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 800 }}>3</span>
        </button>
      </nav>

      {/* HERO */}
      <div style={{ padding: "56px 40px 48px", position: "relative", overflow: "hidden", textAlign: "center" }}>
        {/* background orbs */}
        <div style={{ position: "absolute", top: -80, left: "30%", width: 500, height: 400, background: `radial-gradient(ellipse, rgba(124,106,247,0.12) 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: -40, left: "55%", width: 400, height: 300, background: `radial-gradient(ellipse, ${orangeGlow.replace("0.35", "0.1")} 0%, transparent 70%)`, pointerEvents: "none" }} />

        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: surfaceHigh, border: `1px solid ${border}`, borderRadius: 20, padding: "6px 16px", marginBottom: 24, position: "relative" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#30d158", boxShadow: "0 0 10px rgba(48,209,88,0.8)", display: "inline-block" }} />
          <span style={{ fontSize: 11, color: textMuted, fontWeight: 600, letterSpacing: "0.06em" }}>OPEN NOW  ·  CLOSES 9 PM</span>
        </div>
        <h1 style={{ fontSize: 60, fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 1, margin: "0 0 14px", position: "relative" }}>
          <span style={{ background: `linear-gradient(135deg, ${textPrimary} 20%, #9095c0 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Tacos Built for</span><br />
          <span style={{ background: `linear-gradient(135deg, ${orange} 0%, #ffaa00 60%, #ff6b00 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>The Islands</span>
        </h1>
        <p style={{ fontSize: 15, color: textMuted, margin: "0 0 36px", fontWeight: 400, lineHeight: 1.7, position: "relative" }}>
          Fresh ingredients. Handcrafted daily. Pickup only — Wickhams Cay 1.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", position: "relative" }}>
          <button style={{ background: `linear-gradient(135deg, ${orange}, #ff9500)`, color: "#fff", border: "none", borderRadius: 20, padding: "14px 36px", fontSize: 15, fontWeight: 800, cursor: "pointer", boxShadow: `0 6px 28px ${orangeGlow}` }}>Order Now →</button>
          <button style={{ background: surfaceHigh, color: textMuted, border: `1px solid ${border}`, borderRadius: 20, padding: "14px 28px", fontSize: 15, fontWeight: 500, cursor: "pointer" }}>Browse Menu</button>
        </div>
        {/* Stats */}
        <div style={{ display: "flex", justifyContent: "center", gap: 40, marginTop: 40, position: "relative" }}>
          {[["4.9 ★", "Rating", orange], ["2,400+", "Orders", purpleAccent], ["~12 min", "Wait Time", "#30d158"]].map(([val, label, color]) => (
            <div key={String(label)} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.04em", color: color as string }}>{val}</div>
              <div style={{ fontSize: 10, color: textMuted, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 3 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CATEGORY TABS */}
      <div style={{ padding: "0 40px", display: "flex", gap: 8, marginBottom: 20 }}>
        {categories.map((cat, i) => (
          <button key={cat} style={{ background: i === 0 ? `linear-gradient(135deg, ${orange}, #ff9500)` : surfaceHigh, color: i === 0 ? "#fff" : textMuted, border: i === 0 ? "none" : `1px solid ${border}`, borderRadius: 20, padding: "9px 20px", fontSize: 13, fontWeight: i === 0 ? 700 : 500, cursor: "pointer", whiteSpace: "nowrap", boxShadow: i === 0 ? `0 4px 16px ${orangeGlow}` : "none" }}>{cat}</button>
        ))}
      </div>

      {/* MENU GRID */}
      <div style={{ padding: "0 40px 40px", flex: 1 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {items.map((item) => (
            <div key={item.name} style={{ background: surface, border: `1px solid ${border}`, borderRadius: 20, padding: "20px 20px 16px", display: "flex", flexDirection: "column", cursor: "pointer", position: "relative", overflow: "hidden", transition: "border-color 0.2s" }}>
              {/* subtle top glow */}
              <div style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)" }} />
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: surfaceHigh, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>{item.emoji}</div>
                {item.badge && (
                  <span style={{ fontSize: 10, fontWeight: 700, background: item.badge === "Vegan" ? "rgba(48,209,88,0.15)" : `rgba(255,107,0,0.15)`, color: item.badge === "Vegan" ? "#30d158" : orange, border: `1px solid ${item.badge === "Vegan" ? "rgba(48,209,88,0.3)" : "rgba(255,107,0,0.3)"}`, borderRadius: 8, padding: "3px 8px", letterSpacing: "0.04em" }}>{item.badge.toUpperCase()}</span>
                )}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: textPrimary, letterSpacing: "-0.02em", marginBottom: 5 }}>{item.name}</div>
              <p style={{ fontSize: 12, color: textMuted, margin: "0 0 14px", lineHeight: 1.5, flex: 1 }}>{item.desc}</p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: textPrimary, letterSpacing: "-0.04em" }}>${item.price}</span>
                <button style={{ background: `linear-gradient(135deg, ${orange}, #ff9500)`, border: "none", borderRadius: 12, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#fff", cursor: "pointer", boxShadow: `0 4px 12px ${orangeGlow}`, fontWeight: 700, lineHeight: 1 }}>+</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MetallicStore() {
  const bg   = "#16172b";
  const card = "#1e1f38";
  const border = "rgba(255,255,255,0.06)";
  const tp  = "#e8eaf6";
  const tm  = "#7077a1";

  const categories = ["All", "Tacos", "Burritos", "Potato Bowls", "Rice Bowl", "Quesadilla", "Nachos", "Salads", "Sides", "Drinks"];

  // Real Island Tacos menu items
  const items = [
    { name: "Tacos Steak 🥩",          desc: "Flour tortillas, seasoned steak, pico de gallo", price: 16, badge: "Popular",    grad: "linear-gradient(145deg,#ff6b00,#ff3d00,#c0392b)", glow: "rgba(255,107,0,0.5)",  art: ["🥩","🌮"] },
    { name: "Taco Salmon 🐟",           desc: "Grilled Atlantic salmon, fresh salsa, lime",      price: 20, badge: "Chef's Pick",grad: "linear-gradient(145deg,#0ea5e9,#0284c7,#1e3a8a)", glow: "rgba(14,165,233,0.5)", art: ["🐟","🌊"] },
    { name: "Taco Shrimp 🍤",           desc: "Crispy shrimp, chipotle aioli, cabbage slaw",     price: 18, badge: "",           grad: "linear-gradient(145deg,#7c6af7,#5b4cf5,#3730a3)", glow: "rgba(124,106,247,0.5)",art: ["🍤","🌶️"] },
    { name: "Tacos Chicken 🍗",         desc: "Grilled chicken, house seasoning, cilantro",      price: 14, badge: "",           grad: "linear-gradient(145deg,#f59e0b,#d97706,#92400e)", glow: "rgba(245,158,11,0.5)", art: ["🍗","🌮"] },
    { name: "Potato Bowl Salmon 🐟",    desc: "Crispy potatoes, Atlantic salmon, house sauce",   price: 22, badge: "New",         grad: "linear-gradient(145deg,#10b981,#059669,#064e3b)", glow: "rgba(16,185,129,0.5)", art: ["🐟","🥔"] },
    { name: "Burrito Steak 🥩",         desc: "Slow-grilled steak, rice, beans, crema",          price: 16, badge: "",           grad: "linear-gradient(145deg,#ef4444,#dc2626,#7f1d1d)", glow: "rgba(239,68,68,0.5)",  art: ["🥩","🌯"] },
    { name: "Quesadilla Chicken 🍗",    desc: "Grilled chicken, melted cheese, jalapeño",        price: 14, badge: "",           grad: "linear-gradient(145deg,#8b5cf6,#7c3aed,#4c1d95)", glow: "rgba(139,92,246,0.5)", art: ["🍗","🧀"] },
    { name: "Nachos Steak",             desc: "House chips, steak, cheese, pico, jalapeño",      price: 14, badge: "",           grad: "linear-gradient(145deg,#f97316,#ea580c,#7c2d12)", glow: "rgba(249,115,22,0.5)", art: ["🥩","🧀"] },
    { name: "Rice Bowl Chicken 🍗",     desc: "Seasoned rice, grilled chicken, fresh toppings",  price: 16, badge: "",           grad: "linear-gradient(145deg,#06b6d4,#0891b2,#164e63)", glow: "rgba(6,182,212,0.5)",  art: ["🍗","🍚"] },
    { name: "Salad Salmon 🐟",          desc: "Mixed greens, grilled salmon, house dressing",    price: 22, badge: "",           grad: "linear-gradient(145deg,#22c55e,#16a34a,#14532d)", glow: "rgba(34,197,94,0.5)",  art: ["🐟","🥗"] },
    { name: "Potato Bowl Steak 🥩",     desc: "Crispy island potatoes, steak, fresh toppings",   price: 18, badge: "",           grad: "linear-gradient(145deg,#e879f9,#d946ef,#7e22ce)", glow: "rgba(232,121,249,0.5)",art: ["🥩","🥔"] },
    { name: "Fries",                    desc: "Golden crispy fries, seasoned just right",         price: 5,  badge: "",           grad: "linear-gradient(145deg,#fbbf24,#f59e0b,#78350f)", glow: "rgba(251,191,36,0.4)", art: ["🍟","🧂"] },
  ];

  const [activeCategory] = [0];

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: bg, color: tp, minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* NAV */}
      <nav style={{ height: 62, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 40px", background: "rgba(22,23,43,0.92)", borderBottom: `1px solid ${border}`, backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 13, background: "linear-gradient(135deg,#ff6b00,#ff9500)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, boxShadow: "0 4px 18px rgba(255,107,0,0.45)" }}>🌮</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: "-0.035em", color: tp, lineHeight: 1.1 }}>Island Tacos</div>
            <div style={{ fontSize: 10, color: tm, letterSpacing: "0.08em", fontWeight: 600 }}>WICKHAMS CAY 1 · ROAD TOWN, BVI</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {["Menu", "Track Order", "Contact"].map((item, i) => (
            <button key={item} style={{ background: i === 0 ? "rgba(124,106,247,0.15)" : "transparent", color: i === 0 ? "#7c6af7" : tm, border: i === 0 ? "1px solid rgba(124,106,247,0.3)" : "1px solid transparent", borderRadius: 10, padding: "7px 16px", fontSize: 13, fontWeight: i === 0 ? 700 : 400, cursor: "pointer" }}>{item}</button>
          ))}
        </div>
        <button style={{ background: "linear-gradient(135deg,#ff6b00,#ff9500)", color: "#fff", border: "none", borderRadius: 20, padding: "10px 24px", fontSize: 13, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 18px rgba(255,107,0,0.4)", display: "flex", alignItems: "center", gap: 8 }}>
          🛒 Cart &nbsp;<span style={{ background: "rgba(255,255,255,0.25)", borderRadius: 10, padding: "1px 8px", fontWeight: 900, fontSize: 12 }}>3 · $50</span>
        </button>
      </nav>

      {/* HERO with floating art */}
      <div style={{ position: "relative", padding: "72px 40px 52px", textAlign: "center", overflow: "visible" }}>
        {/* bg glow blobs */}
        <div style={{ position: "absolute", top: 0, left: "20%", width: 500, height: 400, background: "radial-gradient(ellipse, rgba(124,106,247,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 0, right: "15%", width: 400, height: 300, background: "radial-gradient(ellipse, rgba(255,107,0,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />

        {/* Floating food art — emojis bursting out above */}
        <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", width: 420, height: 70, pointerEvents: "none", zIndex: 5 }}>
          {[
            { e: "🌮", x: "8%",  y: "0px",  sz: 52, rot: -18, delay: 0   },
            { e: "🥩", x: "20%", y: "-8px", sz: 42, rot: 12,  delay: 0.1 },
            { e: "🍤", x: "35%", y: "-14px",sz: 58, rot: -8,  delay: 0   },
            { e: "🐟", x: "52%", y: "-10px",sz: 52, rot: 14,  delay: 0.1 },
            { e: "🥑", x: "67%", y: "-4px", sz: 44, rot: -12, delay: 0   },
            { e: "🌯", x: "80%", y: "4px",  sz: 48, rot: 10,  delay: 0.2 },
            { e: "🧀", x: "93%", y: "-2px", sz: 38, rot: -6,  delay: 0.1 },
          ].map((f, i) => (
            <span key={i} style={{ position: "absolute", left: f.x, top: f.y, fontSize: f.sz, transform: `rotate(${f.rot}deg)`, filter: `drop-shadow(0 8px 20px rgba(255,107,0,0.45)) drop-shadow(0 0 12px rgba(124,106,247,0.4))`, display: "inline-block", lineHeight: 1 }}>{f.e}</span>
          ))}
        </div>

        {/* Open badge */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: card, border: `1px solid ${border}`, borderRadius: 20, padding: "6px 16px", marginBottom: 20, position: "relative", zIndex: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#30d158", boxShadow: "0 0 10px rgba(48,209,88,0.8)", display: "inline-block" }} />
          <span style={{ fontSize: 11, color: tm, fontWeight: 700, letterSpacing: "0.06em" }}>OPEN NOW  ·  CLOSES 9 PM  ·  284-544-8088</span>
        </div>

        <h1 style={{ fontSize: 58, fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 1, margin: "0 0 14px", position: "relative", zIndex: 2 }}>
          <span style={{ background: `linear-gradient(135deg, ${tp} 20%, #9095c0 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Island Fresh</span><br />
          <span style={{ background: "linear-gradient(135deg,#ff6b00 0%,#ffaa00 60%,#ff6b00 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Order Online</span>
        </h1>
        <p style={{ fontSize: 15, color: tm, margin: "0 0 32px", lineHeight: 1.7, position: "relative", zIndex: 2 }}>
          Wickhams Cay 1, Road Town, Tortola, BVI · Pickup only · No tax
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", position: "relative", zIndex: 2 }}>
          <button style={{ background: "linear-gradient(135deg,#ff6b00,#ff9500)", color: "#fff", border: "none", borderRadius: 20, padding: "14px 36px", fontSize: 15, fontWeight: 900, cursor: "pointer", boxShadow: "0 6px 28px rgba(255,107,0,0.45)" }}>Order Now →</button>
          <button style={{ background: card, color: tm, border: `1px solid ${border}`, borderRadius: 20, padding: "14px 28px", fontSize: 15, cursor: "pointer" }}>Browse Menu</button>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", justifyContent: "center", gap: 44, marginTop: 36, position: "relative", zIndex: 2 }}>
          {[["4.9 ★","Customer Rating","#ff6b00"], ["2,400+","Orders Served","#7c6af7"], ["~12 min","Avg. Wait","#30d158"]].map(([v, l, c]) => (
            <div key={String(l)} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.04em", color: c as string }}>{v}</div>
              <div style={{ fontSize: 10, color: "#4a4d6a", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 3 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CATEGORY PILLS */}
      <div style={{ padding: "0 40px 20px", display: "flex", gap: 8, flexWrap: "wrap" }}>
        {categories.map((cat, i) => (
          <button key={cat} style={{ background: i === 0 ? "linear-gradient(135deg,#ff6b00,#ff9500)" : card, color: i === 0 ? "#fff" : tm, border: i === 0 ? "none" : `1px solid ${border}`, borderRadius: 20, padding: "9px 20px", fontSize: 13, fontWeight: i === 0 ? 800 : 500, cursor: "pointer", boxShadow: i === 0 ? "0 4px 18px rgba(255,107,0,0.4)" : "none", whiteSpace: "nowrap" }}>{cat}</button>
        ))}
      </div>

      {/* MENU GRID — pop-out art cards */}
      <div style={{ padding: "0 40px 48px", flex: 1 }}>
        {/* Top padding to accommodate the pop-out art */}
        <div style={{ paddingTop: 40, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
          {items.map((item) => (
            <div key={item.name} style={{ position: "relative" }}>
              {/* Floating art above card */}
              <div style={{ position: "absolute", top: -34, left: "50%", transform: "translateX(-50%)", zIndex: 10, pointerEvents: "none", display: "flex", gap: 0, alignItems: "flex-end", filter: `drop-shadow(0 6px 16px ${item.glow})` }}>
                <span style={{ fontSize: 38, lineHeight: 1, transform: "rotate(-12deg) translateX(6px)", opacity: 0.65, filter: "blur(0.5px)" }}>{item.art[1]}</span>
                <span style={{ fontSize: 52, lineHeight: 1, transform: "rotate(8deg) translateX(-4px)", filter: `drop-shadow(0 0 14px ${item.glow})` }}>{item.art[0]}</span>
              </div>
              {/* Card */}
              <div style={{ background: item.grad, borderRadius: 20, padding: "46px 16px 16px", position: "relative", overflow: "hidden", boxShadow: `0 8px 28px ${item.glow}`, cursor: "pointer" }}>
                {/* Shine overlay */}
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "linear-gradient(155deg, rgba(255,255,255,0.12) 0%, transparent 50%)", borderRadius: 20, pointerEvents: "none" }} />
                <div style={{ position: "absolute", top: -24, left: "50%", transform: "translateX(-50%)", width: 80, height: 80, background: "rgba(255,255,255,0.12)", borderRadius: "50%", filter: "blur(20px)", pointerEvents: "none" }} />
                {item.badge && (
                  <div style={{ display: "inline-block", background: "rgba(255,255,255,0.2)", borderRadius: 8, padding: "2px 8px", fontSize: 10, fontWeight: 800, color: "#fff", letterSpacing: "0.05em", marginBottom: 6 }}>{item.badge.toUpperCase()}</div>
                )}
                <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", marginBottom: 4, lineHeight: 1.3 }}>{item.name}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", lineHeight: 1.4, marginBottom: 12 }}>{item.desc}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em" }}>${item.price}</span>
                  <button style={{ background: "rgba(255,255,255,0.25)", border: "1px solid rgba(255,255,255,0.35)", borderRadius: 10, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#fff", cursor: "pointer", fontWeight: 900, lineHeight: 1 }}>+</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

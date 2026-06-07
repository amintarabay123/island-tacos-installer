export function MetallicKDS() {
  const bg   = "#16172b";
  const card = "#1e1f38";
  const border = "rgba(255,255,255,0.06)";
  const tp  = "#e8eaf6";
  const tm  = "#7077a1";

  // Real Island Tacos orders
  const orders = [
    {
      id: "318", type: "POS", name: "Walk-in", elapsed: "1:24", status: "new",
      items: [
        { name: "Tacos Steak 🥩",    qty: 2, mods: "No cilantro", made: false, emoji: "🥩", grad: "linear-gradient(135deg,#ff6b00,#c0392b)", glow: "rgba(255,107,0,0.5)" },
        { name: "Taco Salmon 🐟",    qty: 1, mods: "",             made: false, emoji: "🐟", grad: "linear-gradient(135deg,#0ea5e9,#1e3a8a)", glow: "rgba(14,165,233,0.5)" },
        { name: "Water 💧",           qty: 2, mods: "",             made: false, emoji: "💧", grad: "linear-gradient(135deg,#38bdf8,#0c4a6e)", glow: "rgba(56,189,248,0.5)" },
      ]
    },
    {
      id: "317", type: "Online", name: "Marcus B.", elapsed: "3:55", status: "preparing",
      items: [
        { name: "Potato Bowl Steak 🥩",   qty: 1, mods: "Extra fries", made: true,  emoji: "🥩", grad: "linear-gradient(135deg,#ff6b00,#c0392b)", glow: "rgba(255,107,0,0.5)" },
        { name: "Burrito Chicken 🍗",      qty: 2, mods: "",             made: false, emoji: "🍗", grad: "linear-gradient(135deg,#f59e0b,#92400e)", glow: "rgba(245,158,11,0.5)" },
        { name: "Jarritos 🥤",             qty: 1, mods: "",             made: true,  emoji: "🥤", grad: "linear-gradient(135deg,#f43f5e,#9f1239)", glow: "rgba(244,63,94,0.5)" },
      ]
    },
    {
      id: "316", type: "Online", name: "Sarah K.", elapsed: "6:40", status: "preparing",
      items: [
        { name: "Rice Bowl Salmon 🐟",   qty: 1, mods: "No onion",   made: true,  emoji: "🐟", grad: "linear-gradient(135deg,#0ea5e9,#1e3a8a)", glow: "rgba(14,165,233,0.5)" },
        { name: "Quesadilla Chicken 🍗", qty: 1, mods: "Extra jalapeño", made: true, emoji: "🍗", grad: "linear-gradient(135deg,#f59e0b,#92400e)", glow: "rgba(245,158,11,0.5)" },
        { name: "Taco Shrimp 🍤",        qty: 2, mods: "",            made: false, emoji: "🍤", grad: "linear-gradient(135deg,#7c6af7,#3730a3)", glow: "rgba(124,106,247,0.5)" },
      ]
    },
    {
      id: "315", type: "POS", name: "Walk-in", elapsed: "9:12", status: "ready",
      items: [
        { name: "Nachos Steak",        qty: 1, mods: "",           made: true, emoji: "🥩", grad: "linear-gradient(135deg,#ff6b00,#c0392b)", glow: "rgba(255,107,0,0.5)" },
        { name: "Tacos Chicken 🍗",    qty: 3, mods: "Extra salsa", made: true, emoji: "🍗", grad: "linear-gradient(135deg,#f59e0b,#92400e)", glow: "rgba(245,158,11,0.5)" },
        { name: "Fries",               qty: 2, mods: "",           made: true, emoji: "🍟", grad: "linear-gradient(135deg,#fbbf24,#78350f)", glow: "rgba(251,191,36,0.5)" },
      ]
    },
  ];

  const statusCfg = {
    new:       { label: "NEW",      accent: "#ff6b00", glow: "rgba(255,107,0,0.55)",   bgTint: "rgba(255,107,0,0.06)",   topBar: "linear-gradient(90deg,transparent,#ff6b00,transparent)",   btnGrad: "linear-gradient(135deg,#ff6b00,#ff9500)", btnShadow: "0 4px 18px rgba(255,107,0,0.4)", btnColor: "#fff", btnText: "Start Cooking →" },
    preparing: { label: "COOKING",  accent: "#ffd60a", glow: "rgba(255,214,10,0.5)",   bgTint: "rgba(255,214,10,0.04)",  topBar: "linear-gradient(90deg,transparent,#ffd60a,transparent)",   btnGrad: "rgba(48,209,88,0.12)",   btnShadow: "none", btnColor: "#30d158", btnText: "Mark as Ready ✓" },
    ready:     { label: "READY ✓",  accent: "#30d158", glow: "rgba(48,209,88,0.6)",    bgTint: "rgba(48,209,88,0.06)",   topBar: "linear-gradient(90deg,transparent,#30d158,transparent)",   btnGrad: "rgba(48,209,88,0.18)",   btnShadow: "0 3px 12px rgba(48,209,88,0.25)", btnColor: "#30d158", btnText: "✓ Picked Up — Complete" },
  } as const;

  const navItems = [
    { icon: "📺", label: "KDS",     active: true  },
    { icon: "🧾", label: "History", active: false },
    { icon: "📊", label: "Stats",   active: false },
    { icon: "⚙️", label: "Settings",active: false },
  ];

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: bg, color: tp, height: "100vh", display: "flex", overflow: "hidden", fontSize: 13 }}>

      {/* SIDEBAR — same bg, no separation */}
      <div style={{ width: 68, display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 0 14px", gap: 6, flexShrink: 0, background: "transparent", zIndex: 2 }}>
        <div style={{ width: 38, height: 38, borderRadius: 13, background: "linear-gradient(135deg,#ff6b00,#ff9500)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, marginBottom: 14, boxShadow: "0 0 0 1px rgba(255,107,0,0.3), 0 6px 20px rgba(255,107,0,0.45)" }}>🌮</div>
        {navItems.map((n) => (
          <div key={n.label} title={n.label} style={{ width: 46, height: 46, borderRadius: 14, background: n.active ? "rgba(255,107,0,0.15)" : "rgba(255,255,255,0.03)", border: n.active ? "1px solid rgba(255,107,0,0.4)" : `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, cursor: "pointer", boxShadow: n.active ? "0 0 16px rgba(255,107,0,0.25)" : "none" }}>
            <span style={{ filter: n.active ? "none" : "grayscale(1) opacity(0.4)" }}>{n.icon}</span>
          </div>
        ))}
        <div style={{ flex: 1 }} />
        {/* Status counters stacked vertically */}
        {[["2", "#ff6b00", "rgba(255,107,0,0.15)", "NEW"], ["2", "#ffd60a", "rgba(255,214,10,0.12)", "CKG"], ["1", "#30d158", "rgba(48,209,88,0.12)", "RDY"]].map(([n, color, bgc, lbl]) => (
          <div key={String(lbl)} style={{ width: 46, background: bgc as string, border: `1px solid ${(color as string) + "44"}`, borderRadius: 10, padding: "5px 0", textAlign: "center", marginBottom: 2, boxShadow: `0 0 14px ${(color as string) + "33"}, 0 4px 12px rgba(0,0,0,0.3)` }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: color as string, lineHeight: 1 }}>{n}</div>
            <div style={{ fontSize: 8, color: color as string, fontWeight: 800, letterSpacing: "0.04em" }}>{lbl}</div>
          </div>
        ))}
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top bar */}
        <div style={{ height: 54, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", background: "transparent", flexShrink: 0 }}>
          <div>
            <span style={{ fontSize: 17, fontWeight: 900, letterSpacing: "-0.035em" }}>Kitchen Display</span>
            <span style={{ fontSize: 12, color: tm, marginLeft: 10 }}>Island Tacos · Road Town, BVI</span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: "7px 18px", textAlign: "right", boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 8px 32px rgba(0,0,0,0.35), 0 0 20px rgba(124,106,247,0.06)" }}>
              <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-0.05em" }}>6:42 PM</span>
              <span style={{ fontSize: 9, color: tm, fontWeight: 700, letterSpacing: "0.06em", display: "block" }}>SATURDAY</span>
            </div>
          </div>
        </div>

        {/* ORDER CARDS — pop-out item chips */}
        <div style={{ flex: 1, padding: "0 16px 16px", overflowY: "auto" }}>
          {/* Extra top padding for pop-out items */}
          <div style={{ paddingTop: 44, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18, alignContent: "start" }}>
            {orders.map((order) => {
              const s = statusCfg[order.status as keyof typeof statusCfg];
              const urgentTime = parseFloat(order.elapsed) > 7;
              return (
                <div key={order.id} style={{ position: "relative" }}>
                  {/* Pop-out item emojis above card */}
                  <div style={{ position: "absolute", top: -38, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 2, zIndex: 5, pointerEvents: "none" }}>
                    {order.items.slice(0, 3).map((item, j) => (
                      <div key={j} style={{ position: "relative" }}>
                        <span style={{ fontSize: j === 1 ? 46 : 36, lineHeight: 1, display: "block", filter: `drop-shadow(0 6px 14px ${item.glow})`, transform: j === 0 ? "rotate(-14deg) translateY(6px)" : j === 2 ? "rotate(12deg) translateY(4px)" : "rotate(4deg)", opacity: item.made ? 0.35 : 1 }}>{item.emoji}</span>
                        {item.made && <span style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 14, fontWeight: 900, color: "#30d158", textShadow: "0 0 8px rgba(48,209,88,0.8)" }}>✓</span>}
                      </div>
                    ))}
                  </div>

                  {/* Card */}
                  <div style={{ background: s.bgTint, border: `1px solid ${s.accent}33`, borderRadius: 22, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                    {/* Glowing top edge */}
                    <div style={{ height: 3, background: s.topBar, opacity: 0.9 }} />

                    {/* Header */}
                    <div style={{ padding: "12px 14px 10px", background: "rgba(0,0,0,0.2)", borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: 26, fontWeight: 900, color: tp, letterSpacing: "-0.06em", lineHeight: 1 }}>#{order.id}</div>
                          <div style={{ fontSize: 10, color: tm, marginTop: 2, fontWeight: 500 }}>{order.type === "Online" ? "🌐" : "🏪"} {order.name}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 22, fontWeight: 900, color: urgentTime ? "#ff453a" : s.accent, letterSpacing: "-0.04em", lineHeight: 1 }}>{order.elapsed}</div>
                          <div style={{ fontSize: 9, color: tm, fontWeight: 700, letterSpacing: "0.06em", marginTop: 2 }}>ELAPSED</div>
                        </div>
                      </div>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(0,0,0,0.3)", borderRadius: 10, padding: "4px 10px" }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.accent, boxShadow: `0 0 10px ${s.glow}`, display: "inline-block" }} />
                        <span style={{ fontSize: 10, fontWeight: 900, color: s.accent, letterSpacing: "0.07em" }}>{s.label}</span>
                      </div>
                    </div>

                    {/* Items */}
                    <div style={{ padding: "10px 14px" }}>
                      {order.items.map((item, j) => (
                        <div key={j} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: j < order.items.length - 1 ? `1px solid rgba(255,255,255,0.04)` : "none" }}>
                          {/* Mini gradient chip */}
                          <div style={{ width: 26, height: 26, borderRadius: 8, background: item.grad, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, opacity: item.made ? 0.45 : 1, boxShadow: item.made ? "none" : `0 2px 8px ${item.glow}` }}>
                            {item.made ? <span style={{ fontSize: 12, color: "#fff", fontWeight: 900 }}>✓</span> : item.emoji}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: item.made ? "#3a3c5a" : tp, textDecoration: item.made ? "line-through" : "none", letterSpacing: "-0.015em" }}>
                              <span style={{ color: item.made ? "#3a3c5a" : "#ff8c00", fontWeight: 900, marginRight: 4 }}>{item.qty}×</span>
                              {item.name}
                            </div>
                            {item.mods && <div style={{ fontSize: 10, color: "#4a4c6a", fontStyle: "italic", marginTop: 1 }}>{item.mods}</div>}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* CTA button */}
                    <div style={{ padding: "8px 12px 12px" }}>
                      <button style={{ width: "100%", background: s.btnGrad, color: s.btnColor, border: s.btnColor === "#fff" ? "none" : `1px solid ${s.accent}55`, borderRadius: 12, padding: "11px 0", fontSize: 12, fontWeight: 900, cursor: "pointer", boxShadow: s.btnShadow, letterSpacing: "-0.01em" }}>
                        {s.btnText}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

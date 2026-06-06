export function MetallicKDS() {
  const orders = [
    {
      id: "251", type: "POS", name: "Walk-in", elapsed: "1:42", status: "new",
      items: [
        { name: "Carne Asada Tacos", mods: "No onion", qty: 2, made: false },
        { name: "Fish Tacos", mods: "", qty: 1, made: false },
        { name: "Horchata", mods: "Extra ice", qty: 2, made: false },
      ]
    },
    {
      id: "249", type: "Online", name: "Marcus B.", elapsed: "4:15", status: "preparing",
      items: [
        { name: "Al Pastor Tacos", mods: "", qty: 3, made: true },
        { name: "Chips & Salsa", mods: "", qty: 1, made: false },
        { name: "Jamaica Drink", mods: "No ice", qty: 1, made: false },
      ]
    },
    {
      id: "248", type: "Online", name: "Sarah K.", elapsed: "7:03", status: "preparing",
      items: [
        { name: "Chicken Burrito", mods: "Extra guac", qty: 1, made: true },
        { name: "Veggie Bowl", mods: "", qty: 1, made: true },
        { name: "Horchata", mods: "", qty: 2, made: false },
      ]
    },
    {
      id: "246", type: "POS", name: "Walk-in", elapsed: "9:50", status: "ready",
      items: [
        { name: "Carne Asada Tacos", mods: "", qty: 2, made: true },
        { name: "Fish Tacos", mods: "Extra slaw", qty: 1, made: true },
      ]
    },
  ];

  const bg = "#13142a";
  const surface = "#1a1b35";
  const surfaceHigh = "#20214088";
  const border = "rgba(255,255,255,0.06)";
  const textPrimary = "#e8eaf6";
  const textMuted = "#6b7094";
  const orange = "#ff6b00";

  const statusConfig = {
    new:       { label: "NEW",        accent: "#ff6b00", glow: "rgba(255,107,0,0.5)",  bgTint: "rgba(255,107,0,0.06)",  gradTop: "rgba(255,107,0,0.15)" },
    preparing: { label: "COOKING",    accent: "#ffd60a", glow: "rgba(255,214,10,0.5)", bgTint: "rgba(255,214,10,0.04)", gradTop: "rgba(255,214,10,0.1)" },
    ready:     { label: "READY  ✓",   accent: "#30d158", glow: "rgba(48,209,88,0.6)",  bgTint: "rgba(48,209,88,0.06)",  gradTop: "rgba(48,209,88,0.12)" },
  } as const;

  return (
    <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", background: bg, color: textPrimary, height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* TOP BAR */}
      <div style={{ height: 62, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", background: `rgba(19,20,42,0.95)`, borderBottom: `1px solid ${border}`, backdropFilter: "blur(20px)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 12, background: `linear-gradient(135deg, ${orange}, #ff9500)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, boxShadow: "0 4px 16px rgba(255,107,0,0.4)" }}>🌮</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.03em" }}>Kitchen Display</div>
            <div style={{ fontSize: 11, color: textMuted, letterSpacing: "0.04em", fontWeight: 500 }}>Island Tacos · Road Town</div>
          </div>
        </div>

        {/* Status counters */}
        <div style={{ display: "flex", gap: 10 }}>
          {([["4", "NEW", "#ff6b00", "rgba(255,107,0,0.15)", "rgba(255,107,0,0.3)"], ["2", "COOKING", "#ffd60a", "rgba(255,214,10,0.1)", "rgba(255,214,10,0.25)"], ["1", "READY", "#30d158", "rgba(48,209,88,0.1)", "rgba(48,209,88,0.3)"]] as const).map(([count, label, color, bgColor, borderColor]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, background: bgColor, border: `1px solid ${borderColor}`, borderRadius: 12, padding: "6px 14px" }}>
              <span style={{ fontSize: 24, fontWeight: 900, color, letterSpacing: "-0.05em", lineHeight: 1 }}>{count}</span>
              <span style={{ fontSize: 11, color, fontWeight: 700, letterSpacing: "0.06em" }}>{label}</span>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "right", background: surfaceHigh, border: `1px solid ${border}`, borderRadius: 12, padding: "8px 18px" }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: textPrimary, letterSpacing: "-0.05em", lineHeight: 1 }}>6:42 PM</div>
          <div style={{ fontSize: 10, color: textMuted, fontWeight: 600, letterSpacing: "0.06em" }}>SATURDAY</div>
        </div>
      </div>

      {/* ORDER CARDS */}
      <div style={{ flex: 1, padding: "18px 20px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, overflowY: "auto", alignContent: "start" }}>
        {orders.map((order) => {
          const s = statusConfig[order.status as keyof typeof statusConfig];
          const urgentTime = parseInt(order.elapsed) > 6;
          return (
            <div key={order.id} style={{ background: surface, border: `1px solid rgba(255,255,255,0.06)`, borderRadius: 22, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>
              {/* Glowing top edge tinted by status */}
              <div style={{ height: 3, background: `linear-gradient(90deg, transparent, ${s.accent}, transparent)`, opacity: 0.8 }} />

              {/* Header */}
              <div style={{ padding: "14px 16px 12px", background: s.bgTint, borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: textPrimary, letterSpacing: "-0.06em", lineHeight: 1 }}>#{order.id}</div>
                    <div style={{ fontSize: 11, color: textMuted, marginTop: 3, fontWeight: 500 }}>
                      {order.type === "Online" ? "🌐" : "🏪"}  {order.name}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: urgentTime ? "#ff453a" : s.accent, letterSpacing: "-0.04em", lineHeight: 1 }}>{order.elapsed}</div>
                    <div style={{ fontSize: 10, color: textMuted, fontWeight: 600, letterSpacing: "0.05em", marginTop: 2 }}>ELAPSED</div>
                  </div>
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(0,0,0,0.25)", borderRadius: 10, padding: "5px 12px" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.accent, boxShadow: `0 0 10px ${s.glow}`, display: "inline-block" }} />
                  <span style={{ fontSize: 11, fontWeight: 900, color: s.accent, letterSpacing: "0.07em" }}>{s.label}</span>
                </div>
              </div>

              {/* Items checklist */}
              <div style={{ padding: "12px 16px", flex: 1 }}>
                {order.items.map((item, j) => (
                  <div key={j} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: j < order.items.length - 1 ? `1px solid rgba(255,255,255,0.04)` : "none" }}>
                    <div style={{ width: 22, height: 22, borderRadius: 7, background: item.made ? "rgba(48,209,88,0.15)" : surfaceHigh, border: `1px solid ${item.made ? "rgba(48,209,88,0.4)" : border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 12 }}>
                      {item.made && <span style={{ color: "#30d158", fontWeight: 900 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: item.made ? "#3a3c5a" : textPrimary, letterSpacing: "-0.02em", textDecoration: item.made ? "line-through" : "none" }}>
                        <span style={{ color: item.made ? "#3a3c5a" : orange, fontWeight: 900, marginRight: 5 }}>{item.qty}×</span>
                        {item.name}
                      </div>
                      {item.mods && <div style={{ fontSize: 11, color: "#4a4c6a", marginTop: 1, fontStyle: "italic" }}>{item.mods}</div>}
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div style={{ padding: "10px 14px 14px" }}>
                {order.status === "new" && (
                  <button style={{ width: "100%", background: `linear-gradient(135deg, ${orange}, #ff9500)`, color: "#fff", border: "none", borderRadius: 12, padding: "12px 0", fontSize: 13, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 18px rgba(255,107,0,0.35)" }}>
                    Start Cooking →
                  </button>
                )}
                {order.status === "preparing" && (
                  <button style={{ width: "100%", background: "rgba(48,209,88,0.12)", color: "#30d158", border: "1px solid rgba(48,209,88,0.35)", borderRadius: 12, padding: "12px 0", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                    Mark as Ready ✓
                  </button>
                )}
                {order.status === "ready" && (
                  <button style={{ width: "100%", background: "rgba(48,209,88,0.18)", color: "#30d158", border: "1px solid rgba(48,209,88,0.4)", borderRadius: 12, padding: "12px 0", fontSize: 13, fontWeight: 800, cursor: "pointer", boxShadow: "0 3px 12px rgba(48,209,88,0.2)" }}>
                    ✓ Picked Up — Complete
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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

  const statusConfig = {
    new:       { label: "NEW",       dot: "#ff6600", glow: "rgba(255,102,0,0.5)",   border: "rgba(255,102,0,0.25)",   bg: "rgba(255,102,0,0.06)" },
    preparing: { label: "COOKING",   dot: "#ffd60a", glow: "rgba(255,214,10,0.5)",  border: "rgba(255,214,10,0.2)",   bg: "rgba(255,214,10,0.04)" },
    ready:     { label: "READY  ✓",  dot: "#30d158", glow: "rgba(48,209,88,0.6)",   border: "rgba(48,209,88,0.3)",    bg: "rgba(48,209,88,0.06)" },
  } as const;

  const metalBase = { background: "linear-gradient(160deg, #28282c 0%, #202024 100%)", border: "1px solid rgba(255,255,255,0.07)" };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", background: "#0e0e10", color: "#f2f2f7", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* TOP BAR */}
      <div style={{ height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", ...metalBase, borderLeft: "none", borderRight: "none", borderTop: "none", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg, #ff6600, #ff8c00)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, boxShadow: "0 2px 10px rgba(255,102,0,0.4)" }}>🌮</div>
          <div>
            <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.025em" }}>Kitchen Display</span>
            <span style={{ fontSize: 13, color: "#48484a", marginLeft: 8 }}>Island Tacos</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          {[["4", "NEW"], ["2", "COOKING"], ["1", "READY"]].map(([count, label]) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.04em", color: label === "NEW" ? "#ff6600" : label === "COOKING" ? "#ffd60a" : "#30d158" }}>{count}</div>
              <div style={{ fontSize: 10, color: "#3a3a3c", fontWeight: 700, letterSpacing: "0.06em" }}>{label}</div>
            </div>
          ))}
          <div style={{ width: 1, height: 30, background: "rgba(255,255,255,0.05)" }} />
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#f2f2f7", letterSpacing: "-0.04em" }}>6:42 PM</div>
            <div style={{ fontSize: 10, color: "#3a3a3c", fontWeight: 600, letterSpacing: "0.04em" }}>SATURDAY</div>
          </div>
        </div>
      </div>

      {/* ORDER CARDS */}
      <div style={{ flex: 1, padding: "16px 18px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, overflowY: "auto", alignContent: "start" }}>
        {orders.map((order) => {
          const s = statusConfig[order.status as keyof typeof statusConfig];
          const urgentTime = parseInt(order.elapsed) > 6;
          return (
            <div key={order.id} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>
              {/* Top gloss */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${s.dot}44, transparent)` }} />

              {/* Card header */}
              <div style={{ padding: "14px 16px 12px", borderBottom: `1px solid ${s.border}`, background: "rgba(0,0,0,0.2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: 22, fontWeight: 900, color: "#f2f2f7", letterSpacing: "-0.05em" }}>#{order.id}</span>
                    <div style={{ fontSize: 11, color: "#636366", marginTop: 1, fontWeight: 500 }}>
                      {order.type === "Online" ? "🌐 Online" : "🏪 Walk-in"}  ·  {order.name}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: urgentTime ? "#ff453a" : s.dot, letterSpacing: "-0.04em" }}>{order.elapsed}</div>
                    <div style={{ fontSize: 10, color: "#3a3a3c", fontWeight: 600, letterSpacing: "0.04em" }}>ELAPSED</div>
                  </div>
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.3)", borderRadius: 7, padding: "4px 10px" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.dot, boxShadow: `0 0 8px ${s.glow}`, display: "inline-block" }} />
                  <span style={{ fontSize: 11, fontWeight: 800, color: s.dot, letterSpacing: "0.07em" }}>{s.label}</span>
                </div>
              </div>

              {/* Items */}
              <div style={{ padding: "10px 16px", flex: 1 }}>
                {order.items.map((item, j) => (
                  <div key={j} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: j < order.items.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                    <div style={{ width: 20, height: 20, borderRadius: 6, background: item.made ? "rgba(48,209,88,0.15)" : "rgba(255,255,255,0.05)", border: `1px solid ${item.made ? "rgba(48,209,88,0.35)" : "rgba(255,255,255,0.08)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11 }}>
                      {item.made ? <span style={{ color: "#30d158", fontWeight: 800 }}>✓</span> : null}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: item.made ? "#48484a" : "#e5e5ea", letterSpacing: "-0.015em", textDecoration: item.made ? "line-through" : "none" }}>
                        <span style={{ color: item.made ? "#3a3a3c" : "#ff8c00", fontWeight: 800, marginRight: 4 }}>{item.qty}×</span>
                        {item.name}
                      </div>
                      {item.mods && <div style={{ fontSize: 11, color: "#48484a", marginTop: 1, fontStyle: "italic" }}>{item.mods}</div>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action button */}
              <div style={{ padding: "10px 14px 14px" }}>
                {order.status === "new" && (
                  <button style={{ width: "100%", background: "linear-gradient(135deg, #ff6600, #ff8c00)", color: "#fff", border: "none", borderRadius: 9, padding: "11px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 3px 12px rgba(255,102,0,0.3)", letterSpacing: "-0.01em" }}>
                    Start Cooking →
                  </button>
                )}
                {order.status === "preparing" && (
                  <button style={{ width: "100%", background: "linear-gradient(135deg, #1c3a1e, #1a341c)", color: "#30d158", border: "1px solid rgba(48,209,88,0.3)", borderRadius: 9, padding: "11px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", letterSpacing: "-0.01em" }}>
                    Mark Ready ✓
                  </button>
                )}
                {order.status === "ready" && (
                  <button style={{ width: "100%", background: "rgba(48,209,88,0.15)", color: "#30d158", border: "1px solid rgba(48,209,88,0.3)", borderRadius: 9, padding: "11px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", letterSpacing: "-0.01em" }}>
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

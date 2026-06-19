export function ChalkAdmin() {
  const BG      = "#0c0905";
  const SURFACE = "#171009";
  const SIDEBAR = "#100c06";
  const BORDER  = "#4a3020";
  const CHALK   = "#F5ECD7";
  const MUTED   = "#9e8570";
  const ACCENT  = "#C8A882";
  const HUNTER  = "#2d6a4f";
  const HUNTER_LT = "#3d8f6a";
  const AMBER   = "#e8a030";
  const RED     = "#d4614a";

  const navItems = [
    { icon: "📊", label: "Dashboard",   active: true  },
    { icon: "🛒", label: "Live Orders", active: false },
    { icon: "☕", label: "Menu",        active: false },
    { icon: "💳", label: "Payments",    active: false },
    { icon: "📈", label: "Reports",     active: false },
    { icon: "⚙️", label: "Settings",    active: false },
  ];

  const stats = [
    { label: "Today's Revenue", value: "$842.50", sub: "+18% vs yesterday", col: ACCENT,    glow: "rgba(200,168,130,0.4)" },
    { label: "Orders Today",    value: "47",      sub: "12 pending",        col: HUNTER_LT, glow: "rgba(61,143,106,0.4)" },
    { label: "Avg Order",       value: "$17.90",  sub: "↑ $1.20 vs last wk",col: AMBER,    glow: "rgba(232,160,48,0.4)" },
    { label: "Top Item",        value: "Cedar Latte", sub: "Sold 23 today", col: MUTED,    glow: "rgba(158,133,112,0.3)" },
  ];

  const orders = [
    { code: "CC-0042", name: "Maria G.", items: "Pour Over, Avo Toast",       total: "$12.50", status: "Pending",  statusCol: AMBER },
    { code: "CC-0041", name: "Walk-in",  items: "Cedar Latte × 2, Croissant", total: "$15.50", status: "Making",   statusCol: HUNTER_LT },
    { code: "CC-0040", name: "James R.", items: "Cold Brew, Espresso Tonic",  total: "$11.50", status: "Ready",    statusCol: ACCENT },
    { code: "CC-0039", name: "Sarah K.", items: "Cortado × 2, Muffin × 2",   total: "$18.00", status: "Done",     statusCol: MUTED },
    { code: "CC-0038", name: "Walk-in",  items: "Flat White × 3",             total: "$16.50", status: "Done",     statusCol: MUTED },
  ];

  const cardShadow = "0 10px 36px rgba(0,0,0,0.85), 0 3px 10px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 0 28px rgba(200,168,130,0.03)";

  return (
    <div style={{ fontFamily: "'Lato', sans-serif", background: BG, color: CHALK, minHeight: "100vh", display: "flex" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=Lato:wght@300;400;700&display=swap');`}</style>

      {/* Sidebar */}
      <div style={{
        width: 220, background: `linear-gradient(180deg, #120e07 0%, #0c0905 100%)`,
        borderRight: `1px solid ${BORDER}`,
        display: "flex", flexDirection: "column", padding: "20px 0",
        boxShadow: "4px 0 24px rgba(0,0,0,0.6)",
      }}>
        <div style={{ padding: "0 20px 20px", borderBottom: `1px solid ${BORDER}` }}>
          <img src="/__mockup/cedar-logo-transparent.png" alt="Cedar Cafe"
            style={{ height: 52, objectFit: "contain", filter: "drop-shadow(0 2px 10px rgba(200,168,130,0.5)) brightness(1.15)" }} />
        </div>

        <nav style={{ padding: "16px 10px", flex: 1 }}>
          {navItems.map(item => (
            <div key={item.label} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px",
              borderRadius: 8, marginBottom: 2,
              background: item.active ? "linear-gradient(135deg, #2d1e12, #1e1408)" : "transparent",
              border: item.active ? `1px solid ${BORDER}` : "1px solid transparent",
              borderLeft: item.active ? `2px solid ${ACCENT}` : "2px solid transparent",
              color: item.active ? CHALK : MUTED,
              cursor: "pointer", fontSize: 13,
              boxShadow: item.active ? "0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)" : "none",
            }}>
              <span style={{ fontSize: 15 }}>{item.icon}</span>
              <span style={{ fontWeight: item.active ? 700 : 400 }}>{item.label}</span>
              {item.active && (
                <div style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: ACCENT, boxShadow: `0 0 8px ${ACCENT}` }} />
              )}
            </div>
          ))}
        </nav>

        <div style={{ padding: "16px 20px", borderTop: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>Logged in as</div>
          <div style={{ fontSize: 13, color: CHALK }}>Admin</div>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top bar */}
        <header style={{
          background: `linear-gradient(135deg, #1a1108 0%, #14100a 100%)`,
          borderBottom: `1px solid ${BORDER}`,
          padding: "14px 28px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
        }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, fontStyle: "italic", color: CHALK, textShadow: "0 2px 10px rgba(200,168,130,0.25)" }}>
              Good morning, Admin
            </div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Thursday, June 19 · 9:22 AM</div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{
              background: HUNTER + "30", border: `1px solid ${HUNTER}`, color: HUNTER_LT,
              borderRadius: 20, padding: "6px 14px", fontSize: 12, letterSpacing: 1,
              boxShadow: `0 0 14px rgba(45,106,79,0.3)`,
            }}>● Store Open</div>
            <div style={{
              background: AMBER + "20", border: `1px solid ${AMBER}`, color: AMBER,
              borderRadius: 20, padding: "6px 14px", fontSize: 12,
              boxShadow: `0 0 10px rgba(232,160,48,0.25)`,
            }}>12 Pending</div>
          </div>
        </header>

        <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
            {stats.map(stat => (
              <div key={stat.label} style={{
                background: "linear-gradient(145deg, #2a1c12, #1c1108)",
                border: `1px solid ${BORDER}`,
                borderRadius: 10, padding: "18px 20px",
                position: "relative",
                boxShadow: `0 10px 30px rgba(0,0,0,0.8), 0 3px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px rgba(255,255,255,0.02)`,
              }}>
                <div style={{ position: "absolute", top: 0, left: "10%", right: "10%", height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)" }} />
                <div style={{ fontSize: 10, color: MUTED, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>{stat.label}</div>
                <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, color: stat.col, marginBottom: 5, textShadow: `0 0 16px ${stat.glow}` }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 11, color: MUTED }}>{stat.sub}</div>
                {/* bottom glow bar */}
                <div style={{ position: "absolute", bottom: 0, left: "20%", right: "20%", height: 1, background: `linear-gradient(90deg, transparent, ${stat.col}44, transparent)`, borderRadius: 1 }} />
              </div>
            ))}
          </div>

          {/* Recent Orders */}
          <div style={{
            background: "linear-gradient(145deg, #251a0e, #1a1008)",
            border: `1px solid ${BORDER}`,
            borderRadius: 10,
            boxShadow: cardShadow,
            position: "relative",
          }}>
            <div style={{ position: "absolute", top: 0, left: "5%", right: "5%", height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)" }} />
            <div style={{
              padding: "16px 22px",
              borderBottom: `1px solid ${BORDER}`,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 17, fontStyle: "italic", color: CHALK, textShadow: "0 1px 6px rgba(200,168,130,0.2)" }}>
                Recent Orders
              </div>
              <div style={{ fontSize: 12, color: HUNTER_LT, cursor: "pointer", letterSpacing: 0.5 }}>View all →</div>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {["Order", "Customer", "Items", "Total", "Status"].map(h => (
                    <th key={h} style={{ padding: "10px 22px", textAlign: "left", fontSize: 10, color: MUTED, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((o, i) => (
                  <tr key={o.code} style={{ borderBottom: i < orders.length - 1 ? `1px solid ${BORDER}` : "none", transition: "background 0.15s" }}>
                    <td style={{ padding: "12px 22px", fontFamily: "'Playfair Display', Georgia, serif", color: CHALK, fontSize: 14 }}>{o.code}</td>
                    <td style={{ padding: "12px 22px", fontSize: 13, color: CHALK }}>{o.name}</td>
                    <td style={{ padding: "12px 22px", fontSize: 12, color: MUTED, maxWidth: 200 }}>{o.items}</td>
                    <td style={{ padding: "12px 22px", fontSize: 14, color: ACCENT, fontWeight: 700, textShadow: "0 0 8px rgba(200,168,130,0.3)" }}>{o.total}</td>
                    <td style={{ padding: "12px 22px" }}>
                      <span style={{
                        background: o.statusCol + "22", border: `1px solid ${o.statusCol}`, color: o.statusCol,
                        borderRadius: 20, padding: "3px 10px", fontSize: 11, letterSpacing: 0.5,
                        boxShadow: `0 0 8px ${o.statusCol}33`,
                      }}>{o.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

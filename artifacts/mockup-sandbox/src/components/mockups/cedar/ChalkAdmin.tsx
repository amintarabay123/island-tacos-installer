export function ChalkAdmin() {
  const BG      = "#0f0b07";
  const SURFACE = "#1a1208";
  const CARD    = "#221810";
  const SIDEBAR = "#130e07";
  const BORDER  = "#382818";
  const CHALK   = "#F5ECD7";
  const MUTED   = "#9e8570";
  const ACCENT  = "#C8A882";
  const GREEN   = "#7cba7a";
  const AMBER   = "#e8a030";
  const RED     = "#d4614a";

  const navItems = [
    { icon: "📊", label: "Dashboard",    active: true },
    { icon: "🛒", label: "Live Orders",  active: false },
    { icon: "☕", label: "Menu",         active: false },
    { icon: "💳", label: "Payments",     active: false },
    { icon: "📈", label: "Reports",      active: false },
    { icon: "⚙️", label: "Settings",     active: false },
  ];

  const stats = [
    { label: "Today's Revenue",  value: "$842.50", sub: "+18% vs yesterday", col: ACCENT },
    { label: "Orders Today",     value: "47",      sub: "12 pending",        col: GREEN },
    { label: "Avg Order",        value: "$17.90",  sub: "↑ $1.20 vs last wk",col: AMBER },
    { label: "Top Item",         value: "Cedar Latte", sub: "Sold 23 today", col: MUTED },
  ];

  const orders = [
    { code: "CC-0042", name: "Maria G.",   items: "Pour Over, Avo Toast",    total: "$12.50", status: "Pending",  statusCol: AMBER },
    { code: "CC-0041", name: "Walk-in",    items: "Cedar Latte × 2, Croissant", total: "$15.50", status: "Making", statusCol: GREEN },
    { code: "CC-0040", name: "James R.",   items: "Cold Brew, Espresso Tonic", total: "$11.50", status: "Ready",   statusCol: ACCENT },
    { code: "CC-0039", name: "Sarah K.",   items: "Cortado × 2, Muffin × 2", total: "$18.00", status: "Done",     statusCol: MUTED },
    { code: "CC-0038", name: "Walk-in",    items: "Flat White × 3",           total: "$16.50", status: "Done",     statusCol: MUTED },
  ];

  return (
    <div style={{ fontFamily: "'Lato', sans-serif", background: BG, color: CHALK, minHeight: "100vh", display: "flex" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=Lato:wght@300;400;700&display=swap');`}</style>

      {/* Sidebar */}
      <div style={{ width: 220, background: SIDEBAR, borderRight: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", padding: "20px 0" }}>
        <div style={{ padding: "0 20px 20px", borderBottom: `1px solid ${BORDER}` }}>
          <img src="/__mockup/cedar-logo-dark.jpg" alt="Cedar Cafe" style={{ height: 44, objectFit: "contain", borderRadius: 4 }} />
        </div>

        <nav style={{ padding: "16px 12px", flex: 1 }}>
          {navItems.map(item => (
            <div key={item.label} style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 6,
              marginBottom: 2,
              background: item.active ? CARD : "transparent",
              borderLeft: item.active ? `2px solid ${ACCENT}` : "2px solid transparent",
              color: item.active ? CHALK : MUTED,
              cursor: "pointer",
              fontSize: 13,
            }}>
              <span style={{ fontSize: 15 }}>{item.icon}</span>
              <span style={{ fontWeight: item.active ? 700 : 400 }}>{item.label}</span>
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
        <header style={{ background: SURFACE, borderBottom: `1px solid ${BORDER}`, padding: "14px 28px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, fontStyle: "italic", color: CHALK }}>Good morning, Admin</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Thursday, June 19 · 9:22 AM</div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ background: GREEN + "22", border: `1px solid ${GREEN}`, color: GREEN, borderRadius: 20, padding: "6px 14px", fontSize: 12, letterSpacing: 1 }}>● Store Open</div>
            <div style={{ background: AMBER + "22", border: `1px solid ${AMBER}`, color: AMBER, borderRadius: 20, padding: "6px 14px", fontSize: 12 }}>12 Pending</div>
          </div>
        </header>

        <div style={{ flex: 1, overflow: "auto", padding: 28 }}>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
            {stats.map(stat => (
              <div key={stat.label} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "18px 20px" }}>
                <div style={{ fontSize: 11, color: MUTED, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>{stat.label}</div>
                <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, color: stat.col, marginBottom: 4 }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: MUTED }}>{stat.sub}</div>
              </div>
            ))}
          </div>

          {/* Recent Orders */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8 }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 17, fontStyle: "italic", color: CHALK }}>Recent Orders</div>
              <div style={{ fontSize: 12, color: ACCENT, cursor: "pointer" }}>View all →</div>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {["Order", "Customer", "Items", "Total", "Status"].map(h => (
                    <th key={h} style={{ padding: "10px 20px", textAlign: "left", fontSize: 11, color: MUTED, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((o, i) => (
                  <tr key={o.code} style={{ borderBottom: i < orders.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                    <td style={{ padding: "12px 20px", fontFamily: "'Playfair Display', Georgia, serif", color: CHALK, fontSize: 14 }}>{o.code}</td>
                    <td style={{ padding: "12px 20px", fontSize: 13, color: CHALK }}>{o.name}</td>
                    <td style={{ padding: "12px 20px", fontSize: 12, color: MUTED, maxWidth: 220 }}>{o.items}</td>
                    <td style={{ padding: "12px 20px", fontSize: 14, color: ACCENT, fontWeight: 700 }}>{o.total}</td>
                    <td style={{ padding: "12px 20px" }}>
                      <span style={{ background: o.statusCol + "22", border: `1px solid ${o.statusCol}`, color: o.statusCol, borderRadius: 20, padding: "3px 10px", fontSize: 11, letterSpacing: 0.5 }}>{o.status}</span>
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

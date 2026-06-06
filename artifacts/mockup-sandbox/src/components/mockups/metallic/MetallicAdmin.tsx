export function MetallicAdmin() {
  // ── Palette ──────────────────────────────────────────────
  const bg        = "#13142a";
  const surface   = "#1a1b35";
  const surfaceHi = "#20214088";
  const border    = "rgba(255,255,255,0.06)";
  const tp        = "#e8eaf6";   // text primary
  const tm        = "#6b7094";   // text muted
  const orange    = "#ff6b00";
  const og        = "rgba(255,107,0,0.35)";
  const purple    = "#7c6af7";
  const pg        = "rgba(124,106,247,0.35)";
  const green     = "#30d158";
  const gg        = "rgba(48,209,88,0.3)";
  const blue      = "#0a84ff";
  const bg2       = "rgba(10,132,255,0.3)";

  // ── Data ─────────────────────────────────────────────────
  const stats = [
    { label: "Today's Revenue",  value: "$1,284", sub: "+18% vs yesterday",   icon: "💰", grad: `linear-gradient(135deg, ${orange} 0%, #ff9500 100%)`, glow: og    },
    { label: "Orders Today",     value: "47",     sub: "12 still open",        icon: "🧾", grad: `linear-gradient(135deg, ${purple} 0%, #a78bfa 100%)`, glow: pg    },
    { label: "Avg Order Value",  value: "$27.30", sub: "+$2.10 vs last week",  icon: "📈", grad: `linear-gradient(135deg, ${blue}   0%, #38bdf8 100%)`, glow: bg2   },
    { label: "Items Sold",       value: "213",    sub: "Carne Asada #1 seller",icon: "🌮", grad: `linear-gradient(135deg, ${green}  0%, #34d399 100%)`, glow: gg    },
  ];

  const liveOrders = [
    { id: "251", name: "Walk-in",    items: "Carne Asada ×2, Horchata ×1",   total: 36, method: "Cash",   status: "preparing", wait: "2m" },
    { id: "250", name: "Marcus B.",  items: "Fish Tacos ×1, Veggie Bowl ×1", total: 24, method: "Online",  status: "new",       wait: "1m" },
    { id: "249", name: "Walk-in",    items: "Al Pastor ×3",                  total: 36, method: "Card",   status: "ready",     wait: "7m" },
    { id: "248", name: "Sarah K.",   items: "Chicken Burrito ×2",            total: 26, method: "ATH",    status: "preparing", wait: "5m" },
    { id: "247", name: "Walk-in",    items: "Chips & Salsa, Jamaica ×2",     total: 13, method: "Cash",   status: "done",      wait: "—"  },
  ];

  const topItems = [
    { name: "Carne Asada Tacos", qty: 48, pct: 90 },
    { name: "Fish Tacos",        qty: 36, pct: 67 },
    { name: "Chicken Burrito",   qty: 29, pct: 54 },
    { name: "Al Pastor Tacos",   qty: 24, pct: 45 },
    { name: "Horchata",          qty: 22, pct: 41 },
    { name: "Veggie Bowl",       qty: 17, pct: 32 },
  ];

  const methods = [
    { label: "Cash",   pct: 42, amount: "$539", color: orange },
    { label: "Card",   pct: 31, amount: "$398", color: purple },
    { label: "ATH",    pct: 18, amount: "$231", color: blue   },
    { label: "Online", pct: 9,  amount: "$116", color: green  },
  ];

  // ── SVG area chart (last 8 hours) ────────────────────────
  const chartData = [28, 45, 62, 41, 88, 110, 96, 128];
  const maxVal = Math.max(...chartData);
  const W = 520; const H = 120;
  const pts = chartData.map((v, i) => [i * (W / (chartData.length - 1)), H - (v / maxVal) * (H - 16)]);
  const pathD = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
  const areaD = `${pathD} L ${W} ${H} L 0 ${H} Z`;

  // Status helpers
  const statusStyle = (s: string) => ({
    new:       { bg: "rgba(255,107,0,0.15)",   color: orange, label: "NEW"      },
    preparing: { bg: "rgba(255,214,10,0.12)",  color: "#ffd60a", label: "COOKING" },
    ready:     { bg: "rgba(48,209,88,0.15)",   color: green,  label: "READY"   },
    done:      { bg: "rgba(107,112,148,0.15)", color: tm,     label: "DONE"    },
  } as any)[s] ?? { bg: "transparent", color: tm, label: s.toUpperCase() };

  const navItems = [
    { icon: "⊞", label: "Dashboard", active: true  },
    { icon: "🧾", label: "Orders",    active: false },
    { icon: "🌮", label: "Menu",      active: false },
    { icon: "📊", label: "Reports",   active: false },
    { icon: "⚙️", label: "Settings",  active: false },
  ];

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: bg, color: tp, height: "100vh", display: "flex", overflow: "hidden", fontSize: 13 }}>

      {/* ── SIDEBAR ───────────────────────────────────────── */}
      <div style={{ width: 64, display: "flex", flexDirection: "column", alignItems: "center", borderRight: `1px solid ${border}`, background: "rgba(19,20,42,0.9)", padding: "16px 0", gap: 4, flexShrink: 0 }}>
        {/* Logo */}
        <div style={{ width: 36, height: 36, borderRadius: 12, background: `linear-gradient(135deg, ${orange}, #ff9500)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, boxShadow: `0 4px 16px ${og}`, marginBottom: 16 }}>🌮</div>
        {navItems.map((n) => (
          <div key={n.label} title={n.label} style={{ width: 44, height: 44, borderRadius: 13, background: n.active ? `rgba(255,107,0,0.15)` : "transparent", border: n.active ? `1px solid rgba(255,107,0,0.3)` : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, cursor: "pointer", transition: "all 0.15s", color: n.active ? orange : tm }}>
            {n.icon}
          </div>
        ))}
        {/* Spacer + staff avatar */}
        <div style={{ flex: 1 }} />
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg, ${purple}, #a78bfa)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, boxShadow: `0 2px 10px ${pg}` }}>👤</div>
      </div>

      {/* ── MAIN AREA ─────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Top bar */}
        <div style={{ height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", borderBottom: `1px solid ${border}`, background: "rgba(19,20,42,0.9)", backdropFilter: "blur(20px)", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.03em" }}>Dashboard</div>
            <div style={{ fontSize: 11, color: tm, fontWeight: 500 }}>Saturday, June 6, 2026  ·  Island Tacos</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: surfaceHi, border: `1px solid ${border}`, borderRadius: 10, padding: "6px 12px" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: green, boxShadow: `0 0 8px ${gg}`, display: "inline-block" }} />
              <span style={{ fontSize: 12, color: tm, fontWeight: 600 }}>Store Open</span>
            </div>
            <button style={{ background: `linear-gradient(135deg, ${orange}, #ff9500)`, color: "#fff", border: "none", borderRadius: 10, padding: "8px 18px", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: `0 3px 12px ${og}` }}>+ New Order</button>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* STAT CARDS */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {stats.map((s) => (
              <div key={s.label} style={{ background: surface, border: `1px solid ${border}`, borderRadius: 20, padding: "18px 20px", position: "relative", overflow: "hidden" }}>
                {/* Gradient top stripe */}
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: s.grad, opacity: 0.9 }} />
                {/* Background glow blob */}
                <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, background: s.glow.replace("0.35", "0.12"), borderRadius: "50%", filter: "blur(20px)", pointerEvents: "none" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <span style={{ fontSize: 11, color: tm, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>{s.label}</span>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: `${s.glow.replace("0.35", "0.15")}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>{s.icon}</div>
                </div>
                <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.05em", color: tp, lineHeight: 1, marginBottom: 6 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: s.sub.startsWith("+") ? green : tm, fontWeight: 500 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* MID ROW: chart + live orders */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 14 }}>

            {/* Revenue chart */}
            <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 20, padding: "18px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.025em" }}>Revenue Today</div>
                  <div style={{ fontSize: 11, color: tm, fontWeight: 500, marginTop: 1 }}>Last 8 hours</div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: orange, letterSpacing: "-0.04em" }}>$1,284</div>
              </div>
              <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={120} style={{ overflow: "visible", display: "block" }}>
                <defs>
                  <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={orange} stopOpacity="0.35" />
                    <stop offset="100%" stopColor={orange} stopOpacity="0.03" />
                  </linearGradient>
                </defs>
                <path d={areaD} fill="url(#chartFill)" />
                <path d={pathD} fill="none" stroke={orange} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                {pts.map(([x, y], i) => (
                  <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 5 : 3} fill={orange} style={{ filter: i === pts.length - 1 ? `drop-shadow(0 0 6px ${orange})` : undefined }} />
                ))}
                {/* X labels */}
                {["9am","10am","11am","12pm","1pm","2pm","3pm","Now"].map((l, i) => (
                  <text key={l} x={i * (W / 7)} y={H + 14} textAnchor="middle" fontSize="9" fill={tm} fontFamily="Inter, sans-serif">{l}</text>
                ))}
              </svg>
              {/* Mini method pills */}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                {methods.map((m) => (
                  <div key={m.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: m.color, display: "inline-block" }} />
                    <span style={{ fontSize: 10, color: tm, fontWeight: 600 }}>{m.label} {m.pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Live orders */}
            <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 20, overflow: "hidden" }}>
              <div style={{ padding: "16px 18px 12px", borderBottom: `1px solid ${border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.025em" }}>Live Orders</div>
                  <div style={{ fontSize: 11, color: tm, marginTop: 1 }}>3 need attention</div>
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,107,0,0.12)", border: "1px solid rgba(255,107,0,0.25)", borderRadius: 8, padding: "4px 10px" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: orange, boxShadow: `0 0 8px ${og}`, display: "inline-block" }} />
                  <span style={{ fontSize: 11, color: orange, fontWeight: 700 }}>LIVE</span>
                </div>
              </div>
              <div>
                {liveOrders.map((o, i) => {
                  const ss = statusStyle(o.status);
                  return (
                    <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", borderBottom: i < liveOrders.length - 1 ? `1px solid rgba(255,255,255,0.03)` : "none", opacity: o.status === "done" ? 0.4 : 1 }}>
                      <span style={{ fontSize: 14, fontWeight: 900, color: o.status === "done" ? tm : tp, letterSpacing: "-0.03em", minWidth: 34 }}>#{o.id}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: tp, letterSpacing: "-0.01em" }}>{o.name}</div>
                        <div style={{ fontSize: 11, color: tm, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.items}</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: tp }}>${o.total}</div>
                        <div style={{ fontSize: 10, color: tm, fontWeight: 500 }}>{o.method}</div>
                      </div>
                      <div style={{ background: ss.bg, color: ss.color, fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", borderRadius: 8, padding: "4px 8px", minWidth: 56, textAlign: "center" }}>{ss.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* BOTTOM ROW: top items + payment breakdown */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, paddingBottom: 8 }}>

            {/* Top selling items */}
            <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 20, padding: "18px 20px" }}>
              <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.025em", marginBottom: 2 }}>Top Sellers Today</div>
              <div style={{ fontSize: 11, color: tm, marginBottom: 14 }}>By units sold</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {topItems.map((item, i) => (
                  <div key={item.name}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: i < 3 ? orange : tm, minWidth: 16, textAlign: "center" }}>{i + 1}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: tp, letterSpacing: "-0.01em" }}>{item.name}</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 800, color: tp }}>{item.qty} sold</span>
                    </div>
                    <div style={{ height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${item.pct}%`, borderRadius: 4, background: i === 0 ? `linear-gradient(90deg, ${orange}, #ff9500)` : i === 1 ? `linear-gradient(90deg, ${purple}, #a78bfa)` : i === 2 ? `linear-gradient(90deg, ${blue}, #38bdf8)` : `rgba(255,255,255,0.15)`, boxShadow: i === 0 ? `0 0 8px ${og}` : "none", transition: "width 0.4s ease" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment breakdown */}
            <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 20, padding: "18px 20px" }}>
              <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.025em", marginBottom: 2 }}>Payment Breakdown</div>
              <div style={{ fontSize: 11, color: tm, marginBottom: 18 }}>Today's revenue by method</div>

              {/* Donut SVG */}
              <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                <svg width={110} height={110} viewBox="0 0 110 110" style={{ flexShrink: 0 }}>
                  {(() => {
                    const cx = 55, cy = 55, r = 40, sw = 14;
                    let offset = 0;
                    const circumference = 2 * Math.PI * r;
                    return methods.map((m) => {
                      const dash = (m.pct / 100) * circumference;
                      const gap  = circumference - dash;
                      const rot  = (offset / 100) * 360 - 90;
                      offset += m.pct;
                      return (
                        <circle key={m.label} cx={cx} cy={cy} r={r}
                          fill="none" stroke={m.color} strokeWidth={sw}
                          strokeDasharray={`${dash} ${gap}`}
                          strokeLinecap="butt"
                          style={{ transform: `rotate(${rot}deg)`, transformOrigin: `${cx}px ${cy}px` }}
                        />
                      );
                    });
                  })()}
                  <text x="55" y="51" textAnchor="middle" fontSize="14" fontWeight="900" fill={tp} fontFamily="Inter,sans-serif">$1,284</text>
                  <text x="55" y="63" textAnchor="middle" fontSize="8" fill={tm} fontFamily="Inter,sans-serif">TOTAL</text>
                </svg>

                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                  {methods.map((m) => (
                    <div key={m.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: m.color, boxShadow: `0 0 6px ${m.color}88` }} />
                        <span style={{ fontSize: 12, color: tm, fontWeight: 600 }}>{m.label}</span>
                      </div>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: tm }}>{m.pct}%</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: tp, minWidth: 44, textAlign: "right" }}>{m.amount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

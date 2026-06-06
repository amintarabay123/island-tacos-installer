export function MetallicAdmin() {
  // ── Palette ──────────────────────────────────────────────────────────
  const bg     = "#16172b";   // unified surface — sidebar + main share this
  const card   = "#1e1f38";   // slightly lighter card surface
  const border = "rgba(255,255,255,0.06)";
  const tp     = "#e8eaf6";
  const tm     = "#7077a1";

  // ── Chart data ────────────────────────────────────────────────────────
  const hourlyRevenue = [28, 45, 62, 41, 88, 110, 96, 128];
  const maxVal = Math.max(...hourlyRevenue);
  const W = 480; const H = 100;
  const pts = hourlyRevenue.map((v, i) => [
    i * (W / (hourlyRevenue.length - 1)),
    H - (v / maxVal) * (H - 12),
  ]);
  const lineD = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
  const areaD = `${lineD} L ${W} ${H} L 0 ${H} Z`;

  // ── Live orders ───────────────────────────────────────────────────────
  const orders = [
    { id: "251", name: "Walk-in",   items: "Carne Asada ×2, Horchata ×1",   total: 36, method: "Cash",  status: "cooking", wait: "2m" },
    { id: "250", name: "Marcus B.", items: "Fish Tacos ×1, Veggie Bowl ×1", total: 24, method: "Online", status: "new",     wait: "1m" },
    { id: "249", name: "Walk-in",   items: "Al Pastor ×3",                  total: 36, method: "Card",  status: "ready",   wait: "7m" },
    { id: "248", name: "Sarah K.",  items: "Chicken Burrito ×2",            total: 26, method: "ATH",   status: "cooking", wait: "5m" },
    { id: "247", name: "David P.",  items: "Chips, Jamaica ×2",             total: 13, method: "Cash",  status: "done",    wait: "—" },
  ];
  const statusCfg: Record<string, { bg: string; color: string; label: string }> = {
    new:     { bg: "rgba(255,107,0,0.18)",   color: "#ff6b00", label: "NEW"    },
    cooking: { bg: "rgba(255,214,10,0.14)",  color: "#ffd60a", label: "COOKING"},
    ready:   { bg: "rgba(48,209,88,0.15)",   color: "#30d158", label: "READY"  },
    done:    { bg: "rgba(107,112,148,0.1)",  color: tm,        label: "DONE"   },
  };

  // ── Nav ───────────────────────────────────────────────────────────────
  const navItems = [
    { icon: "⊞", label: "Dashboard", active: true  },
    { icon: "🧾", label: "Orders",    active: false },
    { icon: "🌮", label: "Menu",      active: false },
    { icon: "📊", label: "Reports",   active: false },
    { icon: "⚙️", label: "Settings",  active: false },
  ];

  // ── Featured stat cards (the pop-out ones) ────────────────────────────
  const featCards = [
    {
      art: ["🌮","🥩"],
      grad: "linear-gradient(145deg, #ff6b00 0%, #ff3d00 60%, #c0392b 100%)",
      glow: "rgba(255,107,0,0.55)",
      label: "Today's Revenue",
      value: "$1,284",
      sub: "↑ 18% vs yesterday",
      subColor: "rgba(255,255,255,0.75)",
    },
    {
      art: ["🧾","📋"],
      grad: "linear-gradient(145deg, #7c6af7 0%, #5b4cf5 60%, #3730a3 100%)",
      glow: "rgba(124,106,247,0.55)",
      label: "Orders Today",
      value: "47",
      sub: "12 still open",
      subColor: "rgba(255,255,255,0.7)",
    },
    {
      art: ["📈","💹"],
      grad: "linear-gradient(145deg, #0ea5e9 0%, #0284c7 60%, #1e3a8a 100%)",
      glow: "rgba(14,165,233,0.5)",
      label: "Avg Order Value",
      value: "$27.30",
      sub: "↑ $2.10 vs last week",
      subColor: "rgba(255,255,255,0.7)",
    },
    {
      art: ["🥑","🐟"],
      grad: "linear-gradient(145deg, #10b981 0%, #059669 60%, #064e3b 100%)",
      glow: "rgba(16,185,129,0.5)",
      label: "Items Sold",
      value: "213",
      sub: "Carne Asada #1 today",
      subColor: "rgba(255,255,255,0.7)",
    },
  ];

  const topItems = [
    { name: "Carne Asada Tacos", qty: 48, pct: 90 },
    { name: "Fish Tacos",        qty: 36, pct: 67 },
    { name: "Chicken Burrito",   qty: 29, pct: 54 },
    { name: "Al Pastor Tacos",   qty: 24, pct: 45 },
    { name: "Horchata",          qty: 22, pct: 41 },
  ];

  const methods = [
    { label: "Cash",   pct: 42, amount: "$539", color: "#ff6b00" },
    { label: "Card",   pct: 31, amount: "$398", color: "#7c6af7" },
    { label: "ATH",    pct: 18, amount: "$231", color: "#0ea5e9" },
    { label: "Online", pct:  9, amount: "$116", color: "#10b981" },
  ];

  return (
    // Outer wrapper — sidebar + main share THE SAME bg, creating the "morphed" look
    <div style={{
      fontFamily: "'Inter', system-ui, sans-serif",
      background: bg,
      color: tp,
      height: "100vh",
      display: "flex",
      overflow: "hidden",
      fontSize: 13,
    }}>

      {/* ── SIDEBAR — same bg, no border separation ──────── */}
      <div style={{
        width: 72,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "18px 0 16px",
        gap: 6,
        flexShrink: 0,
        // No border-right on purpose — bleeds into main
        background: "transparent",
        position: "relative",
        zIndex: 2,
      }}>
        {/* Logo — glows and anchors the brand */}
        <div style={{
          width: 40, height: 40, borderRadius: 14,
          background: "linear-gradient(135deg, #ff6b00, #ff9500)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, marginBottom: 20,
          boxShadow: "0 0 0 1px rgba(255,107,0,0.3), 0 6px 24px rgba(255,107,0,0.45)",
        }}>🌮</div>

        {navItems.map((n) => (
          <div key={n.label} title={n.label} style={{
            width: 48, height: 48, borderRadius: 15,
            background: n.active ? "rgba(255,107,0,0.15)" : "rgba(255,255,255,0.03)",
            border: n.active ? "1px solid rgba(255,107,0,0.4)" : "1px solid rgba(255,255,255,0.05)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 19, cursor: "pointer",
            boxShadow: n.active ? "0 0 14px rgba(255,107,0,0.25)" : "none",
          }}>
            <span style={{ filter: n.active ? "none" : "grayscale(1) opacity(0.45)" }}>{n.icon}</span>
          </div>
        ))}

        <div style={{ flex: 1 }} />

        {/* Staff */}
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          background: "linear-gradient(135deg, #7c6af7, #a78bfa)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18,
          boxShadow: "0 0 0 2px rgba(124,106,247,0.35), 0 4px 14px rgba(124,106,247,0.3)",
        }}>👤</div>
      </div>

      {/* ── MAIN ─────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Top bar — floating, no hard border */}
        <div style={{
          height: 58, display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: "0 28px",
          background: "transparent",
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: "-0.04em", color: tp }}>Dashboard</div>
            <div style={{ fontSize: 11, color: tm, fontWeight: 500, marginTop: 1 }}>Saturday, June 6, 2026  ·  Island Tacos</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {/* Live pill */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              background: "rgba(48,209,88,0.1)", border: "1px solid rgba(48,209,88,0.25)",
              borderRadius: 20, padding: "7px 14px",
            }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#30d158", boxShadow: "0 0 8px rgba(48,209,88,0.8)", display: "inline-block" }} />
              <span style={{ fontSize: 12, color: "#30d158", fontWeight: 700 }}>Store Open</span>
            </div>
            {/* Revenue badge */}
            <div style={{
              background: "rgba(255,107,0,0.12)", border: "1px solid rgba(255,107,0,0.25)",
              borderRadius: 20, padding: "7px 18px", fontSize: 13, fontWeight: 800, color: "#ff6b00",
            }}>$1,284 today</div>
            <button style={{
              background: "linear-gradient(135deg, #ff6b00, #ff9500)", color: "#fff",
              border: "none", borderRadius: 20, padding: "8px 20px",
              fontSize: 12, fontWeight: 800, cursor: "pointer",
              boxShadow: "0 4px 18px rgba(255,107,0,0.4)",
            }}>+ New Order</button>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 28px 28px" }}>

          {/* ── POP-OUT STAT CARDS ─────────────────────────────── */}
          {/* Extra padding-top so the floating art has room */}
          <div style={{ paddingTop: 52, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
            {featCards.map((fc) => (
              <div key={fc.label} style={{ position: "relative" }}>
                {/* ── Floating 3-D art above card ── */}
                <div style={{
                  position: "absolute", top: -44, left: "50%",
                  transform: "translateX(-50%)",
                  zIndex: 10,
                  display: "flex", gap: -4, alignItems: "flex-end",
                  filter: `drop-shadow(0 8px 24px ${fc.glow})`,
                  pointerEvents: "none",
                }}>
                  {/* Back emoji (slightly behind, smaller) */}
                  <span style={{
                    fontSize: 46, lineHeight: 1,
                    transform: "rotate(-15deg) translateX(8px)",
                    opacity: 0.7,
                    filter: `blur(1px) drop-shadow(0 0 12px ${fc.glow})`,
                  }}>{fc.art[1]}</span>
                  {/* Front emoji (bigger, crisp) */}
                  <span style={{
                    fontSize: 62, lineHeight: 1,
                    transform: "rotate(8deg) translateX(-4px)",
                    filter: `drop-shadow(0 0 20px ${fc.glow})`,
                  }}>{fc.art[0]}</span>
                </div>

                {/* ── Card body ── */}
                <div style={{
                  background: fc.grad,
                  borderRadius: 22,
                  padding: "52px 20px 20px",
                  position: "relative",
                  overflow: "hidden",
                  boxShadow: `0 8px 32px ${fc.glow}`,
                }}>
                  {/* Inner shine overlay */}
                  <div style={{
                    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                    background: "linear-gradient(160deg, rgba(255,255,255,0.12) 0%, transparent 50%)",
                    borderRadius: 22, pointerEvents: "none",
                  }} />
                  {/* Glowing orb behind the art */}
                  <div style={{
                    position: "absolute", top: -30, left: "50%",
                    transform: "translateX(-50%)",
                    width: 100, height: 100,
                    background: "rgba(255,255,255,0.15)",
                    borderRadius: "50%", filter: "blur(24px)",
                    pointerEvents: "none",
                  }} />
                  <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.65)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>{fc.label}</div>
                  <div style={{ fontSize: 34, fontWeight: 900, color: "#fff", letterSpacing: "-0.05em", lineHeight: 1, marginBottom: 6 }}>{fc.value}</div>
                  <div style={{ fontSize: 11, color: fc.subColor, fontWeight: 500 }}>{fc.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── MIDDLE ROW ─────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 16, marginBottom: 16 }}>

            {/* Revenue chart card */}
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 22, padding: "20px 22px", position: "relative", overflow: "hidden" }}>
              {/* Corner shine */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 80, background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%)", pointerEvents: "none" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.03em" }}>Revenue Today</div>
                  <div style={{ fontSize: 11, color: tm, marginTop: 2 }}>Hourly — last 8 hours</div>
                </div>
                {/* Mini pill row */}
                <div style={{ display: "flex", gap: 6 }}>
                  {["9am","12pm","Now"].map((l, i) => (
                    <div key={l} style={{ background: i === 2 ? "rgba(255,107,0,0.2)" : "rgba(255,255,255,0.05)", border: `1px solid ${i === 2 ? "rgba(255,107,0,0.4)" : border}`, borderRadius: 20, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: i === 2 ? "#ff6b00" : tm }}>{l}</div>
                  ))}
                </div>
              </div>
              <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H + 20} style={{ overflow: "visible", display: "block" }}>
                <defs>
                  <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff6b00" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#ff6b00" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                <path d={areaD} fill="url(#ag)" />
                <path d={lineD} fill="none" stroke="#ff6b00" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                {pts.map(([x, y], i) => (
                  <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 6 : 3.5}
                    fill={i === pts.length - 1 ? "#fff" : "#ff6b00"}
                    stroke={i === pts.length - 1 ? "#ff6b00" : "none"}
                    strokeWidth={i === pts.length - 1 ? 2.5 : 0}
                    style={{ filter: i === pts.length - 1 ? "drop-shadow(0 0 8px #ff6b00)" : undefined }} />
                ))}
                {["9am","10","11","12pm","1","2","3","Now"].map((l, i) => (
                  <text key={l} x={i * (W / 7)} y={H + 16} textAnchor="middle" fontSize="9" fill={tm} fontFamily="Inter,sans-serif">{l}</text>
                ))}
              </svg>
            </div>

            {/* Live orders */}
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 22, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.03em" }}>Live Orders</div>
                  <div style={{ fontSize: 11, color: tm, marginTop: 2 }}>3 need attention</div>
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,107,0,0.12)", border: "1px solid rgba(255,107,0,0.3)", borderRadius: 10, padding: "4px 10px" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff6b00", boxShadow: "0 0 8px rgba(255,107,0,0.8)", display: "inline-block" }} />
                  <span style={{ fontSize: 11, color: "#ff6b00", fontWeight: 800, letterSpacing: "0.06em" }}>LIVE</span>
                </div>
              </div>
              <div>
                {orders.map((o, i) => {
                  const ss = statusCfg[o.status] ?? statusCfg.done;
                  return (
                    <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 20px", borderTop: `1px solid rgba(255,255,255,0.03)`, opacity: o.status === "done" ? 0.38 : 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 900, color: o.status === "done" ? tm : tp, letterSpacing: "-0.03em", minWidth: 32 }}>#{o.id}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: tp }}>{o.name}</div>
                        <div style={{ fontSize: 11, color: tm, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.items}</div>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 800, color: tp, flexShrink: 0 }}>${o.total}</span>
                      <div style={{ background: ss.bg, color: ss.color, fontSize: 10, fontWeight: 800, borderRadius: 8, padding: "3px 8px", minWidth: 54, textAlign: "center", letterSpacing: "0.04em", flexShrink: 0 }}>{ss.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── BOTTOM ROW ─────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

            {/* Top sellers */}
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 22, padding: "20px 22px" }}>
              <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 2 }}>Top Sellers</div>
              <div style={{ fontSize: 11, color: tm, marginBottom: 18 }}>By units sold today</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                {topItems.map((item, i) => {
                  const barColor = i === 0 ? "#ff6b00" : i === 1 ? "#7c6af7" : i === 2 ? "#0ea5e9" : "rgba(255,255,255,0.2)";
                  return (
                    <div key={item.name}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 900, color: i < 3 ? barColor : tm, width: 16, textAlign: "center" }}>{i + 1}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: tp }}>{item.name}</span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 800, color: tp }}>{item.qty}</span>
                      </div>
                      <div style={{ height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${item.pct}%`, borderRadius: 4, background: i < 3 ? barColor : "rgba(255,255,255,0.12)", boxShadow: i < 3 ? `0 0 8px ${barColor}88` : "none" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Payment breakdown with donut */}
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 22, padding: "20px 22px" }}>
              <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 2 }}>Payments</div>
              <div style={{ fontSize: 11, color: tm, marginBottom: 16 }}>By method, today</div>
              <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                {/* Donut */}
                <svg width={120} height={120} viewBox="0 0 120 120" style={{ flexShrink: 0 }}>
                  {(() => {
                    const cx = 60, cy = 60, r = 44, sw = 14;
                    const circ = 2 * Math.PI * r;
                    let offset = 0;
                    return methods.map((m) => {
                      const dash = (m.pct / 100) * circ;
                      const gap  = circ - dash;
                      const rot  = (offset / 100) * 360 - 90;
                      offset += m.pct;
                      return (
                        <circle key={m.label} cx={cx} cy={cy} r={r}
                          fill="none" stroke={m.color} strokeWidth={sw}
                          strokeDasharray={`${dash} ${gap}`}
                          strokeLinecap="butt"
                          style={{ transform: `rotate(${rot}deg)`, transformOrigin: `${cx}px ${cy}px`,
                            filter: `drop-shadow(0 0 6px ${m.color}88)` }}
                        />
                      );
                    });
                  })()}
                  <text x="60" y="55" textAnchor="middle" fontSize="15" fontWeight="900" fill={tp} fontFamily="Inter,sans-serif">$1,284</text>
                  <text x="60" y="68" textAnchor="middle" fontSize="8" fill={tm} fontFamily="Inter,sans-serif" fontWeight="600" letterSpacing="0.05em">TOTAL</text>
                </svg>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 11 }}>
                  {methods.map((m) => (
                    <div key={m.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: m.color, boxShadow: `0 0 8px ${m.color}99` }} />
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

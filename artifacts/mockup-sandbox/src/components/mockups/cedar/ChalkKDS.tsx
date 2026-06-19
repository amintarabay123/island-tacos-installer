export function ChalkKDS() {
  const BG      = "#0a0806";
  const SURFACE = "#151009";
  const BORDER  = "#4a3020";
  const CHALK   = "#F5ECD7";
  const MUTED   = "#9e8570";
  const ACCENT  = "#C8A882";
  const HUNTER  = "#2d6a4f";
  const HUNTER_LT = "#3d8f6a";
  const AMBER   = "#e8a030";
  const RED     = "#d4614a";

  const now = () => {
    const d = new Date();
    return `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`;
  };

  const orders = {
    new: [
      { code: "CC-0041", time: "09:14", items: ["Cedar Latte × 1", "Flat White × 2", "Croissant × 1"], mins: 2 },
      { code: "CC-0042", time: "09:16", items: ["Pour Over × 1", "Avocado Toast × 1"], mins: 1 },
    ],
    making: [
      { code: "CC-0039", time: "09:08", items: ["Cortado × 2", "Matcha Latte × 1", "Blueberry Muffin × 2"], mins: 8 },
      { code: "CC-0040", time: "09:11", items: ["Cold Brew × 1", "Espresso Tonic × 1"], mins: 5 },
    ],
    ready: [
      { code: "CC-0037", time: "08:58", items: ["Cappuccino × 3", "Almond Croissant × 1"], mins: 16 },
    ],
  };

  const cardShadow = (col: string) =>
    `0 12px 36px rgba(0,0,0,0.9), 0 3px 10px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 0 30px rgba(200,168,130,0.03), 0 0 0 1px rgba(255,255,255,0.02)`;

  const StatusBadge = ({ mins, col }: { mins: number; col: string }) => (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: col + "22", border: `1px solid ${col}`,
      borderRadius: 20, padding: "3px 10px",
      boxShadow: `0 0 10px ${col}33`,
    }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: col, boxShadow: `0 0 6px ${col}` }} />
      <span style={{ fontFamily: "'Lato', sans-serif", fontSize: 11, color: col, letterSpacing: 0.5 }}>{mins}m ago</span>
    </div>
  );

  const OrderCard = ({ order, col, label }: { order: typeof orders.new[0]; col: string; label: string }) => (
    <div style={{
      background: "linear-gradient(145deg, #2a1c12, #1c1008)",
      border: `1px solid ${BORDER}`,
      borderLeft: `3px solid ${col}`,
      borderRadius: 10,
      padding: "16px 18px",
      marginBottom: 14,
      position: "relative",
      boxShadow: cardShadow(col),
    }}>
      {/* top-edge highlight */}
      <div style={{ position: "absolute", top: 0, left: "8%", right: "8%", height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)" }} />
      {/* left accent glow */}
      <div style={{ position: "absolute", left: 0, top: "15%", bottom: "15%", width: 3, borderRadius: "0 2px 2px 0", background: col, boxShadow: `0 0 12px ${col}88` }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 19, color: CHALK, textShadow: "0 1px 6px rgba(200,168,130,0.25)" }}>
          {order.code}
        </span>
        <StatusBadge mins={order.mins} col={col} />
      </div>

      <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 11, color: MUTED, marginBottom: 10, letterSpacing: 0.5 }}>
        Ordered at {order.time}
      </div>

      <div style={{ borderTop: `1px dashed ${BORDER}`, paddingTop: 10 }}>
        {order.items.map(item => (
          <div key={item} style={{ fontFamily: "'Lato', sans-serif", fontSize: 13, color: CHALK, padding: "3px 0", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: col, fontSize: 10 }}>◆</span> {item}
          </div>
        ))}
      </div>

      <button style={{
        marginTop: 14, width: "100%",
        background: `linear-gradient(135deg, ${col}28, ${col}10)`,
        border: `1px solid ${col}`,
        color: col, borderRadius: 6, padding: "9px 0",
        fontFamily: "'Lato', sans-serif", fontSize: 11, fontWeight: 700,
        cursor: "pointer", letterSpacing: 1.2, textTransform: "uppercase",
        boxShadow: `0 4px 16px rgba(0,0,0,0.4), 0 0 12px ${col}22, inset 0 1px 0 rgba(255,255,255,0.06)`,
        transition: "box-shadow 0.2s, transform 0.2s",
      }}>{label}</button>
    </div>
  );

  return (
    <div style={{ fontFamily: "'Lato', sans-serif", background: BG, color: CHALK, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=Lato:wght@300;400;700&display=swap');`}</style>

      {/* Header */}
      <header style={{
        background: `linear-gradient(135deg, #151009 0%, #1e1510 100%)`,
        borderBottom: `1px solid ${BORDER}`,
        padding: "14px 28px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 4px 24px rgba(0,0,0,0.8)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img src="/__mockup/cedar-logo-bold-transparent.png" alt="Cedar Cafe"
            style={{ height: 64, width: "auto" }} />
          <div>
            <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 16, fontStyle: "italic", color: CHALK, textShadow: "0 1px 6px rgba(200,168,130,0.2)" }}>
              Kitchen Display
            </div>
            <div style={{ fontSize: 11, color: MUTED, letterSpacing: 1.5 }}>BAR STATION</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: ACCENT, letterSpacing: 2, textShadow: "0 0 20px rgba(200,168,130,0.4)" }}>{now()}</div>
            <div style={{ fontSize: 11, color: MUTED }}>4 active orders</div>
          </div>
        </div>
      </header>

      {/* Column headers */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, background: BORDER }}>
        {[
          { label: "New Orders",       count: orders.new.length,    col: AMBER },
          { label: "In Progress",      count: orders.making.length, col: HUNTER_LT },
          { label: "Ready for Pickup", count: orders.ready.length,  col: ACCENT },
        ].map(col => (
          <div key={col.label} style={{
            background: "linear-gradient(135deg, #1e1510, #161008)",
            padding: "13px 20px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
          }}>
            <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 15, fontStyle: "italic", color: CHALK }}>{col.label}</span>
            <span style={{
              background: col.col + "28", color: col.col, border: `1px solid ${col.col}`,
              borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 700,
              boxShadow: `0 0 10px ${col.col}44`,
            }}>{col.count}</span>
          </div>
        ))}
      </div>

      {/* Columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, background: BORDER, flex: 1 }}>
        <div style={{ background: BG, padding: "18px 16px", overflowY: "auto" }}>
          {orders.new.map(o => <OrderCard key={o.code} order={o} col={AMBER} label="Start Making" />)}
        </div>
        <div style={{ background: BG, padding: "18px 16px", overflowY: "auto" }}>
          {orders.making.map(o => <OrderCard key={o.code} order={o} col={HUNTER_LT} label="Mark Ready" />)}
        </div>
        <div style={{ background: BG, padding: "18px 16px", overflowY: "auto" }}>
          {orders.ready.map(o => <OrderCard key={o.code} order={o} col={ACCENT} label="Complete" />)}
        </div>
      </div>
    </div>
  );
}

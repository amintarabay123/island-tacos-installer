export function ChalkKDS() {
  const BG      = "#0e0b07";
  const SURFACE = "#181208";
  const CARD    = "#221a0f";
  const BORDER  = "#3a2a18";
  const CHALK   = "#F5ECD7";
  const MUTED   = "#9e8570";
  const ACCENT  = "#C8A882";
  const GREEN   = "#7cba7a";
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

  const StatusBadge = ({ mins, col }: { mins: number; col: string }) => (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: col + "22", border: `1px solid ${col}`, borderRadius: 20, padding: "2px 10px" }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: col }} />
      <span style={{ fontFamily: "'Lato', sans-serif", fontSize: 11, color: col, letterSpacing: 0.5 }}>{mins}m ago</span>
    </div>
  );

  const OrderCard = ({ order, col, label }: { order: typeof orders.new[0]; col: string; label: string }) => (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${col}`, borderRadius: 8, padding: "16px 18px", marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 18, color: CHALK }}>{order.code}</span>
        <StatusBadge mins={order.mins} col={col} />
      </div>
      <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 11, color: MUTED, marginBottom: 10, letterSpacing: 0.5 }}>
        Ordered at {order.time}
      </div>
      <div style={{ borderTop: `1px dashed ${BORDER}`, paddingTop: 10 }}>
        {order.items.map(item => (
          <div key={item} style={{ fontFamily: "'Lato', sans-serif", fontSize: 13, color: CHALK, padding: "3px 0", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: ACCENT }}>—</span> {item}
          </div>
        ))}
      </div>
      <button style={{ marginTop: 14, width: "100%", background: col + "22", border: `1px solid ${col}`, color: col, borderRadius: 6, padding: "8px 0", fontFamily: "'Lato', sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer", letterSpacing: 1, textTransform: "uppercase" }}>
        {label}
      </button>
    </div>
  );

  return (
    <div style={{ fontFamily: "'Lato', sans-serif", background: BG, color: CHALK, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=Lato:wght@300;400;700&display=swap');`}</style>

      {/* Header */}
      <header style={{ background: SURFACE, borderBottom: `1px solid ${BORDER}`, padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img src="/__mockup/cedar-logo-dark.jpg" alt="Cedar Cafe" style={{ height: 40, objectFit: "contain", borderRadius: 4 }} />
          <div>
            <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 16, fontStyle: "italic", color: CHALK }}>Kitchen Display</div>
            <div style={{ fontSize: 11, color: MUTED, letterSpacing: 1 }}>FOOD STATION</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: ACCENT, letterSpacing: 2 }}>{now()}</div>
            <div style={{ fontSize: 11, color: MUTED }}>4 active orders</div>
          </div>
        </div>
      </header>

      {/* Column headers */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, background: BORDER }}>
        {[
          { label: "New Orders", count: orders.new.length, col: AMBER },
          { label: "In Progress", count: orders.making.length, col: GREEN },
          { label: "Ready for Pickup", count: orders.ready.length, col: ACCENT },
        ].map(col => (
          <div key={col.label} style={{ background: SURFACE, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 15, fontStyle: "italic", color: CHALK }}>{col.label}</span>
            <span style={{ background: col.col + "33", color: col.col, borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>{col.count}</span>
          </div>
        ))}
      </div>

      {/* Columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, background: BORDER, flex: 1 }}>
        <div style={{ background: BG, padding: 20, overflowY: "auto" }}>
          {orders.new.map(o => <OrderCard key={o.code} order={o} col={AMBER} label="Start Making" />)}
        </div>
        <div style={{ background: BG, padding: 20, overflowY: "auto" }}>
          {orders.making.map(o => <OrderCard key={o.code} order={o} col={GREEN} label="Mark Ready" />)}
        </div>
        <div style={{ background: BG, padding: 20, overflowY: "auto" }}>
          {orders.ready.map(o => <OrderCard key={o.code} order={o} col={ACCENT} label="Complete" />)}
        </div>
      </div>
    </div>
  );
}

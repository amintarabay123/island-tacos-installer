export function WhatsAppReceipt() {
  const items = [
    { qty: 2, name: "Carne Asada Taco", total: "$18.00" },
    { qty: 1, name: "Chicken Burrito", total: "$12.00", mods: ["Extra guac"] },
    { qty: 3, name: "Elote (Street Corn)", total: "$12.00" },
  ];

  const receiptBlock =
    items
      .map((i) => {
        const line = `• ${i.qty}x ${i.name}  ${i.total}`;
        const mods = (i.mods ?? []).map((m) => `   + ${m}`).join("\n");
        return mods ? line + "\n" + mods : line;
      })
      .join("\n") +
    "\n\nTotal: $42.00";

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#0a1929",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Segoe UI', Helvetica, Arial, sans-serif",
      }}
    >
      {/* Status bar */}
      <div
        style={{
          background: "#075e54",
          padding: "8px 16px 6px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span style={{ color: "#fff", fontSize: 18 }}>←</span>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "#128c7e",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          🌮
        </div>
        <div>
          <div style={{ color: "#fff", fontWeight: 600, fontSize: 15, lineHeight: 1.2 }}>
            Island Tacos
          </div>
          <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12 }}>Business account</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 16 }}>
          <span style={{ color: "#fff", fontSize: 18 }}>📞</span>
          <span style={{ color: "#fff", fontSize: 18 }}>⋮</span>
        </div>
      </div>

      {/* Chat background */}
      <div
        style={{
          flex: 1,
          background: "#e5ddd5",
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23e5ddd5'/%3E%3C/svg%3E\")",
          padding: "16px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {/* Date chip */}
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <span
            style={{
              background: "rgba(0,0,0,0.15)",
              color: "#333",
              fontSize: 12,
              borderRadius: 8,
              padding: "3px 10px",
              fontWeight: 500,
            }}
          >
            TODAY
          </span>
        </div>

        {/* Business template message bubble */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div
            style={{
              maxWidth: 290,
              background: "#dcf8c6",
              borderRadius: "12px 0 12px 12px",
              boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
              overflow: "hidden",
            }}
          >
            {/* Template header */}
            <div
              style={{
                padding: "10px 12px 6px",
                borderBottom: "1px solid rgba(0,0,0,0.07)",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14.5, color: "#111", lineHeight: 1.3 }}>
                Your Order Receipt
              </div>
            </div>

            {/* Template body */}
            <div style={{ padding: "8px 12px 4px" }}>
              <div style={{ fontSize: 13.5, color: "#111", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                {`Hi Maria! Here is your receipt for `}
                <strong>Order #IT-4521</strong>
                {`.

`}
                {receiptBlock}
                {`

Thank you for dining with us. We look forward to seeing you again!`}
              </div>
            </div>

            {/* Template footer */}
            <div
              style={{
                padding: "2px 12px 8px",
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <div style={{ fontSize: 11.5, color: "#888", lineHeight: 1.4 }}>
                Island Tacos — Wickhams Cay 1, Road Town
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "#888",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                2:14 PM
                <span style={{ color: "#53bdeb", fontSize: 14, lineHeight: 1 }}>✓✓</span>
              </div>
            </div>
          </div>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />
      </div>

      {/* Input bar */}
      <div
        style={{
          background: "#f0f0f0",
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            flex: 1,
            background: "#fff",
            borderRadius: 24,
            padding: "10px 16px",
            fontSize: 14,
            color: "#999",
          }}
        >
          Message
        </div>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "#075e54",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            color: "#fff",
            flexShrink: 0,
          }}
        >
          🎤
        </div>
      </div>
    </div>
  );
}

const LOGO_B64 =
  "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";

const W = 32;

function padLine(left: string, right: string): string {
  const maxLeft = W - right.length - 1;
  const l = left.length > maxLeft ? left.slice(0, maxLeft - 1) + "." : left;
  return l + " ".repeat(Math.max(1, W - l.length - right.length)) + right;
}

const DIVIDER = "--------------------------------";

type Line = {
  text?: string;
  bold?: boolean;
  center?: boolean;
  size?: "normal" | "large" | "small";
  divider?: boolean;
};

const SAMPLE_LINES: Line[] = [
  { text: "================================", center: true },
  { text: "ISLAND TACOS", bold: true, center: true, size: "large" },
  { text: "================================", center: true },
  { text: "Wickhams Cay 1, Road Town, BVI", center: true },
  { text: "Tel: (284) 544-8088", center: true },
  { divider: true },
  { text: "Order #IT-4821", bold: true },
  { text: "5/7/2026, 1:14:32 PM" },
  { text: "Customer: Maria Santos" },
  { text: "Phone: (284) 340-2291" },
  { text: "Payment: Cash" },
  { divider: true },
  { text: padLine("2x Chicken Taco", "$18.00"), bold: true },
  { text: "  + Extra Cheese $1.00" },
  { text: "  + Pico de Gallo" },
  { text: padLine("1x Burrito Bowl", "$14.00"), bold: true },
  { text: "  + Guacamole $2.00" },
  { text: "  Note: No sour cream" },
  { text: padLine("1x Agua Fresca", "$4.50"), bold: true },
  { divider: true },
  { text: padLine("Subtotal:", "$38.50") },
  { text: "TOTAL: $38.50", bold: true, size: "large" },
  { text: padLine("Tendered:", "$40.00") },
  { text: padLine("Change:", "$1.50") },
  { text: "================================", center: true },
  { text: "** THANK YOU! **", bold: true, center: true },
  { text: "orders.islandtacosbvi.com", center: true },
  { text: "Hasta luego!", center: true },
];

function ReceiptLine({ line }: { line: Line }) {
  if (line.divider) {
    return (
      <div className="text-center font-mono text-[11px] leading-[1.45] tracking-tight">
        {DIVIDER}
      </div>
    );
  }
  const isLarge = line.size === "large";
  const isSmall = line.size === "small";
  return (
    <div
      className={[
        "font-mono leading-[1.45] tracking-tight whitespace-pre",
        line.center ? "text-center" : "text-left",
        line.bold ? "font-bold" : "font-normal",
        isLarge ? "text-[14px]" : isSmall ? "text-[9px]" : "text-[11px]",
      ].join(" ")}
    >
      {line.text}
    </div>
  );
}

export function Receipt() {
  return (
    <div className="min-h-screen bg-gray-200 flex items-start justify-center pt-8 pb-12">
      {/* Paper shadow + curl effect */}
      <div
        className="relative bg-white shadow-2xl"
        style={{
          width: 300,
          boxShadow:
            "0 4px 6px -1px rgba(0,0,0,.25), 0 2px 4px -1px rgba(0,0,0,.12), 0 20px 25px -5px rgba(0,0,0,.15)",
        }}
      >
        {/* Torn top edge */}
        <div
          className="w-full overflow-hidden"
          style={{ height: 12 }}
          aria-hidden
        >
          <svg viewBox="0 0 300 12" preserveAspectRatio="none" width="300" height="12">
            <path
              d="M0,12 C10,4 20,10 30,5 C40,0 50,8 60,6 C70,4 80,10 90,7 C100,4 110,9 120,5 C130,1 140,8 150,6 C160,4 170,10 180,7 C190,4 200,9 210,5 C220,1 230,8 240,4 C250,0 260,7 270,4 C280,1 290,6 300,3 L300,12 Z"
              fill="white"
            />
          </svg>
        </div>

        {/* Receipt content */}
        <div className="px-4 pb-2 pt-1">
          {/* Logo */}
          <div className="flex justify-center mb-1">
            <img
              src={`data:image/png;base64,${LOGO_B64}`}
              alt="Island Tacos"
              style={{ width: 220, imageRendering: "crisp-edges" }}
            />
          </div>

          {/* Text lines */}
          <div className="space-y-0">
            {SAMPLE_LINES.map((line, i) => (
              <ReceiptLine key={i} line={line} />
            ))}
          </div>

          {/* Bottom spacing */}
          <div style={{ height: 24 }} />
        </div>

        {/* Torn bottom edge */}
        <div
          className="w-full overflow-hidden rotate-180"
          style={{ height: 12 }}
          aria-hidden
        >
          <svg viewBox="0 0 300 12" preserveAspectRatio="none" width="300" height="12">
            <path
              d="M0,12 C10,4 20,10 30,5 C40,0 50,8 60,6 C70,4 80,10 90,7 C100,4 110,9 120,5 C130,1 140,8 150,6 C160,4 170,10 180,7 C190,4 200,9 210,5 C220,1 230,8 240,4 C250,0 260,7 270,4 C280,1 290,6 300,3 L300,12 Z"
              fill="white"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

import { Link, useLocation } from "wouter";
import { useCart } from "@/lib/cart-context";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ShoppingBag, Menu, X, Plus, Minus, Trash2, RefreshCw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useEffect } from "react";
import { useStoreSettings } from "@/lib/use-store-settings";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Chalkboard Palette ─────────────────────────────────────────────────────────
const BG      = "#0f0a06";
const CARD    = "#221610";
const HDR_BG  = "linear-gradient(135deg, #1a1008 0%, #221510 100%)";
const BORD    = "#4a3020";
const CHALK   = "#F5ECD7";
const MUTED   = "#9e8570";
const ACCENT  = "#C8A882";
const HUNTER  = "#2d6a4f";
const HUNTER_LT = "#3d8f6a";

const DARK_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Lato:wght@300;400;700&display=swap');
  .chalk-font { font-family: 'Playfair Display', Georgia, serif !important; }
  .body-font  { font-family: 'Lato', system-ui, sans-serif !important; }
  [data-slot="sheet-content"] {
    background: ${CARD} !important;
    border-left: 1px solid ${BORD} !important;
    color: ${CHALK} !important;
  }
  [data-slot="sheet-content"] [data-slot="sheet-header"] { border-bottom: 1px solid ${BORD} !important; }
  [data-slot="sheet-content"] [data-slot="sheet-title"] { color: ${CHALK} !important; }
  [data-slot="scroll-area"] { background: transparent !important; }
  [data-slot="separator"] { background: ${BORD} !important; }
`;

type OperationalSettings = {
  hours: string;
  address: string;
  payment_methods: string;
  is_open: string;
  open_today: string;
  open_time: string;
  closes_orders_at: string;
  closed_today_reason?: string;
};
const OPERATIONAL_DEFAULTS: OperationalSettings = {
  hours: "7am – 6pm daily",
  address: "Road Town, BVI",
  payment_methods: "ATH Móvil · Card",
  is_open: "true",
  open_today: "true",
  open_time: "07:00",
  closes_orders_at: "17:45",
};

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function useOperationalSettings() {
  const [settings, setSettings] = useState<OperationalSettings>(OPERATIONAL_DEFAULTS);
  useEffect(() => {
    fetch(`${API}/api/settings`)
      .then(r => r.json())
      .then(data => setSettings({ ...OPERATIONAL_DEFAULTS, ...data }))
      .catch(() => {});
  }, []);
  return settings;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { items, total, removeItem, updateQuantity } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const settings = useOperationalSettings();
  const profile = useStoreSettings();

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  const navLinks = [
    { href: "/", label: "Menu" },
    { href: "/track", label: "Track Order" },
  ];

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: BG, color: CHALK, fontFamily: "'Lato', system-ui, sans-serif" }}>
      <style>{DARK_CSS}</style>

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50, width: "100%",
        background: HDR_BG, borderBottom: `1px solid ${BORD}`,
        boxShadow: "0 4px 24px rgba(0,0,0,0.7)",
      }}>
        <div style={{ maxWidth: 1152, margin: "0 auto", display: "flex", height: 72, alignItems: "center", justifyContent: "space-between", padding: "0 24px" }}>

          {/* Brand */}
          <Link href="/" style={{ display: "flex", alignItems: "center", textDecoration: "none", userSelect: "none" }}>
            <img src="/cedar-logo.png" alt={profile.storeName} style={{ height: 64, width: "auto" }} />
          </Link>

          {/* Desktop nav links */}
          <nav style={{ display: "flex", alignItems: "center", gap: 32 }} className="hidden md:flex">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="body-font"
                style={{
                  fontSize: 13, fontWeight: 700, textDecoration: "none", letterSpacing: 1, textTransform: "uppercase",
                  color: location === href ? ACCENT : MUTED,
                  borderBottom: location === href ? `2px solid ${ACCENT}` : "2px solid transparent",
                  paddingBottom: 2,
                  transition: "color 0.15s",
                }}
                onMouseEnter={e => { if (location !== href) (e.currentTarget as HTMLElement).style.color = CHALK; }}
                onMouseLeave={e => { if (location !== href) (e.currentTarget as HTMLElement).style.color = MUTED; }}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Cart + reload + mobile menu */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

            {/* Reload */}
            <button
              onClick={() => window.location.reload()}
              title="Reload page"
              style={{ padding: 8, borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", color: MUTED, display: "flex", alignItems: "center", transition: "color 0.15s, background 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(200,168,130,0.08)"; e.currentTarget.style.color = CHALK; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = MUTED; }}
            >
              <RefreshCw style={{ width: 16, height: 16 }} />
            </button>

            {/* Cart drawer */}
            <Sheet>
              <SheetTrigger asChild>
                <button className="body-font" style={{
                  position: "relative", display: "flex", alignItems: "center", gap: 8,
                  border: `1px solid ${BORD}`, borderRadius: 40,
                  padding: "8px 18px", fontSize: 13, fontWeight: 700, letterSpacing: 0.5,
                  background: "linear-gradient(135deg, #2a1c12, #1e1208)", color: ACCENT, cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)",
                  transition: "background 0.15s, border-color 0.15s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(135deg, #3a2a1a, #2e1e10)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg, #2a1c12, #1e1208)"; }}
                >
                  <ShoppingBag style={{ width: 16, height: 16 }} />
                  <span className="hidden sm:inline">Order</span>
                  {totalItems > 0 && (
                    <span style={{
                      background: HUNTER, color: "#d4f5e2", fontSize: 11, fontWeight: 700,
                      borderRadius: 999, width: 20, height: 20,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {totalItems}
                    </span>
                  )}
                </button>
              </SheetTrigger>

              <SheetContent style={{ width: "100%", maxWidth: 448, display: "flex", flexDirection: "column", padding: 0, background: CARD, borderLeft: `1px solid ${BORD}` }}>
                <SheetHeader style={{ padding: "20px 24px", borderBottom: `1px solid ${BORD}` }}>
                  <SheetTitle className="chalk-font" style={{ fontSize: 18, fontStyle: "italic", color: CHALK }}>Your Order</SheetTitle>
                </SheetHeader>

                <ScrollArea style={{ flex: 1, padding: "16px 24px" }}>
                  {items.length === 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 192, textAlign: "center", gap: 12 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 999, background: "rgba(200,168,130,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <ShoppingBag style={{ width: 20, height: 20, color: MUTED }} />
                      </div>
                      <div>
                        <p className="chalk-font" style={{ fontStyle: "italic", fontSize: 16, color: CHALK }}>Nothing yet</p>
                        <p className="body-font" style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>Add something from the menu to get started</p>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                      {items.map((item) => (
                        <div key={item.menuItem.id} style={{ display: "flex", gap: 12 }}>
                          <div style={{ width: 56, height: 56, flexShrink: 0, borderRadius: 10, background: "rgba(74,48,32,0.5)", overflow: "hidden", border: `1px solid ${BORD}` }}>
                            {item.menuItem.imageUrl ? (
                              <img src={item.menuItem.imageUrl} alt={item.menuItem.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: ACCENT, fontSize: 18, fontWeight: 700 }}>
                                {item.menuItem.name.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                              <div style={{ minWidth: 0 }}>
                                <p className="body-font" style={{ fontSize: 14, fontWeight: 700, color: CHALK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.menuItem.name}</p>
                                {(item.modifierSelections ?? []).length > 0 && (
                                  <p className="body-font" style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{item.modifierSelections!.map(m => m.name).join(", ")}</p>
                                )}
                                {item.notes && <p className="body-font" style={{ fontSize: 12, color: MUTED, marginTop: 2, fontStyle: "italic" }}>{item.notes}</p>}
                              </div>
                              <p className="chalk-font" style={{ fontSize: 16, color: ACCENT, flexShrink: 0 }}>
                                ${((item.menuItem.price + (item.modifierSelections ?? []).reduce((s, m) => s + m.price, 0)) * item.quantity).toFixed(2)}
                              </p>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 0, border: `1px solid ${BORD}`, borderRadius: 8 }}>
                                <button
                                  style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: MUTED, borderRadius: "8px 0 0 8px" }}
                                  onClick={() => updateQuantity(item.menuItem.id, item.quantity - 1)}
                                >
                                  <Minus style={{ width: 12, height: 12 }} />
                                </button>
                                <span className="body-font" style={{ width: 24, textAlign: "center", fontSize: 12, fontWeight: 700, color: CHALK }}>{item.quantity}</span>
                                <button
                                  style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: MUTED, borderRadius: "0 8px 8px 0" }}
                                  onClick={() => updateQuantity(item.menuItem.id, item.quantity + 1)}
                                >
                                  <Plus style={{ width: 12, height: 12 }} />
                                </button>
                              </div>
                              <button
                                style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, display: "flex", padding: 4, borderRadius: 6, transition: "color 0.15s" }}
                                onMouseEnter={e => { e.currentTarget.style.color = "#ff453a"; }}
                                onMouseLeave={e => { e.currentTarget.style.color = MUTED; }}
                                onClick={() => removeItem(item.menuItem.id)}
                              >
                                <Trash2 style={{ width: 14, height: 14 }} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                {items.length > 0 && (
                  <div style={{ borderTop: `1px solid ${BORD}`, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span className="chalk-font" style={{ fontSize: 16, color: CHALK }}>Total</span>
                      <span className="chalk-font" style={{ fontSize: 22, color: ACCENT, textShadow: "0 0 14px rgba(200,168,130,0.4)" }}>${total.toFixed(2)}</span>
                    </div>
                    {settings.is_open === "false" ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ borderRadius: 10, background: "rgba(200,168,130,0.06)", border: `1px solid ${BORD}`, padding: "10px 14px", textAlign: "center" }}>
                          <p className="body-font" style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>
                            {settings.open_today === "false" ? (settings.closed_today_reason ?? "Closed today") : "Online ordering closed"}
                          </p>
                          <p className="body-font" style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
                            {settings.open_today === "false"
                              ? "We only take orders on open days"
                              : `Opens at ${formatTime(settings.open_time)} · Last orders at ${formatTime(settings.closes_orders_at)}`}
                          </p>
                        </div>
                        <button
                          className="body-font"
                          style={{ width: "100%", height: 44, fontWeight: 700, borderRadius: 6, fontSize: 12, background: "rgba(200,168,130,0.06)", color: MUTED, border: `1px solid ${BORD}`, cursor: "not-allowed", letterSpacing: 1, textTransform: "uppercase" }}
                          disabled
                        >
                          Checkout
                        </button>
                      </div>
                    ) : (
                      <button
                        className="body-font"
                        style={{
                          width: "100%", height: 44, fontWeight: 700, borderRadius: 6, fontSize: 12, cursor: "pointer",
                          background: `linear-gradient(135deg, ${HUNTER} 0%, #1f4d38 100%)`,
                          boxShadow: `0 6px 20px rgba(45,106,79,0.5), inset 0 1px 0 rgba(255,255,255,0.1)`,
                          color: "#d4f5e2", border: `1px solid ${HUNTER_LT}`,
                          letterSpacing: 1.5, textTransform: "uppercase",
                          transition: "opacity 0.15s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = "0.9"; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
                        onClick={() => setLocation("/checkout")}
                      >
                        Checkout
                      </button>
                    )}
                  </div>
                )}
              </SheetContent>
            </Sheet>

            {/* Mobile nav */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button
                  className="md:hidden"
                  style={{ padding: 8, borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", color: MUTED, display: "flex" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(200,168,130,0.08)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  <Menu style={{ width: 20, height: 20 }} />
                </button>
              </SheetTrigger>
              <SheetContent side="left" style={{ width: 288, padding: 0, background: "#1a1008", borderRight: `1px solid ${BORD}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: `1px solid ${BORD}` }}>
                  <img src="/cedar-logo.png" alt={profile.storeName} style={{ height: 48, width: "auto" }} />
                  <button
                    onClick={() => setMobileOpen(false)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, display: "flex", padding: 4 }}
                  >
                    <X style={{ width: 16, height: 16 }} />
                  </button>
                </div>
                <nav style={{ display: "flex", flexDirection: "column", padding: "16px 12px", gap: 2 }}>
                  {navLinks.map(({ href, label }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      className="body-font"
                      style={{
                        padding: "10px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", textDecoration: "none",
                        color: location === href ? ACCENT : MUTED,
                        background: location === href ? "rgba(200,168,130,0.08)" : "transparent",
                        transition: "all 0.15s",
                      }}
                    >
                      {label}
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>

          </div>
        </div>
      </header>

      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {children}
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: `1px solid ${BORD}`, paddingTop: 32, paddingBottom: 28, marginTop: 32, background: "#1a1008" }}>
        <div style={{ maxWidth: 1152, margin: "0 auto", padding: "0 24px", display: "flex", flexDirection: "column", gap: 16 }} className="md:flex-row md:items-center md:justify-between">
          <div>
            <p className="chalk-font" style={{ fontStyle: "italic", fontSize: 16, color: CHALK }}>{profile.storeName}</p>
            <p className="body-font" style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>Made fresh to order · Pickup only</p>
            <p className="body-font" style={{ fontSize: 12, color: MUTED }}>{profile.phone}</p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 24, fontSize: 12, color: MUTED }} className="body-font">
            <span>{settings.address}</span>
            <span>Open {settings.hours}</span>
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: 12 }} className="body-font">
            <Link href="/" style={{ color: MUTED, textDecoration: "none", transition: "color 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = ACCENT; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = MUTED; }}
            >Menu</Link>
            <Link href="/track" style={{ color: MUTED, textDecoration: "none", transition: "color 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = ACCENT; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = MUTED; }}
            >Track Order</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

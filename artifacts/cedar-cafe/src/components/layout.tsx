import { Link, useLocation } from "wouter";
import { useCart } from "@/lib/cart-context";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ShoppingBag, Menu, X, Plus, Minus, Trash2, RefreshCw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useEffect } from "react";
import { useStoreSettings } from "@/lib/use-store-settings";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── IL Palette ────────────────────────────────────────────────────────────────
const BG   = "#16172b";
const CARD = "#1e1f38";
const HDR  = "#0e1020";
const BORD = "rgba(255,255,255,0.06)";
const TP   = "#e8eaf6";
const TM   = "#b0b8d8";
const MU   = "#7077a1";
const OR   = "#ff6b00";

// Overrides dark shadcn sheet + scroll-area + separator to match IL palette
const DARK_CSS = `
  [data-slot="sheet-content"] {
    background: ${CARD} !important;
    border-left: 1px solid ${BORD} !important;
    color: ${TP} !important;
  }
  [data-slot="sheet-content"] [data-slot="sheet-header"] { border-bottom: 1px solid ${BORD} !important; }
  [data-slot="sheet-content"] [data-slot="sheet-title"] { color: ${TP} !important; }
  [data-slot="scroll-area"] { background: transparent !important; }
  [data-slot="separator"] { background: ${BORD} !important; }
`;

// Operational settings live in the K/V `store_settings` table behind /api/settings:
//   hours, open_time, close_time, cutoff_minutes, open_days, payment_methods, address.
// Identity settings (storeName, phone, email, …) come from the typed
// `store_profile` table via `useStoreSettings()` — see lib/use-store-settings.ts.
//
// TODO(store-settings): migrate `address` to read from `useStoreSettings()`
// (it's already overlaid into /api/settings on the server, so this is a
// near-mechanical follow-up).
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
  hours: "11am – 7pm daily",
  address: "Wickhams Cay 1, Road Town, BVI",
  payment_methods: "ATH Móvil · Card · Apple Pay",
  is_open: "true",
  open_today: "true",
  open_time: "11:00",
  closes_orders_at: "18:45",
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
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: BG, color: TP, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{DARK_CSS}</style>

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50, width: "100%",
        background: HDR, borderBottom: `1px solid ${BORD}`,
      }}>
        <div style={{ maxWidth: 1152, margin: "0 auto", display: "flex", height: 64, alignItems: "center", justifyContent: "space-between", padding: "0 24px" }}>

          {/* Brand */}
          <Link href="/" style={{ display: "flex", alignItems: "center", textDecoration: "none", userSelect: "none" }}>
            <img src="/logo-wordmark.png" alt={profile.storeName} style={{ height: 40, width: "auto", filter: "brightness(0) invert(1)" }} />
          </Link>

          {/* Desktop nav links */}
          <nav style={{ display: "flex", alignItems: "center", gap: 32 }} className="hidden md:flex">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                style={{
                  fontSize: 14, fontWeight: 500, textDecoration: "none",
                  color: location === href ? TP : MU,
                  transition: "color 0.15s",
                }}
                onMouseEnter={e => { if (location !== href) (e.currentTarget as HTMLElement).style.color = TM; }}
                onMouseLeave={e => { if (location !== href) (e.currentTarget as HTMLElement).style.color = MU; }}
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
              style={{ padding: 8, borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", color: MU, display: "flex", alignItems: "center", transition: "color 0.15s, background 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = TP; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = MU; }}
            >
              <RefreshCw style={{ width: 16, height: 16 }} />
            </button>

            {/* Cart drawer */}
            <Sheet>
              <SheetTrigger asChild>
                <button style={{
                  position: "relative", display: "flex", alignItems: "center", gap: 8,
                  border: `1px solid rgba(255,255,255,0.12)`, borderRadius: 999,
                  padding: "8px 16px", fontSize: 14, fontWeight: 500,
                  background: "rgba(255,255,255,0.04)", color: TM, cursor: "pointer",
                  transition: "background 0.15s, border-color 0.15s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
                >
                  <ShoppingBag style={{ width: 16, height: 16 }} />
                  <span className="hidden sm:inline">Cart</span>
                  {totalItems > 0 && (
                    <span style={{
                      background: OR, color: "#fff", fontSize: 11, fontWeight: 700,
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
                  <SheetTitle style={{ fontSize: 15, fontWeight: 600, color: TP }}>Your Order</SheetTitle>
                </SheetHeader>

                <ScrollArea style={{ flex: 1, padding: "16px 24px" }}>
                  {items.length === 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 192, textAlign: "center", gap: 12 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 999, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <ShoppingBag style={{ width: 20, height: 20, color: MU }} />
                      </div>
                      <div>
                        <p style={{ fontWeight: 500, fontSize: 14, color: TP }}>Your cart is empty</p>
                        <p style={{ color: MU, fontSize: 12, marginTop: 4 }}>Add something from the menu to get started</p>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                      {items.map((item) => (
                        <div key={item.menuItem.id} style={{ display: "flex", gap: 12 }}>
                          <div style={{ width: 56, height: 56, flexShrink: 0, borderRadius: 10, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                            {item.menuItem.imageUrl ? (
                              <img src={item.menuItem.imageUrl} alt={item.menuItem.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: MU, fontSize: 18, fontWeight: 700 }}>
                                {item.menuItem.name.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                              <div style={{ minWidth: 0 }}>
                                <p style={{ fontSize: 14, fontWeight: 600, color: TP, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.menuItem.name}</p>
                                {(item.modifierSelections ?? []).length > 0 && (
                                  <p style={{ fontSize: 12, color: MU, marginTop: 2 }}>{item.modifierSelections!.map(m => m.name).join(", ")}</p>
                                )}
                                {item.notes && <p style={{ fontSize: 12, color: MU, marginTop: 2, fontStyle: "italic" }}>{item.notes}</p>}
                              </div>
                              <p style={{ fontSize: 14, fontWeight: 600, flexShrink: 0, color: TP }}>
                                ${((item.menuItem.price + (item.modifierSelections ?? []).reduce((s, m) => s + m.price, 0)) * item.quantity).toFixed(2)}
                              </p>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 0, border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 8 }}>
                                <button
                                  style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: TM, borderRadius: "8px 0 0 8px" }}
                                  onClick={() => updateQuantity(item.menuItem.id, item.quantity - 1)}
                                >
                                  <Minus style={{ width: 12, height: 12 }} />
                                </button>
                                <span style={{ width: 24, textAlign: "center", fontSize: 12, fontWeight: 600, color: TP }}>{item.quantity}</span>
                                <button
                                  style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: TM, borderRadius: "0 8px 8px 0" }}
                                  onClick={() => updateQuantity(item.menuItem.id, item.quantity + 1)}
                                >
                                  <Plus style={{ width: 12, height: 12 }} />
                                </button>
                              </div>
                              <button
                                style={{ background: "none", border: "none", cursor: "pointer", color: MU, display: "flex", padding: 4, borderRadius: 6, transition: "color 0.15s" }}
                                onMouseEnter={e => { e.currentTarget.style.color = "#ff453a"; }}
                                onMouseLeave={e => { e.currentTarget.style.color = MU; }}
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
                      <span style={{ fontSize: 14, color: MU }}>Total</span>
                      <span style={{ fontWeight: 600, fontSize: 15, color: TP }}>${total.toFixed(2)}</span>
                    </div>
                    {settings.is_open === "false" ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ borderRadius: 10, background: "rgba(255,200,0,0.08)", border: "1px solid rgba(255,200,0,0.2)", padding: "10px 14px", textAlign: "center" }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: "#ffd60a" }}>
                            {settings.open_today === "false" ? (settings.closed_today_reason ?? "Closed today") : "Online ordering closed"}
                          </p>
                          <p style={{ fontSize: 11, color: "#b0a060", marginTop: 4 }}>
                            {settings.open_today === "false"
                              ? "We only take orders on open days"
                              : `Opens at ${formatTime(settings.open_time)} · Last orders at ${formatTime(settings.closes_orders_at)}`}
                          </p>
                        </div>
                        <button
                          style={{ width: "100%", height: 44, fontWeight: 600, borderRadius: 999, fontSize: 14, background: "rgba(255,255,255,0.05)", color: MU, border: `1px solid ${BORD}`, cursor: "not-allowed" }}
                          disabled
                        >
                          Checkout
                        </button>
                      </div>
                    ) : (
                      <button
                        style={{
                          width: "100%", height: 44, fontWeight: 700, borderRadius: 999, fontSize: 14, cursor: "pointer",
                          background: "linear-gradient(135deg,#ff6b00,#ff3d00)",
                          boxShadow: "0 4px 16px rgba(255,107,0,0.4)",
                          color: "#fff", border: "none",
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
                  style={{ padding: 8, borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", color: MU, display: "flex" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  <Menu style={{ width: 20, height: 20 }} />
                </button>
              </SheetTrigger>
              <SheetContent side="left" style={{ width: 288, padding: 0, background: HDR, borderRight: `1px solid ${BORD}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: `1px solid ${BORD}` }}>
                  <img src="/logo-wordmark.png" alt={profile.storeName} style={{ height: 32, width: "auto", filter: "brightness(0) invert(1)" }} />
                  <button
                    onClick={() => setMobileOpen(false)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: MU, display: "flex", padding: 4 }}
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
                      style={{
                        padding: "10px 12px", borderRadius: 8, fontSize: 14, fontWeight: 500, textDecoration: "none",
                        color: location === href ? TP : MU,
                        background: location === href ? "rgba(255,107,0,0.1)" : "transparent",
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
      <footer style={{ borderTop: `1px solid ${BORD}`, paddingTop: 40, paddingBottom: 32, marginTop: 32 }}>
        <div style={{ maxWidth: 1152, margin: "0 auto", padding: "0 24px", display: "flex", flexDirection: "column", gap: 24 }} className="md:flex-row md:items-center md:justify-between">
          <div>
            <p style={{ fontWeight: 700, fontSize: 14, color: TP }}>{profile.storeName}</p>
            <p style={{ fontSize: 12, color: MU, marginTop: 4 }}>Mexican food. Made fresh, every day.</p>
            <p style={{ fontSize: 12, color: MU }}>{profile.phone}</p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 24, fontSize: 12, color: MU }}>
            <span>{settings.address}</span>
            <span>Open {settings.hours}</span>
            <span>{settings.payment_methods}</span>
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
            <Link href="/" style={{ color: MU, textDecoration: "none", transition: "color 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = TP; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = MU; }}
            >Menu</Link>
            <Link href="/track" style={{ color: MU, textDecoration: "none", transition: "color 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = TP; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = MU; }}
            >Track Order</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

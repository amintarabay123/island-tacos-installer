import { Link, useLocation } from "wouter";
import { useCart } from "@/lib/cart-context";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Menu, X, Plus, Minus, Trash2, RefreshCw } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect } from "react";
import { useStoreSettings } from "@/lib/use-store-settings";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

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
    <div className="min-h-screen flex flex-col bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background">
        <div className="max-w-6xl mx-auto flex h-16 items-center justify-between px-6">

          {/* Brand */}
          <Link href="/" className="flex items-center select-none">
            <img src="/logo-wordmark.png" alt={profile.storeName} className="h-10 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`text-sm font-medium transition-colors ${
                  location === href
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Cart + mobile menu */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.location.reload()}
              title="Reload page"
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {/* Cart drawer */}
            <Sheet>
              <SheetTrigger asChild>
                <button className="relative flex items-center gap-2 border border-border rounded-full px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
                  <ShoppingBag className="w-4 h-4" />
                  <span className="hidden sm:inline">Cart</span>
                  {totalItems > 0 && (
                    <span className="bg-foreground text-background text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {totalItems}
                    </span>
                  )}
                </button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
                <SheetHeader className="px-6 py-5 border-b">
                  <SheetTitle className="text-base font-semibold">Your Order</SheetTitle>
                </SheetHeader>

                <ScrollArea className="flex-1 px-6 py-4">
                  {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                        <ShoppingBag className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Your cart is empty</p>
                        <p className="text-muted-foreground text-xs mt-1">Add something from the menu to get started</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {items.map((item) => (
                        <div key={item.menuItem.id} className="flex gap-3">
                          <div className="w-14 h-14 shrink-0 rounded-lg bg-muted overflow-hidden">
                            {item.menuItem.imageUrl ? (
                              <img src={item.menuItem.imageUrl} alt={item.menuItem.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-lg font-bold">
                                {item.menuItem.name.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold truncate">{item.menuItem.name}</p>
                                {(item.modifierSelections ?? []).length > 0 && (
                                  <p className="text-xs text-muted-foreground mt-0.5">{item.modifierSelections!.map(m => m.name).join(", ")}</p>
                                )}
                                {item.notes && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 italic">{item.notes}</p>}
                              </div>
                              <p className="text-sm font-semibold shrink-0">${((item.menuItem.price + (item.modifierSelections ?? []).reduce((s, m) => s + m.price, 0)) * item.quantity).toFixed(2)}</p>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1 border border-border rounded-md">
                                <button
                                  className="w-7 h-7 flex items-center justify-center hover:bg-muted rounded-l transition-colors"
                                  onClick={() => updateQuantity(item.menuItem.id, item.quantity - 1)}
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-6 text-center text-xs font-semibold">{item.quantity}</span>
                                <button
                                  className="w-7 h-7 flex items-center justify-center hover:bg-muted rounded-r transition-colors"
                                  onClick={() => updateQuantity(item.menuItem.id, item.quantity + 1)}
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                              <button
                                className="text-muted-foreground hover:text-destructive transition-colors"
                                onClick={() => removeItem(item.menuItem.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                {items.length > 0 && (
                  <div className="border-t px-6 py-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total</span>
                      <span className="font-semibold">${total.toFixed(2)}</span>
                    </div>
                    {settings.is_open === "false" ? (
                      <div className="space-y-2">
                        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-center">
                          <p className="text-xs font-semibold text-amber-800">
                            {settings.open_today === "false" ? (settings.closed_today_reason ?? "Closed today") : "Online ordering closed"}
                          </p>
                          <p className="text-xs text-amber-700 mt-0.5">
                            {settings.open_today === "false"
                              ? "We only take orders on open days"
                              : `Opens at ${formatTime(settings.open_time)} · Last orders at ${formatTime(settings.closes_orders_at)}`}
                          </p>
                        </div>
                        <Button
                          className="w-full h-11 font-semibold rounded-full"
                          disabled
                        >
                          Checkout
                        </Button>
                      </div>
                    ) : (
                      <Button
                        className="w-full h-11 font-semibold rounded-full"
                        onClick={() => setLocation("/checkout")}
                      >
                        Checkout
                      </Button>
                    )}
                  </div>
                )}
              </SheetContent>
            </Sheet>

            {/* Mobile nav */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button className="md:hidden p-2 rounded-md hover:bg-muted transition-colors">
                  <Menu className="w-5 h-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <div className="flex items-center justify-between px-6 py-5 border-b">
                  <img src="/logo-wordmark.png" alt={profile.storeName} className="h-8 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
                  <button onClick={() => setMobileOpen(false)}>
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
                <nav className="flex flex-col px-4 py-4 gap-1">
                  {navLinks.map(({ href, label }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      className={`px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                        location === href ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      }`}
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

      <main className="flex-1 flex flex-col">
        {children}
      </main>

      <footer className="border-t py-10 mt-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <p className="font-bold text-sm">{profile.storeName}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Mexican food. Made fresh, every day.
            </p>
            <p className="text-xs text-muted-foreground">{profile.phone}</p>
          </div>
          <div className="flex flex-wrap gap-6 text-xs text-muted-foreground">
            <span>{settings.address}</span>
            <span>Open {settings.hours}</span>
            <span>{settings.payment_methods}</span>
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">Menu</Link>
            <Link href="/track" className="hover:text-foreground transition-colors">Track Order</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

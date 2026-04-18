import { Link, useLocation } from "wouter";
import { useCart } from "@/lib/cart-context";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Menu, X, Plus, Minus, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { items, total, removeItem, updateQuantity } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);

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
          <Link href="/" className="flex flex-col leading-none select-none">
            <span className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Restaurant</span>
            <span className="text-base font-bold tracking-tight text-foreground">Island Tacos</span>
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
                                {item.notes && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.notes}</p>}
                              </div>
                              <p className="text-sm font-semibold shrink-0">${(item.menuItem.price * item.quantity).toFixed(2)}</p>
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
                      <span className="text-sm text-muted-foreground">Estimated total</span>
                      <span className="font-semibold">${total.toFixed(2)}</span>
                    </div>
                    <Button
                      className="w-full h-11 font-semibold rounded-full"
                      onClick={() => setLocation("/checkout")}
                    >
                      Checkout
                    </Button>
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
                  <span className="font-bold">Island Tacos</span>
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
                  <Separator className="my-2" />
                  <Link
                    href="/admin"
                    onClick={() => setMobileOpen(false)}
                    className="px-3 py-2.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  >
                    Staff Login
                  </Link>
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
            <p className="font-bold text-sm">Island Tacos</p>
            <p className="text-xs text-muted-foreground mt-1">
              Authentic Puerto Rican flavors. Made fresh, every day.
            </p>
          </div>
          <div className="flex flex-wrap gap-6 text-xs text-muted-foreground">
            <span>Caguas, Puerto Rico</span>
            <span>Open 11am – 10pm daily</span>
            <span>ATH Movil · Card · Apple Pay</span>
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">Menu</Link>
            <Link href="/track" className="hover:text-foreground transition-colors">Track Order</Link>
            <Link href="/admin" className="hover:text-foreground transition-colors">Staff</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

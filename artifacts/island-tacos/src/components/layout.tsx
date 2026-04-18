import { Link, useLocation } from "wouter";
import { useCart } from "@/lib/cart-context";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Search, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export function Layout({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const { items, total, removeItem, updateQuantity } = useCart();

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-tight text-primary">ISLAND TACOS</span>
            </Link>
            <nav className="hidden md:flex gap-6">
              <Link href="/" className="text-sm font-medium transition-colors hover:text-primary">Menu</Link>
              <Link href="/track" className="text-sm font-medium transition-colors hover:text-primary">Track Order</Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="relative h-10 w-10 rounded-full border-primary/20 bg-primary/5 text-primary hover:bg-primary/10">
                  <ShoppingBag className="h-5 w-5" />
                  {totalItems > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {totalItems}
                    </span>
                  )}
                  <span className="sr-only">Open cart</span>
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
                <SheetHeader className="px-6 py-4 border-b">
                  <SheetTitle className="text-xl font-bold">Your Order</SheetTitle>
                </SheetHeader>
                
                <ScrollArea className="flex-1 p-6">
                  {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-center space-y-4">
                      <div className="rounded-full bg-muted p-4">
                        <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground font-medium">Your cart is empty</p>
                      <Button variant="outline" onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))}>
                        Browse Menu
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {items.map((item) => (
                        <div key={item.menuItem.id} className="flex gap-4">
                          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                            {item.menuItem.imageUrl ? (
                              <img src={item.menuItem.imageUrl} alt={item.menuItem.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full bg-primary/10 flex items-center justify-center">
                                <span className="text-primary font-bold text-xl">{item.menuItem.name.charAt(0)}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-1 flex-col justify-between">
                            <div className="flex justify-between">
                              <div>
                                <h4 className="font-semibold">{item.menuItem.name}</h4>
                                {item.notes && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.notes}</p>}
                              </div>
                              <p className="font-medium">${(item.menuItem.price * item.quantity).toFixed(2)}</p>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <div className="flex items-center rounded-md border border-input bg-background h-8">
                                <button 
                                  className="w-8 h-full flex items-center justify-center hover:bg-muted rounded-l-md transition-colors"
                                  onClick={() => updateQuantity(item.menuItem.id, item.quantity - 1)}
                                >
                                  -
                                </button>
                                <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                                <button 
                                  className="w-8 h-full flex items-center justify-center hover:bg-muted rounded-r-md transition-colors"
                                  onClick={() => updateQuantity(item.menuItem.id, item.quantity + 1)}
                                >
                                  +
                                </button>
                              </div>
                              <button 
                                className="text-xs text-destructive font-medium hover:underline"
                                onClick={() => removeItem(item.menuItem.id)}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
                
                {items.length > 0 && (
                  <div className="border-t bg-muted/30 p-6 space-y-4">
                    <div className="flex items-center justify-between font-bold text-lg">
                      <span>Total Estimated</span>
                      <span>${total.toFixed(2)}</span>
                    </div>
                    <Button 
                      className="w-full h-12 text-lg shadow-sm" 
                      onClick={() => setLocation("/checkout")}
                    >
                      Checkout
                    </Button>
                  </div>
                )}
              </SheetContent>
            </Sheet>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px]">
                <SheetHeader>
                  <SheetTitle className="text-left text-2xl font-black text-primary">ISLAND TACOS</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-4 mt-8">
                  <Link href="/" className="text-lg font-medium p-2 hover:bg-muted rounded-md">Menu</Link>
                  <Link href="/track" className="text-lg font-medium p-2 hover:bg-muted rounded-md">Track Order</Link>
                  <Separator />
                  <Link href="/admin" className="text-sm font-medium p-2 text-muted-foreground hover:text-foreground">Admin Login</Link>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {children}
      </main>

      <footer className="border-t bg-muted/40 py-12">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <Link href="/" className="text-2xl font-black tracking-tight text-primary mb-4 block">ISLAND TACOS</Link>
            <p className="text-muted-foreground max-w-sm">
              Authentic island-flavored street food. Bold, colorful, and welcoming. 
              The kind of place locals come back to daily and tourists instantly love.
            </p>
          </div>
          <div>
            <h3 className="font-bold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li><Link href="/" className="text-muted-foreground hover:text-primary transition-colors">Menu</Link></li>
              <li><Link href="/track" className="text-muted-foreground hover:text-primary transition-colors">Track Order</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold mb-4">Location</h3>
            <p className="text-muted-foreground">
              San Juan, Puerto Rico<br />
              Open Daily: 11am - 10pm
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

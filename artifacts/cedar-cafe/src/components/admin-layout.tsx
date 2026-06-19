import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, UtensilsCrossed, LogOut, CreditCard } from "lucide-react";
import { adminRoutes } from "@/lib/admin-path";
import { useStoreSettings } from "@/lib/use-store-settings";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { storeName } = useStoreSettings();

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row">
      <aside className="w-full md:w-64 flex flex-col sticky top-0 md:h-[100dvh]">
        <div className="p-6 border-b">
          <Link href="/admin" className="flex flex-col gap-1">
            <span className="text-xl font-black tracking-tight text-primary">{storeName.toUpperCase()}</span>
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Admin Panel</span>
          </Link>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <Link href="/admin">
            <Button 
              variant={location === "/admin" ? "secondary" : "ghost"} 
              className="w-full justify-start h-11"
            >
              <LayoutDashboard className="mr-3 h-5 w-5" />
              Dashboard
            </Button>
          </Link>
          <Link href="/admin/menu">
            <Button 
              variant={location === "/admin/menu" ? "secondary" : "ghost"} 
              className="w-full justify-start h-11"
            >
              <UtensilsCrossed className="mr-3 h-5 w-5" />
              Menu Management
            </Button>
          </Link>
          <Link href={adminRoutes.paymentEvents}>
            <Button
              variant={location === adminRoutes.paymentEvents ? "secondary" : "ghost"}
              className="w-full justify-start h-11"
            >
              <CreditCard className="mr-3 h-5 w-5" />
              Payment Events
            </Button>
          </Link>
        </nav>

        <div className="p-4 border-t">
          <Link href="/">
            <Button variant="outline" className="w-full justify-start h-11 text-muted-foreground">
              <LogOut className="mr-3 h-5 w-5" />
              Storefront
            </Button>
          </Link>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}

import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/lib/cart-context";
import ProtectedRoute from "@/components/protected-route";
import { ADMIN_PATH, adminRoutes } from "@/lib/admin-path";
import Home from "@/pages/home";
import Checkout from "@/pages/checkout";
import TrackOrder from "@/pages/track";
import Admin from "@/pages/admin";
import AdminMenu from "@/pages/admin-menu";
import Kitchen from "@/pages/kitchen";
import StaffLogin from "@/pages/staff-login";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30 * 1000,
    },
  },
});

function Router() {
  return (
    <Switch>
      {/* Public customer routes */}
      <Route path="/" component={Home} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/track" component={TrackOrder} />

      {/* Secret staff routes — only accessible at the hidden path */}
      <Route path={adminRoutes.login} component={StaffLogin} />
      <Route path={adminRoutes.dashboard}>
        <ProtectedRoute><Admin /></ProtectedRoute>
      </Route>
      <Route path={adminRoutes.menu}>
        <ProtectedRoute><AdminMenu /></ProtectedRoute>
      </Route>
      <Route path={adminRoutes.kitchen}>
        <ProtectedRoute><Kitchen /></ProtectedRoute>
      </Route>

      {/* Catch-all: redirect old /admin paths to 404 so they're invisible */}
      <Route path="/admin" component={NotFound} />
      <Route path="/admin/:rest*" component={NotFound} />
      <Route path="/kitchen" component={NotFound} />
      <Route path="/staff-login" component={NotFound} />

      <Route component={NotFound} />
    </Switch>
  );
}

// Export for use in navigation within staff pages
export { ADMIN_PATH, adminRoutes };

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CartProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </CartProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

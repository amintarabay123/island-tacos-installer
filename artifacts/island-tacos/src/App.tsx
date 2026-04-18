import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/lib/cart-context";
import ProtectedRoute from "@/components/protected-route";
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
      <Route path="/" component={Home} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/track" component={TrackOrder} />
      <Route path="/staff-login" component={StaffLogin} />
      <Route path="/admin">
        <ProtectedRoute><Admin /></ProtectedRoute>
      </Route>
      <Route path="/admin/menu">
        <ProtectedRoute><AdminMenu /></ProtectedRoute>
      </Route>
      <Route path="/kitchen">
        <ProtectedRoute><Kitchen /></ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

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

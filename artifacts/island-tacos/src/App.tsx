import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, useClerk } from "@clerk/react";
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
import AdminModifiers from "@/pages/admin-modifiers";
import AdminReports from "@/pages/admin-reports";
import AdminCustomers from "@/pages/admin-customers";
import AdminSettings from "@/pages/admin-settings";
import AccountPage from "@/pages/account";
import Kitchen from "@/pages/kitchen";
import POS from "@/pages/pos";
import CustomerDisplay from "@/pages/display";
import StaffLogin from "@/pages/staff-login";
import SignInPage from "@/pages/sign-in";
import SignUpPage from "@/pages/sign-up";
import NotFound from "@/pages/not-found";
import InstallPrompt from "@/components/install-prompt";
import FbBrowserPrompt from "@/components/fb-browser-prompt";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30 * 1000,
    },
  },
});

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function Router() {
  return (
    <Switch>
      {/* Public customer routes */}
      <Route path="/" component={Home} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/track" component={TrackOrder} />
      <Route path="/account" component={AccountPage} />
      <Route path="/display" component={CustomerDisplay} />

      {/* Clerk auth routes */}
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />

      {/* Secret staff routes — more specific paths must come before less specific ones */}
      <Route path={adminRoutes.login} component={StaffLogin} />
      <Route path={adminRoutes.pos}>
        <ProtectedRoute><POS /></ProtectedRoute>
      </Route>
      <Route path={adminRoutes.menu}>
        <ProtectedRoute><AdminMenu /></ProtectedRoute>
      </Route>
      <Route path={adminRoutes.modifiers}>
        <ProtectedRoute><AdminModifiers /></ProtectedRoute>
      </Route>
      <Route path={adminRoutes.reports}>
        <ProtectedRoute><AdminReports /></ProtectedRoute>
      </Route>
      <Route path={adminRoutes.settings}>
        <ProtectedRoute adminOnly><AdminSettings /></ProtectedRoute>
      </Route>
      <Route path={adminRoutes.customers}>
        <ProtectedRoute><AdminCustomers /></ProtectedRoute>
      </Route>
      <Route path={adminRoutes.kitchen}>
        <ProtectedRoute><Kitchen /></ProtectedRoute>
      </Route>
      <Route path={adminRoutes.dashboard}>
        <ProtectedRoute><Admin /></ProtectedRoute>
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

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey ?? ""}
      proxyUrl={clerkProxyUrl}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <CartProvider>
            <Router />
            <Toaster />
            <FbBrowserPrompt />
            <InstallPrompt />
          </CartProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;

import { lazy, Suspense, useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, useClerk } from "@clerk/react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/lib/cart-context";
import ProtectedRoute from "@/components/protected-route";
import { ADMIN_PATH, adminRoutes } from "@/lib/admin-path";
import InstallPrompt from "@/components/install-prompt";
import FbBrowserPrompt from "@/components/fb-browser-prompt";

// Customer-facing pages — eager (fastest path for real customers)
import Home from "@/pages/home";
import Checkout from "@/pages/checkout";
import TrackOrder from "@/pages/track";
import NotFound from "@/pages/not-found";

// Everything else is lazy — these are staff/admin pages, load only when navigated to
const Admin = lazy(() => import("@/pages/admin"));
const AdminMenu = lazy(() => import("@/pages/admin-menu"));
const AdminModifiers = lazy(() => import("@/pages/admin-modifiers"));
const AdminReports = lazy(() => import("@/pages/admin-reports"));
const AdminFinancials = lazy(() => import("@/pages/admin-financials"));
const AdminCustomers = lazy(() => import("@/pages/admin-customers"));
const AdminSettings = lazy(() => import("@/pages/admin-settings"));
const AdminSystem   = lazy(() => import("@/pages/admin-system"));
const AccountPage = lazy(() => import("@/pages/account"));
const Kitchen = lazy(() => import("@/pages/kitchen"));
const POS = lazy(() => import("@/pages/pos"));
const CustomerDisplay = lazy(() => import("@/pages/display"));
const StaffLogin = lazy(() => import("@/pages/staff-login"));
const SignInPage = lazy(() => import("@/pages/sign-in"));
const SignUpPage = lazy(() => import("@/pages/sign-up"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60 * 1000,       // 1 min — reduce redundant refetches
      gcTime: 10 * 60 * 1000,     // 10 min — keep unused data in memory cache longer
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
      {ADMIN_PATH && <Route path={`${ADMIN_PATH}/display`} component={CustomerDisplay} />}

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
      <Route path={`${adminRoutes.financials}/:id?`}>
        <ProtectedRoute adminOnly><AdminFinancials /></ProtectedRoute>
      </Route>
      <Route path={adminRoutes.settings}>
        <ProtectedRoute adminOnly><AdminSettings /></ProtectedRoute>
      </Route>
      <Route path={adminRoutes.system}>
        <ProtectedRoute adminOnly><AdminSystem /></ProtectedRoute>
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
      <Route path="/kitchen"><Redirect to={adminRoutes.kitchen} /></Route>
      <Route path="/staff-login" component={NotFound} />

      <Route component={NotFound} />
    </Switch>
  );
}

// Export for use in navigation within staff pages
export { ADMIN_PATH, adminRoutes };

function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CartProvider>
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
            {children}
          </Suspense>
          <Toaster />
          <FbBrowserPrompt />
          <InstallPrompt />
        </CartProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey!}
      proxyUrl={clerkProxyUrl}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <AppProviders>
        <ClerkQueryClientCacheInvalidator />
        <Router />
      </AppProviders>
    </ClerkProvider>
  );
}

function App() {
  if (!clerkPubKey) {
    return (
      <WouterRouter base={basePath}>
        <AppProviders>
          <Router />
        </AppProviders>
      </WouterRouter>
    );
  }

  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;

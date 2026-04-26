import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { setPageMeta } from "@/lib/page-meta";
import { authHeaders, clearAuthToken } from "@/lib/auth";
import { useGetAdminStats, useGetRecentOrders, useUpdateOrderStatus, getGetAdminStatsQueryKey, getGetRecentOrdersQueryKey, type UpdateOrderStatusBodyStatus } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ShoppingBag, DollarSign, Clock, CheckCircle2, TrendingUp, Settings, Monitor, LogOut, XCircle, BarChart3, Users, CloudUpload, Menu, X, ChefHat, UtensilsCrossed, Store, History } from "lucide-react";
import { useLocation } from "wouter";
import { adminRoutes } from "@/lib/admin-path";
import { useToast } from "@/hooks/use-toast";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  preparing: "bg-orange-100 text-orange-800",
  ready: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
};

const NEXT_STATUS: Record<string, UpdateOrderStatusBodyStatus> = {
  pending: "confirmed",
  confirmed: "preparing",
  preparing: "ready",
  ready: "completed",
};

type RejectState = { orderId: number; reason: string } | null;

export default function Admin() {
  useEffect(() => { setPageMeta("Admin — Island Tacos", "⚙️", { iconUrl: "/icon-admin-192.png", manifestUrl: "/manifest-admin.json" }); }, []);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [rejectState, setRejectState] = useState<RejectState>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [syncMessage, setSyncMessage] = useState<string>("");
  const [lastSync, setLastSync] = useState<string | null>(() => localStorage.getItem("lastMenuSync"));
  const [importState, setImportState] = useState<"idle" | "importing" | "success" | "error">("idle");
  const [importMessage, setImportMessage] = useState<string>("");
  const prevOrderIdsRef = useRef<Set<number>>(new Set());
  const isFirstFetchRef = useRef(true);

  // Role guard — staff can only access kitchen
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include", cache: "no-store", headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (!d.authed) navigate(adminRoutes.login);
        else if (d.role !== "admin") navigate(adminRoutes.pos);
      })
      .catch(() => navigate(adminRoutes.login));
  }, [navigate]);

  const logout = async () => {
    clearAuthToken();
    await fetch("/api/auth/logout", { method: "POST", credentials: "include", headers: authHeaders() });
    navigate(adminRoutes.login);
  };

  const handleSync = async () => {
    setSyncState("syncing"); setSyncMessage("");
    try {
      const r = await fetch("/api/sync/push", { method: "POST", credentials: "include", headers: authHeaders() });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Sync failed");
      const ts = new Date().toLocaleString();
      setLastSync(ts); localStorage.setItem("lastMenuSync", ts);
      setSyncState("success");
      setSyncMessage(`${data.pushed?.categories ?? 0} categories, ${data.pushed?.items ?? 0} items pushed`);
      setTimeout(() => setSyncState("idle"), 4000);
    } catch (e) {
      setSyncState("error"); setSyncMessage(String(e));
    }
  };

  const handleLoyverseImport = async () => {
    if (importState === "importing") return;
    setImportState("importing");
    setImportMessage("Fetching data from Loyverse… this may take a minute.");
    try {
      const r = await fetch("/api/loyverse/import-history", { method: "POST", credentials: "include", headers: authHeaders() });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Import failed");
      const { customersImported, customersSkipped, ordersImported, ordersSkipped, errors } = data;
      setImportState("success");
      setImportMessage(
        `Imported ${ordersImported} orders + ${customersImported} customers (${ordersSkipped} orders / ${customersSkipped} customers already existed).` +
        (errors?.length ? ` ${errors.length} error(s): ${errors[0]}` : "")
      );
    } catch (e) {
      setImportState("error");
      setImportMessage(String(e));
    }
  };


  const { data: stats } = useGetAdminStats({ query: { refetchInterval: 5_000 } });
  const { data: orders, isLoading } = useGetRecentOrders({ limit: 50 }, { query: { refetchInterval: 5_000 } });

  // Refresh immediately when KDS changes an order (same tab or other tab via BroadcastChannel)
  useEffect(() => {
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetRecentOrdersQueryKey() });
    };
    window.addEventListener("kds:order-updated", refresh);
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("island_tacos_kds");
      bc.onmessage = (e) => { if (e.data?.type === "kds:order-updated") refresh(); };
    } catch {}
    return () => {
      window.removeEventListener("kds:order-updated", refresh);
      bc?.close();
    };
  }, [queryClient]);
  const updateStatus = useUpdateOrderStatus();

  useEffect(() => {
    if (!orders) return;
    const activeIds = new Set(
      orders.filter((o) => ["pending", "confirmed", "preparing", "ready"].includes(o.status)).map((o) => o.id)
    );
    if (isFirstFetchRef.current) {
      isFirstFetchRef.current = false;
      prevOrderIdsRef.current = activeIds;
      return;
    }
    const hasNew = [...activeIds].some((id) => !prevOrderIdsRef.current.has(id));
    if (hasNew) {
      toast({ title: "New order received!", description: "Check active orders below." });
    }
    prevOrderIdsRef.current = activeIds;
  }, [orders, toast]);

  const handleStatusChange = (orderId: number, status: UpdateOrderStatusBodyStatus, cancellationReason?: string) => {
    updateStatus.mutate(
      { id: orderId, data: { status, cancellationReason: cancellationReason ?? null } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRecentOrdersQueryKey() });
          setRejectState(null);
        },
      }
    );
  };

  const handleCancelClick = (orderId: number) => {
    if (rejectState?.orderId === orderId) {
      setRejectState(null);
    } else {
      setRejectState({ orderId, reason: "" });
    }
  };

  const confirmCancellation = (orderId: number) => {
    handleStatusChange(orderId, "cancelled", rejectState?.reason || undefined);
  };

  const activeOrders = orders?.filter((o) =>
    ["pending", "confirmed", "preparing", "ready"].includes(o.status)
  ) ?? [];
  const pastOrders = orders?.filter((o) =>
    ["completed", "cancelled"].includes(o.status)
  ) ?? [];

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile slide-in nav drawer */}
      {navOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setNavOpen(false)} />
          {/* Panel */}
          <div className="relative ml-auto w-72 h-full bg-background shadow-2xl flex flex-col overflow-y-auto">
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <span className="font-black text-lg text-primary">ISLAND TACOS</span>
              <button onClick={() => setNavOpen(false)} className="p-1.5 rounded-md hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* Nav sections */}
            <nav className="flex-1 px-3 py-4 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 pb-1">Operations</p>
              <button onClick={() => { setNavOpen(false); navigate(`${adminRoutes.login}?redirect=${encodeURIComponent(adminRoutes.pos)}`); }}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-muted text-left font-medium">
                <span className="text-lg">🧾</span> POS Terminal
              </button>
              <Link href={adminRoutes.kitchen} onClick={() => setNavOpen(false)}>
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted font-medium cursor-pointer">
                  <ChefHat className="h-5 w-5 text-orange-500" /> Kitchen Display
                </div>
              </Link>
              <a href={adminRoutes.display} target="_blank" rel="noopener noreferrer" onClick={() => setNavOpen(false)}>
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted font-medium">
                  <Monitor className="h-5 w-5 text-blue-500" /> Customer Display
                </div>
              </a>

              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 pb-1 pt-4">Manage</p>
              <Link href={adminRoutes.menu} onClick={() => setNavOpen(false)}>
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted font-medium cursor-pointer">
                  <UtensilsCrossed className="h-5 w-5 text-green-600" /> Menu Editor
                </div>
              </Link>
              <Link href={adminRoutes.modifiers} onClick={() => setNavOpen(false)}>
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted font-medium cursor-pointer">
                  <Settings className="h-5 w-5 text-green-700" /> Modifiers
                </div>
              </Link>
              <Link href={adminRoutes.settings} onClick={() => setNavOpen(false)}>
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted font-medium cursor-pointer">
                  <Settings className="h-5 w-5 text-muted-foreground" /> Store Settings
                </div>
              </Link>

              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 pb-1 pt-4">Analytics</p>
              <Link href={adminRoutes.reports} onClick={() => setNavOpen(false)}>
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted font-medium cursor-pointer">
                  <BarChart3 className="h-5 w-5 text-purple-600" /> Reports
                </div>
              </Link>
              <Link href={adminRoutes.customers} onClick={() => setNavOpen(false)}>
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted font-medium cursor-pointer">
                  <Users className="h-5 w-5 text-blue-600" /> Customers
                </div>
              </Link>

              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 pb-1 pt-4">More</p>
              <Link href="/" onClick={() => setNavOpen(false)}>
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted font-medium cursor-pointer">
                  <Store className="h-5 w-5 text-primary" /> Online Store
                </div>
              </Link>
            </nav>
            {/* Sign out at bottom */}
            <div className="px-3 pb-6 border-t pt-4">
              <button onClick={() => { setNavOpen(false); logout(); }}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-red-50 text-red-600 font-medium">
                <LogOut className="h-5 w-5" /> Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4">
          <div className="flex h-14 md:h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-base md:text-xl font-black text-primary">ISLAND TACOS</span>
              <span className="text-muted-foreground hidden sm:inline">— Admin</span>
            </div>
            {/* Mobile: POS shortcut + hamburger */}
            <div className="flex items-center gap-2 md:hidden">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-muted-foreground font-medium">Live</span>
              </div>
              <Button size="sm" className="bg-[#F5A623] hover:bg-[#E09520] text-black font-bold"
                onClick={() => navigate(`${adminRoutes.login}?redirect=${encodeURIComponent(adminRoutes.pos)}`)}>
                🧾 POS
              </Button>
              <button onClick={() => setNavOpen(true)} className="p-2 rounded-md hover:bg-muted">
                <Menu className="h-5 w-5" />
              </button>
            </div>
            {/* Desktop: full nav bar (unchanged) */}
            <div className="hidden md:flex items-center gap-1 overflow-x-auto scrollbar-none flex-1 justify-end">
              <div className="flex items-center gap-1 mr-1 shrink-0">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-muted-foreground font-medium">Live</span>
              </div>
              <Button size="sm" className="bg-[#F5A623] hover:bg-[#E09520] text-black font-bold shrink-0"
                onClick={() => navigate(`${adminRoutes.login}?redirect=${encodeURIComponent(adminRoutes.pos)}`)}>
                🧾 POS
              </Button>
              <Link href={adminRoutes.kitchen}>
                <Button variant="outline" size="sm" className="shrink-0">
                  <Monitor className="h-4 w-4" /><span className="ml-1.5">Kitchen</span>
                </Button>
              </Link>
              <a href={adminRoutes.display} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="shrink-0">
                  <Monitor className="h-4 w-4 text-blue-500" /><span className="ml-1.5">Display</span>
                </Button>
              </a>
              <Link href={adminRoutes.menu}>
                <Button variant="outline" size="sm" className="shrink-0">
                  <Settings className="h-4 w-4" /><span className="ml-1.5">Menu</span>
                </Button>
              </Link>
              <Link href={adminRoutes.modifiers}>
                <Button variant="outline" size="sm" className="shrink-0">
                  <Settings className="h-4 w-4" /><span className="ml-1.5">Modifiers</span>
                </Button>
              </Link>
              <Link href={adminRoutes.reports}>
                <Button variant="outline" size="sm" className="shrink-0">
                  <BarChart3 className="h-4 w-4" /><span className="ml-1.5">Reports</span>
                </Button>
              </Link>
              <Link href={adminRoutes.customers}>
                <Button variant="outline" size="sm" className="shrink-0">
                  <Users className="h-4 w-4" /><span className="ml-1.5">Customers</span>
                </Button>
              </Link>
              <Link href={adminRoutes.settings}>
                <Button variant="outline" size="sm" className="shrink-0">
                  <Settings className="h-4 w-4 text-muted-foreground" /><span className="ml-1.5">Store</span>
                </Button>
              </Link>
              <Link href="/">
                <Button variant="ghost" size="sm" className="shrink-0">Store</Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground shrink-0">
                <LogOut className="h-4 w-4" /><span className="ml-1.5">Sign out</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Today's Orders", value: stats?.todayOrders ?? 0, icon: ShoppingBag, color: "text-blue-600" },
            { label: "Today's Revenue", value: `$${(stats?.todayRevenue ?? 0).toFixed(2)}`, icon: DollarSign, color: "text-green-600" },
            { label: "Pending Orders", value: stats?.pendingOrders ?? 0, icon: Clock, color: "text-orange-600" },
            { label: "Completed", value: stats?.completedOrders ?? 0, icon: CheckCircle2, color: "text-gray-600" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-xl border bg-card p-4 flex items-center gap-4">
              <div className={`rounded-lg bg-muted p-2 ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{label}</p>
                <p className="text-2xl font-black">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Cloud sync */}
        <div className="rounded-xl border bg-card p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600"><CloudUpload className="h-5 w-5" /></div>
            <div>
              <p className="font-semibold text-sm">Sync Menu to Online Store</p>
              <p className="text-xs text-muted-foreground">
                {lastSync ? `Last synced: ${lastSync}` : "Pushes your menu to orders.islandtacosbvi.com"}
              </p>
              {syncMessage && (
                <p className={`text-xs mt-0.5 ${syncState === "error" ? "text-red-600" : "text-green-600"}`}>{syncMessage}</p>
              )}
            </div>
          </div>
          <Button size="sm" variant="outline"
            disabled={syncState === "syncing"}
            onClick={handleSync}
            className={syncState === "success" ? "border-green-500 text-green-700" : syncState === "error" ? "border-red-400 text-red-600" : ""}>
            <CloudUpload className={`h-4 w-4 mr-1.5 ${syncState === "syncing" ? "animate-pulse" : ""}`} />
            {syncState === "syncing" ? "Syncing…" : syncState === "success" ? "Synced!" : syncState === "error" ? "Retry Sync" : "Sync Now"}
          </Button>
        </div>

        {/* Loyverse history import */}
        <div className="rounded-xl border bg-card p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-50 p-2 text-purple-600"><History className="h-5 w-5" /></div>
            <div>
              <p className="font-semibold text-sm">Import Loyverse Sales History</p>
              <p className="text-xs text-muted-foreground">
                {importState === "idle"
                  ? "One-time import of all past orders and customers from Loyverse"
                  : importState === "importing"
                  ? "Fetching from Loyverse — please wait…"
                  : null}
              </p>
              {importMessage && (
                <p className={`text-xs mt-0.5 ${importState === "error" ? "text-red-600" : "text-green-600"}`}>{importMessage}</p>
              )}
            </div>
          </div>
          <Button size="sm" variant="outline"
            disabled={importState === "importing" || importState === "success"}
            onClick={handleLoyverseImport}
            className={importState === "success" ? "border-green-500 text-green-700" : importState === "error" ? "border-red-400 text-red-600" : "border-purple-300 text-purple-700 hover:bg-purple-50"}>
            <History className={`h-4 w-4 mr-1.5 ${importState === "importing" ? "animate-spin" : ""}`} />
            {importState === "importing" ? "Importing…" : importState === "success" ? "Imported!" : importState === "error" ? "Retry Import" : "Import Now"}
          </Button>
        </div>

        {stats?.popularItems && stats.popularItems.length > 0 && (
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="font-bold text-lg">Top Items Today</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {stats.popularItems.map((item) => (
                <div key={item.name} className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1">
                  <span className="font-medium text-sm">{item.name}</span>
                  <span className="text-primary font-bold text-sm">x{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active orders */}
        <section>
          <h2 className="text-2xl font-black mb-4">
            Active Orders
            {activeOrders.length > 0 && (
              <span className="ml-2 text-base font-normal text-muted-foreground">({activeOrders.length})</span>
            )}
          </h2>

          {isLoading ? (
            <p className="text-muted-foreground">Loading orders...</p>
          ) : activeOrders.length === 0 ? (
            <div className="rounded-xl border bg-muted/30 p-8 text-center text-muted-foreground">
              No active orders right now.
            </div>
          ) : (
            <div className="space-y-4">
              {activeOrders.map((order) => (
                <div key={order.id} className="rounded-xl border bg-card p-5 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-black text-lg text-primary">{order.confirmationCode}</span>
                        <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${STATUS_COLORS[order.status]}`}>
                          {STATUS_LABELS[order.status]}
                        </span>
                        <span className="text-xs bg-muted rounded-full px-2 py-0.5 capitalize">{order.orderType}</span>
                      </div>
                      <p className="font-medium">{order.customerName}</p>
                      {order.customerPhone ? (
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-sm text-muted-foreground">{order.customerPhone}</span>
                          <a
                            href={`tel:${order.customerPhone}`}
                            className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 font-medium transition-colors"
                          >
                            📞 Call
                          </a>
                          <a
                            href={`https://wa.me/${order.customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi ${order.customerName}, your Island Tacos order #${order.confirmationCode} is ready for pickup! 🌮`)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 hover:bg-green-200 font-medium transition-colors"
                          >
                            💬 WhatsApp
                          </a>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Walk-in</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-black">${order.total.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>

                  <div className="text-sm space-y-1">
                    {order.items?.map((item) => (
                      <div key={item.id} className="flex gap-2 text-muted-foreground">
                        <span className="font-medium text-foreground">{item.quantity}x</span>
                        <span>{item.menuItemName}</span>
                        {item.notes && <span className="italic">— {item.notes}</span>}
                      </div>
                    ))}
                    {order.notes && (
                      <p className="text-muted-foreground italic mt-1">Note: {order.notes}</p>
                    )}
                  </div>

                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-3">
                      {NEXT_STATUS[order.status] && (
                        <Button
                          size="sm"
                          onClick={() => handleStatusChange(order.id, NEXT_STATUS[order.status])}
                          disabled={updateStatus.isPending}
                        >
                          Mark as {STATUS_LABELS[NEXT_STATUS[order.status]]}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant={rejectState?.orderId === order.id ? "outline" : "destructive"}
                        onClick={() => handleCancelClick(order.id)}
                        disabled={updateStatus.isPending}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        {rejectState?.orderId === order.id ? "Never mind" : "Cancel Order"}
                      </Button>
                    </div>
                    {rejectState?.orderId === order.id && (
                      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-3">
                        <p className="text-sm font-medium text-destructive">What's the reason?</p>
                        <div className="flex flex-wrap gap-2">
                          {["Out of chicken", "Out of steak", "Out of shrimp", "Out of salmon", "Out of burger"].map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setRejectState({ ...rejectState, reason: rejectState.reason === opt ? "" : opt })}
                              className={`rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${
                                rejectState.reason === opt
                                  ? "bg-destructive text-destructive-foreground border-destructive"
                                  : "border-destructive/40 text-destructive hover:bg-destructive/10"
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                        <Textarea
                          placeholder="Other reason (optional)"
                          value={["Out of chicken","Out of steak","Out of shrimp","Out of salmon","Out of burger"].includes(rejectState.reason) ? "" : rejectState.reason}
                          onChange={(e) => setRejectState({ ...rejectState, reason: e.target.value })}
                          rows={1}
                          className="text-sm resize-none"
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => confirmCancellation(order.id)}
                          disabled={updateStatus.isPending}
                        >
                          {updateStatus.isPending ? "Cancelling..." : "Confirm Cancellation"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Past orders */}
        {pastOrders.length > 0 && (
          <section>
            <h2 className="text-2xl font-black mb-4">Recent History</h2>
            <div className="rounded-xl border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold">Code</th>
                    <th className="text-left p-3 font-semibold">Customer</th>
                    <th className="text-left p-3 font-semibold hidden md:table-cell">Items</th>
                    <th className="text-right p-3 font-semibold">Total</th>
                    <th className="text-left p-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pastOrders.slice(0, 20).map((order, idx) => (
                    <tr key={order.id} className={idx % 2 === 0 ? "" : "bg-muted/20"}>
                      <td className="p-3 font-mono font-bold text-primary">{order.confirmationCode}</td>
                      <td className="p-3">
                        <div>{order.customerName}</div>
                        <div className="text-muted-foreground text-xs">{new Date(order.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                      </td>
                      <td className="p-3 hidden md:table-cell text-muted-foreground">
                        <div className="space-y-0.5">
                          {order.items?.map((i: { id: number; quantity: number; menuItemName: string; notes?: string }) => (
                            <div key={i.id}>
                              <span>{i.quantity}x {i.menuItemName}</span>
                              {i.notes && <span className="block text-xs pl-2 text-muted-foreground/70 italic">{i.notes}</span>}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-right font-bold">${order.total.toFixed(2)}</td>
                      <td className="p-3">
                        <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${STATUS_COLORS[order.status]}`}>
                          {STATUS_LABELS[order.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

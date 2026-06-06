import { useState, useRef, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { setPageMeta } from "@/lib/page-meta";
import { authHeaders, clearAuthToken } from "@/lib/auth";
import {
  useGetAdminStats,
  useGetRecentOrders,
  useUpdateOrderStatus,
  getGetAdminStatsQueryKey,
  getGetRecentOrdersQueryKey,
  type UpdateOrderStatusBodyStatus,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DateRange } from "react-day-picker";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  ShoppingBag, DollarSign, Clock, CheckCircle2, TrendingUp,
  Settings, Monitor, LogOut, XCircle, BarChart3, Users,
  CloudUpload, CloudDownload, Menu, X, ChefHat, UtensilsCrossed, Store,
  History, ScrollText, LayoutDashboard, CalendarIcon,
} from "lucide-react";
import { adminRoutes } from "@/lib/admin-path";
import { useToast } from "@/hooks/use-toast";

type DatePreset = "today" | "yesterday" | "last7" | "custom";

function toBVIDateStr(date: Date): string {
  const bvi = new Date(date.getTime() - 4 * 60 * 60 * 1000);
  return bvi.toISOString().slice(0, 10);
}
function bviNDaysAgo(n: number): string {
  return toBVIDateStr(new Date(Date.now() - n * 24 * 60 * 60 * 1000));
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-900/40 text-yellow-300",
  confirmed: "bg-blue-900/40 text-blue-300",
  preparing: "bg-orange-900/40 text-orange-300",
  ready: "bg-green-900/40 text-green-300",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-red-900/40 text-red-300",
};
const NEXT_STATUS: Record<string, UpdateOrderStatusBodyStatus> = {
  pending: "confirmed",
  confirmed: "preparing",
  preparing: "ready",
  ready: "completed",
};
const STATUS_DONUT_COLOR: Record<string, string> = {
  pending: "#f59e0b",
  confirmed: "#3b82f6",
  preparing: "#f97316",
  ready: "#22c55e",
  cancelled: "#ef4444",
  "completed-online": "#10b981",
  "completed-phone": "#ec4899",
  "completed-pos": "#6366f1",
};
const SOURCE_LABELS: Record<string, string> = {
  online: "Online",
  phone: "Phone",
  pos: "Walk-in",
};

type RejectState = { orderId: number; reason: string } | null;

type NavItem = {
  label: string;
  icon: React.ElementType;
  href?: string;
  action?: () => void;
  external?: boolean;
  iconColor?: string;
};
type NavSection = { title: string; items: NavItem[] };

function Sidebar({
  sections,
  onClose,
  onLogout,
  isMobile,
}: {
  sections: NavSection[];
  onClose?: () => void;
  onLogout: () => void;
  isMobile?: boolean;
}) {
  const [location] = useLocation();
  return (
    <div className={`flex flex-col h-full bg-background text-foreground ${isMobile ? "w-72" : "w-64"}`}>
      {/* Brand */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-border">
        <div>
          <div className="text-lg font-black tracking-tight text-white">ISLAND TACOS</div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mt-0.5">Admin Panel</div>
        </div>
        {isMobile && onClose && (
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-white">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 mb-1.5">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = item.href ? location === item.href : false;
                const base =
                  "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left cursor-pointer";
                const activeClass = "bg-muted text-foreground";
                const inactiveClass = "text-foreground/70 hover:bg-muted hover:text-foreground";
                const content = (
                  <>
                    <item.icon className={`h-4 w-4 shrink-0 ${item.iconColor ?? "text-muted-foreground"}`} />
                    {item.label}
                  </>
                );
                if (item.action) {
                  return (
                    <button key={item.label} onClick={() => { item.action!(); onClose?.(); }} className={`${base} ${isActive ? activeClass : inactiveClass}`}>
                      {content}
                    </button>
                  );
                }
                if (item.external) {
                  return (
                    <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" onClick={onClose} className={`${base} ${inactiveClass}`}>
                      {content}
                    </a>
                  );
                }
                return (
                  <Link key={item.label} href={item.href!}>
                    <div onClick={onClose} className={`${base} ${isActive ? activeClass : inactiveClass}`}>
                      {content}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-5 border-t border-border pt-4 space-y-0.5">
        <Link href="/">
          <div onClick={onClose} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground/70 hover:bg-muted hover:text-white transition-colors cursor-pointer">
            <Store className="h-4 w-4 text-muted-foreground" /> Online Store
          </div>
        </Link>
        <button
          onClick={() => { onLogout(); onClose?.(); }}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-900/30 hover:text-red-300 transition-colors"
        >
          <LogOut className="h-4 w-4" /> Sign Out
        </button>
      </div>
    </div>
  );
}

export default function Admin() {
  useEffect(() => {
    // TODO(store-settings): use `Admin — ${useStoreSettings().storeName}` once page-meta accepts a getter
    setPageMeta("Admin — Island Tacos", "⚙️", { iconUrl: "/icon-admin-192.png", manifestUrl: "/manifest-admin.json" });
  }, []);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [rejectState, setRejectState] = useState<RejectState>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [preset, setPreset] = useState<DatePreset>("today");
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [syncMessage, setSyncMessage] = useState("");
  const [lastSync, setLastSync] = useState<string | null>(() => localStorage.getItem("lastMenuSync"));
  const [importState, setImportState] = useState<"idle" | "importing" | "success" | "error">("idle");
  const [importMessage, setImportMessage] = useState("");
  const [csvState, setCsvState] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [csvMessage, setCsvMessage] = useState("");
  const [pullMenuState, setPullMenuState] = useState<"idle" | "pulling" | "success" | "error">("idle");
  const [pullMenuMessage, setPullMenuMessage] = useState("");
  const csvInputRef = useRef<HTMLInputElement>(null);
  const prevOrderIdsRef = useRef<Set<number>>(new Set());
  const isFirstFetchRef = useRef(true);

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
    } catch (e) { setSyncState("error"); setSyncMessage(String(e)); }
  };

  const handlePullMenuFromCloud = async () => {
    if (pullMenuState === "pulling") return;
    setPullMenuState("pulling"); setPullMenuMessage("");
    try {
      const r = await fetch("/api/sync/pull", { method: "POST", credentials: "include", headers: authHeaders() });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Pull failed");
      setPullMenuState("success");
      setPullMenuMessage(`${data.items ?? 0} items, ${data.modifiers ?? 0} modifiers pulled from cloud`);
      setTimeout(() => setPullMenuState("idle"), 5000);
    } catch (e) { setPullMenuState("error"); setPullMenuMessage(String(e)); }
  };

  const handleLoyverseImport = async () => {
    if (importState === "importing") return;
    setImportState("importing");
    setImportMessage("Fetching data from Loyverse… this may take a minute.");
    try {
      const r = await fetch("/api/loyverse/import-history", { method: "POST", credentials: "include", headers: authHeaders() });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Import failed");
      const { customersImported, customersSkipped, ordersImported, ordersSkipped, truncated, errors } = data;
      setImportState("success");
      setImportMessage(
        `Imported ${ordersImported} orders + ${customersImported} customers` +
        (ordersSkipped || customersSkipped ? ` (${ordersSkipped}/${customersSkipped} already existed)` : "") +
        (truncated ? " — receipts limited to last 31 days." : ".") +
        (errors?.length ? ` ${errors.length} error(s): ${errors[0]}` : "")
      );
    } catch (e) { setImportState("error"); setImportMessage(String(e)); }
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvState("uploading"); setCsvMessage("Uploading & importing CSV — please wait…");
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch("/api/loyverse/import-csv", { method: "POST", credentials: "include", headers: authHeaders(), body: form });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "CSV import failed");
      const { imported, skipped, errors: errs } = data;
      setCsvState("success");
      setCsvMessage(`Imported ${imported} orders` + (skipped ? ` (${skipped} already existed)` : "") + (errs ? `, ${errs} row error(s)` : "") + ".");
      setTimeout(() => { setCsvState("idle"); setCsvMessage(""); }, 8000);
    } catch (e) {
      setCsvState("error"); setCsvMessage(String(e));
    } finally {
      if (csvInputRef.current) csvInputRef.current.value = "";
    }
  };

  const dateParams = useMemo(() => {
    if (preset === "today") return { startDate: bviNDaysAgo(0), endDate: bviNDaysAgo(0) };
    if (preset === "yesterday") return { startDate: bviNDaysAgo(1), endDate: bviNDaysAgo(1) };
    if (preset === "last7") return { startDate: bviNDaysAgo(6), endDate: bviNDaysAgo(0) };
    return {
      startDate: customRange?.from ? toBVIDateStr(customRange.from) : undefined,
      endDate: customRange?.to ? toBVIDateStr(customRange.to) : (customRange?.from ? toBVIDateStr(customRange.from) : undefined),
    };
  }, [preset, customRange]);

  const statsQueryKey = getGetAdminStatsQueryKey(dateParams);
  const ordersQueryKey = getGetRecentOrdersQueryKey({ limit: 50, ...dateParams });

  const { data: stats } = useGetAdminStats(
    dateParams,
    { query: { queryKey: statsQueryKey, refetchInterval: 5_000 } }
  );
  const { data: orders, isLoading } = useGetRecentOrders(
    { limit: 50, ...dateParams },
    { query: { queryKey: ordersQueryKey, refetchInterval: 5_000 } }
  );

  useEffect(() => {
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: statsQueryKey });
      queryClient.invalidateQueries({ queryKey: ordersQueryKey });
    };
    window.addEventListener("kds:order-updated", refresh);
    let bc: BroadcastChannel | null = null;
    try { bc = new BroadcastChannel("island_tacos_kds"); bc.onmessage = (e) => { if (e.data?.type === "kds:order-updated") refresh(); }; } catch {}
    return () => { window.removeEventListener("kds:order-updated", refresh); bc?.close(); };
  }, [queryClient]);

  const updateStatus = useUpdateOrderStatus();

  useEffect(() => {
    if (!orders) return;
    const activeIds = new Set(orders.filter((o) => ["pending", "confirmed", "preparing", "ready"].includes(o.status)).map((o) => o.id));
    if (isFirstFetchRef.current) { isFirstFetchRef.current = false; prevOrderIdsRef.current = activeIds; return; }
    const hasNew = [...activeIds].some((id) => !prevOrderIdsRef.current.has(id));
    if (hasNew) toast({ title: "New order received!", description: "Check active orders below." });
    prevOrderIdsRef.current = activeIds;
  }, [orders, toast]);

  const handleStatusChange = (orderId: number, status: UpdateOrderStatusBodyStatus, cancellationReason?: string) => {
    updateStatus.mutate(
      { id: orderId, data: { status, cancellationReason: cancellationReason ?? null } },
      { onSuccess: () => { queryClient.invalidateQueries({ queryKey: statsQueryKey }); queryClient.invalidateQueries({ queryKey: ordersQueryKey }); setRejectState(null); } }
    );
  };

  const handleCancelClick = (orderId: number) => {
    setRejectState(rejectState?.orderId === orderId ? null : { orderId, reason: "" });
  };

  const activeOrders = orders?.filter((o) => ["pending", "confirmed", "preparing", "ready"].includes(o.status)) ?? [];
  const pastOrders = orders?.filter((o) => ["completed", "cancelled"].includes(o.status)) ?? [];

  // Compute hourly revenue chart from returned orders (already date-filtered)
  const isMultiDay = preset === "last7" || (preset === "custom" && customRange?.to && customRange.from && customRange.to.getTime() !== customRange.from.getTime());

  const hourlyData = useMemo(() => {
    if (isMultiDay) {
      // For multi-day ranges, aggregate by date
      const byDate: Record<string, { revenue: number; count: number }> = {};
      (orders ?? []).forEach((o) => {
        const d = toBVIDateStr(new Date(o.createdAt));
        if (!byDate[d]) byDate[d] = { revenue: 0, count: 0 };
        byDate[d].revenue += o.total;
        byDate[d].count++;
      });
      return Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, d]) => ({
        hour: date.slice(5),
        revenue: parseFloat(d.revenue.toFixed(2)),
        orders: d.count,
      }));
    }
    const byHour: Record<number, { revenue: number; count: number }> = {};
    for (let h = 10; h <= 20; h++) byHour[h] = { revenue: 0, count: 0 };
    (orders ?? []).forEach((o) => {
      const h = new Date(o.createdAt).getHours();
      if (byHour[h] !== undefined) { byHour[h].revenue += o.total; byHour[h].count++; }
    });
    return Object.entries(byHour).map(([h, d]) => ({
      hour: `${Number(h) % 12 || 12}${Number(h) >= 12 ? "pm" : "am"}`,
      revenue: parseFloat(d.revenue.toFixed(2)),
      orders: d.count,
    }));
  }, [orders, isMultiDay]);

  // Status donut data
  const statusDonut = useMemo(() => {
    const statusCount: Record<string, number> = {};
    (orders ?? []).forEach((o) => {
      if (o.status !== "completed") {
        statusCount[o.status] = (statusCount[o.status] ?? 0) + 1;
      }
    });
    const entries: { name: string; value: number; color: string; key: string }[] = [];
    const STATUS_ORDER = ["pending", "confirmed", "preparing", "ready", "cancelled"];
    for (const s of STATUS_ORDER) {
      if (statusCount[s]) entries.push({ key: s, name: STATUS_LABELS[s] ?? s, value: statusCount[s], color: STATUS_DONUT_COLOR[s] ?? "#94a3b8" });
    }
    const cbs = stats?.completedBySource;
    if (cbs) {
      const sources: Array<keyof typeof cbs> = ["online", "phone", "pos"];
      for (const src of sources) {
        const count = cbs[src] ?? 0;
        if (count > 0) entries.push({ key: `completed-${src}`, name: `Done · ${SOURCE_LABELS[src]}`, value: count, color: STATUS_DONUT_COLOR[`completed-${src}`] ?? "#10b981" });
      }
    }
    return entries;
  }, [orders, stats]);

  // Top items bar data
  const topItemsData = useMemo(() =>
    (stats?.popularItems ?? []).slice(0, 8).map((i) => ({ name: i.name.length > 14 ? i.name.slice(0, 13) + "…" : i.name, count: i.count })),
    [stats]
  );

  const navSections: NavSection[] = [
    {
      title: "Operations",
      items: [
        { label: "Dashboard", icon: LayoutDashboard, href: adminRoutes.dashboard, iconColor: "text-emerald-400" },
        {
          label: "POS Terminal", icon: ShoppingBag, iconColor: "text-amber-400",
          action: () => navigate(`${adminRoutes.login}?redirect=${encodeURIComponent(adminRoutes.pos)}`),
        },
        { label: "Kitchen Display", icon: ChefHat, href: adminRoutes.kitchen, iconColor: "text-orange-400" },
        { label: "Customer Display", icon: Monitor, href: adminRoutes.display, external: true, iconColor: "text-blue-400" },
      ],
    },
    {
      title: "Manage",
      items: [
        { label: "Menu Editor", icon: UtensilsCrossed, href: adminRoutes.menu, iconColor: "text-green-400" },
        { label: "Modifiers", icon: Settings, href: adminRoutes.modifiers, iconColor: "text-green-500" },
        { label: "Store Settings", icon: Settings, href: adminRoutes.settings, iconColor: "text-muted-foreground" },
      ],
    },
    {
      title: "Analytics",
      items: [
        { label: "Reports", icon: BarChart3, href: adminRoutes.reports, iconColor: "text-purple-400" },
        { label: "Financials", icon: History, href: adminRoutes.financials, iconColor: "text-emerald-400" },
        { label: "Customers", icon: Users, href: adminRoutes.customers, iconColor: "text-blue-400" },
        { label: "Customs (HMC-12)", icon: ScrollText, href: adminRoutes.customs, iconColor: "text-amber-400" },
      ],
    },
  ];

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col shrink-0">
        <Sidebar sections={navSections} onLogout={logout} />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative h-full shadow-2xl">
            <Sidebar sections={navSections} onClose={() => setSidebarOpen(false)} onLogout={logout} isMobile />
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="shrink-0 flex items-center justify-between h-14 px-4 md:px-6 bg-card border-b border-border">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-md hover:bg-muted">
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-black text-foreground text-base leading-tight">Dashboard</h1>
              {/* TODO(store-settings): replace "Island Tacos" with useStoreSettings().storeName */}
              <p className="text-xs text-muted-foreground leading-tight hidden sm:block">Island Tacos — Admin</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Live
            </span>
            <Button
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold"
              onClick={() => navigate(`${adminRoutes.login}?redirect=${encodeURIComponent(adminRoutes.pos)}`)}
            >
              🧾 POS
            </Button>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">

          {/* Date range picker */}
          <div className="flex flex-wrap items-center gap-2">
            {(["today", "yesterday", "last7", "custom"] as DatePreset[]).map((p) => (
              <button
                key={p}
                onClick={() => { setPreset(p); if (p !== "custom") setCalOpen(false); else setCalOpen(true); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${preset === p ? "bg-muted text-white border-border" : "bg-card text-muted-foreground border-border hover:border-border"}`}
              >
                {p === "today" ? "Today" : p === "yesterday" ? "Yesterday" : p === "last7" ? "Last 7 Days" : "Custom"}
              </button>
            ))}
            {preset === "custom" && (
              <Popover open={calOpen} onOpenChange={setCalOpen}>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-card text-muted-foreground border-border hover:border-border transition-colors">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {customRange?.from
                      ? customRange.to && customRange.to.getTime() !== customRange.from.getTime()
                        ? `${toBVIDateStr(customRange.from)} → ${toBVIDateStr(customRange.to)}`
                        : toBVIDateStr(customRange.from)
                      : "Pick dates…"}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={customRange}
                    onSelect={(range) => {
                      setCustomRange(range);
                      if (range?.from && range?.to) setCalOpen(false);
                    }}
                    numberOfMonths={1}
                    disabled={{ after: new Date() }}
                  />
                </PopoverContent>
              </Popover>
            )}
            <span className="text-xs text-muted-foreground ml-1">
              {preset === "today" ? bviNDaysAgo(0)
                : preset === "yesterday" ? bviNDaysAgo(1)
                : preset === "last7" ? `${bviNDaysAgo(6)} → ${bviNDaysAgo(0)}`
                : dateParams.startDate ? (dateParams.endDate && dateParams.endDate !== dateParams.startDate ? `${dateParams.startDate} → ${dateParams.endDate}` : dateParams.startDate) : ""}
            </span>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
            {[
              { label: "Orders", value: stats?.todayOrders ?? 0, icon: ShoppingBag, bg: "bg-blue-900/30", iconColor: "text-blue-400", trend: null },
              { label: "Revenue", value: `$${(stats?.todayRevenue ?? 0).toFixed(2)}`, icon: DollarSign, bg: "bg-green-900/30", iconColor: "text-green-400", trend: null },
              { label: "Active", value: stats?.pendingOrders ?? 0, icon: Clock, bg: "bg-amber-900/30", iconColor: "text-amber-400", trend: null },
              { label: "Completed", value: stats?.completedOrders ?? 0, icon: CheckCircle2, bg: "bg-muted", iconColor: "text-muted-foreground", trend: null },
              { label: "Cancelled", value: stats?.cancelledOrders ?? 0, icon: XCircle, bg: "bg-red-900/30", iconColor: "text-red-400", trend: null },
            ].map(({ label, value, icon: Icon, bg, iconColor }) => (
              <div key={label} className="bg-card rounded-xl border shadow-sm p-4 flex items-center gap-4">
                <div className={`rounded-xl ${bg} p-3 ${iconColor}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{label}</p>
                  <p className="text-2xl font-black text-foreground">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {/* Hourly revenue — takes 2 cols */}
            <div className="xl:col-span-2 bg-card rounded-xl border shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-bold text-foreground">Revenue</h2>
                  <p className="text-xs text-muted-foreground">{isMultiDay ? "Daily breakdown" : "Hourly breakdown"}</p>
                </div>
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={hourlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                    formatter={(v: number) => [`$${v.toFixed(2)}`, "Revenue"]}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} fill="url(#revGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Order status donut */}
            <div className="bg-card rounded-xl border shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-bold text-foreground">Order Mix</h2>
                  <p className="text-xs text-muted-foreground">By status (recent 50)</p>
                </div>
                <ShoppingBag className="h-5 w-5 text-blue-400" />
              </div>
              {statusDonut.length === 0 ? (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">No orders yet</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={statusDonut} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                        {statusDonut.map((d) => (
                          <Cell key={d.key} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                    {statusDonut.map((d) => (
                      <span key={d.key} className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                        {d.name} ({d.value})
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Top items bar chart */}
          {topItemsData.length > 0 && (
            <div className="bg-card rounded-xl border shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-bold text-foreground">Top Items</h2>
                  <p className="text-xs text-muted-foreground">Units sold</p>
                </div>
                <TrendingUp className="h-5 w-5 text-purple-400" />
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={topItemsData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Data tools */}
          <div className="bg-card rounded-xl border shadow-sm p-5 space-y-4">
            <h2 className="font-bold text-foreground text-sm">Data Tools</h2>

            {/* Menu sync */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-900/30 p-2 text-blue-400"><CloudUpload className="h-4 w-4" /></div>
                <div>
                  <p className="font-semibold text-sm text-foreground">Sync Menu to Online Store</p>
                  <p className="text-xs text-muted-foreground">
                    {lastSync ? `Last synced: ${lastSync}` : "Pushes your menu to the ordering site"}
                  </p>
                  {syncMessage && <p className={`text-xs mt-0.5 ${syncState === "error" ? "text-red-600" : "text-green-600"}`}>{syncMessage}</p>}
                </div>
              </div>
              <Button size="sm" variant="outline" disabled={syncState === "syncing"} onClick={handleSync}
                className={syncState === "success" ? "border-green-500 text-green-700" : syncState === "error" ? "border-red-400 text-red-600" : ""}>
                <CloudUpload className={`h-4 w-4 mr-1.5 ${syncState === "syncing" ? "animate-pulse" : ""}`} />
                {syncState === "syncing" ? "Syncing…" : syncState === "success" ? "Synced!" : syncState === "error" ? "Retry" : "Sync Now"}
              </Button>
            </div>

            {/* Pull menu from cloud */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-teal-900/30 p-2 text-teal-400"><CloudDownload className="h-4 w-4" /></div>
                <div>
                  <p className="font-semibold text-sm text-foreground">Pull Menu from Cloud</p>
                  <p className="text-xs text-muted-foreground">Resyncs all items &amp; modifiers from the online store to this device</p>
                  {pullMenuMessage && <p className={`text-xs mt-0.5 ${pullMenuState === "error" ? "text-red-600" : "text-green-600"}`}>{pullMenuMessage}</p>}
                </div>
              </div>
              <Button size="sm" variant="outline" disabled={pullMenuState === "pulling"} onClick={handlePullMenuFromCloud}
                className={pullMenuState === "success" ? "border-green-500 text-green-700" : pullMenuState === "error" ? "border-red-400 text-red-600" : "border-teal-300 text-teal-400 hover:bg-teal-900/30"}>
                <CloudDownload className={`h-4 w-4 mr-1.5 ${pullMenuState === "pulling" ? "animate-pulse" : ""}`} />
                {pullMenuState === "pulling" ? "Pulling…" : pullMenuState === "success" ? "Done!" : pullMenuState === "error" ? "Retry" : "Pull Now"}
              </Button>
            </div>

            {/* Loyverse import */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-purple-900/30 p-2 text-purple-300"><History className="h-4 w-4" /></div>
                <div>
                  <p className="font-semibold text-sm text-foreground">Import from Loyverse API</p>
                  <p className="text-xs text-muted-foreground">
                    {importState === "importing" ? "Fetching from Loyverse…" : "Imports customers + last 30 days of receipts"}
                  </p>
                  {importMessage && <p className={`text-xs mt-0.5 ${importState === "error" ? "text-red-600" : "text-green-600"}`}>{importMessage}</p>}
                </div>
              </div>
              <Button size="sm" variant="outline" disabled={importState === "importing" || importState === "success"} onClick={handleLoyverseImport}
                className={importState === "success" ? "border-green-500 text-green-700" : importState === "error" ? "border-red-400 text-red-600" : "border-purple-300 text-purple-300 hover:bg-purple-900/30"}>
                <History className={`h-4 w-4 mr-1.5 ${importState === "importing" ? "animate-spin" : ""}`} />
                {importState === "importing" ? "Importing…" : importState === "success" ? "Imported!" : importState === "error" ? "Retry" : "Import Now"}
              </Button>
            </div>

            {/* CSV upload */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-indigo-900/30 p-2 text-indigo-300"><CloudUpload className="h-4 w-4" /></div>
                <div>
                  <p className="font-semibold text-sm text-foreground">Upload Loyverse CSV</p>
                  <p className="text-xs text-muted-foreground">Import full order history from exported CSV</p>
                  {csvMessage && <p className={`text-xs mt-0.5 ${csvState === "error" ? "text-red-600" : "text-green-600"}`}>{csvMessage}</p>}
                </div>
              </div>
              <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCSVUpload} />
              <Button size="sm" variant="outline" disabled={csvState === "uploading"} onClick={() => csvInputRef.current?.click()}
                className={csvState === "success" ? "border-green-500 text-green-700" : csvState === "error" ? "border-red-400 text-red-600" : "border-indigo-300 text-indigo-300 hover:bg-indigo-900/30"}>
                <CloudUpload className={`h-4 w-4 mr-1.5 ${csvState === "uploading" ? "animate-pulse" : ""}`} />
                {csvState === "uploading" ? "Uploading…" : csvState === "success" ? "Imported!" : csvState === "error" ? "Retry" : "Upload CSV"}
              </Button>
            </div>
          </div>

          {/* Active orders */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-xl font-black text-foreground">Active Orders</h2>
              {activeOrders.length > 0 && (
                <span className="text-xs font-bold bg-amber-900/40 text-amber-300 rounded-full px-2.5 py-0.5">
                  {activeOrders.length}
                </span>
              )}
            </div>
            {isLoading ? (
              <p className="text-muted-foreground">Loading orders…</p>
            ) : activeOrders.length === 0 ? (
              <div className="bg-card rounded-xl border p-8 text-center text-muted-foreground shadow-sm">
                No active orders right now.
              </div>
            ) : (
              <div className="space-y-4">
                {activeOrders.map((order) => (
                  <div key={order.id} className="bg-card rounded-xl border shadow-sm p-5 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono font-black text-lg text-emerald-600">{order.confirmationCode}</span>
                          <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${STATUS_COLORS[order.status]}`}>
                            {STATUS_LABELS[order.status]}
                          </span>
                          <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5 capitalize">{order.orderType}</span>
                        </div>
                        <p className="font-semibold text-foreground">{order.customerName}</p>
                        {order.customerPhone ? (
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-sm text-muted-foreground">{order.customerPhone}</span>
                            <a href={`tel:${order.customerPhone}`} className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 font-medium transition-colors">📞 Call</a>
                            {/* TODO(store-settings): interpolate useStoreSettings().storeName instead of "Island Tacos" in the wa.me text below */}
                            <a
                              href={`https://wa.me/${order.customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi ${order.customerName}, your Island Tacos order #${order.confirmationCode} is ready for pickup! 🌮`)}`}
                              target="_blank" rel="noreferrer"
                              className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 hover:bg-green-200 font-medium transition-colors"
                            >💬 WhatsApp</a>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Walk-in</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xl font-black text-foreground">${order.total.toFixed(2)}</p>
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
                      {order.notes && <p className="text-muted-foreground italic mt-1">Note: {order.notes}</p>}
                    </div>
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center gap-3">
                        {NEXT_STATUS[order.status] && (
                          <Button size="sm" onClick={() => handleStatusChange(order.id, NEXT_STATUS[order.status])} disabled={updateStatus.isPending}>
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
                                key={opt} type="button"
                                onClick={() => setRejectState({ ...rejectState, reason: rejectState.reason === opt ? "" : opt })}
                                className={`rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${rejectState.reason === opt ? "bg-destructive text-destructive-foreground border-destructive" : "border-destructive/40 text-destructive hover:bg-destructive/10"}`}
                              >{opt}</button>
                            ))}
                          </div>
                          <Textarea
                            placeholder="Other reason (optional)"
                            value={["Out of chicken","Out of steak","Out of shrimp","Out of salmon","Out of burger"].includes(rejectState.reason) ? "" : rejectState.reason}
                            onChange={(e) => setRejectState({ ...rejectState, reason: e.target.value })}
                            rows={1} className="text-sm resize-none"
                          />
                          <Button size="sm" variant="destructive" onClick={() => handleStatusChange(order.id, "cancelled", rejectState?.reason || undefined)} disabled={updateStatus.isPending}>
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
            <section className="pb-6">
              <h2 className="text-xl font-black text-foreground mb-4">Recent History</h2>
              <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b">
                    <tr>
                      <th className="text-left p-3 font-semibold text-muted-foreground">Code</th>
                      <th className="text-left p-3 font-semibold text-muted-foreground">Customer</th>
                      <th className="text-left p-3 font-semibold text-muted-foreground hidden md:table-cell">Items</th>
                      <th className="text-right p-3 font-semibold text-muted-foreground">Total</th>
                      <th className="text-left p-3 font-semibold text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pastOrders.slice(0, 20).map((order, idx) => (
                      <tr key={order.id} className={idx % 2 === 0 ? "bg-card" : "bg-muted/40/50"}>
                        <td className="p-3 font-mono font-bold text-emerald-600">{order.confirmationCode}</td>
                        <td className="p-3">
                          <div className="font-medium text-foreground">{order.customerName}</div>
                          <div className="text-muted-foreground text-xs">{new Date(order.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                        </td>
                        <td className="p-3 hidden md:table-cell text-muted-foreground">
                          {order.items?.map((i) => <div key={i.id}>{i.quantity}x {i.menuItemName}{i.notes && <span className="italic text-xs"> — {i.notes}</span>}</div>)}
                        </td>
                        <td className="p-3 text-right font-bold text-foreground">${order.total.toFixed(2)}</td>
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
        </main>
      </div>
    </div>
  );
}

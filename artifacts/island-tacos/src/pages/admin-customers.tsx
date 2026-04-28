import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { adminRoutes } from "@/lib/admin-path";
import { authHeaders } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search, Users, Phone, Mail, ShoppingBag, DollarSign, ChevronDown, ChevronUp, Loader2, X, Trash2, Download } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

interface CustomerSummary {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  visitCount: number;
  totalSpent: number;
  createdAt: string;
  updatedAt: string;
}

interface OrderItem {
  menuItemName: string;
  quantity: number;
  subtotal: number;
}

interface CustomerOrder {
  id: number;
  confirmationCode: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  source: string;
  total: number;
  createdAt: string;
  items: OrderItem[];
}

interface CustomerDetail extends CustomerSummary {
  orders: CustomerOrder[];
}

function statusColor(status: string) {
  switch (status) {
    case "completed": return "bg-green-100 text-green-700";
    case "cancelled": return "bg-red-100 text-red-700";
    case "confirmed": return "bg-blue-100 text-blue-700";
    default: return "bg-yellow-100 text-yellow-700";
  }
}

function CustomerRow({
  c,
  checked,
  onToggle,
  onSelect,
}: {
  c: CustomerSummary;
  checked: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  return (
    <div className={`flex items-center gap-3 px-5 py-4 border-b last:border-b-0 transition-colors ${checked ? "bg-primary/5" : "hover:bg-muted/40"}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        onClick={e => e.stopPropagation()}
        className="w-4 h-4 rounded accent-primary shrink-0 cursor-pointer"
      />
      <div
        onClick={onSelect}
        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
      >
        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
          {c.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{c.name}</p>
          <div className="flex items-center gap-3 mt-0.5">
            {c.email && <span className="text-xs text-muted-foreground truncate">{c.email}</span>}
            {c.phone && <span className="text-xs text-muted-foreground">{c.phone}</span>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold">${c.totalSpent.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">{c.visitCount} {c.visitCount === 1 ? "order" : "orders"}</p>
        </div>
      </div>
    </div>
  );
}

function CustomerDrawer({ customerId, onClose, onDelete }: { customerId: number; onClose: () => void; onDelete: () => void }) {
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/customers/${customerId}`, {
      headers: authHeaders(),
    })
      .then(r => r.json())
      .then((data: CustomerDetail) => {
        setCustomer(data);
        setNotes(data.notes ?? "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [customerId]);

  const saveNotes = async () => {
    if (!customer) return;
    setSavingNotes(true);
    await fetch(`${API}/api/customers/${customerId}/notes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ notes }),
    });
    setSavingNotes(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    await fetch(`${API}/api/customers/${customerId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    setDeleting(false);
    onDelete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-start sm:justify-end bg-black/40" onClick={onClose}>
      <div
        className="h-[92vh] sm:h-full w-full sm:max-w-md bg-background shadow-2xl flex flex-col overflow-hidden rounded-t-2xl sm:rounded-none"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold">Customer Profile</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !customer ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">Failed to load customer</div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Header */}
            <div className="px-6 py-5 border-b">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold shrink-0">
                  {customer.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold truncate">{customer.name}</h3>
                  {customer.email && (
                    <a href={`mailto:${customer.email}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mt-1">
                      <Mail className="w-3.5 h-3.5" /> {customer.email}
                    </a>
                  )}
                  {customer.phone && (
                    <a href={`tel:${customer.phone}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mt-0.5">
                      <Phone className="w-3.5 h-3.5" /> {customer.phone}
                    </a>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="rounded-lg bg-muted p-3 text-center">
                  <p className="text-2xl font-bold">{customer.visitCount}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Total Orders</p>
                </div>
                <div className="rounded-lg bg-muted p-3 text-center">
                  <p className="text-2xl font-bold">${customer.totalSpent.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Total Spent</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Customer since {new Date(customer.createdAt).toLocaleDateString()}
              </p>
            </div>

            {/* Notes */}
            <div className="px-6 py-4 border-b">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Staff Notes</p>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add private notes about this customer…"
                rows={3}
                className="w-full text-sm rounded-lg border bg-background px-3 py-2 outline-none focus:border-primary resize-none placeholder-muted-foreground"
              />
              <div className="flex items-center justify-between mt-2">
                <Button size="sm" onClick={saveNotes} disabled={savingNotes}>
                  {savingNotes ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  Save Notes
                </Button>
                {!deleteConfirm ? (
                  <button
                    onClick={() => setDeleteConfirm(true)}
                    className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete customer
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-600 font-medium">Sure?</span>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="text-xs bg-red-600 text-white px-2.5 py-1 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {deleting ? "Deleting…" : "Yes, delete"}
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(false)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Order history */}
            <div className="px-6 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Order History ({customer.orders.length})
              </p>
              {customer.orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No orders yet.</p>
              ) : (
                <div className="space-y-2">
                  {customer.orders.map(o => (
                    <div key={o.id} className="rounded-xl border overflow-hidden">
                      <div
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors"
                        onClick={() => setExpandedOrder(expandedOrder === o.id ? null : o.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-mono font-semibold">{o.confirmationCode}</span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor(o.status)}`}>
                              {o.status}
                            </span>
                            <span className="text-xs text-muted-foreground capitalize">{o.source}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(o.createdAt).toLocaleDateString()} • {new Date(o.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        <div className="text-right shrink-0 mr-2">
                          <p className="text-sm font-bold">${o.total.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground capitalize">{o.paymentMethod}</p>
                        </div>
                        {expandedOrder === o.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                      {expandedOrder === o.id && (
                        <div className="border-t bg-muted/30 px-4 py-3 space-y-1.5">
                          {o.items.map((item, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">{item.quantity}× {item.menuItemName}</span>
                              <span className="font-medium">${item.subtotal.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const PAGE_SIZE = 100;

interface CustomerStats {
  totalCustomers: number;
  totalOrders: number;
  totalRevenue: number;
}

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [stats, setStats] = useState<CustomerStats | null>(null);

  // Fetch aggregate stats once
  useEffect(() => {
    fetch(`${API}/api/customers/stats`, { headers: authHeaders() })
      .then(r => r.json())
      .then((d: CustomerStats) => setStats(d))
      .catch(() => {});
  }, []);

  const fetchCustomers = useCallback((q: string, pageOffset = 0, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(pageOffset) });
    if (q) params.set("q", q);
    fetch(`${API}/api/customers?${params}`, { headers: authHeaders() })
      .then(r => r.json())
      .then((data: CustomerSummary[]) => {
        setCustomers(prev => append ? [...prev, ...data] : data);
        setHasMore(data.length === PAGE_SIZE);
        setOffset(pageOffset + data.length);
        if (append) setLoadingMore(false);
        else setLoading(false);
      })
      .catch(() => { setLoading(false); setLoadingMore(false); });
  }, []);

  useEffect(() => { fetchCustomers("", 0, false); }, [fetchCustomers]);

  useEffect(() => {
    const t = setTimeout(() => { fetchCustomers(query, 0, false); setOffset(0); }, 300);
    return () => clearTimeout(t);
  }, [query, fetchCustomers]);

  const toggleCheck = (id: number) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allChecked = customers.length > 0 && customers.every(c => checkedIds.has(c.id));
  const someChecked = customers.some(c => checkedIds.has(c.id));

  const toggleAll = () => {
    if (allChecked) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(customers.map(c => c.id)));
    }
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    await Promise.all(
      [...checkedIds].map(id =>
        fetch(`${API}/api/customers/${id}`, { method: "DELETE", headers: authHeaders() })
      )
    );
    setBulkDeleting(false);
    setBulkConfirm(false);
    setCheckedIds(new Set());
    fetchCustomers(query, 0, false);
    // Refresh stats
    fetch(`${API}/api/customers/stats`, { headers: authHeaders() })
      .then(r => r.json()).then((d: CustomerStats) => setStats(d)).catch(() => {});
  };

  const exportCSV = async () => {
    // Fetch all customers for export (not just the loaded page)
    const allPages: CustomerSummary[] = [];
    let off = 0;
    while (true) {
      const params = new URLSearchParams({ limit: "500", offset: String(off) });
      if (query) params.set("q", query);
      const data: CustomerSummary[] = await fetch(`${API}/api/customers?${params}`, { headers: authHeaders() }).then(r => r.json());
      allPages.push(...data);
      if (data.length < 500) break;
      off += data.length;
    }
    const header = ["Name", "Email", "Phone", "Total Orders", "Total Spent ($)", "Customer Since"];
    const rows = allPages.map(c => [
      `"${c.name.replace(/"/g, '""')}"`,
      `"${(c.email ?? "").replace(/"/g, '""')}"`,
      `"${(c.phone ?? "").replace(/"/g, '""')}"`,
      c.visitCount,
      c.totalSpent.toFixed(2),
      `"${new Date(c.createdAt).toLocaleDateString()}"`,
    ]);
    const csv = [header.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const label = query ? `customers-search-${query}` : "customers-all";
    a.download = `island-tacos-${label}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href={adminRoutes.dashboard}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          </Link>
          <div className="flex items-center gap-2 font-bold text-lg flex-1">
            <Users className="w-5 h-5" /> Customer Database
          </div>
          {customers.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportCSV} className="shrink-0">
              <Download className="w-4 h-4 mr-1.5" />
              Export CSV
            </Button>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {[
            { label: "Total Customers", value: stats ? stats.totalCustomers.toLocaleString() : "—", icon: Users, color: "text-blue-600" },
            { label: "Orders Placed", value: stats ? stats.totalOrders.toLocaleString() : "—", icon: ShoppingBag, color: "text-orange-600" },
            { label: "Total Revenue", value: stats ? `$${stats.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—", icon: DollarSign, color: "text-green-600" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-xl border bg-card p-4 flex items-center gap-3">
              <div className={`rounded-lg bg-muted p-2 ${color}`}><Icon className="w-5 h-5" /></div>
              <div>
                <p className="text-muted-foreground text-xs">{label}</p>
                <p className="text-xl font-bold">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, email, or phone…"
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border bg-background outline-none focus:border-primary"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* List */}
        <div className="rounded-xl border overflow-hidden bg-card">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
              <Users className="w-10 h-10" />
              <p className="font-medium">{query ? "No customers found" : "No customers yet"}</p>
              <p className="text-xs">{query ? "Try a different search term" : "Customers are auto-saved when orders are placed"}</p>
            </div>
          ) : (
            <div>
              <div className="px-5 py-3 bg-muted/30 border-b flex items-center gap-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded accent-primary cursor-pointer"
                />
                <span className="flex-1">Customer</span>
                <span>Spent / Orders</span>
              </div>
              {customers.map(c => (
                <CustomerRow
                  key={c.id}
                  c={c}
                  checked={checkedIds.has(c.id)}
                  onToggle={() => toggleCheck(c.id)}
                  onSelect={() => setSelectedId(c.id)}
                />
              ))}
              {hasMore && (
                <div className="px-5 py-4 flex justify-center border-t">
                  <button
                    onClick={() => fetchCustomers(query, offset, true)}
                    disabled={loadingMore}
                    className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline disabled:opacity-50"
                  >
                    {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {loadingMore ? "Loading…" : `Load more (showing ${customers.length.toLocaleString()} of ${stats?.totalCustomers.toLocaleString() ?? "…"})`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {someChecked && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl">
          <span className="text-sm font-semibold">
            {checkedIds.size} selected
          </span>
          <div className="w-px h-5 bg-white/20" />
          {!bulkConfirm ? (
            <button
              onClick={() => setBulkConfirm(true)}
              className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 font-semibold transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-red-400 font-medium">Delete {checkedIds.size} customer{checkedIds.size !== 1 ? "s" : ""}?</span>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="text-sm bg-red-600 text-white px-3 py-1 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {bulkDeleting ? "Deleting…" : "Yes, delete"}
              </button>
              <button
                onClick={() => setBulkConfirm(false)}
                className="text-sm text-white/60 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
          <div className="w-px h-5 bg-white/20" />
          <button
            onClick={() => { setCheckedIds(new Set()); setBulkConfirm(false); }}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {selectedId !== null && (
        <CustomerDrawer
          customerId={selectedId}
          onClose={() => setSelectedId(null)}
          onDelete={() => {
            setSelectedId(null);
            fetchCustomers(query, 0, false);
            fetch(`${API}/api/customers/stats`, { headers: authHeaders() })
              .then(r => r.json()).then((d: CustomerStats) => setStats(d)).catch(() => {});
          }}
        />
      )}
    </div>
  );
}

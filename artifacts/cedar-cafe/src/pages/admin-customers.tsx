import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { adminRoutes } from "@/lib/admin-path";
import { authHeaders } from "@/lib/auth";
import { ArrowLeft, Search, Users, Phone, Mail, ShoppingBag, DollarSign, ChevronDown, ChevronUp, Loader2, X, Trash2, Download } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

const BG = "#16172b", CARD = "#1e1f38", BORD = "rgba(255,255,255,0.06)";
const TP = "#e8eaf6", TM = "#b0b8d8", TMUTED = "#7077a1";
const PUR = "#7c6af7", GREEN = "#30d158", RED_C = "#ff453a";
const HDR = "#0e1020";
const GLOW: React.CSSProperties = {
  background: CARD, border: `1px solid ${BORD}`, borderRadius: 16,
  boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 4px 24px rgba(0,0,0,0.35), 0 0 20px rgba(124,106,247,0.06)",
};

interface CustomerSummary {
  id: number; name: string; email: string | null; phone: string | null;
  notes: string | null; visitCount: number; totalSpent: number;
  createdAt: string; updatedAt: string;
}
interface OrderItem { menuItemName: string; quantity: number; subtotal: number; }
interface CustomerOrder {
  id: number; confirmationCode: string; status: string; paymentStatus: string;
  paymentMethod: string; source: string; total: number; createdAt: string;
  items: OrderItem[];
}
interface CustomerDetail extends CustomerSummary { orders: CustomerOrder[]; }
interface CustomerStats { totalCustomers: number; totalOrders: number; totalRevenue: number; }

function statusBadgeStyle(status: string): React.CSSProperties {
  switch (status) {
    case "completed": return { background: "rgba(48,209,88,0.15)", color: GREEN };
    case "cancelled": return { background: "rgba(255,69,58,0.15)", color: RED_C };
    case "confirmed": return { background: "rgba(124,106,247,0.15)", color: PUR };
    default: return { background: "rgba(255,214,0,0.12)", color: "#ffd60a" };
  }
}

function CustomerRow({ c, checked, onToggle, onSelect }: {
  c: CustomerSummary; checked: boolean; onToggle: () => void; onSelect: () => void;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "14px 20px",
      borderBottom: `1px solid ${BORD}`, transition: "background 0.15s",
      background: checked ? "rgba(124,106,247,0.08)" : "transparent",
      cursor: "default",
    }}
      onMouseEnter={e => { if (!checked) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = checked ? "rgba(124,106,247,0.08)" : "transparent"; }}
    >
      <input
        type="checkbox" checked={checked} onChange={onToggle}
        onClick={e => e.stopPropagation()}
        style={{ width: 16, height: 16, flexShrink: 0, cursor: "pointer", accentColor: PUR }}
      />
      <div onClick={onSelect} style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, cursor: "pointer" }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%", background: "rgba(124,106,247,0.15)",
          color: PUR, display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 700, fontSize: 14, flexShrink: 0,
        }}>
          {c.name.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, fontSize: 14, color: TP, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>{c.name}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 2 }}>
            {c.email && <span style={{ fontSize: 12, color: TMUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.email}</span>}
            {c.phone && <span style={{ fontSize: 12, color: TMUTED }}>{c.phone}</span>}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: TP, margin: 0 }}>${c.totalSpent.toFixed(2)}</p>
          <p style={{ fontSize: 12, color: TMUTED, margin: 0 }}>{c.visitCount} {c.visitCount === 1 ? "order" : "orders"}</p>
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
    fetch(`${API}/api/customers/${customerId}`, { headers: authHeaders() })
      .then(r => r.json())
      .then((data: CustomerDetail) => { setCustomer(data); setNotes(data.notes ?? ""); setLoading(false); })
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
    await fetch(`${API}/api/customers/${customerId}`, { method: "DELETE", headers: authHeaders() });
    setDeleting(false);
    onDelete();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50, display: "flex",
      alignItems: "flex-end", justifyContent: "flex-end",
      background: "rgba(0,0,0,0.55)",
    }} onClick={onClose}>
      <div style={{
        height: "92dvh", width: "100%", maxWidth: 440,
        background: CARD, display: "flex", flexDirection: "column", overflow: "hidden",
        borderTop: `1px solid ${BORD}`, borderLeft: `1px solid ${BORD}`,
        borderRadius: "20px 0 0 0",
        boxShadow: "-8px 0 40px rgba(0,0,0,0.5), 0 0 60px rgba(124,106,247,0.08)",
      }} onClick={e => e.stopPropagation()}>

        {/* Drawer header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: `1px solid ${BORD}`, flexShrink: 0 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: TP, margin: 0 }}>Customer Profile</h2>
          <button onClick={onClose} style={{ padding: 6, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", color: TM, display: "flex", alignItems: "center" }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {loading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Loader2 style={{ width: 24, height: 24, color: TMUTED, animation: "spin 1s linear infinite" }} />
          </div>
        ) : !customer ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: TMUTED }}>Failed to load customer</div>
        ) : (
          <div style={{ flex: 1, overflowY: "auto" }}>
            {/* Profile header */}
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${BORD}` }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(124,106,247,0.15)", color: PUR, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, flexShrink: 0 }}>
                  {customer.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: TP, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{customer.name}</h3>
                  {customer.email && (
                    <a href={`mailto:${customer.email}`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: TMUTED, marginTop: 4, textDecoration: "none" }}>
                      <Mail style={{ width: 13, height: 13 }} /> {customer.email}
                    </a>
                  )}
                  {customer.phone && (
                    <a href={`tel:${customer.phone}`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: TMUTED, marginTop: 2, textDecoration: "none" }}>
                      <Phone style={{ width: 13, height: 13 }} /> {customer.phone}
                    </a>
                  )}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
                {[
                  { label: "Total Orders", value: customer.visitCount },
                  { label: "Total Spent", value: `$${customer.totalSpent.toFixed(2)}` },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${BORD}`, borderRadius: 12, padding: "12px", textAlign: "center" }}>
                    <p style={{ fontSize: 22, fontWeight: 700, color: TP, margin: 0 }}>{value}</p>
                    <p style={{ fontSize: 11, color: TMUTED, margin: "2px 0 0" }}>{label}</p>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 11, color: TMUTED, marginTop: 10, marginBottom: 0 }}>
                Customer since {new Date(customer.createdAt).toLocaleDateString()}
              </p>
            </div>

            {/* Notes */}
            <div style={{ padding: "16px 24px", borderBottom: `1px solid ${BORD}` }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: TMUTED, margin: "0 0 8px" }}>Staff Notes</p>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add private notes about this customer…"
                rows={3}
                style={{
                  width: "100%", fontSize: 13, background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.1)`,
                  borderRadius: 10, padding: "8px 12px", color: TP, outline: "none", resize: "none",
                  boxSizing: "border-box", fontFamily: "inherit",
                }}
              />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                <button
                  onClick={saveNotes} disabled={savingNotes}
                  style={{ fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 8, border: "none", background: PUR, color: "#fff", cursor: "pointer", opacity: savingNotes ? 0.6 : 1 }}
                >
                  {savingNotes ? <Loader2 style={{ width: 12, height: 12, display: "inline" }} /> : null}
                  {" "}Save Notes
                </button>
                {!deleteConfirm ? (
                  <button
                    onClick={() => setDeleteConfirm(true)}
                    style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: RED_C, background: "none", border: "none", cursor: "pointer" }}
                  >
                    <Trash2 style={{ width: 13, height: 13 }} /> Delete customer
                  </button>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: RED_C, fontWeight: 600 }}>Sure?</span>
                    <button
                      onClick={handleDelete} disabled={deleting}
                      style={{ fontSize: 12, background: RED_C, color: "#fff", padding: "4px 10px", borderRadius: 8, border: "none", fontWeight: 600, cursor: "pointer", opacity: deleting ? 0.5 : 1 }}
                    >
                      {deleting ? "Deleting…" : "Yes, delete"}
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(false)}
                      style={{ fontSize: 12, color: TMUTED, background: "none", border: "none", cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Order history */}
            <div style={{ padding: "16px 24px" }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: TMUTED, margin: "0 0 12px" }}>
                Order History ({customer.orders.length})
              </p>
              {customer.orders.length === 0 ? (
                <p style={{ fontSize: 13, color: TMUTED }}>No orders yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {customer.orders.map(o => (
                    <div key={o.id} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORD}`, borderRadius: 12, overflow: "hidden" }}>
                      <div
                        style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer" }}
                        onClick={() => setExpandedOrder(expandedOrder === o.id ? null : o.id)}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 13, fontFamily: "monospace", fontWeight: 700, color: TP }}>{o.confirmationCode}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, ...statusBadgeStyle(o.status) }}>
                              {o.status}
                            </span>
                            <span style={{ fontSize: 11, color: TMUTED, textTransform: "capitalize" }}>{o.source}</span>
                          </div>
                          <p style={{ fontSize: 11, color: TMUTED, margin: "2px 0 0" }}>
                            {new Date(o.createdAt).toLocaleDateString()} · {new Date(o.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0, marginRight: 8 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: TP, margin: 0 }}>${o.total.toFixed(2)}</p>
                          <p style={{ fontSize: 11, color: TMUTED, textTransform: "capitalize", margin: 0 }}>{o.paymentMethod}</p>
                        </div>
                        {expandedOrder === o.id
                          ? <ChevronUp style={{ width: 15, height: 15, color: TMUTED, flexShrink: 0 }} />
                          : <ChevronDown style={{ width: 15, height: 15, color: TMUTED, flexShrink: 0 }} />}
                      </div>
                      {expandedOrder === o.id && (
                        <div style={{ borderTop: `1px solid ${BORD}`, background: "rgba(255,255,255,0.02)", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
                          {o.items.map((item, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
                              <span style={{ color: TMUTED }}>{item.quantity}× {item.menuItemName}</span>
                              <span style={{ fontWeight: 600, color: TM }}>${item.subtotal.toFixed(2)}</span>
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

  useEffect(() => {
    fetch(`${API}/api/customers/stats`, { headers: authHeaders() })
      .then(r => r.json()).then((d: CustomerStats) => setStats(d)).catch(() => {});
  }, []);

  const fetchCustomers = useCallback((q: string, pageOffset = 0, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(pageOffset) });
    if (q) params.set("q", q);
    fetch(`${API}/api/customers?${params}`, { headers: authHeaders() })
      .then(r => r.json())
      .then((data: CustomerSummary[]) => {
        setCustomers(prev => append ? [...prev, ...data] : data);
        setHasMore(data.length === PAGE_SIZE);
        setOffset(pageOffset + data.length);
        if (append) setLoadingMore(false); else setLoading(false);
      })
      .catch(() => { setLoading(false); setLoadingMore(false); });
  }, []);

  useEffect(() => { fetchCustomers("", 0, false); }, [fetchCustomers]);

  useEffect(() => {
    const t = setTimeout(() => { fetchCustomers(query, 0, false); setOffset(0); }, 300);
    return () => clearTimeout(t);
  }, [query, fetchCustomers]);

  const toggleCheck = (id: number) => {
    setCheckedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const allChecked = customers.length > 0 && customers.every(c => checkedIds.has(c.id));
  const someChecked = customers.some(c => checkedIds.has(c.id));

  const toggleAll = () => {
    if (allChecked) setCheckedIds(new Set());
    else setCheckedIds(new Set(customers.map(c => c.id)));
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    await Promise.all([...checkedIds].map(id => fetch(`${API}/api/customers/${id}`, { method: "DELETE", headers: authHeaders() })));
    setBulkDeleting(false); setBulkConfirm(false); setCheckedIds(new Set());
    fetchCustomers(query, 0, false);
    fetch(`${API}/api/customers/stats`, { headers: authHeaders() })
      .then(r => r.json()).then((d: CustomerStats) => setStats(d)).catch(() => {});
  };

  const exportCSV = async () => {
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
      c.visitCount, c.totalSpent.toFixed(2),
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

  const statCards = [
    { label: "Total Customers", value: stats ? stats.totalCustomers.toLocaleString() : "—", Icon: Users, accent: "#60a5fa" },
    { label: "Orders Placed", value: stats ? stats.totalOrders.toLocaleString() : "—", Icon: ShoppingBag, accent: "#ff6b00" },
    { label: "Total Revenue", value: stats ? `$${stats.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—", Icon: DollarSign, accent: GREEN },
  ];

  return (
    <div style={{ minHeight: "100dvh", background: BG, color: TP, fontFamily: "inherit" }}>
      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 30, background: HDR, borderBottom: `1px solid ${BORD}`, backdropFilter: "blur(12px)" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 16px", height: 56, display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={adminRoutes.dashboard}>
            <button style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "none", color: TM, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              <ArrowLeft style={{ width: 15, height: 15 }} /> Back
            </button>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 17, flex: 1, color: TP }}>
            <Users style={{ width: 18, height: 18, color: PUR }} /> Customer Database
          </div>
          {customers.length > 0 && (
            <button
              onClick={exportCSV}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: `1px solid ${BORD}`, color: TM, cursor: "pointer", fontSize: 13, fontWeight: 600, flexShrink: 0 }}
            >
              <Download style={{ width: 14, height: 14 }} /> Export CSV
            </button>
          )}
        </div>
      </header>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          {statCards.map(({ label, value, Icon, accent }) => (
            <div key={label} style={{ ...GLOW, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ borderRadius: 10, background: `${accent}18`, padding: 10, flexShrink: 0 }}>
                <Icon style={{ width: 20, height: 20, color: accent }} />
              </div>
              <div>
                <p style={{ fontSize: 12, color: TMUTED, margin: 0 }}>{label}</p>
                <p style={{ fontSize: 22, fontWeight: 700, color: TP, margin: "2px 0 0" }}>{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: "relative" }}>
          <Search style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", width: 15, height: 15, color: TMUTED }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, email, or phone…"
            style={{
              width: "100%", padding: "10px 40px 10px 40px", fontSize: 14, borderRadius: 12,
              background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.1)`,
              color: TP, outline: "none", boxSizing: "border-box",
            }}
          />
          {query && (
            <button onClick={() => setQuery("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: TMUTED, display: "flex" }}>
              <X style={{ width: 15, height: 15 }} />
            </button>
          )}
        </div>

        {/* Customer list */}
        <div style={{ ...GLOW, overflow: "hidden" }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
              <Loader2 style={{ width: 24, height: 24, color: TMUTED, animation: "spin 1s linear infinite" }} />
            </div>
          ) : customers.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: 10, color: TMUTED }}>
              <Users style={{ width: 40, height: 40 }} />
              <p style={{ fontWeight: 600, margin: 0, color: TM }}>{query ? "No customers found" : "No customers yet"}</p>
              <p style={{ fontSize: 12, margin: 0 }}>{query ? "Try a different search term" : "Customers are auto-saved when orders are placed"}</p>
            </div>
          ) : (
            <div>
              {/* Table header */}
              <div style={{ padding: "12px 20px", background: "rgba(255,255,255,0.03)", borderBottom: `1px solid ${BORD}`, display: "flex", alignItems: "center", gap: 12 }}>
                <input
                  type="checkbox" checked={allChecked}
                  ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
                  onChange={toggleAll}
                  style={{ width: 15, height: 15, cursor: "pointer", accentColor: PUR }}
                />
                <span style={{ flex: 1, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: TMUTED }}>Customer</span>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: TMUTED }}>Spent / Orders</span>
              </div>
              {customers.map(c => (
                <CustomerRow
                  key={c.id} c={c}
                  checked={checkedIds.has(c.id)}
                  onToggle={() => toggleCheck(c.id)}
                  onSelect={() => setSelectedId(c.id)}
                />
              ))}
              {hasMore && (
                <div style={{ padding: "16px 20px", display: "flex", justifyContent: "center", borderTop: `1px solid ${BORD}` }}>
                  <button
                    onClick={() => fetchCustomers(query, offset, true)}
                    disabled={loadingMore}
                    style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: PUR, background: "none", border: "none", cursor: "pointer", opacity: loadingMore ? 0.5 : 1 }}
                  >
                    {loadingMore ? <Loader2 style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} /> : null}
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
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 40,
          display: "flex", alignItems: "center", gap: 12,
          background: "#1a1b35", border: `1px solid rgba(255,255,255,0.12)`, borderRadius: 20,
          padding: "10px 20px", boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 24px rgba(124,106,247,0.15)",
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: TP }}>{checkedIds.size} selected</span>
          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.15)" }} />
          {!bulkConfirm ? (
            <button
              onClick={() => setBulkConfirm(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: RED_C, fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}
            >
              <Trash2 style={{ width: 15, height: 15 }} /> Delete
            </button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, color: RED_C, fontWeight: 600 }}>Delete {checkedIds.size} customer{checkedIds.size !== 1 ? "s" : ""}?</span>
              <button
                onClick={handleBulkDelete} disabled={bulkDeleting}
                style={{ fontSize: 13, background: RED_C, color: "#fff", padding: "5px 12px", borderRadius: 8, border: "none", fontWeight: 700, cursor: "pointer", opacity: bulkDeleting ? 0.5 : 1 }}
              >
                {bulkDeleting ? "Deleting…" : "Yes, delete"}
              </button>
              <button onClick={() => setBulkConfirm(false)} style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", background: "none", border: "none", cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          )}
          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.15)" }} />
          <button
            onClick={() => { setCheckedIds(new Set()); setBulkConfirm(false); }}
            style={{ color: "rgba(255,255,255,0.5)", background: "none", border: "none", cursor: "pointer", display: "flex" }}
          >
            <X style={{ width: 15, height: 15 }} />
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

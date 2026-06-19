import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { setPageMeta } from "@/lib/page-meta";
import { authHeaders } from "@/lib/auth";
import { adminRoutes } from "@/lib/admin-path";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Store, Users, Plus, Pencil, Trash2, Shield, User, Check, X, CreditCard, RefreshCw } from "lucide-react";
import { useStoreSettings } from "@/lib/use-store-settings";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

type Settings = {
  hours: string; phone: string; address: string; payment_methods: string;
  online_payment_methods: string; open_time: string; close_time: string;
  cutoff_minutes: string; open_days: string;
};

const DEFAULTS: Settings = {
  hours: "11am – 7pm daily",
  phone: "284-344-9808",
  address: "Road Town, Tortola, BVI",
  payment_methods: "ATH Móvil · Card · Apple Pay",
  online_payment_methods: '["cash"]',
  open_time: "11:00", close_time: "19:00",
  cutoff_minutes: "15", open_days: "1,2,3,4,5,6",
};

const DAYS = [
  { index: 0, short: "Sun", label: "Sunday"    },
  { index: 1, short: "Mon", label: "Monday"    },
  { index: 2, short: "Tue", label: "Tuesday"   },
  { index: 3, short: "Wed", label: "Wednesday" },
  { index: 4, short: "Thu", label: "Thursday"  },
  { index: 5, short: "Fri", label: "Friday"    },
  { index: 6, short: "Sat", label: "Saturday"  },
];

const ONLINE_METHODS = [
  { id: "cash",     label: "Pay at Counter", description: "Customer pays cash or card when they pick up" },
  { id: "athmovil", label: "ATH Móvil",      description: "Customer pays online via ATH Móvil before pickup" },
  { id: "card",     label: "Card Online",    description: "Customer pays by card online before pickup" },
] as const;

type Employee = { id: number; name: string; role: "owner" | "staff"; active: boolean; createdAt: string; };
type EmployeeForm = { name: string; role: "owner" | "staff"; pin: string; confirmPin: string; };
const EMPTY_FORM: EmployeeForm = { name: "", role: "staff", pin: "", confirmPin: "" };

const BG = "#16172b", CARD = "#1e1f38", BORD = "rgba(255,255,255,0.06)";
const TP = "#e8eaf6", TM = "#b0b8d8", TMUTED = "#7077a1";
const PUR = "#7c6af7", GREEN = "#30d158", OR = "#ff6b00", RED_C = "#ff453a";
const HDR = "#0e1020";
const GLOW: React.CSSProperties = {
  background: CARD, border: `1px solid ${BORD}`, borderRadius: 16,
  boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 4px 24px rgba(0,0,0,0.35), 0 0 20px rgba(124,106,247,0.06)",
};

const INP: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8, padding: "8px 12px", fontSize: 14, color: TP, outline: "none",
  width: "100%", boxSizing: "border-box", fontFamily: "inherit",
};
const LBL: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: TM, display: "block", marginBottom: 6 };

export default function AdminSettings() {
  const { storeName } = useStoreSettings();
  useEffect(() => { setPageMeta(`⚙️ Settings — ${storeName}`, "⚙️"); }, [storeName]);
  const { toast } = useToast();

  const [form, setForm] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/settings`)
      .then(r => r.json())
      .then((data: Settings) => {
        setForm({
          hours: data.hours ?? DEFAULTS.hours,
          phone: data.phone ?? DEFAULTS.phone,
          address: data.address ?? DEFAULTS.address,
          payment_methods: data.payment_methods ?? DEFAULTS.payment_methods,
          online_payment_methods: data.online_payment_methods ?? DEFAULTS.online_payment_methods,
          open_time: data.open_time ?? DEFAULTS.open_time,
          close_time: data.close_time ?? DEFAULTS.close_time,
          cutoff_minutes: data.cutoff_minutes ?? DEFAULTS.cutoff_minutes,
          open_days: data.open_days ?? DEFAULTS.open_days,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getOpenDays = (): Set<number> => {
    const raw = form.open_days ?? DEFAULTS.open_days;
    const nums = raw.split(",").map(s => parseInt(s.trim(), 10)).filter(n => n >= 0 && n <= 6);
    return new Set(nums.length > 0 ? nums : [1, 2, 3, 4, 5, 6]);
  };

  const toggleDay = (index: number) => {
    const current = getOpenDays();
    if (current.has(index)) {
      if (current.size <= 1) return;
      current.delete(index);
    } else { current.add(index); }
    setForm(f => ({ ...f, open_days: [...current].sort((a, b) => a - b).join(",") }));
  };

  const getOnlineMethods = (): string[] => {
    try { return JSON.parse(form.online_payment_methods); } catch { return ["cash"]; }
  };

  const toggleOnlineMethod = (id: string) => {
    const current = getOnlineMethods();
    const next = current.includes(id) ? current.filter(m => m !== id) : [...current, id];
    if (next.length === 0) return;
    setForm(f => ({ ...f, online_payment_methods: JSON.stringify(next) }));
  };

  const [pulling, setPulling] = useState(false);
  const handlePullFromCloud = async () => {
    setPulling(true);
    try {
      const res = await fetch(`${API}/api/sync/pull`, { method: "POST", headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Pull failed");
      toast({ title: `Menu synced from cloud — ${data.categories} categories, ${data.items} items` });
      setTimeout(() => window.location.reload(), 1000);
    } catch (e) {
      toast({ title: String(e instanceof Error ? e.message : e), variant: "destructive" });
    } finally { setPulling(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Settings saved" });
    } catch {
      toast({ title: "Failed to save settings", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const field = (key: keyof Settings, label: string, placeholder?: string) => (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <label htmlFor={key} style={LBL}>{label}</label>
      <input
        id={key}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder ?? DEFAULTS[key]}
        disabled={loading}
        style={{ ...INP, opacity: loading ? 0.5 : 1 }}
      />
    </div>
  );

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empLoading, setEmpLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [empForm, setEmpForm] = useState<EmployeeForm>(EMPTY_FORM);
  const [empSaving, setEmpSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadEmployees = useCallback(async () => {
    setEmpLoading(true);
    try {
      const r = await fetch(`${API}/api/employees`, { credentials: "include", headers: authHeaders() });
      if (r.ok) setEmployees(await r.json());
    } catch {}
    finally { setEmpLoading(false); }
  }, []);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  const validateForm = () => {
    if (!empForm.name.trim()) return "Name is required";
    if (!/^\d{4,8}$/.test(empForm.pin)) return "PIN must be 4–8 digits";
    if (empForm.pin !== empForm.confirmPin) return "PINs do not match";
    return null;
  };

  const handleAddEmployee = async () => {
    const err = validateForm();
    if (err) { toast({ title: err, variant: "destructive" }); return; }
    setEmpSaving(true);
    try {
      const r = await fetch(`${API}/api/employees`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ name: empForm.name.trim(), role: empForm.role, pin: empForm.pin }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed");
      toast({ title: `${empForm.name} added` });
      setShowAddForm(false); setEmpForm(EMPTY_FORM); loadEmployees();
    } catch (e) {
      toast({ title: String(e instanceof Error ? e.message : e), variant: "destructive" });
    } finally { setEmpSaving(false); }
  };

  const handleEditEmployee = async (id: number) => {
    if (!empForm.name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    if (empForm.pin && !/^\d{4,8}$/.test(empForm.pin)) { toast({ title: "PIN must be 4–8 digits", variant: "destructive" }); return; }
    if (empForm.pin && empForm.pin !== empForm.confirmPin) { toast({ title: "PINs do not match", variant: "destructive" }); return; }
    setEmpSaving(true);
    try {
      const body: Record<string, unknown> = { name: empForm.name.trim(), role: empForm.role };
      if (empForm.pin) body.pin = empForm.pin;
      const r = await fetch(`${API}/api/employees/${id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed");
      toast({ title: "Employee updated" });
      setEditingId(null); setEmpForm(EMPTY_FORM); loadEmployees();
    } catch (e) {
      toast({ title: String(e instanceof Error ? e.message : e), variant: "destructive" });
    } finally { setEmpSaving(false); }
  };

  const handleToggleActive = async (emp: Employee) => {
    try {
      await fetch(`${API}/api/employees/${emp.id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ active: !emp.active }),
      });
      loadEmployees();
    } catch {}
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await fetch(`${API}/api/employees/${id}`, { method: "DELETE", credentials: "include", headers: authHeaders() });
      toast({ title: "Employee removed" }); loadEmployees();
    } catch { toast({ title: "Failed to delete", variant: "destructive" }); }
    finally { setDeletingId(null); }
  };

  const startEdit = (emp: Employee) => {
    setEditingId(emp.id); setEmpForm({ name: emp.name, role: emp.role, pin: "", confirmPin: "" }); setShowAddForm(false);
  };
  const cancelEdit = () => { setEditingId(null); setEmpForm(EMPTY_FORM); };

  const RoleIcon = ({ role }: { role: string }) =>
    role === "owner"
      ? <Shield style={{ width: 13, height: 13, color: "#f59e0b" }} />
      : <User style={{ width: 13, height: 13, color: "#60a5fa" }} />;

  const PinForm = ({ onSave, onCancel, saving, isEdit }: {
    onSave: () => void; onCancel: () => void; saving: boolean; isEdit: boolean;
  }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <label style={LBL}>Name</label>
          <input
            value={empForm.name}
            onChange={e => setEmpForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Maria"
            autoFocus
            style={INP}
          />
        </div>
        <div>
          <label style={LBL}>Role</label>
          <div style={{ display: "flex", gap: 8 }}>
            {(["staff", "owner"] as const).map(r => (
              <button
                key={r}
                onClick={() => setEmpForm(f => ({ ...f, role: r }))}
                style={{
                  flex: 1, height: 38, borderRadius: 8, border: "1px solid",
                  fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, cursor: "pointer", transition: "all 0.15s",
                  ...(empForm.role === r
                    ? r === "owner"
                      ? { background: "rgba(245,158,11,0.15)", borderColor: "#f59e0b", color: "#f59e0b" }
                      : { background: "rgba(96,165,250,0.15)", borderColor: "#60a5fa", color: "#60a5fa" }
                    : { background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)", color: TMUTED }),
                }}
              >
                {r === "owner" ? <Shield style={{ width: 13, height: 13 }} /> : <User style={{ width: 13, height: 13 }} />}
                {r === "owner" ? "Owner" : "Staff"}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <label style={LBL}>{isEdit ? "New PIN (leave blank to keep)" : "PIN (4–8 digits)"}</label>
          <input
            type="password" inputMode="numeric" maxLength={8}
            value={empForm.pin}
            onChange={e => setEmpForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, "") }))}
            placeholder="••••"
            style={INP}
          />
        </div>
        <div>
          <label style={LBL}>Confirm PIN</label>
          <input
            type="password" inputMode="numeric" maxLength={8}
            value={empForm.confirmPin}
            onChange={e => setEmpForm(f => ({ ...f, confirmPin: e.target.value.replace(/\D/g, "") }))}
            placeholder="••••"
            style={INP}
          />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={onCancel} disabled={saving}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: `1px solid ${BORD}`, color: TM, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
        >
          <X style={{ width: 14, height: 14 }} /> Cancel
        </button>
        <button
          onClick={onSave} disabled={saving}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 16px", borderRadius: 8, background: PUR, border: "none", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, opacity: saving ? 0.7 : 1 }}
        >
          <Check style={{ width: 14, height: 14 }} /> {saving ? "Saving…" : isEdit ? "Update" : "Add Employee"}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100dvh", background: BG, color: TP, fontFamily: "inherit" }}>
      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: HDR, borderBottom: `1px solid ${BORD}`, backdropFilter: "blur(12px)" }}>
        <div style={{ maxWidth: 768, margin: "0 auto", padding: "0 16px", height: 56, display: "flex", alignItems: "center", gap: 10 }}>
          <Link href={adminRoutes.dashboard}>
            <button style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", color: TM, flexShrink: 0 }}>
              <ArrowLeft style={{ width: 16, height: 16 }} />
            </button>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, minWidth: 0 }}>
            <Store style={{ width: 15, height: 15, color: TMUTED, flexShrink: 0 }} />
            <h1 style={{ fontWeight: 700, fontSize: 15, margin: 0, color: TP }}>Settings</h1>
          </div>
          <button
            onClick={handleSave} disabled={saving || loading}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", borderRadius: 8, background: OR, border: "none", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, opacity: saving || loading ? 0.6 : 1 }}
          >
            <Save style={{ width: 14, height: 14 }} /> {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 768, margin: "0 auto", padding: "32px 16px", display: "flex", flexDirection: "column", gap: 28 }}>

        {/* Stat cards */}
        <div style={{ display: "flex", gap: 14, overflowX: "auto" }}>
          {[
            { art: "🕐", grad: "linear-gradient(145deg,#10b981,#059669,#064e3b)", glow: "rgba(16,185,129,0.5)",   label: "Opens",     value: form.open_time  || "—",                                                         sub: "opening time" },
            { art: "🕗", grad: "linear-gradient(145deg,#ff6b00,#ff3d00,#c0392b)", glow: "rgba(255,107,0,0.55)",   label: "Closes",    value: form.close_time || "—",                                                         sub: "closing time" },
            { art: "📅", grad: "linear-gradient(145deg,#7c6af7,#5b4cf5,#3730a3)", glow: "rgba(124,106,247,0.55)", label: "Open Days", value: `${form.open_days.split(",").filter(Boolean).length}/7`,                        sub: "days per week" },
            { art: "👥", grad: "linear-gradient(145deg,#0ea5e9,#0284c7,#1e3a8a)", glow: "rgba(14,165,233,0.5)",   label: "Staff",     value: empLoading ? "…" : String(employees.filter(e => e.active).length),             sub: "active accounts" },
          ].map((fc) => (
            <div key={fc.label} style={{ width: 168, flexShrink: 0 }}>
              <div style={{ background: fc.grad, borderRadius: 20, padding: "16px 16px 14px", position: "relative", overflow: "hidden", boxShadow: `0 6px 24px ${fc.glow}`, height: 108, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(155deg,rgba(255,255,255,0.14) 0%,transparent 50%)", pointerEvents: "none" }} />
                <div style={{ position: "absolute", top: -6, right: 0, fontSize: 62, opacity: 0.22, lineHeight: 1, transform: "rotate(14deg)", pointerEvents: "none", userSelect: "none" }}>{fc.art}</div>
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>{fc.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: "-0.05em", lineHeight: 1, marginBottom: 3 }}>{fc.value}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>{fc.sub}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Sync from Cloud */}
        <section style={GLOW}>
          <div style={{ padding: "24px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
            <div>
              <h2 style={{ fontWeight: 700, fontSize: 15, color: TP, margin: "0 0 6px" }}>Sync Menu from Cloud</h2>
              <p style={{ fontSize: 13, color: TMUTED, margin: 0, lineHeight: 1.5 }}>
                Replaces the local menu and settings with the latest data from the cloud. Use this after making menu changes online, or if the local menu is empty.
              </p>
            </div>
            <button
              onClick={handlePullFromCloud} disabled={pulling}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: `1px solid rgba(255,255,255,0.1)`, color: TM, cursor: "pointer", fontSize: 13, fontWeight: 600, flexShrink: 0 }}
            >
              <RefreshCw style={{ width: 14, height: 14, animation: pulling ? "spin 1s linear infinite" : "none" }} />
              {pulling ? "Syncing…" : "Pull from Cloud"}
            </button>
          </div>
        </section>

        {/* Business Info */}
        <section style={GLOW}>
          <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 18 }}>
            <h2 style={{ fontWeight: 700, fontSize: 15, color: TP, margin: 0 }}>Business Info</h2>
            {field("hours", "Store Hours (display text)", "e.g. 11am – 7pm daily")}
            {field("phone", "Phone Number", "e.g. 284-344-9808")}
            {field("address", "Address", "e.g. Road Town, Tortola, BVI")}
            {field("payment_methods", "Accepted Payment Methods", "e.g. ATH Móvil · Card · Apple Pay")}
          </div>
        </section>

        {/* Online Ordering Hours */}
        <section style={GLOW}>
          <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <h2 style={{ fontWeight: 700, fontSize: 15, color: TP, margin: "0 0 4px" }}>Online Ordering Hours</h2>
              <p style={{ fontSize: 12, color: TMUTED, margin: 0 }}>
                All times are in Atlantic Standard Time (AST). Online orders are automatically blocked outside these hours and on closed days.
              </p>
            </div>

            {/* Open days picker */}
            <div>
              <label style={LBL}>Open Days</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {DAYS.map(d => {
                  const open = getOpenDays().has(d.index);
                  const isLast = getOpenDays().size === 1 && open;
                  return (
                    <button
                      key={d.index}
                      type="button"
                      onClick={() => toggleDay(d.index)}
                      disabled={loading || isLast}
                      title={d.label}
                      style={{
                        height: 36, width: 48, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                        border: "1px solid", transition: "all 0.15s",
                        opacity: (loading || isLast) ? 0.4 : 1,
                        ...(open
                          ? { background: PUR, borderColor: PUR, color: "#fff" }
                          : { background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)", color: TMUTED }),
                      }}
                    >
                      {d.short}
                    </button>
                  );
                })}
              </div>
              <p style={{ fontSize: 11, color: TMUTED, marginTop: 6, marginBottom: 0 }}>Tap a day to toggle it. At least one day must remain open.</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label htmlFor="open_time" style={LBL}>Opens at</label>
                <input id="open_time" type="time" value={form.open_time} onChange={e => setForm(f => ({ ...f, open_time: e.target.value }))} disabled={loading} style={{ ...INP, opacity: loading ? 0.5 : 1 }} />
              </div>
              <div>
                <label htmlFor="close_time" style={LBL}>Closes at</label>
                <input id="close_time" type="time" value={form.close_time} onChange={e => setForm(f => ({ ...f, close_time: e.target.value }))} disabled={loading} style={{ ...INP, opacity: loading ? 0.5 : 1 }} />
              </div>
            </div>

            <div>
              <label htmlFor="cutoff_minutes" style={LBL}>Stop accepting orders (minutes before closing)</label>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input
                  id="cutoff_minutes" type="number" min="0" max="60"
                  value={form.cutoff_minutes}
                  onChange={e => setForm(f => ({ ...f, cutoff_minutes: e.target.value }))}
                  disabled={loading}
                  style={{ ...INP, width: 80, opacity: loading ? 0.5 : 1 }}
                />
                <span style={{ fontSize: 13, color: TMUTED }}>minutes</span>
              </div>
              {(() => {
                const closeH = parseInt(form.close_time?.split(":")[0] ?? "19");
                const closeM = parseInt(form.close_time?.split(":")[1] ?? "0");
                const cutoff = parseInt(form.cutoff_minutes ?? "15");
                const cutoffTotal = closeH * 60 + closeM - cutoff;
                const ch = Math.floor(cutoffTotal / 60);
                const cm = cutoffTotal % 60;
                const ampm = ch >= 12 ? "PM" : "AM";
                const label = `${ch % 12 || 12}:${String(Math.max(0, cm)).padStart(2, "0")} ${ampm}`;
                return <p style={{ fontSize: 12, color: TMUTED, marginTop: 6, marginBottom: 0 }}>Last order accepted at <span style={{ fontWeight: 600, color: TM }}>{label} AST</span></p>;
              })()}
            </div>
          </div>
        </section>

        {/* Online Payment Methods */}
        <section style={GLOW}>
          <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CreditCard style={{ width: 15, height: 15, color: TMUTED }} />
              <h2 style={{ fontWeight: 700, fontSize: 15, color: TP, margin: 0 }}>Online Store Payment Methods</h2>
            </div>
            <p style={{ fontSize: 12, color: TMUTED, margin: 0 }}>
              Control which payment options customers see when ordering online. At least one must stay enabled.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {ONLINE_METHODS.map(m => {
                const enabled = getOnlineMethods().includes(m.id);
                const isLast = getOnlineMethods().length === 1 && enabled;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleOnlineMethod(m.id)}
                    disabled={isLast}
                    style={{
                      display: "flex", alignItems: "center", gap: 14, borderRadius: 12,
                      border: "1px solid", padding: "14px 16px", textAlign: "left", cursor: isLast ? "not-allowed" : "pointer",
                      transition: "all 0.15s", opacity: isLast ? 0.6 : 1,
                      ...(enabled
                        ? { borderColor: PUR, background: "rgba(124,106,247,0.07)" }
                        : { borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }),
                    }}
                  >
                    <div style={{
                      width: 20, height: 20, borderRadius: 6, border: "2px solid", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
                      ...(enabled ? { background: PUR, borderColor: PUR } : { borderColor: "rgba(255,255,255,0.3)" }),
                    }}>
                      {enabled && <Check style={{ width: 12, height: 12, color: "#fff" }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 14, margin: 0, color: TP }}>{m.label}</p>
                      <p style={{ fontSize: 12, color: TMUTED, margin: "2px 0 0" }}>{m.description}</p>
                    </div>
                    {enabled && <span style={{ fontSize: 12, fontWeight: 700, color: PUR, flexShrink: 0 }}>Enabled</span>}
                  </button>
                );
              })}
            </div>
            <p style={{ fontSize: 11, color: TMUTED, margin: 0 }}>Changes take effect immediately after saving — no republish required.</p>
          </div>
        </section>

        {/* Staff & PINs */}
        <section style={GLOW}>
          <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Users style={{ width: 15, height: 15, color: TMUTED }} />
                <h2 style={{ fontWeight: 700, fontSize: 15, color: TP, margin: 0 }}>Staff & PINs</h2>
              </div>
              {!showAddForm && (
                <button
                  onClick={() => { setShowAddForm(true); setEditingId(null); setEmpForm(EMPTY_FORM); }}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: `1px solid ${BORD}`, color: TM, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
                >
                  <Plus style={{ width: 14, height: 14 }} /> Add Employee
                </button>
              )}
            </div>

            <p style={{ fontSize: 12, color: TMUTED, margin: 0 }}>
              Each employee has a unique PIN. <span style={{ fontWeight: 600, color: TM }}>Owner</span> role gives full admin access.{" "}
              <span style={{ fontWeight: 600, color: TM }}>Staff</span> role gives POS and kitchen access only.
            </p>

            {/* Add form */}
            {showAddForm && (
              <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORD}`, borderRadius: 12, padding: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: TM, margin: "0 0 4px" }}>New Employee</p>
                <PinForm
                  onSave={handleAddEmployee}
                  onCancel={() => { setShowAddForm(false); setEmpForm(EMPTY_FORM); }}
                  saving={empSaving}
                  isEdit={false}
                />
              </div>
            )}

            {/* Employee list */}
            {empLoading ? (
              <p style={{ fontSize: 13, color: TMUTED, textAlign: "center", padding: "16px 0" }}>Loading…</p>
            ) : employees.length === 0 ? (
              <p style={{ fontSize: 13, color: TMUTED, textAlign: "center", padding: "16px 0" }}>No employees yet. Add one above.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {employees.map(emp => (
                  <div key={emp.id} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORD}`, borderRadius: 12, opacity: emp.active ? 1 : 0.5 }}>
                    {editingId === emp.id ? (
                      <div style={{ padding: 16 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: TM, margin: "0 0 4px" }}>Edit — {emp.name}</p>
                        <PinForm onSave={() => handleEditEmployee(emp.id)} onCancel={cancelEdit} saving={empSaving} isEdit={true} />
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                          <RoleIcon role={emp.role} />
                          <span style={{ fontWeight: 600, fontSize: 14, color: TP, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{emp.name}</span>
                          <span style={{
                            fontSize: 11, padding: "2px 8px", borderRadius: 999, fontWeight: 700,
                            ...(emp.role === "owner"
                              ? { background: "rgba(245,158,11,0.15)", color: "#f59e0b" }
                              : { background: "rgba(96,165,250,0.15)", color: "#60a5fa" }),
                          }}>
                            {emp.role === "owner" ? "Owner" : "Staff"}
                          </span>
                          {!emp.active && <span style={{ fontSize: 11, color: TMUTED }}>(inactive)</span>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                          <button
                            onClick={() => handleToggleActive(emp)}
                            style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: `1px solid ${BORD}`, background: "rgba(255,255,255,0.04)", color: TM, cursor: "pointer", fontWeight: 600 }}
                            title={emp.active ? "Deactivate" : "Activate"}
                          >
                            {emp.active ? "Active" : "Inactive"}
                          </button>
                          <button
                            onClick={() => startEdit(emp)}
                            style={{ width: 30, height: 30, borderRadius: 6, background: "rgba(255,255,255,0.04)", border: "none", cursor: "pointer", color: TM, display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
                            <Pencil style={{ width: 13, height: 13 }} />
                          </button>
                          <button
                            onClick={() => handleDelete(emp.id)}
                            disabled={deletingId === emp.id}
                            style={{ width: 30, height: 30, borderRadius: 6, background: "rgba(255,69,58,0.08)", border: "none", cursor: "pointer", color: "#ff453a", display: "flex", alignItems: "center", justifyContent: "center", opacity: deletingId === emp.id ? 0.5 : 1 }}
                          >
                            <Trash2 style={{ width: 13, height: 13 }} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <p style={{ fontSize: 11, color: TMUTED, textAlign: "center" }}>
          Store info appears in the website footer and customer display. PINs are encrypted and cannot be viewed after saving.
        </p>
      </div>
    </div>
  );
}

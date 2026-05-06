import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { setPageMeta } from "@/lib/page-meta";
import { authHeaders } from "@/lib/auth";
import { adminRoutes } from "@/lib/admin-path";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Store, Users, Plus, Pencil, Trash2, Shield, User, Check, X, CreditCard, RefreshCw } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

type Settings = {
  hours: string;
  phone: string;
  address: string;
  payment_methods: string;
  online_payment_methods: string;
  open_time: string;
  close_time: string;
  cutoff_minutes: string;
  open_days: string;
};

const DEFAULTS: Settings = {
  hours: "11am – 7pm daily",
  phone: "284-544-8088",
  address: "Wickhams Cay 1, Road Town, BVI",
  payment_methods: "ATH Móvil · Card · Apple Pay",
  online_payment_methods: '["cash"]',
  open_time: "11:00",
  close_time: "19:00",
  cutoff_minutes: "15",
  open_days: "1,2,3,4,5,6",
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
  { id: "cash", label: "Pay at Counter", description: "Customer pays cash or card when they pick up" },
  { id: "athmovil", label: "ATH Móvil", description: "Customer pays online via ATH Móvil before pickup" },
  { id: "card", label: "Card Online", description: "Customer pays by card online before pickup" },
] as const;

type Employee = {
  id: number;
  name: string;
  role: "owner" | "staff";
  active: boolean;
  createdAt: string;
};

type EmployeeForm = {
  name: string;
  role: "owner" | "staff";
  pin: string;
  confirmPin: string;
};

const EMPTY_FORM: EmployeeForm = { name: "", role: "staff", pin: "", confirmPin: "" };

export default function AdminSettings() {
  useEffect(() => { setPageMeta("⚙️ Settings — Island Tacos", "⚙️"); }, []);

  const { toast } = useToast();

  // ── Store settings ──
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
      if (current.size <= 1) return; // must have at least one open day
      current.delete(index);
    } else {
      current.add(index);
    }
    const sorted = [...current].sort((a, b) => a - b);
    setForm(f => ({ ...f, open_days: sorted.join(",") }));
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

  // ── Cloud sync (local server only) ──
  const [pulling, setPulling] = useState(false);
  const handlePullFromCloud = async () => {
    setPulling(true);
    try {
      const res = await fetch(`${API}/api/sync/pull`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Pull failed");
      toast({ title: `Menu synced from cloud — ${data.categories} categories, ${data.items} items` });
      // Reload the page so the fresh menu/settings are shown
      setTimeout(() => window.location.reload(), 1000);
    } catch (e) {
      toast({ title: String(e instanceof Error ? e.message : e), variant: "destructive" });
    } finally {
      setPulling(false);
    }
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
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof Settings, label: string, placeholder?: string) => (
    <div className="space-y-2">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder ?? DEFAULTS[key]}
        disabled={loading}
      />
    </div>
  );

  // ── Employee management ──
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
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ name: empForm.name.trim(), role: empForm.role, pin: empForm.pin }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed");
      toast({ title: `${empForm.name} added` });
      setShowAddForm(false);
      setEmpForm(EMPTY_FORM);
      loadEmployees();
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
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed");
      toast({ title: "Employee updated" });
      setEditingId(null);
      setEmpForm(EMPTY_FORM);
      loadEmployees();
    } catch (e) {
      toast({ title: String(e instanceof Error ? e.message : e), variant: "destructive" });
    } finally { setEmpSaving(false); }
  };

  const handleToggleActive = async (emp: Employee) => {
    try {
      await fetch(`${API}/api/employees/${emp.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ active: !emp.active }),
      });
      loadEmployees();
    } catch {}
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await fetch(`${API}/api/employees/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: authHeaders(),
      });
      toast({ title: "Employee removed" });
      loadEmployees();
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    } finally { setDeletingId(null); }
  };

  const startEdit = (emp: Employee) => {
    setEditingId(emp.id);
    setEmpForm({ name: emp.name, role: emp.role, pin: "", confirmPin: "" });
    setShowAddForm(false);
  };

  const cancelEdit = () => { setEditingId(null); setEmpForm(EMPTY_FORM); };

  const RoleIcon = ({ role }: { role: string }) =>
    role === "owner"
      ? <Shield className="h-3.5 w-3.5 text-amber-500" />
      : <User className="h-3.5 w-3.5 text-blue-400" />;

  const PinForm = ({ onSave, onCancel, saving, isEdit }: {
    onSave: () => void; onCancel: () => void; saving: boolean; isEdit: boolean;
  }) => (
    <div className="space-y-4 pt-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input
            value={empForm.name}
            onChange={e => setEmpForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Maria"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label>Role</Label>
          <div className="flex gap-2">
            {(["staff", "owner"] as const).map(r => (
              <button
                key={r}
                onClick={() => setEmpForm(f => ({ ...f, role: r }))}
                className={`flex-1 h-10 rounded-lg border text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                  empForm.role === r
                    ? r === "owner" ? "bg-amber-500/20 border-amber-500 text-amber-600" : "bg-blue-500/20 border-blue-500 text-blue-600"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {r === "owner" ? <Shield className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                {r === "owner" ? "Owner" : "Staff"}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>{isEdit ? "New PIN (leave blank to keep current)" : "PIN (4–8 digits)"}</Label>
          <Input
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={empForm.pin}
            onChange={e => setEmpForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, "") }))}
            placeholder="••••"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Confirm PIN</Label>
          <Input
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={empForm.confirmPin}
            onChange={e => setEmpForm(f => ({ ...f, confirmPin: e.target.value.replace(/\D/g, "") }))}
            placeholder="••••"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          <X className="h-4 w-4 mr-1" /> Cancel
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving}>
          <Check className="h-4 w-4 mr-1" /> {saving ? "Saving…" : isEdit ? "Update" : "Add Employee"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="max-w-3xl mx-auto flex h-14 items-center gap-3 px-4">
          <Link href={adminRoutes.dashboard}>
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Store className="h-4 w-4 text-muted-foreground shrink-0" />
            <h1 className="font-bold text-sm truncate">Settings</h1>
          </div>
          <Button onClick={handleSave} disabled={saving || loading} size="sm">
            <Save className="h-4 w-4 mr-1.5" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">

        {/* ── Sync from Cloud (local server only) ── */}
        <section className="rounded-xl border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-bold text-base">Sync Menu from Cloud</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Replaces the local menu and settings with the latest data from the cloud. Use this after making menu changes online, or if the local menu is empty.
              </p>
            </div>
            <Button
              onClick={handlePullFromCloud}
              disabled={pulling}
              variant="outline"
              className="shrink-0"
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${pulling ? "animate-spin" : ""}`} />
              {pulling ? "Syncing…" : "Pull from Cloud"}
            </Button>
          </div>
        </section>

        {/* ── Business Info ── */}
        <section className="rounded-xl border bg-card p-6 space-y-5">
          <h2 className="font-bold text-base">Business Info</h2>
          {field("hours", "Store Hours (display text)", "e.g. 11am – 7pm daily")}
          {field("phone", "Phone Number", "e.g. 284-544-8088")}
          {field("address", "Address", "e.g. Wickhams Cay 1, Road Town, BVI")}
          {field("payment_methods", "Accepted Payment Methods", "e.g. ATH Móvil · Card · Apple Pay")}
        </section>

        {/* ── Online Ordering Hours ── */}
        <section className="rounded-xl border bg-card p-6 space-y-5">
          <div>
            <h2 className="font-bold text-base">Online Ordering Hours</h2>
            <p className="text-xs text-muted-foreground mt-1">
              All times are in Atlantic Standard Time (AST). Online orders are automatically blocked outside these hours and on closed days.
            </p>
          </div>

          {/* Open days picker */}
          <div className="space-y-2">
            <Label>Open Days</Label>
            <div className="flex gap-2 flex-wrap">
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
                    className={`h-9 w-12 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      open
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {d.short}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Tap a day to toggle it. At least one day must remain open.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="open_time">Opens at</Label>
              <Input
                id="open_time"
                type="time"
                value={form.open_time}
                onChange={e => setForm(f => ({ ...f, open_time: e.target.value }))}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="close_time">Closes at</Label>
              <Input
                id="close_time"
                type="time"
                value={form.close_time}
                onChange={e => setForm(f => ({ ...f, close_time: e.target.value }))}
                disabled={loading}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cutoff_minutes">Stop accepting orders (minutes before closing)</Label>
            <div className="flex items-center gap-3">
              <Input
                id="cutoff_minutes"
                type="number"
                min="0"
                max="60"
                value={form.cutoff_minutes}
                onChange={e => setForm(f => ({ ...f, cutoff_minutes: e.target.value }))}
                disabled={loading}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">minutes</span>
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
              return (
                <p className="text-xs text-muted-foreground">
                  Last order accepted at <span className="font-medium">{label} AST</span>
                </p>
              );
            })()}
          </div>
        </section>

        {/* ── Online Payment Methods ── */}
        <section className="rounded-xl border bg-card p-6 space-y-5">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-bold text-base">Online Store Payment Methods</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Control which payment options customers see when ordering online. At least one must stay enabled.
          </p>
          <div className="space-y-3">
            {ONLINE_METHODS.map(m => {
              const enabled = getOnlineMethods().includes(m.id);
              const isLast = getOnlineMethods().length === 1 && enabled;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleOnlineMethod(m.id)}
                  disabled={isLast}
                  className={`w-full flex items-center gap-4 rounded-lg border p-4 text-left transition-colors ${
                    enabled
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background hover:bg-muted/40"
                  } ${isLast ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <div className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    enabled ? "bg-primary border-primary" : "border-muted-foreground/40"
                  }`}>
                    {enabled && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.description}</p>
                  </div>
                  {enabled && (
                    <span className="text-xs font-medium text-primary shrink-0">Enabled</span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Changes take effect immediately after saving — no republish required.
          </p>
        </section>

        {/* ── Employee & PIN Management ── */}
        <section className="rounded-xl border bg-card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-bold text-base">Staff & PINs</h2>
            </div>
            {!showAddForm && (
              <Button size="sm" variant="outline" onClick={() => { setShowAddForm(true); setEditingId(null); setEmpForm(EMPTY_FORM); }}>
                <Plus className="h-4 w-4 mr-1.5" /> Add Employee
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Each employee has a unique PIN. <span className="font-medium text-foreground">Owner</span> role gives full admin access.{" "}
            <span className="font-medium text-foreground">Staff</span> role gives POS and kitchen access only.
          </p>

          {/* Add form */}
          {showAddForm && (
            <div className="rounded-lg border bg-muted/40 p-4">
              <p className="text-sm font-semibold mb-3">New Employee</p>
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
            <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
          ) : employees.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No employees yet. Add one above.</p>
          ) : (
            <div className="space-y-2">
              {employees.map(emp => (
                <div key={emp.id} className={`rounded-lg border transition-colors ${emp.active ? "bg-background" : "bg-muted/30 opacity-60"}`}>
                  {editingId === emp.id ? (
                    <div className="p-4">
                      <p className="text-sm font-semibold mb-3">Edit — {emp.name}</p>
                      <PinForm
                        onSave={() => handleEditEmployee(emp.id)}
                        onCancel={cancelEdit}
                        saving={empSaving}
                        isEdit={true}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-3 px-4">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <RoleIcon role={emp.role} />
                        <span className="font-medium text-sm truncate">{emp.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          emp.role === "owner"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                        }`}>
                          {emp.role === "owner" ? "Owner" : "Staff"}
                        </span>
                        {!emp.active && <span className="text-xs text-muted-foreground">(inactive)</span>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost" size="sm"
                          className="text-xs h-8"
                          onClick={() => handleToggleActive(emp)}
                          title={emp.active ? "Deactivate" : "Activate"}
                        >
                          {emp.active ? "Active" : "Inactive"}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(emp)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(emp.id)}
                          disabled={deletingId === emp.id}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <p className="text-xs text-muted-foreground text-center">
          Store info appears in the website footer and customer display. PINs are encrypted and cannot be viewed after saving.
        </p>
      </div>
    </div>
  );
}

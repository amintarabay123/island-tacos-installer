import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { setPageMeta } from "@/lib/page-meta";
import { authHeaders } from "@/lib/auth";
import { adminRoutes } from "@/lib/admin-path";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Store, Users, Plus, Pencil, Trash2, Shield, User, Check, X } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

type Settings = {
  hours: string;
  phone: string;
  address: string;
  payment_methods: string;
};

const DEFAULTS: Settings = {
  hours: "11am – 10pm daily",
  phone: "284-544-8088",
  address: "Wickhams Cay 1, Road Town, BVI",
  payment_methods: "ATH Móvil · Card · Apple Pay",
};

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
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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

        {/* ── Business Info ── */}
        <section className="rounded-xl border bg-card p-6 space-y-5">
          <h2 className="font-bold text-base">Business Info</h2>
          {field("hours", "Store Hours", "e.g. 11am – 10pm daily")}
          {field("phone", "Phone Number", "e.g. 284-544-8088")}
          {field("address", "Address", "e.g. Wickhams Cay 1, Road Town, BVI")}
          {field("payment_methods", "Accepted Payment Methods", "e.g. ATH Móvil · Card · Apple Pay")}
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

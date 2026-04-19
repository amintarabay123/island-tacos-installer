import { useState, useEffect } from "react";
import { Link } from "wouter";
import { setPageMeta } from "@/lib/page-meta";
import { authHeaders } from "@/lib/auth";
import { adminRoutes } from "@/lib/admin-path";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Store } from "lucide-react";

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

export default function AdminSettings() {
  useEffect(() => { setPageMeta("⚙️ Settings — Island Tacos", "⚙️"); }, []);

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
            <h1 className="font-bold text-sm truncate">Store Settings</h1>
          </div>
          <Button onClick={handleSave} disabled={saving || loading} size="sm">
            <Save className="h-4 w-4 mr-1.5" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <section className="rounded-xl border bg-card p-6 space-y-5">
          <h2 className="font-bold text-base">Business Info</h2>
          {field("hours", "Store Hours", "e.g. 11am – 10pm daily")}
          {field("phone", "Phone Number", "e.g. 284-544-8088")}
          {field("address", "Address", "e.g. Wickhams Cay 1, Road Town, BVI")}
          {field("payment_methods", "Accepted Payment Methods", "e.g. ATH Móvil · Card · Apple Pay")}
        </section>

        <p className="text-xs text-muted-foreground text-center">
          These values appear in the website footer and customer display screen.
        </p>
      </div>
    </div>
  );
}

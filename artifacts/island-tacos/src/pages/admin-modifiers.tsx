import { useState, useEffect } from "react";
import { Link } from "wouter";
import { adminRoutes } from "@/lib/admin-path";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Pencil, Trash2, GripVertical, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ModifierOption = { id: string; name: string; price: number; position: number };
type Modifier = { id: number; loyverseId: string; name: string; options: ModifierOption[]; createdAt: string };

function useModifiers() {
  const [modifiers, setModifiers] = useState<Modifier[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch("/api/menu/modifiers")
      .then((r) => r.json())
      .then((d) => setModifiers(d as Modifier[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);
  return { modifiers, loading, reload: load };
}

const emptyOption = (): ModifierOption => ({
  id: crypto.randomUUID(),
  name: "",
  price: 0,
  position: 0,
});

export default function AdminModifiers() {
  const { modifiers, loading, reload } = useModifiers();
  const { toast } = useToast();
  const [dialog, setDialog] = useState<null | { mode: "create" | "edit"; id?: number }>(null);
  const [name, setName] = useState("");
  const [options, setOptions] = useState<ModifierOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const openCreate = () => {
    setName("");
    setOptions([]);
    setDialog({ mode: "create" });
  };

  const openEdit = (mod: Modifier) => {
    setName(mod.name);
    setOptions(mod.options.map((o) => ({ ...o })));
    setDialog({ mode: "edit", id: mod.id });
  };

  const addOption = () => {
    setOptions((prev) => [...prev, { ...emptyOption(), position: prev.length }]);
  };

  const removeOption = (idx: number) => {
    setOptions((prev) => prev.filter((_, i) => i !== idx).map((o, i) => ({ ...o, position: i })));
  };

  const updateOption = (idx: number, field: keyof ModifierOption, value: string | number) => {
    setOptions((prev) => prev.map((o, i) => i === idx ? { ...o, [field]: value } : o));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const validOptions = options.filter((o) => o.name.trim()).map((o, i) => ({
        ...o,
        name: o.name.trim(),
        price: Number(o.price) || 0,
        position: i,
      }));
      const payload = { name: name.trim(), options: validOptions };

      let res: Response;
      if (dialog?.mode === "create") {
        res = await fetch("/api/menu/modifiers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      } else {
        res = await fetch(`/api/menu/modifiers/${dialog?.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      }

      if (!res.ok) throw new Error(await res.text());
      toast({ title: dialog?.mode === "create" ? "Modifier created" : "Modifier updated" });
      reload();
      setDialog(null);
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, modName: string) => {
    if (!window.confirm(`Delete modifier "${modName}"? This will remove it from all menu items.`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/menu/modifiers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: "Modifier deleted" });
      reload();
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link href={adminRoutes.menu}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Menu Manager
              </Button>
            </Link>
            <span className="font-black text-primary">Modifier Manager</span>
          </div>
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Modifier
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <p className="text-sm text-muted-foreground mb-6">
          Modifiers are add-ons shown at checkout — e.g. "Protein" with options like Chicken (+$0) or Steak (+$2). Assign modifiers to items in the Menu Manager.
        </p>

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : modifiers.length === 0 ? (
          <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
            <p className="font-medium">No modifiers yet</p>
            <p className="text-sm mt-1">Add your first modifier to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {modifiers.map((mod) => (
              <div key={mod.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold">{mod.name}</p>
                    {mod.loyverseId.startsWith("manual_") ? (
                      <span className="text-[10px] uppercase tracking-wide font-semibold bg-muted text-muted-foreground rounded px-1.5 py-0.5">Custom</span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-wide font-semibold bg-blue-50 text-blue-600 rounded px-1.5 py-0.5">Loyverse</span>
                    )}
                    {mod.options.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {mod.options.map((opt) => (
                          <span key={opt.id} className="text-xs border rounded-full px-2 py-0.5 text-muted-foreground">
                            {opt.name}{opt.price > 0 ? ` +$${opt.price.toFixed(2)}` : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(mod)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(mod.id, mod.name)}
                      disabled={deleting === mod.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog?.mode === "create" ? "Add Modifier" : "Edit Modifier"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label>Modifier Name *</Label>
              <Input
                placeholder="e.g. Protein, Toppings, Sauce"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Options</Label>
                <Button variant="ghost" size="sm" onClick={addOption} className="h-7 text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Option
                </Button>
              </div>
              {options.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                  No options yet — add one above
                </p>
              ) : (
                <div className="space-y-2">
                  {options.map((opt, idx) => (
                    <div key={opt.id} className="flex gap-2 items-center">
                      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Input
                        placeholder="Option name"
                        value={opt.name}
                        onChange={(e) => updateOption(idx, "name", e.target.value)}
                        className="flex-1"
                      />
                      <div className="relative w-24 shrink-0">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">+$</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={opt.price}
                          onChange={(e) => updateOption(idx, "price", parseFloat(e.target.value) || 0)}
                          className="pl-7"
                        />
                      </div>
                      <button
                        onClick={() => removeOption(idx)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? "Saving…" : dialog?.mode === "create" ? "Create Modifier" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

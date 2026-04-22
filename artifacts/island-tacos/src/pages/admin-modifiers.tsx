import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { adminRoutes } from "@/lib/admin-path";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Pencil, Trash2, X, AlertCircle, Hash, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ModifierOption = { id: string; name: string; price: number; position: number; allowMultiple?: boolean; maxQuantity?: number };
type Modifier = {
  id: number;
  loyverseId: string;
  name: string;
  options: ModifierOption[];
  required: boolean;
  minSelections: number;
  maxSelections: number | null;
  sortOrder: number;
  createdAt: string;
};

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
  return { modifiers, setModifiers, loading, reload: load };
}

const emptyOption = (): ModifierOption => ({
  id: crypto.randomUUID(),
  name: "",
  price: 0,
  position: 0,
  allowMultiple: false,
  maxQuantity: 10,
});

type FormState = {
  name: string;
  required: boolean;
  minSelections: number;
  maxSelections: number | null;
  options: ModifierOption[];
};

const emptyForm = (): FormState => ({
  name: "",
  required: false,
  minSelections: 0,
  maxSelections: null,
  options: [],
});

function selectionRuleLabel(mod: Modifier) {
  const parts: string[] = [];
  if (mod.required) parts.push("Required");
  if (mod.minSelections > 0 && mod.maxSelections !== null && mod.minSelections === mod.maxSelections) {
    parts.push(`Choose exactly ${mod.minSelections}`);
  } else {
    if (mod.minSelections > 0) parts.push(`Min ${mod.minSelections}`);
    if (mod.maxSelections !== null) parts.push(`Max ${mod.maxSelections}`);
  }
  return parts.join(" · ");
}

export default function AdminModifiers() {
  const { modifiers, setModifiers, loading, reload } = useModifiers();
  const { toast } = useToast();
  const [dialog, setDialog] = useState<null | { mode: "create" | "edit"; id?: number }>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  // ── Drag-and-drop state ──────────────────────────────────────────────────────
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveReorder = (ordered: Modifier[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      fetch("/api/menu/modifiers/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: ordered.map((m) => m.id) }),
      }).catch(() => {});
    }, 400);
  };

  const handleDragStart = (id: number) => {
    setDraggingId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: number) => {
    e.preventDefault();
    if (id !== draggingId) setDragOverId(id);
  };

  const handleDrop = (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    if (!draggingId || draggingId === targetId) { setDraggingId(null); setDragOverId(null); return; }
    const from = modifiers.findIndex((m) => m.id === draggingId);
    const to = modifiers.findIndex((m) => m.id === targetId);
    if (from < 0 || to < 0) { setDraggingId(null); setDragOverId(null); return; }
    const next = [...modifiers];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setModifiers(next);
    saveReorder(next);
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  const openCreate = () => {
    setForm(emptyForm());
    setDialog({ mode: "create" });
  };

  const openEdit = (mod: Modifier) => {
    setForm({
      name: mod.name,
      required: mod.required ?? false,
      minSelections: mod.minSelections ?? 0,
      maxSelections: mod.maxSelections ?? null,
      options: mod.options.map((o) => ({
        ...o,
        allowMultiple: o.allowMultiple ?? false,
        maxQuantity: o.maxQuantity ?? 10,
      })),
    });
    setDialog({ mode: "edit", id: mod.id });
  };

  const addOption = () => {
    setForm((f) => ({ ...f, options: [...f.options, { ...emptyOption(), position: f.options.length }] }));
  };

  const removeOption = (idx: number) => {
    setForm((f) => ({ ...f, options: f.options.filter((_, i) => i !== idx).map((o, i) => ({ ...o, position: i })) }));
  };

  const updateOption = (idx: number, patch: Partial<ModifierOption>) => {
    setForm((f) => ({ ...f, options: f.options.map((o, i) => i === idx ? { ...o, ...patch } : o) }));
  };

  const setField = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const validOptions = form.options.filter((o) => o.name.trim()).map((o, i) => ({
        ...o,
        name: o.name.trim(),
        price: Number(o.price) || 0,
        position: i,
        allowMultiple: o.allowMultiple ?? false,
        maxQuantity: o.allowMultiple ? (Number(o.maxQuantity) || 10) : 1,
      }));
      const payload = {
        name: form.name.trim(),
        options: validOptions,
        required: form.required,
        minSelections: form.minSelections,
        maxSelections: form.maxSelections,
      };

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
          Modifiers are add-ons shown at checkout. Set rules like "Required — choose exactly 1" or "Optional — pick up to 3". Options can allow multiple selections (e.g. extra toppings ×2).
        </p>

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : modifiers.length === 0 ? (
          <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
            <p className="font-medium">No modifiers yet</p>
            <p className="text-sm mt-1">Add your first modifier to get started.</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {modifiers.map((mod) => {
                const ruleLabel = selectionRuleLabel(mod);
                const isDragging = draggingId === mod.id;
                const isDragOver = dragOverId === mod.id;
                return (
                  <div
                    key={mod.id}
                    draggable
                    onDragStart={() => handleDragStart(mod.id)}
                    onDragOver={(e) => handleDragOver(e, mod.id)}
                    onDrop={(e) => handleDrop(e, mod.id)}
                    onDragEnd={handleDragEnd}
                    className={`rounded-xl border bg-card p-4 transition-all ${isDragging ? "opacity-40" : ""} ${isDragOver ? "ring-2 ring-primary/50 bg-primary/5" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Drag handle */}
                      <div className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing mt-0.5 shrink-0 touch-none">
                        <GripVertical className="h-5 w-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold">{mod.name}</p>
                          {mod.loyverseId.startsWith("manual_") ? (
                            <span className="text-[10px] uppercase tracking-wide font-semibold bg-muted text-muted-foreground rounded px-1.5 py-0.5">Custom</span>
                          ) : (
                            <span className="text-[10px] uppercase tracking-wide font-semibold bg-blue-50 text-blue-600 rounded px-1.5 py-0.5">Loyverse</span>
                          )}
                          {mod.required && (
                            <span className="text-[10px] uppercase tracking-wide font-semibold bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 rounded px-1.5 py-0.5">Required</span>
                          )}
                        </div>
                        {ruleLabel && (
                          <p className="text-xs text-muted-foreground mt-0.5">{ruleLabel}</p>
                        )}
                        {mod.options.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {mod.options.map((opt) => (
                              <span key={opt.id} className="text-xs border rounded-full px-2 py-0.5 text-muted-foreground">
                                {opt.name}
                                {opt.price > 0 ? ` +$${opt.price.toFixed(2)}` : ""}
                                {opt.allowMultiple ? " ×n" : ""}
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
                          variant="ghost" size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(mod.id, mod.name)}
                          disabled={deleting === mod.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-3 ml-1">
              Drag <GripVertical className="inline h-3 w-3" /> to reorder — order applies in POS
            </p>
          </>
        )}
      </div>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog?.mode === "create" ? "Add Modifier" : "Edit Modifier"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">

            {/* Name */}
            <div className="space-y-2">
              <Label>Modifier Name *</Label>
              <Input
                placeholder="e.g. Protein, Toppings, Sauce"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
              />
            </div>

            {/* Required / Optional */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold flex items-center gap-1.5">
                    {form.required ? <AlertCircle className="h-3.5 w-3.5 text-red-500" /> : null}
                    {form.required ? "Required" : "Optional"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {form.required ? "Customer must make a selection before adding to cart." : "Customer can skip this modifier."}
                  </p>
                </div>
                <Switch
                  checked={form.required}
                  onCheckedChange={(v) => {
                    setField("required", v);
                    if (v && form.minSelections === 0) setField("minSelections", 1);
                    if (!v) setField("minSelections", 0);
                  }}
                />
              </div>

              {/* Min / Max selections */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Min Selections</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.minSelections}
                    onChange={(e) => setField("minSelections", Math.max(0, parseInt(e.target.value) || 0))}
                    className="h-9"
                  />
                  <p className="text-[11px] text-muted-foreground">0 = no minimum</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Max Selections</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="No limit"
                    value={form.maxSelections ?? ""}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      setField("maxSelections", v === "" ? null : Math.max(1, parseInt(v) || 1));
                    }}
                    className="h-9"
                  />
                  <p className="text-[11px] text-muted-foreground">Leave blank = unlimited</p>
                </div>
              </div>

              {/* Rule summary */}
              {(form.required || form.minSelections > 0 || form.maxSelections !== null) && (
                <div className="rounded bg-background border px-3 py-2 text-xs text-muted-foreground">
                  {form.required && form.minSelections > 0 && form.maxSelections === form.minSelections
                    ? `Customer must choose exactly ${form.minSelections} option${form.minSelections > 1 ? "s" : ""}.`
                    : [
                        form.required ? "Required." : "Optional.",
                        form.minSelections > 0 ? `Must pick at least ${form.minSelections}.` : "",
                        form.maxSelections !== null ? `Can pick up to ${form.maxSelections}.` : "",
                      ].filter(Boolean).join(" ")
                  }
                </div>
              )}
            </div>

            {/* Options */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Options</Label>
                <Button variant="ghost" size="sm" onClick={addOption} className="h-7 text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Option
                </Button>
              </div>
              {form.options.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                  No options yet — add one above
                </p>
              ) : (
                <div className="space-y-3">
                  {form.options.map((opt, idx) => (
                    <div key={opt.id} className="rounded-lg border bg-muted/20 p-3 space-y-2.5">
                      {/* Name + Price row */}
                      <div className="flex gap-2 items-center">
                        <Input
                          placeholder="Option name"
                          value={opt.name}
                          onChange={(e) => updateOption(idx, { name: e.target.value })}
                          className="flex-1 h-9"
                        />
                        <div className="relative w-24 shrink-0">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">+$</span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={opt.price}
                            onChange={(e) => updateOption(idx, { price: parseFloat(e.target.value) || 0 })}
                            className="pl-7 h-9"
                          />
                        </div>
                        <button
                          onClick={() => removeOption(idx)}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Allow Multiple toggle */}
                      <div className="flex items-center justify-between pl-0.5">
                        <div className="flex items-center gap-2">
                          <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Allow selecting multiple times</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {opt.allowMultiple && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-muted-foreground">Max qty:</span>
                              <Input
                                type="number"
                                min="2"
                                max="99"
                                value={opt.maxQuantity ?? 10}
                                onChange={(e) => updateOption(idx, { maxQuantity: Math.max(2, parseInt(e.target.value) || 2) })}
                                className="h-7 w-16 text-xs text-center"
                              />
                            </div>
                          )}
                          <Switch
                            checked={opt.allowMultiple ?? false}
                            onCheckedChange={(v) => updateOption(idx, { allowMultiple: v, maxQuantity: v ? (opt.maxQuantity ?? 10) : 1 })}
                          />
                        </div>
                      </div>
                      {opt.allowMultiple && (
                        <p className="text-[11px] text-muted-foreground pl-0.5">
                          Price of +${opt.price.toFixed(2)} applies per unit selected.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? "Saving…" : dialog?.mode === "create" ? "Create Modifier" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

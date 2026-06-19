import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { adminRoutes } from "@/lib/admin-path";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Pencil, Trash2, X, AlertCircle, Hash, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ModifierOption = { id: string; name: string; price: number; position: number; allowMultiple?: boolean; maxQuantity?: number };
type Modifier = {
  id: number; loyverseId: string; name: string; options: ModifierOption[];
  required: boolean; minSelections: number; maxSelections: number | null;
  sortOrder: number; createdAt: string;
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
  id: crypto.randomUUID(), name: "", price: 0, position: 0, allowMultiple: false, maxQuantity: 10,
});

type FormState = { name: string; required: boolean; minSelections: number; maxSelections: number | null; options: ModifierOption[]; };
const emptyForm = (): FormState => ({ name: "", required: false, minSelections: 0, maxSelections: null, options: [] });

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

const BG = "#16172b", CARD = "#1e1f38", BORD = "rgba(255,255,255,0.06)";
const TP = "#e8eaf6", TM = "#b0b8d8", TMUTED = "#7077a1";
const PUR = "#7c6af7", RED_C = "#ff453a", OR = "#ff6b00", GREEN = "#30d158";
const HDR = "#0e1020";
const GLOW: React.CSSProperties = {
  background: CARD, border: `1px solid ${BORD}`, borderRadius: 16,
  boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 4px 24px rgba(0,0,0,0.35), 0 0 20px rgba(124,106,247,0.06)",
};
const INP_STYLE = `
  background: rgba(255,255,255,0.05) !important;
  border-color: rgba(255,255,255,0.1) !important;
  color: #e8eaf6 !important;
`;

const DIALOG_CSS = `
  [role="switch"] { background: rgba(255,255,255,0.18) !important; border: none !important; }
  [role="switch"][data-state="checked"] { background: #7c6af7 !important; }
  [role="dialog"] { background: #1e1f38 !important; color: #e8eaf6 !important; border: 1px solid rgba(255,255,255,0.08) !important; }
  [role="dialog"] h2 { color: #e8eaf6 !important; }
  [role="dialog"] input:not([type="checkbox"]), [role="dialog"] textarea { background: rgba(255,255,255,0.05) !important; border-color: rgba(255,255,255,0.1) !important; color: #e8eaf6 !important; }
  [role="dialog"] input::placeholder, [role="dialog"] textarea::placeholder { color: #7077a1 !important; }
  [role="dialog"] label { color: #b0b8d8 !important; }
  [role="dialog"] .text-muted-foreground, [role="dialog"] [class*="muted-foreground"] { color: #7077a1 !important; }
  [role="dialog"] .bg-muted\\/30, [role="dialog"] [class*="bg-muted"] { background: rgba(255,255,255,0.04) !important; }
  [role="dialog"] .border, [role="dialog"] [class*="border-border"] { border-color: rgba(255,255,255,0.09) !important; }
  [role="dialog"] .bg-background { background: #16172b !important; }
  [role="dialog"] .rounded { border-radius: 8px; }
  [role="dialog"] p { color: #b0b8d8; }
  [role="dialog"] .text-xs { color: #7077a1 !important; }
  [role="dialog"] [class*="text-\\[11px\\]"] { color: #7077a1 !important; }
  [role="dialog"] button[class*="outline"] { background: rgba(255,255,255,0.06) !important; border-color: rgba(255,255,255,0.12) !important; color: #b0b8d8 !important; }
  [role="dialog"] button[class*="bg-primary"], [role="dialog"] button[class*="default"] { background: #7c6af7 !important; }
  [role="dialog"] button[class*="ghost"]:hover { background: rgba(255,255,255,0.06) !important; }
  [role="dialog"] button[class*="destructive"] { color: #ff453a !important; }
  [role="dialog"] span[class*="text-red"] { color: #ff453a !important; background: rgba(255,69,58,0.12) !important; }
  [role="dialog"] span[class*="text-blue"] { color: #60a5fa !important; background: rgba(96,165,250,0.1) !important; }
`;

export default function AdminModifiers() {
  const { modifiers, setModifiers, loading, reload } = useModifiers();
  const { toast } = useToast();
  const [dialog, setDialog] = useState<null | { mode: "create" | "edit"; id?: number }>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

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

  const handleDragStart = (id: number) => setDraggingId(id);
  const handleDragOver = (e: React.DragEvent, id: number) => { e.preventDefault(); if (id !== draggingId) setDragOverId(id); };
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
    setDraggingId(null); setDragOverId(null);
  };
  const handleDragEnd = () => { setDraggingId(null); setDragOverId(null); };

  const openCreate = () => { setForm(emptyForm()); setDialog({ mode: "create" }); };
  const openEdit = (mod: Modifier) => {
    setForm({
      name: mod.name, required: mod.required ?? false,
      minSelections: mod.minSelections ?? 0, maxSelections: mod.maxSelections ?? null,
      options: mod.options.map((o) => ({ ...o, allowMultiple: o.allowMultiple ?? false, maxQuantity: o.maxQuantity ?? 10 })),
    });
    setDialog({ mode: "edit", id: mod.id });
  };

  const addOption = () => setForm((f) => ({ ...f, options: [...f.options, { ...emptyOption(), position: f.options.length }] }));
  const removeOption = (idx: number) => setForm((f) => ({ ...f, options: f.options.filter((_, i) => i !== idx).map((o, i) => ({ ...o, position: i })) }));
  const updateOption = (idx: number, patch: Partial<ModifierOption>) => setForm((f) => ({ ...f, options: f.options.map((o, i) => i === idx ? { ...o, ...patch } : o) }));
  const setField = <K extends keyof FormState>(key: K, val: FormState[K]) => setForm((f) => ({ ...f, [key]: val }));

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const validOptions = form.options.filter((o) => o.name.trim()).map((o, i) => ({
        ...o, name: o.name.trim(), price: Number(o.price) || 0, position: i,
        allowMultiple: o.allowMultiple ?? false,
        maxQuantity: o.allowMultiple ? (Number(o.maxQuantity) || 10) : 1,
      }));
      const payload = { name: form.name.trim(), options: validOptions, required: form.required, minSelections: form.minSelections, maxSelections: form.maxSelections };
      let res: Response;
      if (dialog?.mode === "create") {
        res = await fetch("/api/menu/modifiers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      } else {
        res = await fetch(`/api/menu/modifiers/${dialog?.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      }
      if (!res.ok) throw new Error(await res.text());
      toast({ title: dialog?.mode === "create" ? "Modifier created" : "Modifier updated" });
      reload(); setDialog(null);
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number, modName: string) => {
    if (!window.confirm(`Delete modifier "${modName}"? This will remove it from all menu items.`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/menu/modifiers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: "Modifier deleted" }); reload();
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" });
    } finally { setDeleting(null); }
  };

  return (
    <div style={{ minHeight: "100dvh", background: BG, color: TP, fontFamily: "inherit" }}>
      <style>{DIALOG_CSS}</style>

      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: HDR, borderBottom: `1px solid ${BORD}`, backdropFilter: "blur(12px)" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 16px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link href={adminRoutes.menu}>
              <button style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "none", color: TM, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                <ArrowLeft style={{ width: 14, height: 14 }} /> Back to Menu
              </button>
            </Link>
            <span style={{ fontWeight: 800, color: PUR, fontSize: 15 }}>Modifier Manager</span>
          </div>
          <button
            onClick={openCreate}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", borderRadius: 8, background: OR, border: "none", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700 }}
          >
            <Plus style={{ width: 14, height: 14 }} /> Add Modifier
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 16px" }}>

        {/* Stat cards */}
        <div style={{ display: "flex", gap: 14, marginBottom: 24, overflowX: "auto" }}>
          {[
            { art: "🎛️", grad: "linear-gradient(145deg,#ff6b00,#ff3d00,#c0392b)", glow: "rgba(255,107,0,0.55)",   label: "Total Modifiers", value: String(modifiers.length),                                                 sub: "configured" },
            { art: "⚡",  grad: "linear-gradient(145deg,#ef4444,#dc2626,#7f1d1d)", glow: "rgba(239,68,68,0.45)",  label: "Required",        value: String(modifiers.filter(m => m.required).length),                        sub: "must choose" },
            { art: "✨",  grad: "linear-gradient(145deg,#7c6af7,#5b4cf5,#3730a3)", glow: "rgba(124,106,247,0.55)", label: "Optional",        value: String(modifiers.filter(m => !m.required).length),                       sub: "customer's choice" },
            { art: "📋",  grad: "linear-gradient(145deg,#10b981,#059669,#064e3b)", glow: "rgba(16,185,129,0.5)",   label: "Total Options",   value: String(modifiers.reduce((s, m) => s + (m.options?.length ?? 0), 0)),    sub: "across all mods" },
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

        <p style={{ fontSize: 13, color: TMUTED, marginBottom: 24 }}>
          Modifiers are add-ons shown at checkout. Set rules like "Required — choose exactly 1" or "Optional — pick up to 3". Options can allow multiple selections (e.g. extra toppings ×2).
        </p>

        {loading ? (
          <p style={{ color: TMUTED }}>Loading...</p>
        ) : modifiers.length === 0 ? (
          <div style={{ border: `1px dashed rgba(255,255,255,0.12)`, borderRadius: 16, padding: "48px 24px", textAlign: "center", color: TMUTED }}>
            <p style={{ fontWeight: 600, margin: "0 0 4px", color: TM }}>No modifiers yet</p>
            <p style={{ fontSize: 13, margin: 0 }}>Add your first modifier to get started.</p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
                    style={{
                      ...GLOW,
                      padding: 16,
                      opacity: isDragging ? 0.4 : 1,
                      outline: isDragOver ? `2px solid ${PUR}` : "none",
                      outlineOffset: 2,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ color: "rgba(255,255,255,0.25)", cursor: "grab", marginTop: 2, flexShrink: 0 }}>
                        <GripVertical style={{ width: 18, height: 18 }} />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <p style={{ fontWeight: 700, fontSize: 15, color: TP, margin: 0 }}>{mod.name}</p>
                          {mod.loyverseId.startsWith("manual_") ? (
                            <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, background: "rgba(255,255,255,0.08)", color: TMUTED, borderRadius: 4, padding: "2px 6px" }}>Custom</span>
                          ) : (
                            <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, background: "rgba(96,165,250,0.12)", color: "#60a5fa", borderRadius: 4, padding: "2px 6px" }}>Loyverse</span>
                          )}
                          {mod.required && (
                            <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, background: "rgba(255,69,58,0.12)", color: RED_C, borderRadius: 4, padding: "2px 6px" }}>Required</span>
                          )}
                        </div>
                        {ruleLabel && <p style={{ fontSize: 12, color: TMUTED, margin: "3px 0 0" }}>{ruleLabel}</p>}
                        {mod.options.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                            {mod.options.map((opt) => (
                              <span key={opt.id} style={{ fontSize: 12, border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 999, padding: "2px 10px", color: TMUTED }}>
                                {opt.name}
                                {opt.price > 0 ? ` +$${opt.price.toFixed(2)}` : ""}
                                {opt.allowMultiple ? " ×n" : ""}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        <button
                          onClick={() => openEdit(mod)}
                          style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", color: TM, display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                          <Pencil style={{ width: 14, height: 14 }} />
                        </button>
                        <button
                          onClick={() => handleDelete(mod.id, mod.name)}
                          disabled={deleting === mod.id}
                          style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,69,58,0.08)", border: "none", cursor: "pointer", color: RED_C, display: "flex", alignItems: "center", justifyContent: "center", opacity: deleting === mod.id ? 0.5 : 1 }}
                        >
                          <Trash2 style={{ width: 14, height: 14 }} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: 12, color: TMUTED, marginTop: 10, marginLeft: 4 }}>
              Drag <GripVertical style={{ display: "inline", width: 12, height: 12 }} /> to reorder — order applies in POS
            </p>
          </>
        )}
      </div>

      {/* ── Modifier dialog ── */}
      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog?.mode === "create" ? "Add Modifier" : "Edit Modifier"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold" style={{ color: TM }}>Modifier Name *</label>
              <input
                placeholder="e.g. Protein, Toppings, Sauce"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 14, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: TP, outline: "none", boxSizing: "border-box" as const }}
              />
            </div>

            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: 16 }} className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: TP }}>
                    {form.required ? <AlertCircle className="h-3.5 w-3.5" style={{ color: RED_C }} /> : null}
                    {form.required ? "Required" : "Optional"}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: TMUTED }}>
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" style={{ color: TM }}>Min Selections</label>
                  <input
                    type="number" min="0"
                    value={form.minSelections}
                    onChange={(e) => setField("minSelections", Math.max(0, parseInt(e.target.value) || 0))}
                    style={{ width: "100%", height: 36, padding: "0 10px", borderRadius: 8, fontSize: 14, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: TP, outline: "none", boxSizing: "border-box" as const }}
                  />
                  <p className="text-[11px]" style={{ color: TMUTED }}>0 = no minimum</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" style={{ color: TM }}>Max Selections</label>
                  <input
                    type="number" min="1"
                    placeholder="No limit"
                    value={form.maxSelections ?? ""}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      setField("maxSelections", v === "" ? null : Math.max(1, parseInt(v) || 1));
                    }}
                    style={{ width: "100%", height: 36, padding: "0 10px", borderRadius: 8, fontSize: 14, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: TP, outline: "none", boxSizing: "border-box" as const }}
                  />
                  <p className="text-[11px]" style={{ color: TMUTED }}>Leave blank = unlimited</p>
                </div>
              </div>

              {(form.required || form.minSelections > 0 || form.maxSelections !== null) && (
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: TMUTED }}>
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold" style={{ color: TM }}>Options</label>
                <button
                  onClick={addOption}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 6, background: "rgba(124,106,247,0.12)", border: `1px solid rgba(124,106,247,0.3)`, color: PUR, cursor: "pointer", fontSize: 12, fontWeight: 700 }}
                >
                  <Plus style={{ width: 12, height: 12 }} /> Add Option
                </button>
              </div>
              {form.options.length === 0 ? (
                <p style={{ fontSize: 13, color: TMUTED, textAlign: "center", padding: "16px 0", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 10 }}>
                  No options yet — add one above
                </p>
              ) : (
                <div className="space-y-3">
                  {form.options.map((opt, idx) => (
                    <div key={opt.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 12 }} className="space-y-2.5">
                      <div className="flex gap-2 items-center">
                        <input
                          placeholder="Option name"
                          value={opt.name}
                          onChange={(e) => updateOption(idx, { name: e.target.value })}
                          style={{ flex: 1, height: 36, padding: "0 10px", borderRadius: 8, fontSize: 13, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: TP, outline: "none" }}
                        />
                        <div style={{ position: "relative", width: 96, flexShrink: 0 }}>
                          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: TMUTED, fontSize: 13 }}>+$</span>
                          <input
                            type="number" min="0" step="0.01"
                            value={opt.price}
                            onChange={(e) => updateOption(idx, { price: parseFloat(e.target.value) || 0 })}
                            style={{ width: "100%", height: 36, paddingLeft: 28, paddingRight: 8, borderRadius: 8, fontSize: 13, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: TP, outline: "none", boxSizing: "border-box" as const }}
                          />
                        </div>
                        <button
                          onClick={() => removeOption(idx)}
                          style={{ padding: 6, borderRadius: 6, background: "rgba(255,69,58,0.1)", border: "none", cursor: "pointer", color: RED_C, display: "flex", alignItems: "center", flexShrink: 0 }}
                        >
                          <X style={{ width: 15, height: 15 }} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between pl-0.5">
                        <div className="flex items-center gap-2">
                          <Hash style={{ width: 13, height: 13, color: TMUTED }} />
                          <span style={{ fontSize: 12, color: TMUTED }}>Allow selecting multiple times</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {opt.allowMultiple && (
                            <div className="flex items-center gap-1.5">
                              <span style={{ fontSize: 11, color: TMUTED }}>Max qty:</span>
                              <input
                                type="number" min="2" max="99"
                                value={opt.maxQuantity ?? 10}
                                onChange={(e) => updateOption(idx, { maxQuantity: Math.max(2, parseInt(e.target.value) || 2) })}
                                style={{ height: 28, width: 56, textAlign: "center", borderRadius: 6, fontSize: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: TP, outline: "none", padding: "0 4px" }}
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
                        <p style={{ fontSize: 11, color: TMUTED }}>
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
            <button
              onClick={() => setDialog(null)}
              style={{ padding: "8px 16px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: TM, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave} disabled={saving || !form.name.trim()}
              style={{ padding: "8px 16px", borderRadius: 8, background: PUR, border: "none", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, opacity: saving || !form.name.trim() ? 0.6 : 1 }}
            >
              {saving ? "Saving…" : dialog?.mode === "create" ? "Create Modifier" : "Save Changes"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { adminRoutes } from "@/lib/admin-path";
import {
  useListMenuCategories,
  useListMenuItems,
  useCreateMenuItem,
  useUpdateMenuItem,
  useDeleteMenuItem,
  useUpdateMenuCategory,
  useCreateMenuCategory,
  useDeleteMenuCategory,
  getListMenuItemsQueryKey,
  getListMenuCategoriesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Pencil, Trash2, Sliders, GripVertical, ChefHat, Upload, X, Images } from "lucide-react";

type ModifierOption = { id: string; name: string; price: number; position: number };
type Modifier = { id: number; loyverseId: string; name: string; options: ModifierOption[] };

type MenuItemForm = {
  categoryId: number; name: string; description: string; price: string;
  imageUrl: string; posImageUrl: string; available: boolean; popular: boolean;
  spicy: boolean; vegetarian: boolean; openPrice: boolean; hiddenOnline: boolean; selectedModifierIds: string[];
};
const emptyForm: MenuItemForm = {
  categoryId: 0, name: "", description: "", price: "",
  imageUrl: "", posImageUrl: "", available: true, popular: false,
  spicy: false, vegetarian: false, openPrice: false, hiddenOnline: false, selectedModifierIds: [],
};

const BG = "#16172b", CARD = "#1e1f38", BORD = "rgba(255,255,255,0.06)";
const TP = "#e8eaf6", TM = "#b0b8d8", TMUTED = "#7077a1";
const PUR = "#7c6af7", OR = "#ff6b00", RED_C = "#ff453a", GREEN = "#30d158";
const HDR = "#0e1020";
const GLOW: React.CSSProperties = {
  background: CARD, border: `1px solid ${BORD}`, borderRadius: 16,
  boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 4px 24px rgba(0,0,0,0.35), 0 0 20px rgba(124,106,247,0.06)",
};

const DIALOG_CSS = `
  /* Switch */
  [role="switch"] { background: rgba(255,255,255,0.18) !important; border: none !important; }
  [role="switch"][data-state="checked"] { background: #7c6af7 !important; }
  /* Dialog dark */
  [role="dialog"] { background: #1e1f38 !important; color: #e8eaf6 !important; border: 1px solid rgba(255,255,255,0.08) !important; }
  [role="dialog"] h2 { color: #e8eaf6 !important; }
  [role="dialog"] input:not([type="checkbox"]),
  [role="dialog"] textarea { background: rgba(255,255,255,0.05) !important; border-color: rgba(255,255,255,0.1) !important; color: #e8eaf6 !important; }
  [role="dialog"] input::placeholder,
  [role="dialog"] textarea::placeholder { color: #7077a1 !important; }
  [role="dialog"] label { color: #b0b8d8 !important; }
  [role="dialog"] .text-muted-foreground { color: #7077a1 !important; }
  [role="dialog"] .text-xs { color: #7077a1 !important; }
  [role="dialog"] .text-\\[10px\\] { color: #7077a1 !important; }
  [role="dialog"] .border { border-color: rgba(255,255,255,0.09) !important; }
  [role="dialog"] .border-border { border-color: rgba(255,255,255,0.09) !important; }
  [role="dialog"] .bg-muted { background: rgba(255,255,255,0.05) !important; }
  [role="dialog"] .bg-muted\\/30 { background: rgba(255,255,255,0.04) !important; }
  [role="dialog"] .bg-muted\\/40 { background: rgba(255,255,255,0.05) !important; }
  [role="dialog"] .bg-muted\\/20 { background: rgba(255,255,255,0.03) !important; }
  [role="dialog"] .bg-background { background: #16172b !important; }
  [role="dialog"] .border-primary { border-color: #7c6af7 !important; }
  [role="dialog"] .bg-primary\\/5 { background: rgba(124,106,247,0.08) !important; }
  [role="dialog"] .text-primary { color: #7c6af7 !important; }
  [role="dialog"] p { color: #b0b8d8; }
  [role="dialog"] button[class*="outline"] { background: rgba(255,255,255,0.06) !important; border-color: rgba(255,255,255,0.12) !important; color: #b0b8d8 !important; }
  [role="dialog"] button[class*="ghost"] { color: #b0b8d8 !important; }
  [role="dialog"] button[class*="ghost"]:hover { background: rgba(255,255,255,0.07) !important; }
  [role="dialog"] button[class*="destructive"] { color: #ff453a !important; background: transparent !important; }
  [role="dialog"] button[class*="destructive"]:hover { background: rgba(255,69,58,0.1) !important; }
  /* Select trigger inside dialog */
  [role="dialog"] [role="combobox"] { background: rgba(255,255,255,0.05) !important; border-color: rgba(255,255,255,0.1) !important; color: #e8eaf6 !important; }
  /* Select dropdown (portal) */
  [role="listbox"] { background: #1e1f38 !important; border: 1px solid rgba(255,255,255,0.1) !important; color: #e8eaf6 !important; }
  [role="option"] { color: #e8eaf6 !important; }
  [role="option"][data-highlighted] { background: rgba(124,106,247,0.15) !important; }
  /* Gallery image grid */
  [role="dialog"] button[class*="border-border"] { border-color: rgba(255,255,255,0.12) !important; }
  [role="dialog"] button[class*="border-primary"] { border-color: #7c6af7 !important; }
`;

export default function AdminMenu() {
  const queryClient = useQueryClient();
  const { data: categories } = useListMenuCategories();
  const { data: items, isLoading } = useListMenuItems();
  const createItem = useCreateMenuItem();
  const updateItem = useUpdateMenuItem();
  const deleteItem = useDeleteMenuItem();
  const updateCategory = useUpdateMenuCategory();
  const createCategory = useCreateMenuCategory();
  const deleteCategory = useDeleteMenuCategory();

  const [dialog, setDialog] = useState<null | { mode: "create" | "edit"; id?: number }>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [posImageUploading, setPosImageUploading] = useState(false);
  const posImageInputRef = useRef<HTMLInputElement>(null);

  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryTarget, setGalleryTarget] = useState<"imageUrl" | "posImageUrl">("imageUrl");
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);

  const openGallery = (target: "imageUrl" | "posImageUrl") => {
    setGalleryTarget(target); setGalleryOpen(true); setGalleryLoading(true);
    fetch("/api/admin/uploaded-images", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { urls: string[] }) => setGalleryUrls(d.urls ?? []))
      .catch(() => setGalleryUrls([]))
      .finally(() => setGalleryLoading(false));
  };
  const pickGalleryImage = (url: string) => { setForm((f) => ({ ...f, [galleryTarget]: url })); setGalleryOpen(false); };

  type CatForm = { name: string; icon: string; sendToKds: boolean };
  const [catDialog, setCatDialog] = useState<null | { mode: "create" | "edit"; id?: number }>(null);
  const [catForm, setCatForm] = useState<CatForm>({ name: "", icon: "", sendToKds: true });
  const [form, setForm] = useState<MenuItemForm>(emptyForm);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [allModifiers, setAllModifiers] = useState<Modifier[]>([]);

  useEffect(() => {
    fetch("/api/menu/modifiers").then((r) => r.json()).then((d) => setAllModifiers(d as Modifier[])).catch(() => {});
  }, []);

  const [orderedIds, setOrderedIds] = useState<number[]>([]);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (!items || isDraggingRef.current) return;
    setOrderedIds((prev) => {
      const currentIds = new Set(items.map((i) => i.id));
      const pruned = prev.filter((id) => currentIds.has(id));
      const pruneSet = new Set(pruned);
      const newIds = items.filter((i) => !pruneSet.has(i.id)).map((i) => i.id);
      if (pruned.length === 0) return items.map((i) => i.id);
      return [...pruned, ...newIds];
    });
  }, [items]);

  const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
  const saveReorder = (ids: number[]) => {
    fetch(`${API_BASE}/api/menu/items/reorder`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }).catch(() => {});
  };

  const orderedItems = orderedIds.map((id) => items?.find((i) => i.id === id)).filter(Boolean) as NonNullable<typeof items>[number][];
  const filteredItems = orderedItems.filter((i) => activeCategory === null ? true : i.categoryId === activeCategory);

  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  const handleDragStart = (id: number) => { isDraggingRef.current = true; setDraggingId(id); };
  const handleDragOver = (e: React.DragEvent, id: number) => { e.preventDefault(); if (id !== draggingId) setDragOverId(id); };
  const handleDrop = (e: React.DragEvent, targetId: number) => {
    e.preventDefault(); isDraggingRef.current = false;
    if (!draggingId || draggingId === targetId) { setDraggingId(null); setDragOverId(null); return; }
    const next = [...orderedIds];
    const fromIdx = next.indexOf(draggingId); const toIdx = next.indexOf(targetId);
    next.splice(fromIdx, 1); next.splice(toIdx, 0, draggingId);
    setOrderedIds(next); saveReorder(next);
    setDraggingId(null); setDragOverId(null);
  };
  const handleDragEnd = () => { isDraggingRef.current = false; setDraggingId(null); setDragOverId(null); };

  const [catOrderedIds, setCatOrderedIds] = useState<number[]>([]);
  const isCatDraggingRef = useRef(false);

  useEffect(() => {
    if (!categories || isCatDraggingRef.current) return;
    setCatOrderedIds((prev) => {
      const currentIds = new Set(categories.map((c) => c.id));
      const pruned = prev.filter((id) => currentIds.has(id));
      const pruneSet = new Set(pruned);
      const newIds = categories.filter((c) => !pruneSet.has(c.id)).map((c) => c.id);
      if (pruned.length === 0) return categories.map((c) => c.id);
      return [...pruned, ...newIds];
    });
  }, [categories]);

  const saveCatReorder = (ids: number[]) => {
    fetch(`${API_BASE}/api/menu/categories/reorder`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }).catch(() => {});
  };

  const orderedCategories = catOrderedIds.map((id) => categories?.find((c) => c.id === id)).filter(Boolean) as NonNullable<typeof categories>[number][];

  const [catDraggingId, setCatDraggingId] = useState<number | null>(null);
  const [catDragOverId, setCatDragOverId] = useState<number | null>(null);

  const handleCatDragStart = (id: number) => { isCatDraggingRef.current = true; setCatDraggingId(id); };
  const handleCatDragOver = (e: React.DragEvent, id: number) => { e.preventDefault(); if (id !== catDraggingId) setCatDragOverId(id); };
  const handleCatDrop = (e: React.DragEvent, targetId: number) => {
    e.preventDefault(); isCatDraggingRef.current = false;
    if (!catDraggingId || catDraggingId === targetId) { setCatDraggingId(null); setCatDragOverId(null); return; }
    const next = [...catOrderedIds];
    const fromIdx = next.indexOf(catDraggingId); const toIdx = next.indexOf(targetId);
    next.splice(fromIdx, 1); next.splice(toIdx, 0, catDraggingId);
    setCatOrderedIds(next); saveCatReorder(next);
    setCatDraggingId(null); setCatDragOverId(null);
  };
  const handleCatDragEnd = () => { isCatDraggingRef.current = false; setCatDraggingId(null); setCatDragOverId(null); };

  const handleToggleKds = (catId: number, sendToKds: boolean) => {
    updateCategory.mutate(
      { id: catId, data: { sendToKds } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListMenuCategoriesQueryKey() }) }
    );
  };

  const allSelected = filteredItems.length > 0 && filteredItems.every((i) => selectedIds.has(i.id));
  const someSelected = filteredItems.some((i) => selectedIds.has(i.id));
  const selectedCount = filteredItems.filter((i) => selectedIds.has(i.id)).length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds((prev) => { const next = new Set(prev); filteredItems.forEach((i) => next.delete(i.id)); return next; });
    } else {
      setSelectedIds((prev) => { const next = new Set(prev); filteredItems.forEach((i) => next.add(i.id)); return next; });
    }
  };
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const invalidateItems = () => {
    queryClient.invalidateQueries({ queryKey: getListMenuItemsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListMenuCategoriesQueryKey() });
  };

  const openCreate = () => {
    setForm({ ...emptyForm, categoryId: activeCategory ?? (categories?.[0]?.id ?? 0), selectedModifierIds: [] });
    setDialog({ mode: "create" });
  };
  const openEdit = (id: number) => {
    const item = items?.find((i) => i.id === id);
    if (!item) return;
    setForm({
      categoryId: item.categoryId, name: item.name, description: item.description ?? "",
      price: String(item.price), imageUrl: item.imageUrl ?? "",
      posImageUrl: (item as { posImageUrl?: string | null }).posImageUrl ?? "",
      available: item.available, popular: item.popular, spicy: item.spicy, vegetarian: item.vegetarian,
      openPrice: (item as { openPrice?: boolean }).openPrice ?? false,
      hiddenOnline: (item as { hiddenOnline?: boolean }).hiddenOnline ?? false,
      selectedModifierIds: (item as { loyverseModifierIds?: string[] }).loyverseModifierIds ?? [],
    });
    setDialog({ mode: "edit", id });
  };

  const handleSave = () => {
    if (!form.name || !form.categoryId) return;
    const price = form.openPrice ? 0 : parseFloat(form.price);
    if (!form.openPrice && isNaN(price)) return;
    const data = {
      categoryId: form.categoryId, name: form.name, description: form.description || null,
      price, imageUrl: form.imageUrl || null, posImageUrl: form.posImageUrl || null,
      available: form.available, popular: form.popular, spicy: form.spicy, vegetarian: form.vegetarian,
      openPrice: form.openPrice,
      hiddenOnline: form.hiddenOnline,
      loyverseModifierIds: form.selectedModifierIds.length > 0 ? form.selectedModifierIds : null,
    };
    const close = () => { invalidateItems(); setDialog(null); };
    const onError = (e: Error) => { alert(`Could not save item: ${e.message}`); };
    if (dialog?.mode === "create") {
      createItem.mutate({ data }, { onSettled: close, onError });
    } else if (dialog?.mode === "edit" && dialog.id) {
      updateItem.mutate({ id: dialog.id, data }, { onSettled: close, onError });
    }
  };

  const handleToggleAvailable = (id: number, available: boolean) => {
    updateItem.mutate({ id, data: { available } }, {
      onSuccess: () => {
        if (!available) {
          setOrderedIds((prev) => { const next = prev.filter((x) => x !== id).concat(id); saveReorder(next); return next; });
        }
        invalidateItems();
      },
    });
  };

  const handleToggleHiddenOnline = (id: number, hiddenOnline: boolean) => {
    updateItem.mutate({ id, data: { hiddenOnline } }, { onSuccess: invalidateItems });
  };

  const handleImageUpload = async (file: File) => {
    setImageUploading(true);
    try {
      const body = new FormData(); body.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", credentials: "include", body });
      if (!r.ok) throw new Error("Upload failed");
      const { url } = await r.json() as { url: string };
      setForm((f) => ({ ...f, imageUrl: url }));
    } catch { alert("Image upload failed. Try again."); }
    finally { setImageUploading(false); }
  };

  const handlePosImageUpload = async (file: File) => {
    setPosImageUploading(true);
    try {
      const body = new FormData(); body.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", credentials: "include", body });
      if (!r.ok) throw new Error("Upload failed");
      const { url } = await r.json() as { url: string };
      setForm((f) => ({ ...f, posImageUrl: url }));
    } catch { alert("Image upload failed. Try again."); }
    finally { setPosImageUploading(false); }
  };

  const handleCatSave = () => {
    if (!catForm.name.trim()) return;
    const close = () => { queryClient.invalidateQueries({ queryKey: getListMenuCategoriesQueryKey() }); setCatDialog(null); };
    const onError = (e: Error) => { alert(`Could not save category: ${e.message}`); };
    if (catDialog?.mode === "create") {
      createCategory.mutate(
        { data: { name: catForm.name, icon: catForm.icon || null, sendToKds: catForm.sendToKds } },
        { onSettled: close, onError },
      );
    } else if (catDialog?.mode === "edit" && catDialog.id) {
      updateCategory.mutate(
        { id: catDialog.id, data: { name: catForm.name, icon: catForm.icon || null, sendToKds: catForm.sendToKds } as Parameters<typeof updateCategory.mutate>[0]["data"] },
        { onSettled: close, onError },
      );
    }
  };

  const handleCatDelete = (id: number, name: string) => {
    if (!window.confirm(`Delete category "${name}"? Items in it will need to be reassigned.`)) return;
    deleteCategory.mutate({ id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListMenuCategoriesQueryKey() }) });
  };
  const handleDelete = (id: number) => {
    if (!window.confirm("Delete this item?")) return;
    deleteItem.mutate({ id }, { onSuccess: invalidateItems });
  };
  const handleBulkDelete = async () => {
    const toDelete = filteredItems.filter((i) => selectedIds.has(i.id));
    if (!toDelete.length) return;
    if (!window.confirm(`Delete ${toDelete.length} item${toDelete.length > 1 ? "s" : ""}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    for (const item of toDelete) {
      await new Promise<void>((resolve) => { deleteItem.mutate({ id: item.id }, { onSuccess: () => resolve(), onError: () => resolve() }); });
    }
    setSelectedIds(new Set()); invalidateItems(); setBulkDeleting(false);
  };

  const INP: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8, padding: "8px 12px", fontSize: 14, color: TP, outline: "none",
    width: "100%", boxSizing: "border-box", fontFamily: "inherit",
  };

  return (
    <div style={{ minHeight: "100dvh", background: BG, color: TP, fontFamily: "inherit" }}>
      <style>{DIALOG_CSS}</style>

      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: HDR, borderBottom: `1px solid ${BORD}`, backdropFilter: "blur(12px)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 16px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link href={adminRoutes.dashboard}>
              <button style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "none", color: TM, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                <ArrowLeft style={{ width: 14, height: 14 }} /> Back
              </button>
            </Link>
            <span style={{ fontWeight: 800, color: PUR, fontSize: 15 }}>Menu Manager</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link href={adminRoutes.modifiers}>
              <button style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: `1px solid ${BORD}`, color: TM, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                <Sliders style={{ width: 13, height: 13 }} /> Modifiers
              </button>
            </Link>
            <button
              onClick={openCreate}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", borderRadius: 8, background: OR, border: "none", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700 }}
            >
              <Plus style={{ width: 14, height: 14 }} /> Add Item
            </button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 16px" }}>

        {/* Stat cards */}
        <div style={{ display: "flex", gap: 14, marginBottom: 24, overflowX: "auto" }}>
          {[
            { art: "🌮", grad: "linear-gradient(145deg,#ff6b00,#ff3d00,#c0392b)", glow: "rgba(255,107,0,0.55)",   label: "Total Items",  value: String(items?.length ?? 0),                            sub: "on the menu" },
            { art: "✅", grad: "linear-gradient(145deg,#10b981,#059669,#064e3b)", glow: "rgba(16,185,129,0.5)",   label: "Available",    value: String(items?.filter(i => i.available).length ?? 0),   sub: "active today" },
            { art: "📂", grad: "linear-gradient(145deg,#7c6af7,#5b4cf5,#3730a3)", glow: "rgba(124,106,247,0.55)", label: "Categories",   value: String(categories?.length ?? 0),                      sub: "sections" },
            { art: "⚠️", grad: "linear-gradient(145deg,#ef4444,#dc2626,#7f1d1d)", glow: "rgba(239,68,68,0.45)",  label: "Unavailable",  value: String(items?.filter(i => !i.available).length ?? 0),  sub: "hidden from menu" },
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

        {/* Category Management Card */}
        <div style={{ ...GLOW, padding: 20, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ChefHat style={{ width: 15, height: 15, color: TMUTED }} />
              <span style={{ fontWeight: 700, fontSize: 14, color: TP }}>Categories</span>
            </div>
            <button
              onClick={() => { setCatForm({ name: "", icon: "", sendToKds: true }); setCatDialog({ mode: "create" }); }}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: `1px solid ${BORD}`, color: TM, cursor: "pointer", fontSize: 12, fontWeight: 700 }}
            >
              <Plus style={{ width: 13, height: 13 }} /> Add
            </button>
          </div>
          {orderedCategories && orderedCategories.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {orderedCategories.map((cat) => {
                const isCatDragging = catDraggingId === cat.id;
                const isCatDragOver = catDragOverId === cat.id;
                return (
                  <div
                    key={cat.id}
                    draggable
                    onDragStart={() => handleCatDragStart(cat.id)}
                    onDragOver={(e) => handleCatDragOver(e, cat.id)}
                    onDrop={(e) => handleCatDrop(e, cat.id)}
                    onDragEnd={handleCatDragEnd}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "8px 6px", borderRadius: 10,
                      border: "1px solid", transition: "all 0.15s",
                      opacity: isCatDragging ? 0.4 : 1,
                      borderColor: isCatDragOver ? PUR : "transparent",
                      background: isCatDragOver ? "rgba(124,106,247,0.06)" : "transparent",
                    }}
                  >
                    <GripVertical style={{ width: 14, height: 14, color: "rgba(255,255,255,0.2)", cursor: "grab", flexShrink: 0 }} />
                    <span style={{ fontSize: 18, width: 26, textAlign: "center", flexShrink: 0 }}>{(cat as { icon?: string | null }).icon ?? "📂"}</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: cat.sendToKds ? TM : TMUTED, textDecoration: cat.sendToKds ? "none" : "line-through" }}>
                      {cat.name}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }} title="Send items in this category to the Kitchen Display">
                      <span style={{ fontSize: 11, fontWeight: 700, color: cat.sendToKds ? GREEN : TMUTED }}>KDS</span>
                      <Switch checked={cat.sendToKds} onCheckedChange={(v) => handleToggleKds(cat.id, v)} onClick={e => e.stopPropagation()} />
                    </div>
                    <button
                      onClick={() => { setCatForm({ name: cat.name, icon: (cat as { icon?: string | null }).icon ?? "", sendToKds: cat.sendToKds }); setCatDialog({ mode: "edit", id: cat.id }); }}
                      style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(255,255,255,0.05)", border: "none", cursor: "pointer", color: TMUTED, display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <Pencil style={{ width: 13, height: 13 }} />
                    </button>
                    <button
                      onClick={() => handleCatDelete(cat.id, cat.name)}
                      style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(255,69,58,0.08)", border: "none", cursor: "pointer", color: RED_C, display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <Trash2 style={{ width: 13, height: 13 }} />
                    </button>
                  </div>
                );
              })}
              <p style={{ fontSize: 11, color: TMUTED, marginTop: 4, marginLeft: 4 }}>
                Drag <GripVertical style={{ display: "inline", width: 11, height: 11 }} /> to reorder categories
              </p>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: TMUTED }}>No categories yet. Add one to get started.</p>
          )}
        </div>

        {/* Category filter pills */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          <button
            onClick={() => setActiveCategory(null)}
            style={{
              borderRadius: 999, padding: "6px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer",
              border: "1px solid", transition: "all 0.15s",
              ...(activeCategory === null
                ? { background: PUR, borderColor: PUR, color: "#fff" }
                : { background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)", color: TM }),
            }}
          >
            All
          </button>
          {orderedCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                borderRadius: 999, padding: "6px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer",
                border: "1px solid", transition: "all 0.15s",
                display: "flex", alignItems: "center", gap: 6,
                ...(activeCategory === cat.id
                  ? { background: PUR, borderColor: PUR, color: "#fff" }
                  : { background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)", color: TM }),
              }}
            >
              {(cat as { icon?: string | null }).icon && <span>{(cat as { icon?: string | null }).icon}</span>}
              {cat.name}
              {!cat.sendToKds && <span style={{ fontSize: 10, opacity: 0.6, fontWeight: 400 }}>no KDS</span>}
            </button>
          ))}
        </div>

        {/* Bulk action bar */}
        {someSelected && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "rgba(255,69,58,0.08)", border: "1px solid rgba(255,69,58,0.25)",
            borderRadius: 12, padding: "10px 16px", marginBottom: 16,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: RED_C }}>
              {selectedCount} item{selectedCount > 1 ? "s" : ""} selected
            </span>
            <button
              onClick={handleBulkDelete} disabled={bulkDeleting}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 8, background: RED_C, border: "none", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, opacity: bulkDeleting ? 0.7 : 1 }}
            >
              <Trash2 style={{ width: 14, height: 14 }} />
              {bulkDeleting ? "Deleting…" : `Delete ${selectedCount}`}
            </button>
          </div>
        )}

        {/* Items table */}
        {isLoading ? (
          <p style={{ color: TMUTED }}>Loading...</p>
        ) : (
          <div style={{ ...GLOW, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: `1px solid ${BORD}` }}>
                  <th style={{ padding: "10px 12px", width: 32 }}></th>
                  <th style={{ padding: "10px 12px", width: 36 }}>
                    <input
                      type="checkbox" checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                      onChange={toggleSelectAll}
                      style={{ width: 14, height: 14, cursor: "pointer", accentColor: PUR }}
                    />
                  </th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 700, color: TM }}>Item</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 700, color: TM }}>Category</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", fontWeight: 700, color: TM }}>Price</th>
                  <th style={{ textAlign: "center", padding: "10px 12px", fontWeight: 700, color: TM }}>Available</th>
                  <th style={{ textAlign: "center", padding: "10px 12px", fontWeight: 700, color: TM }}>Online</th>
                  <th style={{ textAlign: "center", padding: "10px 12px", fontWeight: 700, color: TM }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, idx) => {
                  const cat = categories?.find((c) => c.id === item.categoryId);
                  const isSelected = selectedIds.has(item.id);
                  const isDragging = draggingId === item.id;
                  const isDragOver = dragOverId === item.id;
                  return (
                    <tr
                      key={item.id}
                      draggable
                      onDragStart={() => handleDragStart(item.id)}
                      onDragOver={(e) => handleDragOver(e, item.id)}
                      onDrop={(e) => handleDrop(e, item.id)}
                      onDragEnd={handleDragEnd}
                      style={{
                        borderBottom: `1px solid ${BORD}`, transition: "background 0.1s",
                        opacity: isDragging ? 0.4 : item.available ? 1 : 0.5,
                        background: isSelected
                          ? "rgba(255,69,58,0.06)"
                          : isDragOver
                          ? "rgba(124,106,247,0.08)"
                          : idx % 2 === 1 ? "rgba(255,255,255,0.01)" : "transparent",
                        borderTop: isDragOver ? `2px solid ${PUR}` : undefined,
                      }}
                    >
                      <td style={{ padding: "10px 12px", width: 32, cursor: "grab" }}>
                        <GripVertical style={{ width: 14, height: 14, color: "rgba(255,255,255,0.2)", margin: "0 auto", display: "block" }} />
                      </td>
                      <td style={{ padding: "10px 12px", width: 36 }}>
                        <input
                          type="checkbox" checked={isSelected}
                          onChange={() => toggleSelect(item.id)}
                          style={{ width: 14, height: 14, cursor: "pointer", accentColor: PUR }}
                        />
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ fontWeight: 600, color: TP, display: "flex", alignItems: "center", gap: 8 }}>
                          {item.name}
                          {!item.available && <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", background: "rgba(255,255,255,0.06)", color: TMUTED, borderRadius: 4, padding: "2px 6px" }}>Sold Out</span>}
                          {((item as { hiddenOnline?: boolean }).hiddenOnline ?? false) && <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", background: "rgba(124,106,247,0.15)", color: PUR, borderRadius: 4, padding: "2px 6px" }}>Hidden Online</span>}
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                          {item.popular && <span style={{ fontSize: 11, color: OR }}>Popular</span>}
                          {item.spicy && <span style={{ fontSize: 11, color: RED_C }}>Spicy</span>}
                          {item.vegetarian && <span style={{ fontSize: 11, color: GREEN }}>Vegetarian</span>}
                        </div>
                      </td>
                      <td style={{ padding: "10px 12px", color: TMUTED }}>{cat?.name}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: TP }}>${item.price.toFixed(2)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        <Switch checked={item.available} onCheckedChange={(v) => handleToggleAvailable(item.id, v)} />
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        <Switch
                          checked={!((item as { hiddenOnline?: boolean }).hiddenOnline ?? false)}
                          onCheckedChange={(v) => handleToggleHiddenOnline(item.id, !v)}
                        />
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                          <button
                            onClick={() => openEdit(item.id)}
                            style={{ width: 30, height: 30, borderRadius: 7, background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", color: TM, display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
                            <Pencil style={{ width: 13, height: 13 }} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            style={{ width: 30, height: 30, borderRadius: 7, background: "rgba(255,69,58,0.08)", border: "none", cursor: "pointer", color: RED_C, display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
                            <Trash2 style={{ width: 13, height: 13 }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredItems.length === 0 && (
              <div style={{ padding: "32px 16px", textAlign: "center", color: TMUTED, fontSize: 13 }}>
                No items found. Add one with the button above.
              </div>
            )}
          </div>
        )}
        {filteredItems.length > 1 && (
          <p style={{ fontSize: 11, color: TMUTED, marginTop: 8, textAlign: "center" }}>
            Drag <GripVertical style={{ display: "inline", width: 11, height: 11 }} /> handle to reorder items
          </p>
        )}
      </div>

      {/* ── Item create/edit dialog ── */}
      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog?.mode === "create" ? "Add Menu Item" : "Edit Menu Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label style={{ fontSize: 13, fontWeight: 600, color: TM, display: "block" }}>Category</label>
              <Select
                value={String(form.categoryId)}
                onValueChange={(v) => setForm((f) => ({ ...f, categoryId: parseInt(v) }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label style={{ fontSize: 13, fontWeight: 600, color: TM, display: "block" }}>Name *</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={{ ...INP, padding: "8px 12px" }} />
            </div>
            <div className="space-y-2">
              <label style={{ fontSize: 13, fontWeight: 600, color: TM, display: "block" }}>Description</label>
              <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} style={{ ...INP, resize: "none" }} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label style={{ fontSize: 13, fontWeight: 600, color: TM }}>Open Price</label>
                <Switch checked={form.openPrice} onCheckedChange={(v) => setForm((f) => ({ ...f, openPrice: v }))} />
              </div>
              <p style={{ fontSize: 11, color: TMUTED }}>
                For misc/custom items. Cashier sets price + description at the POS. Hidden from the online store.
              </p>
            </div>
            <div className="space-y-2">
              <label style={{ fontSize: 13, fontWeight: 600, color: TM, display: "block" }}>{form.openPrice ? "Price" : "Price *"}</label>
              <input
                type="number" step="0.01" min="0"
                value={form.openPrice ? "" : form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                placeholder={form.openPrice ? "Set at POS" : "0.00"}
                disabled={form.openPrice}
                style={{ ...INP, padding: "8px 12px", opacity: form.openPrice ? 0.5 : 1 }}
              />
            </div>

            {/* Online Store Image */}
            <div className="space-y-2">
              <label style={{ fontSize: 13, fontWeight: 600, color: TM, display: "block" }}>Online Store Image</label>
              <p style={{ fontSize: 11, color: TMUTED }}>Shown on the customer ordering page.</p>
              <div className="flex gap-2">
                <input
                  value={form.imageUrl}
                  onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                  placeholder="https://... or upload →"
                  style={{ ...INP, flex: 1, padding: "8px 12px" }}
                />
                <button type="button" disabled={imageUploading} onClick={() => imageInputRef.current?.click()}
                  style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: TM, cursor: "pointer", fontSize: 12, fontWeight: 600, flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
                  {imageUploading ? "Uploading…" : <><Upload style={{ width: 13, height: 13 }} /> Upload</>}
                </button>
                <button type="button" onClick={() => openGallery("imageUrl")} title="Browse uploaded photos"
                  style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: TM, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center" }}>
                  <Images style={{ width: 14, height: 14 }} />
                </button>
                <input ref={imageInputRef} type="file" accept="image/*" style={{ display: "none" }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ""; }} />
              </div>
              {form.imageUrl && (
                <div style={{ position: "relative", width: 96, height: 96, borderRadius: 10, overflow: "hidden", border: `1px solid ${BORD}` }}>
                  <img src={form.imageUrl} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  <button type="button" onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                    style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.7)", border: "none", color: "#fff", borderRadius: "50%", width: 20, height: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <X style={{ width: 11, height: 11 }} />
                  </button>
                </div>
              )}
            </div>

            {/* POS Image */}
            <div className="space-y-2">
              <label style={{ fontSize: 13, fontWeight: 600, color: TM, display: "block" }}>POS Image <span style={{ fontWeight: 400, color: TMUTED }}>(optional)</span></label>
              <p style={{ fontSize: 11, color: TMUTED }}>Shown on the staff POS screen. Falls back to the online store image if left blank.</p>
              <div className="flex gap-2">
                <input
                  value={form.posImageUrl}
                  onChange={(e) => setForm((f) => ({ ...f, posImageUrl: e.target.value }))}
                  placeholder="https://... or upload →"
                  style={{ ...INP, flex: 1, padding: "8px 12px" }}
                />
                <button type="button" disabled={posImageUploading} onClick={() => posImageInputRef.current?.click()}
                  style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: TM, cursor: "pointer", fontSize: 12, fontWeight: 600, flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
                  {posImageUploading ? "Uploading…" : <><Upload style={{ width: 13, height: 13 }} /> Upload</>}
                </button>
                <button type="button" onClick={() => openGallery("posImageUrl")} title="Browse uploaded photos"
                  style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: TM, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center" }}>
                  <Images style={{ width: 14, height: 14 }} />
                </button>
                <input ref={posImageInputRef} type="file" accept="image/*" style={{ display: "none" }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePosImageUpload(f); e.target.value = ""; }} />
              </div>
              {form.posImageUrl && (
                <div style={{ position: "relative", width: 96, height: 96, borderRadius: 10, overflow: "hidden", border: `1px solid ${BORD}` }}>
                  <img src={form.posImageUrl} alt="POS Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  <button type="button" onClick={() => setForm((f) => ({ ...f, posImageUrl: "" }))}
                    style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.7)", border: "none", color: "#fff", borderRadius: "50%", width: 20, height: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <X style={{ width: 11, height: 11 }} />
                  </button>
                </div>
              )}
            </div>

            {/* Flags */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {(["available", "popular", "spicy", "vegetarian"] as const).map((flag) => (
                <div key={flag} className="flex items-center justify-between">
                  <label style={{ fontSize: 13, fontWeight: 600, color: TM, textTransform: "capitalize" }}>{flag}</label>
                  <Switch checked={form[flag]} onCheckedChange={(v) => setForm((f) => ({ ...f, [flag]: v }))} />
                </div>
              ))}
              <div className="flex items-center justify-between" style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: TM }}>
                  Show on online menu
                  <span style={{ display: "block", fontSize: 11, fontWeight: 400, color: TMUTED }}>Off = completely hidden from customers (POS still sees it)</span>
                </label>
                <Switch checked={!form.hiddenOnline} onCheckedChange={(v) => setForm((f) => ({ ...f, hiddenOnline: !v }))} />
              </div>
            </div>

            {/* Modifier toggles */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label style={{ fontSize: 13, fontWeight: 600, color: TM, display: "flex", alignItems: "center", gap: 5 }}>
                  <Sliders style={{ width: 13, height: 13 }} /> Modifiers
                </label>
                <Link href={adminRoutes.modifiers}>
                  <span style={{ fontSize: 12, color: PUR, cursor: "pointer" }}>Manage modifiers →</span>
                </Link>
              </div>
              {allModifiers.length === 0 ? (
                <p style={{ fontSize: 12, color: TMUTED, padding: "8px 0" }}>
                  No modifiers yet. <Link href={adminRoutes.modifiers}><span style={{ color: PUR, cursor: "pointer" }}>Create some first.</span></Link>
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {allModifiers.map((mod) => {
                    const isOn = form.selectedModifierIds.includes(mod.loyverseId);
                    return (
                      <div
                        key={mod.id}
                        onClick={() => setForm((f) => ({
                          ...f,
                          selectedModifierIds: isOn
                            ? f.selectedModifierIds.filter((id) => id !== mod.loyverseId)
                            : [...f.selectedModifierIds, mod.loyverseId],
                        }))}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "10px 12px", borderRadius: 10, border: "1px solid", cursor: "pointer", transition: "all 0.15s",
                          ...(isOn
                            ? { borderColor: PUR, background: "rgba(124,106,247,0.07)" }
                            : { borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }),
                        }}
                      >
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: TP, margin: 0 }}>{mod.name}</p>
                          {mod.options.length > 0 && (
                            <p style={{ fontSize: 11, color: TMUTED, margin: "2px 0 0" }}>
                              {mod.options.slice(0, 3).map((o) => o.name).join(", ")}
                              {mod.options.length > 3 ? ` +${mod.options.length - 3} more` : ""}
                            </p>
                          )}
                        </div>
                        <Switch
                          checked={isOn}
                          onCheckedChange={(v) => setForm((f) => ({
                            ...f,
                            selectedModifierIds: v
                              ? [...f.selectedModifierIds, mod.loyverseId]
                              : f.selectedModifierIds.filter((id) => id !== mod.loyverseId),
                          }))}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setDialog(null)}
              style={{ padding: "8px 16px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: TM, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={createItem.isPending || updateItem.isPending}
              style={{ padding: "8px 16px", borderRadius: 8, background: OR, border: "none", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, opacity: (createItem.isPending || updateItem.isPending) ? 0.7 : 1 }}>
              {dialog?.mode === "create" ? "Add Item" : "Save Changes"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Category create/edit dialog ── */}
      <Dialog open={!!catDialog} onOpenChange={(open) => { if (!open) setCatDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{catDialog?.mode === "create" ? "New Category" : "Edit Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label style={{ fontSize: 13, fontWeight: 600, color: TM, display: "block" }}>Name *</label>
              <input
                value={catForm.name}
                onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Tacos"
                style={{ ...INP, padding: "8px 12px" }}
              />
            </div>
            <div className="space-y-2">
              <label style={{ fontSize: 13, fontWeight: 600, color: TM, display: "block" }}>Icon (emoji)</label>
              <div className="flex items-center gap-3">
                <span style={{ fontSize: 28, width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.06)", border: `1px solid ${BORD}`, borderRadius: 10 }}>
                  {catForm.icon || "📂"}
                </span>
                <input
                  value={catForm.icon}
                  onChange={(e) => setCatForm((f) => ({ ...f, icon: e.target.value }))}
                  placeholder="🌮"
                  maxLength={4}
                  style={{ ...INP, flex: 1, padding: "8px 12px" }}
                />
              </div>
              <p style={{ fontSize: 11, color: TMUTED }}>Paste or type an emoji to represent this category.</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORD}`, borderRadius: 10, padding: "12px 14px" }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: TP, margin: 0 }}>Send to Kitchen Display</p>
                <p style={{ fontSize: 11, color: TMUTED, margin: "2px 0 0" }}>When off, this category won't appear on the KDS</p>
              </div>
              <Switch checked={catForm.sendToKds} onCheckedChange={(v) => setCatForm((f) => ({ ...f, sendToKds: v }))} />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setCatDialog(null)}
              style={{ padding: "8px 16px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: TM, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              Cancel
            </button>
            <button
              onClick={handleCatSave}
              disabled={!catForm.name.trim() || createCategory.isPending || updateCategory.isPending}
              style={{ padding: "8px 16px", borderRadius: 8, background: OR, border: "none", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, opacity: (!catForm.name.trim() || createCategory.isPending || updateCategory.isPending) ? 0.6 : 1 }}>
              {catDialog?.mode === "create" ? "Create Category" : "Save Changes"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Image gallery picker dialog ── */}
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {galleryTarget === "imageUrl" ? "Pick Online Store Image" : "Pick POS Image"}
            </DialogTitle>
          </DialogHeader>
          <p style={{ fontSize: 12, color: TMUTED, marginTop: -4 }}>Click any photo to assign it to this item.</p>
          <div style={{ overflowY: "auto", flex: 1, marginTop: 8 }}>
            {galleryLoading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 160, color: TMUTED, fontSize: 13 }}>Loading photos…</div>
            ) : galleryUrls.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 160, color: TMUTED, fontSize: 13 }}>No uploaded photos found.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 8 }}>
                {galleryUrls.map((url) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => pickGalleryImage(url)}
                    style={{
                      aspectRatio: "1", borderRadius: 10, overflow: "hidden", cursor: "pointer",
                      border: `2px solid`, transition: "all 0.15s", padding: 0,
                      borderColor: form[galleryTarget] === url ? PUR : "rgba(255,255,255,0.1)",
                      outline: form[galleryTarget] === url ? `2px solid rgba(124,106,247,0.3)` : "none",
                    }}
                  >
                    <img
                      src={url} alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <button onClick={() => setGalleryOpen(false)}
              style={{ padding: "8px 16px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: TM, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              Cancel
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

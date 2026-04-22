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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Pencil, Trash2, Sliders, GripVertical, ChefHat, Upload, X } from "lucide-react";

type ModifierOption = { id: string; name: string; price: number; position: number };
type Modifier = { id: number; loyverseId: string; name: string; options: ModifierOption[] };

type MenuItemForm = {
  categoryId: number;
  name: string;
  description: string;
  price: string;
  imageUrl: string;
  posImageUrl: string;
  available: boolean;
  popular: boolean;
  spicy: boolean;
  vegetarian: boolean;
  selectedModifierIds: string[];
};

const emptyForm: MenuItemForm = {
  categoryId: 0,
  name: "",
  description: "",
  price: "",
  imageUrl: "",
  posImageUrl: "",
  available: true,
  popular: false,
  spicy: false,
  vegetarian: false,
  selectedModifierIds: [],
};

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

  // Category management
  type CatForm = { name: string; icon: string; sendToKds: boolean };
  const [catDialog, setCatDialog] = useState<null | { mode: "create" | "edit"; id?: number }>(null);
  const [catForm, setCatForm] = useState<CatForm>({ name: "", icon: "", sendToKds: true });
  const [form, setForm] = useState<MenuItemForm>(emptyForm);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // All modifiers loaded from API for the item dialog toggles
  const [allModifiers, setAllModifiers] = useState<Modifier[]>([]);
  useEffect(() => {
    fetch("/api/menu/modifiers").then((r) => r.json()).then((d) => setAllModifiers(d as Modifier[])).catch(() => {});
  }, []);

  // ── Reorder state ──────────────────────────────────────────────────────────
  const [orderedIds, setOrderedIds] = useState<number[]>([]);
  const isDraggingRef = useRef(false);

  // Sync orderedIds from API whenever items change (API sorts by sort_order).
  // Skip the sync while user is actively dragging to prevent mid-drag resets.
  useEffect(() => {
    if (!items || isDraggingRef.current) return;
    setOrderedIds((prev) => {
      const currentIds = new Set(items.map((i) => i.id));
      // Remove deleted items, keep existing order for survivors
      const pruned = prev.filter((id) => currentIds.has(id));
      // Append brand-new items (not yet in our local order) in API order
      const pruneSet = new Set(pruned);
      const newIds = items.filter((i) => !pruneSet.has(i.id)).map((i) => i.id);
      // If this is a fresh mount (prev is empty), just take API order directly
      if (pruned.length === 0) return items.map((i) => i.id);
      return [...pruned, ...newIds];
    });
  }, [items]);

  // ── Save reorder to DB (single call replaces N individual mutations) ───────
  const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
  const saveReorder = (ids: number[]) => {
    fetch(`${API_BASE}/api/menu/items/reorder`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }).catch(() => {});
  };

  const orderedItems = orderedIds
    .map((id) => items?.find((i) => i.id === id))
    .filter(Boolean) as NonNullable<typeof items>[number][];

  const filteredItems = orderedItems.filter((i) =>
    activeCategory === null ? true : i.categoryId === activeCategory
  );

  // ── Drag-and-drop ──────────────────────────────────────────────────────────
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  const handleDragStart = (id: number) => {
    isDraggingRef.current = true;
    setDraggingId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: number) => {
    e.preventDefault();
    if (id !== draggingId) setDragOverId(id);
  };

  const handleDrop = (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    isDraggingRef.current = false;
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }

    const next = [...orderedIds];
    const fromIdx = next.indexOf(draggingId);
    const toIdx = next.indexOf(targetId);
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, draggingId);
    setOrderedIds(next);

    // Single bulk call — avoids N individual mutations and the Zod schema gap
    saveReorder(next);

    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    isDraggingRef.current = false;
    setDraggingId(null);
    setDragOverId(null);
  };

  // ── Category reorder state ────────────────────────────────────────────────
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
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }).catch(() => {});
  };

  const orderedCategories = catOrderedIds
    .map((id) => categories?.find((c) => c.id === id))
    .filter(Boolean) as NonNullable<typeof categories>[number][];

  const [catDraggingId, setCatDraggingId] = useState<number | null>(null);
  const [catDragOverId, setCatDragOverId] = useState<number | null>(null);

  const handleCatDragStart = (id: number) => {
    isCatDraggingRef.current = true;
    setCatDraggingId(id);
  };

  const handleCatDragOver = (e: React.DragEvent, id: number) => {
    e.preventDefault();
    if (id !== catDraggingId) setCatDragOverId(id);
  };

  const handleCatDrop = (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    isCatDraggingRef.current = false;
    if (!catDraggingId || catDraggingId === targetId) {
      setCatDraggingId(null); setCatDragOverId(null); return;
    }
    const next = [...catOrderedIds];
    const fromIdx = next.indexOf(catDraggingId);
    const toIdx = next.indexOf(targetId);
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, catDraggingId);
    setCatOrderedIds(next);
    saveCatReorder(next);
    setCatDraggingId(null); setCatDragOverId(null);
  };

  const handleCatDragEnd = () => {
    isCatDraggingRef.current = false;
    setCatDraggingId(null); setCatDragOverId(null);
  };

  // ── KDS category toggle ────────────────────────────────────────────────────
  const handleToggleKds = (catId: number, sendToKds: boolean) => {
    updateCategory.mutate(
      { id: catId, data: { sendToKds } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListMenuCategoriesQueryKey() }) }
    );
  };

  // ── Bulk select ────────────────────────────────────────────────────────────
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
      categoryId: item.categoryId,
      name: item.name,
      description: item.description ?? "",
      price: String(item.price),
      imageUrl: item.imageUrl ?? "",
      posImageUrl: (item as { posImageUrl?: string | null }).posImageUrl ?? "",
      available: item.available,
      popular: item.popular,
      spicy: item.spicy,
      vegetarian: item.vegetarian,
      selectedModifierIds: (item as { loyverseModifierIds?: string[] }).loyverseModifierIds ?? [],
    });
    setDialog({ mode: "edit", id });
  };

  const handleSave = () => {
    const price = parseFloat(form.price);
    if (!form.name || isNaN(price) || !form.categoryId) return;

    const data = {
      categoryId: form.categoryId,
      name: form.name,
      description: form.description || null,
      price,
      imageUrl: form.imageUrl || null,
      posImageUrl: form.posImageUrl || null,
      available: form.available,
      popular: form.popular,
      spicy: form.spicy,
      vegetarian: form.vegetarian,
      loyverseModifierIds: form.selectedModifierIds.length > 0 ? form.selectedModifierIds : null,
    };

    const done = () => { invalidateItems(); setDialog(null); };

    if (dialog?.mode === "create") {
      createItem.mutate({ data }, { onSuccess: done });
    } else if (dialog?.mode === "edit" && dialog.id) {
      updateItem.mutate({ id: dialog.id, data }, { onSuccess: done });
    }
  };

  const handleToggleAvailable = (id: number, available: boolean) => {
    updateItem.mutate({ id, data: { available } }, {
      onSuccess: () => {
        if (!available) {
          // Move hidden item to the very bottom of the ordered list, then persist
          setOrderedIds((prev) => {
            const next = prev.filter((x) => x !== id).concat(id);
            saveReorder(next);
            return next;
          });
        }
        invalidateItems();
      },
    });
  };

  const handleImageUpload = async (file: File) => {
    setImageUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", credentials: "include", body });
      if (!r.ok) throw new Error("Upload failed");
      const { url } = await r.json() as { url: string };
      setForm((f) => ({ ...f, imageUrl: url }));
    } catch {
      alert("Image upload failed. Try again.");
    } finally {
      setImageUploading(false);
    }
  };

  const handlePosImageUpload = async (file: File) => {
    setPosImageUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", credentials: "include", body });
      if (!r.ok) throw new Error("Upload failed");
      const { url } = await r.json() as { url: string };
      setForm((f) => ({ ...f, posImageUrl: url }));
    } catch {
      alert("Image upload failed. Try again.");
    } finally {
      setPosImageUploading(false);
    }
  };

  const handleCatSave = () => {
    if (!catForm.name.trim()) return;
    const done = () => {
      queryClient.invalidateQueries({ queryKey: getListMenuCategoriesQueryKey() });
      setCatDialog(null);
    };
    if (catDialog?.mode === "create") {
      createCategory.mutate({ data: { name: catForm.name, icon: catForm.icon || null, sendToKds: catForm.sendToKds } }, { onSuccess: done });
    } else if (catDialog?.mode === "edit" && catDialog.id) {
      updateCategory.mutate({ id: catDialog.id, data: { name: catForm.name, icon: catForm.icon || null, sendToKds: catForm.sendToKds } as Parameters<typeof updateCategory.mutate>[0]["data"] }, { onSuccess: done });
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
      await new Promise<void>((resolve) => {
        deleteItem.mutate({ id: item.id }, { onSuccess: () => resolve(), onError: () => resolve() });
      });
    }
    setSelectedIds(new Set());
    invalidateItems();
    setBulkDeleting(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link href={adminRoutes.dashboard}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <span className="font-black text-primary">Menu Manager</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href={adminRoutes.modifiers}>
              <Button variant="outline" size="sm">
                <Sliders className="h-4 w-4 mr-2" />
                Modifiers
              </Button>
            </Link>
            <Button onClick={openCreate} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">

        {/* ── Category Management ───────────────────────────────────────── */}
        <div className="rounded-xl border bg-card p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ChefHat className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">Categories</span>
            </div>
            <Button size="sm" variant="outline" onClick={() => { setCatForm({ name: "", icon: "", sendToKds: true }); setCatDialog({ mode: "create" }); }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add
            </Button>
          </div>
          {orderedCategories && orderedCategories.length > 0 ? (
            <div className="space-y-1">
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
                    className={`flex items-center gap-3 py-1.5 px-1 rounded-lg transition-all ${isCatDragging ? "opacity-40" : ""} ${isCatDragOver ? "bg-primary/10 border border-primary/40" : "border border-transparent"}`}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-grab shrink-0" />
                    <span className="text-lg w-7 text-center shrink-0">{(cat as { icon?: string | null }).icon ?? "📂"}</span>
                    <span className={`flex-1 text-sm font-medium ${cat.sendToKds ? "" : "text-muted-foreground line-through"}`}>
                      {cat.name}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0" title="Send items in this category to the Kitchen Display">
                      <span className={`text-xs font-medium ${cat.sendToKds ? "text-green-600" : "text-muted-foreground"}`}>KDS</span>
                      <Switch
                        checked={cat.sendToKds}
                        onCheckedChange={(v) => handleToggleKds(cat.id, v)}
                        onClick={e => e.stopPropagation()}
                      />
                    </div>
                    <button
                      onClick={() => { setCatForm({ name: cat.name, icon: (cat as { icon?: string | null }).icon ?? "", sendToKds: cat.sendToKds }); setCatDialog({ mode: "edit", id: cat.id }); }}
                      className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleCatDelete(cat.id, cat.name)}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground mt-1 ml-1">Drag <GripVertical className="inline h-3 w-3" /> to reorder categories</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No categories yet. Add one to get started.</p>
          )}
        </div>

        {/* Category filter */}
        <div className="flex gap-2 flex-wrap mb-6">
          <button
            onClick={() => setActiveCategory(null)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${activeCategory === null ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
          >
            All
          </button>
          {orderedCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors flex items-center gap-1.5 ${activeCategory === cat.id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
            >
              {(cat as { icon?: string | null }).icon && <span>{(cat as { icon?: string | null }).icon}</span>}
              {cat.name}
              {!cat.sendToKds && (
                <span className="text-[10px] opacity-60 font-normal">no KDS</span>
              )}
            </button>
          ))}
        </div>

        {/* Bulk action bar */}
        {someSelected && (
          <div className="flex items-center justify-between bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 mb-4">
            <span className="text-sm font-semibold text-destructive">
              {selectedCount} item{selectedCount > 1 ? "s" : ""} selected
            </span>
            <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={bulkDeleting}>
              <Trash2 className="h-4 w-4 mr-1.5" />
              {bulkDeleting ? "Deleting…" : `Delete ${selectedCount}`}
            </Button>
          </div>
        )}

        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : (
          <div className="rounded-xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="p-3 w-8"></th>
                  <th className="p-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                      onChange={toggleSelectAll}
                      className="rounded border-border cursor-pointer w-4 h-4"
                    />
                  </th>
                  <th className="text-left p-3 font-semibold">Item</th>
                  <th className="text-left p-3 font-semibold hidden sm:table-cell">Category</th>
                  <th className="text-right p-3 font-semibold">Price</th>
                  <th className="text-center p-3 font-semibold">Available</th>
                  <th className="text-center p-3 font-semibold">Actions</th>
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
                      className={`transition-colors ${
                        isDragging ? "opacity-40 bg-muted/60" :
                        isDragOver ? "bg-primary/8 border-t-2 border-primary" :
                        isSelected ? "bg-destructive/5" :
                        !item.available ? "opacity-50" :
                        idx % 2 === 0 ? "" : "bg-muted/20"
                      }`}
                    >
                      <td className="p-3 w-8 cursor-grab active:cursor-grabbing">
                        <GripVertical className="h-4 w-4 text-muted-foreground/50 mx-auto" />
                      </td>
                      <td className="p-3 w-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(item.id)}
                          className="rounded border-border cursor-pointer w-4 h-4"
                        />
                      </td>
                      <td className="p-3">
                        <div className="font-medium flex items-center gap-2">
                          {item.name}
                          {!item.available && <span className="text-[10px] font-semibold uppercase tracking-wide bg-muted text-muted-foreground rounded px-1.5 py-0.5">Hidden</span>}
                        </div>
                        <div className="text-muted-foreground text-xs flex gap-2 mt-0.5">
                          {item.popular && <span>Popular</span>}
                          {item.spicy && <span>Spicy</span>}
                          {item.vegetarian && <span>Vegetarian</span>}
                        </div>
                      </td>
                      <td className="p-3 hidden sm:table-cell text-muted-foreground">{cat?.name}</td>
                      <td className="p-3 text-right font-bold">${item.price.toFixed(2)}</td>
                      <td className="p-3 text-center">
                        <Switch
                          checked={item.available}
                          onCheckedChange={(v) => handleToggleAvailable(item.id, v)}
                        />
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(item.id)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredItems.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                No items found. Add one with the button above.
              </div>
            )}
          </div>
        )}
        {filteredItems.length > 1 && (
          <p className="text-xs text-muted-foreground mt-2 text-center">Drag the <GripVertical className="inline h-3 w-3" /> handle to reorder items</p>
        )}
      </div>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog?.mode === "create" ? "Add Menu Item" : "Edit Menu Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Category</Label>
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
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Price *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            {/* Online ordering image */}
            <div className="space-y-2">
              <Label>Online Store Image</Label>
              <p className="text-xs text-muted-foreground -mt-1">Shown on the customer ordering page.</p>
              <div className="flex gap-2">
                <Input
                  value={form.imageUrl}
                  onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                  placeholder="https://... or upload →"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={imageUploading}
                  onClick={() => imageInputRef.current?.click()}
                  className="shrink-0"
                >
                  {imageUploading ? "Uploading…" : <><Upload className="h-4 w-4 mr-1" />Upload</>}
                </Button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ""; }}
                />
              </div>
              {form.imageUrl && (
                <div className="relative w-24 h-24 rounded-lg overflow-hidden border bg-muted">
                  <img src={form.imageUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                    className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full w-5 h-5 flex items-center justify-center transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>

            {/* POS image */}
            <div className="space-y-2">
              <Label>POS Image <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <p className="text-xs text-muted-foreground -mt-1">Shown on the staff POS screen. Falls back to the online store image if left blank.</p>
              <div className="flex gap-2">
                <Input
                  value={form.posImageUrl}
                  onChange={(e) => setForm((f) => ({ ...f, posImageUrl: e.target.value }))}
                  placeholder="https://... or upload →"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={posImageUploading}
                  onClick={() => posImageInputRef.current?.click()}
                  className="shrink-0"
                >
                  {posImageUploading ? "Uploading…" : <><Upload className="h-4 w-4 mr-1" />Upload</>}
                </Button>
                <input
                  ref={posImageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePosImageUpload(f); e.target.value = ""; }}
                />
              </div>
              {form.posImageUrl && (
                <div className="relative w-24 h-24 rounded-lg overflow-hidden border bg-muted">
                  <img src={form.posImageUrl} alt="POS Preview" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, posImageUrl: "" }))}
                    className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full w-5 h-5 flex items-center justify-center transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {(["available", "popular", "spicy", "vegetarian"] as const).map((flag) => (
                <div key={flag} className="flex items-center justify-between">
                  <Label className="capitalize">{flag}</Label>
                  <Switch
                    checked={form[flag]}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, [flag]: v }))}
                  />
                </div>
              ))}
            </div>

            {/* Modifier toggles */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5" /> Modifiers
                </Label>
                <Link href={adminRoutes.modifiers} className="text-xs text-primary hover:underline">
                  Manage modifiers →
                </Link>
              </div>
              {allModifiers.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">
                  No modifiers yet. <Link href={adminRoutes.modifiers} className="text-primary hover:underline">Create some first.</Link>
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2">
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
                        className={`flex items-center justify-between px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                          isOn ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                        }`}
                      >
                        <div>
                          <p className="text-sm font-medium">{mod.name}</p>
                          {mod.options.length > 0 && (
                            <p className="text-xs text-muted-foreground">
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
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createItem.isPending || updateItem.isPending}>
              {dialog?.mode === "create" ? "Add Item" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category create/edit dialog */}
      <Dialog open={!!catDialog} onOpenChange={(open) => { if (!open) setCatDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{catDialog?.mode === "create" ? "New Category" : "Edit Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={catForm.name}
                onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Tacos"
              />
            </div>
            <div className="space-y-2">
              <Label>Icon (emoji)</Label>
              <div className="flex items-center gap-3">
                <span className="text-3xl w-12 h-12 flex items-center justify-center border rounded-lg bg-muted">
                  {catForm.icon || "📂"}
                </span>
                <Input
                  value={catForm.icon}
                  onChange={(e) => setCatForm((f) => ({ ...f, icon: e.target.value }))}
                  placeholder="🌮"
                  maxLength={4}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">Paste or type an emoji to represent this category.</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Send to Kitchen Display</p>
                <p className="text-xs text-muted-foreground">When off, this category won't appear on the KDS</p>
              </div>
              <Switch
                checked={catForm.sendToKds}
                onCheckedChange={(v) => setCatForm((f) => ({ ...f, sendToKds: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialog(null)}>Cancel</Button>
            <Button
              onClick={handleCatSave}
              disabled={!catForm.name.trim() || createCategory.isPending || updateCategory.isPending}
            >
              {catDialog?.mode === "create" ? "Create Category" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

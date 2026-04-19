import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { adminRoutes } from "@/lib/admin-path";
import {
  useListMenuCategories,
  useListMenuItems,
  useCreateMenuItem,
  useUpdateMenuItem,
  useDeleteMenuItem,
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
import { ArrowLeft, Plus, Pencil, Trash2, ChevronUp, ChevronDown } from "lucide-react";

type MenuItemForm = {
  categoryId: number;
  name: string;
  description: string;
  price: string;
  imageUrl: string;
  available: boolean;
  popular: boolean;
  spicy: boolean;
  vegetarian: boolean;
};

const emptyForm: MenuItemForm = {
  categoryId: 0,
  name: "",
  description: "",
  price: "",
  imageUrl: "",
  available: true,
  popular: false,
  spicy: false,
  vegetarian: false,
};

export default function AdminMenu() {
  const queryClient = useQueryClient();
  const { data: categories } = useListMenuCategories();
  const { data: items, isLoading } = useListMenuItems();
  const createItem = useCreateMenuItem();
  const updateItem = useUpdateMenuItem();
  const deleteItem = useDeleteMenuItem();

  const [dialog, setDialog] = useState<null | { mode: "create" | "edit"; id?: number }>(null);
  const [form, setForm] = useState<MenuItemForm>(emptyForm);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // ── Reorder state ──────────────────────────────────────────────────────────
  // orderedIds tracks the display order as an array of item IDs.
  // It's initialized from the API (sorted by sortOrder then id) and updated
  // optimistically whenever the user clicks ↑ / ↓.
  const [orderedIds, setOrderedIds] = useState<number[]>([]);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!items) return;
    // Sync once on first load; after that orderedIds is the source of truth
    // until the page is refreshed.
    if (!initializedRef.current) {
      setOrderedIds(items.map((i) => i.id));
      initializedRef.current = true;
    } else {
      // Merge in any newly added items (they won't be in orderedIds yet)
      setOrderedIds((prev) => {
        const existing = new Set(prev);
        const newIds = items.filter((i) => !existing.has(i.id)).map((i) => i.id);
        // Also remove IDs that no longer exist
        const currentIds = new Set(items.map((i) => i.id));
        const pruned = prev.filter((id) => currentIds.has(id));
        return [...pruned, ...newIds];
      });
    }
  }, [items]);

  // Build ordered + filtered item list from orderedIds
  const orderedItems = orderedIds
    .map((id) => items?.find((i) => i.id === id))
    .filter(Boolean) as NonNullable<typeof items>[number][];

  const filteredItems = orderedItems.filter((i) =>
    activeCategory === null ? true : i.categoryId === activeCategory
  );

  // Move an item up or down within the filtered view.
  // We swap positions in orderedIds and persist new sortOrders to the API.
  const moveItem = (itemId: number, direction: "up" | "down") => {
    const idx = filteredItems.findIndex((i) => i.id === itemId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= filteredItems.length) return;

    const itemA = filteredItems[idx];
    const itemB = filteredItems[swapIdx];

    setOrderedIds((prev) => {
      const next = [...prev];
      const posA = next.indexOf(itemA.id);
      const posB = next.indexOf(itemB.id);
      [next[posA], next[posB]] = [next[posB], next[posA]];

      // Persist after computing the new positions
      updateItem.mutate({ id: itemA.id, data: { sortOrder: posB * 10 } });
      updateItem.mutate({ id: itemB.id, data: { sortOrder: posA * 10 } });

      return next;
    });
  };

  const allSelected = filteredItems.length > 0 && filteredItems.every((i) => selectedIds.has(i.id));
  const someSelected = filteredItems.some((i) => selectedIds.has(i.id));
  const selectedCount = filteredItems.filter((i) => selectedIds.has(i.id)).length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredItems.forEach((i) => next.delete(i.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredItems.forEach((i) => next.add(i.id));
        return next;
      });
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const invalidateItems = () => {
    queryClient.invalidateQueries({ queryKey: getListMenuItemsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListMenuCategoriesQueryKey() });
  };

  const openCreate = () => {
    setForm({ ...emptyForm, categoryId: activeCategory ?? (categories?.[0]?.id ?? 0) });
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
      available: item.available,
      popular: item.popular,
      spicy: item.spicy,
      vegetarian: item.vegetarian,
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
      available: form.available,
      popular: form.popular,
      spicy: form.spicy,
      vegetarian: form.vegetarian,
    };

    const done = () => { invalidateItems(); setDialog(null); };

    if (dialog?.mode === "create") {
      createItem.mutate({ data }, { onSuccess: done });
    } else if (dialog?.mode === "edit" && dialog.id) {
      updateItem.mutate({ id: dialog.id, data }, { onSuccess: done });
    }
  };

  const handleToggleAvailable = (id: number, available: boolean) => {
    updateItem.mutate(
      { id, data: { available } },
      { onSuccess: invalidateItems }
    );
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
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Category filter */}
        <div className="flex gap-2 flex-wrap mb-6">
          <button
            onClick={() => setActiveCategory(null)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${activeCategory === null ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
          >
            All
          </button>
          {categories?.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${activeCategory === cat.id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Bulk action bar */}
        {someSelected && (
          <div className="flex items-center justify-between bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 mb-4">
            <span className="text-sm font-semibold text-destructive">
              {selectedCount} item{selectedCount > 1 ? "s" : ""} selected
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
            >
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
                  <th className="text-center p-3 font-semibold w-24">Order</th>
                  <th className="text-center p-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, idx) => {
                  const cat = categories?.find((c) => c.id === item.categoryId);
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <tr
                      key={item.id}
                      className={`${isSelected ? "bg-destructive/5" : !item.available ? "opacity-50" : idx % 2 === 0 ? "" : "bg-muted/20"}`}
                    >
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
                        <div className="flex items-center justify-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={idx === 0}
                            onClick={() => moveItem(item.id, "up")}
                            title="Move up"
                            className="h-7 w-7 p-0 text-muted-foreground disabled:opacity-20"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={idx === filteredItems.length - 1}
                            onClick={() => moveItem(item.id, "down")}
                            title="Move down"
                            className="h-7 w-7 p-0 text-muted-foreground disabled:opacity-20"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </div>
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
      </div>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-md">
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
            <div className="space-y-2">
              <Label>Image URL</Label>
              <Input value={form.imageUrl} onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))} placeholder="https://..." />
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createItem.isPending || updateItem.isPending}>
              {dialog?.mode === "create" ? "Add Item" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

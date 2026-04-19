import { useState, useMemo } from "react";
import { useListMenuCategories, useListMenuItems } from "@workspace/api-client-react";
import { useCart, type ModifierSelection } from "@/lib/cart-context";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, Clock, MapPin, Plus, Minus, Loader2 } from "lucide-react";

interface ModifierOption {
  id: string;
  name: string;
  price: number;
  position: number;
}

interface ModifierGroup {
  id: number;
  loyverseId: string;
  name: string;
  options: ModifierOption[];
}

export default function Home() {
  const { data: categories, isLoading: loadingCategories } = useListMenuCategories();
  const { data: items, isLoading: loadingItems } = useListMenuItems({ available: true });

  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, Set<string>>>({});
  const [loadingModifiers, setLoadingModifiers] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const { addItem } = useCart();

  const filteredItems = useMemo(() => {
    if (!items) return [];
    if (activeCategory === null) return items;
    return items.filter(item => item.categoryId === activeCategory);
  }, [items, activeCategory]);

  const popularItems = useMemo(() => {
    if (!items) return [];
    return items.filter(item => item.popular).slice(0, 3);
  }, [items]);

  const extraPrice = useMemo(() => {
    let extra = 0;
    for (const group of modifierGroups) {
      const selected = selectedModifiers[group.loyverseId];
      if (!selected) continue;
      for (const option of group.options) {
        if (selected.has(option.id)) extra += option.price;
      }
    }
    return extra;
  }, [modifierGroups, selectedModifiers]);

  const toggleModifier = (groupId: string, optionId: string) => {
    setSelectedModifiers(prev => {
      const current = new Set(prev[groupId] ?? []);
      if (current.has(optionId)) current.delete(optionId);
      else current.add(optionId);
      return { ...prev, [groupId]: current };
    });
  };

  const handleAddToCart = () => {
    if (!selectedItem) return;
    const modifierSelections: ModifierSelection[] = [];
    for (const group of modifierGroups) {
      const selected = selectedModifiers[group.loyverseId];
      if (!selected || selected.size === 0) continue;
      const selectedOptions = group.options.filter(o => selected.has(o.id));
      for (const option of selectedOptions) {
        modifierSelections.push({
          modifierId: group.loyverseId,
          optionId: option.id,
          name: option.name,
          price: option.price,
        });
      }
    }
    // notes carries only the customer's free-text special instructions.
    // Modifier details are fully captured in modifierSelections — no need to duplicate them.
    addItem(selectedItem, quantity, notes || undefined, modifierSelections.length > 0 ? modifierSelections : undefined);
    setSelectedItem(null);
    setQuantity(1);
    setNotes("");
    setModifierGroups([]);
    setSelectedModifiers({});
    setShowNotes(false);
  };

  const openItemModal = async (item: any) => {
    setSelectedItem(item);
    setQuantity(1);
    setNotes("");
    setModifierGroups([]);
    setSelectedModifiers({});
    setShowNotes(false);
    setLoadingModifiers(true);
    try {
      const res = await fetch(`/api/menu/items/${item.id}/modifiers`);
      if (res.ok) {
        const mods: ModifierGroup[] = await res.json();
        setModifierGroups(mods);
      }
    } catch {
      // silently ignore, modifiers are optional
    } finally {
      setLoadingModifiers(false);
    }
  };

  const allCategories = [{ id: null, name: "All" }, ...(categories?.sort((a, b) => a.sortOrder - b.sortOrder) ?? [])];

  return (
    <Layout>
      {/* Hero */}
      <section className="relative h-[380px] md:h-[460px] overflow-hidden bg-neutral-900">
        <img
          src="/images/hero.png"
          alt="Fresh colorful tacos"
          className="absolute inset-0 w-full h-full object-cover object-center opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/10" />
        <div className="relative h-full flex flex-col justify-end max-w-6xl mx-auto px-6 pb-12">
          <p className="text-xs font-semibold tracking-widest text-white/60 uppercase flex items-center gap-1.5 mb-3">
            <MapPin className="w-3 h-3" /> Mexican Food · Road Town, BVI
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight tracking-tight">
            Fresh. Bold.<br />Unforgettable.
          </h1>
          <div className="flex items-center gap-4">
            <button
              className="bg-white text-foreground font-semibold px-6 py-2.5 rounded-full text-sm hover:bg-white/90 transition flex items-center gap-1.5"
              onClick={() => document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" })}
            >
              Order Now <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-center gap-1.5 text-white/70 text-sm">
              <Clock className="w-4 h-4" />
              Ready in 20–30 min
            </div>
          </div>
        </div>
      </section>

      {/* Popular Items */}
      {!loadingItems && popularItems.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 py-12">
          <h2 className="text-lg font-semibold mb-5">Best Sellers</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {popularItems.map((item) => (
              <button
                key={item.id}
                className="text-left group border border-border rounded-xl overflow-hidden hover:border-foreground/20 transition-colors"
                onClick={() => openItemModal(item)}
              >
                <div className="aspect-[4/3] bg-muted overflow-hidden relative">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl text-muted-foreground/30 font-bold">
                      {item.name.charAt(0)}
                    </div>
                  )}
                  <span className="absolute top-3 left-3 bg-secondary/90 text-secondary-foreground text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide">
                    Best Seller
                  </span>
                </div>
                <div className="p-4 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.description}</p>
                  </div>
                  <span className="text-sm font-semibold shrink-0">${item.price.toFixed(2)}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Full Menu */}
      <section id="menu" className="flex-1 border-t border-border">
        {/* Category tab bar */}
        <div className="sticky top-16 z-10 bg-background border-b border-border">
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex gap-6 overflow-x-auto scrollbar-none">
              {loadingCategories ? (
                <div className="flex gap-6 py-3">
                  {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-5 w-16" />)}
                </div>
              ) : (
                allCategories.map((cat) => (
                  <button
                    key={cat.id ?? "all"}
                    className={`py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                      activeCategory === cat.id
                        ? "border-foreground text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setActiveCategory(cat.id ?? null)}
                  >
                    {cat.name}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Menu items */}
        <div className="max-w-6xl mx-auto px-6 py-8">
          {loadingItems ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="flex gap-4 py-4 border-b border-border">
                  <Skeleton className="w-20 h-20 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <p className="font-medium">No items in this category right now.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-4 py-5 group cursor-pointer hover:bg-muted/30 -mx-3 px-3 rounded-lg transition-colors"
                  onClick={() => openItemModal(item)}
                >
                  <div className="w-20 h-20 shrink-0 rounded-lg bg-muted overflow-hidden">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground/30 text-2xl font-bold">
                        {item.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{item.name}</span>
                        {item.popular && <span className="text-[10px] font-bold bg-secondary/15 text-secondary-foreground px-1.5 py-0.5 rounded uppercase tracking-wide">Popular</span>}
                        {item.spicy && <span className="text-[10px] font-bold bg-destructive/10 text-destructive px-1.5 py-0.5 rounded uppercase tracking-wide">Spicy</span>}
                        {item.vegetarian && <span className="text-[10px] font-bold bg-accent/15 text-accent px-1.5 py-0.5 rounded uppercase tracking-wide">Veg</span>}
                      </div>
                      <span className="text-sm font-semibold shrink-0">${item.price.toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{item.description}</p>
                    <button
                      className="mt-2 text-xs font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity border border-border rounded-full px-3 py-1 hover:bg-foreground hover:text-background hover:border-foreground"
                      onClick={(e) => { e.stopPropagation(); openItemModal(item); }}
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Item dialog */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        {selectedItem && (
          <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0 max-h-[90vh] flex flex-col">
            {/* Image */}
            <div className="w-full bg-muted overflow-hidden shrink-0 flex items-center justify-center" style={{ maxHeight: "260px", minHeight: "160px" }}>
              {selectedItem.imageUrl ? (
                <img src={selectedItem.imageUrl} alt={selectedItem.name} className="w-full h-full object-contain" style={{ maxHeight: "260px" }} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground/20 text-6xl font-bold">
                  {selectedItem.name.charAt(0)}
                </div>
              )}
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1">
              <div className="p-6 space-y-5">
                <div>
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <DialogTitle className="text-xl font-bold leading-tight">{selectedItem.name}</DialogTitle>
                    <span className="text-xl font-bold shrink-0">${(selectedItem.price + extraPrice).toFixed(2)}</span>
                  </div>
                  <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                    {selectedItem.description}
                  </DialogDescription>
                </div>

                {/* Modifiers */}
                {loadingModifiers ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading options...
                  </div>
                ) : modifierGroups.length > 0 && (
                  <div className="space-y-5">
                    {modifierGroups.map((group) => (
                      <div key={group.loyverseId}>
                        <Separator className="mb-4" />
                        <p className="text-sm font-semibold mb-3">{group.name}</p>
                        <div className="space-y-2">
                          {group.options.map((option) => {
                            const isSelected = selectedModifiers[group.loyverseId]?.has(option.id) ?? false;
                            return (
                              <label
                                key={option.id}
                                className="flex items-center justify-between gap-3 cursor-pointer group/opt"
                              >
                                <div className="flex items-center gap-3">
                                  <Checkbox
                                    id={option.id}
                                    checked={isSelected}
                                    onCheckedChange={() => toggleModifier(group.loyverseId, option.id)}
                                  />
                                  <span className="text-sm group-hover/opt:text-foreground transition-colors">
                                    {option.name}
                                  </span>
                                </div>
                                {option.price > 0 && (
                                  <span className="text-sm text-muted-foreground shrink-0">+${option.price.toFixed(2)}</span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    <Separator />
                  </div>
                )}

                {/* Notes — collapsed by default to avoid keyboard blocking */}
                {!showNotes ? (
                  <button
                    type="button"
                    className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors text-left"
                    onClick={() => setShowNotes(true)}
                  >
                    + Add special instructions
                  </button>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="notes" className="text-sm font-medium">Special instructions</Label>
                    <Textarea
                      id="notes"
                      placeholder="No onions, extra sauce..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="resize-none h-20 text-sm"
                      autoFocus
                    />
                  </div>
                )}

                {/* Quantity + Add */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center border border-border rounded-full h-10 shrink-0">
                    <button
                      className="w-10 h-full flex items-center justify-center hover:bg-muted rounded-l-full transition-colors"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold">{quantity}</span>
                    <button
                      className="w-10 h-full flex items-center justify-center hover:bg-muted rounded-r-full transition-colors"
                      onClick={() => setQuantity(quantity + 1)}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <Button className="flex-1 h-10 font-semibold rounded-full" onClick={handleAddToCart}>
                    Add {quantity > 1 && `${quantity} × `}— ${((selectedItem.price + extraPrice) * quantity).toFixed(2)}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </Layout>
  );
}

import { useState, useMemo } from "react";
import { useListMenuCategories, useListMenuItems } from "@workspace/api-client-react";
import { useCart } from "@/lib/cart-context";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function Home() {
  const { data: categories, isLoading: loadingCategories } = useListMenuCategories();
  const { data: items, isLoading: loadingItems } = useListMenuItems({ available: true });
  
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  
  const { addItem } = useCart();

  const filteredItems = useMemo(() => {
    if (!items) return [];
    if (activeCategory === null) return items;
    return items.filter(item => item.categoryId === activeCategory);
  }, [items, activeCategory]);

  const popularItems = useMemo(() => {
    if (!items) return [];
    return items.filter(item => item.popular).slice(0, 4);
  }, [items]);

  const handleAddToCart = () => {
    if (selectedItem) {
      addItem(selectedItem, quantity, notes);
      setSelectedItem(null);
      setQuantity(1);
      setNotes("");
    }
  };

  const openItemModal = (item: any) => {
    setSelectedItem(item);
    setQuantity(1);
    setNotes("");
  };

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative w-full h-[500px] flex items-center overflow-hidden bg-primary/10">
        <div className="absolute inset-0 w-full h-full z-0">
          <img 
            src="/images/hero.png" 
            alt="Fresh colorful tacos" 
            className="w-full h-full object-cover object-center brightness-[0.85] contrast-125"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/60 to-transparent"></div>
        </div>
        
        <div className="container relative z-10 px-4 md:px-8">
          <div className="max-w-2xl space-y-6">
            <Badge className="bg-accent text-accent-foreground hover:bg-accent/90 text-sm font-bold px-3 py-1 rounded-full border-none">
              Authentic Puerto Rican Flavor
            </Badge>
            <h1 className="text-5xl md:text-7xl font-black tracking-tight text-foreground leading-[1.1] drop-shadow-sm">
              Bite into the <span className="text-primary">Island.</span>
            </h1>
            <p className="text-xl text-foreground/80 font-medium max-w-lg drop-shadow-sm">
              Bold, colorful, and wildly fresh. Order ahead for pickup or delivery and taste the sunshine.
            </p>
            <div className="pt-4 flex gap-4">
              <Button size="lg" className="h-14 px-8 text-lg rounded-full font-bold shadow-lg" onClick={() => document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' })}>
                Order Now
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Items */}
      {popularItems.length > 0 && (
        <section className="py-16 bg-background">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-black mb-8 tracking-tight">Crowd Favorites</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {popularItems.map((item) => (
                <Card key={item.id} className="overflow-hidden border-border/50 shadow-sm hover:shadow-md transition-all group cursor-pointer" onClick={() => openItemModal(item)}>
                  <div className="aspect-square bg-muted relative overflow-hidden">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                        <span className="text-4xl font-bold text-primary/30">{item.name.charAt(0)}</span>
                      </div>
                    )}
                    <div className="absolute top-3 left-3 flex flex-col gap-2">
                      <Badge className="bg-accent text-accent-foreground font-bold shadow-sm">Popular</Badge>
                    </div>
                  </div>
                  <CardHeader className="p-4 pb-2">
                    <div className="flex justify-between items-start gap-4">
                      <CardTitle className="text-xl font-bold leading-tight">{item.name}</CardTitle>
                      <span className="font-bold text-lg text-primary">${item.price.toFixed(2)}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Main Menu */}
      <section id="menu" className="py-16 bg-muted/20 flex-1">
        <div className="container mx-auto px-4 flex flex-col md:flex-row gap-8">
          
          {/* Categories Sidebar */}
          <div className="w-full md:w-64 shrink-0">
            <div className="sticky top-24 space-y-1">
              <h3 className="font-black text-xl mb-4 px-4 uppercase tracking-widest text-muted-foreground">Menu</h3>
              <button
                className={`w-full text-left px-4 py-3 rounded-lg font-bold text-lg transition-colors ${activeCategory === null ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted text-foreground/80'}`}
                onClick={() => setActiveCategory(null)}
              >
                All Items
              </button>
              {loadingCategories ? (
                <div className="space-y-2 p-4">
                  <Skeleton className="h-10 w-full rounded-lg" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
              ) : (
                categories?.sort((a,b) => a.sortOrder - b.sortOrder).map((category) => (
                  <button
                    key={category.id}
                    className={`w-full text-left px-4 py-3 rounded-lg font-bold text-lg transition-colors ${activeCategory === category.id ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted text-foreground/80'}`}
                    onClick={() => setActiveCategory(category.id)}
                  >
                    {category.name}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Menu Items Grid */}
          <div className="flex-1">
            {loadingItems ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {[1,2,3,4,5,6].map(i => (
                  <Card key={i} className="overflow-hidden">
                    <Skeleton className="h-48 w-full rounded-none" />
                    <div className="p-4 space-y-3">
                      <Skeleton className="h-6 w-2/3" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-4/5" />
                      <div className="pt-4 flex justify-between">
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-8 w-24" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-20 bg-background rounded-xl border border-dashed">
                <h3 className="text-xl font-bold text-muted-foreground mb-2">No items found</h3>
                <p className="text-muted-foreground">Check back later or try another category.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredItems.map((item) => (
                  <Card key={item.id} className="overflow-hidden border-border/50 flex flex-col group hover:border-primary/30 transition-colors">
                    <div className="aspect-[4/3] bg-muted relative overflow-hidden cursor-pointer" onClick={() => openItemModal(item)}>
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                      ) : (
                        <div className="w-full h-full bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                          <span className="text-5xl font-bold text-primary/20">{item.name.charAt(0)}</span>
                        </div>
                      )}
                      <div className="absolute top-3 left-3 flex gap-2">
                        {item.spicy && <Badge variant="destructive" className="font-bold uppercase text-[10px]">Spicy</Badge>}
                        {item.vegetarian && <Badge className="bg-secondary text-secondary-foreground font-bold uppercase text-[10px]">Veg</Badge>}
                      </div>
                    </div>
                    <CardHeader className="p-4 pb-2 flex-none cursor-pointer" onClick={() => openItemModal(item)}>
                      <div className="flex justify-between items-start gap-4">
                        <CardTitle className="text-lg font-bold leading-tight group-hover:text-primary transition-colors">{item.name}</CardTitle>
                        <span className="font-black text-lg">${item.price.toFixed(2)}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 flex-1 cursor-pointer" onClick={() => openItemModal(item)}>
                      <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{item.description}</p>
                    </CardContent>
                    <CardFooter className="p-4 pt-0 mt-auto">
                      <Button variant="secondary" className="w-full font-bold" onClick={(e) => {
                        e.stopPropagation();
                        openItemModal(item);
                      }}>
                        Add to Order
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </div>

        </div>
      </section>

      {/* Item Customization Modal */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        {selectedItem && (
          <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden gap-0">
            <div className="aspect-[16/9] w-full bg-muted relative">
              {selectedItem.imageUrl ? (
                <img src={selectedItem.imageUrl} alt={selectedItem.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                  <span className="text-6xl font-bold text-primary/30">{selectedItem.name.charAt(0)}</span>
                </div>
              )}
            </div>
            <div className="p-6 space-y-6">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <DialogTitle className="text-2xl font-black">{selectedItem.name}</DialogTitle>
                  <span className="text-2xl font-black text-primary">${selectedItem.price.toFixed(2)}</span>
                </div>
                <DialogDescription className="text-base text-foreground/80">
                  {selectedItem.description}
                </DialogDescription>
              </div>

              <div className="space-y-3">
                <Label htmlFor="notes" className="text-base font-bold">Special Instructions</Label>
                <Textarea 
                  id="notes" 
                  placeholder="E.g. No onions, extra salsa..." 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="resize-none h-20 bg-muted/50"
                />
              </div>

              <div className="flex items-center gap-6 pt-4">
                <div className="flex items-center rounded-lg border-2 border-input bg-background h-14 flex-shrink-0">
                  <button 
                    className="w-14 h-full flex items-center justify-center hover:bg-muted rounded-l-md transition-colors text-xl font-medium"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    -
                  </button>
                  <span className="w-12 text-center text-lg font-bold">{quantity}</span>
                  <button 
                    className="w-14 h-full flex items-center justify-center hover:bg-muted rounded-r-md transition-colors text-xl font-medium"
                    onClick={() => setQuantity(quantity + 1)}
                  >
                    +
                  </button>
                </div>
                <Button className="flex-1 h-14 text-lg font-bold shadow-md" onClick={handleAddToCart}>
                  Add ${(selectedItem.price * quantity).toFixed(2)}
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </Layout>
  );
}

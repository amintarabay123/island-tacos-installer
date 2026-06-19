import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { MenuItem } from "@workspace/api-client-react";

export interface ModifierSelection {
  modifierId: string;
  optionId: string;
  name: string;
  price: number;
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes?: string;
  modifierSelections?: ModifierSelection[];
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: MenuItem, quantity: number, notes?: string, modifierSelections?: ModifierSelection[]) => void;
  removeItem: (menuItemId: number) => void;
  updateQuantity: (menuItemId: number, quantity: number) => void;
  clearCart: () => void;
  subtotal: number;
  tax: number;
  deliveryFee: number;
  total: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem("island_tacos_cart");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("island_tacos_cart", JSON.stringify(items));
  }, [items]);

  const addItem = (menuItem: MenuItem, quantity: number, notes?: string, modifierSelections?: ModifierSelection[]) => {
    setItems((prev) => {
      const modsKey = JSON.stringify(
        (modifierSelections ?? []).map(m => `${m.modifierId}:${m.optionId}`).sort()
      );
      const existing = prev.find((i) => {
        if (i.menuItem.id !== menuItem.id) return false;
        const existingModsKey = JSON.stringify(
          (i.modifierSelections ?? []).map(m => `${m.modifierId}:${m.optionId}`).sort()
        );
        return existingModsKey === modsKey;
      });
      if (existing) {
        return prev.map((i) => {
          const existingModsKey = JSON.stringify(
            (i.modifierSelections ?? []).map(m => `${m.modifierId}:${m.optionId}`).sort()
          );
          return i.menuItem.id === menuItem.id && existingModsKey === modsKey
            ? { ...i, quantity: i.quantity + quantity }
            : i;
        });
      }
      return [...prev, { menuItem, quantity, notes, modifierSelections }];
    });
  };

  const removeItem = (menuItemId: number) => {
    setItems((prev) => prev.filter((i) => i.menuItem.id !== menuItemId));
  };

  const updateQuantity = (menuItemId: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(menuItemId);
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.menuItem.id === menuItemId ? { ...i, quantity } : i
      )
    );
  };

  const clearCart = () => setItems([]);

  const subtotal = items.reduce((sum, item) => {
    const modExtra = (item.modifierSelections ?? []).reduce((s, m) => s + m.price, 0);
    return sum + (item.menuItem.price + modExtra) * item.quantity;
  }, 0);
  const tax = 0;
  const deliveryFee = 0;
  const total = subtotal + tax + deliveryFee;

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        subtotal,
        tax,
        deliveryFee,
        total,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}

const CUSTOMER_KEY = "it_customer";
const LAST_ORDER_KEY = "it_last_order";

export interface CustomerProfile {
  name: string;
  phone: string;
  email: string;
}

export interface LastOrder {
  code: string;
  placedAt: string;
}

export function getCustomer(): CustomerProfile | null {
  try {
    const raw = localStorage.getItem(CUSTOMER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CustomerProfile;
  } catch {
    return null;
  }
}

export function saveCustomer(profile: CustomerProfile): void {
  localStorage.setItem(CUSTOMER_KEY, JSON.stringify(profile));
}

export function clearCustomer(): void {
  localStorage.removeItem(CUSTOMER_KEY);
  localStorage.removeItem(LAST_ORDER_KEY);
}

export function getLastOrder(): LastOrder | null {
  try {
    const raw = localStorage.getItem(LAST_ORDER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LastOrder;
  } catch {
    return null;
  }
}

export function saveLastOrder(code: string): void {
  localStorage.setItem(LAST_ORDER_KEY, JSON.stringify({ code, placedAt: new Date().toISOString() }));
}

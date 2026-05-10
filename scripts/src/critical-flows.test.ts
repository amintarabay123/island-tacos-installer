/**
 * Critical regression tests for Island Tacos.
 *
 * These tests guard the two classes of bugs that have recurred:
 *   1. OpenAPI spec missing fields  → Zod silently strips them at runtime
 *   2. Phone normalization failures → SMS never reaches BVI customers
 *
 * Run: pnpm --filter @workspace/scripts run test
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const API = "http://localhost:80/api";
// scripts/ is one level below the workspace root
const SPEC_PATH = resolve(process.cwd(), "../lib/api-spec/openapi.yaml");

// ─── 1. OpenAPI spec guard ────────────────────────────────────────────────────
// Any field the server reads from POST bodies or returns in GET responses MUST
// be declared in openapi.yaml. If it isn't, Zod strips it silently at runtime.
//
// Strategy: find the schema by name, then grab the next 2000 chars (enough to
// cover all its properties) up to the next top-level schema key (4-space +
// capital letter pattern).

function schemaBlock(spec: string, schemaName: string): string {
  const marker = `    ${schemaName}:`;
  const start = spec.indexOf(marker);
  if (start === -1) throw new Error(`Schema "${schemaName}" not found in openapi.yaml`);
  // Find the next top-level schema: blank line followed by 4 spaces + capital letter
  const nextSchema = spec.slice(start + marker.length).search(/\n    [A-Z]/);
  const end = nextSchema === -1 ? spec.length : start + marker.length + nextSchema + 2000;
  return spec.slice(start, end);
}

describe("OpenAPI spec — required fields", () => {
  let spec: string;

  beforeAll(() => {
    spec = readFileSync(SPEC_PATH, "utf-8");
  });

  it("OrderItem schema includes modifierSelections", () => {
    expect(schemaBlock(spec, "OrderItem")).toContain("modifierSelections");
  });

  it("OrderItem schema includes alreadyMade", () => {
    expect(schemaBlock(spec, "OrderItem")).toContain("alreadyMade");
  });

  it("CreateOrderItemInput schema includes modifierSelections", () => {
    expect(schemaBlock(spec, "CreateOrderItemInput")).toContain("modifierSelections");
  });

  it("CreateOrderItemInput schema includes alreadyMade", () => {
    expect(schemaBlock(spec, "CreateOrderItemInput")).toContain("alreadyMade");
  });

  it("UpdateOrderStatusBody schema includes kdsCleared", () => {
    expect(schemaBlock(spec, "UpdateOrderStatusBody")).toContain("kdsCleared");
  });

  it("UpdateOrderStatusBody schema includes paymentStatus", () => {
    expect(schemaBlock(spec, "UpdateOrderStatusBody")).toContain("paymentStatus");
  });

  it("UpdateOrderStatusBody schema includes actualPaymentMethod", () => {
    expect(schemaBlock(spec, "UpdateOrderStatusBody")).toContain("actualPaymentMethod");
  });
});

// ─── 2. Phone normalisation ───────────────────────────────────────────────────
// Mirrors the logic in lib/phone-utils.ts without importing DB-coupled modules.

function formatBVIPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("1284") && digits.length === 11) return `+${digits}`;
  if (digits.startsWith("284") && digits.length === 10) return `+1${digits}`;
  if (digits.length === 7) return `+1284${digits}`;
  if (digits.startsWith("11284") && digits.length === 12) return `+${digits.slice(1)}`;
  return `+${digits}`;
}

function isBVIMobile(e164: string): boolean {
  const digits = e164.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (!digits.startsWith("1284")) return false;
  const nxx = digits.slice(4, 7);
  const LANDLINE_NXX = new Set(["468", "494", "495", "496"]);
  return !LANDLINE_NXX.has(nxx);
}

describe("Phone normalization", () => {
  it("7-digit local format → E.164", () => {
    expect(formatBVIPhone("4991234")).toBe("+12844991234");
  });

  it("7-digit with dash → E.164", () => {
    expect(formatBVIPhone("499-1234")).toBe("+12844991234");
  });

  it("10-digit 284 format → E.164", () => {
    expect(formatBVIPhone("2844991234")).toBe("+12844991234");
  });

  it("10-digit with dashes → E.164", () => {
    expect(formatBVIPhone("284-499-1234")).toBe("+12844991234");
  });

  it("10-digit with parens → E.164", () => {
    expect(formatBVIPhone("(284) 499-1234")).toBe("+12844991234");
  });

  it("11-digit 1284 format → E.164", () => {
    expect(formatBVIPhone("12844991234")).toBe("+12844991234");
  });

  it("already E.164 → unchanged", () => {
    expect(formatBVIPhone("+12844991234")).toBe("+12844991234");
  });

  it("valid BVI mobile passes isBVIMobile", () => {
    expect(isBVIMobile("+12844991234")).toBe(true);
  });

  it("normalised 7-digit passes isBVIMobile", () => {
    expect(isBVIMobile(formatBVIPhone("499-1234"))).toBe(true);
  });

  it("normalised 10-digit passes isBVIMobile", () => {
    expect(isBVIMobile(formatBVIPhone("284-499-1234"))).toBe(true);
  });

  it("non-BVI number fails isBVIMobile", () => {
    expect(isBVIMobile("+14155551234")).toBe(false);
  });

  it("10-digit without country code fails raw isBVIMobile (pre-normalisation)", () => {
    // This is the old bug: raw 10-digit was passed directly → failed
    expect(isBVIMobile("2844991234")).toBe(false);
  });
});

// ─── 3. API integration — modifier persistence ────────────────────────────────
// Verifies the full round-trip: POS sends modifiers → server stores → GET returns them.

describe("Order API — modifier persistence", () => {
  let createdOrderId: number | null = null;
  let firstMenuItemId: number | null = null;
  let authToken: string | null = null;

  function authHeaders(): Record<string, string> {
    return authToken ? { Authorization: `Bearer ${authToken}` } : {};
  }

  beforeAll(async () => {
    // Login so we can hit the now-protected order routes (GET/PATCH /orders/:id)
    const pin = process.env.STAFF_PIN ?? process.env.ADMIN_PIN;
    if (pin) {
      const loginRes = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (loginRes.ok) {
        const data = await loginRes.json() as { token?: string };
        if (data.token) authToken = data.token;
      }
    }
    if (!authToken) {
      console.warn("Skipping authed sub-tests: no STAFF_PIN/ADMIN_PIN env var or login failed");
    }

    // Fetch a real menu item to use in the order
    const r = await fetch(`${API}/menu/items`);
    if (!r.ok) return;
    const items = await r.json() as { id: number; available: boolean }[];
    const available = items.find((i) => i.available);
    if (available) firstMenuItemId = available.id;
  });

  it("menu is reachable and has items", async () => {
    const r = await fetch(`${API}/menu/items`);
    expect(r.ok).toBe(true);
    const items = await r.json() as unknown[];
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);
  });

  it("POST /orders with modifierSelections saves and returns them", async () => {
    if (!firstMenuItemId) {
      console.warn("Skipping: no available menu item found");
      return;
    }

    const modifiers = [
      { modifierId: "test-mod-1", optionId: "test-opt-1", name: "Extra Hot Sauce", price: 0.50 },
    ];

    const r = await fetch(`${API}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: "Test Runner",
        customerEmail: "",
        customerPhone: "4991234",
        orderType: "pickup",
        paymentMethod: "cash",
        paymentStatus: "pending",
        source: "pos",
        items: [
          {
            menuItemId: firstMenuItemId,
            quantity: 1,
            notes: "test order - please ignore",
            modifierSelections: modifiers,
          },
        ],
      }),
    });

    if (!r.ok) {
      const text = await r.text();
      throw new Error(`POST /orders failed (${r.status}): ${text}`);
    }

    const order = await r.json() as {
      id: number;
      items: { modifierSelections?: { name: string; price: number }[] | null }[];
    };

    createdOrderId = order.id;

    expect(Array.isArray(order.items)).toBe(true);
    const item = order.items[0];
    expect(item.modifierSelections).not.toBeNull();
    expect(Array.isArray(item.modifierSelections)).toBe(true);
    expect(item.modifierSelections!.length).toBe(1);
    expect(item.modifierSelections![0].name).toBe("Extra Hot Sauce");
    expect(item.modifierSelections![0].price).toBe(0.50);
  });

  it("GET /orders/:id returns the same modifiers", async () => {
    if (!createdOrderId) {
      console.warn("Skipping: no order was created in previous test");
      return;
    }
    if (!authToken) {
      console.warn("Skipping: no auth token (GET /orders/:id is staff-only)");
      return;
    }

    const r = await fetch(`${API}/orders/${createdOrderId}`, { headers: authHeaders() });
    expect(r.ok).toBe(true);

    const order = await r.json() as {
      items: { modifierSelections?: { name: string }[] | null }[];
    };

    const item = order.items[0];
    expect(item.modifierSelections).not.toBeNull();
    expect(Array.isArray(item.modifierSelections)).toBe(true);
    expect(item.modifierSelections![0].name).toBe("Extra Hot Sauce");
  });

  afterAll(async () => {
    // Cancel the test order so it doesn't clutter the KDS
    if (createdOrderId && authToken) {
      await fetch(`${API}/orders/${createdOrderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status: "cancelled" }),
      }).catch(() => {});
    }
  });
});

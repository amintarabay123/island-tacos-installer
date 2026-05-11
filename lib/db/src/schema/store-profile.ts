import { pgTable, text, serial, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Typed, single-row-per-tenant table for store IDENTITY (brand, contact,
// jurisdiction). Operational config (open hours, payment methods enabled,
// cutoff minutes, etc.) lives in the generic key/value `store_settings`
// table — keep that separation, it's intentional.
//
// One row today. When multi-tenancy lands, this becomes one row per tenant
// (add `tenant_id` and shift the PK / unique constraint at that point).
export const storeProfileTable = pgTable("store_profile", {
  id: serial("id").primaryKey(),
  storeName: text("store_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  address: text("address").notNull(),
  taxRate: numeric("tax_rate", { precision: 5, scale: 4 }).notNull().default("0"),
  timezone: text("timezone").notNull().default("America/Tortola"),
  currency: text("currency").notNull().default("USD"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStoreProfileSchema = createInsertSchema(storeProfileTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateStoreProfileSchema = insertStoreProfileSchema.partial();

export type InsertStoreProfile = z.infer<typeof insertStoreProfileSchema>;
export type UpdateStoreProfile = z.infer<typeof updateStoreProfileSchema>;
export type StoreProfile = typeof storeProfileTable.$inferSelect;

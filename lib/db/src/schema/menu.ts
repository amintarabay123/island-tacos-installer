import { pgTable, text, serial, timestamp, boolean, integer, numeric, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const menuCategoriesTable = pgTable("menu_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"),
  sortOrder: integer("sort_order").notNull().default(0),
  sendToKds: boolean("send_to_kds").notNull().default(true),
  kdsStation: text("kds_station"),
  loyverseId: text("loyverse_id").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMenuCategorySchema = createInsertSchema(menuCategoriesTable).omit({ id: true, createdAt: true });
export type InsertMenuCategory = z.infer<typeof insertMenuCategorySchema>;
export type MenuCategory = typeof menuCategoriesTable.$inferSelect;

export const menuItemsTable = pgTable("menu_items", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().references(() => menuCategoriesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: text("image_url"),
  posImageUrl: text("pos_image_url"),
  available: boolean("available").notNull().default(true),
  popular: boolean("popular").notNull().default(false),
  spicy: boolean("spicy").notNull().default(false),
  vegetarian: boolean("vegetarian").notNull().default(false),
  openPrice: boolean("open_price").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  loyverseItemId: text("loyverse_item_id").unique(),
  loyverseVariantId: text("loyverse_variant_id"),
  loyverseModifierIds: text("loyverse_modifier_ids").array(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("menu_items_category_id_idx").on(t.categoryId),
  index("menu_items_available_idx").on(t.available),
  index("menu_items_sort_order_idx").on(t.sortOrder),
]);

export const insertMenuItemSchema = createInsertSchema(menuItemsTable).omit({ id: true, createdAt: true });
export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;
export type MenuItem = typeof menuItemsTable.$inferSelect;

export interface ModifierOption {
  id: string;
  name: string;
  price: number;
  position: number;
  allowMultiple?: boolean;
  maxQuantity?: number;
}

export const modifiersTable = pgTable("modifiers", {
  id: serial("id").primaryKey(),
  loyverseId: text("loyverse_id").unique().notNull(),
  name: text("name").notNull(),
  options: jsonb("options").$type<ModifierOption[]>().notNull().default([]),
  required: boolean("required").notNull().default(false),
  minSelections: integer("min_selections").notNull().default(0),
  maxSelections: integer("max_selections"),
  sortOrder: integer("sort_order").notNull().default(0),
  // IDs of modifier options currently marked as sold out (86'd)
  unavailableOptionIds: text("unavailable_option_ids").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Modifier = typeof modifiersTable.$inferSelect;

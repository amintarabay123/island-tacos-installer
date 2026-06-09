import { pgTable, text, serial, timestamp, integer, numeric, jsonb, boolean, index, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { menuItemsTable } from "./menu";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  confirmationCode: text("confirmation_code").notNull().unique(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull().default(""),
  customerPhone: text("customer_phone").notNull().default(""),
  orderType: text("order_type").notNull().default("pickup"),
  deliveryAddress: text("delivery_address"),
  status: text("status").notNull().default("pending"),
  paymentStatus: text("payment_status").notNull().default("pending"),
  paymentMethod: text("payment_method").notNull().default("card"),
  source: text("source").notNull().default("online"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  tax: numeric("tax", { precision: 10, scale: 2 }).notNull(),
  deliveryFee: numeric("delivery_fee", { precision: 10, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  amountTendered: numeric("amount_tendered", { precision: 10, scale: 2 }),
  notes: text("notes"),
  kdsCleared: boolean("kds_cleared").notNull().default(false),
  cancellationReason: text("cancellation_reason"),
  estimatedReadyAt: timestamp("estimated_ready_at", { withTimezone: true }),
  scheduledPickupAt: timestamp("scheduled_pickup_at", { withTimezone: true }),
  waReminderSentAt: timestamp("wa_reminder_sent_at", { withTimezone: true }),
  placetopayRequestId: integer("placetopay_request_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("orders_status_idx").on(t.status),
  index("orders_kds_cleared_idx").on(t.kdsCleared),
  index("orders_created_at_idx").on(t.createdAt),
  index("orders_customer_phone_idx").on(t.customerPhone),
  index("orders_source_idx").on(t.source),
]);

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;

export const orderItemsTable = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  menuItemId: integer("menu_item_id").references(() => menuItemsTable.id, { onDelete: "set null" }),
  menuItemName: text("menu_item_name").notNull(),
  menuItemPrice: numeric("menu_item_price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull(),
  notes: text("notes"),
  modifierSelections: jsonb("modifier_selections").$type<{
    modifierId: string;
    optionId: string;
    name: string;
    price: number;
  }[]>(),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  alreadyMade: boolean("already_made").notNull().default(false),
}, (t) => [
  index("order_items_order_id_idx").on(t.orderId),
]);

export const insertOrderItemSchema = createInsertSchema(orderItemsTable).omit({ id: true });
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItemsTable.$inferSelect;

export const shiftsTable = pgTable("shifts", {
  id: serial("id").primaryKey(),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  openingFloat: numeric("opening_float", { precision: 10, scale: 2 }).notNull().default("0"),
  closingFloat: numeric("closing_float", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type Shift = typeof shiftsTable.$inferSelect;

export const cashTransactionsTable = pgTable("cash_transactions", {
  id: serial("id").primaryKey(),
  shiftId: integer("shift_id").references(() => shiftsTable.id),
  type: text("type").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type CashTransaction = typeof cashTransactionsTable.$inferSelect;

export const refundsTable = pgTable("refunds", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason"),
  refundMethod: text("refund_method").notNull().default("cash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type Refund = typeof refundsTable.$inferSelect;

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  notes: text("notes"),
  visitCount: integer("visit_count").notNull().default(1),
  totalSpent: numeric("total_spent", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export type Customer = typeof customersTable.$inferSelect;

export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull().default("staff"), // "owner" | "staff"
  pinHash: text("pin_hash").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
export type Employee = typeof employeesTable.$inferSelect;

// One row per calendar day — used to store historical daily sales data imported from
// a Loyverse CSV summary export, for dates not covered by individual order records.
export const loyverseDailySummaryTable = pgTable("loyverse_daily_summary", {
  date: date("date").primaryKey(),
  grossSales: numeric("gross_sales", { precision: 10, scale: 2 }).notNull().default("0"),
  refunds: numeric("refunds", { precision: 10, scale: 2 }).notNull().default("0"),
  discounts: numeric("discounts", { precision: 10, scale: 2 }).notNull().default("0"),
  netSales: numeric("net_sales", { precision: 10, scale: 2 }).notNull().default("0"),
});

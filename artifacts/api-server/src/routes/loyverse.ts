import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, menuItemsTable } from "@workspace/db";
import { syncFromLoyverse, pushOrderToLoyverse } from "../lib/loyverse";

const router: IRouter = Router();

// GET /loyverse/sync — pull full menu from Loyverse into local DB
router.post("/loyverse/sync", async (_req, res): Promise<void> => {
  try {
    const result = await syncFromLoyverse();
    res.json({
      success: true,
      categoriesUpserted: result.categoriesUpserted,
      itemsUpserted: result.itemsUpserted,
      itemsSkipped: result.itemsSkipped,
      modifiers: result.modifiers,
      errors: result.errors,
    });
  } catch (err) {
    console.error("Loyverse sync error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// POST /loyverse/push/:orderId — push a specific order as a receipt to Loyverse
router.post("/loyverse/push/:orderId", async (req, res): Promise<void> => {
  const orderId = parseInt(req.params.orderId, 10);
  if (isNaN(orderId)) {
    res.status(400).json({ error: "Invalid order ID" });
    return;
  }

  try {
    const order = await db.query.ordersTable.findFirst({
      where: eq(ordersTable.id, orderId),
    });
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const items = await db
      .select({
        name: orderItemsTable.menuItemName,
        quantity: orderItemsTable.quantity,
        price: orderItemsTable.menuItemPrice,
        loyverseItemId: menuItemsTable.loyverseItemId,
        loyverseVariantId: menuItemsTable.loyverseVariantId,
      })
      .from(orderItemsTable)
      .leftJoin(menuItemsTable, eq(orderItemsTable.menuItemId, menuItemsTable.id))
      .where(eq(orderItemsTable.orderId, orderId));

    const receiptNumber = await pushOrderToLoyverse({
      id: order.id,
      customerName: order.customerName,
      confirmationCode: order.confirmationCode,
      notes: order.notes,
      items: items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        price: parseFloat(i.price as string),
        loyverseItemId: i.loyverseItemId ?? null,
        loyverseVariantId: i.loyverseVariantId ?? null,
      })),
    });

    res.json({ success: true, receiptNumber });
  } catch (err) {
    console.error("Loyverse push error:", err);
    res.status(500).json({ error: String(err) });
  }
});

export default router;

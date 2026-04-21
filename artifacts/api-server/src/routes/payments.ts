import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, ordersTable } from "@workspace/db";
import {
  InitiatePaymentBody,
  ConfirmPaymentBody,
} from "@workspace/api-zod";
import { randomUUID } from "crypto";

const router: IRouter = Router();

router.post("/payments/initiate", async (req, res): Promise<void> => {
  const parsed = InitiatePaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, parsed.data.orderId));

  if (!order) {
    res.status(400).json({ error: "Order not found" });
    return;
  }

  if (order.paymentStatus === "paid") {
    res.status(400).json({ error: "Order already paid" });
    return;
  }

  const sessionId = randomUUID();
  const total = parseFloat(order.total as unknown as string);

  if (parsed.data.paymentMethod === "athmovil") {
    const publicToken = process.env.ATHMOVIL_PUBLIC_TOKEN;
    if (!publicToken) {
      res.json({
        sessionId,
        redirectUrl: null,
        paymentMethod: "athmovil",
        amount: total,
        status: "pending_configuration",
      });
      return;
    }

    res.json({
      sessionId,
      redirectUrl: null,
      paymentMethod: "athmovil",
      amount: total,
      publicToken,
      status: "ready",
    });
  } else if (parsed.data.paymentMethod === "card") {
    const elavonConfigured =
      !!process.env.ELAVON_MERCHANT_ID &&
      !!process.env.ELAVON_USER_ID &&
      !!process.env.ELAVON_PIN;

    if (!elavonConfigured) {
      res.json({
        sessionId,
        redirectUrl: null,
        paymentMethod: "card",
        amount: total,
        status: "pending_configuration",
      });
      return;
    }

    // TODO: Create Elavon Converge HPP session when credentials are configured
    res.json({
      sessionId,
      redirectUrl: null,
      paymentMethod: "card",
      amount: total,
      status: "pending",
    });
  } else {
    res.status(400).json({ error: "Unsupported payment method" });
  }
});

router.post("/payments/athmovil/verify", async (req, res): Promise<void> => {
  const { orderId, referenceNumber } = req.body as { orderId?: unknown; referenceNumber?: unknown };
  if (typeof orderId !== "number" || typeof referenceNumber !== "string" || !referenceNumber) {
    res.status(400).json({ error: "orderId and referenceNumber are required" });
    return;
  }

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId));

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  if (order.paymentStatus === "paid") {
    res.json({ success: true, referenceNumber });
    return;
  }

  const privateToken = process.env.ATHMOVIL_PRIVATE_TOKEN;
  if (!privateToken) {
    res.status(500).json({ error: "ATH Móvil not configured" });
    return;
  }

  let verified = false;
  try {
    const verifyRes = await fetch("https://www.athmovil.com/rs/v3/verifyorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ privateToken, referenceNumber }),
    });

    if (verifyRes.ok) {
      const data = await verifyRes.json() as { status?: string };
      verified = data.status === "COMPLETED";
    }
  } catch {
    // Verification request failed — treat as unverified
    verified = false;
  }

  if (!verified) {
    res.status(400).json({ error: "Payment could not be verified with ATH Móvil" });
    return;
  }

  await db
    .update(ordersTable)
    .set({ paymentStatus: "paid", status: "confirmed" })
    .where(eq(ordersTable.id, order.id));

  res.json({ success: true, referenceNumber });
});

router.post("/payments/athmovil/create-session", async (req, res): Promise<void> => {
  const { orderId } = req.body as { orderId?: unknown };
  if (typeof orderId !== "number") {
    res.status(400).json({ error: "orderId is required" });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  if (order.paymentStatus === "paid") { res.status(400).json({ error: "Already paid" }); return; }

  const publicToken = process.env.ATHMOVIL_PUBLIC_TOKEN;
  if (!publicToken) { res.status(500).json({ error: "ATH Móvil not configured" }); return; }

  const total = parseFloat(order.total as unknown as string);

  try {
    const athRes = await fetch("https://www.athmovil.com/rs/v3/createorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicToken,
        timeout: 600,
        total,
        subtotal: total,
        tax: 0.0,
        metadata1: String(order.id),
        metadata2: order.confirmationCode,
        items: [],
      }),
    });

    if (!athRes.ok) {
      const text = await athRes.text();
      console.error("ATH Móvil createorder error:", athRes.status, text);
      res.status(502).json({ error: "ATH Móvil declined to create session", detail: text });
      return;
    }

    const data = await athRes.json() as { content?: string };
    const sessionToken = data.content;
    if (!sessionToken) {
      res.status(502).json({ error: "ATH Móvil returned no session token" });
      return;
    }

    res.json({
      sessionToken,
      redirectUrl: `https://www.athmovil.com/pay/prod?token=${sessionToken}`,
    });
  } catch (err) {
    console.error("ATH Móvil create-session failed:", err);
    res.status(502).json({ error: "Could not reach ATH Móvil" });
  }
});

router.post("/payments/confirm", async (req, res): Promise<void> => {
  const parsed = ConfirmPaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, parsed.data.orderId));

  if (!order) {
    res.status(400).json({ error: "Order not found" });
    return;
  }

  await db
    .update(ordersTable)
    .set({ paymentStatus: "paid", status: "confirmed" })
    .where(eq(ordersTable.id, order.id));

  res.json({
    success: true,
    orderId: order.id,
    message: "Payment confirmed successfully",
  });
});

export default router;

import { Router, type IRouter, type Request, type Response } from "express";
import { db, storeSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

type DisplayItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  modifiers?: string[];
};

type DisplayState = {
  status: "idle" | "active" | "completed";
  items: DisplayItem[];
  subtotal: number;
  tax: number;
  total: number;
  discountAmount?: number;
  paymentMethod?: string;
  orderCode?: string;
  estimatedReadyAt?: string;
  updatedAt: number;
};

const DISPLAY_KEY = "display_state";

const DEFAULT_STATE: DisplayState = {
  status: "idle",
  items: [],
  subtotal: 0,
  tax: 0,
  total: 0,
  updatedAt: 0,
};

async function getState(): Promise<DisplayState> {
  try {
    const rows = await db
      .select({ value: storeSettingsTable.value })
      .from(storeSettingsTable)
      .where(eq(storeSettingsTable.key, DISPLAY_KEY));
    if (rows.length > 0) return JSON.parse(rows[0].value) as DisplayState;
  } catch {}
  return { ...DEFAULT_STATE };
}

async function saveState(newState: DisplayState): Promise<void> {
  await db
    .insert(storeSettingsTable)
    .values({ key: DISPLAY_KEY, value: JSON.stringify(newState) })
    .onConflictDoUpdate({
      target: storeSettingsTable.key,
      set: { value: JSON.stringify(newState) },
    });
}

function withToken(s: DisplayState): DisplayState & { athmovilPublicToken?: string } {
  const out: DisplayState & { athmovilPublicToken?: string } = { ...s };
  if (s.paymentMethod === "athmovil") {
    out.athmovilPublicToken = process.env["ATHMOVIL_PUBLIC_TOKEN"] ?? undefined;
  }
  return out;
}

// ── SSE clients on THIS process (fast-path broadcast) ────────────────────────
const sseClients = new Set<Response>();

function broadcastToLocal(s: DisplayState): void {
  const payload = `data: ${JSON.stringify(withToken(s))}\n\n`;
  for (const client of sseClients) {
    try { client.write(payload); } catch { sseClients.delete(client); }
  }
}

// GET /display/stream — SSE endpoint for real-time display updates
router.get("/display/stream", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  sseClients.add(res);

  // Send current state immediately on connect (read from DB so cross-instance safe)
  getState().then(s => {
    res.write(`data: ${JSON.stringify(withToken(s))}\n\n`);
  }).catch(() => {});

  // Poll DB every 1 s — catches updates from any server instance
  let lastSeen = 0;
  const dbPoll = setInterval(async () => {
    try {
      const s = await getState();
      if (s.updatedAt !== lastSeen) {
        lastSeen = s.updatedAt;
        try { res.write(`data: ${JSON.stringify(withToken(s))}\n\n`); } catch {}
      }
    } catch {}
  }, 1_000);

  // Heartbeat every 25 s to keep the connection alive through proxies
  const heartbeat = setInterval(() => {
    try { res.write(": ping\n\n"); } catch { clearInterval(heartbeat); }
  }, 25_000);

  req.on("close", () => {
    clearInterval(dbPoll);
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

// GET /display — polling fallback
router.get("/display", async (_req: Request, res: Response) => {
  const s = await getState();
  res.json(withToken(s));
});

// POST /display — POS pushes cart state (no auth required)
router.post("/display", async (req: Request, res: Response) => {
  const body = req.body as Partial<DisplayState>;
  const newState: DisplayState = {
    status: body.status ?? "idle",
    items: body.items ?? [],
    subtotal: body.subtotal ?? 0,
    tax: body.tax ?? 0,
    total: body.total ?? 0,
    discountAmount: body.discountAmount,
    paymentMethod: body.paymentMethod,
    orderCode: body.orderCode,
    estimatedReadyAt: body.estimatedReadyAt,
    updatedAt: Date.now(),
  };

  await saveState(newState);
  // Also push immediately to local SSE clients (same-instance fast path)
  broadcastToLocal(newState);

  res.json({ ok: true });
});

export default router;

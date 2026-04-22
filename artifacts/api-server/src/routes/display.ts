import { Router, type IRouter, type Request, type Response } from "express";

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

let state: DisplayState = {
  status: "idle",
  items: [],
  subtotal: 0,
  tax: 0,
  total: 0,
  updatedAt: Date.now(),
};

// Set of active SSE response objects
const sseClients = new Set<Response>();

function broadcastState() {
  const publicToken = process.env.ATHMOVIL_PUBLIC_TOKEN ?? null;
  const payload: DisplayState & { athmovilPublicToken?: string | null } = { ...state };
  if (state.paymentMethod === "athmovil" && publicToken) {
    payload.athmovilPublicToken = publicToken;
  }
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    try { client.write(data); } catch { sseClients.delete(client); }
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

  // Send current state immediately on connect
  const publicToken = process.env.ATHMOVIL_PUBLIC_TOKEN ?? null;
  const payload: DisplayState & { athmovilPublicToken?: string | null } = { ...state };
  if (state.paymentMethod === "athmovil" && publicToken) {
    payload.athmovilPublicToken = publicToken;
  }
  res.write(`data: ${JSON.stringify(payload)}\n\n`);

  // Heartbeat every 25s to keep the connection alive through proxies
  const heartbeat = setInterval(() => {
    try { res.write(": ping\n\n"); } catch { clearInterval(heartbeat); }
  }, 25_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

// GET /display — legacy polling endpoint (kept for backward compat)
router.get("/display", (_req: Request, res: Response) => {
  const publicToken = process.env.ATHMOVIL_PUBLIC_TOKEN ?? null;
  const response: DisplayState & { athmovilPublicToken?: string | null } = { ...state };
  if (state.paymentMethod === "athmovil" && publicToken) {
    response.athmovilPublicToken = publicToken;
  }
  res.json(response);
});

// POST /display — POS pushes cart state (no auth required so display tablet doesn't need credentials)
router.post("/display", (req: Request, res: Response) => {
  const body = req.body as Partial<DisplayState>;
  state = {
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
  broadcastState();
  res.json({ ok: true });
});

export default router;

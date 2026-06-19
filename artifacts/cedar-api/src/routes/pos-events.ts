import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

const posClients = new Set<Response>();

export function broadcastOrderEvent(type: "order_created" | "order_updated", orderId: number) {
  if (posClients.size === 0) return;
  const data = `data: ${JSON.stringify({ type, orderId, ts: Date.now() })}\n\n`;
  for (const client of posClients) {
    try { client.write(data); } catch { posClients.delete(client); }
  }
}

// GET /pos/events — SSE stream for real-time POS sync across multiple instances
router.get("/pos/events", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  posClients.add(res);
  res.write(`data: ${JSON.stringify({ type: "connected", ts: Date.now() })}\n\n`);

  const heartbeat = setInterval(() => {
    try { res.write(": ping\n\n"); } catch { clearInterval(heartbeat); }
  }, 25_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    posClients.delete(res);
  });
});

export default router;

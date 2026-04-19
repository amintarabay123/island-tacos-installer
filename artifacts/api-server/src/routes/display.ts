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

// GET /display — customer display polls this
router.get("/display", (_req: Request, res: Response) => {
  res.json(state);
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
  res.json({ ok: true });
});

export default router;

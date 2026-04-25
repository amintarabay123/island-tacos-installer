import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import healthRouter from "./health";
import manifestRouter from "./manifest";
import menuRouter from "./menu";
import ordersRouter from "./orders";
import paymentsRouter from "./payments";
import adminRouter from "./admin";
import loyverseRouter from "./loyverse";
import authRouter, { requireStaffAuth, requireAdminAuth } from "./auth";
import webhooksRouter from "./webhooks";
import shiftsRouter from "./shifts";
import reportsRouter from "./reports";
import printRouter, { bridgeScriptContent } from "./print";
import customersRouter from "./customers";
import uploadRouter from "./upload";
import displayRouter from "./display";
import settingsRouter from "./settings";
import employeesRouter from "./employees";
import imageProxyRouter from "./image-proxy";
import syncRouter from "./sync";
import downloadsRouter from "./downloads";
import vapiRouter from "./vapi";

const router: IRouter = Router();

// Auth routes (public)
router.use(authRouter);

// Public download — bridge script (no auth required)
router.get("/print/bridge.js", (_req, res): void => {
  res.setHeader("Content-Type", "application/javascript");
  res.setHeader("Content-Disposition", 'attachment; filename="island-tacos-bridge.js"');
  res.send(bridgeScriptContent());
});

// Public download routes (no auth required)
router.use(downloadsRouter);

// Vapi AI phone ordering routes (public GET /vapi/menu, POST /vapi/order uses own secret auth)
router.use(vapiRouter);

// Public routes (upload requires staff auth; /uploads static serving is public)
router.use(healthRouter);
router.use(manifestRouter);
router.use(menuRouter);
router.use(ordersRouter);
router.use(paymentsRouter);
router.use(webhooksRouter);
router.use(uploadRouter);
router.use(displayRouter);
router.use(imageProxyRouter);
router.use(settingsRouter); // GET is public; PATCH is guarded below
router.use(syncRouter);    // /sync/receive uses own X-Sync-Secret auth; /sync/push is admin-guarded below

// Customer lookup: /customers/lookup is public (for online account page)
// /customers search is staff-accessible (POS autocomplete), /customers/:id notes patch is admin-checked in handler
router.use("/customers/lookup", customersRouter);
router.use(/^\/customers(?!\/(lookup))/, (req: Request, res: Response, next: NextFunction) => {
  requireStaffAuth(req, res, next);
});
router.use(customersRouter);

// Staff-auth required routes (shifts, cash, print)
router.use(/^\/(shifts|cash-transactions|print)/, (req: Request, res: Response, next: NextFunction) => {
  requireStaffAuth(req, res, next);
});
router.use(shiftsRouter);
router.use(printRouter);

// Admin + Loyverse + Settings PATCH + Sync push/export: owner only
router.use(/^\/(admin|loyverse|reports|employees)/, (req: Request, res: Response, next: NextFunction) => {
  requireAdminAuth(req, res, next);
});
router.use("/sync/push",   (req: Request, res: Response, next: NextFunction) => requireAdminAuth(req, res, next));
router.use("/sync/export", (req: Request, res: Response, next: NextFunction) => requireAdminAuth(req, res, next));
router.use("/settings", (req: Request, res: Response, next: NextFunction) => {
  if (req.method === "PATCH") return requireAdminAuth(req, res, next);
  next();
});

router.use(adminRouter);
router.use(loyverseRouter);
router.use(reportsRouter);
router.use(employeesRouter);

export default router;

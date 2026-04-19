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
import printRouter from "./print";
import customersRouter from "./customers";
import uploadRouter from "./upload";

const router: IRouter = Router();

// Auth routes (public)
router.use(authRouter);

// Public routes (upload requires staff auth; /uploads static serving is public)
router.use(healthRouter);
router.use(manifestRouter);
router.use(menuRouter);
router.use(ordersRouter);
router.use(paymentsRouter);
router.use(webhooksRouter);
router.use(uploadRouter);

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

// Admin + Loyverse: owner only
router.use(/^\/(admin|loyverse|reports)/, (req: Request, res: Response, next: NextFunction) => {
  requireAdminAuth(req, res, next);
});

router.use(adminRouter);
router.use(loyverseRouter);
router.use(reportsRouter);

export default router;

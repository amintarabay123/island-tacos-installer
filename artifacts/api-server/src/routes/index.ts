import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import healthRouter from "./health";
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

const router: IRouter = Router();

// Auth routes (public)
router.use(authRouter);

// Public routes
router.use(healthRouter);
router.use(menuRouter);
router.use(ordersRouter);
router.use(paymentsRouter);
router.use(webhooksRouter);

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

import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import healthRouter from "./health";
import menuRouter from "./menu";
import ordersRouter from "./orders";
import paymentsRouter from "./payments";
import adminRouter from "./admin";
import loyverseRouter from "./loyverse";
import authRouter, { requireStaffAuth } from "./auth";
import webhooksRouter from "./webhooks";

const router: IRouter = Router();

// Auth routes (public)
router.use(authRouter);

// Public routes
router.use(healthRouter);
router.use(menuRouter);
router.use(ordersRouter);
router.use(paymentsRouter);
router.use(webhooksRouter);

// Protect admin + loyverse paths
router.use(/^\/(admin|loyverse)/, (req: Request, res: Response, next: NextFunction) => {
  requireStaffAuth(req, res, next);
});

router.use(adminRouter);
router.use(loyverseRouter);

export default router;

import { Router, type IRouter } from "express";
import healthRouter from "./health";
import menuRouter from "./menu";
import ordersRouter from "./orders";
import paymentsRouter from "./payments";
import adminRouter from "./admin";
import loyverseRouter from "./loyverse";

const router: IRouter = Router();

router.use(healthRouter);
router.use(menuRouter);
router.use(ordersRouter);
router.use(paymentsRouter);
router.use(adminRouter);
router.use(loyverseRouter);

export default router;

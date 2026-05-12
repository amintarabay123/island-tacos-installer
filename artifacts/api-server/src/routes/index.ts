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
import posEventsRouter from "./pos-events";
import settingsRouter from "./settings";
import storeSettingsRouter from "./store-settings";
import employeesRouter from "./employees";
import imageProxyRouter from "./image-proxy";
import syncRouter from "./sync";
import downloadsRouter from "./downloads";
import financialsRouter from "./financials";
import customsRouter from "./customs";
import whatsappRouter from "./whatsapp";

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

// ── Per-route auth gates that must run BEFORE the corresponding routers below.
// Order matters: express middleware runs in registration order, so any gate that
// protects routes inside a router must be `router.use(...)`'d before that router.
//
// Path normalization is critical: express by default has both `case sensitive
// routing` and `strict routing` OFF, so `/MENU/items`, `/menu/items/`, and
// `/menu/items` all hit the same handler. If we compared raw `req.path` we'd
// gate the canonical form but let the case/trailing-slash variants slip past.
// `normalizePath` mirrors express's matching: lowercase + drop trailing slash
// (but keep "/").
function normalizePath(p: string): string {
  const lower = p.toLowerCase();
  if (lower.length > 1 && lower.endsWith("/")) return lower.slice(0, -1);
  return lower;
}

router.use((req: Request, res: Response, next: NextFunction) => {
  const path = normalizePath(req.path);
  const isMutation = req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS";

  // /menu/*: GETs are public for the storefront, but every mutation (and the
  // staff-only /menu/soldout list which leaks every item id) requires staff
  // auth. Closes the long-standing gap where anyone on the internet could
  // POST/PATCH/DELETE menu items, categories, modifiers, soldout toggles, and
  // reorders.
  if (path === "/menu" || path.startsWith("/menu/")) {
    const isSoldoutRead = path.startsWith("/menu/soldout") && !isMutation;
    if (isMutation || isSoldoutRead) return requireStaffAuth(req, res, next);
    return next();
  }

  // /upload (POST) and /storage/uploads/request-url (POST): both create GCS
  // objects using the shop's storage quota. Staff only. The matching GETs that
  // serve uploaded images stay public so the storefront can render menu
  // photos.
  if (isMutation && (path === "/upload" || path === "/storage/uploads/request-url")) {
    return requireStaffAuth(req, res, next);
  }

  // /display (POST) is the POS pushing cart state to the customer-facing
  // display. GET stays public so the display device can poll/SSE without a
  // session.
  if (path === "/display" && req.method === "POST") {
    return requireStaffAuth(req, res, next);
  }

  // /pos/events SSE leaks order events to anyone listening. POS-only.
  if (path === "/pos/events") return requireStaffAuth(req, res, next);

  // /admin/uploaded-images is defined inside uploadRouter (which is mounted
  // BEFORE the /admin/* admin guard further down), so the existing /admin/*
  // prefix middleware never sees it. Gate it explicitly here. Owner-only —
  // it lists every uploaded image across the store.
  if (path === "/admin/uploaded-images" || path.startsWith("/admin/uploaded-images/")) {
    return requireAdminAuth(req, res, next);
  }

  return next();
});

// Public routes (upload requires staff auth; /uploads static serving is public)
router.use(healthRouter);
router.use(manifestRouter);
router.use(menuRouter);
router.use(ordersRouter);
router.use(paymentsRouter);
router.use(webhooksRouter);
router.use(whatsappRouter);
router.use(uploadRouter);
router.use(displayRouter);
router.use(posEventsRouter);
router.use(imageProxyRouter);
router.use(settingsRouter); // GET is public; PATCH is guarded below
router.use(storeSettingsRouter); // GET is public; PATCH is guarded below
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
router.use(/^\/(admin|loyverse|reports|employees|financials)/, (req: Request, res: Response, next: NextFunction) => {
  requireAdminAuth(req, res, next);
});
router.use("/sync/push",   (req: Request, res: Response, next: NextFunction) => requireAdminAuth(req, res, next));
router.use("/sync/export", (req: Request, res: Response, next: NextFunction) => requireAdminAuth(req, res, next));
router.use("/settings", (req: Request, res: Response, next: NextFunction) => {
  if (req.method === "PATCH") return requireAdminAuth(req, res, next);
  next();
});
router.use("/store-settings", (req: Request, res: Response, next: NextFunction) => {
  if (req.method === "PATCH") return requireAdminAuth(req, res, next);
  next();
});

router.use(adminRouter);
router.use(loyverseRouter);
router.use(reportsRouter);
router.use(employeesRouter);
router.use(financialsRouter);

// Customs invoice extraction (admin only — uses OpenAI API key)
router.use("/customs", (req: Request, res: Response, next: NextFunction) => requireAdminAuth(req, res, next));
router.use(customsRouter);

export default router;

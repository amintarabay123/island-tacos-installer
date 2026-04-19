import { Router, type IRouter, type Request, type Response } from "express";
import {
  createToken,
  makeSetCookieHeader,
  makeClearCookieHeader,
  getTokenFromRequest,
} from "../lib/auth-token";

const router: IRouter = Router();

const STAFF_PIN = process.env["STAFF_PIN"];
const ADMIN_PIN = process.env["ADMIN_PIN"];

router.post("/auth/login", (req: Request, res: Response): void => {
  const { pin } = req.body as { pin?: string };

  if (!pin) {
    res.status(401).json({ error: "PIN required" });
    return;
  }

  // If ADMIN_PIN is configured, it grants full admin access
  if (ADMIN_PIN && pin === ADMIN_PIN) {
    const token = createToken("admin");
    res.setHeader("Set-Cookie", makeSetCookieHeader(token));
    res.json({ ok: true, role: "admin" });
    return;
  }

  if (STAFF_PIN && pin === STAFF_PIN) {
    // If no separate ADMIN_PIN is set, STAFF_PIN grants admin (backwards-compatible)
    const role = ADMIN_PIN ? "staff" : "admin";
    const token = createToken(role);
    res.setHeader("Set-Cookie", makeSetCookieHeader(token));
    res.json({ ok: true, role });
    return;
  }

  res.status(401).json({ error: "Incorrect PIN" });
});

router.post("/auth/logout", (req: Request, res: Response): void => {
  res.setHeader("Set-Cookie", makeClearCookieHeader());
  res.json({ ok: true });
});

router.get("/auth/me", (req: Request, res: Response): void => {
  const data = getTokenFromRequest(req.headers.cookie);
  if (!data?.staffAuthed) {
    res.json({ authed: false, role: null });
    return;
  }
  res.json({ authed: true, role: data.role ?? "staff" });
});

export function requireStaffAuth(req: Request, res: Response, next: () => void): void {
  const data = getTokenFromRequest(req.headers.cookie);
  if (data?.staffAuthed !== true) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

export function requireAdminAuth(req: Request, res: Response, next: () => void): void {
  const data = getTokenFromRequest(req.headers.cookie);
  if (data?.staffAuthed !== true || data.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

export default router;

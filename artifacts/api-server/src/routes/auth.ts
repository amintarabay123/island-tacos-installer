import { Router, type IRouter, type Request, type Response } from "express";
import {
  createToken,
  makeSetCookieHeader,
  makeClearCookieHeader,
  getTokenFromRequest,
} from "../lib/auth-token";

const router: IRouter = Router();

router.post("/auth/login", (req: Request, res: Response): void => {
  const { pin } = req.body as { pin?: string };

  if (!pin) {
    res.status(401).json({ error: "PIN required" });
    return;
  }

  // Read at request time so secrets are always current
  const staffPin = process.env["STAFF_PIN"];
  const adminPin = process.env["ADMIN_PIN"];

  if (!staffPin && !adminPin) {
    res.status(503).json({ error: "No PIN configured on server." });
    return;
  }

  // ADMIN_PIN (if set) grants owner access
  if (adminPin && pin === adminPin) {
    const token = createToken("admin");
    res.setHeader("Set-Cookie", makeSetCookieHeader(token));
    res.json({ ok: true, role: "admin" });
    return;
  }

  // STAFF_PIN: if no ADMIN_PIN set, it grants admin (backwards-compatible)
  if (staffPin && pin === staffPin) {
    const role = adminPin ? "staff" : "admin";
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
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
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

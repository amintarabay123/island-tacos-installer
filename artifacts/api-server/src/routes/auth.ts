import { Router, type IRouter, type Request, type Response } from "express";
import {
  createToken,
  makeSetCookieHeader,
  makeClearCookieHeader,
  getTokenFromRequest,
  verifyTokenFromString,
} from "../lib/auth-token";
import { verifyPin } from "./employees";

const router: IRouter = Router();

router.post("/auth/login", async (req: Request, res: Response): Promise<void> => {
  const { pin } = req.body as { pin?: string };

  if (!pin) {
    res.status(401).json({ error: "PIN required" });
    return;
  }

  // Check against employee database (seeds from env vars on first run)
  const result = await verifyPin(pin);
  if (result) {
    const token = createToken(result.role === "owner" ? "admin" : "staff");
    res.setHeader("Set-Cookie", makeSetCookieHeader(token));
    res.json({ ok: true, role: result.role, name: result.name, token });
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

  // Accept Bearer token from Authorization header (localStorage-based auth)
  // or fall back to cookie-based auth
  let data = null;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    data = token ? verifyTokenFromString(token) : null;
  }
  if (!data) {
    data = getTokenFromRequest(req.headers.cookie);
  }

  if (!data?.staffAuthed) {
    res.json({ authed: false, role: null });
    return;
  }
  res.json({ authed: true, role: data.role ?? "staff" });
});

function getAuthData(req: Request) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const data = token ? verifyTokenFromString(token) : null;
    if (data) return data;
  }
  return getTokenFromRequest(req.headers.cookie);
}

export function requireStaffAuth(req: Request, res: Response, next: () => void): void {
  const data = getAuthData(req);
  if (data?.staffAuthed !== true) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

export function requireAdminAuth(req: Request, res: Response, next: () => void): void {
  const data = getAuthData(req);
  if (data?.staffAuthed !== true || data.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

export default router;

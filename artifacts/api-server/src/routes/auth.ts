import { Router, type IRouter, type Request, type Response } from "express";
import {
  createToken,
  makeSetCookieHeader,
  makeClearCookieHeader,
  getTokenFromRequest,
} from "../lib/auth-token";

const router: IRouter = Router();

const STAFF_PIN = process.env["STAFF_PIN"];

router.post("/auth/login", (req: Request, res: Response): void => {
  const { pin } = req.body as { pin?: string };

  if (!STAFF_PIN) {
    res.status(503).json({ error: "STAFF_PIN not configured on the server." });
    return;
  }

  if (!pin || pin !== STAFF_PIN) {
    res.status(401).json({ error: "Incorrect PIN" });
    return;
  }

  const token = createToken();
  res.setHeader("Set-Cookie", makeSetCookieHeader(token));
  res.json({ ok: true });
});

router.post("/auth/logout", (req: Request, res: Response): void => {
  res.setHeader("Set-Cookie", makeClearCookieHeader());
  res.json({ ok: true });
});

router.get("/auth/me", (req: Request, res: Response): void => {
  const data = getTokenFromRequest(req.headers.cookie);
  res.json({ authed: data?.staffAuthed === true });
});

export function requireStaffAuth(req: Request, res: Response, next: () => void): void {
  const data = getTokenFromRequest(req.headers.cookie);
  if (data?.staffAuthed !== true) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

export default router;

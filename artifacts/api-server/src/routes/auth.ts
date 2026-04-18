import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

const STAFF_PIN = process.env["STAFF_PIN"];

router.post("/auth/login", (req: Request, res: Response): void => {
  const { pin } = req.body as { pin?: string };
  if (!STAFF_PIN) {
    res.status(503).json({ error: "STAFF_PIN not configured. Set the STAFF_PIN environment variable." });
    return;
  }
  if (!pin || pin !== STAFF_PIN) {
    res.status(401).json({ error: "Incorrect PIN" });
    return;
  }
  if (req.session) {
    req.session["staffAuthed"] = true;
  }
  res.json({ ok: true });
});

router.post("/auth/logout", (req: Request, res: Response): void => {
  req.session = null;
  res.json({ ok: true });
});

router.get("/auth/me", (req: Request, res: Response): void => {
  res.json({ authed: req.session?.["staffAuthed"] === true });
});

export function requireStaffAuth(req: Request, res: Response, next: () => void): void {
  if (req.session?.["staffAuthed"] !== true) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

export default router;

import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.get("/financials/drafts", async (_req, res): Promise<void> => {
  const result = await pool.query(
    `SELECT id, period_start::text, period_end::text,
            data->>'businessName' AS business_name,
            updated_at
     FROM financial_statement_drafts
     ORDER BY updated_at DESC`
  );
  res.json(result.rows);
});

router.get("/financials/drafts/:id", async (req, res): Promise<void> => {
  const result = await pool.query(
    "SELECT id, period_start::text, period_end::text, data, created_at, updated_at FROM financial_statement_drafts WHERE id = $1",
    [req.params.id]
  );
  if (result.rows.length === 0) { res.status(404).json({ error: "Not found" }); return; }
  res.json(result.rows[0]);
});

router.post("/financials/drafts", async (req, res): Promise<void> => {
  const { period_start, period_end, data } = req.body;
  const result = await pool.query(
    `INSERT INTO financial_statement_drafts (period_start, period_end, data)
     VALUES ($1, $2, $3) RETURNING id, period_start::text, period_end::text, data, created_at, updated_at`,
    [period_start, period_end, JSON.stringify(data ?? {})]
  );
  res.json(result.rows[0]);
});

router.put("/financials/drafts/:id", async (req, res): Promise<void> => {
  const { period_start, period_end, data } = req.body;
  const result = await pool.query(
    `UPDATE financial_statement_drafts
     SET period_start = $1, period_end = $2, data = $3, updated_at = NOW()
     WHERE id = $4
     RETURNING id, period_start::text, period_end::text, data, created_at, updated_at`,
    [period_start, period_end, JSON.stringify(data), req.params.id]
  );
  if (result.rows.length === 0) { res.status(404).json({ error: "Not found" }); return; }
  res.json(result.rows[0]);
});

router.delete("/financials/drafts/:id", async (req, res): Promise<void> => {
  await pool.query("DELETE FROM financial_statement_drafts WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

export default router;

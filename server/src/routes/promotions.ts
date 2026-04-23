import { Router, Request, Response, NextFunction, RequestHandler } from "express";
import { z } from "zod";
import { pool } from "../db/pool";

export const promotionsRouter = Router();

type AsyncFn = (req: Request, res: Response) => Promise<void>;
const wrap = (fn: AsyncFn): RequestHandler =>
  (req, res, next: NextFunction) => fn(req, res).catch(next);

const schema = z.object({
  name:            z.string().min(1).max(200),
  description:     z.string().max(2000).optional().nullable(),
  discountPercent: z.number().min(0).max(100).optional().nullable(),
  discountAmount:  z.number().min(0).optional().nullable(),
  validFrom:       z.string().datetime(),
  validUntil:      z.string().datetime(),
  active:          z.boolean().optional(),
});

function toDto(r: Record<string, unknown>) {
  return {
    id:              r.id,
    name:            r.name,
    description:     r.description ?? null,
    discountPercent: r.discount_percent ? parseFloat(r.discount_percent as string) : null,
    discountAmount:  r.discount_amount  ? parseFloat(r.discount_amount as string)  : null,
    validFrom:       r.valid_from,
    validUntil:      r.valid_until,
    active:          r.active,
    createdAt:       r.created_at,
    updatedAt:       r.updated_at,
  };
}

promotionsRouter.get("/", wrap(async (_req, res) => {
  const { rows } = await pool.query("SELECT * FROM promotions ORDER BY valid_until DESC");
  res.json(rows.map(toDto));
}));

promotionsRouter.get("/:id", wrap(async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM promotions WHERE id = $1", [req.params.id]);
  if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toDto(rows[0]));
}));

promotionsRouter.post("/", wrap(async (req, res) => {
  const p = schema.safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.flatten() }); return; }
  const { name, description, discountPercent, discountAmount, validFrom, validUntil, active } = p.data;
  const { rows } = await pool.query(
    `INSERT INTO promotions
       (name, description, discount_percent, discount_amount, valid_from, valid_until, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [name, description ?? null, discountPercent ?? null, discountAmount ?? null,
     validFrom, validUntil, active ?? true]
  );
  res.status(201).json(toDto(rows[0]));
}));

promotionsRouter.patch("/:id", wrap(async (req, res) => {
  const p = schema.partial().safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.flatten() }); return; }
  const colMap: Record<string, string> = {
    name: "name", description: "description",
    discountPercent: "discount_percent", discountAmount: "discount_amount",
    validFrom: "valid_from", validUntil: "valid_until", active: "active",
  };
  const fields: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const [k, col] of Object.entries(colMap)) {
    const v = (p.data as Record<string, unknown>)[k];
    if (v !== undefined) { fields.push(`${col} = $${i++}`); vals.push(v); }
  }
  if (!fields.length) { res.status(400).json({ error: "No fields to update" }); return; }
  fields.push("updated_at = NOW()");
  vals.push(req.params.id);
  const { rows } = await pool.query(
    `UPDATE promotions SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
    vals
  );
  if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toDto(rows[0]));
}));

promotionsRouter.delete("/:id", wrap(async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM promotions WHERE id = $1", [req.params.id]);
  if (!rowCount) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).end();
}));

import { Router, Request, Response, NextFunction, RequestHandler } from "express";
import { z } from "zod";
import { pool } from "../db/pool";

export const packagesRouter = Router();

type AsyncFn = (req: Request, res: Response) => Promise<void>;
const wrap = (fn: AsyncFn): RequestHandler =>
  (req, res, next: NextFunction) => fn(req, res).catch(next);

const schema = z.object({
  name:         z.string().min(1).max(100),
  description:  z.string().max(2000).optional().nullable(),
  price:        z.number().min(0),
  durationDays: z.number().int().min(1),
  features:     z.array(z.string()).optional().nullable(),
  active:       z.boolean().optional(),
});

function toDto(r: Record<string, unknown>) {
  return {
    id:           r.id,
    name:         r.name,
    description:  r.description ?? null,
    price:        parseFloat(r.price as string),
    durationDays: r.duration_days,
    features:     (r.features as string[]) ?? [],
    active:       r.active,
    createdAt:    r.created_at,
    updatedAt:    r.updated_at,
  };
}

packagesRouter.get("/", wrap(async (_req, res) => {
  const { rows } = await pool.query("SELECT * FROM packages ORDER BY price ASC");
  res.json(rows.map(toDto));
}));

packagesRouter.get("/:id", wrap(async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM packages WHERE id = $1", [req.params.id]);
  if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toDto(rows[0]));
}));

packagesRouter.post("/", wrap(async (req, res) => {
  const p = schema.safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.flatten() }); return; }
  const { name, description, price, durationDays, features, active } = p.data;
  const { rows } = await pool.query(
    `INSERT INTO packages (name, description, price, duration_days, features, active)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [name, description ?? null, price, durationDays, features ?? null, active ?? true]
  );
  res.status(201).json(toDto(rows[0]));
}));

packagesRouter.patch("/:id", wrap(async (req, res) => {
  const p = schema.partial().safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.flatten() }); return; }
  const colMap: Record<string, string> = {
    name: "name", description: "description", price: "price",
    durationDays: "duration_days", features: "features", active: "active",
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
    `UPDATE packages SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
    vals
  );
  if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toDto(rows[0]));
}));

packagesRouter.delete("/:id", wrap(async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM packages WHERE id = $1", [req.params.id]);
  if (!rowCount) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).end();
}));

import { Router, Request, Response, NextFunction, RequestHandler } from "express";
import { z } from "zod";
import { pool } from "../db/pool";

export const companiesRouter = Router();

type AsyncFn = (req: Request, res: Response) => Promise<void>;
const wrap = (fn: AsyncFn): RequestHandler =>
  (req, res, next: NextFunction) => fn(req, res).catch(next);

const schema = z.object({
  name:    z.string().min(1).max(200),
  email:   z.string().email().optional().nullable(),
  phone:   z.string().max(50).optional().nullable(),
  address: z.string().max(1000).optional().nullable(),
});

function toDto(r: Record<string, unknown>) {
  return {
    id:            r.id,
    name:          r.name,
    email:         r.email ?? null,
    phone:         r.phone ?? null,
    address:       r.address ?? null,
    customerCount: r.customer_count ?? 0,
    createdAt:     r.created_at,
    updatedAt:     r.updated_at,
  };
}

companiesRouter.get("/", wrap(async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT c.*, COUNT(cu.id)::int AS customer_count
    FROM companies c
    LEFT JOIN customers cu ON cu.company_id = c.id
    GROUP BY c.id
    ORDER BY c.name ASC
  `);
  res.json(rows.map(toDto));
}));

companiesRouter.get("/:id", wrap(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.*, COUNT(cu.id)::int AS customer_count
     FROM companies c
     LEFT JOIN customers cu ON cu.company_id = c.id
     WHERE c.id = $1
     GROUP BY c.id`,
    [req.params.id]
  );
  if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toDto(rows[0]));
}));

companiesRouter.post("/", wrap(async (req, res) => {
  const p = schema.safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.flatten() }); return; }
  const { name, email, phone, address } = p.data;
  const { rows } = await pool.query(
    `INSERT INTO companies (name, email, phone, address)
     VALUES ($1,$2,$3,$4) RETURNING *, 0 AS customer_count`,
    [name, email ?? null, phone ?? null, address ?? null]
  );
  res.status(201).json(toDto(rows[0]));
}));

companiesRouter.patch("/:id", wrap(async (req, res) => {
  const p = schema.partial().safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.flatten() }); return; }
  const colMap: Record<string, string> = {
    name: "name", email: "email", phone: "phone", address: "address",
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
    `UPDATE companies SET ${fields.join(", ")} WHERE id = $${i} RETURNING *, 0 AS customer_count`,
    vals
  );
  if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toDto(rows[0]));
}));

companiesRouter.delete("/:id", wrap(async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM companies WHERE id = $1", [req.params.id]);
  if (!rowCount) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).end();
}));

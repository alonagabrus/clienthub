import { Router, Request, Response, NextFunction, RequestHandler } from "express";
import { z } from "zod";
import { pool } from "../db/pool";

export const customerPackagesRouter = Router();

type AsyncFn = (req: Request, res: Response) => Promise<void>;
const wrap = (fn: AsyncFn): RequestHandler =>
  (req, res, next: NextFunction) => fn(req, res).catch(next);

const schema = z.object({
  customerId:  z.number().int(),
  packageId:   z.number().int(),
  promotionId: z.number().int().optional().nullable(),
  joinedAt:    z.string().datetime().optional(),
  expiresAt:   z.string().datetime(),
  pricePaid:   z.number().min(0).optional().nullable(),
  status:      z.enum(["active", "expired", "cancelled"]).optional(),
});

const RICH_QUERY = `
  SELECT
    cp.*,
    c.first_name, c.last_name, c.email,
    p.name  AS package_name,
    prom.name AS promotion_name
  FROM customer_packages cp
  JOIN customers  c    ON c.id    = cp.customer_id
  JOIN packages   p    ON p.id    = cp.package_id
  LEFT JOIN promotions prom ON prom.id = cp.promotion_id
`;

function toDto(r: Record<string, unknown>) {
  return {
    id:            r.id,
    customerId:    r.customer_id,
    customerName:  `${r.first_name} ${r.last_name}`,
    customerEmail: r.email,
    packageId:     r.package_id,
    packageName:   r.package_name,
    promotionId:   r.promotion_id ?? null,
    promotionName: r.promotion_name ?? null,
    joinedAt:      r.joined_at,
    expiresAt:     r.expires_at,
    pricePaid:     r.price_paid ? parseFloat(r.price_paid as string) : null,
    status:        r.status,
    createdAt:     r.created_at,
    updatedAt:     r.updated_at,
  };
}

// Auto-expire: mark past-due active packages as 'expired'
async function autoExpire() {
  await pool.query(`
    UPDATE customer_packages
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'active' AND expires_at < NOW()
  `);
}

customerPackagesRouter.get("/", wrap(async (req, res) => {
  await autoExpire();
  const { customerId, status } = req.query as Record<string, string>;
  let where = "WHERE 1=1";
  const vals: unknown[] = [];
  let i = 1;
  if (customerId) { where += ` AND cp.customer_id = $${i++}`; vals.push(Number(customerId)); }
  if (status)     { where += ` AND cp.status = $${i++}`;      vals.push(status); }
  const { rows } = await pool.query(
    `${RICH_QUERY} ${where} ORDER BY cp.expires_at DESC`,
    vals
  );
  res.json(rows.map(toDto));
}));

// GET /api/customer-packages/expiring?days=7
customerPackagesRouter.get("/expiring", wrap(async (req, res) => {
  await autoExpire();
  const days = Number(req.query.days ?? 7);
  const { rows } = await pool.query(
    `${RICH_QUERY}
     WHERE cp.status = 'active'
       AND cp.expires_at BETWEEN NOW() AND NOW() + ($1 || ' days')::interval
     ORDER BY cp.expires_at ASC`,
    [days]
  );
  res.json(rows.map(toDto));
}));

customerPackagesRouter.post("/", wrap(async (req, res) => {
  const p = schema.safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.flatten() }); return; }
  const { customerId, packageId, promotionId, joinedAt, expiresAt, pricePaid } = p.data;
  const { rows } = await pool.query(
    `INSERT INTO customer_packages
       (customer_id, package_id, promotion_id, joined_at, expires_at, price_paid, status)
     VALUES ($1,$2,$3,$4,$5,$6,'active') RETURNING id`,
    [customerId, packageId, promotionId ?? null,
     joinedAt ?? new Date().toISOString(), expiresAt, pricePaid ?? null]
  );
  const { rows: full } = await pool.query(`${RICH_QUERY} WHERE cp.id = $1`, [rows[0].id]);
  res.status(201).json(toDto(full[0]));
}));

customerPackagesRouter.patch("/:id", wrap(async (req, res) => {
  const p = schema.partial().safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.flatten() }); return; }
  const colMap: Record<string, string> = {
    packageId: "package_id", promotionId: "promotion_id",
    joinedAt: "joined_at", expiresAt: "expires_at",
    pricePaid: "price_paid", status: "status",
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
  const { rowCount } = await pool.query(
    `UPDATE customer_packages SET ${fields.join(", ")} WHERE id = $${i}`,
    vals
  );
  if (!rowCount) { res.status(404).json({ error: "Not found" }); return; }
  const { rows } = await pool.query(`${RICH_QUERY} WHERE cp.id = $1`, [req.params.id]);
  res.json(toDto(rows[0]));
}));

customerPackagesRouter.delete("/:id", wrap(async (req, res) => {
  const { rowCount } = await pool.query(
    "DELETE FROM customer_packages WHERE id = $1", [req.params.id]
  );
  if (!rowCount) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).end();
}));

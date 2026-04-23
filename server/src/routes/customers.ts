import { Router, Request, Response, NextFunction, RequestHandler } from "express";
import { z } from "zod";
import { pool } from "../db/pool";

export const customersRouter = Router();

type AsyncFn = (req: Request, res: Response) => Promise<void>;
const wrap = (fn: AsyncFn): RequestHandler =>
  (req, res, next: NextFunction) => fn(req, res).catch(next);

const customerSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName:  z.string().min(1).max(100),
  email:     z.string().email().max(200),
  phone:     z.string().max(50).optional().nullable(),
  companyId: z.number().int().optional().nullable(),
  status:    z.enum(["active", "inactive", "churned"]).optional(),
  notes:     z.string().max(2000).optional().nullable(),
  packageAssignment: z.object({
    packageId:   z.number().int(),
    promotionId: z.number().int().optional().nullable(),
    joinedAt:    z.string().datetime().optional(),
    expiresAt:   z.string().datetime(),
    pricePaid:   z.number().min(0).optional().nullable(),
  }).optional().nullable(),
});

const CUSTOMER_LIST_QUERY = `
  SELECT
    c.id, c.first_name, c.last_name, c.email, c.phone,
    c.status, c.notes, c.company_id, c.created_at, c.updated_at,
    comp.name                                   AS company_name,
    cp.id                                       AS cp_id,
    cp.package_id,
    cp.joined_at,
    cp.expires_at,
    cp.price_paid,
    cp.status                                   AS cp_status,
    cp.promotion_id,
    p.name                                      AS package_name,
    prom.name                                   AS promotion_name
  FROM customers c
  LEFT JOIN companies comp ON c.company_id = comp.id
  LEFT JOIN LATERAL (
    SELECT * FROM customer_packages
    WHERE customer_id = c.id AND status = 'active'
    ORDER BY expires_at DESC LIMIT 1
  ) cp ON TRUE
  LEFT JOIN packages  p    ON cp.package_id   = p.id
  LEFT JOIN promotions prom ON cp.promotion_id = prom.id
`;

function toDto(r: Record<string, unknown>) {
  return {
    id:            r.id,
    firstName:     r.first_name,
    lastName:      r.last_name,
    email:         r.email,
    phone:         r.phone ?? null,
    status:        r.status,
    notes:         r.notes ?? null,
    companyId:     r.company_id ?? null,
    companyName:   r.company_name ?? null,
    createdAt:     r.created_at,
    updatedAt:     r.updated_at,
    cpId:          r.cp_id ?? null,
    packageId:     r.package_id ?? null,
    packageName:   r.package_name ?? null,
    joinedAt:      r.joined_at ?? null,
    expiresAt:     r.expires_at ?? null,
    cpStatus:      r.cp_status ?? null,
    pricePaid:     r.price_paid ? parseFloat(r.price_paid as string) : null,
    promotionId:   r.promotion_id ?? null,
    promotionName: r.promotion_name ?? null,
  };
}

customersRouter.get("/", wrap(async (req, res) => {
  const { status, search, companyId } = req.query as Record<string, string>;
  let where = "WHERE 1=1";
  const vals: unknown[] = [];
  let i = 1;
  if (status)    { where += ` AND c.status = $${i++}`;                                                    vals.push(status); }
  if (companyId) { where += ` AND c.company_id = $${i++}`;                                                vals.push(Number(companyId)); }
  if (search)    { where += ` AND (c.first_name ILIKE $${i} OR c.last_name ILIKE $${i} OR c.email ILIKE $${i})`; vals.push(`%${search}%`); i++; }
  const { rows } = await pool.query(
    `${CUSTOMER_LIST_QUERY} ${where} ORDER BY c.created_at DESC`,
    vals
  );
  res.json(rows.map(toDto));
}));

customersRouter.get("/:id", wrap(async (req, res) => {
  const { rows } = await pool.query(
    `${CUSTOMER_LIST_QUERY} WHERE c.id = $1`,
    [req.params.id]
  );
  if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toDto(rows[0]));
}));

customersRouter.post("/", wrap(async (req, res) => {
  const p = customerSchema.safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.flatten() }); return; }
  const { firstName, lastName, email, phone, companyId, status, notes, packageAssignment } = p.data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `INSERT INTO customers (first_name, last_name, email, phone, company_id, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [firstName, lastName, email, phone ?? null, companyId ?? null,
       status ?? "active", notes ?? null]
    );
    const customer = rows[0] as Record<string, unknown>;

    if (packageAssignment) {
      const { packageId, promotionId, joinedAt, expiresAt, pricePaid } = packageAssignment;
      await client.query(
        `INSERT INTO customer_packages
           (customer_id, package_id, promotion_id, joined_at, expires_at, price_paid, status)
         VALUES ($1,$2,$3,$4,$5,$6,'active')`,
        [customer.id, packageId, promotionId ?? null,
         joinedAt ?? new Date().toISOString(), expiresAt, pricePaid ?? null]
      );
    }

    await client.query("COMMIT");

    const { rows: full } = await pool.query(
      `${CUSTOMER_LIST_QUERY} WHERE c.id = $1`,
      [customer.id]
    );
    res.status(201).json(toDto(full[0]));
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}));

customersRouter.patch("/:id", wrap(async (req, res) => {
  const p = customerSchema.omit({ packageAssignment: true }).partial().safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.flatten() }); return; }
  const colMap: Record<string, string> = {
    firstName: "first_name", lastName: "last_name", email: "email",
    phone: "phone", companyId: "company_id", status: "status", notes: "notes",
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
    `UPDATE customers SET ${fields.join(", ")} WHERE id = $${i}`,
    vals
  );
  if (!rowCount) { res.status(404).json({ error: "Not found" }); return; }
  const { rows } = await pool.query(`${CUSTOMER_LIST_QUERY} WHERE c.id = $1`, [req.params.id]);
  res.json(toDto(rows[0]));
}));

customersRouter.delete("/:id", wrap(async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM customers WHERE id = $1", [req.params.id]);
  if (!rowCount) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).end();
}));

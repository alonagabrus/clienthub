import { Router, Request, Response, NextFunction, RequestHandler } from "express";
import { pool } from "../db/pool";

export const statsRouter = Router();

type AsyncFn = (req: Request, res: Response) => Promise<void>;
const wrap = (fn: AsyncFn): RequestHandler =>
  (req, res, next: NextFunction) => fn(req, res).catch(next);

statsRouter.get("/", wrap(async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int  FROM customers)                                                                    AS total_customers,
      (SELECT COUNT(*)::int  FROM customers WHERE status = 'active')                                            AS active_customers,
      (SELECT COUNT(*)::int  FROM companies)                                                                    AS total_companies,
      (SELECT COUNT(*)::int  FROM packages  WHERE active = TRUE)                                                AS active_packages_count,
      (SELECT COUNT(*)::int  FROM customer_packages WHERE status = 'active')                                    AS active_subscriptions,
      (SELECT COUNT(*)::int  FROM customer_packages
         WHERE status = 'active' AND expires_at BETWEEN NOW() AND NOW() + INTERVAL '7 days')                   AS expiring_in_7_days,
      (SELECT COUNT(*)::int  FROM customer_packages
         WHERE status = 'active' AND expires_at BETWEEN NOW() AND NOW() + INTERVAL '30 days')                  AS expiring_in_30_days,
      (SELECT COUNT(*)::int  FROM customer_packages WHERE status = 'expired')                                   AS expired_subscriptions,
      (SELECT COALESCE(SUM(price_paid),0)::numeric FROM customer_packages WHERE status = 'active')              AS total_revenue,
      (SELECT COUNT(*)::int  FROM customers WHERE created_at >= NOW() - INTERVAL '30 days')                    AS new_customers_30d
  `);
  const r = rows[0] as Record<string, unknown>;
  res.json({
    totalCustomers:       r.total_customers,
    activeCustomers:      r.active_customers,
    totalCompanies:       r.total_companies,
    activePackagesCount:  r.active_packages_count,
    activeSubscriptions:  r.active_subscriptions,
    expiringIn7Days:      r.expiring_in_7_days,
    expiringIn30Days:     r.expiring_in_30_days,
    expiredSubscriptions: r.expired_subscriptions,
    totalRevenue:         parseFloat(r.total_revenue as string),
    newCustomers30d:      r.new_customers_30d,
  });
}));

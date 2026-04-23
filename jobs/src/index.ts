import * as functions from "@google-cloud/functions-framework";
import { Pool } from "pg";
import nodemailer from "nodemailer";

const useSocket = !!process.env.DB_INSTANCE_CONNECTION_NAME;

const pool = new Pool(
  useSocket
    ? {
        host:     `/cloudsql/${process.env.DB_INSTANCE_CONNECTION_NAME}`,
        user:     process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
      }
    : {
        host:     process.env.DB_HOST     ?? "localhost",
        port:     Number(process.env.DB_PORT ?? 5432),
        user:     process.env.DB_USER     ?? "postgres",
        password: process.env.DB_PASSWORD ?? "postgres",
        database: process.env.DB_NAME     ?? "taskminder",
      }
);

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "alonagabrus@gmail.com";
const HORIZON_DAYS = Number(process.env.REMINDER_HORIZON_DAYS ?? 7);

// ── Auto-expire stale subscriptions ──────────────────────────────────────────
async function autoExpire(): Promise<number> {
  const { rowCount } = await pool.query(`
    UPDATE customer_packages
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'active' AND expires_at < NOW()
  `);
  return rowCount ?? 0;
}

// ── Fetch subscriptions expiring soon ────────────────────────────────────────
interface ExpiringRow {
  cp_id:         number;
  customer_name: string;
  email:         string;
  package_name:  string;
  joined_at:     Date;
  expires_at:    Date;
  days_left:     number;
  price_paid:    string | null;
}

async function fetchExpiring(): Promise<ExpiringRow[]> {
  const { rows } = await pool.query<ExpiringRow>(`
    SELECT
      cp.id                                                          AS cp_id,
      c.first_name || ' ' || c.last_name                            AS customer_name,
      c.email,
      p.name                                                         AS package_name,
      cp.joined_at,
      cp.expires_at,
      EXTRACT(DAY FROM cp.expires_at - NOW())::int                  AS days_left,
      cp.price_paid::text
    FROM customer_packages cp
    JOIN customers c ON c.id = cp.customer_id
    JOIN packages  p ON p.id = cp.package_id
    WHERE cp.status = 'active'
      AND cp.expires_at BETWEEN NOW() AND NOW() + ($1 || ' days')::interval
    ORDER BY cp.expires_at ASC
  `, [HORIZON_DAYS]);
  return rows;
}

// ── Log sent notifications ────────────────────────────────────────────────────
async function logNotification(
  cpId: number,
  success: boolean,
  error?: string
) {
  await pool.query(`
    INSERT INTO notification_log
      (type, recipient_email, subject, customer_package_id, success, error_message)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [
    "package_expiry",
    ADMIN_EMAIL,
    `Package Expiry Alert - ${HORIZON_DAYS} day horizon`,
    cpId,
    success,
    error ?? null,
  ]);
}

// ── Build email ───────────────────────────────────────────────────────────────
function buildAdminEmail(rows: ExpiringRow[]) {
  const subject = `⚠️ CRM Alert: ${rows.length} subscription(s) expiring within ${HORIZON_DAYS} days`;

  const tableRows = rows.map((r) => `
    <tr style="border-bottom:1px solid #e2e8f0">
      <td style="padding:10px 12px;font-weight:600;color:#1e293b">${esc(r.customer_name)}</td>
      <td style="padding:10px 12px;color:#475569">${esc(r.email)}</td>
      <td style="padding:10px 12px;color:#2563eb;font-weight:500">${esc(r.package_name)}</td>
      <td style="padding:10px 12px;color:#475569">${r.expires_at.toISOString().slice(0,10)}</td>
      <td style="padding:10px 12px;font-weight:600;color:${r.days_left <= 2 ? "#dc2626" : "#d97706"}">${r.days_left}d</td>
      <td style="padding:10px 12px;color:#475569">${r.price_paid ? `$${r.price_paid}` : "—"}</td>
    </tr>
  `).join("");

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:720px;margin:0 auto">
      <div style="background:#1e3a5f;color:white;padding:24px 28px;border-radius:12px 12px 0 0">
        <h1 style="margin:0;font-size:20px">ClientHub CRM — Expiry Alert</h1>
        <p style="margin:6px 0 0;opacity:.8;font-size:14px">
          ${rows.length} subscription(s) expiring within <strong>${HORIZON_DAYS} days</strong>
        </p>
      </div>
      <div style="background:white;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;overflow:hidden">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead>
            <tr style="background:#f8fafc;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.05em">
              <th style="padding:10px 12px;text-align:left">Customer</th>
              <th style="padding:10px 12px;text-align:left">Email</th>
              <th style="padding:10px 12px;text-align:left">Package</th>
              <th style="padding:10px 12px;text-align:left">Expires</th>
              <th style="padding:10px 12px;text-align:left">Days left</th>
              <th style="padding:10px 12px;text-align:left">Price paid</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
      <p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:16px">
        Sent by ClientHub CRM · Cloud Scheduler trigger
      </p>
    </div>
  `;

  const text = [
    subject, "",
    rows.map((r) =>
      `• ${r.customer_name} <${r.email}> — ${r.package_name} — expires ${r.expires_at.toISOString().slice(0,10)} (${r.days_left}d left)`
    ).join("\n"),
    "", "— ClientHub CRM",
  ].join("\n");

  return { subject, html, text };
}

function esc(s: string) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// ── Mailer ────────────────────────────────────────────────────────────────────
function getTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port:   Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth:   { user, pass },
  });
}

// ── Cloud Function entry point ────────────────────────────────────────────────
functions.http("sendReminders", async (_req, res) => {
  const startedAt = new Date().toISOString();
  try {
    // 1. Auto-expire stale active subscriptions
    const expired = await autoExpire();
    console.log(`Auto-expired ${expired} subscription(s).`);

    // 2. Find subscriptions expiring soon
    const rows = await fetchExpiring();
    console.log(`Found ${rows.length} subscription(s) expiring within ${HORIZON_DAYS} days.`);

    if (rows.length === 0) {
      res.status(200).json({ ok: true, startedAt, autoExpired: expired, emailSent: false, reason: "nothing_expiring" });
      return;
    }

    // 3. Build and send admin email
    const email = buildAdminEmail(rows);
    const transport = getTransport();

    if (transport) {
      await transport.sendMail({
        from:    process.env.MAIL_FROM ?? `ClientHub CRM <noreply@clienthub.local>`,
        to:      ADMIN_EMAIL,
        subject: email.subject,
        html:    email.html,
        text:    email.text,
      });
      console.log(`Email sent to admin: ${ADMIN_EMAIL}`);
    } else {
      console.log("=== MOCK EMAIL (no SMTP configured) ===");
      console.log("To:", ADMIN_EMAIL);
      console.log("Subject:", email.subject);
      console.log(email.text);
    }

    // 4. Log each notification
    for (const row of rows) {
      await logNotification(row.cp_id, true);
    }

    res.status(200).json({
      ok: true,
      startedAt,
      autoExpired: expired,
      emailSent: !!transport,
      recipientsCount: rows.length,
      adminEmail: ADMIN_EMAIL,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Reminder job failed:", msg);
    res.status(500).json({ ok: false, error: msg });
  }
});

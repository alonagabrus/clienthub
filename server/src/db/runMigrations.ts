import { pool } from "./pool";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS companies (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(200) NOT NULL,
  email      VARCHAR(200),
  phone      VARCHAR(50),
  address    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS packages (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  description   TEXT,
  price         NUMERIC(10,2) NOT NULL DEFAULT 0,
  duration_days INT NOT NULL DEFAULT 30,
  features      TEXT[],
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promotions (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(200) NOT NULL,
  description      TEXT,
  discount_percent NUMERIC(5,2),
  discount_amount  NUMERIC(10,2),
  valid_from       TIMESTAMPTZ NOT NULL,
  valid_until      TIMESTAMPTZ NOT NULL,
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS package_promotions (
  id           SERIAL PRIMARY KEY,
  package_id   INT NOT NULL REFERENCES packages(id)   ON DELETE CASCADE,
  promotion_id INT NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  UNIQUE(package_id, promotion_id)
);

CREATE TABLE IF NOT EXISTS customers (
  id         SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name  VARCHAR(100) NOT NULL,
  email      VARCHAR(200) NOT NULL UNIQUE,
  phone      VARCHAR(50),
  company_id INT REFERENCES companies(id) ON DELETE SET NULL,
  status     VARCHAR(20) NOT NULL DEFAULT 'active',
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_packages (
  id           SERIAL PRIMARY KEY,
  customer_id  INT NOT NULL REFERENCES customers(id)  ON DELETE CASCADE,
  package_id   INT NOT NULL REFERENCES packages(id),
  promotion_id INT REFERENCES promotions(id) ON DELETE SET NULL,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL,
  price_paid   NUMERIC(10,2),
  status       VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_log (
  id                  SERIAL PRIMARY KEY,
  type                VARCHAR(50)  NOT NULL,
  recipient_email     VARCHAR(200) NOT NULL,
  subject             VARCHAR(500),
  sent_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  customer_id         INT REFERENCES customers(id)         ON DELETE SET NULL,
  customer_package_id INT REFERENCES customer_packages(id) ON DELETE SET NULL,
  success             BOOLEAN NOT NULL DEFAULT TRUE,
  error_message       TEXT
);

CREATE INDEX IF NOT EXISTS idx_customers_company  ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_status   ON customers(status);
CREATE INDEX IF NOT EXISTS idx_cp_customer        ON customer_packages(customer_id);
CREATE INDEX IF NOT EXISTS idx_cp_expires         ON customer_packages(expires_at);
CREATE INDEX IF NOT EXISTS idx_cp_status          ON customer_packages(status);
CREATE INDEX IF NOT EXISTS idx_notif_customer     ON notification_log(customer_id);
`;

const SEED = `
-- Default packages
INSERT INTO packages (name, description, price, duration_days, features, active)
VALUES
  ('Basic',        'Essential features for small teams',     29.00, 30,
     ARRAY['Up to 5 users','Email support','1 GB storage'], TRUE),
  ('Professional', 'Advanced tools for growing businesses',  79.00, 30,
     ARRAY['Up to 25 users','Priority support','20 GB storage','API access'], TRUE),
  ('Enterprise',   'Full-featured plan for large companies', 199.00, 30,
     ARRAY['Unlimited users','24/7 support','Unlimited storage','API access','SLA'], TRUE)
ON CONFLICT DO NOTHING;

-- Demo promotions
INSERT INTO promotions (name, description, discount_percent, valid_from, valid_until, active)
VALUES
  ('Summer Sale',    '20% off all plans',   20.00,
     NOW() - INTERVAL '10 days', NOW() + INTERVAL '20 days', TRUE),
  ('New Customer',   '10% off first month', 10.00,
     NOW() - INTERVAL '60 days', NOW() + INTERVAL '60 days', TRUE)
ON CONFLICT DO NOTHING;

-- Demo companies
INSERT INTO companies (name, email, phone, address)
VALUES
  ('Acme Corp',      'contact@acme.com',    '+1-555-0100', '123 Main St, New York, NY'),
  ('Globex Inc',     'info@globex.com',     '+1-555-0200', '456 Oak Ave, San Francisco, CA'),
  ('Initech Ltd',    'hello@initech.com',   '+1-555-0300', '789 Pine Rd, Austin, TX'),
  ('Umbrella Co',    'sales@umbrella.com',  '+1-555-0400', '321 Elm St, Chicago, IL')
ON CONFLICT DO NOTHING;

-- Demo customers (linked to companies)
INSERT INTO customers (first_name, last_name, email, phone, company_id, status, notes)
SELECT 'Alice',   'Johnson',  'alice@acme.com',      '+1-555-1001',
       (SELECT id FROM companies WHERE name='Acme Corp'   LIMIT 1), 'active',  'VIP client'
WHERE NOT EXISTS (SELECT 1 FROM customers WHERE email='alice@acme.com');

INSERT INTO customers (first_name, last_name, email, phone, company_id, status, notes)
SELECT 'Bob',     'Smith',    'bob@globex.com',      '+1-555-1002',
       (SELECT id FROM companies WHERE name='Globex Inc'  LIMIT 1), 'active',  NULL
WHERE NOT EXISTS (SELECT 1 FROM customers WHERE email='bob@globex.com');

INSERT INTO customers (first_name, last_name, email, phone, company_id, status, notes)
SELECT 'Carol',   'Williams', 'carol@initech.com',   '+1-555-1003',
       (SELECT id FROM companies WHERE name='Initech Ltd' LIMIT 1), 'active',  'Renewal due soon'
WHERE NOT EXISTS (SELECT 1 FROM customers WHERE email='carol@initech.com');

INSERT INTO customers (first_name, last_name, email, phone, company_id, status, notes)
SELECT 'David',   'Brown',    'david@umbrella.com',  '+1-555-1004',
       (SELECT id FROM companies WHERE name='Umbrella Co' LIMIT 1), 'inactive', NULL
WHERE NOT EXISTS (SELECT 1 FROM customers WHERE email='david@umbrella.com');

INSERT INTO customers (first_name, last_name, email, phone, company_id, status)
SELECT 'Eve',     'Davis',    'eve@freelance.com',   '+1-555-1005', NULL, 'active'
WHERE NOT EXISTS (SELECT 1 FROM customers WHERE email='eve@freelance.com');

INSERT INTO customers (first_name, last_name, email, phone, company_id, status)
SELECT 'Frank',   'Miller',   'frank@acme.com',      '+1-555-1006',
       (SELECT id FROM companies WHERE name='Acme Corp' LIMIT 1), 'churned'
WHERE NOT EXISTS (SELECT 1 FROM customers WHERE email='frank@acme.com');

-- Assign packages to customers
-- Alice → Enterprise, active, expires in 25 days
INSERT INTO customer_packages (customer_id, package_id, joined_at, expires_at, price_paid, status)
SELECT c.id, p.id,
       NOW() - INTERVAL '5 days',
       NOW() + INTERVAL '25 days',
       199.00, 'active'
FROM customers c, packages p
WHERE c.email = 'alice@acme.com' AND p.name = 'Enterprise'
  AND NOT EXISTS (
    SELECT 1 FROM customer_packages cp2
    WHERE cp2.customer_id = c.id AND cp2.status = 'active'
  );

-- Bob → Professional, active, expires in 5 days (expiring soon!)
INSERT INTO customer_packages (customer_id, package_id, joined_at, expires_at, price_paid, status)
SELECT c.id, p.id,
       NOW() - INTERVAL '25 days',
       NOW() + INTERVAL '5 days',
       79.00, 'active'
FROM customers c, packages p
WHERE c.email = 'bob@globex.com' AND p.name = 'Professional'
  AND NOT EXISTS (
    SELECT 1 FROM customer_packages cp2
    WHERE cp2.customer_id = c.id AND cp2.status = 'active'
  );

-- Carol → Basic, active, expires in 2 days (urgent!)
INSERT INTO customer_packages (customer_id, package_id, joined_at, expires_at, price_paid, status)
SELECT c.id, p.id,
       NOW() - INTERVAL '28 days',
       NOW() + INTERVAL '2 days',
       29.00, 'active'
FROM customers c, packages p
WHERE c.email = 'carol@initech.com' AND p.name = 'Basic'
  AND NOT EXISTS (
    SELECT 1 FROM customer_packages cp2
    WHERE cp2.customer_id = c.id AND cp2.status = 'active'
  );

-- Eve → Professional with Summer Sale promo
INSERT INTO customer_packages (customer_id, package_id, promotion_id, joined_at, expires_at, price_paid, status)
SELECT c.id, p.id, pr.id,
       NOW() - INTERVAL '10 days',
       NOW() + INTERVAL '20 days',
       63.20, 'active'
FROM customers c, packages p, promotions pr
WHERE c.email = 'eve@freelance.com' AND p.name = 'Professional' AND pr.name = 'Summer Sale'
  AND NOT EXISTS (
    SELECT 1 FROM customer_packages cp2
    WHERE cp2.customer_id = c.id AND cp2.status = 'active'
  );

-- Frank → expired Basic (history)
INSERT INTO customer_packages (customer_id, package_id, joined_at, expires_at, price_paid, status)
SELECT c.id, p.id,
       NOW() - INTERVAL '60 days',
       NOW() - INTERVAL '30 days',
       29.00, 'expired'
FROM customers c, packages p
WHERE c.email = 'frank@acme.com' AND p.name = 'Basic'
  AND NOT EXISTS (
    SELECT 1 FROM customer_packages cp2
    WHERE cp2.customer_id = c.id
  );
`;

export async function runMigrations(): Promise<void> {
  console.log("[DB] Running schema migrations...");
  await pool.query(SCHEMA);
  console.log("[DB] Schema ready. Seeding demo data...");
  await pool.query(SEED);
  console.log("[DB] Ready.");
}

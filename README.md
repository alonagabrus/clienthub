# ClientHub CRM

A production-ready Customer Relationship Management system built for **Google Cloud Platform** practice.

```
┌─────────────────┐   HTTPS    ┌─────────────────┐   /cloudsql   ┌──────────────┐
│  React Client   ├───────────►│  Express Server │──────────────►│  Cloud SQL   │
│  (Cloud Run)    │            │  (Cloud Run)    │               │ (PostgreSQL) │
└─────────────────┘            └─────────────────┘               └──────▲───────┘
                                                                        │
                        Cloud Scheduler ──► Cloud Function (2nd gen) ───┘
                        (every 15 min)      sends expiry alert email
                                            to alonagabrus@gmail.com
```

> **Deployment region:** `me-west1` (Tel Aviv, Israel) — all services in this guide use this region.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Legend: Where to Run Commands](#legend-where-to-run-commands)
4. [Database Schema](#database-schema)
5. [Local Development](#local-development)
6. [REST API Reference](#rest-api-reference)
7. [Deploy to GCP](#deploy-to-gcp-step-by-step)
8. [End-to-End Test](#end-to-end-test)
9. [Troubleshooting](#troubleshooting)
10. [GCP Services Practiced](#gcp-services-practiced)

---

## Features

- **Dashboard** — live stats: customers, subscriptions, revenue, expiring soon
- **Customers** — full CRUD with search, status filter, package assignment, history
- **Companies** — manage organizations with customer count
- **Packages** — Basic / Professional / Enterprise with pricing and features
- **Promotions** — discount campaigns with expiry dates
- **Email alerts** — Cloud Function scans for expiring subscriptions and emails the admin
- **Auto-expire** — subscriptions past their expiry date are automatically marked `expired`
- **Auto-migration** — schema + seed data run automatically on server startup (idempotent)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Client | React 18, Vite, TypeScript, Tailwind CSS |
| Server | Node.js 20, Express 4, TypeScript, Zod |
| Database | PostgreSQL 16 (Cloud SQL) |
| Job | Cloud Function 2nd gen (functions-framework + nodemailer) |
| Scheduler | Cloud Scheduler (cron) |
| Container | Docker, Artifact Registry |
| Deploy | Cloud Run |

---

## Legend: Where to Run Commands

Every command block in this README is tagged with a location indicator:

| Tag | Where | What it means |
|-----|-------|---------------|
| 🖥️ **LOCAL IDE** | Your PowerShell / terminal on Windows | Runs on your machine. Needs the repo cloned locally. |
| 🐳 **DOCKER** | `docker compose exec ...` | Runs inside a running Docker container on your machine. |
| ☁️ **CLOUD SHELL** | GCP Console → top-right `>_` icon | Pre-authenticated shell inside Google Cloud. Best for `gcloud` + Cloud Build. |
| 🌐 **GCP CONSOLE (UI)** | Browser — `console.cloud.google.com` | Point-and-click interface. No command line. |

When you see a command, check the tag above the code block to know where to paste it.

---

## Database Schema

```
companies          packages            promotions
──────────         ──────────          ──────────────
id                 id                  id
name               name                name
email              description         description
phone              price               discount_percent
address            duration_days       discount_amount
                   features (TEXT[])   valid_from
                   active              valid_until
                                       active

customers                    customer_packages          notification_log
──────────                   ─────────────────          ────────────────
id                           id                         id
first_name                   customer_id (FK)           type
last_name                    package_id  (FK)           recipient_email
email (unique)               promotion_id (FK)          subject
phone                        joined_at                  sent_at
company_id (FK)              expires_at                 customer_package_id (FK)
status                       price_paid                 success
notes                        status                     error_message

package_promotions
──────────────────
package_id (FK)
promotion_id (FK)
```

---

## Local Development

### Option A — Docker Compose (recommended)

**Requires:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) running on Windows (you'll see the whale icon 🐳 in the system tray when it's ready).

#### 1. Start everything

🖥️ **LOCAL IDE** (PowerShell, in the project root):
```powershell
cd d:\my-app
docker compose up --build
```

This starts three containers:
- `db` — PostgreSQL 16
- `server` — Express API (auto-runs DB migration + seed on startup)
- `client` — nginx serving the built React app

Wait for the logs to show:
```
server-1  | [DB] Schema ready. Seeding demo data...
server-1  | [DB] Ready.
server-1  | CRM server listening on :8080
```

#### 2. Open the app

| Service | URL |
|---------|-----|
| Client  | http://localhost:5173 |
| Server  | http://localhost:8080 |
| Health  | http://localhost:8080/health |

#### 3. Useful commands

🖥️ **LOCAL IDE** — stop everything: `Ctrl+C`, then
```powershell
docker compose down
```

🖥️ **LOCAL IDE** — reset DB (wipes all data, re-seeds on next start):
```powershell
docker compose down -v
docker compose up --build
```

🐳 **DOCKER** — open PostgreSQL inside the DB container:
```powershell
docker compose exec db psql -U postgres -d taskminder
```
Inside `psql`:
```sql
\dt                        -- list tables
SELECT * FROM customers;
\q                         -- quit
```

🐳 **DOCKER** — re-run migration manually (usually unnecessary, startup does it):
```powershell
docker compose exec server node dist/db/migrate.js
```

🖥️ **LOCAL IDE** — view server logs:
```powershell
docker compose logs -f server
```

---

### Option B — Native (Node.js only, no Docker)

**Requires:** Node.js 20+, PostgreSQL 16 running locally with a `taskminder` database.

#### Terminal 1 — Server

🖥️ **LOCAL IDE**:
```powershell
cd d:\my-app\server
npm install
Copy-Item .env.example .env   # edit DB credentials if they differ
npm run dev
```

#### Terminal 2 — Client

🖥️ **LOCAL IDE**:
```powershell
cd d:\my-app\client
npm install
npm run dev
```

#### Terminal 3 — Reminder Job (optional)

🖥️ **LOCAL IDE**:
```powershell
cd d:\my-app\jobs
npm install
Copy-Item .env.example .env   # configure SMTP if you want real emails
npm run build
npm start
# In another terminal, trigger manually:
curl.exe -X POST http://localhost:8080
```

Without SMTP vars set, emails are printed to the console instead of being sent.

---

## REST API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server + DB health check |
| GET | `/api/stats` | Dashboard statistics |
| GET/POST | `/api/companies` | List / create companies |
| GET/PATCH/DELETE | `/api/companies/:id` | Get / update / delete company |
| GET/POST | `/api/packages` | List / create packages |
| GET/PATCH/DELETE | `/api/packages/:id` | Get / update / delete package |
| GET/POST | `/api/promotions` | List / create promotions |
| GET/PATCH/DELETE | `/api/promotions/:id` | Get / update / delete promotion |
| GET/POST | `/api/customers` | List (filterable) / create customers |
| GET/PATCH/DELETE | `/api/customers/:id` | Get / update / delete customer |
| GET/POST | `/api/customer-packages` | List / assign package to customer |
| GET | `/api/customer-packages/expiring?days=7` | Subscriptions expiring soon |
| PATCH/DELETE | `/api/customer-packages/:id` | Update / remove subscription |

---

## Deploy to GCP (step by step)

> **All services use region `me-west1` (Tel Aviv).**

### Prerequisites

- A Google Cloud account with **billing enabled**
- Access to [Google Cloud Console](https://console.cloud.google.com/)
- The code of this repo — either pushed to a Git repo, or ready to upload

---

### Step 1 — Create a project

🌐 **GCP CONSOLE (UI)**:

1. Go to https://console.cloud.google.com/
2. Click the project selector in the top bar → **NEW PROJECT**
3. Project name: `clienthub-crm`
4. Click **Create**
5. **Copy the Project ID** (shown in the project details) — you'll reuse it everywhere. Example: `clienthub-crm-473210`
6. Make sure billing is linked: **Billing → Link a billing account**

---

### Step 2 — Enable required APIs

🌐 **GCP CONSOLE (UI)**:

Go to **APIs & Services → Enabled APIs & services → ENABLE APIS AND SERVICES**, then search for each of these and enable them one by one:

- Cloud Run Admin API
- Cloud SQL Admin API
- Artifact Registry API
- Cloud Build API
- Cloud Functions API
- Cloud Scheduler API
- Secret Manager API
- Eventarc API *(required by Cloud Functions 2nd gen)*

**Shortcut alternative** — ☁️ **CLOUD SHELL** (open Cloud Shell by clicking `>_` in the top-right of the Console):
```bash
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  cloudfunctions.googleapis.com \
  cloudscheduler.googleapis.com \
  secretmanager.googleapis.com \
  eventarc.googleapis.com
```

---

### Step 3 — Create Cloud SQL (PostgreSQL)

🌐 **GCP CONSOLE (UI)**:

1. Navigate to **SQL → Create Instance → Choose PostgreSQL**
2. Fill in:
   - **Instance ID:** `clienthub-sql`
   - **Password:** pick a strong password and **save it** (you'll need it for secrets)
   - **Database version:** PostgreSQL 16
   - **Region:** `me-west1 (Tel Aviv)`
   - **Zonal availability:** Single zone (cheapest for practice)
   - **Machine type:** Shared core → `db-f1-micro` (cheapest)
   - **Storage:** 10 GB HDD is enough
3. Click **Create instance** (takes ~5-10 minutes)
4. After it's ready:
   - Go to the instance → **Databases** tab → **Create database** → name: `clienthub`
   - Go to the **Overview** tab → copy the **Connection name**  
     Format: `PROJECT_ID:me-west1:clienthub-sql`  
     (example: `clienthub-crm-473210:me-west1:clienthub-sql`)

---

### Step 4 — Store secrets in Secret Manager

🌐 **GCP CONSOLE (UI)**:

Go to **Security → Secret Manager → CREATE SECRET** and create each of these one at a time:

| Secret name | Value |
|-------------|-------|
| `DB_PASSWORD` | The Cloud SQL root password from Step 3 |
| `SMTP_HOST` | e.g. `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | your Gmail address |
| `SMTP_PASS` | Gmail App Password *(see note below)* |
| `MAIL_FROM` | `ClientHub CRM <your-email@gmail.com>` |

> **Gmail App Password:** Gmail requires a special 16-character password for apps.  
> Go to Google Account → Security → **2-Step Verification** (enable it) → **App passwords** → generate one for "Mail". Use that value for `SMTP_PASS`.

For each secret:
1. Name: exactly as above (case-sensitive)
2. Secret value: paste the value
3. **Create**

---

### Step 5 — Create Artifact Registry repository

🌐 **GCP CONSOLE (UI)**:

1. Go to **Artifact Registry → Repositories → CREATE REPOSITORY**
2. Fill in:
   - **Name:** `clienthub`
   - **Format:** Docker
   - **Mode:** Standard
   - **Location type:** Region
   - **Region:** `me-west1`
3. Click **Create**

---

### Step 6 — Build & push the server image

☁️ **CLOUD SHELL** (click the `>_` icon top-right in GCP Console to open it):

First, upload your code to Cloud Shell. Two options:

**Option A: push to GitHub first, then clone in Cloud Shell**
```bash
git clone https://github.com/YOUR_USERNAME/my-app.git
cd my-app
```

**Option B: upload the folder directly**  
In Cloud Shell, click the ⋮ (three-dots) menu top-right → **Upload** → upload the project folder as a zip, then:
```bash
unzip my-app.zip && cd my-app
```

Now set environment variables (stays for this Cloud Shell session):
```bash
export PROJECT_ID=$(gcloud config get-value project)
export REGION=me-west1
export REPO=$REGION-docker.pkg.dev/$PROJECT_ID/clienthub

echo "Project: $PROJECT_ID"
echo "Region:  $REGION"
echo "Repo:    $REPO"
```

Configure Docker auth for this registry (one-time):
```bash
gcloud auth configure-docker $REGION-docker.pkg.dev
```

Build and push the **server** image (takes 2-4 minutes):
```bash
gcloud builds submit ./server --tag $REPO/server:v1
```

When it finishes, verify it in 🌐 **GCP CONSOLE (UI)** → Artifact Registry → `clienthub` repo → you should see `server:v1`.

---

### Step 7 — Deploy the Server to Cloud Run

🌐 **GCP CONSOLE (UI)**:

1. Go to **Cloud Run → CREATE SERVICE**
2. Choose **Deploy one revision from an existing container image** → **SELECT** → pick `clienthub` / `server:v1` from Artifact Registry
3. Fill in:
   - **Service name:** `clienthub-server`
   - **Region:** `me-west1`
   - **Authentication:** ✅ Allow unauthenticated invocations
4. Expand **Container(s), Networking, Security** section
5. Under **Container(s) → Settings → Container port:** `8080`
6. Under **Variables & Secrets → Environment variables → + ADD VARIABLE**, add plain vars:
   - `DB_INSTANCE_CONNECTION_NAME` = `PROJECT_ID:me-west1:clienthub-sql` *(full connection string from Step 3)*
   - `DB_USER` = `postgres`
   - `DB_NAME` = `clienthub`
7. Under **Variables & Secrets → Reference secrets → + REFERENCE A SECRET**, add:
   - Name: `DB_PASSWORD` → Secret: `DB_PASSWORD` → Version: `latest`
8. Under **Networking → Cloud SQL connections → + ADD CONNECTION** → pick `clienthub-sql`
9. Click **CREATE**
10. After deployment, **copy the service URL** (e.g. `https://clienthub-server-xxxx-zf.a.run.app`)

**Note on auto-migration:** the server runs DB schema + seed data automatically on first startup. Check the **LOGS** tab on the Cloud Run service to see:
```
[DB] Running schema migrations...
[DB] Schema ready. Seeding demo data...
[DB] Ready.
CRM server listening on :8080
```

**Test the server:**

🖥️ **LOCAL IDE** (PowerShell):
```powershell
curl.exe https://clienthub-server-xxxx-zf.a.run.app/health
```
Expected response: `{"status":"ok","db":"up"}`

---

### Step 8 — Build & deploy the Client to Cloud Run

The client needs to know the **server URL** at build time (baked into the static bundle via `VITE_API_BASE`).

☁️ **CLOUD SHELL**:
```bash
# Paste the server URL from Step 7:
export SERVER_URL="https://clienthub-server-xxxx-zf.a.run.app"

# Build & push client via Cloud Build (takes 2-4 minutes):
gcloud builds submit . \
  --config cloudbuild.yaml \
  --substitutions=_VITE_API_BASE=$SERVER_URL
```

Now deploy the client — 🌐 **GCP CONSOLE (UI)**:

1. **Cloud Run → CREATE SERVICE**
2. Pick `clienthub` / `client:v1` image
3. **Service name:** `clienthub-client`
4. **Region:** `me-west1`
5. ✅ Allow unauthenticated invocations
6. **Container port:** `8080`
7. **CREATE**
8. Open the service URL in a browser → **your CRM is live** 🎉

---

### Step 9 — Deploy the Reminder Cloud Function

This is the scheduled "Lambda" that sends expiry emails.

🌐 **GCP CONSOLE (UI)**:

1. Go to **Cloud Functions → CREATE FUNCTION**
2. Fill in:
   - **Environment:** 2nd gen
   - **Function name:** `clienthub-reminders`
   - **Region:** `me-west1`
3. **Trigger:** HTTPS → ✅ **Require authentication** (Scheduler uses OIDC)
4. Click **NEXT**
5. **Runtime:** Node.js 20
6. **Entry point:** `sendReminders`  ⚠️ *must match the exported function name*
7. **Source code:** choose **ZIP Upload** or **Inline editor**.  
   Simplest: **ZIP Upload** → zip the `jobs/` folder contents (not the folder itself — zip its contents) and upload it.
8. **Runtime, build, connections and security settings** (expand this):
   - **Runtime environment variables** (plain):
     - `DB_INSTANCE_CONNECTION_NAME` = `PROJECT_ID:me-west1:clienthub-sql`
     - `DB_USER` = `postgres`
     - `DB_NAME` = `clienthub`
     - `ADMIN_EMAIL` = `alonagabrus@gmail.com`
     - `REMINDER_HORIZON_DAYS` = `7`
   - **Secrets** (reference from Secret Manager):
     - `DB_PASSWORD` → `DB_PASSWORD:latest`
     - `SMTP_HOST` → `SMTP_HOST:latest`
     - `SMTP_PORT` → `SMTP_PORT:latest`
     - `SMTP_USER` → `SMTP_USER:latest`
     - `SMTP_PASS` → `SMTP_PASS:latest`
     - `MAIL_FROM` → `MAIL_FROM:latest`
   - **Cloud SQL connections** → Add → `clienthub-sql`
9. **DEPLOY** (takes 2-3 minutes)
10. After deploy, copy the **Trigger URL** (shown on the function detail page)

---

### Step 10 — Schedule it with Cloud Scheduler

🌐 **GCP CONSOLE (UI)**:

1. Go to **Cloud Scheduler → CREATE JOB**
2. Fill in:
   - **Region:** `me-west1`
   - **Name:** `clienthub-reminders-schedule`
   - **Frequency:** `*/15 * * * *`  *(every 15 minutes)*
   - **Timezone:** `Asia/Jerusalem`
3. **Configure the execution:**
   - **Target type:** HTTP
   - **URL:** paste the Cloud Function trigger URL from Step 9
   - **HTTP method:** POST
4. **Auth header:** → **Add OIDC token**
   - **Service account:** choose the default Compute SA (or create one with `Cloud Run Invoker` role on the function)
   - **Audience:** the same Cloud Function URL
5. **CREATE**

Now grant the Scheduler SA permission to invoke the function — 🌐 **GCP CONSOLE (UI)**:

1. **Cloud Functions → `clienthub-reminders` → PERMISSIONS** tab
2. **GRANT ACCESS**
3. **New principals:** the service account from Step 4 above (e.g. `PROJECT_NUMBER-compute@developer.gserviceaccount.com`)
4. **Role:** `Cloud Run Invoker`  *(Cloud Functions 2nd gen runs on Cloud Run under the hood)*
5. **SAVE**

---

## End-to-End Test

1. Open the **client URL** from Step 8
2. Go to **Packages** — you should see 3 pre-seeded packages (Basic, Professional, Enterprise)
3. Go to **Customers** — you should see 6 demo customers (Alice, Bob, Carol, David, Eve, Frank)
4. Add a new customer → click **Assign Pkg** → pick a package → set expiry date **1-2 days from now**
5. Back in 🌐 **GCP CONSOLE (UI)** → **Cloud Scheduler** → click **FORCE RUN** on your job
6. Wait ~30 seconds
7. Check `alonagabrus@gmail.com` — you should receive a nicely formatted HTML email listing your new customer's expiring subscription
8. Check Cloud Function logs for confirmation

---

## Troubleshooting

### Docker Desktop isn't running
Error: `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.`  
→ Start Docker Desktop from the Start menu and wait for the whale icon in the tray to be steady.

### `ts-node: not found` inside the server container
The production image doesn't include dev dependencies. Don't run `npm run migrate`, use:
```powershell
docker compose exec server node dist/db/migrate.js
```
In practice, the server auto-runs migration on startup, so this is usually not needed.

### `relation "customers" does not exist`
The migration hasn't run yet. Restart the server:
```powershell
docker compose restart server
```
Then check logs — you should see `[DB] Ready.`

### Cloud Run can't connect to Cloud SQL
- Verify **Cloud SQL connection** was added in the Cloud Run service settings
- Verify `DB_INSTANCE_CONNECTION_NAME` env var format: `PROJECT_ID:me-west1:clienthub-sql`
- Verify the Cloud Run service account has role **Cloud SQL Client**

### Email not being sent
Check the Cloud Function logs:
- If you see `MOCK EMAIL` in the logs → SMTP secrets are not wired correctly
- If you see `535 Authentication failed` → Gmail blocks it; use an **App Password**, not your regular Gmail password

### How to view the data in Cloud SQL
🌐 **GCP CONSOLE (UI)** → **SQL → clienthub-sql → Cloud SQL Studio** → enter credentials → run SQL queries directly.

### Inspecting the local Docker DB
🐳 **DOCKER**:
```powershell
docker compose exec db psql -U postgres -d taskminder -c "SELECT count(*) FROM customers;"
```

---

## GCP Services Practiced

| Service | Purpose |
|---------|---------|
| Cloud SQL | Managed PostgreSQL |
| Secret Manager | DB and SMTP credentials |
| Artifact Registry | Docker image storage |
| Cloud Build | Building images remotely (`gcloud builds submit`) |
| Cloud Run (service) | Hosting server + client containers |
| Cloud Functions 2nd gen | Scheduled reminder job ("Lambda") |
| Cloud Scheduler | Cron trigger for the function |
| IAM | Service accounts, roles, permissions |
| Cloud Shell | Authenticated terminal inside the browser |

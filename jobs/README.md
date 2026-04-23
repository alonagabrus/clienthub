# TaskMinder Reminder Job

A Cloud Function (2nd gen) that scans the database for tasks that are due within
`REMINDER_HORIZON_HOURS` (default 24) and sends an email reminder via SMTP.

It is triggered by Cloud Scheduler on a schedule (e.g. every 15 minutes).

## Local run

```bash
cp .env.example .env
npm install
npm run build
npm start       # starts functions-framework on http://localhost:8080
curl -X POST http://localhost:8080
```

Without SMTP env vars set, emails are printed to stdout — useful for local dev.

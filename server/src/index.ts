import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { pool } from "./db/pool";
import { runMigrations }         from "./db/runMigrations";
import { companiesRouter }       from "./routes/companies";
import { packagesRouter }        from "./routes/packages";
import { promotionsRouter }      from "./routes/promotions";
import { customersRouter }       from "./routes/customers";
import { customerPackagesRouter } from "./routes/customerPackages";
import { statsRouter }           from "./routes/stats";

const app = express();
const PORT = Number(process.env.PORT ?? 8080);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("tiny"));

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "up" });
  } catch {
    res.status(500).json({ status: "error", db: "down" });
  }
});

app.use("/api/companies",        companiesRouter);
app.use("/api/packages",         packagesRouter);
app.use("/api/promotions",       promotionsRouter);
app.use("/api/customers",        customersRouter);
app.use("/api/customer-packages", customerPackagesRouter);
app.use("/api/stats",            statsRouter);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error", message: err.message });
});

runMigrations()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`CRM server listening on :${PORT}`);
    });
  })
  .catch((err: Error) => {
    console.error("[DB] Migration failed, server will not start:", err.message);
    process.exit(1);
  });

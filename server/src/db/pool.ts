import { Pool } from "pg";

const useInstanceSocket = !!process.env.DB_INSTANCE_CONNECTION_NAME;

export const pool = new Pool(
  useInstanceSocket
    ? {
        // Cloud Run -> Cloud SQL via Unix socket
        host: `/cloudsql/${process.env.DB_INSTANCE_CONNECTION_NAME}`,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
      }
    : process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST ?? "localhost",
        port: Number(process.env.DB_PORT ?? 5432),
        user: process.env.DB_USER ?? "postgres",
        password: process.env.DB_PASSWORD ?? "postgres",
        database: process.env.DB_NAME ?? "taskminder",
      }
);

pool.on("error", (err) => {
  console.error("Unexpected PG pool error:", err);
});

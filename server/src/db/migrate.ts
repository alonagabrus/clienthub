import { pool } from "./pool";
import { runMigrations } from "./runMigrations";

async function main() {
  await runMigrations();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

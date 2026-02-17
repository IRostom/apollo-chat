import "dotenv/config";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

async function runMigrations() {
  const dbFileName = process.env.DB_FILE_NAME;
  if (!dbFileName) {
    throw new Error("Missing required env var: DB_FILE_NAME");
  }

  const db = drizzle(dbFileName);
  await migrate(db, { migrationsFolder: "./drizzle" });
}

runMigrations()
  .then(() => {
    console.log("Database migrations applied successfully.");
  })
  .catch((error) => {
    console.error("Failed to apply database migrations:", error);
    process.exit(1);
  });

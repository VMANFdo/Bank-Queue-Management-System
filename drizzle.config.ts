import { defineConfig } from "drizzle-kit";

// Note: drizzle-kit uses a direct (non-pooled) connection for migrations.
// Use the Session mode Supabase URL (port 5432), not the Transaction mode pooled URL.
const connectionString =
  process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL ?? "";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
  verbose: true,
  strict: true,
});

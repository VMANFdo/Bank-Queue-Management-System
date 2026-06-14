import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * Database client initialization.
 * Uses postgres.js driver.
 *
 * For serverless environments (like Vercel functions connecting to Supabase),
 * we disable prefetch to ensure compatibility with transaction-mode pooling (PgBouncer/Supabase pooled port 6543).
 */
const queryClient = postgres(env.DATABASE_URL, { prepare: false });

export const db = drizzle(queryClient, { schema });

import { z } from "zod";

/**
 * Environment variable schema.
 * Validates all required env vars at startup — fails fast with a clear error
 * if anything is missing, preventing mysterious runtime failures.
 */
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),

  // Supabase — public (exposed to client via NEXT_PUBLIC_)
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),

  // Supabase — server only
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),

  // Cron security
  CRON_SECRET: z.string().min(16, "CRON_SECRET must be at least 16 characters"),

  // App
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url("NEXT_PUBLIC_APP_URL must be a valid URL")
    .default("http://localhost:3000"),

  // Runtime
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

type Env = z.infer<typeof envSchema>;

/**
 * Validated and typed environment object.
 * Import this instead of accessing `process.env` directly.
 *
 * @example
 * import { env } from "@/lib/env";
 * const db = postgres(env.DATABASE_URL);
 */
function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error(
      "❌ Invalid environment variables:\n",
      parsed.error.flatten().fieldErrors
    );
    throw new Error("Invalid environment variables — see errors above.");
  }

  return parsed.data;
}

export const env = validateEnv();

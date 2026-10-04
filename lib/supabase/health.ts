import { lookup } from "node:dns/promises";
import postgres from "postgres";

/**
 * Server-side diagnostics for the Supabase backing services.
 *
 * Why this module reads `process.env` directly instead of importing `@/lib/env`
 * and `@/lib/db`: both of those throw at module-evaluation time when the
 * environment is incomplete or points at a dead project. A diagnostic endpoint
 * that crashes with a stack trace is useless — the whole point is to survive a
 * broken environment and explain it.
 */

export type HealthCheck = {
  ok: boolean;
  detail: string;
};

export type SupabaseHealthReport = {
  ok: boolean;
  projectRef: string | null;
  checks: {
    env: HealthCheck;
    dns: HealthCheck;
    auth: HealthCheck;
    database: HealthCheck;
  };
  remedy: string | null;
};

const PLACEHOLDER_PATTERN = /^(your[-_]|replace[-_]|placeholder|changeme|xxx|<)/i;
const DNS_TIMEOUT_MS = 5_000;
const AUTH_TIMEOUT_MS = 6_000;
const DB_TIMEOUT_MS = 8_000;

/** Reads an env var defensively: trims whitespace and strips wrapping quotes. */
function readVar(name: string): string | null {
  const raw = process.env[name];
  if (typeof raw !== "string") return null;
  const value = raw.trim().replace(/^["']|["']$/g, "").trim();
  return value.length > 0 ? value : null;
}

function normaliseBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function extractProjectRef(url: string): string | null {
  const match = url.match(/\/\/([^./]+)\.supabase\./);
  return match ? match[1] : null;
}

/**
 * Classifies a Postgres/driver error into an actionable message. The Supabase
 * pooler returns a bare XX000 for a deleted tenant, which is cryptic without
 * this mapping.
 */
function describeDatabaseError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string } | null)?.code ?? "";

  if (/tenant\/user .* not found/i.test(message)) {
    return "Supabase reports this project/tenant does not exist. It was most likely deleted.";
  }
  if (code === "ENOTFOUND" || /getaddrinfo/i.test(message)) {
    return "Could not resolve the database hostname. Check DATABASE_URL for typos.";
  }
  if (code === "28P01" || /password authentication failed/i.test(message)) {
    return "Database rejected the password. Check the password in DATABASE_URL.";
  }
  if (code === "28000" || /no pg_hba entry/i.test(message)) {
    return "Database refused the connection (auth policy). Check DATABASE_URL.";
  }
  if (code === "ETIMEDOUT" || /timeout/i.test(message)) {
    return "Timed out connecting to the database. Check your network or VPN.";
  }
  return message.length > 300 ? `${message.slice(0, 300)}…` : message;
}

async function checkDns(hostname: string): Promise<HealthCheck> {
  try {
    const addresses = await Promise.race([
      lookup(hostname),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("DNS lookup timed out")), DNS_TIMEOUT_MS),
      ),
    ]);
    const list = Array.isArray(addresses) ? addresses : [addresses];
    const first = list[0];
    const ip = typeof first === "string" ? first : first?.address;
    return { ok: true, detail: `${hostname} resolves to ${ip ?? "an unknown address"}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      detail: `${hostname} does not resolve from this server. ${
        /timed out/i.test(message) ? "Lookup timed out." : "DNS returned NXDOMAIN."
      } A Supabase project that has been deleted stops resolving.`,
    };
  }
}

async function checkAuthEndpoint(baseUrl: string, anonKey: string | null): Promise<HealthCheck> {
  if (!anonKey) {
    return { ok: false, detail: "Skipped — NEXT_PUBLIC_SUPABASE_ANON_KEY is missing." };
  }

  try {
    const response = await fetch(`${baseUrl}/auth/v1/health`, {
      method: "GET",
      headers: { apikey: anonKey },
      signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
      cache: "no-store",
    });

    if (response.ok) {
      return { ok: true, detail: "Supabase Auth API is reachable." };
    }
    return {
      ok: false,
      detail: `Supabase Auth API responded with HTTP ${response.status}.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const timedOut = /timeout|abort/i.test(message);
    return {
      ok: false,
      detail: timedOut
        ? "Supabase Auth API did not respond in time."
        : `Could not reach the Supabase Auth API (${message}).`,
    };
  }
}

/**
 * Opens a short-lived connection rather than reusing the shared `db` client: a
 * cached broken handle would report the original failure forever, and the shared
 * client has no connect timeout.
 */
async function checkDatabase(databaseUrl: string | null): Promise<HealthCheck> {
  if (!databaseUrl) {
    return { ok: false, detail: "Skipped — DATABASE_URL is missing." };
  }

  let client: ReturnType<typeof postgres> | null = null;
  try {
    client = postgres(databaseUrl, {
      connect_timeout: DB_TIMEOUT_MS,
      max: 1,
      prepare: false,
      idle_timeout: 1,
    });
    await client`select 1`;
    return { ok: true, detail: "Connected to Postgres successfully." };
  } catch (error) {
    return { ok: false, detail: describeDatabaseError(error) };
  } finally {
    if (client) await client.end({ timeout: 1 }).catch(() => undefined);
  }
}

function checkEnvironment(): {
  check: HealthCheck;
  baseUrl: string | null;
  anonKey: string | null;
  databaseUrl: string | null;
} {
  const baseUrlRaw = readVar("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = readVar("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRoleKey = readVar("SUPABASE_SERVICE_ROLE_KEY");
  const databaseUrl = readVar("DATABASE_URL");

  const problems: string[] = [];
  if (!baseUrlRaw) problems.push("NEXT_PUBLIC_SUPABASE_URL is not set");
  else if (PLACEHOLDER_PATTERN.test(baseUrlRaw))
    problems.push("NEXT_PUBLIC_SUPABASE_URL still contains a placeholder");

  if (!anonKey) problems.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
  else if (PLACEHOLDER_PATTERN.test(anonKey))
    problems.push("NEXT_PUBLIC_SUPABASE_ANON_KEY still contains a placeholder");

  if (!serviceRoleKey) problems.push("SUPABASE_SERVICE_ROLE_KEY is not set");
  else if (PLACEHOLDER_PATTERN.test(serviceRoleKey))
    problems.push("SUPABASE_SERVICE_ROLE_KEY still contains a placeholder");

  if (!databaseUrl) problems.push("DATABASE_URL is not set");

  return {
    check: {
      ok: problems.length === 0,
      detail:
        problems.length === 0
          ? "All required environment variables are set."
          : problems.join("; "),
    },
    baseUrl: baseUrlRaw ? normaliseBaseUrl(baseUrlRaw) : null,
    anonKey,
    databaseUrl,
  };
}

/** Chooses the single most useful next action from the individual checks. */
function buildRemedy(report: SupabaseHealthReport): string | null {
  const { env, dns, auth, database } = report.checks;

  if (!env.ok) {
    return "Copy .env.example to .env.local and fill in your Supabase project URL, anon key, service role key and DATABASE_URL. Then restart the dev server.";
  }
  if (!dns.ok) {
    const ref = report.projectRef ?? "<project-ref>";
    return `The Supabase project "${ref}" is not reachable from this server. Open the Supabase dashboard and confirm the project still exists. If it was deleted, create a new project, copy its URL/keys into .env.local, then run: npx drizzle-kit push, npm run db:seed, npm run db:seed-auth. After changing NEXT_PUBLIC_* values also delete the .next folder so the client bundle picks them up.`;
  }
  if (!auth.ok) {
    return "The project hostname resolves but the Auth API does not answer. Verify NEXT_PUBLIC_SUPABASE_ANON_KEY belongs to this project and that the project's API is enabled.";
  }
  if (!database.ok) {
    return "Auth is reachable but the database is not. Re-run: npx drizzle-kit push, then npm run db:seed to rebuild the schema and demo data.";
  }
  return null;
}

export async function getSupabaseHealth(): Promise<SupabaseHealthReport> {
  const { check: envCheck, baseUrl, anonKey, databaseUrl } = checkEnvironment();

  const projectRef = baseUrl ? extractProjectRef(baseUrl) : null;

  // Skip downstream probes when the URL itself is unusable — otherwise every
  // check fails for the same single reason and the report gets noisy.
  if (!baseUrl) {
    const skipped: HealthCheck = { ok: false, detail: "Skipped — no Supabase URL to probe." };
    const report: SupabaseHealthReport = {
      ok: false,
      projectRef,
      checks: {
        env: envCheck,
        dns: skipped,
        auth: { ...skipped },
        database: await checkDatabase(databaseUrl),
      },
      remedy: null,
    };
    report.remedy = buildRemedy(report);
    return report;
  }

  const [dns, auth, database] = await Promise.all([
    checkDns(new URL(baseUrl).hostname),
    checkAuthEndpoint(baseUrl, anonKey),
    checkDatabase(databaseUrl),
  ]);

  const report: SupabaseHealthReport = {
    ok: envCheck.ok && dns.ok && auth.ok && database.ok,
    projectRef,
    checks: { env: envCheck, dns, auth, database },
    remedy: null,
  };
  report.remedy = buildRemedy(report);
  return report;
}
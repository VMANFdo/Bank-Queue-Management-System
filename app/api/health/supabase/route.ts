import { NextResponse } from "next/server";
import { getSupabaseHealth } from "@/lib/supabase/health";

/**
 * Reports whether the Supabase project and database are actually usable.
 *
 * Deliberately public and unauthenticated so the login page can call it before
 * a session exists — a dead project otherwise only surfaces as a silent
 * `TypeError: Failed to fetch` in the browser console.
 *
 * Safe to expose: the report contains hostnames and pass/fail reasons, never
 * keys or connection strings.
 */
export async function GET() {
  try {
    const report = await getSupabaseHealth();

    return NextResponse.json(report, {
      status: report.ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Supabase health check failed:", error);
    return NextResponse.json(
      {
        ok: false,
        projectRef: null,
        checks: {},
        remedy:
          "The diagnostic endpoint itself failed. Check the server logs for the underlying error.",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export const dynamic = "force-dynamic";
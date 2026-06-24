import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { branches, counters, services, counterServices } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const activeBranches = await db.select().from(branches).where(eq(branches.isActive, true));
    const allCounters = await db.select().from(counters);
    const allServices = await db.select().from(services).where(eq(services.isActive, true));
    const mappings = await db.select().from(counterServices);

    return NextResponse.json({
      branches: activeBranches,
      counters: allCounters,
      services: allServices,
      counterServices: mappings,
    });
  } catch (error: any) {
    console.error("Setup fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
export const dynamic = "force-dynamic";

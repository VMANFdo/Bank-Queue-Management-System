import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { branches, tickets, counters } from "@/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

function getCrowdLevel(waitingCount: number): "low" | "moderate" | "busy" {
  if (waitingCount < 10) return "low";
  if (waitingCount <= 25) return "moderate";
  return "busy";
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bankCode = searchParams.get("bank");

    const conditions = [eq(branches.isActive, true)];
    if (bankCode) {
      conditions.push(eq(branches.bankCode, bankCode.toUpperCase()));
    }

    const activeBranches = await db
      .select()
      .from(branches)
      .where(and(...conditions));

    const branchesWithMetrics = await Promise.all(
      activeBranches.map(async (branch) => {
        // Total waiting tickets across all counters in this branch
        const [{ count: waitingCount }] = await db
          .select({ count: sql<number>`count(*)` })
          .from(tickets)
          .where(
            and(
              eq(tickets.branchId, branch.id),
              inArray(tickets.status, ["waiting", "called"])
            )
          );

        // Average wait estimate: rough estimate based on open counters + queue depth
        const openCountersRes = await db
          .select({ count: sql<number>`count(*)` })
          .from(counters)
          .where(
            and(
              eq(counters.branchId, branch.id),
              eq(counters.status, "available")
            )
          );
        const openCounters = Number(openCountersRes[0]?.count || 0);
        const totalWaiting = Number(waitingCount || 0);

        // Rough branch-level wait: assume avg 8 min service time across all services
        const avgWaitMinutes =
          openCounters > 0
            ? Math.round((totalWaiting * 8) / openCounters)
            : totalWaiting * 8;

        return {
          id: branch.id,
          name: branch.name,
          address: branch.address,
          lat: branch.lat,
          lng: branch.lng,
          phone: branch.phone,
          bankCode: branch.bankCode,
          isActive: branch.isActive,
          waitingCount: totalWaiting,
          waitTimeMinutes: Math.max(0, avgWaitMinutes),
          crowdLevel: getCrowdLevel(totalWaiting),
          openCounters,
        };
      })
    );

    return NextResponse.json(branchesWithMetrics);
  } catch (error: any) {
    console.error("Error fetching branches:", error);
    return NextResponse.json(
      { error: "Failed to fetch branches" },
      { status: 500 }
    );
  }
}

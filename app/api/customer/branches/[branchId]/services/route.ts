import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { services, tickets, counters, counterServices } from "@/db/schema";
import { eq, and, inArray, sql, or } from "drizzle-orm";
import { computeWaitEstimate } from "@/lib/queue/estimation";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ branchId: string }> }
) {
  try {
    const { branchId } = await params;

    const activeServices = await db
      .select()
      .from(services)
      .where(and(eq(services.branchId, branchId), eq(services.isActive, true)));

    const servicesWithMetrics = await Promise.all(
      activeServices.map(async (svc) => {
        // Count waiting tickets for this service
        const [{ count: waitingCount }] = await db
          .select({ count: sql<number>`count(*)` })
          .from(tickets)
          .where(
            and(
              eq(tickets.branchId, branchId),
              eq(tickets.serviceId, svc.id),
              inArray(tickets.status, ["waiting", "called"])
            )
          );

        // Count open counters serving this service
        const openCountersRes = await db
          .select({ count: sql<number>`count(*)` })
          .from(counters)
          .innerJoin(counterServices, eq(counters.id, counterServices.counterId))
          .where(
            and(
              eq(counters.branchId, branchId),
              eq(counterServices.serviceId, svc.id),
              or(eq(counters.status, "available"), eq(counters.status, "on_break"))
            )
          );

        const openCounters = Number(openCountersRes[0]?.count || 0);
        const totalWaiting = Number(waitingCount || 0);

        // Use real estimation function for wait time
        const waitEstimate = await computeWaitEstimate(branchId, svc.id, "standard");

        return {
          id: svc.id,
          branchId: svc.branchId,
          name: svc.name,
          nameSi: svc.nameSi,
          nameTa: svc.nameTa,
          icon: svc.icon,
          category: svc.category,
          avgServiceTimeMinutes: svc.avgServiceTimeMinutes,
          nicRequired: svc.nicRequired,
          waitingCount: totalWaiting,
          waitTimeMinutes: Math.round(waitEstimate),
          openCounters,
        };
      })
    );

    return NextResponse.json(servicesWithMetrics);
  } catch (error: any) {
    console.error("Error fetching services:", error);
    return NextResponse.json(
      { error: "Failed to fetch services" },
      { status: 500 }
    );
  }
}

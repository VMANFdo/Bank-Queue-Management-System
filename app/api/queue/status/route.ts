import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { counters, tickets, counterServices } from "@/db/schema";
import { eq, inArray, and, asc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const counterId = searchParams.get("counterId");

    if (!counterId) {
      return NextResponse.json({ error: "Missing counterId" }, { status: 400 });
    }

    // 1. Get counter
    const [counter] = await db
      .select()
      .from(counters)
      .where(eq(counters.id, counterId));

    if (!counter) {
      return NextResponse.json({ error: "Counter not found" }, { status: 404 });
    }

    // 2. Get services for this counter
    const handledServices = await db
      .select({ serviceId: counterServices.serviceId })
      .from(counterServices)
      .where(eq(counterServices.counterId, counterId));

    const serviceIds = handledServices.map((s) => s.serviceId);

    // 3. Get current ticket
    let currentTicket = null;
    if (counter.currentTicketId) {
      const [ticket] = await db
        .select()
        .from(tickets)
        .where(eq(tickets.id, counter.currentTicketId));
      currentTicket = ticket || null;
    }

    // 4. Get upcoming queue (waiting tickets for this counter's services)
    let upcomingQueue: any[] = [];
    if (serviceIds.length > 0) {
      upcomingQueue = await db
        .select()
        .from(tickets)
        .where(
          and(
            eq(tickets.branchId, counter.branchId),
            eq(tickets.status, "waiting"),
            inArray(tickets.serviceId, serviceIds)
          )
        )
        .orderBy(asc(tickets.createdAt))
        .limit(5);
    }

    return NextResponse.json({
      counter,
      currentTicket,
      upcomingQueue,
      serviceIds,
    });
  } catch (error: any) {
    console.error("Queue status route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
export const dynamic = "force-dynamic";

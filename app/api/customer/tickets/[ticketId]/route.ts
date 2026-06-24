import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { tickets, counters, services } from "@/db/schema";
import { eq, and, inArray, asc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const { ticketId } = await params;

    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId));

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Calculate position in queue (only for waiting tickets)
    let position: number | null = null;
    if (ticket.status === "waiting") {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(tickets)
        .where(
          and(
            eq(tickets.branchId, ticket.branchId),
            eq(tickets.serviceId, ticket.serviceId),
            eq(tickets.pool, ticket.pool),
            eq(tickets.status, "waiting"),
            // Count only tickets ahead of this one (created before it)
            sql`${tickets.createdAt} <= ${ticket.createdAt}`
          )
        );
      position = Number(count);
    }

    // Get service details
    const [service] = await db
      .select({ name: services.name, nameSi: services.nameSi, nameTa: services.nameTa, category: services.category })
      .from(services)
      .where(eq(services.id, ticket.serviceId));

    // Get counter name if assigned
    let counterName: string | null = null;
    if (ticket.counterId) {
      const [counter] = await db
        .select({ name: counters.name })
        .from(counters)
        .where(eq(counters.id, ticket.counterId));
      counterName = counter?.name ?? null;
    }

    // Get linked ticket summary if any
    let linkedTicket: { id: string; tokenNumber: string; status: string; serviceName: string } | null = null;
    if (ticket.linkedTicketId) {
      const [linked] = await db
        .select()
        .from(tickets)
        .where(eq(tickets.id, ticket.linkedTicketId));
      if (linked) {
        const [linkedService] = await db
          .select({ name: services.name })
          .from(services)
          .where(eq(services.id, linked.serviceId));
        linkedTicket = {
          id: linked.id,
          tokenNumber: linked.tokenNumber,
          status: linked.status,
          serviceName: linkedService?.name ?? "Service",
        };
      }
    }

    // Rough wait estimate: position * avgServiceTime / openCounters
    const avgServiceTime = service ? 8 : 8;
    const waitEstimateMinutes = position ? Math.max(1, (position - 1) * avgServiceTime) : 0;

    return NextResponse.json({
      id: ticket.id,
      tokenNumber: ticket.tokenNumber,
      pool: ticket.pool,
      status: ticket.status,
      position,
      waitEstimateMinutes,
      customerName: ticket.customerName,
      serviceId: ticket.serviceId,
      service: service ?? null,
      counterName,
      linkedTicket,
      calledAt: ticket.calledAt,
      doneAt: ticket.doneAt,
      createdAt: ticket.createdAt,
      branchId: ticket.branchId,
    });
  } catch (error: any) {
    console.error("Ticket fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch ticket" }, { status: 500 });
  }
}

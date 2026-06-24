import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { counters } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const counterStatusSchema = z.object({
  counterId: z.string().uuid("Invalid counter ID"),
  status: z.enum(["available", "closed"]),
});

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireRole("teller");

    const body = await request.json();
    const parsed = counterStatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { counterId, status } = parsed.data;

    // Run in transaction to update counter status
    const result = await db.transaction(async (tx) => {
      const [counter] = await tx
        .select()
        .from(counters)
        .where(eq(counters.id, counterId))
        .for("update");

      if (!counter) throw new Error("Counter not found");

      if (status === "available") {
        const [updated] = await tx
          .update(counters)
          .set({
            status: "available",
            assignedTellerId: user.id,
          })
          .where(eq(counters.id, counterId))
          .returning();
        return updated;
      } else {
        const [updated] = await tx
          .update(counters)
          .set({
            status: "closed",
            assignedTellerId: null,
            currentTicketId: null,
          })
          .where(eq(counters.id, counterId))
          .returning();
        return updated;
      }
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("Error in counter-status route:", error);
    const status = error.message?.includes("Access denied") || error.message?.includes("Unauthorized") ? 403 : 500;
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status }
    );
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { transfer } from "@/lib/queue/engine";
import { transferSchema } from "@/lib/queue/schemas";

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireRole("teller");

    const body = await request.json();
    const parsed = transferSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { ticketId, destinationServiceId, reason } = parsed.data;

    const result = await transfer(ticketId, destinationServiceId, user.id, reason);

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("Error in transfer route:", error);
    const status = error.message?.includes("Access denied") || error.message?.includes("Unauthorized") ? 403 : 500;
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status }
    );
  }
}

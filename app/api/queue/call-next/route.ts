import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { callNext } from "@/lib/queue/engine";
import { callNextSchema } from "@/lib/queue/schemas";

export async function POST(request: NextRequest) {
  try {
    // 1. Guard route for tellers
    const { user } = await requireRole("teller");

    // 2. Validate request
    const body = await request.json();
    const parsed = callNextSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { counterId } = parsed.data;

    // 3. Call next ticket
    const result = await callNext(counterId, user.id);

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("Error in call-next route:", error);
    const status = error.message?.includes("Access denied") || error.message?.includes("Unauthorized") ? 403 : 500;
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status }
    );
  }
}

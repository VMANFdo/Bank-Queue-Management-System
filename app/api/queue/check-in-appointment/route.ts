import { NextResponse, type NextRequest } from "next/server";
import { checkInAppointment } from "@/lib/queue/engine";
import { checkInAppointmentSchema } from "@/lib/queue/schemas";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = checkInAppointmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { appointmentId, method } = parsed.data;

    const result = await checkInAppointment(appointmentId, method);

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("Error in check-in-appointment route:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

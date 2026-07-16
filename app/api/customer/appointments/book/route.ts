import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { appointments } from "@/db/schema";
import { bookAppointmentSchema } from "@/lib/queue/schemas";
import { generateBookingCode } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = bookAppointmentSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: result.error.format() },
        { status: 400 }
      );
    }

    const { branchId, serviceId, slotTime, customerDetails, language } = result.data;

    const windowStart = new Date(slotTime);
    const windowEnd = new Date(windowStart);
    windowEnd.setMinutes(windowEnd.getMinutes() + 20); // 20-minute window

    const bookingCode = generateBookingCode();

    const [appointment] = await db
      .insert(appointments)
      .values({
        branchId,
        serviceId,
        customerName: customerDetails.name,
        customerPhone: customerDetails.phone,
        nic: customerDetails.nic ?? "",
        bookingCode,
        windowStart,
        windowEnd,
        status: "pending",
        // language preference might be saved if the schema supported it, or passed via SMS module
      })
      .returning();

    // Mock SMS Sending
    console.log(`[SMS] Sending ${language} confirmation to ${customerDetails.phone} for booking ${bookingCode}`);

    return NextResponse.json({
      success: true,
      appointment,
      bookingCode,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
    });
  } catch (error: unknown) {
    console.error("Booking appointment error:", error);
    return NextResponse.json({ error: "Failed to book appointment" }, { status: 500 });
  }
}

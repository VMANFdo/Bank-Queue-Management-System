import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { appointments, services, branches } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ appointmentId: string }> }
) {
  try {
    const { appointmentId } = await params;

    const [appointment] = await db
      .select({
        id: appointments.id,
        branchId: appointments.branchId,
        serviceId: appointments.serviceId,
        bookingCode: appointments.bookingCode,
        windowStart: appointments.windowStart,
        windowEnd: appointments.windowEnd,
        status: appointments.status,
        customerName: appointments.customerName,
        customerPhone: appointments.customerPhone,
        nic: appointments.nic,
        arrivalConfirmedAt: appointments.arrivalConfirmedAt,
        branchName: branches.name,
        branchAddress: branches.address,
        serviceName: services.name,
      })
      .from(appointments)
      .innerJoin(branches, eq(appointments.branchId, branches.id))
      .innerJoin(services, eq(appointments.serviceId, services.id))
      .where(eq(appointments.id, appointmentId));

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    return NextResponse.json(appointment);
  } catch (error: unknown) {
    console.error("Appointment fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch appointment" }, { status: 500 });
  }
}

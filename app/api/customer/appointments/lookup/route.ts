import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { appointments, services, branches } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId");
    const bookingCode = searchParams.get("bookingCode");
    const nic = searchParams.get("nic");

    if (!branchId || (!bookingCode && !nic)) {
      return NextResponse.json(
        { error: "branchId and bookingCode or nic are required" },
        { status: 400 }
      );
    }

    const conditions = [eq(appointments.branchId, branchId)];
    if (bookingCode) conditions.push(eq(appointments.bookingCode, bookingCode));
    if (nic) conditions.push(eq(appointments.nic, nic));

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
      .where(and(...conditions));

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    return NextResponse.json(appointment);
  } catch (error: unknown) {
    console.error("Appointment lookup error:", error);
    return NextResponse.json({ error: "Failed to look up appointment" }, { status: 500 });
  }
}

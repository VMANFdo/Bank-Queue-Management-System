import { NextResponse, type NextRequest } from "next/server";
import { computeEarliestAppointmentSlot } from "@/lib/queue/estimation";
import { db } from "@/lib/db";
import { services, branchConfig, appointmentCaps, appointments } from "@/db/schema";
import { eq, and, gte, lt, inArray, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Bank open hours: 8:30 AM to 3:30 PM (LKT)
const BANK_OPEN_HOUR = 8;
const BANK_OPEN_MINUTE = 30;
const BANK_CLOSE_HOUR = 15;
const BANK_CLOSE_MINUTE = 30;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ branchId: string }> }
) {
  try {
    const { branchId } = await params;
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get("serviceId");
    const dateStr = searchParams.get("date"); // YYYY-MM-DD

    if (!serviceId || !dateStr) {
      return NextResponse.json(
        { error: "Missing serviceId or date query parameters" },
        { status: 400 }
      );
    }

    // Parse requested date
    const [year, month, day] = dateStr.split("-").map(Number);
    const requestedDate = new Date(year, month - 1, day);

    // Reject weekends (Saturday = 6, Sunday = 0)
    const dayOfWeek = requestedDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return NextResponse.json({ slots: [], reason: "Branch is closed on weekends" });
    }

    // Get service category + branch config
    const [svc] = await db.select().from(services).where(eq(services.id, serviceId));
    if (!svc) return NextResponse.json({ error: "Service not found" }, { status: 404 });

    const [config] = await db
      .select()
      .from(branchConfig)
      .where(eq(branchConfig.branchId, branchId));

    const bufferMins = config?.appointmentBufferMinutes ?? 15;

    // Generate all 15-minute slots for the day
    const slots: Array<{
      time: string; // ISO string
      label: string; // "9:00 AM"
      status: "available" | "full" | "too_soon";
      remainingCapacity: number;
      reason?: string;
    }> = [];

    // Enumerate 15-minute slots from open to close
    const slotStart = new Date(requestedDate);
    slotStart.setHours(BANK_OPEN_HOUR, BANK_OPEN_MINUTE, 0, 0);
    const slotEnd = new Date(requestedDate);
    slotEnd.setHours(BANK_CLOSE_HOUR, BANK_CLOSE_MINUTE, 0, 0);

    const now = new Date();
    const isSameDay = now.toDateString() === requestedDate.toDateString();

    // Fetch appointment caps per hour for this service category
    const caps = await db
      .select()
      .from(appointmentCaps)
      .where(
        and(
          eq(appointmentCaps.branchId, branchId),
          eq(appointmentCaps.serviceCategory, svc.category)
        )
      );

    const capMap: Record<number, number> = {};
    for (const cap of caps) {
      capMap[cap.hourOfDay] = cap.maxBookings;
    }

    const cursor = new Date(slotStart);
    while (cursor < slotEnd) {
      const slotTime = new Date(cursor);
      const slotHour = slotTime.getHours();
      const slotMinute = slotTime.getMinutes();

      // Count existing bookings in the same 15-min window (start of slot to start+15min)
      const windowEnd = new Date(slotTime);
      windowEnd.setMinutes(windowEnd.getMinutes() + 15);

      const [{ count: existingCount }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(appointments)
        .where(
          and(
            eq(appointments.branchId, branchId),
            eq(appointments.serviceId, serviceId),
            gte(appointments.windowStart, slotTime),
            lt(appointments.windowStart, windowEnd),
            inArray(appointments.status, ["pending", "checked_in", "completed"])
          )
        );

      const maxPerSlot = Math.floor((capMap[slotHour] ?? 4) / 4); // 4 slots per hour → per 15-min
      const remaining = Math.max(0, maxPerSlot - Number(existingCount));
      const isFull = remaining === 0;

      // Check "too soon" — only applicable for same-day slots
      let isTooSoon = false;
      let tooSoonReason = "";
      if (isSameDay) {
        // Slot must be at least bufferMins from now
        const bufferDeadline = new Date(now.getTime() + bufferMins * 60 * 1000);
        if (slotTime <= bufferDeadline) {
          isTooSoon = true;
          tooSoonReason = `Available in ~${Math.ceil((bufferDeadline.getTime() - slotTime.getTime()) / 60000)} min`;
        }
      }

      // Format label as "8:30 AM"
      const label = slotTime.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

      slots.push({
        time: slotTime.toISOString(),
        label,
        status: isFull ? "full" : isTooSoon ? "too_soon" : "available",
        remainingCapacity: remaining,
        reason: isFull ? "Slot fully booked" : tooSoonReason || undefined,
      });

      cursor.setMinutes(cursor.getMinutes() + 15);
    }

    // Find the earliest available slot
    const earliestAvailable = slots.find((s) => s.status === "available");

    return NextResponse.json({
      slots,
      earliestAvailable: earliestAvailable?.time ?? null,
      date: dateStr,
      serviceId,
      branchId,
    });
  } catch (error: any) {
    console.error("Error fetching slots:", error);
    return NextResponse.json({ error: "Failed to fetch slots" }, { status: 500 });
  }
}

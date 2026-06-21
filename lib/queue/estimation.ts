import { db } from "@/lib/db";
import { services, counters, counterServices, tickets, branchConfig, appointmentCaps, appointments } from "@/db/schema";
import { and, eq, inArray, or, sql, gte, lt } from "drizzle-orm";

/**
 * Compute wait estimate in minutes for a service at a branch.
 * Formula: (queueDepth * avgServiceTimeMinutes) / max(1, openCountersCount)
 */
export async function computeWaitEstimate(
  branchId: string,
  serviceId: string,
  pool: "appointment" | "priority" | "standard"
): Promise<number> {
  // 1. Get the average service time
  const [service] = await db
    .select({
      avgServiceTimeMinutes: services.avgServiceTimeMinutes,
    })
    .from(services)
    .where(and(eq(services.id, serviceId), eq(services.branchId, branchId)));

  if (!service) return 10; // default fallback

  const avgServiceTime = service.avgServiceTimeMinutes || 10;

  // 2. Find open counters that handle this service
  const openCounters = await db
    .select({
      id: counters.id,
    })
    .from(counters)
    .innerJoin(counterServices, eq(counters.id, counterServices.counterId))
    .where(
      and(
        eq(counters.branchId, branchId),
        eq(counterServices.serviceId, serviceId),
        or(eq(counters.status, "available"), eq(counters.status, "on_break"))
      )
    );

  const numOpenCounters = Math.max(1, openCounters.length);

  // 3. Find queue depth (number of waiting tickets for this service)
  const result = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(tickets)
    .where(
      and(
        eq(tickets.branchId, branchId),
        eq(tickets.serviceId, serviceId),
        inArray(tickets.status, ["waiting", "called"])
      )
    );

  const queueDepth = Number(result[0]?.count || 0);

  // Calculate wait time
  const waitMinutes = (queueDepth * avgServiceTime) / numOpenCounters;

  // Add pool-specific adjustments: appointments are served first, priority next
  if (pool === "appointment") {
    return Math.max(5, waitMinutes * 0.2); // Very low wait
  } else if (pool === "priority") {
    return Math.max(5, waitMinutes * 0.5); // Lower wait
  }

  return Math.max(5, waitMinutes);
}

/**
 * Check if the requested slot is available based on branch caps and live queue depth.
 * Suggests the earliest available slot if the requested one is full or invalid.
 */
export async function computeEarliestAppointmentSlot(
  branchId: string,
  serviceId: string,
  requestedTime: Date
): Promise<{
  isAvailable: boolean;
  earliestAvailableSlot: Date;
  reason?: string;
}> {
  // Get service details (category)
  const [service] = await db
    .select({
      category: services.category,
    })
    .from(services)
    .where(eq(services.id, serviceId));

  if (!service) {
    throw new Error("Service not found");
  }

  const category = service.category;

  // Align requestedTime to 15-minute intervals
  const targetTime = new Date(requestedTime);
  const minutes = targetTime.getMinutes();
  const remainder = minutes % 15;
  targetTime.setMinutes(minutes - remainder, 0, 0);

  const hour = targetTime.getHours();

  // 1. Fetch branch config (buffer, window, etc.)
  const [config] = await db
    .select()
    .from(branchConfig)
    .where(eq(branchConfig.branchId, branchId));

  const bufferMinutes = config?.appointmentBufferMinutes || 15;

  // 2. Fetch hourly cap for this service category
  const [cap] = await db
    .select({
      maxBookings: appointmentCaps.maxBookings,
    })
    .from(appointmentCaps)
    .where(
      and(
        eq(appointmentCaps.branchId, branchId),
        eq(appointmentCaps.serviceCategory, category),
        eq(appointmentCaps.hourOfDay, hour)
      )
    );

  const maxBookings = cap?.maxBookings ?? 4; // default to 4 slots/hr

  // 3. Count existing appointments in the same hour
  const startOfHour = new Date(targetTime);
  startOfHour.setMinutes(0, 0, 0);
  const endOfHour = new Date(targetTime);
  endOfHour.setMinutes(59, 59, 999);

  const [{ count }] = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.branchId, branchId),
        eq(appointments.serviceId, serviceId),
        gte(appointments.windowStart, startOfHour),
        lt(appointments.windowStart, endOfHour),
        inArray(appointments.status, ["pending", "checked_in", "completed"])
      )
    );

  // Check if count exceeds cap
  if (count >= maxBookings) {
    // Hour is full, suggest next hour
    const nextHourTime = new Date(targetTime);
    nextHourTime.setHours(hour + 1, 0, 0, 0);
    return {
      isAvailable: false,
      earliestAvailableSlot: nextHourTime,
      reason: `Hourly cap of ${maxBookings} bookings reached for this service category.`,
    };
  }

  // 4. Check live wait time to ensure estimated clear time + buffer fits
  const waitEstimate = await computeWaitEstimate(branchId, serviceId, "appointment");
  const estimatedClearTime = new Date();
  estimatedClearTime.setMinutes(estimatedClearTime.getMinutes() + waitEstimate);

  const earliestAllowedTime = new Date(estimatedClearTime);
  earliestAllowedTime.setMinutes(earliestAllowedTime.getMinutes() + bufferMinutes);

  if (targetTime < earliestAllowedTime) {
    // Target time is too soon, suggest earliest slot that fits the buffer
    const suggestedTime = new Date(earliestAllowedTime);
    const m = suggestedTime.getMinutes();
    const rem = m % 15;
    suggestedTime.setMinutes(m + (15 - rem), 0, 0); // round up to next 15-minute slot
    return {
      isAvailable: false,
      earliestAvailableSlot: suggestedTime,
      reason: `Live queue depth requires a buffer of at least ${bufferMinutes} minutes.`,
    };
  }

  return {
    isAvailable: true,
    earliestAvailableSlot: targetTime,
  };
}

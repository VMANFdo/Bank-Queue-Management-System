import { db } from "@/lib/db";
import {
  tickets,
  counters,
  counterServices,
  branchConfig,
  appointments,
  nicRecords,
  notifications,
  auditLog,
  services,
} from "@/db/schema";
import { and, eq, inArray, or, sql, desc, asc, not, ne, gte, lte } from "drizzle-orm";
import { generateTokenNumber } from "./token";
import { computeWaitEstimate } from "./estimation";

/**
 * Get the next ticket to serve for a counter based on the 3-pool priority logic:
 * 1. Active checked-in appointments (window_start <= NOW)
 * 2. Priority interleaving (standard ratio reached -> priority ticket)
 * 3. Standard FIFO
 */
export async function getNextTicketForCounter(
  counterId: string,
  tx: any = db
): Promise<any> {
  // 1. Fetch counter details to know its branch and services
  const [counter] = await tx
    .select()
    .from(counters)
    .where(eq(counters.id, counterId));

  if (!counter) {
    throw new Error("Counter not found");
  }

  // Get services handled by this counter
  const handledServices = await tx
    .select({ serviceId: counterServices.serviceId })
    .from(counterServices)
    .where(eq(counterServices.counterId, counterId));

  const serviceIds = handledServices.map((s: any) => s.serviceId);
  if (serviceIds.length === 0) return null;

  const now = new Date();

  // A. Check for checked-in appointments first
  const [nextAppointmentTicket] = await tx
    .select({ ticket: tickets })
    .from(tickets)
    .innerJoin(appointments, eq(tickets.id, appointments.ticketId))
    .where(
      and(
        eq(tickets.branchId, counter.branchId),
        eq(tickets.status, "waiting"),
        eq(tickets.pool, "appointment"),
        inArray(tickets.serviceId, serviceIds),
        eq(appointments.status, "checked_in"),
        lte(appointments.windowStart, now)
      )
    )
    .orderBy(asc(tickets.createdAt))
    .limit(1);

  if (nextAppointmentTicket) {
    return nextAppointmentTicket.ticket;
  }

  // B. Priority Interleaving Logic
  // Fetch branch config for priority ratio
  const [config] = await tx
    .select()
    .from(branchConfig)
    .where(eq(branchConfig.branchId, counter.branchId));

  const priorityRatioStandard = config?.priorityRatioStandard ?? 3;

  // Find standard tickets served since last priority ticket at this counter
  const [lastPriorityCalled] = await tx
    .select()
    .from(tickets)
    .where(
      and(
        eq(tickets.counterId, counterId),
        eq(tickets.pool, "priority"),
        inArray(tickets.status, ["called", "in_service", "done", "no_show", "transferred"])
      )
    )
    .orderBy(desc(tickets.calledAt))
    .limit(1);

  let standardTicketsCount = 0;
  if (lastPriorityCalled) {
    const result = await tx
      .select({ count: sql<number>`count(*)` })
      .from(tickets)
      .where(
        and(
          eq(tickets.counterId, counterId),
          eq(tickets.pool, "standard"),
          inArray(tickets.status, ["called", "in_service", "done", "no_show", "transferred"]),
          gte(tickets.calledAt, lastPriorityCalled.calledAt)
        )
      );
    standardTicketsCount = Number(result[0]?.count || 0);
  } else {
    const result = await tx
      .select({ count: sql<number>`count(*)` })
      .from(tickets)
      .where(
        and(
          eq(tickets.counterId, counterId),
          eq(tickets.pool, "standard"),
          inArray(tickets.status, ["called", "in_service", "done", "no_show", "transferred"])
        )
      );
    standardTicketsCount = Number(result[0]?.count || 0);
  }

  // If ratio reached, try priority first
  if (standardTicketsCount >= priorityRatioStandard) {
    const [priorityTicket] = await tx
      .select()
      .from(tickets)
      .where(
        and(
          eq(tickets.branchId, counter.branchId),
          eq(tickets.status, "waiting"),
          eq(tickets.pool, "priority"),
          inArray(tickets.serviceId, serviceIds)
        )
      )
      .orderBy(asc(tickets.createdAt))
      .limit(1);

    if (priorityTicket) return priorityTicket;
  }

  // C. Fallback to standard FIFO
  const [standardTicket] = await tx
    .select()
    .from(tickets)
    .where(
      and(
        eq(tickets.branchId, counter.branchId),
        eq(tickets.status, "waiting"),
        eq(tickets.pool, "standard"),
        inArray(tickets.serviceId, serviceIds)
      )
    )
    .orderBy(asc(tickets.createdAt))
    .limit(1);

  if (standardTicket) return standardTicket;

  // D. If standard is empty but priority ratio was not reached, try priority anyway
  const [anyPriorityTicket] = await tx
    .select()
    .from(tickets)
    .where(
      and(
        eq(tickets.branchId, counter.branchId),
        eq(tickets.status, "waiting"),
        eq(tickets.pool, "priority"),
        inArray(tickets.serviceId, serviceIds)
      )
    )
    .orderBy(asc(tickets.createdAt))
    .limit(1);

  return anyPriorityTicket || null;
}

/**
 * Issue a ticket (or linked ticket pair) for a customer.
 */
export async function issueTicket(
  branchId: string,
  serviceId: string,
  pool: "appointment" | "priority" | "standard",
  customerDetails: { name: string; phone: string; nic?: string },
  linkedServiceId?: string,
  language: "en" | "si" | "ta" = "en"
): Promise<any> {
  return await db.transaction(async (tx) => {
    // 1. Generate token
    const tokenNumber = await generateTokenNumber(branchId, pool, tx);
    const waitEstimate = await computeWaitEstimate(branchId, serviceId, pool);

    // 2. Insert primary ticket
    const [ticket] = await tx
      .insert(tickets)
      .values({
        branchId,
        tokenNumber,
        serviceId,
        pool,
        status: "waiting",
        customerName: customerDetails.name,
        customerPhone: customerDetails.phone,
        nic: customerDetails.nic || null,
        language,
        originalWaitEstimateMinutes: Math.round(waitEstimate),
      })
      .returning();

    let linkedTicket = null;

    // 3. Handle linked ticket if requested
    if (linkedServiceId) {
      const linkedTokenNumber = await generateTokenNumber(branchId, pool, tx);
      const linkedWaitEstimate = await computeWaitEstimate(branchId, linkedServiceId, pool);

      const [insertedLinked] = await tx
        .insert(tickets)
        .values({
          branchId,
          tokenNumber: linkedTokenNumber,
          serviceId: linkedServiceId,
          pool,
          status: "waiting",
          customerName: customerDetails.name,
          customerPhone: customerDetails.phone,
          nic: customerDetails.nic || null,
          language,
          originalWaitEstimateMinutes: Math.round(linkedWaitEstimate),
          linkedTicketId: ticket.id,
        })
        .returning();

      linkedTicket = insertedLinked;

      // Update primary ticket to point to linked ticket
      await tx
        .update(tickets)
        .set({ linkedTicketId: linkedTicket.id })
        .where(eq(tickets.id, ticket.id));

      ticket.linkedTicketId = linkedTicket.id;
    }

    // 4. Log notification outbox record
    await tx.insert(notifications).values({
      ticketId: ticket.id,
      phone: customerDetails.phone,
      eventType: "ticket_issued",
      messageBody: `Your ticket ${ticket.tokenNumber} has been issued. Est. wait time: ${Math.round(waitEstimate)} mins.`,
      status: "logged",
    });

    if (linkedTicket) {
      await tx.insert(notifications).values({
        ticketId: linkedTicket.id,
        phone: customerDetails.phone,
        eventType: "ticket_issued",
        messageBody: `Your linked ticket ${linkedTicket.tokenNumber} has been issued.`,
        status: "logged",
      });
    }

    // Audit logs
    await tx.insert(auditLog).values({
      actorType: "system",
      actorId: "00000000-0000-0000-0000-000000000000",
      action: "issue_ticket",
      ticketId: ticket.id,
      details: { pool, tokenNumber, linkedTicketId: linkedTicket?.id },
    });

    return { ticket, linkedTicket };
  });
}

/**
 * Call the next ticket for a counter.
 */
export async function callNext(counterId: string, actorId: string): Promise<any> {
  return await db.transaction(async (tx) => {
    // 1. Lock counter row
    const [counter] = await tx
      .select()
      .from(counters)
      .where(eq(counters.id, counterId))
      .for("update");

    if (!counter) throw new Error("Counter not found");
    if (counter.currentTicketId) {
      throw new Error("Counter has an unresolved active ticket");
    }

    // 2. Determine next ticket
    const ticketToCall = await getNextTicketForCounter(counterId, tx);
    if (!ticketToCall) return null;

    // Lock ticket row
    const [ticket] = await tx
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketToCall.id))
      .for("update");

    // 3. Conflict check for Linked Pairs — read-only; no FOR UPDATE to avoid deadlock
    if (ticket.linkedTicketId) {
      const [linked] = await tx
        .select()
        .from(tickets)
        .where(eq(tickets.id, ticket.linkedTicketId));
        // No .for("update") here — we only need to read the partner's status.
        // Locking it would deadlock when the partner is already locked at another counter.

      if (linked && (linked.status === "called" || linked.status === "in_service")) {
        // Linked ticket is busy, place this one on hold
        await tx
          .update(tickets)
          .set({ status: "on_hold" })
          .where(eq(tickets.id, ticket.id));

        await tx.insert(auditLog).values({
          actorType: "system",
          actorId,
          action: "hold_linked_ticket",
          ticketId: ticket.id,
          details: { reason: "Partner ticket is active at another counter" },
        });

        return { ticket: { ...ticket, status: "on_hold" }, held: true };
      }
    }

    // 4. Update ticket and counter states
    const now = new Date();
    await tx
      .update(tickets)
      .set({
        status: "called",
        counterId: counterId,
        calledAt: now,
        serviceStartedAt: now,
      })
      .where(eq(tickets.id, ticket.id));

    await tx
      .update(counters)
      .set({ currentTicketId: ticket.id })
      .where(eq(counters.id, counterId));

    // Audit logs
    await tx.insert(auditLog).values({
      actorType: "teller",
      actorId,
      action: "call_next",
      ticketId: ticket.id,
      details: { counterId },
    });

    // Notify outbox
    await tx.insert(notifications).values({
      ticketId: ticket.id,
      phone: ticket.customerPhone,
      eventType: "called",
      messageBody: `Ticket ${ticket.tokenNumber} called at ${counter.name}`,
      status: "logged",
    });

    return { ticket: { ...ticket, status: "called", counterId, calledAt: now, serviceStartedAt: now }, held: false };
  });
}

/**
 * Mark a ticket as done (completed).
 */
export async function markDone(ticketId: string, actorId: string): Promise<any> {
  return await db.transaction(async (tx) => {
    const [ticket] = await tx
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .for("update");

    if (!ticket) throw new Error("Ticket not found");

    const now = new Date();
    await tx
      .update(tickets)
      .set({ status: "done", doneAt: now })
      .where(eq(tickets.id, ticketId));

    // Clear counter's currentTicketId if this was the current ticket
    if (ticket.counterId) {
      await tx
        .update(counters)
        .set({ currentTicketId: null })
        .where(eq(counters.id, ticket.counterId));
    }

    // Check if partner ticket is on_hold and release it back to waiting
    if (ticket.linkedTicketId) {
      const [linked] = await tx
        .select()
        .from(tickets)
        .where(eq(tickets.id, ticket.linkedTicketId))
        .for("update");

      if (linked && linked.status === "on_hold") {
        await tx
          .update(tickets)
          .set({ status: "waiting" })
          .where(eq(tickets.id, linked.id));

        await tx.insert(auditLog).values({
          actorType: "system",
          actorId,
          action: "resume_linked_ticket",
          ticketId: linked.id,
          details: { releasedByDoneTicketId: ticketId },
        });
      }
    }

    // Audit logs
    await tx.insert(auditLog).values({
      actorType: "teller",
      actorId,
      action: "mark_done",
      ticketId,
      details: { doneAt: now },
    });

    return { ...ticket, status: "done", doneAt: now };
  });
}

/**
 * Transfer a ticket to another service.
 */
export async function transfer(
  ticketId: string,
  destinationServiceId: string,
  actorId: string,
  reason: "normal" | "wrong_counter"
): Promise<any> {
  return await db.transaction(async (tx) => {
    const [ticket] = await tx
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .for("update");

    if (!ticket) throw new Error("Ticket not found");

    // Mark current ticket as transferred
    await tx
      .update(tickets)
      .set({ status: "transferred" })
      .where(eq(tickets.id, ticketId));

    // Clear counter
    if (ticket.counterId) {
      await tx
        .update(counters)
        .set({ currentTicketId: null })
        .where(eq(counters.id, ticket.counterId));
    }

    // If customer-initiated wrong-counter correction, place at the front of standard pool
    // We achieve this by setting createdAt to a date in the past.
    let newCreatedAt = new Date();
    if (reason === "wrong_counter") {
      newCreatedAt = new Date(0); // Epoch start (always front of line)
    } else {
      newCreatedAt = new Date(ticket.createdAt); // Preserve original queue position
    }

    // Issue new ticket at destination service
    const destinationPool = "standard"; // Transfers generally land in standard queue
    const tokenNumber = await generateTokenNumber(ticket.branchId, destinationPool, tx);
    const waitEstimate = await computeWaitEstimate(ticket.branchId, destinationServiceId, destinationPool);

    const [newTicket] = await tx
      .insert(tickets)
      .values({
        branchId: ticket.branchId,
        tokenNumber,
        serviceId: destinationServiceId,
        pool: destinationPool,
        status: "waiting",
        customerName: ticket.customerName,
        customerPhone: ticket.customerPhone,
        nic: ticket.nic,
        language: ticket.language,
        createdAt: newCreatedAt,
        originalWaitEstimateMinutes: Math.round(waitEstimate),
      })
      .returning();

    // Audit logs
    await tx.insert(auditLog).values({
      actorType: "teller",
      actorId,
      action: "transfer_ticket",
      ticketId,
      details: { newTicketId: newTicket.id, reason },
    });

    return newTicket;
  });
}

/**
 * Handle ticket no-shows (first no-show re-queues, second is final and flags NIC).
 */
export async function noShow(ticketId: string, actorId: string): Promise<any> {
  return await db.transaction(async (tx) => {
    const [ticket] = await tx
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .for("update");

    if (!ticket) throw new Error("Ticket not found");

    // Clear counter
    if (ticket.counterId) {
      await tx
        .update(counters)
        .set({ currentTicketId: null })
        .where(eq(counters.id, ticket.counterId));
    }

    // Helper: upsert the nicRecords entry
    const upsertNicRecord = async (targetCount: number) => {
      if (!ticket.nic) return;

      const [record] = await tx
        .select()
        .from(nicRecords)
        .where(and(eq(nicRecords.nic, ticket.nic), eq(nicRecords.branchId, ticket.branchId)))
        .for("update");

      const restrictedUntil =
        targetCount >= 2 ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null;

      if (record) {
        await tx
          .update(nicRecords)
          .set({
            noShowCount: targetCount,
            restrictedUntil,
            lastVisitAt: new Date(),
          })
          .where(and(eq(nicRecords.nic, ticket.nic), eq(nicRecords.branchId, ticket.branchId)));
      } else {
        await tx.insert(nicRecords).values({
          nic: ticket.nic,
          branchId: ticket.branchId,
          noShowCount: targetCount,
          restrictedUntil,
          lastVisitAt: new Date(),
        });
      }
    };

    if (ticket.noShowCount === 0) {
      // First no-show: Re-queue to the back of the queue (update createdAt to NOW)
      const now = new Date();
      await tx
        .update(tickets)
        .set({
          status: "waiting",
          noShowCount: 1,
          createdAt: now,
          counterId: null,
        })
        .where(eq(tickets.id, ticketId));

      // Track NIC record (count=1, not yet restricted)
      await upsertNicRecord(1);

      await tx.insert(auditLog).values({
        actorType: "teller",
        actorId,
        action: "no_show_requeue",
        ticketId,
        details: { requeueAt: now },
      });

      return { ...ticket, status: "waiting", noShowCount: 1, counterId: null };
    } else {
      // Second no-show: Final no_show status
      await tx
        .update(tickets)
        .set({ status: "no_show" })
        .where(eq(tickets.id, ticketId));

      // Increment NIC record to count=2 and apply restriction
      await upsertNicRecord(2);

      await tx.insert(auditLog).values({
        actorType: "teller",
        actorId,
        action: "no_show_final",
        ticketId,
        details: { nicFlagged: !!ticket.nic },
      });

      return { ...ticket, status: "no_show" };
    }
  });
}

/**
 * Recall the currently serving ticket (purely re-announces).
 */
export async function recall(ticketId: string, actorId: string): Promise<void> {
  const [ticket] = await db
    .select()
    .from(tickets)
    .where(eq(tickets.id, ticketId));

  if (!ticket) throw new Error("Ticket not found");

  await db.insert(notifications).values({
    ticketId: ticket.id,
    phone: ticket.customerPhone,
    eventType: "called",
    messageBody: `RECALL: Ticket ${ticket.tokenNumber} is requested at your counter.`,
    status: "logged",
  });

  await db.insert(auditLog).values({
    actorType: "teller",
    actorId,
    action: "recall",
    ticketId,
    details: {},
  });
}

/**
 * Start break for a counter. Reroutes waiting tickets to alternative counters.
 */
export async function startBreak(
  counterId: string,
  expectedMinutes: number,
  actorId: string
): Promise<{ success: boolean; requireOverride?: boolean; message?: string }> {
  return await db.transaction(async (tx) => {
    const [counter] = await tx
      .select()
      .from(counters)
      .where(eq(counters.id, counterId))
      .for("update");

    if (!counter) throw new Error("Counter not found");

    // Find services served by this counter
    const handledServices = await tx
      .select({ serviceId: counterServices.serviceId })
      .from(counterServices)
      .where(eq(counterServices.counterId, counterId));

    const serviceIds = handledServices.map((s: any) => s.serviceId);

    // Validate that alternative counters exist for all handled services
    for (const serviceId of serviceIds) {
      const altCounters = await tx
        .select()
        .from(counters)
        .innerJoin(counterServices, eq(counters.id, counterServices.counterId))
        .where(
          and(
            eq(counters.branchId, counter.branchId),
            eq(counterServices.serviceId, serviceId),
            ne(counters.id, counterId),
            or(eq(counters.status, "available"), eq(counters.status, "on_break"))
          )
        );

      if (altCounters.length === 0) {
        // No alternative counters exist! Do not allow break automatically
        return {
          success: false,
          requireOverride: true,
          message: `No active alternative counters are servicing this counter's service (${serviceId}). Manager override required.`,
        };
      }
    }

    // Set counter to break status
    await tx
      .update(counters)
      .set({
        status: "on_break",
        breakStartedAt: new Date(),
        breakExpectedMinutes: expectedMinutes,
      })
      .where(eq(counters.id, counterId));

    // Redistribute tickets currently routed specifically to this counter
    const waitingTickets = await tx
      .select()
      .from(tickets)
      .where(and(eq(tickets.counterId, counterId), eq(tickets.status, "waiting")))
      .for("update");

    for (const ticket of waitingTickets) {
      // Find active counters servicing this ticket's service
      const altCounters = await tx
        .select({ id: counters.id })
        .from(counters)
        .innerJoin(counterServices, eq(counters.id, counterServices.counterId))
        .where(
          and(
            eq(counters.branchId, counter.branchId),
            eq(counterServices.serviceId, ticket.serviceId),
            ne(counters.id, counterId),
            eq(counters.status, "available")
          )
        );

      if (altCounters.length > 0) {
        // Find counter with minimum queue depth
        let bestCounterId = altCounters[0].id;
        let minDepth = Infinity;

        for (const alt of altCounters) {
          const [{ count }] = await tx
            .select({ count: sql<number>`count(*)` })
            .from(tickets)
            .where(and(eq(tickets.counterId, alt.id), eq(tickets.status, "waiting")));

          if (count < minDepth) {
            minDepth = count;
            bestCounterId = alt.id;
          }
        }

        // Reroute ticket
        await tx
          .update(tickets)
          .set({ counterId: bestCounterId })
          .where(eq(tickets.id, ticket.id));

        // Log notification
        await tx.insert(notifications).values({
          ticketId: ticket.id,
          phone: ticket.customerPhone,
          eventType: "reroute_update",
          messageBody: `Your ticket ${ticket.tokenNumber} has been rerouted to another counter.`,
          status: "logged",
        });
      }
    }

    await tx.insert(auditLog).values({
      actorType: "teller",
      actorId,
      action: "start_break",
      details: { expectedMinutes },
    });

    return { success: true };
  });
}

/**
 * End break for a counter.
 */
export async function endBreak(counterId: string, actorId: string): Promise<any> {
  return await db.transaction(async (tx) => {
    await tx
      .update(counters)
      .set({
        status: "available",
        breakStartedAt: null,
        breakExpectedMinutes: null,
      })
      .where(eq(counters.id, counterId));

    await tx.insert(auditLog).values({
      actorType: "teller",
      actorId,
      action: "end_break",
      details: {},
    });
  });
}

/**
 * Check-in a booked appointment.
 */
export async function checkInAppointment(
  appointmentId: string,
  method: "app" | "kiosk"
): Promise<any> {
  return await db.transaction(async (tx) => {
    const [appointment] = await tx
      .select()
      .from(appointments)
      .where(eq(appointments.id, appointmentId))
      .for("update");

    if (!appointment) throw new Error("Appointment not found");
    if (appointment.status !== "pending") {
      throw new Error(`Cannot check in appointment with status ${appointment.status}`);
    }

    // Set appointment status
    await tx
      .update(appointments)
      .set({
        status: "checked_in",
        arrivalConfirmedAt: new Date(),
      })
      .where(eq(appointments.id, appointmentId));

    // Create the ticket in the appointment pool
    const pool = "appointment";
    const tokenNumber = await generateTokenNumber(appointment.branchId, pool, tx);
    const waitEstimate = await computeWaitEstimate(appointment.branchId, appointment.serviceId, pool);

    const [ticket] = await tx
      .insert(tickets)
      .values({
        branchId: appointment.branchId,
        tokenNumber,
        serviceId: appointment.serviceId,
        pool,
        status: "waiting",
        customerName: appointment.customerName,
        customerPhone: appointment.customerPhone,
        nic: appointment.nic,
        language: "en", // default
        originalWaitEstimateMinutes: Math.round(waitEstimate),
      })
      .returning();

    // Link ticket to appointment
    await tx
      .update(appointments)
      .set({ ticketId: ticket.id })
      .where(eq(appointments.id, appointmentId));

    // Log notification
    await tx.insert(notifications).values({
      ticketId: ticket.id,
      phone: ticket.customerPhone,
      eventType: "ticket_issued",
      messageBody: `Your appointment is checked in. Your token is ${tokenNumber}.`,
      status: "logged",
    });

    await tx.insert(auditLog).values({
      actorType: "system",
      actorId: "00000000-0000-0000-0000-000000000000",
      action: "check_in_appointment",
      ticketId: ticket.id,
      details: { appointmentId, method },
    });

    return ticket;
  });
}



/**
 * Revert a marked-done ticket back to called/in-service if within the 60-second undo window.
 */
export async function undoMarkDone(ticketId: string, actorId: string): Promise<any> {
  return await db.transaction(async (tx) => {
    // 1. Lock ticket row
    const [ticket] = await tx
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .for("update");

    if (!ticket) throw new Error("Ticket not found");
    if (ticket.status !== "done") {
      throw new Error("Ticket is not in done status");
    }
    if (!ticket.doneAt) {
      throw new Error("Ticket does not have a completion timestamp");
    }

    // Verify within 60-second window
    const elapsedSeconds = (Date.now() - new Date(ticket.doneAt).getTime()) / 1000;
    if (elapsedSeconds > 60) {
      throw new Error("Undo window (60 seconds) has expired");
    }

    if (!ticket.counterId) {
      throw new Error("Ticket does not have an associated counter");
    }

    // 2. Lock counter row
    const [counter] = await tx
      .select()
      .from(counters)
      .where(eq(counters.id, ticket.counterId))
      .for("update");

    if (!counter) throw new Error("Counter not found");
    if (counter.currentTicketId) {
      throw new Error("Counter has already called another ticket. Cannot undo.");
    }

    // 3. Restore ticket and counter states
    await tx
      .update(tickets)
      .set({
        status: "called",
        doneAt: null,
      })
      .where(eq(tickets.id, ticketId));

    await tx
      .update(counters)
      .set({ currentTicketId: ticketId })
      .where(eq(counters.id, ticket.counterId));

    // Audit logs
    await tx.insert(auditLog).values({
      actorType: "teller",
      actorId,
      action: "undo_mark_done",
      ticketId,
      details: { revertedStatus: "called" },
    });

    return { ...ticket, status: "called", doneAt: null };
  });
}


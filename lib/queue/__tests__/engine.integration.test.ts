import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { db } from "@/db/index";
import {
  branches,
  branchConfig,
  services,
  counters,
  counterServices,
  tickets,
  nicRecords,
  appointments,
  appointmentCaps,
  auditLog,
  notifications,
} from "@/db/schema";
import {
  issueTicket,
  callNext,
  markDone,
  transfer,
  noShow,
  recall,
  startBreak,
  endBreak,
  checkInAppointment,
  undoMarkDone,
} from "@/lib/queue/engine";
import { generateTokenNumber } from "@/lib/queue/token";
import { computeWaitEstimate, computeEarliestAppointmentSlot } from "@/lib/queue/estimation";
import { eq, and, inArray } from "drizzle-orm";

const tellerId = "11111111-1111-1111-1111-111111111111";

interface TestContext {
  branchId: string;
  cashServiceId: string;
  acctServiceId: string;
  loanServiceId: string;
  counter1Id: string;
  counter2Id: string;
  counter3Id: string;
}

let ctx: TestContext;
let allTicketIds: string[] = [];

// Clean all tickets for a branch and clear counters
async function clearBranchTickets(branchId: string, exceptIds: string[] = []) {
  const branchTickets = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(
      and(
        eq(tickets.branchId, branchId),
        inArray(tickets.status, ["waiting", "called", "in_service", "on_hold"])
      )
    );
  const ids = branchTickets
    .map((t: any) => t.id)
    .filter((id: string) => !exceptIds.includes(id));
  if (ids.length === 0) return;

  // Clear counters first
  await db
    .update(counters)
    .set({ currentTicketId: null })
    .where(inArray(counters.id, [ctx.counter1Id, ctx.counter2Id, ctx.counter3Id]));

  // Delete notifications, audit logs, then tickets
  await db.delete(notifications).where(inArray(notifications.ticketId, ids));
  await db.delete(auditLog).where(inArray(auditLog.ticketId, ids));
  await db.delete(tickets).where(inArray(tickets.id, ids));
}

async function cleanup() {
  try {
    if (allTicketIds.length > 0) {
      await db.delete(auditLog).where(inArray(auditLog.ticketId, allTicketIds));
      await db.delete(notifications).where(inArray(notifications.ticketId, allTicketIds));
      await db.delete(tickets).where(inArray(tickets.id, allTicketIds));
    }
    if (ctx?.branchId) {
      await db.delete(nicRecords).where(eq(nicRecords.branchId, ctx.branchId));
      await db.delete(appointments).where(eq(appointments.branchId, ctx.branchId));
      await db.delete(appointmentCaps).where(eq(appointmentCaps.branchId, ctx.branchId));
      await db.delete(counterServices).where(
        inArray(counterServices.counterId, [ctx.counter1Id, ctx.counter2Id, ctx.counter3Id])
      );
      await db.delete(counters).where(eq(counters.branchId, ctx.branchId));
      await db.delete(services).where(eq(services.branchId, ctx.branchId));
      await db.delete(branchConfig).where(eq(branchConfig.branchId, ctx.branchId));
      await db.delete(branches).where(eq(branches.id, ctx.branchId));
    }
  } catch (err) {
    console.warn("Cleanup warning:", err);
  }
}

beforeAll(async () => {
  allTicketIds = [];
  await cleanup();

  const [branch] = await db
    .insert(branches)
    .values({
      name: "VITEST Main Branch",
      address: "No. 99, Test Road, Colombo",
      lat: "6.9344000",
      lng: "79.8428000",
      phone: "+94 11 999 9999",
      isActive: true,
    })
    .returning();

  await db.insert(branchConfig).values({
    branchId: branch.id,
    priorityRatioStandard: 3,
    priorityRatioPriority: 1,
    appointmentBufferMinutes: 15,
    appointmentWindowMinutes: 20,
    arrivalConfirmationLeadMinutes: 10,
  });

  const [cashSvc] = await db
    .insert(services)
    .values({
      branchId: branch.id,
      name: "Cash Services",
      nameSi: "මුදල් සේවා",
      nameTa: "பண சேவைகள்",
      icon: "Banknote",
      category: "Cash Services",
      avgServiceTimeMinutes: 5,
      nicRequired: false,
      isActive: true,
    })
    .returning();

  const [acctSvc] = await db
    .insert(services)
    .values({
      branchId: branch.id,
      name: "Account Services",
      nameSi: "ගිණුම් සේවා",
      nameTa: "கணக்கு சேவைகள்",
      icon: "UserPlus",
      category: "Account Services",
      avgServiceTimeMinutes: 20,
      nicRequired: true,
      isActive: true,
    })
    .returning();

  const [loanSvc] = await db
    .insert(services)
    .values({
      branchId: branch.id,
      name: "Loans & Credit",
      nameSi: "ණය සහ ණය",
      nameTa: "கடன் மற்றும் கிரெடிட்",
      icon: "Landmark",
      category: "Loans & Credit",
      avgServiceTimeMinutes: 15,
      nicRequired: true,
      isActive: true,
    })
    .returning();

  const [cnt1] = await db
    .insert(counters)
    .values({ branchId: branch.id, name: "Counter 01 (Cash)", status: "available" })
    .returning();

  const [cnt2] = await db
    .insert(counters)
    .values({ branchId: branch.id, name: "Counter 02 (Accounts)", status: "available" })
    .returning();

  const [cnt3] = await db
    .insert(counters)
    .values({ branchId: branch.id, name: "Counter 03 (Cash backup)", status: "available" })
    .returning();

  await db.insert(counterServices).values([
    { counterId: cnt1.id, serviceId: cashSvc.id },
    { counterId: cnt3.id, serviceId: cashSvc.id },
    { counterId: cnt2.id, serviceId: acctSvc.id },
  ]);

  await db.insert(appointmentCaps).values({
    branchId: branch.id,
    serviceCategory: "Cash Services",
    hourOfDay: new Date().getHours(),
    maxBookings: 4,
  });

  ctx = {
    branchId: branch.id,
    cashServiceId: cashSvc.id,
    acctServiceId: acctSvc.id,
    loanServiceId: loanSvc.id,
    counter1Id: cnt1.id,
    counter2Id: cnt2.id,
    counter3Id: cnt3.id,
  };
});

afterAll(async () => {
  await cleanup();
});

// Helper to issue a ticket and track its ID
async function makeTicket(pool: "standard" | "priority" | "appointment" = "standard", opts: any = {}) {
  const result = await issueTicket(
    opts.branchId || ctx.branchId,
    opts.serviceId || ctx.cashServiceId,
    pool,
    { name: opts.name || "Test User", phone: opts.phone || "0770000000", nic: opts.nic },
    opts.linkedServiceId,
    opts.language || "en"
  );
  allTicketIds.push(result.ticket.id);
  if (result.linkedTicket) allTicketIds.push(result.linkedTicket.id);
  return result;
}

async function callAndComplete(counterId: string, actorId: string = tellerId) {
  const result = await callNext(counterId, actorId);
  if (result) await markDone(result.ticket.id, actorId);
  return result;
}

describe("token.ts — Token Generation", () => {
  it("should generate correct format tokens", async () => {
    const a = await generateTokenNumber(ctx.branchId, "appointment");
    const p = await generateTokenNumber(ctx.branchId, "priority");
    const s = await generateTokenNumber(ctx.branchId, "standard");
    expect(a).toMatch(/^A-\d{3}$/);
    expect(p).toMatch(/^P-\d{3}$/);
    expect(s).toMatch(/^S-\d{3}$/);
  });
});

describe("estimation.ts — Wait Estimation", () => {
  it("should compute a positive numeric wait estimate", async () => {
    const wait = await computeWaitEstimate(ctx.branchId, ctx.cashServiceId, "standard");
    expect(wait).toBeGreaterThanOrEqual(5);
    expect(Number.isFinite(wait)).toBe(true);
  });

  it("should estimate appointment wait lower than standard", async () => {
    const s = await computeWaitEstimate(ctx.branchId, ctx.cashServiceId, "standard");
    const a = await computeWaitEstimate(ctx.branchId, ctx.cashServiceId, "appointment");
    expect(a).toBeLessThanOrEqual(s);
  });

  it("should compute earliest appointment slot", async () => {
    const slot = await computeEarliestAppointmentSlot(ctx.branchId, ctx.cashServiceId, new Date());
    expect(slot).toHaveProperty("isAvailable");
    expect(slot.earliestAvailableSlot).toBeInstanceOf(Date);
  });
});

describe("engine.ts — issueTicket", () => {
  afterEach(async () => {
    await clearBranchTickets(ctx.branchId);
  });

  it("should issue a standard ticket", async () => {
    const r = await makeTicket("standard");
    expect(r.ticket.pool).toBe("standard");
    expect(r.ticket.status).toBe("waiting");
    expect(r.ticket.tokenNumber).toMatch(/^S-\d{3}$/);
    expect(r.linkedTicket).toBeNull();
  });

  it("should issue a priority ticket with NIC", async () => {
    const r = await makeTicket("priority", { nic: "551234567V" });
    expect(r.ticket.pool).toBe("priority");
    expect(r.ticket.tokenNumber).toMatch(/^P-\d{3}$/);
  });

  it("should issue a linked ticket pair", async () => {
    const r = await makeTicket("standard", { linkedServiceId: ctx.acctServiceId });
    expect(r.ticket).toBeDefined();
    expect(r.linkedTicket).toBeDefined();
    expect(r.ticket.linkedTicketId).toBe(r.linkedTicket.id);
    expect(r.linkedTicket.linkedTicketId).toBe(r.ticket.id);
    expect(r.linkedTicket.serviceId).toBe(ctx.acctServiceId);
  });
});

describe("engine.ts — callNext 3-Pool Priority", () => {
  beforeEach(async () => {
    await clearBranchTickets(ctx.branchId);
  });

  it("should enforce 3:1 priority interleaving ratio", async () => {
    const s1 = await makeTicket("standard", { name: "S1" });
    const s2 = await makeTicket("standard", { name: "S2" });
    const s3 = await makeTicket("standard", { name: "S3" });
    const s4 = await makeTicket("standard", { name: "S4" });
    const p1 = await makeTicket("priority", { name: "P1" });

    // Use counter1 (cash) — all these tickets are for cash service
    const c1 = await callAndComplete(ctx.counter1Id);
    expect(c1.ticket.id).toBe(s1.ticket.id);

    const c2 = await callAndComplete(ctx.counter1Id);
    expect(c2.ticket.id).toBe(s2.ticket.id);

    const c3 = await callAndComplete(ctx.counter1Id);
    expect(c3.ticket.id).toBe(s3.ticket.id);

    // 4th call: priority (ratio 3:1 reached)
    const c4 = await callAndComplete(ctx.counter1Id);
    expect(c4.ticket.id).toBe(p1.ticket.id);

    // 5th call: remaining standard
    const c5 = await callAndComplete(ctx.counter1Id);
    expect(c5.ticket.id).toBe(s4.ticket.id);

    // 6th: empty
    const c6 = await callNext(ctx.counter1Id);
    expect(c6).toBeNull();
  });

  it("should return null when queue is empty", async () => {
    const result = await callNext(ctx.counter1Id);
    expect(result).toBeNull();
  });
});

describe("engine.ts — Linked-Pair Hold/Resume", () => {
  beforeEach(async () => {
    await clearBranchTickets(ctx.branchId);
  });

  it("should place linked partner on hold and resume on done", async () => {
    const pair = await makeTicket("standard", {
      name: "Pair",
      linkedServiceId: ctx.acctServiceId,
    });
    const ticketA = pair.ticket;
    const ticketB = pair.linkedTicket;

    // Call ticket A at counter1 (cash)
    const callA = await callNext(ctx.counter1Id, tellerId);
    expect(callA.ticket.id).toBe(ticketA.id);
    expect(callA.ticket.status).toBe("called");

    // Call ticket B at counter2 (accounts) — should be on_hold
    const callB = await callNext(ctx.counter2Id, tellerId);
    expect(callB.ticket.status).toBe("on_hold");
    expect(callB.held).toBe(true);

    // Mark ticket A done — should release ticket B back to waiting
    await markDone(ticketA.id, tellerId);

    const [releasedB] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketB.id));
    expect(releasedB.status).toBe("waiting");
  });
});

describe("engine.ts — transfer", () => {
  beforeEach(async () => {
    await clearBranchTickets(ctx.branchId);
  });

  it("should transfer ticket and mark original as transferred", async () => {
    await makeTicket("standard", { name: "Transfer" });
    const called = await callNext(ctx.counter1Id, tellerId);
    await markDone(called.ticket.id, tellerId);

    // Issue a new ticket to transfer
    await makeTicket("standard", { name: "Transfer2" });
    const called2 = await callNext(ctx.counter1Id, tellerId);
    const newTicket = await transfer(called2.ticket.id, ctx.acctServiceId, tellerId, "normal");
    allTicketIds.push(newTicket.id);

    expect(newTicket.serviceId).toBe(ctx.acctServiceId);
    expect(newTicket.status).toBe("waiting");

    const [orig] = await db.select().from(tickets).where(eq(tickets.id, called2.ticket.id));
    expect(orig.status).toBe("transferred");
  });

  it("should place wrong_counter transfer at front with epoch createdAt", async () => {
    // Issue a ticket, call and mark done to clear counter
    await makeTicket("standard", { name: "WC1" });
    const called = await callNext(ctx.counter1Id, tellerId);
    await markDone(called.ticket.id, tellerId);

    // Issue ticket for wrong-counter transfer
    await makeTicket("standard", { name: "WC2" });
    const wcCalled = await callNext(ctx.counter1Id, tellerId);
    const wcTransfer = await transfer(wcCalled.ticket.id, ctx.cashServiceId, tellerId, "wrong_counter");
    allTicketIds.push(wcTransfer.id);

    // Wrong_counter transferred ticket should have createdAt = epoch (front of queue)
    expect(wcTransfer.createdAt.getTime()).toBe(0);
  });
});

describe("engine.ts — noShow", () => {
  beforeEach(async () => {
    await clearBranchTickets(ctx.branchId);
  });

  it("should re-queue on first no-show and finalize on second", async () => {
    await makeTicket("standard", { name: "NoShow", nic: "991234567V" });
    const call1 = await callNext(ctx.counter1Id, tellerId);

    const ns1 = await noShow(call1.ticket.id, tellerId);
    expect(ns1.status).toBe("waiting");
    expect(ns1.noShowCount).toBe(1);

    const call2 = await callNext(ctx.counter1Id, tellerId);
    const ns2 = await noShow(call2.ticket.id, tellerId);
    expect(ns2.status).toBe("no_show");

    const [rec] = await db
      .select()
      .from(nicRecords)
      .where(and(eq(nicRecords.nic, "991234567V"), eq(nicRecords.branchId, ctx.branchId)));
    expect(rec.noShowCount).toBe(2);
    expect(rec.restrictedUntil).toBeInstanceOf(Date);
  });
});

describe("engine.ts — recall", () => {
  beforeEach(async () => {
    await clearBranchTickets(ctx.branchId);
  });

  it("should recall without changing ticket state", async () => {
    await makeTicket("standard", { name: "Recall" });
    const called = await callNext(ctx.counter1Id, tellerId);

    await recall(called.ticket.id, tellerId);

    const [after] = await db.select().from(tickets).where(eq(tickets.id, called.ticket.id));
    expect(after.status).toBe("called");
  });
});

describe("engine.ts — break management", () => {
  beforeEach(async () => {
    await clearBranchTickets(ctx.branchId);
    // Ensure counters are available
    await db
      .update(counters)
      .set({ status: "available", currentTicketId: null, breakStartedAt: null, breakExpectedMinutes: null })
      .where(inArray(counters.id, [ctx.counter1Id, ctx.counter2Id, ctx.counter3Id]));
  });

  it("should start break and redistribute waiting tickets", async () => {
    // Issue 3 tickets and route them to counter3
    for (let i = 0; i < 3; i++) {
      const tk = await makeTicket("standard", { name: `Break${i}` });
      await db.update(tickets).set({ counterId: ctx.counter3Id }).where(eq(tickets.id, tk.ticket.id));
    }

    const result = await startBreak(ctx.counter3Id, 15, tellerId);
    expect(result.success).toBe(true);
  });

  it("should require manager override when no alternative counter", async () => {
    // Counter2 is the only one handling account services
    const result = await startBreak(ctx.counter2Id, 15, tellerId);
    expect(result.success).toBe(false);
    expect(result.requireOverride).toBe(true);
  });

  it("should end break and reset counter state", async () => {
    // Put counter3 on break first
    await db
      .update(counters)
      .set({ status: "on_break", breakStartedAt: new Date(), breakExpectedMinutes: 15 })
      .where(eq(counters.id, ctx.counter3Id));

    await endBreak(ctx.counter3Id, tellerId);

    const [counter] = await db.select().from(counters).where(eq(counters.id, ctx.counter3Id));
    expect(counter.status).toBe("available");
    expect(counter.breakStartedAt).toBeNull();
    expect(counter.breakExpectedMinutes).toBeNull();
  });
});

describe("engine.ts — checkInAppointment", () => {
  beforeEach(async () => {
    await clearBranchTickets(ctx.branchId);
  });

  it("should create an appointment ticket in appointment pool", async () => {
    const windowStart = new Date(Date.now() + 30 * 60 * 1000);
    const windowEnd = new Date(Date.now() + 50 * 60 * 1000);

    const [apt] = await db
      .insert(appointments)
      .values({
        branchId: ctx.branchId,
        serviceId: ctx.cashServiceId,
        bookingCode: "VITEST-APPT",
        windowStart,
        windowEnd,
        status: "pending",
        customerName: "Appt Cust",
        customerPhone: "0779999999",
        nic: "881234567V",
      })
      .returning();

    const ticket = await checkInAppointment(apt.id, "app");
    allTicketIds.push(ticket.id);

    expect(ticket.pool).toBe("appointment");
    expect(ticket.status).toBe("waiting");
    expect(ticket.tokenNumber).toMatch(/^A-\d{3}$/);

    const [updatedApt] = await db.select().from(appointments).where(eq(appointments.id, apt.id));
    expect(updatedApt.status).toBe("checked_in");
    expect(updatedApt.ticketId).toBe(ticket.id);
  });
});

describe("engine.ts — undoMarkDone 60s guard", () => {
  beforeEach(async () => {
    await clearBranchTickets(ctx.branchId);
  });

  it("should undo mark done within 60 seconds", async () => {
    await makeTicket("standard", { name: "Undo" });
    const called = await callNext(ctx.counter1Id, tellerId);

    // Save ticket id before markDone for later reference
    const ticketId = called.ticket.id;
    await markDone(ticketId, tellerId);

    const undone = await undoMarkDone(ticketId, tellerId);
    expect(undone.status).toBe("called");
    expect(undone.doneAt).toBeNull();

    const [counter] = await db.select().from(counters).where(eq(counters.id, ctx.counter1Id));
    expect(counter.currentTicketId).toBe(ticketId);

    // Clean up
    await markDone(ticketId, tellerId);
  });
});

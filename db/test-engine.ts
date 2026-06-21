import { db } from "./index";
import {
  branches,
  branchConfig,
  services,
  counters,
  counterServices,
  tickets,
  nicRecords,
  auditLog,
  notifications,
} from "./schema";
import {
  issueTicket,
  callNext,
  markDone,
  noShow,
  undoMarkDone,
} from "../lib/queue/engine";
import { eq, and, inArray } from "drizzle-orm";

async function runTests() {
  console.log("🧪 Starting Standalone Queue Engine Integration Tests on Clean Temporary Branch...");

  let branchId = "";
  let cashServiceId = "";
  let acctServiceId = "";
  let counter1Id = "";
  let counter2Id = "";
  const createdTicketIds: string[] = [];
  const tellerId = "11111111-1111-1111-1111-111111111111";

  try {
    // 1. Create a clean temporary branch
    const [branch] = await db
      .insert(branches)
      .values({
        name: "TEMP Test Colombo Branch",
        address: "No. 12, Test Street, Colombo",
        lat: "6.9344000",
        lng: "79.8428000",
        phone: "+94 11 000 0000",
        isActive: true,
      })
      .returning();
    branchId = branch.id;
    console.log(`Created temporary branch: ${branch.name} (${branchId})`);

    // 2. Create config
    await db.insert(branchConfig).values({
      branchId,
      priorityRatioStandard: 3,
      priorityRatioPriority: 1,
      appointmentBufferMinutes: 15,
      appointmentWindowMinutes: 20,
      arrivalConfirmationLeadMinutes: 10,
    });

    // 3. Create Services
    const [cashSvc] = await db
      .insert(services)
      .values({
        branchId,
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
    cashServiceId = cashSvc.id;

    const [acctSvc] = await db
      .insert(services)
      .values({
        branchId,
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
    acctServiceId = acctSvc.id;

    // 4. Create Counters
    const [cnt1] = await db
      .insert(counters)
      .values({
        branchId,
        name: "TEST Counter 01 (General Cash)",
        status: "available",
      })
      .returning();
    counter1Id = cnt1.id;

    const [cnt2] = await db
      .insert(counters)
      .values({
        branchId,
        name: "TEST Counter 02 (Accounts)",
        status: "available",
      })
      .returning();
    counter2Id = cnt2.id;

    // Map counter services
    await db.insert(counterServices).values({
      counterId: counter1Id,
      serviceId: cashServiceId,
    });
    await db.insert(counterServices).values({
      counterId: counter2Id,
      serviceId: acctServiceId,
    });

    console.log("\n--- Test Case 1: 3-Pool Priority ratio interleaving ---");
    // We need 4 standard tickets and 1 priority ticket.
    const res1 = await issueTicket(branchId, cashServiceId, "standard", { name: "Std 1", phone: "0771234567" }, undefined, "en");
    const res2 = await issueTicket(branchId, cashServiceId, "standard", { name: "Std 2", phone: "0771234567" }, undefined, "en");
    const res3 = await issueTicket(branchId, cashServiceId, "standard", { name: "Std 3", phone: "0771234567" }, undefined, "en");
    const res4 = await issueTicket(branchId, cashServiceId, "standard", { name: "Std 4", phone: "0771234567" }, undefined, "en");
    const resP = await issueTicket(branchId, cashServiceId, "priority", { name: "Prio 1", phone: "0771234567" }, undefined, "en");

    createdTicketIds.push(res1.ticket.id, res2.ticket.id, res3.ticket.id, res4.ticket.id, resP.ticket.id);

    // Call standard tickets
    const call1 = await callNext(counter1Id, tellerId);
    console.log(`Called ticket 1: ${call1.ticket.tokenNumber} (Expected: S-001)`);
    if (!call1.ticket.tokenNumber.endsWith("-001")) throw new Error("Failed Call 1");
    await markDone(call1.ticket.id, tellerId);

    const call2 = await callNext(counter1Id, tellerId);
    console.log(`Called ticket 2: ${call2.ticket.tokenNumber} (Expected: S-002)`);
    if (!call2.ticket.tokenNumber.endsWith("-002")) throw new Error("Failed Call 2");
    await markDone(call2.ticket.id, tellerId);

    const call3 = await callNext(counter1Id, tellerId);
    console.log(`Called ticket 3: ${call3.ticket.tokenNumber} (Expected: S-003)`);
    if (!call3.ticket.tokenNumber.endsWith("-003")) throw new Error("Failed Call 3");
    await markDone(call3.ticket.id, tellerId);

    // Next call should be priority because standard count called since last priority is 3
    const call4 = await callNext(counter1Id, tellerId);
    console.log(`Called ticket 4: ${call4.ticket.tokenNumber} (Expected: P-001)`);
    if (!call4.ticket.tokenNumber.startsWith("P-")) throw new Error("Priority interleaving ratio not respected");
    await markDone(call4.ticket.id, tellerId);

    const call5 = await callNext(counter1Id, tellerId);
    console.log(`Called ticket 5: ${call5.ticket.tokenNumber} (Expected: S-004)`);
    if (!call5.ticket.tokenNumber.startsWith("S-")) throw new Error("Failed fallback call");
    await markDone(call5.ticket.id, tellerId);

    console.log("✅ Interleaving Priority Ratio Test Passed!");


    console.log("\n--- Test Case 2: Linked-pair Hold/Resume ---");
    const pair = await issueTicket(branchId, cashServiceId, "standard", { name: "Linked Cust", phone: "0777777777" }, acctServiceId, "en");
    const ticketA = pair.ticket;
    const ticketB = pair.linkedTicket;
    createdTicketIds.push(ticketA.id, ticketB.id);

    console.log(`Ticket A: ${ticketA.tokenNumber}, Ticket B: ${ticketB.tokenNumber}`);

    // Call Ticket A at Counter 1
    const callA = await callNext(counter1Id, tellerId);
    console.log(`Ticket A called status: ${callA.ticket.status}`);

    // Call Ticket B at Counter 2 (should be held because partner is active at Counter 1)
    const callB = await callNext(counter2Id, tellerId);
    console.log(`Ticket B call result: status=${callB.ticket.status}, held=${callB.held}`);
    if (callB.ticket.status !== "on_hold" || !callB.held) {
      throw new Error("Linked pair conflict logic failed: Ticket B was not placed on hold");
    }

    // Mark Ticket A as done
    await markDone(ticketA.id, tellerId);
    console.log("Ticket A marked done.");

    // Check if Ticket B was released back to waiting
    const [updatedTicketB] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketB.id));
    console.log(`Ticket B status after Ticket A marked done: ${updatedTicketB.status} (Expected: waiting)`);
    if (updatedTicketB.status !== "waiting") {
      throw new Error("Linked pair resume logic failed");
    }

    console.log("✅ Linked-pair Hold/Resume Test Passed!");


    console.log("\n--- Test Case 3: No-Show Re-queue & Restriction ---");
    const nsRes = await issueTicket(branchId, cashServiceId, "standard", { name: "NoShow Cust", phone: "0770000000", nic: "991234567V" }, undefined, "en");
    const nsTicket = nsRes.ticket;
    createdTicketIds.push(nsTicket.id);

    // Call first time
    const nsCall1 = await callNext(counter1Id, tellerId);
    const nsResult1 = await noShow(nsCall1.ticket.id, tellerId);
    console.log(`After 1st no-show: status=${nsResult1.status}, noShowCount=${nsResult1.noShowCount}`);
    if (nsResult1.status !== "waiting" || nsResult1.noShowCount !== 1) {
      throw new Error("First no-show re-queue failed");
    }

    // Call second time
    const nsCall2 = await callNext(counter1Id, tellerId);
    const nsResult2 = await noShow(nsCall2.ticket.id, tellerId);
    console.log(`After 2nd no-show: status=${nsResult2.status}`);
    if (nsResult2.status !== "no_show") {
      throw new Error("Second no-show final status failed");
    }

    // Verify restriction record for the NIC
    const [nicRec] = await db
      .select()
      .from(nicRecords)
      .where(and(eq(nicRecords.nic, "991234567V"), eq(nicRecords.branchId, branchId)));
    
    console.log(`NIC visits details: noShowCount=${nicRec?.noShowCount}, restrictedUntil=${nicRec?.restrictedUntil}`);
    if (!nicRec || nicRec.noShowCount < 2 || !nicRec.restrictedUntil) {
      throw new Error("NIC restriction record was not correctly flagged");
    }

    console.log("✅ No-Show Re-queue & Restriction Test Passed!");


    console.log("\n--- Test Case 4: 60-Second Undo Guard ---");
    const undoRes = await issueTicket(branchId, cashServiceId, "standard", { name: "Undo Cust", phone: "0779999999" }, undefined, "en");
    const undoTicket = undoRes.ticket;
    createdTicketIds.push(undoTicket.id);

    const undoCall = await callNext(counter1Id, tellerId);
    await markDone(undoCall.ticket.id, tellerId);
    
    const undoResult = await undoMarkDone(undoCall.ticket.id, tellerId);
    console.log(`After undo: status=${undoResult.status}, doneAt=${undoResult.doneAt}`);
    if (undoResult.status !== "called" || undoResult.doneAt !== null) {
      throw new Error("Undo mark done failed");
    }

    // Verify counter has it set as current ticket again
    const [updatedCounter1] = await db
      .select()
      .from(counters)
      .where(eq(counters.id, counter1Id));
    if (updatedCounter1.currentTicketId !== undoCall.ticket.id) {
      throw new Error("Counter current ticket not restored after undo");
    }
    // Clean up counter by marking ticket done again
    await markDone(undoCall.ticket.id, tellerId);

    console.log("✅ 60-Second Undo Guard Test Passed!");

    console.log("\n🎉 ALL TESTS COMPLETED SUCCESSFULLY!");
    process.exit(0);

  } catch (err) {
    console.error("❌ Test failed with error:", err);
    process.exit(1);
  } finally {
    console.log("\n🧹 Cleaning up temporary branch and all associated test records...");

    try {
      if (createdTicketIds.length > 0) {
        await db.delete(auditLog).where(inArray(auditLog.ticketId, createdTicketIds));
        await db.delete(notifications).where(inArray(notifications.ticketId, createdTicketIds));
        await db.delete(tickets).where(inArray(tickets.id, createdTicketIds));
      }
      if (branchId) {
        await db.delete(nicRecords).where(eq(nicRecords.branchId, branchId));
        await db.delete(counterServices).where(inArray(counterServices.counterId, [counter1Id, counter2Id]));
        await db.delete(counters).where(eq(counters.branchId, branchId));
        await db.delete(services).where(eq(services.branchId, branchId));
        await db.delete(branchConfig).where(eq(branchConfig.branchId, branchId));
        await db.delete(branches).where(eq(branches.id, branchId));
      }
      console.log("🧹 Cleanup complete.");
    } catch (cleanErr) {
      console.error("⚠️ Cleanup failed:", cleanErr);
    }
  }
}

runTests();

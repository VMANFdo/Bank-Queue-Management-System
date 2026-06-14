import { db } from "./index";
import {
  branches,
  branchConfig,
  services,
  counters,
  counterServices,
  appointmentCaps,
  slaThresholds,
} from "./schema";

/**
 * Seeding script for development.
 * Pre-populates the database with a default branch, configuration, services,
 * counters, and associations.
 */
async function main() {
  console.log("🌱 Seeding database...");

  // 1. Insert Sample Branch (Colombo Head Office)
  const [colomboBranch] = await db
    .insert(branches)
    .values({
      name: "Colombo Head Office Branch",
      address: "No. 12, York Street, Colombo 01, Sri Lanka",
      lat: "6.9344000",
      lng: "79.8428000",
      phone: "+94 11 234 5678",
      isActive: true,
    })
    .returning();

  console.log(`✅ Created branch: ${colomboBranch.name} (${colomboBranch.id})`);

  // 2. Insert Branch Configuration
  await db.insert(branchConfig).values({
    branchId: colomboBranch.id,
    priorityRatioStandard: 3,
    priorityRatioPriority: 1,
    appointmentBufferMinutes: 15,
    appointmentWindowMinutes: 20,
    arrivalConfirmationLeadMinutes: 10,
  });
  console.log("✅ Created branch config");

  // 3. Insert Services (Trilingual support)
  const serviceItems = [
    {
      name: "Cash Deposit & Withdrawal",
      nameSi: "මුදල් තැන්පත් කිරීම් සහ ලබාගැනීම්",
      nameTa: "பண வைப்பு மற்றும் திரும்பப் பெறுதல்",
      icon: "Banknote",
      category: "Cash Services",
      avgServiceTimeMinutes: 5,
      nicRequired: false,
    },
    {
      name: "New Account Opening",
      nameSi: "නව ගිණුම් ආරම්භ කිරීම",
      nameTa: "புதிய கணக்கு திறப்பு",
      icon: "UserPlus",
      category: "Account Services",
      avgServiceTimeMinutes: 20,
      nicRequired: true,
    },
    {
      name: "Loan & Credit Advisory",
      nameSi: "ණය සහ ණය උපදේශනය",
      nameTa: "கடன் மற்றும் கடன் ஆலோசனை",
      icon: "FileText",
      category: "Loans & Credit",
      avgServiceTimeMinutes: 30,
      nicRequired: true,
    },
    {
      name: "Foreign Exchange Services",
      nameSi: "විදේශ විනිමය සේවා",
      nameTa: "வெளிநாட்டு நாணய மாற்று சேவைகள்",
      icon: "Globe",
      category: "Foreign Exchange",
      avgServiceTimeMinutes: 10,
      nicRequired: true,
    },
  ];

  const createdServices = [];
  for (const item of serviceItems) {
    const [svc] = await db
      .insert(services)
      .values({
        branchId: colomboBranch.id,
        ...item,
        isActive: true,
      })
      .returning();
    createdServices.push(svc);
    console.log(`✅ Created service: ${svc.name} (${svc.id})`);
  }

  // 4. Insert Counters
  const counterItems = [
    { name: "Counter 01 (General Cash)" },
    { name: "Counter 02 (Accounts & Inquiries)" },
    { name: "Counter 03 (Specialized Services)" },
  ];

  const createdCounters = [];
  for (const item of counterItems) {
    const [cnt] = await db
      .insert(counters)
      .values({
        branchId: colomboBranch.id,
        name: item.name,
        status: "closed",
      })
      .returning();
    createdCounters.push(cnt);
    console.log(`✅ Created counter: ${cnt.name} (${cnt.id})`);
  }

  // 5. Counter-Service mappings
  // Counter 1 handles Cash Services
  const cashSvc = createdServices.find((s) => s.category === "Cash Services");
  if (cashSvc) {
    await db.insert(counterServices).values({
      counterId: createdCounters[0].id,
      serviceId: cashSvc.id,
    });
  }

  // Counter 2 handles Account Services
  const acctSvc = createdServices.find((s) => s.category === "Account Services");
  if (acctSvc) {
    await db.insert(counterServices).values({
      counterId: createdCounters[1].id,
      serviceId: acctSvc.id,
    });
  }

  // Counter 3 handles all services (Fallback/Premier)
  for (const svc of createdServices) {
    await db.insert(counterServices).values({
      counterId: createdCounters[2].id,
      serviceId: svc.id,
    });
  }
  console.log("✅ Configured counter service mappings");

  // 6. Appointment Caps (Hourly caps for categories)
  const categories = ["Cash Services", "Account Services", "Loans & Credit", "Foreign Exchange"];
  for (const category of categories) {
    for (let hour = 8; hour <= 16; hour++) {
      // 8 AM to 4 PM
      await db.insert(appointmentCaps).values({
        branchId: colomboBranch.id,
        serviceCategory: category,
        hourOfDay: hour,
        maxBookings: category === "Loans & Credit" ? 2 : 4, // 2 per hour for loans, 4 for others
      });
    }
  }
  console.log("✅ Set up hourly appointment caps");

  // 7. SLA Thresholds
  const thresholds = [
    { category: "Cash Services", minutes: 15 },
    { category: "Account Services", minutes: 30 },
    { category: "Loans & Credit", minutes: 45 },
    { category: "Foreign Exchange", minutes: 20 },
  ];

  for (const t of thresholds) {
    await db.insert(slaThresholds).values({
      branchId: colomboBranch.id,
      serviceCategory: t.category,
      thresholdMinutes: t.minutes,
    });
  }
  console.log("✅ Configured SLA thresholds");

  console.log("🌲 Seeding completed successfully!");
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Seeding failed:", error);
  process.exit(1);
});

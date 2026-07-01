import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import {
  branches,
  branchConfig,
  services,
  counters,
  counterServices,
  appointmentCaps,
  slaThresholds,
} from "./schema";
import { sql } from "drizzle-orm";

/**
 * Seeding script for development.
 * Pre-populates the database with multiple branches across different Sri Lankan banks,
 * along with their configurations, services, counters, and mappings.
 */
async function main() {
  console.log("🌱 Seeding database...");
  const { db } = await import("./index");

  // Clean existing data using CASCADE truncate
  console.log("🧹 Cleaning existing database tables...");
  await db.execute(sql`TRUNCATE TABLE branches CASCADE`);
  console.log("🧹 Database cleaned.");

  const branchSeedData = [
    // 1. Bank of Ceylon (BOC)
    {
      name: "BOC Colombo Fort Branch",
      address: "No. 1, Bristol Street, Colombo 01, Sri Lanka",
      lat: "6.9344000",
      lng: "79.8428000",
      phone: "+94 11 220 4444",
      bankCode: "BOC",
    },
    {
      name: "BOC Kandy Super Grade",
      address: "No. 22, Dalada Veediya, Kandy, Sri Lanka",
      lat: "7.2906000",
      lng: "80.6337000",
      phone: "+94 81 222 2222",
      bankCode: "BOC",
    },
    // 2. People's Bank
    {
      name: "People's Bank Corporate Branch",
      address: "No. 75, Sir Chittampalam A Gardiner Mawatha, Colombo 02, Sri Lanka",
      lat: "6.9271000",
      lng: "79.8480000",
      phone: "+94 11 248 1481",
      bankCode: "PEOPLES",
    },
    {
      name: "People's Bank Galle Branch",
      address: "No. 40, Warden Road, Galle, Sri Lanka",
      lat: "6.0535000",
      lng: "80.2117000",
      phone: "+94 91 222 2333",
      bankCode: "PEOPLES",
    },
    // 3. Commercial Bank of Ceylon
    {
      name: "Commercial Bank Fort Branch",
      address: "No. 21, Sir Baron Jayatilaka Mawatha, Colombo 01, Sri Lanka",
      lat: "6.9366000",
      lng: "79.8441000",
      phone: "+94 11 248 6000",
      bankCode: "COMMERCIAL",
    },
    {
      name: "Commercial Bank Jaffna Branch",
      address: "No. 290, Stanley Road, Jaffna, Sri Lanka",
      lat: "9.6615000",
      lng: "80.0255000",
      phone: "+94 21 222 2111",
      bankCode: "COMMERCIAL",
    },
    // 4. Hatton National Bank (HNB)
    {
      name: "HNB Towers Branch",
      address: "No. 479, T. B. Jayah Mawatha, Colombo 10, Sri Lanka",
      lat: "6.9220000",
      lng: "79.8660000",
      phone: "+94 11 266 4664",
      bankCode: "HNB",
    },
    // 5. Sampath Bank
    {
      name: "Sampath Bank Head Office Branch",
      address: "No. 110, Sir James Peiris Mawatha, Colombo 02, Sri Lanka",
      lat: "6.9202000",
      lng: "79.8510000",
      phone: "+94 11 230 3050",
      bankCode: "SAMPATH",
    },
    // 6. Seylan Bank
    {
      name: "Seylan Bank Head Office",
      address: "No. 33, Sir Baron Jayatilaka Mawatha, Colombo 01, Sri Lanka",
      lat: "6.9340000",
      lng: "79.8430000",
      phone: "+94 11 244 5222",
      bankCode: "SEYLAN",
    },
  ];

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

  const counterItems = [
    { name: "Counter 01 (General Cash)" },
    { name: "Counter 02 (Accounts & Inquiries)" },
    { name: "Counter 03 (Specialized Services)" },
  ];

  const categories = ["Cash Services", "Account Services", "Loans & Credit", "Foreign Exchange"];

  const thresholds = [
    { category: "Cash Services", minutes: 15 },
    { category: "Account Services", minutes: 30 },
    { category: "Loans & Credit", minutes: 45 },
    { category: "Foreign Exchange", minutes: 20 },
  ];

  for (const bData of branchSeedData) {
    // 1. Insert Branch
    const [insertedBranch] = await db
      .insert(branches)
      .values({
        name: bData.name,
        address: bData.address,
        lat: bData.lat,
        lng: bData.lng,
        phone: bData.phone,
        bankCode: bData.bankCode,
        isActive: true,
      })
      .returning();

    console.log(`✅ Created branch: ${insertedBranch.name} (${insertedBranch.id}) [Bank: ${insertedBranch.bankCode}]`);

    // 2. Insert Branch Configuration
    await db.insert(branchConfig).values({
      branchId: insertedBranch.id,
      priorityRatioStandard: 3,
      priorityRatioPriority: 1,
      appointmentBufferMinutes: 15,
      appointmentWindowMinutes: 20,
      arrivalConfirmationLeadMinutes: 10,
    });

    // 3. Insert Services
    const createdServices = [];
    for (const item of serviceItems) {
      const [svc] = await db
        .insert(services)
        .values({
          branchId: insertedBranch.id,
          ...item,
          isActive: true,
        })
        .returning();
      createdServices.push(svc);
    }

    // 4. Insert Counters
    const createdCounters = [];
    for (const item of counterItems) {
      const [cnt] = await db
        .insert(counters)
        .values({
          branchId: insertedBranch.id,
          name: item.name,
          status: "closed",
        })
        .returning();
      createdCounters.push(cnt);
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

    // Counter 3 handles all services
    for (const svc of createdServices) {
      await db.insert(counterServices).values({
        counterId: createdCounters[2].id,
        serviceId: svc.id,
      });
    }

    // 6. Appointment Caps (Hourly caps for categories, 8 AM to 4 PM)
    for (const category of categories) {
      for (let hour = 8; hour <= 16; hour++) {
        await db.insert(appointmentCaps).values({
          branchId: insertedBranch.id,
          serviceCategory: category,
          hourOfDay: hour,
          maxBookings: category === "Loans & Credit" ? 2 : 4,
        });
      }
    }

    // 7. SLA Thresholds
    for (const t of thresholds) {
      await db.insert(slaThresholds).values({
        branchId: insertedBranch.id,
        serviceCategory: t.category,
        thresholdMinutes: t.minutes,
      });
    }
  }

  console.log("🌲 Seeding completed successfully!");
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Seeding failed:", error);
  process.exit(1);
});

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
  console.log("🚀 Running manual migration: adding 'bank_code' column...");
  try {
    // Dynamically import db and sql after environment variables are loaded
    const { db } = await import("./index");
    const { sql } = await import("drizzle-orm");

    await db.execute(sql`
      ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "bank_code" text DEFAULT 'BOC' NOT NULL;
    `);
    
    console.log("✅ Manual migration executed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Manual migration failed:", error);
    process.exit(1);
  }
}

main();

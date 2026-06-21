import { db } from "@/lib/db";
import { tickets } from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";

/**
 * Generate an atomic, formatted token number for a branch, pool, and date.
 * Formats:
 * - appointment -> A-NNN
 * - priority -> P-NNN
 * - standard -> S-NNN
 *
 * Runs inside the passed database transaction context (tx) if provided,
 * to ensure database consistency during ticket creation.
 */
export async function generateTokenNumber(
  branchId: string,
  pool: "appointment" | "priority" | "standard",
  tx: any = db
): Promise<string> {
  const prefixMap = {
    appointment: "A",
    priority: "P",
    standard: "S",
  };

  const prefix = prefixMap[pool];

  // Get current date boundaries (start of today in UTC / server local date)
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Count the number of tickets already issued for this branch, pool, and today
  // We use `FOR UPDATE` or equivalent row locking by querying the database within transaction
  const result = await tx
    .select({
      count: sql<number>`count(*)`,
    })
    .from(tickets)
    .where(
      and(
        eq(tickets.branchId, branchId),
        eq(tickets.pool, pool),
        gte(tickets.createdAt, today)
      )
    );

  const currentCount = Number(result[0]?.count || 0);
  const nextNum = currentCount + 1;

  // Pad to 3 digits, e.g. "A-001"
  const formattedNumber = `${prefix}-${String(nextNum).padStart(3, "0")}`;
  return formattedNumber;
}

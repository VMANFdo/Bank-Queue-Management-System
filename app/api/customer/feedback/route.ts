import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { feedback } from "@/db/schema";
import { feedbackSchema } from "@/lib/queue/schemas";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = feedbackSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: result.error.format() },
        { status: 400 }
      );
    }

    const { ticketId, rating, tags, comment } = result.data;

    const [newFeedback] = await db
      .insert(feedback)
      .values({
        ticketId,
        rating,
        tags: tags ?? [],
        comment,
      })
      .returning();

    return NextResponse.json({
      success: true,
      feedback: newFeedback,
    });
  } catch (error: unknown) {
    console.error("Feedback submission error:", error);
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
}

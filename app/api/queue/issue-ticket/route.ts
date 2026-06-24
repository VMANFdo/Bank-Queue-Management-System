import { NextResponse, type NextRequest } from "next/server";
import { issueTicket } from "@/lib/queue/engine";
import { issueTicketSchema } from "@/lib/queue/schemas";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    // 1. Rate Limiting
    const ip = request.headers.get("x-forwarded-for") || request.ip || "unknown-ip";
    const limit = checkRateLimit(`issue-ticket:${ip}`, { maxRequests: 5, windowMs: 60_000 });
    
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before issuing another ticket." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": "5",
            "X-RateLimit-Remaining": String(limit.remaining),
            "X-RateLimit-Reset": String(limit.resetAt),
          },
        }
      );
    }

    // 2. Validate input
    const body = await request.json();
    const parsed = issueTicketSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { branchId, serviceId, pool, customerDetails, linkedServiceId, language } = parsed.data;

    // 3. Issue ticket
    const result = await issueTicket(
      branchId,
      serviceId,
      pool,
      customerDetails,
      linkedServiceId,
      language
    );

    const response = NextResponse.json(result, { status: 201 });
    
    // Add rate limit headers to response
    response.headers.set("X-RateLimit-Limit", "5");
    response.headers.set("X-RateLimit-Remaining", String(limit.remaining));
    response.headers.set("X-RateLimit-Reset", String(limit.resetAt));
    
    return response;
  } catch (error: any) {
    console.error("Error in issue-ticket route:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/auth/session";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);

/**
 * Route matchers
 */
const PUBLIC_ROUTES = [
  /^\/$/, // home
  /^\/branch(\/.*)?$/, // branch pages (customer)
  /^\/track(\/.*)?$/, // ticket tracking (customer)
  /^\/display(\/.*)?$/, // hall display board
  /^\/auth(\/.*)?$/, // auth pages
  /^\/api\/customer(\/.*)?$/, // public customer APIs
  /^\/api\/queue\/issue-ticket$/, // public ticket creation
  /^\/api\/queue\/check-in-appointment$/, // public check-in
  /^\/api\/cron\/sweep$/, // cron (secured by CRON_SECRET header internally)
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((pattern) => pattern.test(pathname));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip next-intl locale detection for API routes to avoid internal rewrites
  const isApiRoute = pathname.startsWith("/api/");

  // Run next-intl middleware for locale detection / routing (only for non-API routes)
  const intlResponse = isApiRoute ? null : intlMiddleware(request);

  // Public routes — skip session check
  if (isPublicRoute(pathname)) {
    return intlResponse ?? NextResponse.next();
  }

  // Protected routes — refresh Supabase session cookie and validate
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static assets)
     * - _next/image  (image optimisation)
     * - favicon.ico, sitemap.xml, robots.txt
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};

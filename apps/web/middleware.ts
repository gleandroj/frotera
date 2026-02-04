import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Check if service is suspended
  const isSuspended = process.env.NEXT_PUBLIC_SERVICE_SUSPENDED === "true";

  if (isSuspended) {
    // Allow health check and API routes to pass through
    // (they will be handled by backend suspension guard)
    if (
      request.nextUrl.pathname.startsWith("/api/health") ||
      request.nextUrl.pathname.startsWith("/api/")
    ) {
      return NextResponse.next();
    }

    // Allow static files and public assets
    if (
      request.nextUrl.pathname.startsWith("/_next") ||
      request.nextUrl.pathname.startsWith("/public") ||
      request.nextUrl.pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp|woff|woff2|ttf|eot)$/)
    ) {
      return NextResponse.next();
    }

    // Redirect all other requests to suspended page
    if (request.nextUrl.pathname !== "/suspended") {
      return NextResponse.redirect(new URL("/suspended", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

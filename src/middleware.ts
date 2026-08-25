import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { token } = req.nextauth;
    const { pathname } = req.nextUrl;

    // Admin area is restricted to admins; staff are bounced to the catalog.
    if (pathname.startsWith("/admin") && token?.role !== "admin") {
      return NextResponse.redirect(new URL("/catalog", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // A valid token means authenticated; unauthenticated users are sent to
      // the sign-in page configured below.
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
    },
  },
);

// Protect everything except the login page, auth API, the cron endpoint
// (guarded by its own secret header), and static assets.
export const config = {
  matcher: [
    "/((?!login|api/auth|api/cron|_next/static|_next/image|favicon.ico).*)",
  ],
};

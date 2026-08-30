import { NextResponse, type NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/session";
import type { Role } from "@prisma/client";

// Route-group -> allowed roles. Checked by prefix match against pathname.
// Keep this in one place so adding a portal is a one-line change.
const PROTECTED_PREFIXES: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: "/admin", roles: ["SUPER_ADMIN", "OPERATIONS_ADMIN", "ACCOUNTS_ADMIN"] },
  { prefix: "/fleet", roles: ["CLIENT_USER"] }, // Ayaan Fleet (corporate client portal)
  { prefix: "/go", roles: ["DRIVER"] }, // Ayaan Go (driver PWA)
  { prefix: "/owner", roles: ["CAR_OWNER"] }, // Ayaan Auto Rentals (owner portal)
];

const ROLE_HOME: Record<Role, string> = {
  SUPER_ADMIN: "/admin",
  OPERATIONS_ADMIN: "/admin",
  ACCOUNTS_ADMIN: "/admin",
  CLIENT_USER: "/fleet",
  DRIVER: "/go",
  CAR_OWNER: "/owner",
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;

  // Signed-in users shouldn't sit on the login screen.
  if (pathname === "/login" && session) {
    return NextResponse.redirect(new URL(ROLE_HOME[session.role], request.url));
  }

  const matchedGroup = PROTECTED_PREFIXES.find((g) => pathname.startsWith(g.prefix));
  if (!matchedGroup) {
    return NextResponse.next();
  }

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!matchedGroup.roles.includes(session.role)) {
    // Authenticated, but wrong portal for this role -> send them home
    // instead of showing a confusing 403 on someone else's dashboard.
    return NextResponse.redirect(new URL(ROLE_HOME[session.role], request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Skip static assets, images, and the Next.js internals. Everything else
  // (including API routes, if any get added) passes through the check above.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};

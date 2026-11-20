import { NextResponse, type NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/session";
import type { Role } from "@/generated/prisma/client";

const PROTECTED_PREFIXES: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: "/admin", roles: ["SUPER_ADMIN", "OPERATIONS_ADMIN", "ACCOUNTS_ADMIN"] },
  { prefix: "/fleet", roles: ["CLIENT_USER"] },
  { prefix: "/go", roles: ["DRIVER"] },
  { prefix: "/owner", roles: ["CAR_OWNER"] },
];

const ROLE_HOME: Record<Role, string> = {
  SUPER_ADMIN: "/admin",
  OPERATIONS_ADMIN: "/admin",
  ACCOUNTS_ADMIN: "/admin",
  CLIENT_USER: "/fleet",
  DRIVER: "/go",
  CAR_OWNER: "/owner",
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;

  if (pathname === "/login" && session) {
    return NextResponse.redirect(new URL(ROLE_HOME[session.role], request.url));
  }

  const group = PROTECTED_PREFIXES.find(({ prefix }) => pathname.startsWith(prefix));
  if (!group) return NextResponse.next();

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (!group.roles.includes(session.role)) {
    return NextResponse.redirect(new URL(ROLE_HOME[session.role], request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};

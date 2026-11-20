import "server-only";
import { redirect } from "next/navigation";
import type { Role } from "@/generated/prisma/client";
import { getCurrentUser, type AuthUser } from "@/lib/auth";

const ROLE_HOME: Record<Role, string> = {
  SUPER_ADMIN: "/admin",
  OPERATIONS_ADMIN: "/admin",
  ACCOUNTS_ADMIN: "/admin",
  CLIENT_USER: "/fleet",
  DRIVER: "/go",
  CAR_OWNER: "/owner",
};

export async function requirePortalUser(allowedRoles: Role[]): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!allowedRoles.includes(user.role)) redirect(ROLE_HOME[user.role]);
  return user;
}

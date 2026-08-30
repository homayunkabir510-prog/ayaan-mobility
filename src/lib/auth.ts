import "server-only";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  signSession,
  verifySession,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  type SessionPayload,
} from "@/lib/session";

const BCRYPT_ROUNDS = 12;

export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  role: Role;
  companyId: string | null;
  driverProfileId: string | null;
  carOwnerProfileId: string | null;
}

/** Hash a plain-text password for storage in User.password. Used when creating/resetting accounts. */
export function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
}

/**
 * Verifies phone + password against the User table and, on success, sets the
 * session cookie. Returns null on any failure (bad phone, bad password,
 * deactivated account) without distinguishing which -- avoids leaking which
 * phone numbers are registered.
 */
export async function login(phone: string, plainPassword: string): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { phone },
    include: { driverProfile: true, carOwnerProfile: true },
  });

  if (!user || !user.isActive) return null;

  const passwordMatches = await bcrypt.compare(plainPassword, user.password);
  if (!passwordMatches) return null;

  const payload: SessionPayload = {
    sub: user.id,
    role: user.role,
    companyId: user.companyId,
    name: user.name,
  };
  const token = await signSession(payload);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });

  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    companyId: user.companyId,
    driverProfileId: user.driverProfile?.id ?? null,
    carOwnerProfileId: user.carOwnerProfile?.id ?? null,
  };
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Reads the session cookie, verifies it, and re-fetches the user from the
 * DB (not just the JWT claims) so `isActive` and profile IDs are always
 * current. Returns null if there's no valid session.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await verifySession(token);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    include: { driverProfile: true, carOwnerProfile: true },
  });

  if (!user || !user.isActive) return null;

  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    companyId: user.companyId,
    driverProfileId: user.driverProfile?.id ?? null,
    carOwnerProfileId: user.carOwnerProfile?.id ?? null,
  };
}

export function hasRole(user: AuthUser, roles: Role[]): boolean {
  return roles.includes(user.role);
}

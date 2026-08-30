import "server-only";
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole, type AuthUser } from "@/lib/auth";

// ------------------------------------------
// Result type every Server Action returns.
// Server Actions can't throw across the client/server boundary and be
// caught cleanly by the caller, so every action returns this instead.
// ------------------------------------------
export type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function fail<T = never>(error: string): ActionResult<T> {
  return { success: false, error };
}

/**
 * Loads the current user and checks their role before an action proceeds.
 * Every mutating Server Action should start with this instead of trusting
 * a role/id passed in from the client.
 */
export async function requireRoleForAction(
  allowedRoles: Role[]
): Promise<{ user: AuthUser } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };
  if (!hasRole(user, allowedRoles)) return { error: "You don't have permission to do this." };
  return { user };
}

/** Prisma Decimal fields deserialize as Decimal objects, not `number`; calculator.ts is Decimal-agnostic on purpose, so convert at this boundary. */
export function decToNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : value.toNumber();
}

export async function logAudit(input: {
  adminId: string;
  action: string;
  entityName: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      adminId: input.adminId,
      action: input.action,
      entityName: input.entityName,
      entityId: input.entityId,
      oldValue: input.oldValue !== undefined ? JSON.stringify(input.oldValue) : null,
      newValue: input.newValue !== undefined ? JSON.stringify(input.newValue) : null,
    },
  });
}

// ------------------------------------------
// Fix for flagged issue #6: holiday/Friday detection must use Asia/Dhaka,
// not server-local or UTC time, or a duty that starts at 11:30 PM Dhaka
// time on a Thursday can get misclassified depending on where the server
// process happens to be running.
// ------------------------------------------
const DHAKA_TIME_ZONE = "Asia/Dhaka";

export function isDhakaFriday(date: Date): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: DHAKA_TIME_ZONE,
    weekday: "short",
  }).format(date);
  return weekday === "Fri";
}

/**
 * Government holidays (Eid, national days, etc.) don't follow a formula, so
 * this can't be computed -- it takes an explicit admin-maintained list of
 * "YYYY-MM-DD" (Dhaka calendar date) strings. Wire this to a real Holiday
 * table when the admin UI for managing the calendar is built; until then
 * pass `[]` and only Friday auto-detection applies.
 */
export function isDhakaHoliday(date: Date, holidayDates: string[] = []): boolean {
  const dhakaDateString = new Intl.DateTimeFormat("en-CA", {
    timeZone: DHAKA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date); // en-CA gives YYYY-MM-DD
  return holidayDates.includes(dhakaDateString);
}

/** The Agreement in effect for a given vehicle at a given moment (defaults to now). */
export async function resolveActiveAgreement(vehicleId: string, at: Date = new Date()) {
  return prisma.agreement.findFirst({
    where: {
      vehicleId,
      isActive: true,
      startDate: { lte: at },
      OR: [{ endDate: null }, { endDate: { gte: at } }],
    },
    orderBy: { startDate: "desc" },
  });
}

import "server-only";
import { Prisma, type Role } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole, type AuthUser } from "@/lib/auth";

export type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function fail<T = never>(error: string): ActionResult<T> {
  return { success: false, error };
}

export async function requireRoleForAction(
  allowedRoles: Role[]
): Promise<{ user: AuthUser } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };
  if (!hasRole(user, allowedRoles)) return { error: "You don't have permission to do this." };
  return { user };
}

export function decToNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : value.toNumber();
}

export function roundMoney(value: number | Prisma.Decimal): Prisma.Decimal {
  const decimal = value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value.toString());
  return decimal.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

type AuditClient = Pick<Prisma.TransactionClient, "auditLog">;

/** Audit creation is awaited and can participate in the caller's transaction. */
export async function logAudit(
  input: {
    adminId: string;
    action: string;
    entityName: string;
    entityId: string;
    oldValue?: unknown;
    newValue?: unknown;
  },
  client: AuditClient = prisma
): Promise<void> {
  await client.auditLog.create({
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

/** Retry PostgreSQL serialization conflicts; the transaction body must be safe to rerun. */
export async function withSerializableTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
  retries = 2
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await prisma.$transaction(callback, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      const retryable =
        typeof error === "object" && error !== null && "code" in error &&
        (error as { code?: unknown }).code === "P2034";
      if (!retryable || attempt >= retries) throw error;
    }
  }
}

const DHAKA_TIME_ZONE = "Asia/Dhaka";

export function isDhakaFriday(date: Date): boolean {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: DHAKA_TIME_ZONE,
    weekday: "short",
  }).format(date) === "Fri";
}

export function dhakaCalendarDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DHAKA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

/** Government holidays are deliberately server-managed; no driver-supplied holiday flag is trusted. */
export function isDhakaHoliday(date: Date, holidayDates: string[] = []): boolean {
  return holidayDates.includes(dhakaCalendarDate(date));
}

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

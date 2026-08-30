// ==========================================
// SERVER ACTION UTILITIES
// Shared auth, audit logging, and error handling
// ==========================================

import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

// ------------------------------------------
// Error Types
// ------------------------------------------

export class ActionError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 400
  ) {
    super(message);
    this.name = "ActionError";
  }
}

// ------------------------------------------
// Auth Utilities
// ------------------------------------------

/**
 * Get the authenticated user from session/context.
 * This is a placeholder — integrate with your actual auth provider
 * (e.g., next-auth, Supabase Auth, or custom JWT middleware).
 *
 * TODO in production: Replace with real auth context extraction.
 */
export async function getAuthUser(): Promise<{
  id: string;
  role: Role;
  email?: string;
} | null> {
  // Placeholder: return null in this stub.
  // In production, extract from headers, cookies, or JWT.
  return null;
}

/**
 * Verify user role. Throws ActionError if insufficient permission.
 */
export async function requireRole(allowedRoles: Role[]): Promise<{
  id: string;
  role: Role;
  email?: string;
}> {
  const user = await getAuthUser();
  if (!user) {
    throw new ActionError("Unauthorized: No authenticated user", "UNAUTHORIZED", 401);
  }
  if (!allowedRoles.includes(user.role)) {
    throw new ActionError(
      `Forbidden: Role ${user.role} not in allowed list`,
      "FORBIDDEN",
      403
    );
  }
  return user;
}

/**
 * Verify that a driver owns the duty log they're submitting.
 */
export async function verifyDutyLogOwnership(dutyLogId: string, driverId: string): Promise<void> {
  const dutyLog = await prisma.dutyLog.findUnique({
    where: { id: dutyLogId },
    select: { driverId: true },
  });

  if (!dutyLog) {
    throw new ActionError("Duty log not found", "NOT_FOUND", 404);
  }

  if (dutyLog.driverId !== driverId) {
    throw new ActionError(
      "Access denied: This duty log does not belong to you",
      "FORBIDDEN",
      403
    );
  }
}

// ------------------------------------------
// Audit Logging
// ------------------------------------------

export interface AuditLogEntry {
  adminId: string;
  action: string; // e.g., "ODOMETER_OVERRIDE", "DUTY_APPROVED", "BILL_EDIT"
  entityName: string; // e.g., "DutyLog"
  entityId: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
}

/**
 * Log an admin action to the AuditLog table.
 * Captures the before/after state for compliance tracking.
 */
export async function logAdminAction(entry: AuditLogEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: entry.adminId,
        action: entry.action,
        entityName: entry.entityName,
        entityId: entry.entityId,
        oldValue: entry.oldValue ? JSON.stringify(entry.oldValue) : null,
        newValue: entry.newValue ? JSON.stringify(entry.newValue) : null,
      },
    });
  } catch (error) {
    console.error("Failed to log audit entry:", error);
    // Don't throw — audit logging should not block the action.
  }
}

// ------------------------------------------
// Validation Helpers
// ------------------------------------------

/**
 * Ensure duty log has all required end-of-duty fields.
 */
export function validateDutyLogCompletion(input: {
  endTime?: Date;
  endOdometer?: number;
  endOdometerImg?: string;
}): void {
  if (!input.endTime) {
    throw new ActionError("endTime is required", "VALIDATION_ERROR", 400);
  }
  if (input.endOdometer === undefined || input.endOdometer === null) {
    throw new ActionError("endOdometer is required", "VALIDATION_ERROR", 400);
  }
  if (!input.endOdometerImg) {
    throw new ActionError("endOdometerImg (photo) is required", "VALIDATION_ERROR", 400);
  }
}

/**
 * Ensure admin override has required fields.
 */
export function validateAdminOverride(input: {
  newKm?: number;
  newOvertimeHours?: number;
  newFuelBill?: number;
  adminEditNote?: string;
}): void {
  // At least one override field must be provided.
  const hasOverride =
    input.newKm !== undefined ||
    input.newOvertimeHours !== undefined ||
    input.newFuelBill !== undefined;

  if (!hasOverride) {
    throw new ActionError(
      "At least one override field (newKm, newOvertimeHours, newFuelBill) is required",
      "VALIDATION_ERROR",
      400
    );
  }

  // Admin note is recommended (though not strictly required).
  if (!input.adminEditNote?.trim()) {
    console.warn("Admin override without editNote — recommended to add context");
  }
}

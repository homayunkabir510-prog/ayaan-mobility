"use server";

// ==========================================
// DUTY LOG SERVER ACTIONS
// Handles driver submissions, admin approvals, and overrides
// ==========================================

import { prisma } from "@/lib/prisma";
import {
  calculateDailyDuty,
  type DutyLogCalcInput,
  type AgreementCalcInput,
} from "@/lib/calculator";
import type { DutyStatus, DutyLog } from "@prisma/client";
import { decToNumber } from "@/lib/actions/shared";
import {
  ActionError,
  requireRole,
  verifyDutyLogOwnership,
  logAdminAction,
  validateDutyLogCompletion,
  validateAdminOverride,
} from "./utils";

// ------------------------------------------
// Types
// ------------------------------------------

export interface SubmitDutyLogInput {
  dutyLogId: string;
  endTime: Date;
  endOdometer: number;
  endOdometerImg: string; // Cloud storage URL
  endLocation?: string;
  routeNotes?: string;
  lunchClaimed?: boolean;
  isHoliday?: boolean;
  isOutsideDhakaTour?: boolean;
}

export interface AdminApproveDutyLogInput {
  dutyLogId: string;
  status: DutyStatus; // APPROVED, REJECTED, or EDITED_BY_ADMIN
  adminEditNote?: string;
}

export interface AdminOverrideDutyLogInput {
  dutyLogId: string;
  newKm?: number;
  newOvertimeHours?: number;
  newFuelBill?: number;
  newOvertimeBill?: number;
  newDinnerBill?: number;
  newTollParkingBill?: number;
  adminEditNote: string; // Required for override
  status?: DutyStatus; // Defaults to EDITED_BY_ADMIN
}

export interface DutyLogResponse {
  success: boolean;
  data?: DutyLog;
  error?: string;
}

// ------------------------------------------
// 1. DRIVER: Submit Duty Log
// Called by Ayaan Go when driver closes out a shift.
// Performs calculations and routes to admin if warnings detected.
// ------------------------------------------

export async function submitDutyLog(input: SubmitDutyLogInput): Promise<DutyLogResponse> {
  try {
    // Auth: Verify driver is authenticated
    const driver = await requireRole(["DRIVER"]);

    // Fetch the duty log and related entities
    const dutyLog = await prisma.dutyLog.findUnique({
      where: { id: input.dutyLogId },
      include: {
        driver: true,
        vehicle: true,
        company: {
          include: {
            agreements: true,
          },
        },
      },
    });

    if (!dutyLog) {
      throw new ActionError("Duty log not found", "NOT_FOUND", 404);
    }

    // Verify ownership
    await verifyDutyLogOwnership(dutyLog.id, driver.id);

    // Validate completion fields
    validateDutyLogCompletion({
      endTime: input.endTime,
      endOdometer: input.endOdometer,
      endOdometerImg: input.endOdometerImg,
    });

    // Find the active agreement for this vehicle/company combination
    const agreement = dutyLog.company.agreements.find(
      (a) => a.vehicleId === dutyLog.vehicleId && a.isActive
    );

    if (!agreement) {
      throw new ActionError(
        "No active agreement found for this vehicle/company",
        "AGREEMENT_NOT_FOUND",
        400
      );
    }

    // Fetch approved expense claims for this duty
    const expenseClaims = await prisma.expenseClaim.findMany({
      where: {
        dutyLogId: dutyLog.id,
        status: "APPROVED",
      },
    });

    const approvedTollParkingTotal = expenseClaims.reduce(
      (sum, claim) => sum + decToNumber(claim.amount),
      0
    );

    // Build calculator inputs
    const dutyCalcInput: DutyLogCalcInput = {
      startTime: dutyLog.startTime,
      endTime: input.endTime,
      startOdometer: dutyLog.startOdometer,
      endOdometer: input.endOdometer,
      vehicleFuelType: dutyLog.vehicle.fuelType,
      isHoliday: input.isHoliday ?? false,
      isOutsideDhakaTour: input.isOutsideDhakaTour ?? false,
      lunchClaimed: input.lunchClaimed ?? false,
      approvedTollParkingTotal,
    };

    const agreementInput: AgreementCalcInput = {
      standardDutyHours: agreement.standardDutyHours,
      overtimeRatePerHour: decToNumber(agreement.overtimeRatePerHour),
      fridayHolidayOvertime: agreement.fridayHolidayOvertime,
      cngRatePerKm: decToNumber(agreement.cngRatePerKm),
      lpgRatePerKm: decToNumber(agreement.lpgRatePerKm),
      octaneRatePerKm: decToNumber(agreement.octaneRatePerKm),
      lunchAllowance: decToNumber(agreement.lunchAllowance),
      dinnerAllowance: decToNumber(agreement.dinnerAllowance),
      tourAllowancePerDay: decToNumber(agreement.tourAllowancePerDay),
      allowTollParkingClaim: agreement.allowTollParkingClaim,
    };

    // Calculate
    const result = calculateDailyDuty(dutyCalcInput, agreementInput);

    // Determine status: if warnings exist, flag for admin review; otherwise, auto-approve
    const initialStatus: DutyStatus = result.warnings.length > 0 ? "PENDING_APPROVAL" : "APPROVED";

    // Update the duty log with calculations and submission
    const updatedDutyLog = await prisma.dutyLog.update({
      where: { id: dutyLog.id },
      data: {
        endTime: input.endTime,
        endOdometer: input.endOdometer,
        endOdometerImg: input.endOdometerImg,
        endLocation: input.endLocation ?? null,
        routeNotes: input.routeNotes ?? null,
        totalKm: result.totalKm,
        dutyHours: result.dutyHours,
        overtimeHours: result.overtimeHours,
        fuelBill: result.fuelBill,
        overtimeBill: result.overtimeBill,
        lunchBill: result.lunchBill,
        dinnerBill: result.dinnerBill,
        tourAllowance: result.tourAllowance,
        tollParkingBill: result.tollParkingBill,
        totalDailyBill: result.totalDailyBill,
        isHoliday: input.isHoliday ?? false,
        isOutsideDhakaTour: input.isOutsideDhakaTour ?? false,
        status: initialStatus,
        adminEditNote: result.warnings.length > 0 ? `Auto-flagged for review: ${result.warnings.join("; ")}` : null,
      },
    });

    return {
      success: true,
      data: updatedDutyLog,
    };
  } catch (error) {
    const message = error instanceof ActionError ? error.message : "Failed to submit duty log";
    console.error("submitDutyLog error:", error);
    return {
      success: false,
      error: message,
    };
  }
}

// ------------------------------------------
// 2. ADMIN: Approve or Reject Duty Log
// Called by Ayaan Mobility admin dashboard
// ------------------------------------------

export async function approveDutyLog(input: AdminApproveDutyLogInput): Promise<DutyLogResponse> {
  try {
    // Auth: Verify admin role
    const admin = await requireRole(["SUPER_ADMIN", "OPERATIONS_ADMIN"]);

    // Fetch duty log
    const dutyLog = await prisma.dutyLog.findUnique({
      where: { id: input.dutyLogId },
    });

    if (!dutyLog) {
      throw new ActionError("Duty log not found", "NOT_FOUND", 404);
    }

    // Capture old state for audit
    const oldState = {
      status: dutyLog.status,
      approvedById: dutyLog.approvedById,
      adminEditNote: dutyLog.adminEditNote,
    };

    // Update duty log
    const updatedDutyLog = await prisma.dutyLog.update({
      where: { id: dutyLog.id },
      data: {
        status: input.status,
        approvedById: admin.id,
        adminEditNote: input.adminEditNote ?? dutyLog.adminEditNote,
      },
    });

    // Log to audit trail
    await logAdminAction({
      adminId: admin.id,
      action: `DUTY_${input.status}`,
      entityName: "DutyLog",
      entityId: dutyLog.id,
      oldValue: oldState,
      newValue: {
        status: updatedDutyLog.status,
        approvedById: updatedDutyLog.approvedById,
        adminEditNote: updatedDutyLog.adminEditNote,
      },
    });

    return {
      success: true,
      data: updatedDutyLog,
    };
  } catch (error) {
    const message = error instanceof ActionError ? error.message : "Failed to approve duty log";
    console.error("approveDutyLog error:", error);
    return {
      success: false,
      error: message,
    };
  }
}

// ------------------------------------------
// 3. ADMIN: Override Duty Log Fields
// Allow admins to manually adjust calculations
// (e.g., manually fix km if photo is unclear, adjust overtime).
// Records override in audit log for compliance.
// ------------------------------------------

export async function overrideDutyLog(input: AdminOverrideDutyLogInput): Promise<DutyLogResponse> {
  try {
    // Auth: Verify super admin (higher privilege than operations)
    const admin = await requireRole(["SUPER_ADMIN"]);

    // Validate override input
    validateAdminOverride({
      newKm: input.newKm,
      newOvertimeHours: input.newOvertimeHours,
      newFuelBill: input.newFuelBill,
      adminEditNote: input.adminEditNote,
    });

    // Fetch duty log
    const dutyLog = await prisma.dutyLog.findUnique({
      where: { id: input.dutyLogId },
      include: { vehicle: true },
    });

    if (!dutyLog) {
      throw new ActionError("Duty log not found", "NOT_FOUND", 404);
    }

    // Capture old state for audit
    const oldState = {
      totalKm: dutyLog.totalKm,
      overtimeHours: dutyLog.overtimeHours,
      fuelBill: decToNumber(dutyLog.fuelBill),
      overtimeBill: decToNumber(dutyLog.overtimeBill),
      dinnerBill: decToNumber(dutyLog.dinnerBill),
      tollParkingBill: decToNumber(dutyLog.tollParkingBill),
      totalDailyBill: decToNumber(dutyLog.totalDailyBill),
      status: dutyLog.status,
    };

    // Calculate the bill delta for each explicitly overridden bill field.
    const newTotalDailyBill =
      oldState.totalDailyBill
      - oldState.fuelBill
      + (input.newFuelBill ?? oldState.fuelBill)
      - oldState.overtimeBill
      + (input.newOvertimeBill ?? oldState.overtimeBill)
      - oldState.dinnerBill
      + (input.newDinnerBill ?? oldState.dinnerBill)
      - oldState.tollParkingBill
      + (input.newTollParkingBill ?? oldState.tollParkingBill);

    // Update duty log
    const updatedDutyLog = await prisma.dutyLog.update({
      where: { id: dutyLog.id },
      data: {
        totalKm: input.newKm ?? dutyLog.totalKm,
        overtimeHours: input.newOvertimeHours ?? dutyLog.overtimeHours,
        fuelBill: input.newFuelBill ?? dutyLog.fuelBill,
        overtimeBill: input.newOvertimeBill ?? dutyLog.overtimeBill,
        dinnerBill: input.newDinnerBill ?? dutyLog.dinnerBill,
        tollParkingBill: input.newTollParkingBill ?? dutyLog.tollParkingBill,
        totalDailyBill: Math.max(0, newTotalDailyBill),
        status: input.status ?? "EDITED_BY_ADMIN",
        approvedById: admin.id,
        adminEditNote: input.adminEditNote,
      },
    });

    // Log to audit trail with detailed before/after
    await logAdminAction({
      adminId: admin.id,
      action: "DUTY_OVERRIDE",
      entityName: "DutyLog",
      entityId: dutyLog.id,
      oldValue: oldState,
      newValue: {
        totalKm: updatedDutyLog.totalKm,
        overtimeHours: updatedDutyLog.overtimeHours,
        fuelBill: updatedDutyLog.fuelBill,
        overtimeBill: updatedDutyLog.overtimeBill,
        dinnerBill: updatedDutyLog.dinnerBill,
        tollParkingBill: updatedDutyLog.tollParkingBill,
        totalDailyBill: updatedDutyLog.totalDailyBill,
        status: updatedDutyLog.status,
        adminEditNote: input.adminEditNote,
      },
    });

    return {
      success: true,
      data: updatedDutyLog,
    };
  } catch (error) {
    const message = error instanceof ActionError ? error.message : "Failed to override duty log";
    console.error("overrideDutyLog error:", error);
    return {
      success: false,
      error: message,
    };
  }
}

// ------------------------------------------
// 4. ADMIN: Reject Duty Log with Reason
// Sends duty back to driver for resubmission
// ------------------------------------------

export async function rejectDutyLog(
  dutyLogId: string,
  reason: string
): Promise<DutyLogResponse> {
  try {
    // Auth: Verify admin role
    const admin = await requireRole(["SUPER_ADMIN", "OPERATIONS_ADMIN"]);

    // Fetch duty log
    const dutyLog = await prisma.dutyLog.findUnique({
      where: { id: dutyLogId },
    });

    if (!dutyLog) {
      throw new ActionError("Duty log not found", "NOT_FOUND", 404);
    }

    // Capture old state
    const oldState = {
      status: dutyLog.status,
      adminEditNote: dutyLog.adminEditNote,
    };

    // Update with rejection
    const updatedDutyLog = await prisma.dutyLog.update({
      where: { id: dutyLogId },
      data: {
        status: "REJECTED",
        approvedById: admin.id,
        adminEditNote: reason,
      },
    });

    // Log to audit trail
    await logAdminAction({
      adminId: admin.id,
      action: "DUTY_REJECTED",
      entityName: "DutyLog",
      entityId: dutyLogId,
      oldValue: oldState,
      newValue: {
        status: "REJECTED",
        adminEditNote: reason,
      },
    });

    return {
      success: true,
      data: updatedDutyLog,
    };
  } catch (error) {
    const message = error instanceof ActionError ? error.message : "Failed to reject duty log";
    console.error("rejectDutyLog error:", error);
    return {
      success: false,
      error: message,
    };
  }
}

// ------------------------------------------
// 5. DRIVER: Fetch Their Own Duty Log Details
// Read-only fetch for the driver PWA
// ------------------------------------------

export async function fetchDutyLogDetails(dutyLogId: string): Promise<{
  success: boolean;
  data?: DutyLog & { vehicle: { fuelType: string }; driver: { name: string } };
  error?: string;
}> {
  try {
    // Auth: Verify driver
    const driver = await requireRole(["DRIVER"]);

    // Fetch and verify ownership
    const dutyLog = await prisma.dutyLog.findUnique({
      where: { id: dutyLogId },
      include: {
        vehicle: { select: { fuelType: true } },
        driver: { select: { user: { select: { name: true } } } },
      },
    });

    if (!dutyLog) {
      throw new ActionError("Duty log not found", "NOT_FOUND", 404);
    }

    await verifyDutyLogOwnership(dutyLogId, driver.id);

    return {
      success: true,
      data: {
        ...dutyLog,
        driver: { name: dutyLog.driver.user.name },
      },
    };
  } catch (error) {
    const message = error instanceof ActionError ? error.message : "Failed to fetch duty log";
    console.error("fetchDutyLogDetails error:", error);
    return {
      success: false,
      error: message,
    };
  }
}

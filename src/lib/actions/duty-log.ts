"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isEvidenceObjectForRecord } from "@/lib/evidence-path";
import { calculateDailyDuty, type AgreementCalcInput } from "@/lib/calculator";
import {
  decToNumber,
  fail,
  isDhakaFriday,
  isDhakaHoliday,
  logAudit,
  ok,
  requireRoleForAction,
  withSerializableTransaction,
  type ActionResult,
} from "@/lib/actions/shared";
import { DUTY_OVERRIDE_ROLES, DUTY_REVIEW_ROLES } from "@/lib/permissions";
import { evidenceObjectExists } from "@/lib/supabase/storage";
import {
  adminOverrideInputSchema,
  endDutyInputSchema,
  startDutyInputSchema,
  type AdminOverrideInput,
  type EndDutyInput,
  type StartDutyInput,
} from "@/lib/validation/duty";

export type { AdminOverrideInput, EndDutyInput, StartDutyInput };

function prismaErrorCode(error: unknown): string | null {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : null;
}

function actionLog(context: string, error: unknown): void {
  console.error(context, prismaErrorCode(error) ?? (error instanceof Error ? error.name : "UnknownError"));
}

function agreementForCalculation(agreement: {
  standardDutyHours: number;
  overtimeRatePerHour: unknown;
  fridayHolidayOvertime: boolean;
  cngRatePerKm: unknown;
  lpgRatePerKm: unknown;
  octaneRatePerKm: unknown;
  lunchAllowance: unknown;
  dinnerAllowance: unknown;
  tourAllowancePerDay: unknown;
  allowTollParkingClaim: boolean;
}): AgreementCalcInput {
  return {
    standardDutyHours: agreement.standardDutyHours,
    overtimeRatePerHour: decToNumber(agreement.overtimeRatePerHour as never),
    fridayHolidayOvertime: agreement.fridayHolidayOvertime,
    cngRatePerKm: decToNumber(agreement.cngRatePerKm as never),
    lpgRatePerKm: decToNumber(agreement.lpgRatePerKm as never),
    octaneRatePerKm: decToNumber(agreement.octaneRatePerKm as never),
    lunchAllowance: decToNumber(agreement.lunchAllowance as never),
    dinnerAllowance: decToNumber(agreement.dinnerAllowance as never),
    tourAllowancePerDay: decToNumber(agreement.tourAllowancePerDay as never),
    allowTollParkingClaim: agreement.allowTollParkingClaim,
  };
}

function appendReviewWarnings(warnings: string[], totalKm: number, dutyHours: number, claimsAllowance: boolean): string[] {
  const result = [...warnings];
  if (totalKm > 500) result.push("Distance exceeds the 500 km review threshold.");
  if (dutyHours > 20) result.push("Duty duration exceeds the 20 hour review threshold.");
  if (claimsAllowance) result.push("Driver-claimed allowances require reviewer confirmation.");
  return result;
}

export async function startDutyAction(
  rawInput: StartDutyInput
): Promise<ActionResult<{ dutyLogId: string; alreadyStarted: boolean }>> {
  try {
    const auth = await requireRoleForAction(["DRIVER"]);
    if ("error" in auth) return fail(auth.error);
    const driverProfileId = auth.user.driverProfileId;
    if (!driverProfileId) return fail("This account has no driver profile.");

    const parsed = startDutyInputSchema.safeParse(rawInput);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
    const input = parsed.data;
    if (!isEvidenceObjectForRecord(input.startOdometerImg, auth.user.id, "start-odometer", input.vehicleId)) return fail("Upload your own starting odometer evidence first.");
    if (!(await evidenceObjectExists(input.startOdometerImg))) return fail("Starting odometer evidence is not available. Upload it again.");

    const startedAt = new Date();
    const result = await withSerializableTransaction(async (tx) => {
      const existing = await tx.dutyLog.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) {
        if (existing.driverId !== driverProfileId || existing.vehicleId !== input.vehicleId) {
          return fail("This duty request could not be matched to your account.");
        }
        return ok({ dutyLogId: existing.id, alreadyStarted: true });
      }

      const openDuty = await tx.dutyLog.findFirst({ where: { driverId: driverProfileId, endTime: null } });
      if (openDuty) return fail("You already have a duty in progress. End that one before starting a new duty.");

      const vehicle = await tx.vehicle.findFirst({
        where: { id: input.vehicleId, currentDriverId: driverProfileId, status: "ACTIVE" },
        select: { id: true },
      });
      if (!vehicle) return fail("This active vehicle is not assigned to you.");

      const agreements = await tx.agreement.findMany({
        where: {
          vehicleId: vehicle.id,
          isActive: true,
          startDate: { lte: startedAt },
          OR: [{ endDate: null }, { endDate: { gte: startedAt } }],
        },
        orderBy: { startDate: "desc" },
        take: 2,
      });
      if (agreements.length === 0) return fail("No active agreement covers this vehicle. Ask an administrator to set one up.");
      if (agreements.length > 1) return fail("More than one active agreement covers this vehicle. Ask an administrator to resolve it.");
      const agreement = agreements[0];

      const vehicleLock = await tx.vehicle.updateMany({
        where: { id: vehicle.id, currentDriverId: driverProfileId, status: "ACTIVE" },
        data: { status: "IN_DUTY" },
      });
      if (vehicleLock.count !== 1) return fail("This vehicle is no longer available. Refresh and try again.");

      const dutyLog = await tx.dutyLog.create({
        data: {
          idempotencyKey: input.idempotencyKey,
          driverId: driverProfileId,
          vehicleId: vehicle.id,
          companyId: agreement.companyId,
          agreementId: agreement.id,
          startTime: startedAt,
          startOdometer: input.startOdometer,
          startOdometerImg: input.startOdometerImg,
          startLocation: input.startLocation || null,
          status: "PENDING_APPROVAL",
        },
      });

      await logAudit({
        adminId: auth.user.id,
        action: "DUTY_LOG_STARTED",
        entityName: "DutyLog",
        entityId: dutyLog.id,
        newValue: { vehicleId: vehicle.id, agreementId: agreement.id, startOdometer: input.startOdometer },
      }, tx);
      return ok({ dutyLogId: dutyLog.id, alreadyStarted: false });
    });

    if (result.success) {
      revalidatePath("/go");
      revalidatePath("/admin");
    }
    return result;
  } catch (error) {
    actionLog("startDutyAction failed", error);
    if (prismaErrorCode(error) === "P2002") {
      try {
        const parsed = startDutyInputSchema.safeParse(rawInput);
        const parsedData = parsed.success ? parsed.data : null;
        const existing = parsedData
          ? await prisma.dutyLog.findUnique({ where: { idempotencyKey: parsedData.idempotencyKey } })
          : null;
        const user = await requireRoleForAction(["DRIVER"]);
        if (existing && parsedData && !("error" in user) && existing.driverId === user.user.driverProfileId && existing.vehicleId === parsedData.vehicleId) {
          return ok({ dutyLogId: existing.id, alreadyStarted: true });
        }
      } catch {
        // Return the generic failure below; never reveal another driver's row.
      }
    }
    return fail("Could not start this duty. Refresh and try again.");
  }
}

export async function endDutyAction(
  rawInput: EndDutyInput
): Promise<ActionResult<{ totalDailyBill: number; warnings: string[]; status: "PENDING_APPROVAL" }>> {
  try {
    const auth = await requireRoleForAction(["DRIVER"]);
    if ("error" in auth) return fail(auth.error);
    const driverProfileId = auth.user.driverProfileId;
    if (!driverProfileId) return fail("This account has no driver profile.");

    const parsed = endDutyInputSchema.safeParse(rawInput);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
    const input = parsed.data;
    if (!isEvidenceObjectForRecord(input.endOdometerImg, auth.user.id, "end-odometer", input.dutyLogId)) return fail("Upload your own ending odometer evidence first.");
    if (!(await evidenceObjectExists(input.endOdometerImg))) return fail("Ending odometer evidence is not available. Upload it again.");

    const result = await withSerializableTransaction(async (tx) => {
      const dutyLog = await tx.dutyLog.findFirst({
        where: { id: input.dutyLogId, driverId: driverProfileId, endTime: null },
        include: { vehicle: true, agreement: true },
      });
      if (!dutyLog) return fail("Duty log not found or already closed.");

      const endTime = new Date();
      const isHoliday = isDhakaFriday(dutyLog.startTime) || isDhakaHoliday(dutyLog.startTime, []);
      const calculation = calculateDailyDuty({
        startTime: dutyLog.startTime,
        endTime,
        startOdometer: dutyLog.startOdometer,
        endOdometer: input.endOdometer,
        vehicleFuelType: dutyLog.vehicle.fuelType,
        isHoliday,
        isOutsideDhakaTour: input.isOutsideDhakaTour,
        lunchClaimed: input.lunchClaimed,
        approvedTollParkingTotal: 0,
      }, agreementForCalculation(dutyLog.agreement));
      const warnings = appendReviewWarnings(
        calculation.warnings,
        calculation.totalKm,
        calculation.dutyHours,
        input.lunchClaimed || input.isOutsideDhakaTour
      );

      const updated = await tx.dutyLog.updateMany({
        where: { id: dutyLog.id, driverId: driverProfileId, endTime: null },
        data: {
          endTime,
          endOdometer: input.endOdometer,
          endOdometerImg: input.endOdometerImg,
          endLocation: input.endLocation || null,
          routeNotes: input.routeNotes,
          totalKm: calculation.totalKm,
          dutyHours: calculation.dutyHours,
          overtimeHours: calculation.overtimeHours,
          fuelBill: calculation.fuelBill,
          overtimeBill: calculation.overtimeBill,
          lunchBill: calculation.lunchBill,
          dinnerBill: calculation.dinnerBill,
          tourAllowance: calculation.tourAllowance,
          tollParkingBill: calculation.tollParkingBill,
          totalDailyBill: calculation.totalDailyBill,
          isHoliday,
          isOutsideDhakaTour: input.isOutsideDhakaTour,
          status: "PENDING_APPROVAL",
          adminEditNote: warnings.length ? warnings.join(" ") : "Submitted; awaiting authorized review.",
        },
      });
      if (updated.count !== 1) return fail("This duty was already submitted. Refresh to see its current status.");

      const otherOpenDuty = await tx.dutyLog.findFirst({
        where: { vehicleId: dutyLog.vehicleId, endTime: null, id: { not: dutyLog.id } },
        select: { id: true },
      });
      if (!otherOpenDuty) {
        await tx.vehicle.updateMany({ where: { id: dutyLog.vehicleId, status: "IN_DUTY" }, data: { status: "ACTIVE" } });
      }

      await logAudit({
        adminId: auth.user.id,
        action: "DUTY_LOG_SUBMITTED",
        entityName: "DutyLog",
        entityId: dutyLog.id,
        oldValue: { status: dutyLog.status, endTime: null },
        newValue: { status: "PENDING_APPROVAL", totalKm: calculation.totalKm, totalDailyBill: calculation.totalDailyBill, warnings },
      }, tx);
      return ok({ totalDailyBill: calculation.totalDailyBill, warnings, status: "PENDING_APPROVAL" as const });
    });

    if (result.success) {
      revalidatePath("/go");
      revalidatePath("/admin");
      revalidatePath("/fleet");
    }
    return result;
  } catch (error) {
    actionLog("endDutyAction failed", error);
    return fail("Could not submit this duty. Refresh and try again.");
  }
}

export async function adminOverrideDutyLogAction(
  rawInput: AdminOverrideInput
): Promise<ActionResult<{ totalDailyBill: number; warnings: string[] }>> {
  try {
    const auth = await requireRoleForAction(DUTY_OVERRIDE_ROLES);
    if ("error" in auth) return fail(auth.error);
    const parsed = adminOverrideInputSchema.safeParse(rawInput);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
    const input = parsed.data;

    const result = await withSerializableTransaction(async (tx) => {
      const dutyLog = await tx.dutyLog.findUnique({
        where: { id: input.dutyLogId },
        include: { vehicle: true, agreement: true },
      });
      if (!dutyLog || !dutyLog.endTime || dutyLog.endOdometer === null) return fail("Completed duty log not found.");
      if (dutyLog.status !== "PENDING_APPROVAL") return fail("Only a pending duty can be corrected. Reopen it through an authorized workflow first.");

      const startOdometer = input.startOdometer ?? dutyLog.startOdometer;
      const endOdometer = input.endOdometer ?? dutyLog.endOdometer;
      const approvedClaims = await tx.expenseClaim.aggregate({
        where: { dutyLogId: dutyLog.id, status: "APPROVED" },
        _sum: { amount: true },
      });
      const calculation = calculateDailyDuty({
        startTime: dutyLog.startTime,
        endTime: dutyLog.endTime,
        startOdometer,
        endOdometer,
        vehicleFuelType: dutyLog.vehicle.fuelType,
        isHoliday: dutyLog.isHoliday,
        isOutsideDhakaTour: dutyLog.isOutsideDhakaTour,
        lunchClaimed: decToNumber(dutyLog.lunchBill) > 0,
        approvedTollParkingTotal: decToNumber(approvedClaims._sum.amount),
      }, agreementForCalculation(dutyLog.agreement));
      const warnings = appendReviewWarnings(calculation.warnings, calculation.totalKm, calculation.dutyHours, false);
      const updated = await tx.dutyLog.updateMany({
        where: { id: dutyLog.id, status: "PENDING_APPROVAL", updatedAt: dutyLog.updatedAt },
        data: {
          startOdometer,
          endOdometer,
          totalKm: calculation.totalKm,
          dutyHours: calculation.dutyHours,
          overtimeHours: calculation.overtimeHours,
          fuelBill: calculation.fuelBill,
          overtimeBill: calculation.overtimeBill,
          lunchBill: calculation.lunchBill,
          dinnerBill: calculation.dinnerBill,
          tourAllowance: calculation.tourAllowance,
          tollParkingBill: calculation.tollParkingBill,
          totalDailyBill: calculation.totalDailyBill,
          status: "PENDING_APPROVAL",
          approvedById: null,
          adminEditNote: `${input.note}${warnings.length ? ` Review flags: ${warnings.join(" ")}` : ""}`,
        },
      });
      if (updated.count !== 1) return fail("This duty changed while you were reviewing it. Refresh and try again.");

      await logAudit({
        adminId: auth.user.id,
        action: "DUTY_LOG_CORRECTED",
        entityName: "DutyLog",
        entityId: dutyLog.id,
        oldValue: { startOdometer: dutyLog.startOdometer, endOdometer: dutyLog.endOdometer, totalDailyBill: dutyLog.totalDailyBill },
        newValue: { startOdometer, endOdometer, totalDailyBill: calculation.totalDailyBill, note: input.note, status: "PENDING_APPROVAL" },
      }, tx);
      return ok({ totalDailyBill: calculation.totalDailyBill, warnings });
    });

    if (result.success) {
      revalidatePath("/admin");
      revalidatePath("/fleet");
      revalidatePath("/go");
    }
    return result;
  } catch (error) {
    actionLog("adminOverrideDutyLogAction failed", error);
    return fail("Could not correct this duty. Refresh and try again.");
  }
}

const decisionSchema = z.object({
  dutyLogId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500).optional(),
});

async function setDutyLogDecision(
  rawInput: { dutyLogId: string; reason?: string },
  decision: "APPROVED" | "REJECTED"
): Promise<ActionResult<null>> {
  try {
    const auth = await requireRoleForAction(DUTY_REVIEW_ROLES);
    if ("error" in auth) return fail(auth.error);
    const parsed = decisionSchema.safeParse(rawInput);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
    const input = parsed.data;
    if (decision === "REJECTED" && !input.reason) return fail("Give a reason for rejecting this duty log.");
    const result = await withSerializableTransaction(async (tx) => {
      const dutyLog = await tx.dutyLog.findFirst({
        where: { id: input.dutyLogId, status: "PENDING_APPROVAL", endTime: { not: null } },
        select: { id: true, status: true, companyId: true, approvedById: true, adminEditNote: true },
      });
      if (!dutyLog) return fail("Pending duty log not found.");

      const pendingClaimCount = await tx.expenseClaim.count({
        where: { dutyLogId: dutyLog.id, status: "PENDING" },
      });
      if (pendingClaimCount > 0) return fail("Review or reject all pending expense claims before deciding this duty.");

      const updated = await tx.dutyLog.updateMany({
        where: { id: dutyLog.id, status: "PENDING_APPROVAL", endTime: { not: null } },
        data: {
          status: decision,
          approvedById: auth.user.id,
          adminEditNote: decision === "REJECTED" ? input.reason! : dutyLog.adminEditNote,
        },
      });
      if (updated.count !== 1) return fail("This duty changed while it was being reviewed. Refresh and try again.");

      await logAudit({
        adminId: auth.user.id,
        action: decision === "APPROVED" ? "DUTY_LOG_APPROVED" : "DUTY_LOG_REJECTED",
        entityName: "DutyLog",
        entityId: dutyLog.id,
        oldValue: { status: dutyLog.status, approvedById: dutyLog.approvedById },
        newValue: { status: decision, reason: input.reason ?? null, companyId: dutyLog.companyId },
      }, tx);
      return ok(null);
    });

    if (result.success) {
      revalidatePath("/admin");
      revalidatePath("/fleet");
      revalidatePath("/go");
    }
    return result;
  } catch (error) {
    actionLog("setDutyLogDecision failed", error);
    return fail("Could not update the duty review. Refresh and try again.");
  }
}

export async function approveDutyLogAction(dutyLogId: string): Promise<ActionResult<null>> {
  return setDutyLogDecision({ dutyLogId }, "APPROVED");
}

export async function rejectDutyLogAction(dutyLogId: string, reason: string): Promise<ActionResult<null>> {
  return setDutyLogDecision({ dutyLogId, reason }, "REJECTED");
}

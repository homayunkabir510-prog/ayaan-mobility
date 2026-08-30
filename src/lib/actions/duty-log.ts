"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { calculateDailyDuty, type AgreementCalcInput } from "@/lib/calculator";
import {
  ok,
  fail,
  type ActionResult,
  requireRoleForAction,
  decToNumber,
  logAudit,
  isDhakaFriday,
  isDhakaHoliday,
  resolveActiveAgreement,
} from "@/lib/actions/shared";

// ------------------------------------------
// Start Duty
// ------------------------------------------

const startDutySchema = z.object({
  idempotencyKey: z.string().min(1),
  vehicleId: z.string().uuid(),
  startOdometer: z.number().nonnegative(),
  startOdometerImg: z.string().url(),
  startLocation: z.string().optional(),
});
export type StartDutyInput = z.infer<typeof startDutySchema>;

export async function startDutyAction(
  rawInput: StartDutyInput
): Promise<ActionResult<{ dutyLogId: string; alreadyStarted: boolean }>> {
  const auth = await requireRoleForAction(["DRIVER"]);
  if ("error" in auth) return fail(auth.error);
  const driverProfileId = auth.user.driverProfileId;
  if (!driverProfileId) return fail("This account has no driver profile.");

  const parsed = startDutySchema.safeParse(rawInput);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  const input = parsed.data;

  // Retried offline submission: the same idempotencyKey means the same
  // duty-start attempt, so return the existing row instead of erroring or
  // creating a duplicate.
  const existing = await prisma.dutyLog.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) return ok({ dutyLogId: existing.id, alreadyStarted: true });

  const openDuty = await prisma.dutyLog.findFirst({
    where: { driverId: driverProfileId, endTime: null },
  });
  if (openDuty) {
    return fail(
      "You already have a duty in progress. End that one before starting a new duty."
    );
  }

  const agreement = await resolveActiveAgreement(input.vehicleId);
  if (!agreement) {
    return fail("No active agreement covers this vehicle. Ask an admin to set one up.");
  }

  const dutyLog = await prisma.dutyLog.create({
    data: {
      idempotencyKey: input.idempotencyKey,
      driverId: driverProfileId,
      vehicleId: input.vehicleId,
      companyId: agreement.companyId,
      agreementId: agreement.id,
      startTime: new Date(),
      startOdometer: input.startOdometer,
      startOdometerImg: input.startOdometerImg,
      startLocation: input.startLocation,
    },
  });

  return ok({ dutyLogId: dutyLog.id, alreadyStarted: false });
}

// ------------------------------------------
// End Duty (runs the calculation engine)
// ------------------------------------------

const endDutySchema = z.object({
  dutyLogId: z.string().uuid(),
  endOdometer: z.number().nonnegative(),
  endOdometerImg: z.string().url(),
  endLocation: z.string().optional(),
  routeNotes: z.string().min(1, "Please note where the car traveled."),
  lunchClaimed: z.boolean().default(false),
  isOutsideDhakaTour: z.boolean().default(false),
  /** Manual override for government holidays; Friday is auto-detected. */
  isGovernmentHoliday: z.boolean().default(false),
});
export type EndDutyInput = z.infer<typeof endDutySchema>;

export async function endDutyAction(
  rawInput: EndDutyInput
): Promise<ActionResult<{ totalDailyBill: number; warnings: string[] }>> {
  const auth = await requireRoleForAction(["DRIVER"]);
  if ("error" in auth) return fail(auth.error);
  const driverProfileId = auth.user.driverProfileId;
  if (!driverProfileId) return fail("This account has no driver profile.");

  const parsed = endDutySchema.safeParse(rawInput);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  const input = parsed.data;

  const dutyLog = await prisma.dutyLog.findUnique({
    where: { id: input.dutyLogId },
    include: { vehicle: true, agreement: true },
  });
  if (!dutyLog || dutyLog.driverId !== driverProfileId) {
    return fail("Duty log not found.");
  }
  if (dutyLog.endTime) {
    return fail("This duty has already been closed out.");
  }

  const endTime = new Date();
  const isHoliday = isDhakaFriday(dutyLog.startTime) || isDhakaHoliday(dutyLog.startTime, []) ||
    input.isGovernmentHoliday;

  const agreementInput: AgreementCalcInput = {
    standardDutyHours: dutyLog.agreement.standardDutyHours,
    overtimeRatePerHour: decToNumber(dutyLog.agreement.overtimeRatePerHour),
    fridayHolidayOvertime: dutyLog.agreement.fridayHolidayOvertime,
    cngRatePerKm: decToNumber(dutyLog.agreement.cngRatePerKm),
    lpgRatePerKm: decToNumber(dutyLog.agreement.lpgRatePerKm),
    octaneRatePerKm: decToNumber(dutyLog.agreement.octaneRatePerKm),
    lunchAllowance: decToNumber(dutyLog.agreement.lunchAllowance),
    dinnerAllowance: decToNumber(dutyLog.agreement.dinnerAllowance),
    tourAllowancePerDay: decToNumber(dutyLog.agreement.tourAllowancePerDay),
    allowTollParkingClaim: dutyLog.agreement.allowTollParkingClaim,
  };

  const result = calculateDailyDuty(
    {
      startTime: dutyLog.startTime,
      endTime,
      startOdometer: dutyLog.startOdometer,
      endOdometer: input.endOdometer,
      vehicleFuelType: dutyLog.vehicle.fuelType,
      isHoliday,
      isOutsideDhakaTour: input.isOutsideDhakaTour,
      lunchClaimed: input.lunchClaimed,
      // No approved toll/parking claims exist yet at duty-close time --
      // those get reconciled onto this log by reviewExpenseClaimAction
      // once the driver submits receipts and an admin approves them.
      approvedTollParkingTotal: 0,
    },
    agreementInput
  );

  // An odometer rollback (or any other data-integrity warning) routes the
  // log to admin review instead of silently auto-approving it -- this is
  // the fraud-prevention gate the project docs called for.
  const status: "PENDING_APPROVAL" | "APPROVED" =
    result.warnings.length > 0 ? "PENDING_APPROVAL" : "APPROVED";

  await prisma.dutyLog.update({
    where: { id: dutyLog.id },
    data: {
      endTime,
      endOdometer: input.endOdometer,
      endOdometerImg: input.endOdometerImg,
      endLocation: input.endLocation,
      routeNotes: input.routeNotes,
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
      isHoliday,
      isOutsideDhakaTour: input.isOutsideDhakaTour,
      status,
    },
  });

  return ok({ totalDailyBill: result.totalDailyBill, warnings: result.warnings });
}

// ------------------------------------------
// Admin Override
// ------------------------------------------

const adminOverrideSchema = z.object({
  dutyLogId: z.string().uuid(),
  startOdometer: z.number().nonnegative().optional(),
  endOdometer: z.number().nonnegative().optional(),
  note: z.string().min(5, "Explain the correction for the audit trail."),
});
export type AdminOverrideInput = z.infer<typeof adminOverrideSchema>;

export async function adminOverrideDutyLogAction(
  rawInput: AdminOverrideInput
): Promise<ActionResult<{ totalDailyBill: number }>> {
  const auth = await requireRoleForAction(["SUPER_ADMIN", "OPERATIONS_ADMIN", "ACCOUNTS_ADMIN"]);
  if ("error" in auth) return fail(auth.error);

  const parsed = adminOverrideSchema.safeParse(rawInput);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  const input = parsed.data;

  const dutyLog = await prisma.dutyLog.findUnique({
    where: { id: input.dutyLogId },
    include: { vehicle: true, agreement: true },
  });
  if (!dutyLog) return fail("Duty log not found.");
  if (!dutyLog.endTime) return fail("Can't override a duty that hasn't been closed out yet.");
  const endTime = dutyLog.endTime; // narrowed to Date, kept stable for the calculation below

  const oldValue = {
    startOdometer: dutyLog.startOdometer,
    endOdometer: dutyLog.endOdometer,
    totalDailyBill: decToNumber(dutyLog.totalDailyBill),
  };

  const nextStartOdometer = input.startOdometer ?? dutyLog.startOdometer;
  const nextEndOdometer = input.endOdometer ?? dutyLog.endOdometer ?? 0;

  const agreementInput: AgreementCalcInput = {
    standardDutyHours: dutyLog.agreement.standardDutyHours,
    overtimeRatePerHour: decToNumber(dutyLog.agreement.overtimeRatePerHour),
    fridayHolidayOvertime: dutyLog.agreement.fridayHolidayOvertime,
    cngRatePerKm: decToNumber(dutyLog.agreement.cngRatePerKm),
    lpgRatePerKm: decToNumber(dutyLog.agreement.lpgRatePerKm),
    octaneRatePerKm: decToNumber(dutyLog.agreement.octaneRatePerKm),
    lunchAllowance: decToNumber(dutyLog.agreement.lunchAllowance),
    dinnerAllowance: decToNumber(dutyLog.agreement.dinnerAllowance),
    tourAllowancePerDay: decToNumber(dutyLog.agreement.tourAllowancePerDay),
    allowTollParkingClaim: dutyLog.agreement.allowTollParkingClaim,
  };

  const result = calculateDailyDuty(
    {
      startTime: dutyLog.startTime,
      endTime: dutyLog.endTime,
      startOdometer: nextStartOdometer,
      endOdometer: nextEndOdometer,
      vehicleFuelType: dutyLog.vehicle.fuelType,
      isHoliday: dutyLog.isHoliday,
      isOutsideDhakaTour: dutyLog.isOutsideDhakaTour,
      lunchClaimed: decToNumber(dutyLog.lunchBill) > 0,
      approvedTollParkingTotal: decToNumber(dutyLog.tollParkingBill),
    },
    agreementInput
  );

  await prisma.dutyLog.update({
    where: { id: dutyLog.id },
    data: {
      startOdometer: nextStartOdometer,
      endOdometer: nextEndOdometer,
      totalKm: result.totalKm,
      dutyHours: result.dutyHours,
      overtimeHours: result.overtimeHours,
      fuelBill: result.fuelBill,
      overtimeBill: result.overtimeBill,
      totalDailyBill: result.totalDailyBill,
      status: "EDITED_BY_ADMIN",
      approvedById: auth.user.id,
      adminEditNote: input.note,
    },
  });

  await logAudit({
    adminId: auth.user.id,
    action: "ODOMETER_OVERRIDE",
    entityName: "DutyLog",
    entityId: dutyLog.id,
    oldValue,
    newValue: {
      startOdometer: nextStartOdometer,
      endOdometer: nextEndOdometer,
      totalDailyBill: result.totalDailyBill,
      note: input.note,
    },
  });

  return ok({ totalDailyBill: result.totalDailyBill });
}

// ------------------------------------------
// Approve / Reject
// ------------------------------------------

async function setDutyLogDecision(
  dutyLogId: string,
  decision: "APPROVED" | "REJECTED",
  reason: string | undefined,
  reviewerRoles: Array<"SUPER_ADMIN" | "OPERATIONS_ADMIN" | "ACCOUNTS_ADMIN" | "CLIENT_USER">
): Promise<ActionResult<null>> {
  const auth = await requireRoleForAction(reviewerRoles);
  if ("error" in auth) return fail(auth.error);

  const dutyLog = await prisma.dutyLog.findUnique({ where: { id: dutyLogId } });
  if (!dutyLog) return fail("Duty log not found.");

  // A CLIENT_USER may only review duty logs billed to their own company.
  if (auth.user.role === "CLIENT_USER" && dutyLog.companyId !== auth.user.companyId) {
    return fail("This duty log doesn't belong to your company.");
  }

  await prisma.dutyLog.update({
    where: { id: dutyLogId },
    data: {
      status: decision,
      approvedById: auth.user.id,
      adminEditNote: reason ?? null,
    },
  });

  await logAudit({
    adminId: auth.user.id,
    action: decision === "APPROVED" ? "DUTY_LOG_APPROVED" : "DUTY_LOG_REJECTED",
    entityName: "DutyLog",
    entityId: dutyLogId,
    newValue: { status: decision, reason },
  });

  return ok(null);
}

export async function approveDutyLogAction(dutyLogId: string): Promise<ActionResult<null>> {
  return setDutyLogDecision(dutyLogId, "APPROVED", undefined, [
    "SUPER_ADMIN",
    "OPERATIONS_ADMIN",
    "ACCOUNTS_ADMIN",
    "CLIENT_USER",
  ]);
}

export async function rejectDutyLogAction(
  dutyLogId: string,
  reason: string
): Promise<ActionResult<null>> {
  if (!reason || reason.trim().length < 3) {
    return fail("Give a reason for rejecting this duty log.");
  }
  return setDutyLogDecision(dutyLogId, "REJECTED", reason, [
    "SUPER_ADMIN",
    "OPERATIONS_ADMIN",
    "ACCOUNTS_ADMIN",
    "CLIENT_USER",
  ]);
}

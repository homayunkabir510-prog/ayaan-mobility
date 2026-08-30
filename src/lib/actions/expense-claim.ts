"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ok,
  fail,
  type ActionResult,
  requireRoleForAction,
  decToNumber,
  logAudit,
} from "@/lib/actions/shared";

// ------------------------------------------
// Submit (Driver, from Ayaan Go)
// ------------------------------------------

const submitExpenseClaimSchema = z.object({
  dutyLogId: z.string().uuid(),
  expenseType: z.enum(["TOLL", "PARKING", "OTHER"]),
  amount: z.number().positive(),
  receiptImg: z.string().url(),
});
export type SubmitExpenseClaimInput = z.infer<typeof submitExpenseClaimSchema>;

export async function submitExpenseClaimAction(
  rawInput: SubmitExpenseClaimInput
): Promise<ActionResult<{ claimId: string }>> {
  const auth = await requireRoleForAction(["DRIVER"]);
  if ("error" in auth) return fail(auth.error);
  const driverProfileId = auth.user.driverProfileId;
  if (!driverProfileId) return fail("This account has no driver profile.");

  const parsed = submitExpenseClaimSchema.safeParse(rawInput);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  const input = parsed.data;

  const dutyLog = await prisma.dutyLog.findUnique({
    where: { id: input.dutyLogId },
    include: { agreement: true },
  });
  if (!dutyLog || dutyLog.driverId !== driverProfileId) {
    return fail("Duty log not found.");
  }
  if (!dutyLog.agreement.allowTollParkingClaim) {
    return fail("Toll/parking claims aren't enabled on this contract.");
  }

  const claim = await prisma.expenseClaim.create({
    data: {
      dutyLogId: dutyLog.id,
      driverId: driverProfileId,
      expenseType: input.expenseType,
      amount: input.amount,
      receiptImg: input.receiptImg,
    },
  });

  return ok({ claimId: claim.id });
}

// ------------------------------------------
// Review (Admin)
// ------------------------------------------

const reviewExpenseClaimSchema = z.object({
  claimId: z.string().uuid(),
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().optional(),
});
export type ReviewExpenseClaimInput = z.infer<typeof reviewExpenseClaimSchema>;

export async function reviewExpenseClaimAction(
  rawInput: ReviewExpenseClaimInput
): Promise<ActionResult<{ dutyLogTotalDailyBill: number }>> {
  const auth = await requireRoleForAction(["SUPER_ADMIN", "OPERATIONS_ADMIN", "ACCOUNTS_ADMIN"]);
  if ("error" in auth) return fail(auth.error);

  const parsed = reviewExpenseClaimSchema.safeParse(rawInput);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  const input = parsed.data;

  const claim = await prisma.expenseClaim.findUnique({ where: { id: input.claimId } });
  if (!claim) return fail("Claim not found.");
  if (claim.status !== "PENDING") return fail("This claim has already been reviewed.");

  const updatedClaim = await prisma.expenseClaim.update({
    where: { id: claim.id },
    data: { status: input.decision },
  });

  await logAudit({
    adminId: auth.user.id,
    action: "EXPENSE_CLAIM_REVIEWED",
    entityName: "ExpenseClaim",
    entityId: claim.id,
    oldValue: { status: "PENDING" },
    newValue: { status: input.decision, note: input.note },
  });

  // Reconcile the parent duty's toll/parking total and grand total from
  // every currently-approved claim on it, rather than incrementing --
  // this stays correct even if a previously approved claim later gets
  // corrected or a rejection gets reversed.
  const dutyLog = await prisma.dutyLog.findUniqueOrThrow({
    where: { id: updatedClaim.dutyLogId },
  });

  const approvedTotal = await prisma.expenseClaim.aggregate({
    where: { dutyLogId: dutyLog.id, status: "APPROVED" },
    _sum: { amount: true },
  });
  const tollParkingBill = decToNumber(approvedTotal._sum.amount);

  const totalDailyBill =
    decToNumber(dutyLog.fuelBill) +
    decToNumber(dutyLog.overtimeBill) +
    decToNumber(dutyLog.lunchBill) +
    decToNumber(dutyLog.dinnerBill) +
    decToNumber(dutyLog.tourAllowance) +
    tollParkingBill;

  await prisma.dutyLog.update({
    where: { id: dutyLog.id },
    data: { tollParkingBill, totalDailyBill },
  });

  return ok({ dutyLogTotalDailyBill: totalDailyBill });
}

"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isEvidenceObjectForRecord } from "@/lib/evidence-path";
import {
  decToNumber,
  fail,
  logAudit,
  ok,
  requireRoleForAction,
  roundMoney,
  withSerializableTransaction,
  type ActionResult,
} from "@/lib/actions/shared";
import { evidenceObjectExists } from "@/lib/supabase/storage";

const submitExpenseClaimSchema = z.object({
  dutyLogId: z.string().uuid(),
  expenseType: z.enum(["TOLL", "PARKING", "OTHER"]),
  amount: z.number().finite().positive().max(1_000_000),
  receiptImg: z.string().trim().min(1).max(512),
});
export type SubmitExpenseClaimInput = z.infer<typeof submitExpenseClaimSchema>;

export async function submitExpenseClaimAction(
  rawInput: SubmitExpenseClaimInput
): Promise<ActionResult<{ claimId: string }>> {
  try {
    const auth = await requireRoleForAction(["DRIVER"]);
    if ("error" in auth) return fail(auth.error);
    const driverProfileId = auth.user.driverProfileId;
    if (!driverProfileId) return fail("This account has no driver profile.");

    const parsed = submitExpenseClaimSchema.safeParse(rawInput);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
    const input = parsed.data;
    if (!isEvidenceObjectForRecord(input.receiptImg, auth.user.id, "expense-receipt", input.dutyLogId)) {
      return fail("Upload your own receipt evidence first.");
    }
    if (!(await evidenceObjectExists(input.receiptImg))) return fail("Receipt evidence is not available. Upload it again.");

    const claimId = await withSerializableTransaction(async (tx) => {
      const dutyLog = await tx.dutyLog.findFirst({
        where: { id: input.dutyLogId, driverId: driverProfileId, status: "PENDING_APPROVAL" },
        include: { agreement: { select: { allowTollParkingClaim: true } } },
      });
      if (!dutyLog) return null;
      if (!dutyLog.agreement.allowTollParkingClaim) return null;

      const existingClaim = await tx.expenseClaim.findFirst({
        where: { dutyLogId: dutyLog.id, driverId: driverProfileId, receiptImg: input.receiptImg },
        select: { id: true },
      });
      if (existingClaim) return existingClaim.id;

      const claim = await tx.expenseClaim.create({
        data: {
          dutyLogId: dutyLog.id,
          driverId: driverProfileId,
          expenseType: input.expenseType,
          amount: roundMoney(input.amount).toFixed(2),
          receiptImg: input.receiptImg,
          status: "PENDING",
        },
      });
      await logAudit({
        adminId: auth.user.id,
        action: "EXPENSE_CLAIM_SUBMITTED",
        entityName: "ExpenseClaim",
        entityId: claim.id,
        newValue: { dutyLogId: dutyLog.id, expenseType: input.expenseType, amount: roundMoney(input.amount).toFixed(2) },
      }, tx);
      return claim.id;
    });

    if (!claimId) return fail("This duty is not eligible for a toll or parking claim.");
    revalidatePath("/go");
    revalidatePath("/admin");
    return ok({ claimId });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : error instanceof Error ? error.name : "UnknownError";
    console.error("submitExpenseClaimAction failed", code);
    return fail("Could not submit this expense claim. Refresh and try again.");
  }
}

const reviewExpenseClaimSchema = z.object({
  claimId: z.string().uuid(),
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().trim().max(500).optional(),
}).refine((value) => value.decision !== "REJECTED" || Boolean(value.note && value.note.length >= 3), {
  message: "Give a short reason when rejecting a claim.",
  path: ["note"],
});
export type ReviewExpenseClaimInput = z.infer<typeof reviewExpenseClaimSchema>;

export async function reviewExpenseClaimAction(
  rawInput: ReviewExpenseClaimInput
): Promise<ActionResult<{ dutyLogTotalDailyBill: number }>> {
  try {
    const auth = await requireRoleForAction(["SUPER_ADMIN", "OPERATIONS_ADMIN", "ACCOUNTS_ADMIN"]);
    if ("error" in auth) return fail(auth.error);
    const parsed = reviewExpenseClaimSchema.safeParse(rawInput);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
    const input = parsed.data;

    const result = await withSerializableTransaction(async (tx) => {
      const claim = await tx.expenseClaim.findFirst({
        where: { id: input.claimId, status: "PENDING" },
        include: { dutyLog: true },
      });
      if (!claim) return null;
      if (claim.dutyLog.status !== "PENDING_APPROVAL" || !claim.dutyLog.endTime) return null;

      const changed = await tx.expenseClaim.updateMany({
        where: { id: claim.id, status: "PENDING" },
        data: { status: input.decision },
      });
      if (changed.count !== 1) return null;

      const approved = await tx.expenseClaim.aggregate({
        where: { dutyLogId: claim.dutyLogId, status: "APPROVED" },
        _sum: { amount: true },
      });
      const tollParkingBill = roundMoney(approved._sum.amount ?? new Prisma.Decimal(0));
      const totalDailyBill = roundMoney(
        new Prisma.Decimal(claim.dutyLog.fuelBill.toString())
          .plus(claim.dutyLog.overtimeBill)
          .plus(claim.dutyLog.lunchBill)
          .plus(claim.dutyLog.dinnerBill)
          .plus(claim.dutyLog.tourAllowance)
          .plus(tollParkingBill)
      );

      const dutyChanged = await tx.dutyLog.updateMany({
        where: { id: claim.dutyLogId, status: "PENDING_APPROVAL" },
        data: { tollParkingBill: tollParkingBill.toFixed(2), totalDailyBill: totalDailyBill.toFixed(2) },
      });
      if (dutyChanged.count !== 1) throw new Error("REVIEW_CONFLICT");

      await logAudit({
        adminId: auth.user.id,
        action: "EXPENSE_CLAIM_REVIEWED",
        entityName: "ExpenseClaim",
        entityId: claim.id,
        oldValue: { status: "PENDING" },
        newValue: { status: input.decision, note: input.note ?? null, dutyLogId: claim.dutyLogId },
      }, tx);
      return decToNumber(totalDailyBill);
    });

    if (result === null) return fail("This claim or duty is no longer available for review.");
    revalidatePath("/admin");
    revalidatePath("/go");
    revalidatePath("/fleet");
    return ok({ dutyLogTotalDailyBill: result });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : error instanceof Error ? error.name : "UnknownError";
    console.error("reviewExpenseClaimAction failed", code);
    return fail("Could not update this expense claim. Refresh and try again.");
  }
}

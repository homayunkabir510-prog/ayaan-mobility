"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createEvidenceSignedUrl, createEvidenceStorageClient, EVIDENCE_BUCKET } from "@/lib/supabase/storage";
import { makeEvidenceObjectKey, type EvidenceExtension } from "@/lib/evidence-path";
import { fail, ok, requireRoleForAction, type ActionResult } from "@/lib/actions/shared";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_DATA_URL_LENGTH = Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 128;
const uploadSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("start-odometer"), vehicleId: z.string().uuid(), dataUrl: z.string().max(MAX_DATA_URL_LENGTH) }),
  z.object({ kind: z.literal("end-odometer"), dutyLogId: z.string().uuid(), dataUrl: z.string().max(MAX_DATA_URL_LENGTH) }),
  z.object({ kind: z.literal("expense-receipt"), dutyLogId: z.string().uuid(), dataUrl: z.string().max(MAX_DATA_URL_LENGTH) }),
]);
export type UploadEvidenceInput = z.infer<typeof uploadSchema>;

function decodeImage(dataUrl: string): { bytes: Buffer; contentType: string; extension: EvidenceExtension } | null {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) return null;
  const contentType = match[1];
  const encoded = match[2];
  const bytes = Buffer.from(encoded, "base64");
  if (!bytes.length || bytes.byteLength > MAX_IMAGE_BYTES) return null;
  if (bytes.toString("base64").replace(/=+$/, "") !== encoded.replace(/=+$/, "")) return null;

  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if ((contentType === "image/jpeg" && !isJpeg) || (contentType === "image/png" && !isPng) || (contentType === "image/webp" && !isWebp)) return null;
  const extension: EvidenceExtension = contentType === "image/jpeg" ? "jpg" : contentType === "image/png" ? "png" : "webp";
  return { bytes, contentType, extension };
}

export async function uploadEvidenceAction(
  rawInput: UploadEvidenceInput
): Promise<ActionResult<{ objectKey: string }>> {
  try {
    const auth = await requireRoleForAction(["DRIVER"]);
    if ("error" in auth) return fail(auth.error);
    const driverProfileId = auth.user.driverProfileId;
    if (!driverProfileId) return fail("This account has no driver profile.");

    const parsed = uploadSchema.safeParse(rawInput);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid evidence.");
    const input = parsed.data;

    if (input.kind === "start-odometer") {
      const assignedVehicle = await prisma.vehicle.findFirst({
        where: { id: input.vehicleId, currentDriverId: driverProfileId, status: "ACTIVE" },
        select: { id: true },
      });
      if (!assignedVehicle) return fail("This vehicle is not currently assigned to you.");
    } else {
      const ownedDuty = await prisma.dutyLog.findFirst({
        where: {
          id: input.dutyLogId,
          driverId: driverProfileId,
          ...(input.kind === "end-odometer" ? { endTime: null } : {}),
        },
        select: { id: true },
      });
      if (!ownedDuty) return fail("Duty log not found.");
    }

    const image = decodeImage(input.dataUrl);
    if (!image) return fail("Choose a valid JPG, PNG, or WebP image smaller than 4 MB.");

    const storage = createEvidenceStorageClient();
    const recordId = input.kind === "start-odometer" ? input.vehicleId : input.dutyLogId;
    const objectKey = makeEvidenceObjectKey(auth.user.id, input.kind, recordId, randomUUID(), image.extension);
    const { error } = await storage.storage.from(EVIDENCE_BUCKET).upload(objectKey, image.bytes, {
      contentType: image.contentType,
      upsert: false,
      cacheControl: "3600",
    });
    if (error) return fail("Evidence upload failed. Please try again.");
    return ok({ objectKey });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "unknown";
    console.error("uploadEvidenceAction failed", code);
    return fail("Evidence storage is unavailable. Ask an administrator to configure private storage, then retry.");
  }
}

const signedUrlSchema = z.object({ path: z.string().min(1).max(512) });

export async function getEvidenceSignedUrlAction(
  rawInput: { path: string }
): Promise<ActionResult<{ url: string }>> {
  try {
    const auth = await requireRoleForAction(["SUPER_ADMIN", "OPERATIONS_ADMIN", "ACCOUNTS_ADMIN", "CLIENT_USER", "DRIVER", "CAR_OWNER"]);
    if ("error" in auth) return fail(auth.error);
    const parsed = signedUrlSchema.safeParse(rawInput);
    if (!parsed.success) return fail("Invalid evidence reference.");
    const { path } = parsed.data;

    let recordScope: Prisma.DutyLogWhereInput;
    if (auth.user.role === "CLIENT_USER") {
      if (!auth.user.companyId) return fail("This client account is not linked to a company.");
      recordScope = { companyId: auth.user.companyId };
    } else if (auth.user.role === "DRIVER") {
      if (!auth.user.driverProfileId) return fail("This driver account has no driver profile.");
      recordScope = { driverId: auth.user.driverProfileId };
    } else if (auth.user.role === "CAR_OWNER") {
      if (!auth.user.carOwnerProfileId) return fail("This owner account has no owner profile.");
      recordScope = { vehicle: { is: { carOwnerId: auth.user.carOwnerProfileId } } };
    } else {
      recordScope = {};
    }

    const [dutyLog, claim] = await Promise.all([
      prisma.dutyLog.findFirst({
        where: { AND: [recordScope, { OR: [{ startOdometerImg: path }, { endOdometerImg: path }] }] },
        select: { driverId: true, companyId: true, vehicle: { select: { carOwnerId: true } } },
      }),
      prisma.expenseClaim.findFirst({
        where: { receiptImg: path, dutyLog: { is: recordScope } },
        select: { driverId: true, dutyLog: { select: { companyId: true, vehicle: { select: { carOwnerId: true } } } } },
      }),
    ]);
    const owner = dutyLog?.vehicle.carOwnerId ?? claim?.dutyLog.vehicle.carOwnerId;
    const companyId = dutyLog?.companyId ?? claim?.dutyLog.companyId;
    const driverId = dutyLog?.driverId ?? claim?.driverId;
    if (!driverId) return fail("Evidence not found.");

    const privileged = ["SUPER_ADMIN", "OPERATIONS_ADMIN", "ACCOUNTS_ADMIN"].includes(auth.user.role);
    const permitted = privileged ||
      (auth.user.role === "DRIVER" && auth.user.driverProfileId === driverId) ||
      (auth.user.role === "CLIENT_USER" && Boolean(auth.user.companyId) && auth.user.companyId === companyId) ||
      (auth.user.role === "CAR_OWNER" && Boolean(auth.user.carOwnerProfileId) && auth.user.carOwnerProfileId === owner);
    if (!permitted) return fail("You don't have permission to view this evidence.");

    const url = await createEvidenceSignedUrl(path, 300);
    if (!url) return fail("Evidence is not available right now.");
    return ok({ url });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "unknown";
    console.error("getEvidenceSignedUrlAction failed", code);
    return fail("Evidence storage is unavailable.");
  }
}

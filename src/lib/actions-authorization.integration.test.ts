import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const actionMocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  evidenceObjectExists: vi.fn(),
  createEvidenceSignedUrl: vi.fn(),
  createEvidenceStorageClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: actionMocks.getCurrentUser,
  login: actionMocks.login,
  logout: actionMocks.logout,
  hasRole: (user: { role: string }, allowedRoles: string[]) => allowedRoles.includes(user.role),
}));

vi.mock("@/lib/supabase/storage", () => ({
  EVIDENCE_BUCKET: "integration-test-evidence",
  evidenceObjectExists: actionMocks.evidenceObjectExists,
  createEvidenceSignedUrl: actionMocks.createEvidenceSignedUrl,
  createEvidenceStorageClient: actionMocks.createEvidenceStorageClient,
}));

vi.mock("next/cache", () => ({ revalidatePath: actionMocks.revalidatePath }));

import type { AuthUser } from "@/lib/auth";
import { approveDutyLogAction, adminOverrideDutyLogAction, endDutyAction, rejectDutyLogAction, startDutyAction } from "@/lib/actions/duty-log";
import { loginAction, logoutAction } from "@/lib/actions/auth";
import { reviewExpenseClaimAction, submitExpenseClaimAction } from "@/lib/actions/expense-claim";
import { getEvidenceSignedUrlAction, uploadEvidenceAction } from "@/lib/actions/upload";
import { approveDutyLog, fetchDutyLogDetails, overrideDutyLog, rejectDutyLog, submitDutyLog } from "@/actions/dutyLog";
import { makeEvidenceObjectKey } from "@/lib/evidence-path";
import { prisma } from "@/lib/prisma";

interface ActionFixtures {
  driverUser: { id: string; name: string; phone: string };
  driverProfile: { id: string };
  clientUser: { id: string; name: string; phone: string };
  clientCompanyId: string;
  ownerUser: { id: string; name: string; phone: string };
  ownerProfileId: string;
  victimUser: { id: string; name: string; phone: string };
  victimDriverProfileId: string;
  victimOwnerProfileId: string;
  victimVehicleId: string;
  openDutyId: string;
  closedDutyId: string;
  openDutyStartEvidence: string;
  closedDutyStartEvidence: string;
  closedDutyEndEvidence: string;
  victimClaimId: string;
  victimClaimEvidence: string;
  driverActor: AuthUser;
  clientActor: AuthUser;
  ownerActor: AuthUser;
}

const testRunId = randomUUID();
const createdUserIds: string[] = [];
const createdCompanyIds: string[] = [];
const createdDriverProfileIds: string[] = [];
const createdOwnerProfileIds: string[] = [];
const createdVehicleIds: string[] = [];
const createdAgreementIds: string[] = [];
const createdDutyIds: string[] = [];
const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
let fixture: ActionFixtures;

function denied(result: { success: boolean; error?: string }, message?: RegExp): void {
  expect(result.success).toBe(false);
  if (message) expect(result.error).toMatch(message);
}

function actAs(user: AuthUser): void {
  actionMocks.getCurrentUser.mockResolvedValue(user);
}

async function createUser(role: "DRIVER" | "CLIENT_USER" | "CAR_OWNER", suffix: string, companyId?: string) {
  const user = await prisma.user.create({
    data: {
      name: `Authorization test ${suffix}`,
      phone: `authorization-test-${testRunId}-${suffix}`,
      password: "not-a-real-password-hash",
      role,
      ...(companyId ? { companyId } : {}),
    },
    select: { id: true, name: true, phone: true },
  });
  createdUserIds.push(user.id);
  return user;
}

function makeActor(
  user: { id: string; name: string; phone: string },
  role: AuthUser["role"],
  profile: { driverProfileId?: string; carOwnerProfileId?: string; companyId?: string } = {}
): AuthUser {
  return {
    ...user,
    role,
    companyId: profile.companyId ?? null,
    driverProfileId: profile.driverProfileId ?? null,
    carOwnerProfileId: profile.carOwnerProfileId ?? null,
  };
}

async function makeDutyLog(input: {
  id: string;
  driverId: string;
  vehicleId: string;
  companyId: string;
  agreementId: string;
  ownerUserId: string;
  ended: boolean;
}): Promise<{ id: string; startOdometerImg: string; endOdometerImg: string | null }> {
  const startOdometerImg = makeEvidenceObjectKey(
    input.ownerUserId,
    "start-odometer",
    input.vehicleId,
    randomUUID(),
    "jpg"
  );
  const endOdometerImg = input.ended
    ? makeEvidenceObjectKey(input.ownerUserId, "end-odometer", input.id, randomUUID(), "jpg")
    : null;
  const dutyLog = await prisma.dutyLog.create({
    data: {
      id: input.id,
      driverId: input.driverId,
      vehicleId: input.vehicleId,
      companyId: input.companyId,
      agreementId: input.agreementId,
      startTime: new Date("2026-11-20T04:00:00.000Z"),
      startOdometer: 100,
      startOdometerImg,
      endTime: input.ended ? new Date("2026-11-20T14:00:00.000Z") : null,
      endOdometer: input.ended ? 120 : null,
      endOdometerImg,
      routeNotes: input.ended ? "Test trip" : null,
      status: "PENDING_APPROVAL",
    },
    select: { id: true, startOdometerImg: true, endOdometerImg: true },
  });
  createdDutyIds.push(dutyLog.id);
  return dutyLog;
}

beforeAll(async () => {
  const companyA = await prisma.company.create({
    data: { name: `Authorization test A ${testRunId}`, contactPerson: "Test Contact", phone: `company-a-${testRunId}` },
    select: { id: true },
  });
  const companyB = await prisma.company.create({
    data: { name: `Authorization test B ${testRunId}`, contactPerson: "Test Contact", phone: `company-b-${testRunId}` },
    select: { id: true },
  });
  createdCompanyIds.push(companyA.id, companyB.id);

  const driverUser = await createUser("DRIVER", "driver-a");
  const clientUser = await createUser("CLIENT_USER", "client-a", companyA.id);
  const ownerUser = await createUser("CAR_OWNER", "owner-a");
  const victimUser = await createUser("DRIVER", "driver-b");
  const victimOwnerUser = await createUser("CAR_OWNER", "owner-b");

  const driverProfile = await prisma.driverProfile.create({
    data: { userId: driverUser.id, licenseNumber: `test-license-a-${testRunId}`, licenseExpiry: new Date("2035-01-01T00:00:00.000Z") },
    select: { id: true },
  });
  const victimDriverProfile = await prisma.driverProfile.create({
    data: { userId: victimUser.id, licenseNumber: `test-license-b-${testRunId}`, licenseExpiry: new Date("2035-01-01T00:00:00.000Z") },
    select: { id: true },
  });
  createdDriverProfileIds.push(driverProfile.id, victimDriverProfile.id);

  const ownerProfile = await prisma.carOwnerProfile.create({ data: { userId: ownerUser.id }, select: { id: true } });
  const victimOwnerProfile = await prisma.carOwnerProfile.create({ data: { userId: victimOwnerUser.id }, select: { id: true } });
  createdOwnerProfileIds.push(ownerProfile.id, victimOwnerProfile.id);

  const victimVehicle = await prisma.vehicle.create({
    data: {
      regNumber: `AUTH-${testRunId}`,
      category: "SEDAN_AXIO",
      modelYear: 2024,
      fuelType: "CNG",
      carOwnerId: victimOwnerProfile.id,
      currentDriverId: victimDriverProfile.id,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  createdVehicleIds.push(victimVehicle.id);

  const agreement = await prisma.agreement.create({
    data: {
      title: `Authorization test agreement ${testRunId}`,
      companyId: companyB.id,
      vehicleId: victimVehicle.id,
      baseRent: "1000.00",
      startDate: new Date("2020-01-01T00:00:00.000Z"),
      isActive: true,
    },
    select: { id: true },
  });
  createdAgreementIds.push(agreement.id);

  const openDutyId = randomUUID();
  const closedDutyId = randomUUID();
  const openDuty = await makeDutyLog({
    id: openDutyId,
    driverId: victimDriverProfile.id,
    vehicleId: victimVehicle.id,
    companyId: companyB.id,
    agreementId: agreement.id,
    ownerUserId: victimUser.id,
    ended: false,
  });
  const closedDuty = await makeDutyLog({
    id: closedDutyId,
    driverId: victimDriverProfile.id,
    vehicleId: victimVehicle.id,
    companyId: companyB.id,
    agreementId: agreement.id,
    ownerUserId: victimUser.id,
    ended: true,
  });
  const victimClaimEvidence = makeEvidenceObjectKey(victimUser.id, "expense-receipt", closedDuty.id, randomUUID(), "jpg");
  const victimClaim = await prisma.expenseClaim.create({
    data: {
      dutyLogId: closedDuty.id,
      driverId: victimDriverProfile.id,
      expenseType: "TOLL",
      amount: "100.00",
      receiptImg: victimClaimEvidence,
      status: "PENDING",
    },
    select: { id: true },
  });

  fixture = {
    driverUser,
    driverProfile,
    clientUser,
    clientCompanyId: companyA.id,
    ownerUser,
    ownerProfileId: ownerProfile.id,
    victimUser,
    victimDriverProfileId: victimDriverProfile.id,
    victimOwnerProfileId: victimOwnerProfile.id,
    victimVehicleId: victimVehicle.id,
    openDutyId: openDuty.id,
    closedDutyId: closedDuty.id,
    openDutyStartEvidence: openDuty.startOdometerImg,
    closedDutyStartEvidence: closedDuty.startOdometerImg,
    closedDutyEndEvidence: closedDuty.endOdometerImg!,
    victimClaimId: victimClaim.id,
    victimClaimEvidence,
    driverActor: makeActor(driverUser, "DRIVER", { driverProfileId: driverProfile.id }),
    clientActor: makeActor(clientUser, "CLIENT_USER", { companyId: companyA.id }),
    ownerActor: makeActor(ownerUser, "CAR_OWNER", { carOwnerProfileId: ownerProfile.id }),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  actionMocks.getCurrentUser.mockResolvedValue(fixture.driverActor);
  actionMocks.login.mockResolvedValue(null);
  actionMocks.logout.mockResolvedValue(undefined);
  actionMocks.evidenceObjectExists.mockResolvedValue(true);
  actionMocks.createEvidenceSignedUrl.mockResolvedValue("https://storage.invalid.test/signed");
  actionMocks.createEvidenceStorageClient.mockImplementation(() => {
    throw new Error("Unexpected external storage write in a denial test.");
  });
});

afterAll(async () => {
  try {
    if (createdDutyIds.length) {
      await prisma.expenseClaim.deleteMany({ where: { dutyLogId: { in: createdDutyIds } } });
      await prisma.auditLog.deleteMany({ where: { entityName: "DutyLog", entityId: { in: createdDutyIds } } });
      await prisma.dutyLog.deleteMany({ where: { id: { in: createdDutyIds } } });
    }
    if (createdAgreementIds.length) await prisma.agreement.deleteMany({ where: { id: { in: createdAgreementIds } } });
    if (createdVehicleIds.length) await prisma.vehicle.deleteMany({ where: { id: { in: createdVehicleIds } } });
    if (createdDriverProfileIds.length) await prisma.driverProfile.deleteMany({ where: { id: { in: createdDriverProfileIds } } });
    if (createdOwnerProfileIds.length) await prisma.carOwnerProfile.deleteMany({ where: { id: { in: createdOwnerProfileIds } } });
    if (createdUserIds.length) {
      await prisma.auditLog.deleteMany({ where: { adminId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    if (createdCompanyIds.length) await prisma.company.deleteMany({ where: { id: { in: createdCompanyIds } } });
  } finally {
    consoleErrorSpy.mockRestore();
    await prisma.$disconnect();
  }
});

describe("Server Action authorization integration (disposable PostgreSQL)", () => {
  describe("auth actions (not tenant-scoped object operations)", () => {
    it("rejects a bcrypt-overlong password before calling the public login service", async () => {
      const result = await loginAction({ phone: " 12345678 ", password: "é".repeat(37) });
      denied(result, /72 UTF-8 bytes/);
      expect(actionMocks.login).not.toHaveBeenCalled();
      expect(actionMocks.getCurrentUser).not.toHaveBeenCalled();
    });

    it("logs out only through the current session service and accepts no tenant or record ID", async () => {
      const result = await logoutAction();
      expect(result).toEqual({ success: true, data: null });
      expect(actionMocks.logout).toHaveBeenCalledOnce();
      expect(actionMocks.getCurrentUser).not.toHaveBeenCalled();
    });
  });

  describe("current duty-log actions", () => {
    it("does not let a driver start a duty on another driver's vehicle", async () => {
      actAs(fixture.driverActor);
      const evidence = makeEvidenceObjectKey(fixture.driverUser.id, "start-odometer", fixture.victimVehicleId, randomUUID(), "jpg");
      const result = await startDutyAction({
        idempotencyKey: randomUUID(),
        vehicleId: fixture.victimVehicleId,
        startOdometer: 100,
        startOdometerImg: evidence,
      });

      denied(result, /not assigned to you/);
      expect(actionMocks.evidenceObjectExists).toHaveBeenCalledOnce();
      expect(actionMocks.createEvidenceStorageClient).not.toHaveBeenCalled();
    });

    it("does not let a driver close another driver's open duty", async () => {
      actAs(fixture.driverActor);
      const endEvidence = makeEvidenceObjectKey(fixture.driverUser.id, "end-odometer", fixture.openDutyId, randomUUID(), "jpg");
      const result = await endDutyAction({
        dutyLogId: fixture.openDutyId,
        endOdometer: 120,
        endOdometerImg: endEvidence,
        routeNotes: "Cross-tenant denial test",
        lunchClaimed: false,
        isOutsideDhakaTour: false,
      });

      denied(result, /Duty log not found or already closed/);
      expect(await prisma.dutyLog.findUnique({ where: { id: fixture.openDutyId }, select: { endTime: true } })).toEqual({ endTime: null });
    });

    it("denies client users the globally privileged correction, approval and rejection actions", async () => {
      actAs(fixture.clientActor);
      denied(await adminOverrideDutyLogAction({ dutyLogId: fixture.closedDutyId, endOdometer: 121, note: "Unauthorized client correction" }), /permission/);
      denied(await approveDutyLogAction(fixture.closedDutyId), /permission/);
      denied(await rejectDutyLogAction(fixture.closedDutyId, "Unauthorized client rejection"), /permission/);

      const duty = await prisma.dutyLog.findUnique({ where: { id: fixture.closedDutyId }, select: { status: true, approvedById: true, endOdometer: true } });
      expect(duty).toEqual({ status: "PENDING_APPROVAL", approvedById: null, endOdometer: 120 });
    });
  });

  describe("expense-claim actions", () => {
    it("does not let a driver attach a claim to another driver's duty", async () => {
      actAs(fixture.driverActor);
      const receipt = makeEvidenceObjectKey(fixture.driverUser.id, "expense-receipt", fixture.closedDutyId, randomUUID(), "jpg");
      const result = await submitExpenseClaimAction({
        dutyLogId: fixture.closedDutyId,
        expenseType: "TOLL",
        amount: 100,
        receiptImg: receipt,
      });

      denied(result, /not eligible/);
      expect(await prisma.expenseClaim.count({ where: { dutyLogId: fixture.closedDutyId, driverId: fixture.driverProfile.id } })).toBe(0);
    });

    it("denies client users review access to another tenant's pending claim", async () => {
      actAs(fixture.clientActor);
      const result = await reviewExpenseClaimAction({ claimId: fixture.victimClaimId, decision: "APPROVED" });
      denied(result, /permission/);
      expect(await prisma.expenseClaim.findUnique({ where: { id: fixture.victimClaimId }, select: { status: true } })).toEqual({ status: "PENDING" });
    });
  });

  describe("evidence upload and signed-link actions", () => {
    const tinyJpegDataUrl = "data:image/jpeg;base64,/9j/";

    it("blocks all upload variants when the referenced vehicle or duty belongs to another driver", async () => {
      actAs(fixture.driverActor);
      const start = await uploadEvidenceAction({ kind: "start-odometer", vehicleId: fixture.victimVehicleId, dataUrl: tinyJpegDataUrl });
      const end = await uploadEvidenceAction({ kind: "end-odometer", dutyLogId: fixture.openDutyId, dataUrl: tinyJpegDataUrl });
      const receipt = await uploadEvidenceAction({ kind: "expense-receipt", dutyLogId: fixture.closedDutyId, dataUrl: tinyJpegDataUrl });

      denied(start, /not currently assigned/);
      denied(end, /Duty log not found/);
      denied(receipt, /Duty log not found/);
      expect(actionMocks.createEvidenceStorageClient).not.toHaveBeenCalled();
    });

    it("does not sign another company's evidence URL for a client user", async () => {
      actAs(fixture.clientActor);
      const result = await getEvidenceSignedUrlAction({ path: fixture.closedDutyStartEvidence });
      denied(result, /Evidence not found/);
      expect(actionMocks.createEvidenceSignedUrl).not.toHaveBeenCalled();
    });

    it("does not sign another driver's evidence URL for a driver", async () => {
      actAs(fixture.driverActor);
      const result = await getEvidenceSignedUrlAction({ path: fixture.closedDutyEndEvidence });
      denied(result, /Evidence not found/);
      expect(actionMocks.createEvidenceSignedUrl).not.toHaveBeenCalled();
    });

    it("does not sign another owner's receipt URL for a vehicle owner", async () => {
      actAs(fixture.ownerActor);
      const result = await getEvidenceSignedUrlAction({ path: fixture.victimClaimEvidence });
      denied(result, /Evidence not found/);
      expect(actionMocks.createEvidenceSignedUrl).not.toHaveBeenCalled();
    });
  });

  describe("legacy duty actions", () => {
    it.each([
      ["submitDutyLog", () => submitDutyLog({ dutyLogId: fixture.closedDutyId, endTime: new Date(), endOdometer: 120, endOdometerImg: "test.jpg" })],
      ["approveDutyLog", () => approveDutyLog({ dutyLogId: fixture.closedDutyId, status: "APPROVED" })],
      ["overrideDutyLog", () => overrideDutyLog({ dutyLogId: fixture.closedDutyId, newKm: 20, adminEditNote: "Test-only override note" })],
      ["rejectDutyLog", () => rejectDutyLog(fixture.closedDutyId, "Test-only rejection reason")],
      ["fetchDutyLogDetails", () => fetchDutyLogDetails(fixture.closedDutyId)],
    ])("%s remains fail-closed while its legacy auth provider is a placeholder", async (_name, invoke) => {
      const result = await invoke();
      denied(result, /Unauthorized: No authenticated user/);
    });
  });
});

// ==========================================
// AYAAN MOBILITY - DYNAMIC CALCULATION ENGINE
// Pure, side-effect-free business logic.
// All BDT amounts are calculated with decimal arithmetic and rounded to two
// decimal places using half-up rounding, matching the Decimal(12,2) schema.
// ==========================================

import { Prisma, type FuelType, type RentalType } from "@/generated/prisma/client";

export interface DutyLogCalcInput {
  startTime: Date;
  endTime: Date;
  startOdometer: number;
  endOdometer: number;
  vehicleFuelType: FuelType;
  isHoliday: boolean;
  isOutsideDhakaTour: boolean;
  lunchClaimed: boolean;
  approvedTollParkingTotal: number;
}

export interface AgreementCalcInput {
  standardDutyHours: number;
  overtimeRatePerHour: number;
  fridayHolidayOvertime: boolean;
  cngRatePerKm: number;
  lpgRatePerKm: number;
  octaneRatePerKm: number;
  lunchAllowance: number;
  dinnerAllowance: number;
  tourAllowancePerDay: number;
  allowTollParkingClaim: boolean;
}

export interface DailyDutyResult {
  totalKm: number;
  dutyHours: number;
  overtimeHours: number;
  fuelBill: number;
  overtimeBill: number;
  lunchBill: number;
  dinnerBill: number;
  tourAllowance: number;
  tollParkingBill: number;
  totalDailyBill: number;
  warnings: string[];
}

const DINNER_TRIGGER_OVERTIME_HOURS = 2;
const ROUND_HALF_UP = Prisma.Decimal.ROUND_HALF_UP;

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toString());
}

function money(value: Prisma.Decimal | number): number {
  const amount = value instanceof Prisma.Decimal ? value : decimal(value);
  return amount.toDecimalPlaces(2, ROUND_HALF_UP).toNumber();
}

function sumMoney(values: number[]): number {
  return money(values.reduce((sum, value) => sum.plus(decimal(value)), new Prisma.Decimal(0)));
}

function resolveFuelRatePerKm(
  fuelType: FuelType,
  agreement: Pick<AgreementCalcInput, "cngRatePerKm" | "lpgRatePerKm" | "octaneRatePerKm">
): number {
  switch (fuelType) {
    case "CNG": return agreement.cngRatePerKm;
    case "LPG": return agreement.lpgRatePerKm;
    case "OCTANE":
    case "PETROL":
    case "DIESEL": return agreement.octaneRatePerKm;
    case "OCTANE_AND_CNG": return money(decimal(agreement.octaneRatePerKm).plus(agreement.cngRatePerKm).dividedBy(2));
    case "OCTANE_AND_LPG": return money(decimal(agreement.octaneRatePerKm).plus(agreement.lpgRatePerKm).dividedBy(2));
    default: return agreement.octaneRatePerKm;
  }
}

export function calculateDailyDuty(
  dutyLog: DutyLogCalcInput,
  agreement: AgreementCalcInput
): DailyDutyResult {
  const warnings: string[] = [];
  let totalKm = dutyLog.endOdometer - dutyLog.startOdometer;
  if (totalKm < 0) {
    warnings.push(`End odometer (${dutyLog.endOdometer}) is lower than start odometer (${dutyLog.startOdometer}). Flagged for review.`);
    totalKm = 0;
  }

  const dutyHours = Math.max(0, (dutyLog.endTime.getTime() - dutyLog.startTime.getTime()) / (1000 * 60 * 60));
  const overtimeHours = dutyLog.isHoliday && agreement.fridayHolidayOvertime
    ? dutyHours
    : Math.max(0, dutyHours - agreement.standardDutyHours);
  const overtimeBill = money(decimal(overtimeHours).mul(agreement.overtimeRatePerHour));
  const fuelRatePerKm = resolveFuelRatePerKm(dutyLog.vehicleFuelType, agreement);
  const fuelBill = money(decimal(totalKm).mul(fuelRatePerKm));
  const lunchBill = dutyLog.lunchClaimed ? money(agreement.lunchAllowance) : 0;
  const dinnerBill = dutyHours >= agreement.standardDutyHours + DINNER_TRIGGER_OVERTIME_HOURS
    ? money(agreement.dinnerAllowance)
    : 0;
  const tourAllowance = dutyLog.isOutsideDhakaTour ? money(agreement.tourAllowancePerDay) : 0;
  const tollParkingBill = agreement.allowTollParkingClaim
    ? money(Math.max(0, dutyLog.approvedTollParkingTotal))
    : 0;
  const totalDailyBill = sumMoney([fuelBill, overtimeBill, lunchBill, dinnerBill, tourAllowance, tollParkingBill]);

  return {
    totalKm,
    dutyHours,
    overtimeHours,
    fuelBill,
    overtimeBill,
    lunchBill,
    dinnerBill,
    tourAllowance,
    tollParkingBill,
    totalDailyBill,
    warnings,
  };
}

export interface MonthlyInvoiceAgreement extends AgreementCalcInput {
  baseRent: number;
  rentalType: RentalType;
}

export interface MonthlyInvoiceInput {
  dutyLogs: DutyLogCalcInput[];
  agreement: MonthlyInvoiceAgreement;
}

export interface MonthlyInvoiceResult {
  baseRentTotal: number;
  fuelTotal: number;
  overtimeTotal: number;
  allowanceTotal: number;
  tollTotal: number;
  grandTotal: number;
  dutyBreakdown: DailyDutyResult[];
  warnings: string[];
}

export function calculateMonthlyInvoice(input: MonthlyInvoiceInput): MonthlyInvoiceResult {
  const { dutyLogs, agreement } = input;
  const dutyBreakdown = dutyLogs.map((log) => calculateDailyDuty(log, agreement));
  const fuelTotal = sumMoney(dutyBreakdown.map((duty) => duty.fuelBill));
  const overtimeTotal = sumMoney(dutyBreakdown.map((duty) => duty.overtimeBill));
  const allowanceTotal = sumMoney(dutyBreakdown.map((duty) => duty.lunchBill + duty.dinnerBill + duty.tourAllowance));
  const tollTotal = sumMoney(dutyBreakdown.map((duty) => duty.tollParkingBill));
  const baseRentTotal = resolveBaseRentTotal(agreement, dutyLogs);
  const grandTotal = sumMoney([baseRentTotal, fuelTotal, overtimeTotal, allowanceTotal, tollTotal]);
  return {
    baseRentTotal,
    fuelTotal,
    overtimeTotal,
    allowanceTotal,
    tollTotal,
    grandTotal,
    dutyBreakdown,
    warnings: dutyBreakdown.flatMap((duty) => duty.warnings),
  };
}

function resolveBaseRentTotal(
  agreement: Pick<MonthlyInvoiceAgreement, "baseRent" | "rentalType">,
  dutyLogs: DutyLogCalcInput[]
): number {
  if (agreement.rentalType === "MONTHLY_CORPORATE") return money(agreement.baseRent);
  if (agreement.rentalType === "DAILY") return money(decimal(agreement.baseRent).mul(dutyLogs.length));

  const weekKeys = new Set(dutyLogs.map((log) => {
    const date = new Date(log.startTime);
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((date.getTime() - firstDayOfYear.getTime()) / 86_400_000) + 1;
    const weekNumber = Math.ceil((dayOfYear + firstDayOfYear.getDay()) / 7);
    return `${date.getFullYear()}-W${weekNumber}`;
  }));
  return money(decimal(agreement.baseRent).mul(weekKeys.size));
}

export interface OwnerPayoutInput {
  grossRent: number;
  commissionTierPct: number;
  maintenanceDeducted?: number;
}

export interface OwnerPayoutResult {
  totalGrossEarn: number;
  commissionDeducted: number;
  maintenanceDeducted: number;
  netPayoutAmount: number;
}

export function calculateOwnerPayout(input: OwnerPayoutInput): OwnerPayoutResult {
  const gross = money(Math.max(0, input.grossRent));
  const commissionPct = Math.min(25, Math.max(1, input.commissionTierPct));
  const commissionDeducted = money(decimal(gross).mul(commissionPct).dividedBy(100));
  const maintenanceDeducted = money(Math.max(0, input.maintenanceDeducted ?? 0));
  const netBeforeFloor = decimal(gross).minus(commissionDeducted).minus(maintenanceDeducted);
  const netPayoutAmount = money(netBeforeFloor.isNegative() ? new Prisma.Decimal(0) : netBeforeFloor);
  return { totalGrossEarn: gross, commissionDeducted, maintenanceDeducted, netPayoutAmount };
}

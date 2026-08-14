// ==========================================
// AYAAN MOBILITY - DYNAMIC CALCULATION ENGINE
// Pure, side-effect-free business logic.
// Consumed by Server Actions across Ayaan Go,
// Ayaan Fleet, and Ayaan Mobility Admin.
// ==========================================

import type { FuelType, RentalType } from "@prisma/client";

// ------------------------------------------
// Shared Input / Output Types
// ------------------------------------------

export interface DutyLogCalcInput {
  startTime: Date;
  endTime: Date;
  startOdometer: number;
  endOdometer: number;
  vehicleFuelType: FuelType;
  isHoliday: boolean;
  isOutsideDhakaTour: boolean;
  lunchClaimed: boolean;
  /** Sum of this duty's ExpenseClaim rows where status === "APPROVED". */
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
  /** Non-fatal data issues (e.g. odometer rollback) that should route the log to admin review. */
  warnings: string[];
}

// Dinner is auto-triggered once total duty time exceeds standard hours by this margin.
const DINNER_TRIGGER_OVERTIME_HOURS = 2;

// ------------------------------------------
// Helper: resolve the correct per-KM fuel rate
// for the vehicle's fuel type under this agreement.
// ------------------------------------------
function resolveFuelRatePerKm(
  fuelType: FuelType,
  agreement: Pick<AgreementCalcInput, "cngRatePerKm" | "lpgRatePerKm" | "octaneRatePerKm">
): number {
  switch (fuelType) {
    case "CNG":
      return agreement.cngRatePerKm;
    case "LPG":
      return agreement.lpgRatePerKm;
    case "OCTANE":
    case "PETROL":
    case "DIESEL":
      return agreement.octaneRatePerKm;
    case "OCTANE_AND_CNG":
      return (agreement.octaneRatePerKm + agreement.cngRatePerKm) / 2;
    case "OCTANE_AND_LPG":
      return (agreement.octaneRatePerKm + agreement.lpgRatePerKm) / 2;
    default:
      return agreement.octaneRatePerKm;
  }
}

// ==========================================
// 1. calculateDailyDuty
// The core per-log formula run every time a driver
// closes out a duty on Ayaan Go.
// ==========================================
export function calculateDailyDuty(
  dutyLog: DutyLogCalcInput,
  agreement: AgreementCalcInput
): DailyDutyResult {
  const warnings: string[] = [];

  // --- Distance ---
  let totalKm = dutyLog.endOdometer - dutyLog.startOdometer;
  if (totalKm < 0) {
    warnings.push(
      `End odometer (${dutyLog.endOdometer}) is lower than start odometer (${dutyLog.startOdometer}). Flagged for Super Admin review.`
    );
    totalKm = 0;
  }

  // --- Duty Duration ---
  const dutyHours = Math.max(
    0,
    (dutyLog.endTime.getTime() - dutyLog.startTime.getTime()) / (1000 * 60 * 60)
  );

  // --- Overtime ---
  // On Friday/Government holidays, contracts that enable fridayHolidayOvertime
  // bill the entire duty span as overtime rather than only the hours past the standard limit.
  const overtimeHours =
    dutyLog.isHoliday && agreement.fridayHolidayOvertime
      ? dutyHours
      : Math.max(0, dutyHours - agreement.standardDutyHours);
  const overtimeBill = overtimeHours * agreement.overtimeRatePerHour;

  // --- Fuel ---
  const fuelRatePerKm = resolveFuelRatePerKm(dutyLog.vehicleFuelType, agreement);
  const fuelBill = totalKm * fuelRatePerKm;

  // --- Lunch Allowance ---
  const lunchBill = dutyLog.lunchClaimed ? agreement.lunchAllowance : 0;

  // --- Dinner Allowance (auto-triggered by duty length) ---
  const dinnerBill =
    dutyHours >= agreement.standardDutyHours + DINNER_TRIGGER_OVERTIME_HOURS
      ? agreement.dinnerAllowance
      : 0;

  // --- Tour Allowance (outside Dhaka) ---
  const tourAllowance = dutyLog.isOutsideDhakaTour ? agreement.tourAllowancePerDay : 0;

  // --- Toll & Parking (only if the contract allows digital claims) ---
  const tollParkingBill = agreement.allowTollParkingClaim
    ? Math.max(0, dutyLog.approvedTollParkingTotal)
    : 0;

  const totalDailyBill =
    fuelBill + overtimeBill + lunchBill + dinnerBill + tourAllowance + tollParkingBill;

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

// ==========================================
// 2. calculateMonthlyInvoice
// Aggregates a company's duty logs for a billing
// cycle into the line items shown on the Invoice model.
// ==========================================

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

  const fuelTotal = dutyBreakdown.reduce((sum, d) => sum + d.fuelBill, 0);
  const overtimeTotal = dutyBreakdown.reduce((sum, d) => sum + d.overtimeBill, 0);
  const allowanceTotal = dutyBreakdown.reduce(
    (sum, d) => sum + d.lunchBill + d.dinnerBill + d.tourAllowance,
    0
  );
  const tollTotal = dutyBreakdown.reduce((sum, d) => sum + d.tollParkingBill, 0);

  const baseRentTotal = resolveBaseRentTotal(agreement, dutyLogs);

  const grandTotal = baseRentTotal + fuelTotal + overtimeTotal + allowanceTotal + tollTotal;
  const warnings = dutyBreakdown.flatMap((d) => d.warnings);

  return {
    baseRentTotal,
    fuelTotal,
    overtimeTotal,
    allowanceTotal,
    tollTotal,
    grandTotal,
    dutyBreakdown,
    warnings,
  };
}

// Base rent is charged differently depending on the contract's RentalType:
// once per month for MONTHLY_CORPORATE, once per duty day for DAILY,
// and once per distinct calendar week represented in the log set for WEEKLY.
function resolveBaseRentTotal(
  agreement: Pick<MonthlyInvoiceAgreement, "baseRent" | "rentalType">,
  dutyLogs: DutyLogCalcInput[]
): number {
  if (agreement.rentalType === "MONTHLY_CORPORATE") {
    return agreement.baseRent;
  }

  if (agreement.rentalType === "DAILY") {
    return agreement.baseRent * dutyLogs.length;
  }

  // WEEKLY: count distinct ISO-ish week buckets present in the log set.
  const weekKeys = new Set(
    dutyLogs.map((log) => {
      const date = new Date(log.startTime);
      const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
      const dayOfYear =
        Math.floor((date.getTime() - firstDayOfYear.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      const weekNumber = Math.ceil((dayOfYear + firstDayOfYear.getDay()) / 7);
      return `${date.getFullYear()}-W${weekNumber}`;
    })
  );
  return agreement.baseRent * weekKeys.size;
}

// ==========================================
// 3. calculateOwnerPayout
// Settles a car owner's monthly payout after the
// Ayaan Mobility commission tier and maintenance deductions.
// ==========================================

export interface OwnerPayoutInput {
  grossRent: number;
  /** Ayaan Mobility's commission tier for this owner, expected between 1 and 25. */
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
  const commissionPct = Math.min(25, Math.max(1, input.commissionTierPct));
  const commissionDeducted = input.grossRent * (commissionPct / 100);
  const maintenanceDeducted = input.maintenanceDeducted ?? 0;
  const netPayoutAmount = Math.max(
    0,
    input.grossRent - commissionDeducted - maintenanceDeducted
  );

  return {
    totalGrossEarn: input.grossRent,
    commissionDeducted,
    maintenanceDeducted,
    netPayoutAmount,
  };
}

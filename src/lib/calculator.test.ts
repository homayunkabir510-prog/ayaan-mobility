import { describe, expect, it } from "vitest";
import { calculateDailyDuty, calculateOwnerPayout, type AgreementCalcInput, type DutyLogCalcInput } from "./calculator";

const agreement: AgreementCalcInput = {
  standardDutyHours: 10,
  overtimeRatePerHour: 100,
  fridayHolidayOvertime: true,
  cngRatePerKm: 12.5,
  lpgRatePerKm: 15,
  octaneRatePerKm: 20,
  lunchAllowance: 200,
  dinnerAllowance: 150,
  tourAllowancePerDay: 1200,
  allowTollParkingClaim: true,
};

function duty(overrides: Partial<DutyLogCalcInput> = {}): DutyLogCalcInput {
  return {
    startTime: new Date("2026-11-18T02:00:00.000Z"),
    endTime: new Date("2026-11-18T10:00:00.000Z"),
    startOdometer: 1000,
    endOdometer: 1050,
    vehicleFuelType: "CNG",
    isHoliday: false,
    isOutsideDhakaTour: false,
    lunchClaimed: false,
    approvedTollParkingTotal: 100.57,
    ...overrides,
  };
}

describe("calculateDailyDuty", () => {
  it("calculates and sums BDT to two decimal places", () => {
    const result = calculateDailyDuty(duty(), agreement);
    expect(result.totalKm).toBe(50);
    expect(result.fuelBill).toBe(625);
    expect(result.overtimeBill).toBe(0);
    expect(result.tollParkingBill).toBe(100.57);
    expect(result.totalDailyBill).toBe(725.57);
  });

  it("rounds half-paisa amounts half up at the component boundary", () => {
    const result = calculateDailyDuty(
      duty({ startOdometer: 10, endOdometer: 10.5, lunchClaimed: false, approvedTollParkingTotal: 0 }),
      { ...agreement, cngRatePerKm: 0.333 }
    );
    expect(result.fuelBill).toBe(0.17);
    expect(result.totalDailyBill).toBe(0.17);
  });

  it("flags odometer rollback and never produces negative distance", () => {
    const result = calculateDailyDuty(duty({ startOdometer: 200, endOdometer: 100 }), agreement);
    expect(result.totalKm).toBe(0);
    expect(result.warnings).toHaveLength(1);
  });

  it("bills Friday holiday overtime using the server-provided holiday decision", () => {
    const result = calculateDailyDuty(duty({ isHoliday: true }), agreement);
    expect(result.dutyHours).toBe(8);
    expect(result.overtimeHours).toBe(8);
    expect(result.overtimeBill).toBe(800);
  });
});

describe("calculateOwnerPayout", () => {
  it("uses exact decimal commission and clamps the net at zero", () => {
    expect(calculateOwnerPayout({ grossRent: 1000, commissionTierPct: 10.25, maintenanceDeducted: 25.55 })).toEqual({
      totalGrossEarn: 1000,
      commissionDeducted: 102.5,
      maintenanceDeducted: 25.55,
      netPayoutAmount: 871.95,
    });
    expect(calculateOwnerPayout({ grossRent: 100, commissionTierPct: 25, maintenanceDeducted: 200 }).netPayoutAmount).toBe(0);
  });
});

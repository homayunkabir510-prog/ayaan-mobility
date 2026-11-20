import { describe, expect, it } from "vitest";
import { endDutyInputSchema, startDutyInputSchema } from "./duty";

const validStart = {
  idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
  vehicleId: "550e8400-e29b-41d4-a716-446655440001",
  startOdometer: 12_345.6,
  startOdometerImg: "550e8400-e29b-41d4-a716-446655440002/start-odometer/photo.jpg",
};

describe("duty input validation", () => {
  it("accepts bounded odometer values and a valid idempotency key", () => {
    expect(startDutyInputSchema.safeParse(validStart).success).toBe(true);
  });

  it("rejects non-finite and implausibly large odometer values", () => {
    expect(startDutyInputSchema.safeParse({ ...validStart, startOdometer: Number.POSITIVE_INFINITY }).success).toBe(false);
    expect(startDutyInputSchema.safeParse({ ...validStart, startOdometer: 1_000_000 }).success).toBe(false);
  });

  it("rejects malformed duty identifiers before a database lookup", () => {
    expect(startDutyInputSchema.safeParse({ ...validStart, vehicleId: "not-a-uuid" }).success).toBe(false);
  });

  it("does not allow a driver-supplied government holiday flag into authoritative input", () => {
    const result = endDutyInputSchema.safeParse({
      dutyLogId: "550e8400-e29b-41d4-a716-446655440003",
      endOdometer: 12_400,
      endOdometerImg: "550e8400-e29b-41d4-a716-446655440004/end-odometer/photo.jpg",
      routeNotes: "Office to client and back",
      isGovernmentHoliday: true,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).not.toHaveProperty("isGovernmentHoliday");
  });

  it("rejects unbounded notes and excessive odometer values at duty end", () => {
    const base = {
      dutyLogId: "550e8400-e29b-41d4-a716-446655440003",
      endOdometer: 12_400,
      endOdometerImg: "550e8400-e29b-41d4-a716-446655440004/end-odometer/photo.jpg",
      routeNotes: "Office to client and back",
    };
    expect(endDutyInputSchema.safeParse({ ...base, endOdometer: 1_000_000 }).success).toBe(false);
    expect(endDutyInputSchema.safeParse({ ...base, routeNotes: "x".repeat(1501) }).success).toBe(false);
  });
});

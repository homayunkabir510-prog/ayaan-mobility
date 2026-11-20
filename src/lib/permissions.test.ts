import { describe, expect, it } from "vitest";
import { canOverrideDuty, canReviewDuty } from "./permissions";

describe("duty role matrix", () => {
  it("allows only Super Admin and Operations Admin to decide duty review", () => {
    expect(canReviewDuty("SUPER_ADMIN")).toBe(true);
    expect(canReviewDuty("OPERATIONS_ADMIN")).toBe(true);
    expect(canReviewDuty("ACCOUNTS_ADMIN")).toBe(false);
    expect(canReviewDuty("CLIENT_USER")).toBe(false);
  });

  it("reserves duty corrections for Super Admin", () => {
    expect(canOverrideDuty("SUPER_ADMIN")).toBe(true);
    expect(canOverrideDuty("OPERATIONS_ADMIN")).toBe(false);
    expect(canOverrideDuty("ACCOUNTS_ADMIN")).toBe(false);
    expect(canOverrideDuty("DRIVER")).toBe(false);
  });
});

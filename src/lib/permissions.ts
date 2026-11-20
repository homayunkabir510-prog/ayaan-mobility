import type { Role } from "@/generated/prisma/client";

export const DUTY_REVIEW_ROLES: Role[] = ["SUPER_ADMIN", "OPERATIONS_ADMIN"];
export const DUTY_OVERRIDE_ROLES: Role[] = ["SUPER_ADMIN"];

export function canReviewDuty(role: Role): boolean {
  return DUTY_REVIEW_ROLES.includes(role);
}

export function canOverrideDuty(role: Role): boolean {
  return DUTY_OVERRIDE_ROLES.includes(role);
}

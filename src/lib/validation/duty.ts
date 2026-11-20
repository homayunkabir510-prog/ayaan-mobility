import { z } from "zod";

export const MAX_ODOMETER_KM = 999_999;

const odometer = z.number().finite().min(0).max(MAX_ODOMETER_KM);
const evidenceKey = z.string().trim().min(1).max(512);

export const startDutyInputSchema = z.object({
  idempotencyKey: z.string().uuid(),
  vehicleId: z.string().uuid(),
  startOdometer: odometer,
  startOdometerImg: evidenceKey,
  startLocation: z.string().trim().max(160).optional(),
});
export type StartDutyInput = z.infer<typeof startDutyInputSchema>;

export const endDutyInputSchema = z.object({
  dutyLogId: z.string().uuid(),
  endOdometer: odometer,
  endOdometerImg: evidenceKey,
  endLocation: z.string().trim().max(160).optional(),
  routeNotes: z.string().trim().min(1, "Please note where the car traveled.").max(1500),
  lunchClaimed: z.boolean().default(false),
  isOutsideDhakaTour: z.boolean().default(false),
});
export type EndDutyInput = z.infer<typeof endDutyInputSchema>;

export const adminOverrideInputSchema = z.object({
  dutyLogId: z.string().uuid(),
  startOdometer: odometer.optional(),
  endOdometer: odometer.optional(),
  note: z.string().trim().min(5, "Explain the correction for the audit trail.").max(1000),
}).refine((value) => value.startOdometer !== undefined || value.endOdometer !== undefined, {
  message: "Provide at least one corrected odometer reading.",
});
export type AdminOverrideInput = z.infer<typeof adminOverrideInputSchema>;

import { createHmac } from "node:crypto";

export function normalizePhoneForRateLimit(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits || phone.trim().toLowerCase();
}

export function loginRateLimitKey(phone: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`ayaan:login:v1:${normalizePhoneForRateLimit(phone)}`)
    .digest("hex");
}

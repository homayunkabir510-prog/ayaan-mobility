import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { loginRateLimitKey } from "@/lib/login-rate-limit-key";

export { loginRateLimitKey, normalizePhoneForRateLimit } from "@/lib/login-rate-limit-key";

export const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 10;
const RATE_LIMIT_RETENTION_MS = 24 * 60 * 60 * 1000;

function configuredSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || new TextEncoder().encode(secret).byteLength < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 bytes for login throttling.");
  }
  return secret;
}

/**
 * Atomically consumes one attempt in a shared PostgreSQL fixed-window limiter.
 * It is intentionally account-keyed: client-supplied forwarding/IP headers are
 * not trusted. Only the HMAC digest is stored, not the phone number itself.
 */
export async function consumeLoginAttempt(phone: string, now = new Date()): Promise<boolean> {
  const keyHash = loginRateLimitKey(phone, configuredSecret());
  const cutoff = new Date(now.getTime() - LOGIN_RATE_LIMIT_WINDOW_MS);
  const retentionCutoff = new Date(now.getTime() - RATE_LIMIT_RETENTION_MS);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`
      DELETE FROM "LoginRateLimit"
      WHERE "updatedAt" < ${retentionCutoff}
    `);

    const rows = await tx.$queryRaw<Array<{ attemptCount: number }>>(Prisma.sql`
      INSERT INTO "LoginRateLimit" ("keyHash", "windowStartedAt", "attemptCount", "updatedAt")
      VALUES (${keyHash}, ${now}, 1, ${now})
      ON CONFLICT ("keyHash") DO UPDATE SET
        "attemptCount" = CASE
          WHEN "LoginRateLimit"."windowStartedAt" <= ${cutoff} THEN 1
          ELSE LEAST("LoginRateLimit"."attemptCount" + 1, 2147483647)
        END,
        "windowStartedAt" = CASE
          WHEN "LoginRateLimit"."windowStartedAt" <= ${cutoff} THEN ${now}
          ELSE "LoginRateLimit"."windowStartedAt"
        END,
        "updatedAt" = ${now}
      RETURNING "attemptCount"
    `);

    return (rows[0]?.attemptCount ?? LOGIN_RATE_LIMIT_MAX_ATTEMPTS + 1) <= LOGIN_RATE_LIMIT_MAX_ATTEMPTS;
  });
}

export async function clearLoginAttempts(phone: string): Promise<void> {
  const keyHash = loginRateLimitKey(phone, configuredSecret());
  await prisma.loginRateLimit.deleteMany({ where: { keyHash } });
}

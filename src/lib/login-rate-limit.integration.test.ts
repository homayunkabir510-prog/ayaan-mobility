import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { clearLoginAttempts, consumeLoginAttempt, LOGIN_RATE_LIMIT_MAX_ATTEMPTS } from "./login-rate-limit";
import { loginRateLimitKey } from "./login-rate-limit-key";
import { prisma } from "./prisma";

const uniquePhone = `+8801${Date.now()}${Math.floor(Math.random() * 1_000_000)}`;
const uniqueKey = loginRateLimitKey(uniquePhone, process.env.SESSION_SECRET ?? "missing-test-secret");

beforeEach(async () => {
  await prisma.loginRateLimit.deleteMany({ where: { keyHash: uniqueKey } });
});

afterAll(async () => {
  await prisma.loginRateLimit.deleteMany({ where: { keyHash: uniqueKey } });
  await prisma.$disconnect();
});

describe("PostgreSQL-backed login rate limit", () => {
  it("allows the configured number of attempts and blocks the next attempt", async () => {
    for (let i = 0; i < LOGIN_RATE_LIMIT_MAX_ATTEMPTS; i += 1) {
      await expect(consumeLoginAttempt(uniquePhone)).resolves.toBe(true);
    }
    await expect(consumeLoginAttempt(uniquePhone)).resolves.toBe(false);
  });

  it("atomically blocks concurrent excess attempts", async () => {
    const attempts = await Promise.all(Array.from({ length: LOGIN_RATE_LIMIT_MAX_ATTEMPTS + 5 }, () => consumeLoginAttempt(uniquePhone)));
    expect(attempts.filter(Boolean)).toHaveLength(LOGIN_RATE_LIMIT_MAX_ATTEMPTS);
    expect(attempts.filter((allowed) => !allowed)).toHaveLength(5);
  });

  it("starts a fresh window after the fixed 15-minute period", async () => {
    const firstAttempt = new Date("2026-11-20T10:00:00.000Z");
    for (let i = 0; i < LOGIN_RATE_LIMIT_MAX_ATTEMPTS; i += 1) {
      await expect(consumeLoginAttempt(uniquePhone, firstAttempt)).resolves.toBe(true);
    }
    await expect(consumeLoginAttempt(uniquePhone, new Date(firstAttempt.getTime() + 16 * 60 * 1000))).resolves.toBe(true);
  });

  it("clears the bucket after successful authentication", async () => {
    await consumeLoginAttempt(uniquePhone);
    await clearLoginAttempts(uniquePhone);
    await expect(consumeLoginAttempt(uniquePhone)).resolves.toBe(true);
  });
});
